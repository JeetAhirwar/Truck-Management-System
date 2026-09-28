/**
 * TollGuru (https://apis.tollguru.com) toll cost service.
 * Auth: header `x-api-key` -> process.env.TOLL_API_KEY (never hardcoded).
 *
 * Two modes, both driven by the OSRM GeoJSON geometry:
 *   1. polyline  -> POST /toll/v2/complete-polyline-from-mapping-service
 *                   (exact OSRM route; requires the paid "TollTally" plan)
 *   2. waypoints -> POST /toll/v2/origin-destination-waypoints
 *                   (OSRM geometry sampled into waypoints; free tier)
 */

const BASE_URL = (process.env.TOLLGURU_BASE_URL || 'https://apis.tollguru.com').replace(
  /\/+$/,
  ''
);
const TIMEOUT_MS = Number(process.env.TOLLGURU_TIMEOUT_MS || 25000);
const DEFAULT_VEHICLE = process.env.TOLLGURU_VEHICLE_TYPE || '3AxlesTruck';
const MAX_WAYPOINTS = 10;

function tollError(message, code, statusCode = 500) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.source = 'TOLLGURU';
  return err;
}

const isQuotaError = (msg = '') => /quota|exceeded|credit card|upgrade to a paid plan/i.test(msg);
const isPlanError = (msg = '') => /tolltally|not authorized|forbidden/i.test(msg);

/** GeoJSON LineString -> "lat,lng|lat,lng|..." (TollGuru `path` format). */
function geometryToPath(geometry, maxPoints = 400) {
  const coords = (geometry && geometry.coordinates) || [];
  if (!coords.length) return '';
  const step = Math.max(1, Math.ceil(coords.length / maxPoints));
  const sampled = [];
  for (let i = 0; i < coords.length; i += step) sampled.push(coords[i]);
  const last = coords[coords.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled.map(([lng, lat]) => `${lat},${lng}`).join('|');
}

/** GeoJSON LineString -> [{lat, lng}, ...] (max `max` intermediate points). */
function geometryToWaypoints(geometry, max = MAX_WAYPOINTS) {
  const coords = (geometry && geometry.coordinates) || [];
  if (coords.length <= 2) return [];
  const inner = coords.slice(1, -1);
  const step = Math.max(1, Math.ceil(inner.length / max));
  const out = [];
  for (let i = 0; i < inner.length && out.length < max; i += step) {
    const [lng, lat] = inner[i];
    out.push({ lat, lng });
  }
  return out;
}

async function post(pathname, payload) {
  const apiKey = process.env.TOLL_API_KEY;
  if (!apiKey) {
    throw tollError('TOLL_API_KEY is not configured on the server', 'NO_API_KEY');
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (err) {
    throw tollError(
      `Toll service unreachable (${err.name === 'TimeoutError' ? 'timed out' : err.message})`,
      'TOLLGURU_UNAVAILABLE'
    );
  }

  let body = null;
  try {
    body = await res.json();
  } catch (err) {
    body = null;
  }

  if (!res.ok) {
    const message = (body && (body.message || body.error)) || `HTTP ${res.status}`;
    if (isQuotaError(message)) {
      throw tollError(`TollGuru daily quota exhausted: ${message}`, 'TOLLGURU_QUOTA_EXCEEDED');
    }
    if (isPlanError(message)) {
      const e = tollError(message, 'TOLLGURU_PLAN_REQUIRED', res.status);
      e.planIssue = true;
      throw e;
    }
    throw tollError(`Toll service error: ${message}`, 'TOLLGURU_UNAVAILABLE');
  }

  if (!body || !Array.isArray(body.routes) || !body.routes.length) {
    throw tollError('Toll service returned an unexpected response', 'TOLLGURU_BAD_RESPONSE');
  }

  return body;
}

/** Pulls a single toll total + metadata out of the TollGuru response. */
function extractTolls(body, mode) {
  const route = body.routes[0];
  const costs = route.costs || {};
  const summary = route.summary || {};

  const candidates = [
    costs.maximumTollCost,
    costs.cash,
    costs.tagAndCash,
    costs.tag,
    costs.prepaidCard,
    costs.licensePlate,
    costs.minimumTollCost
  ];
  const raw = candidates.find((v) => typeof v === 'number' && Number.isFinite(v));

  return {
    tollCost: Math.round((raw || 0) * 100) / 100,
    currency: costs.currency || body.summary?.currency || 'INR',
    hasTolls: Boolean(summary.hasTolls),
    tollCount: Array.isArray(route.tolls) ? route.tolls.length : 0,
    routeDistanceKm: summary.distance?.value
      ? Math.round((summary.distance.value / 1000) * 10) / 10
      : undefined,
    routeDuration: summary.duration?.text,
    mode
  };
}

/** TollGuru on the exact OSRM polyline. Requires the TollTally plan. */
async function getTollsFromPolyline({ geometry, vehicleType = DEFAULT_VEHICLE }) {
  const path = geometryToPath(geometry);
  if (!path) throw tollError('Route geometry is required for toll lookup', 'VALIDATION', 400);

  const body = await post('/toll/v2/complete-polyline-from-mapping-service', {
    mapProvider: 'custom',
    path,
    vehicle: { type: vehicleType }
  });
  return extractTolls(body, 'polyline');
}

/** TollGuru following the OSRM route via sampled waypoints (free tier). */
async function getTollsFromWaypoints({
  from,
  to,
  geometry,
  vehicleType = DEFAULT_VEHICLE
}) {
  const origin = from && Number.isFinite(Number(from.lat)) ? from : null;
  const destination = to && Number.isFinite(Number(to.lat)) ? to : null;
  const waypoints = geometryToWaypoints(geometry);

  if (!origin && waypoints.length) {
    const first = waypoints.shift();
    from = { lat: first.lat, lng: first.lng };
  } else if (origin) {
    from = origin;
  }
  if (!destination && waypoints.length) {
    const last = waypoints.pop();
    to = { lat: last.lat, lng: last.lng };
  } else if (destination) {
    to = destination;
  }

  if (!from || !to) {
    throw tollError('Origin and destination are required for toll lookup', 'VALIDATION', 400);
  }

  const payload = {
    from: { lat: Number(from.lat), lng: Number(from.lng) },
    to: { lat: Number(to.lat), lng: Number(to.lng) },
    vehicle: { type: vehicleType },
    serviceProvider: 'tollguru'
  };
  if (waypoints.length) payload.waypoints = waypoints;

  const body = await post('/toll/v2/origin-destination-waypoints', payload);
  return extractTolls(body, 'waypoints');
}

/**
 * Main entry point.
 * @param {{from:{lat:number,lng:number}, to:{lat:number,lng:number},
 *          geometry: object, vehicleType?: string}} params
 */
async function getTolls({ from, to, geometry, vehicleType = DEFAULT_VEHICLE }) {
  const usePolyline = String(process.env.TOLLGURU_USE_POLYLINE || 'false') === 'true';

  if (usePolyline) {
    try {
      return await getTollsFromPolyline({ geometry, vehicleType });
    } catch (err) {
      // Key is not authorised for TollTally -> fall back to the free waypoint route.
      if (!err.planIssue) throw err;
      console.warn(`TollGuru polyline mode unavailable (${err.message}) — using waypoints mode.`);
    }
  }

  return getTollsFromWaypoints({ from, to, geometry, vehicleType });
}

module.exports = {
  getTolls,
  getTollsFromPolyline,
  getTollsFromWaypoints,
  geometryToPath,
  geometryToWaypoints,
  DEFAULT_VEHICLE
};
