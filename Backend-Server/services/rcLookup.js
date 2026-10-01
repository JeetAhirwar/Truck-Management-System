/**
 * cStudios RTO Vehicle Info service (https://api.cstudio.sbs/v1/rto/vehicle-info).
 *
 * Auth: header `X-API-Key` -> process.env.CSTUDIO_API_KEY (never hardcoded,
 * never returned to the browser).
 *
 * Modes (RC_LOOKUP_MODE):
 *   mock (default) -> returns the documented cStudio sample payload so the whole
 *                     onboarding flow is testable without an external call.
 *   live           -> calls the real endpoint with the API key.
 *
 * Caching: successful live lookups are stored in RcLookupCache (TTL) because
 * the free plan is limited to 10 requests/month. The cache is checked first and
 * returned before any network call, so repeated verifications cost nothing.
 *
 * Privacy: owner name/address and chassis/engine numbers are sensitive. They are
 * mapped into the Truck.rc sub-document but never logged, and logs only ever
 * show a masked registration number.
 */

const RcLookupCache = require('../models/RcLookupCache');

const BASE_URL = (process.env.CSTUDIO_RC_BASE_URL || 'https://api.cstudio.sbs').replace(/\/+$/, '');
const RC_PATH = process.env.CSTUDIO_RC_PATH || '/v1/rto/vehicle-info';
const TIMEOUT_MS = Number(process.env.CSTUDIO_RC_TIMEOUT_MS || 15000);

// Indian vehicle registration: 2 letters (state) + 1-2 digits (RTO) +
// 1-3 letters (series) + 4 digits. e.g. MP09AB1234, KL07AB1234.
const REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

/**
 * Thrown for all expected failures; carries an internal code + HTTP status.
 * `internal` is logged server-side only — it is never sent to the browser, so
 * raw upstream messages can never leak through the API.
 */
function rcError(message, code, statusCode = 500, internal = '') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.source = 'CSTUDIO';
  if (internal) err.internal = internal;
  return err;
}

/** "mp09 ab-1234" -> "MP09AB1234". */
function normalizeVehicleNumber(raw) {
  return String(raw == null ? '' : raw)
    .trim()
    .replace(/[\s\-_]+/g, '')
    .toUpperCase();
}

function isValidVehicleNumber(value) {
  return REGEX.test(value);
}

/** Safe-for-logs mask: MP09AB1234 -> MP09****34 */
function maskVehicleNumber(value) {
  const v = String(value || '');
  if (v.length <= 4) return '*'.repeat(v.length);
  return `${v.slice(0, 4)}****${v.slice(-2)}`;
}

/** Parses an upstream date string ("2027-05-26") to a Date, or null. */
function parseUpstreamDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toText(value) {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * Upstream booleans arrive as real booleans, 0/1 or "true"/"false" strings —
 * `Boolean("false")` would be true, so the string forms are mapped explicitly.
 */
function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'y';
}

/** Maps one API `data` object to the Truck.rc field names (audit mapping). */
function mapToRcFields(data = {}) {
  const v = data.variant || {};
  const make = data.makeData || {};
  const model = data.modelData || {};
  return {
    vehicleClass: toText(data.vehicle_category),
    vehicleClassDescription: toText(data.vehicle_category_description),
    registrationDate: parseUpstreamDate(data.registration_date),
    ownerName: toText(data.owner_name),
    ownerAddress: toText(data.present_address),
    chassisNumber: toText(data.vehicle_chasi_number),
    engineNumber: toText(data.vehicle_engine_number),
    bodyType: toText(data.body_type),
    color: toText(data.color),
    emissionNorm: toText(data.norms_type),
    financed: toBoolean(data.financed),
    insurance: {
      company: toText(data.insurance_company),
      policyNumber: toText(data.insurance_policy_number),
      validTill: parseUpstreamDate(data.insurance_upto),
    },
    fitness: { validTill: parseUpstreamDate(data.fit_up_to) },
    tax: { validTill: parseUpstreamDate(data.tax_upto) },
    pucc: {
      number: toText(data.pucc_number),
      validTill: parseUpstreamDate(data.pucc_upto),
    },
    rtoOffice: toText(data.registered_at),
    status: toText(data.rc_status),
    cubicCapacity: toNumber(data.cubic_capacity),
    unladenWeightKg: toNumber(data.unladen_weight),
    wheelbaseMm: toNumber(data.wheelbase),
    seatCapacity: toNumber(data.seat_capacity),
    transmission: toText(v.v_variant_transmission_type),
    variant: toText(v.v_variant_name),
  };
}

/**
 * Maps the RC fuel type onto the VTMS enum (Diesel|CNG|Petrol|Electric).
 * Returns null when the upstream value is not recognised.
 */
function normalizeFuelType(fuelType, variantFuel) {
  const raw = String(fuelType || variantFuel || '').toLowerCase();
  if (!raw) return null;
  if (raw.includes('diesel')) return 'Diesel';
  if (raw.includes('cng')) return 'CNG';
  if (raw.includes('electric') || raw.includes('ev')) return 'Electric';
  if (raw.includes('petrol') || raw.includes('gasoline')) return 'Petrol';
  return null;
}

