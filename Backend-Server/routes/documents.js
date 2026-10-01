const express = require('express');
const Document = require('../models/Document');
const { protect } = require('../middleware/auth');
const { uploadSingle, deleteStoredFile, toStoredFile, isCloudinaryEnabled, MAX_FILE_SIZE } = require('../utils/upload');
const { notify } = require('../services/notificationService');

const router = express.Router();
router.use(protect);

const DOC_TYPES = [
  'RC', 'Insurance', 'PUC', 'Fitness Certificate', 'Permit', 'National Permit',
  'Tax', 'Roadworthiness', 'NOC', 'Other',
];
// Documents that always carry an expiry. Everything else (RC, NOC, custom
// 'Other' papers) may be lifetime, so expiryDate is optional for them.
const EXPIRY_REQUIRED_TYPES = [
  'Insurance', 'PUC', 'Fitness Certificate', 'Permit', 'National Permit',
  'Tax', 'Roadworthiness',
];
const EDITABLE_FIELDS = [
  'truckNumber', 'docType', 'customLabel', 'issuingAuthority', 'docNumber',
  'issueDate', 'expiryDate', 'remarks', 'notes',
];

/** Whitelists text fields from a multipart body (values arrive as strings). */
function pickEditableFields(body = {}) {
  const out = {};
  for (const key of EDITABLE_FIELDS) {
    // `notes` is a UI-friendly alias for the existing `remarks` field.
    const sourceKey = key === 'notes' ? 'remarks' : key;
    const value = key === 'notes' ? (body.notes !== undefined ? body.notes : body.remarks) : body[key];
    if (value === undefined) continue;
    if (['issueDate', 'expiryDate'].includes(key)) {
      // An empty date means "clear it" (a lifetime document), which is
      // different from "not sent" — Mongoose ignores undefined on save, so an
      // explicit null is required for a previously entered expiry to be unset.
      if (value === '' || value === null) { out[key] = null; continue; }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid date for ${key}`);
      }
      out[key] = parsed;
      continue;
    }
    out[sourceKey] = value;
  }
  return out;
}

function validate({ docType, customLabel, expiryDate }) {
  if (!docType || !DOC_TYPES.includes(docType)) {
    throw new Error(`Invalid document type. Allowed: ${DOC_TYPES.join(', ')}`);
  }
  // "Other" needs a label, otherwise every custom document would show as
  // "Other" and could not be told apart.
  if (docType === 'Other' && !String(customLabel || '').trim()) {
    throw new Error('Please enter a document name for the "Other" type');
  }
  if (!expiryDate || Number.isNaN(new Date(expiryDate).getTime())) {
    if (EXPIRY_REQUIRED_TYPES.includes(docType)) {
      throw new Error('Expiry date is required for this document type');
    }
  }
}

/** Thrown for expected client errors so the catch block still cleans up files. */
function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

/**
 * Fires a live notification when a saved document is expired or expiring.
 * Dedupe key is scoped per document + state, so re-saving without a status
 * change stays quiet while a expired→expiring flip still notifies.
 */
function maybeNotifyDocumentPolicy(doc) {
  if (!doc || !doc.expiryDate) return Promise.resolve();
  const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / 86400000);
  const truckNumber = doc.truckNumber || '';
  if (days < 0) {
    return notify({
      type: 'document_expired',
      severity: 'critical',
      title: `${doc.docType} expired`,
      message: `${truckNumber} · ${doc.docType} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago.`,
      link: '/documents',
      truckId: doc.truck,
      docId: doc._id,
      source: 'live',
      dedupeKey: `doc-${doc._id}-expired`,
    }).catch((err) => console.error('[notify] doc expired:', err.message));
  }
  if (days <= 30) {
    return notify({
      type: 'document_expiring',
      severity: 'warning',
      title: `${doc.docType} expiring soon`,
      message: `${truckNumber} · ${doc.docType} expires in ${days} day${days === 1 ? '' : 's'}.`,
      link: '/documents',
      truckId: doc.truck,
      docId: doc._id,
      source: 'live',
      dedupeKey: `doc-${doc._id}-expiring`,
    }).catch((err) => console.error('[notify] doc expiring:', err.message));
  }
  return Promise.resolve();
}

/** Shared expiry evaluation so the filter chips and the summary never disagree. */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    // Per-vehicle listing for the Vehicle Documents section.
    if (req.query.truck) {
      if (!/^[a-f\d]{24}$/i.test(String(req.query.truck))) {
        return res.status(400).json({ error: 'Invalid truck id' });
      }
      filter.truck = req.query.truck;
    }
    const docs = await Document.find(filter).populate('truck', 'truckNumber').sort({ expiryDate: 1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Document counts for a vehicle (optional `?truck=`), used for the
 * "Documents (N)" badge. Statuses come from the same rules as the `status`
 * virtual, so the badge and the list can never disagree.
 */
router.get('/summary', async (req, res) => {
  try {
    const filter = {};
    if (req.query.truck) {
      if (!/^[a-f\d]{24}$/i.test(String(req.query.truck))) {
        return res.status(400).json({ error: 'Invalid truck id' });
      }
      filter.truck = req.query.truck;
    }
    // Hydrated (not .lean()) on purpose: the `status` virtual is the single
    // source of truth for expiry, so the summary can never drift from the list.
    const docs = await Document.find(filter).select('expiryDate uploadedFile');
    const summary = { total: docs.length, valid: 0, expiringSoon: 0, expired: 0, noExpiry: 0, withFile: 0 };
    for (const doc of docs) {
      const status = doc.status;
      if (status === 'Valid') summary.valid += 1;
      else if (status === 'Expiring Soon') summary.expiringSoon += 1;
      else if (status === 'Expired') summary.expired += 1;
      else summary.noExpiry += 1;
      if (doc.uploadedFile) summary.withFile += 1;
    }
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Single source of truth for the document type list (used by the UI). */
router.get('/types', (req, res) => {
  res.json({
    types: DOC_TYPES,
    expiryRequired: EXPIRY_REQUIRED_TYPES,
    custom: 'Other',
  });
});

/** Reports which storage backend is active — handy for verifying .env. */
router.get('/storage-info', (req, res) => {
  res.json({
    provider: isCloudinaryEnabled ? 'cloudinary' : 'local',
    allowed: ['pdf', 'jpg', 'jpeg', 'png'],
    maxFileSizeMB: MAX_FILE_SIZE / (1024 * 1024),
  });
});

// --------------------------------------------------------------------- create
router.post('/', uploadSingle, async (req, res) => {
  // Captured before any validation so the catch block can always clean up.
  const stored = toStoredFile(req.file);
  try {
    const fields = pickEditableFields(req.body);

    if (req.body.truck && req.body.truck.match?.(/^[a-f\d]{24}$/i)) {
      const Truck = require('../models/Truck');
      const truck = await Truck.findById(req.body.truck);
      if (!truck) fail(400, 'Selected truck does not exist');
      fields.truck = truck._id;
      fields.truckNumber = truck.truckNumber;
    } else {
      fail(400, 'A valid truck is required');
    }

    validate(fields);

    if (stored) Object.assign(fields, stored);

    const doc = await Document.create(fields);
    maybeNotifyDocumentPolicy(doc);
    res.status(201).json(doc);
  } catch (err) {
    // Never leave an orphaned file behind when the save fails.
    if (stored) await deleteStoredFile(stored);
    res.status(err.status || 400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------- edit
router.put('/:id', uploadSingle, async (req, res) => {
  const stored = toStoredFile(req.file);
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      if (stored) await deleteStoredFile(stored);
      return res.status(404).json({ error: 'Document not found' });
    }

    const fields = pickEditableFields(req.body);

    if (req.body.truck && req.body.truck.match?.(/^[a-f\d]{24}$/i) && String(req.body.truck) !== String(doc.truck)) {
      const Truck = require('../models/Truck');
      const truck = await Truck.findById(req.body.truck);
      if (!truck) {
        if (stored) await deleteStoredFile(stored);
        return res.status(400).json({ error: 'Selected truck does not exist' });
      }
      fields.truck = truck._id;
      fields.truckNumber = truck.truckNumber;
    }

    // Reject an invalid docType/expiry pair *before* replacing the file.
    // The effective values are used (incoming value, else the stored one) so a
    // partial update is validated as it will actually end up stored — e.g.
    // editing an 'Other' document without re-sending its custom label.
    const nextType = fields.docType ?? doc.docType;
    const nextLabel = fields.customLabel ?? doc.customLabel;
    // `in` (not `??`) so an explicitly cleared date stays cleared.
    const nextExpiry = 'expiryDate' in fields ? fields.expiryDate : doc.expiryDate;
    try {
      validate({ docType: nextType, customLabel: nextLabel, expiryDate: nextExpiry });
    } catch (err) {
      if (stored) await deleteStoredFile(stored);
      return res.status(400).json({ error: err.message });
    }

    const previous = { uploadedFile: doc.uploadedFile, filePublicId: doc.filePublicId };

    if (stored) Object.assign(fields, stored);

    Object.assign(doc, fields);
    await doc.save();

    // Storage optimisation: only destroy the old file once the new one is
    // safely persisted.
    if (stored && previous.uploadedFile && previous.uploadedFile !== stored.uploadedFile) {
      await deleteStoredFile(previous);
    }

    await doc.populate('truck', 'truckNumber');
    maybeNotifyDocumentPolicy(doc);
    res.json(doc);
  } catch (err) {
    if (stored) await deleteStoredFile(stored);
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------- file replace
/** Replaces only the file, keeping all metadata — used by the Edit modal. */
router.put('/:id/file', uploadSingle, async (req, res) => {
  const stored = toStoredFile(req.file);
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      if (stored) await deleteStoredFile(stored);
      return res.status(404).json({ error: 'Document not found' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const previous = { uploadedFile: doc.uploadedFile, filePublicId: doc.filePublicId };
    Object.assign(doc, stored);
    await doc.save();
    if (previous.uploadedFile) await deleteStoredFile(previous);

    res.json(doc);
  } catch (err) {
    if (stored) await deleteStoredFile(stored);
    res.status(400).json({ error: err.message });
  }
});

// --------------------------------------------------------------------- delete
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Document.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    // Best-effort: the DB record is already gone, so a storage failure is logged
    // rather than surfaced as a failed delete.
    if (doc.uploadedFile) {
      const result = await deleteStoredFile({ uploadedFile: doc.uploadedFile, filePublicId: doc.filePublicId });
      if (!result.ok) console.warn(`[documents] file cleanup skipped: ${result.reason || result.error}`);
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------- user-confirmed RC -> documents */
/**
 * POST /api/documents/from-rc
 * Body: { truck, items: [{ docType, docNumber?, issueDate?, expiryDate?, issuingAuthority? }] }
 *
 * Creates Document records from RC lookup validity dates — but ONLY for the
 * items the user explicitly selected in the UI. Nothing here runs
 * automatically as part of a vehicle save.
 *
 * Rules:
 *  - A validity date from the RC API is not proof of an uploaded file, so the
 *    records are created with `source: 'rc-suggested'` and no file.
 *  - Never fabricates a document number: if the API gave none, it stays empty.
 *  - Skips an equivalent existing document (same truck + type + document
 *    number, or same truck + type + expiry date when there is no number).
 *  - Permit / National Permit are intentionally unsupported: the cStudio RC
 *    response contains no permit data, so nothing is invented for them.
 */
const RC_ALLOWED_TYPES = new Set(['Insurance', 'Fitness Certificate', 'PUC', 'Tax', 'RC']);

router.post('/from-rc', async (req, res) => {
  try {
    const Truck = require('../models/Truck');
    const { truck, items } = req.body || {};

    if (!truck || !/^[a-f\d]{24}$/i.test(String(truck))) {
      return res.status(400).json({ error: 'A valid truck is required' });
    }
    const vehicle = await Truck.findById(truck);
    if (!vehicle) return res.status(400).json({ error: 'Selected truck does not exist' });
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'No documents were selected' });
    }

    const created = [];
    const skipped = [];

    for (const item of items) {
      const docType = String(item?.docType || '').trim();
      if (!RC_ALLOWED_TYPES.has(docType)) {
        skipped.push({ docType: docType || 'unknown', reason: 'Not available from RC data' });
        continue;
      }
      const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
      if (expiryDate && Number.isNaN(expiryDate.getTime())) {
        skipped.push({ docType, reason: 'Invalid date' });
        continue;
      }
      const docNumber = String(item.docNumber || '').trim();
      const issueDate = item.issueDate ? new Date(item.issueDate) : null;
      if (issueDate && Number.isNaN(issueDate.getTime())) return res.status(400).json({ error: 'Invalid issue date' });

      // Duplicate guard: never create a second copy of the same document.
      const existingQuery = { truck: vehicle._id, docType };
      if (docNumber) existingQuery.docNumber = docNumber;
      else if (expiryDate) existingQuery.expiryDate = expiryDate;
      else {
        skipped.push({ docType, reason: 'Nothing to create' });
        continue;
      }
      const existing = await Document.findOne(existingQuery);
      if (existing) {
        skipped.push({ docType, reason: 'Already added for this vehicle' });
        continue;
      }

      const doc = await Document.create({
        truck: vehicle._id,
        truckNumber: vehicle.truckNumber,
        docType,
        customLabel: String(item.customLabel || '').trim(),
        issuingAuthority: String(item.issuingAuthority || '').trim(),
        docNumber,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        source: 'rc-suggested',
        remarks: 'Created from RC verification — upload the actual document file when available.',
      });
      created.push(doc);
    }

    return res.status(created.length ? 201 : 200).json({ created, skipped });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
