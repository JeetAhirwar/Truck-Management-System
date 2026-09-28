const TollCache = require('../models/TollCache');
const { getTolls } = require('./tollguru');

/** ₹3 per km average national toll rate for trucks. */
const FALLBACK_RATE_PER_KM = 3.0;

/**
 * Cache key for a place. Prefers the human-readable city label the client
 * sends ("Indore, Madhya Pradesh"), falls back to rounded coordinates so the
 * cache still works when a caller only has lat/lng (≈11 m precision).
 */
function placeKey(place) {
  if (!place) return '';
  if (typeof place === 'string') return place.trim().toLowerCase();
  if (place.label) return String(place.label).trim().toLowerCase();
  return `${Number(place.lat).toFixed(4)},${Number(place.lng).toFixed(4)}`;
}

/**
 * Resolves the toll for a route, in order of cost:
 *   1. Mongo cache          (free, instant)
 *   2. TollGuru live API    (costs 1 of 15 free-tier calls/day)
 *   3. Distance estimate    (always available, never throws)
 *
 * Never rejects: on any upstream failure it returns an estimated toll so the
 * calculator keeps working instead of showing an error.
 */
async function resolveToll({ from, to, geometry, distanceKm, vehicleType, manualCost, skipTolls }) {
  const origin = placeKey(from);
  const destination = placeKey(to);
  const distance = Number(distanceKm) || 0;
  const estimated = (rate) => ({
    cost: Math.round(distance * (rate || FALLBACK_RATE_PER_KM)),
    source: 'estimated',
    isEstimatedToll: true,
    currency: 'INR',
    hasTolls: distance > 0,
    tollCount: distance > 0 ? 1 : 0,
    ratePerKm: rate || FALLBACK_RATE_PER_KM
  });

  // ---- caller asked to skip tolls: use the manual figure, else estimate ----
  if (skipTolls) {
    if (Number(manualCost) > 0) {
      return {
        cost: Number(manualCost),
        source: 'manual',
        isEstimatedToll: false,
        currency: 'INR',
        hasTolls: true,
        tollCount: 1
      };
    }
    return { ...estimated(FALLBACK_RATE_PER_KM), reason: 'SKIPPED' };
  }

  // ---- manual mode: no route, caller supplied the toll ----
  if (!origin || !destination) {
    return {
      cost: Number(manualCost) || 0,
      source: 'manual',
      isEstimatedToll: false,
      currency: 'INR',
      hasTolls: false,
      tollCount: 0
    };
  }

  // ---- 1. cache hit ----
  try {
    const hit = await TollCache.findOne({ origin, destination }).lean();
    if (hit && Number.isFinite(hit.tollAmount)) {
      TollCache.updateOne({ _id: hit._id }, { $inc: { hits: 1 } }).exec().catch(() => {});
      return {
        cost: hit.tollAmount,
        source: 'cache',
        isEstimatedToll: false,
        currency: hit.currency || 'INR',
        hasTolls: hit.hasTolls !== false,
        tollCount: hit.tollCount || 0,
        cachedAt: hit.createdAt,
        cacheAgeDays: hit.createdAt
          ? Math.floor((Date.now() - new Date(hit.createdAt).getTime()) / 86400000)
          : null
      };
    }
  } catch (err) {
    // A cache outage must not break tolling.
    console.warn('TollCache read failed:', err.message);
  }

  // ---- 2. live API ----
  try {
    const t = await getTolls({ from, to, geometry, vehicleType });
    const record = {
      origin,
      destination,
      distance: Number(distanceKm) || 0,
      tollAmount: t.tollCost,
      currency: t.currency || 'INR',
      source: 'tollguru',
      vehicleType,
      hasTolls: t.hasTolls,
      tollCount: t.tollCount || 0
    };
    TollCache.updateOne({ origin, destination }, { $set: record }, { upsert: true })
      .exec()
      .catch((err) => console.warn('TollCache write failed:', err.message));

    return {
      cost: t.tollCost,
      source: 'tollguru',
      isEstimatedToll: false,
      currency: record.currency,
      hasTolls: t.hasTolls,
      tollCount: t.tollCount || 0,
      routeDistanceKm: t.routeDistanceKm,
      mode: t.mode
    };
  } catch (err) {
    // ---- 3. fallback: quota exhausted (429/403), 5xx, timeout, anything ----
    const result = estimated(FALLBACK_RATE_PER_KM);
    result.reason = err.code || 'TOLLGURU_UNAVAILABLE';
    console.warn(
      `TollGuru failed (${err.code || 'ERROR'}: ${err.message}) — estimating ₹${result.cost} for ${origin} -> ${destination}`
    );
    return result;
  }
}

module.exports = { resolveToll, placeKey, FALLBACK_RATE_PER_KM };