/**
 * The documented cStudio sample response, re-keyed to `MP09AB1234`-style usage.
 * Used only when RC_LOOKUP_MODE=mock so the UI is fully testable offline.
 */
function buildMockData(vehicleNumber) {
  return {
    status: 'success',
    data: {
      client_id: 'rc_demo_sample_12345',
      rc_number: vehicleNumber,
      fit_up_to: '2034-05-13',
      registration_date: '2019-05-14',
      owner_name: 'RAHUL SHARMA',
      present_address: '12, MG ROAD, NEAR CITY CENTER, KOCHI, Ernakulam, Kerala 682001',
      vehicle_category: '3WN',
      vehicle_chasi_number: 'ME4JF39KCKT00XXXX',
      vehicle_engine_number: 'JF39ET4100XXXX',
      maker_description: 'TATA MOTORS LTD (TRUCK DIVISION)',
      maker_model: '407',
      body_type: 'TIPPING',
      fuel_type: 'DIESEL',
      color: 'BLUE',
      norms_type: 'BHARAT STAGE VI',
      financed: false,
      insurance_company: 'Acko General Insurance Limited',
      insurance_policy_number: 'POL10529813937/01',
      insurance_upto: '2027-05-26',
      manufacturing_date_formatted: '2019-03',
      registered_at: 'INDORE RTO, Madhya Pradesh',
      tax_upto: '2034-03-31',
      cubic_capacity: '7000',
      seat_capacity: '2',
      wheelbase: '4200',
      unladen_weight: '5200',
      vehicle_category_description: 'Truck (3WN)',
      pucc_number: 'MP0070038000XXXX',
      pucc_upto: '2026-11-03',
      rc_status: 'ACTIVE',
      masked_name: false,
      variant: {
        v_variant_name: 'STD',
        v_variant_fuel_type: 'Diesel',
        v_variant_transmission_type: 'Manual',
      },
      response_metadata: { masked_chassis: false, masked_engine: false, masked_owner_name: false },
      makeData: { v_make_name: 'Tata', v_make_display_name: 'Tata', is_scooter: 0, is_electric: '0' },
      modelData: { v_model_name: '407', v_model_display_name: 'Tata 407', v_mileage: '4.5', fuel_json: ['Diesel'] },
      yearofPurchase: 2019,
    },
    _mock: true,
  };
}

/** Validates the cStudio envelope and returns the `data` object. */
function parseEnvelope(body) {
  if (!body || typeof body !== 'object') {
    throw rcError('RC service returned an empty response', 'RC_EMPTY', 502);
  }
  if (body.status === 'error') {
    const message = (body.error && body.error.message) || 'RC service error';
    const code = body.error && body.error.code;
    if (code === 404) throw rcError('No RC record found for this vehicle', 'RC_NOT_FOUND', 404, message);
    if (code === 402) throw rcError('RC lookup quota exhausted', 'RC_QUOTA', 429, message);
    if (code === 429) throw rcError('RC lookup rate limited, try again shortly', 'RC_RATE_LIMITED', 429, message);
    // Upstream detail is kept server-side; the client only sees the code.
    throw rcError('RC service is temporarily unavailable', 'RC_UNAVAILABLE', 502, message);
  }
  if (body.status !== 'success' || !body.data || typeof body.data !== 'object') {
    throw rcError('RC service returned an unexpected response', 'RC_EMPTY', 502);
  }
  return body.data;
}

/** Maps an HTTP response from cStudio into our internal error codes. */
async function httpError(res) {
  if (res.status === 404) throw rcError('No RC record found for this vehicle', 'RC_NOT_FOUND', 404);
  if (res.status === 401) throw rcError('RC API key is invalid or missing', 'RC_BAD_KEY', 502);
  if (res.status === 402) throw rcError('RC lookup quota exhausted', 'RC_QUOTA', 429);
  if (res.status === 429) throw rcError('RC lookup rate limited, try again shortly', 'RC_RATE_LIMITED', 429);
  if (res.status === 503) throw rcError('RC service temporarily unavailable', 'RC_UNAVAILABLE', 502);
  throw rcError('RC service is temporarily unavailable', 'RC_UNAVAILABLE', 502, `HTTP ${res.status}`);
}

const isQuotaError = (msg = '') => /quota|exceeded|credit card|upgrade to a paid plan/i.test(msg);
const isRateError = (msg = '') => /rate|too many|slow down/i.test(msg);

