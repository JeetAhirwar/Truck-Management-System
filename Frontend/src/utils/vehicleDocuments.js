/**
 * Vehicle document client (fetch only) + the document type list.
 *
 * Types are fetched from `GET /api/documents/types` so the backend enum stays
 * the single source of truth; `FALLBACK_TYPES` keeps the UI usable if that
 * call fails.
 */
import { apiFetch } from './apiFetch';

export const FALLBACK_TYPES = [
  'RC',
  'Insurance',
  'PUC',
  'Fitness Certificate',
  'Permit',
  'National Permit',
  'Tax',
  'Roadworthiness',
  'NOC',
  'Other',
];

/** Types whose expiry date the backend requires. */
const FALLBACK_EXPIRY_REQUIRED = [
  'Insurance',
  'PUC',
  'Fitness Certificate',
  'Permit',
  'National Permit',
  'Tax',
  'Roadworthiness',
];

let typesPromise = null;

/** Cached once per page load. Never throws. */
export function getDocumentTypes() {
  if (!typesPromise) {
    typesPromise = apiFetch('/documents/types')
      .then((data) => ({
        types: Array.isArray(data?.types) && data.types.length ? data.types : FALLBACK_TYPES,
        expiryRequired: Array.isArray(data?.expiryRequired) ? data.expiryRequired : FALLBACK_EXPIRY_REQUIRED,
      }))
      .catch(() => ({ types: FALLBACK_TYPES, expiryRequired: FALLBACK_EXPIRY_REQUIRED }));
  }
  return typesPromise;
}

export function listDocuments(truckId) {
  const params = new URLSearchParams();
  if (truckId) params.set('truck', truckId);
  const qs = params.toString();
  return apiFetch(`/documents${qs ? `?${qs}` : ''}`);
}

/**
 * Creates/updates a document. Uses FormData when a file is present so the
 * existing multipart upload pipeline is reused unchanged.
 */
export function saveDocument(values, file, existingId) {
  const fd = new FormData();
  fd.append('truck', values.truck || '');
  fd.append('docType', values.docType || '');
  if (values.customLabel) fd.append('customLabel', values.customLabel);
  if (values.issuingAuthority) fd.append('issuingAuthority', values.issuingAuthority);
  if (values.docNumber) fd.append('docNumber', values.docNumber);
  if (values.issueDate) fd.append('issueDate', values.issueDate);
  // An empty expiryDate is sent as '' so the backend can decide per type.
  fd.append('expiryDate', values.expiryDate || '');
  if (values.remarks) fd.append('remarks', values.remarks);
  if (file) fd.append('file', file);

  return existingId
    ? apiFetch(`/documents/${existingId}`, { method: 'PUT', formData: fd })
    : apiFetch('/documents', { method: 'POST', formData: fd });
}

/** Replaces only the file of an existing document (metadata is untouched). */
export function replaceDocumentFile(documentId, file) {
  const fd = new FormData();
  fd.append('file', file);
  return apiFetch(`/documents/${documentId}/file`, { method: 'PUT', formData: fd });
}

export function deleteDocument(documentId) {
  return apiFetch(`/documents/${documentId}`, { method: 'DELETE' });
}

/** Creates the RC-detected documents the user explicitly ticked. */
export function createDocumentsFromRc(truckId, items) {
  return apiFetch('/documents/from-rc', { method: 'POST', body: { truck: truckId, items } });
}
