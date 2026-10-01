const TollCache = require('../models/TollCache');
const { getTolls } = require('./tollguru');

/** ₹3 per km average national toll rate for trucks. */
const FALLBACK_RATE_PER_KM = 3.0;

/** Highways average roughly one toll plaza every 50 km. */
const FALLBACK_KM_PER_PLAZA = 50;

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
 * Resolves the toll for a route.
 *
 * Cost and count are resolved independently:
 *   COST  — manual input first, else a flat distance estimate (₹3/km).
 *           The provider's price is never used; tolling is manual.
 *   COUNT — Mongo cache (free, instant) -> TollGuru live API (1 of 15
 *           free-tier calls/day) -> distance estimate (1 plaza / 50 km).
 *
 * Never rejects: on any upstream failure it still returns a cost + count so
 * the calculator keeps working instead of showing an error.
 */
async function resolveToll({ from, to, geometry, distanceKm, vehicleType, manualCost, skipTolls }) {
  const origin = placeKey(from);
  const destination = placeKey(to);
  const distance = Number(distanceKm) || 0;

  // ---- cost: the number the user sees in the breakdown ----
  const cost =
    Number(manualCost) > 0
      ? { cost: Math.round(Number(manualCost)), source: 'manual', isEstimatedToll: false }
      : {
          cost: Math.round(distance * FALLBACK_RATE_PER_KM),
          source: 'estimated',
          isEstimatedToll: true
        };
  const base = { ...cost, currency: 'INR' };

  // ---- count fallback: ~1 plaza every 50 km ----
  const estimatedCount = distance > 0 ? Math.max(1, Math.ceil(distance / FALLBACK_KM_PER_PLAZA)) : 0;

  // ---- manual mode: no route, so there are no plazas to count ----
  if (!origin || !destination) {
    return { ...base, hasTolls: cost.cost > 0, tollCount: 0 };
  }

  // ---- 1. cache hit: the count is already paid for ----
  try {
    const hit = await TollCache.findOne({ origin, destination }).lean();
    if (hit && Number.isFinite(hit.tollAmount)) {
      TollCache.updateOne({ _id: hit._id }, { $inc: { hits: 1 } }).exec().catch(() => {});
      const tollCount = Number.isFinite(hit.tollCount) ? hit.tollCount : estimatedCount;
      return {
        ...base,
        hasTolls: hit.hasTolls !== false && tollCount > 0,
        tollCount,
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

  // ---- 2. live API, for the plaza count only ----
  if (!skipTolls) {
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

      const tollCount = Number.isFinite(t.tollCount) ? t.tollCount : estimatedCount;
      return {
        ...base,
        hasTolls: t.hasTolls !== false && tollCount > 0,
        tollCount,
        routeDistanceKm: t.routeDistanceKm,
        mode: t.mode
      };
    } catch (err) {
      // ---- 3. quota exhausted (429/403), 5xx, timeout, anything ----
      console.warn(
        `TollGuru failed (${err.code || 'ERROR'}: ${err.message}) — plaza count for ${origin} -> ${destination} falls back to distance`
      );
    }
  }

  // ---- 4. last resort: estimate the count from the distance ----
  return {
    ...base,
    hasTolls: cost.cost > 0 && estimatedCount > 0,
    tollCount: estimatedCount,
    reason: skipTolls ? 'SKIPPED' : 'TOLLGURU_UNAVAILABLE'
  };
}

module.exports = { resolveToll, placeKey, FALLBACK_RATE_PER_KM };