/** Calls the live cStudio endpoint and returns the raw `data` object. */
async function fetchLive(vehicleNumber) {
  const apiKey = process.env.CSTUDIO_API_KEY;
  if (!apiKey) {
    throw rcError('CSTUDIO_API_KEY is not configured on the server', 'RC_NOT_CONFIGURED', 503);
  }

  const url = `${BASE_URL}${RC_PATH}?vehicle_number=${encodeURIComponent(vehicleNumber)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw rcError('RC lookup timed out, please try again', 'RC_TIMEOUT', 504);
    }
    throw rcError('RC lookup failed (service unreachable)', 'RC_UNAVAILABLE', 502);
  }

  if (!res.ok) {
    // Prefer the upstream message when it identifies a quota/rate problem, but
    // keep it server-side: only the generic message reaches the browser.
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    const msg = (body && body.error && body.error.message) || '';
    if (isQuotaError(msg)) throw rcError('RC lookup quota exhausted', 'RC_QUOTA', 429, msg);
    if (isRateError(msg)) throw rcError('RC lookup rate limited, try again shortly', 'RC_RATE_LIMITED', 429, msg);
    await httpError(res);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw rcError('RC service returned an invalid JSON response', 'RC_EMPTY', 502);
  }
  return { data: parseEnvelope(body), requestId: body.request_id || '' };
}

/** Reads a cached live lookup (or null). Never returns mock entries. */
async function readCache(vehicleNumber) {
  try {
    return await RcLookupCache.findOne({ vehicleNumber, source: 'live' });
  } catch (err) {
    console.error('[rcLookup] cache read failed:', err.message);
    return null;
  }
}

async function writeCache(vehicleNumber, data, requestId) {
  try {
    await RcLookupCache.findOneAndUpdate(
      { vehicleNumber },
      { $set: { source: 'live', data, requestId, fetchedAt: new Date() } },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Cache write failure must not break the lookup.
    console.error('[rcLookup] cache write failed:', err.message);
  }
}

/**
 * Main entry point.
 * @param {string} rawNumber registration number in any casing/format
 * @param {{refresh?: boolean}} [opts] refresh=true bypasses the cache
 * @returns {{vehicleNumber, source, fetchedAt, rc, raw, suggestions}}
 */
async function lookupVehicle(rawNumber, { refresh = false } = {}) {
  const vehicleNumber = normalizeVehicleNumber(rawNumber);
  if (!vehicleNumber) {
    throw rcError('Registration number is required', 'RC_INVALID_NUMBER', 400);
  }
  if (!isValidVehicleNumber(vehicleNumber)) {
    throw rcError('Invalid vehicle registration number format', 'RC_INVALID_NUMBER', 400);
  }

  const mode = String(process.env.RC_LOOKUP_MODE || 'mock').toLowerCase() === 'live' ? 'live' : 'mock';

  // Cache only helps live mode (mock entries are not cached by design).
  let cached = null;
  if (mode === 'live' && !refresh) {
    cached = await readCache(vehicleNumber);
    if (cached && cached.data) {
      RcLookupCache.updateOne({ _id: cached._id }, { $inc: { hits: 1 } }).catch(() => {});
      return buildResult(vehicleNumber, cached.data, 'cache', cached.fetchedAt);
    }
  }

  let data;
  let requestId = '';
  if (mode === 'live') {
    const live = await fetchLive(vehicleNumber);
    data = live.data;
    requestId = live.requestId;
    await writeCache(vehicleNumber, data, requestId);
    return buildResult(vehicleNumber, data, 'live');
  }

  // Mock mode: no network, no cache. Small artificial latency so the loading
  // state is exercised realistically during development.
  data = buildMockData(vehicleNumber).data;
  await new Promise((r) => setTimeout(r, 350));
  return buildResult(vehicleNumber, data, 'mock');
}

/** Shapes the service response consumed by the route and the UI. */
function buildResult(vehicleNumber, data, source, fetchedAt) {
  const rc = mapToRcFields(data);
  const make = data.makeData || {};
  const model = data.modelData || {};
  const fuelType = normalizeFuelType(data.fuel_type, (data.variant || {}).v_variant_fuel_type);
  const manufacturingYear = toNumber(data.yearofPurchase) ||
    (() => {
      const y = /(\d{4})/.exec(String(data.manufacturing_date_formatted || ''));
      return y ? Number(y[1]) : undefined;
    })();

  return {
    vehicleNumber,
    source,
    fetchedAt: fetchedAt || new Date(),
    rc,
    // Auto-fill candidates — the UI applies only these VTMS-managed fields.
    suggestions: {
      registrationNumber: toText(data.rc_number) || vehicleNumber,
      brand: toText(make.v_make_display_name || make.v_make_name) || '',
      model: toText(data.maker_model || model.v_model_display_name || model.v_model_name) || '',
      fuelType: fuelType || '',
      manufacturingYear: manufacturingYear || '',
      // Shown as a suggestion only; never auto-applied.
      mileage: toNumber(model.v_mileage) || '',
    },
    raw: data,
  };
}

module.exports = {
  lookupVehicle,
  normalizeVehicleNumber,
  isValidVehicleNumber,
  maskVehicleNumber,
  mapToRcFields,
  normalizeFuelType,
  toBoolean,
  REGEX,
};
