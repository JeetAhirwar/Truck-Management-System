const express = require('express');
const Truck = require('../models/Truck');
const Document = require('../models/Document');
const { protect } = require('../middleware/auth');
const { eventNotifiers } = require('../services/notificationService');
const { normalizeVehicleNumber, toBoolean } = require('../services/rcLookup');
const { deleteStoredFile } = require('../utils/upload');
const router = express.Router();
router.use(protect);

/* ---------------------------------------------------------- field whitelists */
// The truck form is the only writer to this route, so a whitelist keeps
// mass-assignment out (and lets numeric/date fields be coerced safely).
const EDITABLE_FIELDS = [
  'truckNumber', 'registrationNumber', 'truckType', 'brand', 'model',
  'manufacturingYear', 'fuelType', 'tankCapacity', 'currentOdometer',
  'currentMileage', 'avgSpeed', 'loadCapacity', 'status', 'notes', 'fastag',
];
const NUMERIC_FIELDS = [
  'manufacturingYear', 'tankCapacity', 'currentOdometer', 'currentMileage',
  'avgSpeed', 'loadCapacity',
];
const RC_FIELDS = [
  'vehicleClass', 'vehicleClassDescription', 'ownerName', 'ownerAddress',
  'chassisNumber', 'engineNumber', 'bodyType', 'color', 'emissionNorm',
  'rtoOffice', 'status', 'transmission', 'variant',
];
const RC_NUMERIC_FIELDS = ['cubicCapacity', 'unladenWeightKg', 'wheelbaseMm', 'seatCapacity'];
const RC_DATE_FIELDS = ['registrationDate'];

function pickTruckFields(body = {}) {
  const out = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] === undefined) continue;
    if (NUMERIC_FIELDS.includes(key)) {
      // The form sends '' for untouched numeric inputs; Mongoose would reject
      // that, so blank means "not provided".
      if (body[key] === '' || body[key] === null) continue;
      const n = Number(body[key]);
      if (Number.isFinite(n)) out[key] = n;
      continue;
    }
    if (key === 'registrationNumber') {
      out[key] = normalizeVehicleNumber(body[key]);
      continue;
    }
    out[key] = body[key];
  }
  return out;
}

/**
 * Only the mapped RC fields are accepted — no raw pass-through.
 * Returns null when the request carries no usable RC payload, so a partial
 * truck update can never overwrite the stored RC reference data with defaults.
 */
function pickRcFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const rc = {};
  for (const key of RC_FIELDS) {
    if (input[key] === undefined || input[key] === null) continue;
    rc[key] = String(input[key]);
  }
  for (const key of RC_NUMERIC_FIELDS) {
    const n = Number(input[key]);
    if (Number.isFinite(n)) rc[key] = n;
  }
  for (const key of RC_DATE_FIELDS) {
    if (!input[key]) continue;
    const d = new Date(input[key]);
    if (!Number.isNaN(d.getTime())) rc[key] = d;
  }
  if (input.financed !== undefined) rc.financed = toBoolean(input.financed);
  if (input.fetchedAt) {
    const d = new Date(input.fetchedAt);
    if (!Number.isNaN(d.getTime())) rc.fetchedAt = d;
  }
  if (input.source && ['mock', 'live', 'cache'].includes(String(input.source))) {
    rc.source = String(input.source);
  }
  if (input.raw && typeof input.raw === 'object') rc.raw = input.raw;
  for (const group of ['insurance', 'fitness', 'tax', 'pucc']) {
    const src = input[group];
    if (!src || typeof src !== 'object') continue;
    rc[group] = {};
    if (src.company !== undefined) rc[group].company = String(src.company || '');
    if (src.policyNumber !== undefined) rc[group].policyNumber = String(src.policyNumber || '');
    if (src.number !== undefined) rc[group].number = String(src.number || '');
    if (src.validTill) {
      const d = new Date(src.validTill);
      if (!Number.isNaN(d.getTime())) rc[group].validTill = d;
    }
  }
  return Object.keys(rc).length ? rc : null;
}

