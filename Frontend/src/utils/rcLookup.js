/**
 * Vehicle RC verification client (fetch only).
 *
 * Mirrors the server-side normalisation rules in
 * `Backend-Server/services/rcLookup.js` so an obviously invalid number is
 * rejected in the browser without spending a lookup.
 */
import { apiFetch } from './apiFetch';

// 2 letters (state) + 1-2 digits (RTO) + 1-3 letters (series) + 4 digits.
export const VEHICLE_NUMBER_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

/** "mp09 ab-1234" -> "MP09AB1234" */
export function normalizeVehicleNumber(value) {
  return String(value ?? '')
    .trim()
    .replace(/[\s\-_]+/g, '')
    .toUpperCase();
}

export function isValidVehicleNumber(value) {
  return VEHICLE_NUMBER_REGEX.test(normalizeVehicleNumber(value));
}

/**
 * GET /api/vehicles/lookup?number=...
 * @returns {Promise<{vehicleNumber, source, fetchedAt, rc, suggestions, duplicate}>}
 */
export function lookupVehicleNumber(number, { refresh = false } = {}) {
  const vehicleNumber = normalizeVehicleNumber(number);
  const params = new URLSearchParams({ number: vehicleNumber });
  if (refresh) params.set('refresh', 'true');
  return apiFetch(`/vehicles/lookup?${params.toString()}`);
}

/** Error-code -> user-facing message (keeps upstream details private). */
export const RC_ERROR_MESSAGES = {
  RC_INVALID_NUMBER: 'Enter a valid registration number, for example MP09AB1234.',
  RC_NOT_FOUND: 'No RC record was found for this registration number.',
  RC_TIMEOUT: 'The RC service took too long to respond. Please try again.',
  RC_UNAVAILABLE: 'The RC service is temporarily unavailable. Please try again later.',
  RC_BAD_KEY: 'Vehicle verification is not configured correctly on the server.',
  RC_QUOTA: 'The monthly vehicle verification limit has been reached.',
  RC_RATE_LIMITED: 'Too many verification attempts. Please wait a moment and try again.',
  RC_EMPTY: 'The RC service returned no information for this vehicle.',
  RC_NOT_CONFIGURED: 'Vehicle verification is not configured on the server.',
  TIMEOUT: 'The request timed out. Please try again.',
  NETWORK: 'Could not reach the server. Please try again.',
};

export function rcErrorMessage(err) {
  if (!err) return 'Vehicle verification failed.';
  return RC_ERROR_MESSAGES[err.code] || err.message || 'Vehicle verification failed.';
}
