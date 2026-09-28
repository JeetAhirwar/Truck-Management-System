const express = require('express');
const crypto = require('crypto');
const Trip = require('../models/Trip');
const Truck = require('../models/Truck');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');
const { fullTripCalc, validateDistance } = require('../utils/calc');
const { getRoute } = require('../services/osrm');
const { resolveToll } = require('../services/tollProvider');
const { eventNotifiers } = require('../services/notificationService');
const router = express.Router();
router.use(protect);

const DEFAULT_SETTINGS = {
  dieselPrice: 92,
  cngPrice: 75,
  petrolPrice: 105,
  defaultDriverExpense: 2500,
  defaultOtherExpense: 500,
  defaultAvgSpeed: 50
};

async function getSettings() {
  const settings = await Settings.findOne();
  return settings ? settings.toObject() : DEFAULT_SETTINGS;
}

/** undefined / null / '' / NaN -> default; explicit 0 stays 0. */
const pickNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const fuelPriceFor = (truck, settings) =>
  truck.fuelType === 'CNG'
    ? Number(settings.cngPrice) || DEFAULT_SETTINGS.cngPrice
    : truck.fuelType === 'Petrol'
      ? Number(settings.petrolPrice) || DEFAULT_SETTINGS.petrolPrice
      : Number(settings.dieselPrice) || DEFAULT_SETTINGS.dieselPrice;

/**
 * Collision-free trip reference. The old `countDocuments() + 1` scheme raced
 * under concurrent requests (two inserts could claim the same number, and the
 * unique index then rejected one). A random 8-char suffix + existence check
 * + duplicate-key retry removes the race entirely.
 */