/**
 * Flattens a picked RC object into dotted `rc.*` paths.
 *
 * Used by PUT so a partial payload MERGES into the stored sub-document.
 * Assigning a nested object instead would replace the whole sub-document, so a
 * request carrying only a couple of RC fields would silently wipe owner name,
 * chassis and the rest.
 */
function rcToDottedPaths(rc) {
  const out = {};
  for (const [key, value] of Object.entries(rc)) {
    const isGroup =
      value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && key !== 'raw';
    if (isGroup) {
      for (const [subKey, subValue] of Object.entries(value)) {
        out[`rc.${key}.${subKey}`] = subValue;
      }
    } else {
      out[`rc.${key}`] = value;
    }
  }
  return out;
}

function maybeNotifyFastag(truck) {
  const balance = Number(truck.fastag && truck.fastag.balance != null ? truck.fastag.balance : 0);
  if (balance < 1000) {
    return eventNotifiers.fastagLow(truck, balance).catch((err) => console.error('[notify] fastag low:', err.message));
  }
  return Promise.resolve();
}

/** Rejects a registration number already used by a different vehicle. */
async function duplicateRegistration(registrationNumber, excludeId) {
  if (!registrationNumber) return null;
  const query = { registrationNumber };
  if (excludeId) query._id = { $ne: excludeId };
  return Truck.findOne(query).select('_id truckNumber').lean();
}

router.get('/', async (req, res) => {
  try {
    const trucks = await Truck.find().populate('currentDriver', 'name mobile').sort({ createdAt: -1 });
    // Document counts for the "Documents (N)" badge — one aggregate, not N+1.
    let counts = [];
    try {
      counts = await Document.aggregate([
        { $group: { _id: '$truck', count: { $sum: 1 } } },
      ]);
    } catch (err) {
      console.error('[trucks] document counts unavailable:', err.message);
    }
    const countBy = new Map(counts.map((c) => [String(c._id), c.count]));
    res.json(trucks.map((t) => ({ ...t.toObject(), documentCount: countBy.get(String(t._id)) || 0 })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id).populate('currentDriver');
    if (!truck) return res.status(404).json({ error: 'Truck not found' });
    res.json(truck);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = pickTruckFields(req.body);
    const rc = pickRcFields(req.body.rc);
    if (rc) fields.rc = rc;

    const duplicate = await duplicateRegistration(fields.registrationNumber);
    if (duplicate) {
      return res.status(409).json({
        error: `Registration number ${fields.registrationNumber} is already used by ${duplicate.truckNumber}`,
        code: 'DUPLICATE_REGISTRATION',
        duplicate: { truckId: duplicate._id, truckNumber: duplicate.truckNumber },
      });
    }

    const truck = await Truck.create(fields);
    maybeNotifyFastag(truck);
    res.status(201).json(truck);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const update = pickTruckFields(req.body);
    const rc = pickRcFields(req.body.rc);
    // Merged field-by-field so a partial RC payload cannot erase stored data.
    if (rc) Object.assign(update, rcToDottedPaths(rc));

    const duplicate = await duplicateRegistration(update.registrationNumber, req.params.id);
    if (duplicate) {
      return res.status(409).json({
        error: `Registration number ${update.registrationNumber} is already used by ${duplicate.truckNumber}`,
        code: 'DUPLICATE_REGISTRATION',
        duplicate: { truckId: duplicate._id, truckNumber: duplicate.truckNumber },
      });
    }

    const truck = await Truck.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!truck) return res.status(404).json({ error: 'Truck not found' });
    maybeNotifyFastag(truck);
    res.json(truck);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const truck = await Truck.findByIdAndDelete(req.params.id);
    if (!truck) return res.status(404).json({ error: 'Truck not found' });
    // Remove the vehicle's documents too — otherwise they would be left
    // pointing at a truck that no longer exists.
    const docs = await Document.find({ truck: truck._id });
    for (const doc of docs) {
      if (doc.uploadedFile) {
        const result = await deleteStoredFile({ uploadedFile: doc.uploadedFile, filePublicId: doc.filePublicId });
        if (!result.ok) console.warn(`[trucks] file cleanup skipped: ${result.reason || result.error}`);
      }
    }
    if (docs.length) await Document.deleteMany({ truck: truck._id });
    res.json({ message: 'Truck deleted', documentsDeleted: docs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
