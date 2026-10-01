/**
 * Minimal fetch-based HTTP client for the vehicle RC / document features.
 *
 * Uses native `fetch()` — the pre-existing axios instance in `utils/api.js` is
 * left untouched (migrating it is out of scope), so this is a small parallel
 * helper rather than a rewrite.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const DEFAULT_TIMEOUT_MS = 20000;

function authHeaders() {
  try {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** Thrown for every non-2xx response so callers can `try/catch` uniformly. */
export function apiError(status, body) {
  const err = new Error(body?.error || `Request failed (${status})`);
  err.status = status;
  err.code = body?.code || '';
  if (body?.retryAfter) err.retryAfter = body.retryAfter;
  if (body?.duplicate) err.duplicate = body.duplicate;
  return err;
}

/**
 * @param {string} path path below the API base, e.g. '/vehicles/lookup'
 * @param {{method?: string, body?: any, formData?: FormData, timeoutMs?: number}} options
 */
export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, formData, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const init = {
    method,
    headers: { ...authHeaders() },
    // Lets callers cancel (e.g. on dialog close) alongside the timeout.
    signal: AbortSignal.timeout(timeoutMs),
  };

  if (formData) {
    // Content-Type is intentionally unset so the browser adds the boundary.
    init.body = formData;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch (err) {
    const networkError = new Error(
      err.name === 'TimeoutError' || err.name === 'AbortError'
        ? 'The request timed out. Please try again.'
        : 'Could not reach the server. Please try again.'
    );
    networkError.code = err.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK';
    throw networkError;
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) throw apiError(res.status, payload);
  return payload;
}

export { BASE_URL };