async function generateTripId() {
  for (let i = 0; i < 6; i += 1) {
    const id = `TRP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await Trip.exists({ tripId: id }))) return id;
  }
  return `TRP-${Date.now().toString(36).toUpperCase()}`;
}

const isDuplicateKey = (err) => err && (err.code === 11000 || err.code === 11001);

const TRIP_STATUSES = ['Planned', 'Assigned', 'Started', 'In Transit', 'Reached', 'Completed', 'Cancelled'];
const ACTIVE_TRIP_STATUSES = ['Started', 'In Transit', 'Reached'];
const FREED_TRIP_STATUSES = ['Completed', 'Cancelled'];

/** Fields a client is allowed to change on an existing trip. */
const UPDATABLE_FIELDS = [
  'status', 'revenue', 'tollCost', 'driverExpense', 'otherExpenses', 'notes',
  'cargo', 'cargoWeight', 'customer', 'driver', 'driverName',
  'expectedDelivery', 'completedDate', 'startDate', 'distance'
];

/** Keeps stored routes small enough for Mongo's 16 MB doc limit. */function simplifyGeometry(geometry, maxPoints = 1500) {
  if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  const pts = geometry.coordinates;
  if (pts.length <= maxPoints) return { type: 'LineString', coordinates: pts };
  const step = Math.ceil(pts.length / maxPoints);
  const kept = pts.filter((_, i) => i % step === 0);
  const last = pts[pts.length - 1];
  if (kept[kept.length - 1] !== last) kept.push(last);
  return { type: 'LineString', coordinates: kept };
}

/** `"Indore, MP"` + `{lat,lng}` -> subdocument, tolerating missing coords. */
const placeOf = (place, fallbackName) => {
  const source = place && typeof place === 'object' ? place : {};
  const lat = Number(source.lat);
  const lng = Number(source.lng);
  return {
    label: String(source.label || fallbackName || '').trim(),
    ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {})
  };
};

// Quick Calculator (no save) — OSRM route + TollGuru tolls + fuel/profit
router.post('/calculate', async (req, res) => {
  try {
    const {
      truckId,
      distance,
      revenue,
      tollCost,
      driverExpense,
      otherExpenses,
      from,
      to,
      vehicleType,
      skipTolls = false,
      includeGeometry = false
    } = req.body;

    if (!truckId) {
      return res.status(400).json({ error: 'Truck is required', code: 'VALIDATION' });
    }

    const hasRoute = Boolean(from && to);
    let distanceKm;

    if (!hasRoute) {
      const check = validateDistance(distance);
      if (!check.ok) {
        return res.status(400).json({ error: check.error, code: 'VALIDATION' });
      }
      distanceKm = check.value;
    }

    const truck = await Truck.findById(truckId);
    if (!truck) return res.status(404).json({ error: 'Truck not found', code: 'NOT_FOUND' });

    const settings = await getSettings();
    const fuelPrice = fuelPriceFor(truck, settings);

    let route = null;
    let toll = { cost: pickNumber(tollCost, 0), source: 'manual', isEstimatedToll: false };

    if (hasRoute) {
      // a) OSRM -> distance (km), formatted duration, GeoJSON geometry
      try {
        route = await getRoute({ from, to });
      } catch (err) {
        return res.status(err.statusCode || 500).json({
          error: err.message || 'Routing service failed',
          code: err.code || 'OSRM_UNAVAILABLE'
        });
      }
      distanceKm = route.distanceKm;

      // b) Toll -> Mongo cache first, then TollGuru, then distance estimate.
      //    resolveToll() never throws, so a quota-exhausted day degrades to an
      //    estimated toll instead of failing the whole calculation.
      toll = await resolveToll({
        from,
        to,
        geometry: route.geometry,
        distanceKm,
        vehicleType,
        manualCost: tollCost,
        skipTolls
      });
    }

    // c) fuel + profit from the real distance and the real toll
    const calc = fullTripCalc({
      distance: distanceKm,
      mileage: truck.currentMileage,
      fuelPrice,
      avgSpeed: truck.avgSpeed || settings.defaultAvgSpeed,
      revenue: pickNumber(revenue, 0),
      tollCost: toll.cost,
      driverExpense: pickNumber(driverExpense, settings.defaultDriverExpense),
      otherExpenses: pickNumber(otherExpenses, settings.defaultOtherExpense)
    });

    if (!calc) {
      return res.status(500).json({ error: 'Calculation failed', code: 'CALC_ERROR' });
    }

    res.json({
      truck: {
        truckNumber: truck.truckNumber,
        mileage: truck.currentMileage,
        fuelType: truck.fuelType,
        avgSpeed: truck.avgSpeed,
        tankCapacity: truck.tankCapacity
      },
      fuelPrice,
      source: hasRoute ? 'osrm' : 'manual',
      distance: distanceKm,
      isEstimatedToll: Boolean(toll.isEstimatedToll),
      route: route && {
        distanceKm: route.distanceKm,
        duration: route.duration,
        durationHours: route.durationHours,
        durationSeconds: route.durationSeconds,
        coordinateCount: route.coordinateCount,
        origin: route.origin,
        destination: route.destination,
        geometry: includeGeometry ? route.geometry : undefined
      },
      toll,
      ...calc
    });
  } catch (err) {
    console.error('POST /trips/calculate error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Server error', code: err.code });
  }
});

router.get('/', async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate('truck', 'truckNumber model')
      .populate('driver', 'name mobile licenseNumber licenseType experience')
      .sort({ createdAt: -1 });
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('truck')
      .populate('driver');
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    const truckId = b.truck || b.truckId;
    if (!truckId) return res.status(400).json({ error: 'Truck is required', code: 'VALIDATION' });

    // The calculator may send the routed distance; fall back to the manual one.
    const rawDistance = b.distance ?? b.route?.distanceKm;
    const check = validateDistance(rawDistance);
    if (!check.ok) return res.status(400).json({ error: check.error, code: 'VALIDATION' });

    const truck = await Truck.findById(truckId);
    if (!truck) return res.status(404).json({ error: 'Truck not found', code: 'NOT_FOUND' });

    const settings = await getSettings();
    const fuelPrice = fuelPriceFor(truck, settings);

    // Always recompute server-side — the client's profit number is a preview,
    // not the source of truth.
    const calc = fullTripCalc({
      distance: check.value,
      mileage: truck.currentMileage,
      fuelPrice,
      avgSpeed: truck.avgSpeed || settings.defaultAvgSpeed,
      revenue: pickNumber(b.revenue, 0),
      tollCost: pickNumber(b.tollCost, 0),
      driverExpense: pickNumber(b.driverExpense, settings.defaultDriverExpense),
      otherExpenses: pickNumber(b.otherExpenses, settings.defaultOtherExpense)
    });
    if (!calc) return res.status(500).json({ error: 'Calculation failed', code: 'CALC_ERROR' });

    const origin = placeOf(b.origin, b.from);
    const destination = placeOf(b.destination, b.to);
    const from = String(b.from || origin.label || '').trim();
    const to = String(b.to || destination.label || '').trim();
    if (!from || !to) {
      return res.status(400).json({ error: 'Origin and destination are required', code: 'VALIDATION' });
    }

    const route = b.route || {};
    const geometry = simplifyGeometry(route.geometry);
    const status = TRIP_STATUSES.includes(b.status) ? b.status : 'Started';

    const doc = {
      truck: truck._id,
      truckNumber: truck.truckNumber,
      driver: b.driver || undefined,
      driverName: b.driverName || '',
      from,
      to,
      origin,
      destination,
      routeGeometry: geometry,
      routeDistanceKm: pickNumber(route.distanceKm, check.value),
      routeDuration: String(route.duration || ''),
      routeDurationSeconds: pickNumber(route.durationSeconds, 0),
      routeCoordinateCount: geometry ? geometry.coordinates.length : 0,
      tollIsEstimated: b.isEstimatedToll === true,
      tollSource: String(b.tollSource || ''),
      distance: check.value,
      startDate: b.startDate || new Date(),
      expectedDelivery: b.expectedDelivery || undefined,
      cargo: b.cargo || '',
      cargoWeight: pickNumber(b.cargoWeight, 0),
      customer: b.customer || '',
      mileageUsed: truck.currentMileage,
      fuelType: truck.fuelType,
      avgSpeed: truck.avgSpeed,
      fuelRequired: calc.fuelRequired,
      fuelCost: calc.fuelCost,
      fuelPrice,
      tollCost: pickNumber(b.tollCost, 0),
      driverExpense: pickNumber(b.driverExpense, settings.defaultDriverExpense),
      otherExpenses: pickNumber(b.otherExpenses, settings.defaultOtherExpense),
      totalExpense: calc.totalExpense,
      revenue: pickNumber(b.revenue, 0),
      profit: calc.profit,
      profitPercent: calc.profitPercent,
      travelTimeHours: calc.travelTimeHours,
      status,
      notes: b.notes || ''
    };

    // Retries only on a duplicate-key race, which random ids make vanishing
    // rare — the loop keeps correctness if it ever happens.
    let trip = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        doc.tripId = await generateTripId();
        // eslint-disable-next-line no-await-in-loop
        trip = await Trip.create(doc);
        break;
      } catch (err) {
        if (isDuplicateKey(err) && attempt < 2) continue;
        throw err;
      }
    }

    // Crucial side-effect: the truck leaves the available pool.
    if (ACTIVE_TRIP_STATUSES.includes(status)) {
      await Truck.findByIdAndUpdate(truck._id, {
        status: 'On Trip',
        currentTrip: trip._id
      });
    }

    if (ACTIVE_TRIP_STATUSES.includes(status)) {
      eventNotifiers.tripStarted(trip).catch((err) => console.error('[notify] tripStarted:', err.message));
    }

    res.status(201).json(trip);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const b = req.body || {};
    const patch = {};
    for (const key of UPDATABLE_FIELDS) {
      if (b[key] !== undefined) patch[key] = b[key];
    }
    if (patch.status && !TRIP_STATUSES.includes(patch.status)) {
      return res.status(400).json({ error: `Invalid status: ${patch.status}`, code: 'VALIDATION' });
    }
    if (patch.status === 'Completed' && !trip.completedDate) {
      patch.completedDate = new Date();
    }

    // Money edits must keep profit consistent with the stored inputs.
    const moneyTouched = ['revenue', 'tollCost', 'driverExpense', 'otherExpenses', 'distance'].some(
      (k) => patch[k] !== undefined
    );
    if (moneyTouched) {
      const distance = validateDistance(patch.distance ?? trip.distance);
      if (!distance.ok) return res.status(400).json({ error: distance.error, code: 'VALIDATION' });
      patch.distance = distance.value;
      const calc = fullTripCalc({
        distance: patch.distance,
        mileage: trip.mileageUsed,
        fuelPrice: trip.fuelPrice,
        avgSpeed: trip.avgSpeed,
        revenue: pickNumber(patch.revenue ?? trip.revenue, 0),
        tollCost: pickNumber(patch.tollCost ?? trip.tollCost, 0),
        driverExpense: pickNumber(patch.driverExpense ?? trip.driverExpense, 0),
        otherExpenses: pickNumber(patch.otherExpenses ?? trip.otherExpenses, 0)
      });
      if (calc) {
        patch.fuelRequired = calc.fuelRequired;
        patch.fuelCost = calc.fuelCost;
        patch.totalExpense = calc.totalExpense;
        patch.profit = calc.profit;
        patch.profitPercent = calc.profitPercent;
        patch.travelTimeHours = calc.travelTimeHours;
      }
    }

    const updated = await Trip.findByIdAndUpdate(trip._id, patch, { new: true, runValidators: true })
      .populate('truck', 'truckNumber model')
      .populate('driver', 'name mobile licenseNumber licenseType experience');

    // Status side-effects: claim the truck, or release it.
    if (patch.status && ACTIVE_TRIP_STATUSES.includes(patch.status)) {
      await Truck.findByIdAndUpdate(trip.truck, { status: 'On Trip', currentTrip: trip._id });
    } else if (patch.status && FREED_TRIP_STATUSES.includes(patch.status)) {
      await Truck.findByIdAndUpdate(trip.truck, {
        status: 'Available',
        $unset: { currentTrip: '' }
      });
    }

    // Notify on meaningful state transitions (deduped per trip + state).
    if (patch.status && patch.status !== trip.status && updated) {
      const handler =
        patch.status === 'Completed'
          ? eventNotifiers.tripCompleted
          : patch.status === 'Cancelled'
            ? eventNotifiers.tripCancelled
            : ACTIVE_TRIP_STATUSES.includes(patch.status)
              ? eventNotifiers.tripStarted
              : null;
      if (handler) handler(updated).catch((err) => console.error('[notify] trip status:', err.message));
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const trip = await Trip.findByIdAndDelete(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json({ message: 'Trip deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
