const { formatDuration } = require('../utils/calc');

const OSRM_BASE_URL = (process.env.OSRM_BASE_URL || 'http://router.project-osrm.org').replace(
  /\/+$/,
  ''
);
const TIMEOUT_MS = Number(process.env.OSRM_TIMEOUT_MS || 15000);

function upstreamError(source, message, code) {
  const err = new Error(message);
  err.statusCode = 500;
  err.code = code;
  err.source = source;
  return err;
}

function parseCoord(value, label) {
  if (value === null || value === undefined) {
    throw Object.assign(new Error(`"${label}" coordinates are required`), {
      statusCode: 400,
      code: 'VALIDATION'
    });
  }

  let lat;
  let lng;

  if (Array.isArray(value)) {
    [lng, lat] = value; // GeoJSON order: [lng, lat]
  } else {
    lat = Number(value.lat ?? value.latitude);
    lng = Number(value.lng ?? value.lon ?? value.longitude);
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw Object.assign(new Error(`"${label}" must contain numeric lat and lng`), {
      statusCode: 400,
      code: 'VALIDATION'
    });
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw Object.assign(new Error(`"${label}" is out of range (lat ±90, lng ±180)`), {
      statusCode: 400,
      code: 'VALIDATION'
    });
  }

  return { lat, lng };
}

/**
 * OSRM driving route.
 * GET /route/v1/driving/{lng},{lat};{lng},{lat}?overview=full&geometries=geojson
 *
 * @param {{from: {lat:number,lng:number}, to: {lat:number,lng:number}}} params
 * @returns {Promise<{distanceKm:number, duration:string, durationHours:number,
 *   durationSeconds:number, geometry:object, coordinateCount:number}>}
 */
async function getRoute({ from, to }) {
  const start = parseCoord(from, 'from');
  const end = parseCoord(to, 'to');

  const url =
    `${OSRM_BASE_URL}/route/v1/driving/` +
    `${start.lng},${start.lat};${end.lng},${end.lat}` +
    `?overview=full&geometries=geojson&steps=false&alternatives=false`;

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw upstreamError(
      'OSRM',
      `Routing service unreachable (${err.name === 'TimeoutError' ? 'timed out' : err.message})`,
      'OSRM_UNAVAILABLE'
    );
  }

  if (!res.ok) {
    throw upstreamError('OSRM', `Routing service returned HTTP ${res.status}`, 'OSRM_UNAVAILABLE');
  }

  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw upstreamError('OSRM', 'Routing service returned an invalid response', 'OSRM_UNAVAILABLE');
  }

  const route = body.routes && body.routes[0];
  if (body.code !== 'Ok' || !route) {
    throw upstreamError('OSRM', body.message || `No route found (${body.code})`, 'OSRM_NO_ROUTE');
  }

  const geometry = route.geometry || { type: 'LineString', coordinates: [] };

  return {
    distanceKm: Math.round((route.distance / 1000) * 100) / 100,
    distanceMeters: Math.round(route.distance),
    durationSeconds: Math.round(route.duration),
    durationHours: Math.round((route.duration / 3600) * 100) / 100,
    duration: formatDuration(route.duration),
    geometry,
    coordinateCount: Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0,
    origin: start,
    destination: end
  };
}

module.exports = { getRoute, parseCoord, OSRM_BASE_URL };
