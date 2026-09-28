const express = require('express');
const Document = require('../models/Document');
const { protect } = require('../middleware/auth');
const { uploadSingle, deleteStoredFile, toStoredFile, isCloudinaryEnabled, MAX_FILE_SIZE } = require('../utils/upload');
const { notify } = require('../services/notificationService');

const router = express.Router();
router.use(protect);

const DOC_TYPES = [
  'RC', 'Insurance', 'PUC', 'Fitness Certificate',
  'Permit', 'National Permit', 'Tax', 'Roadworthiness', 'Other',
];
const EDITABLE_FIELDS = ['truckNumber', 'docType', 'docNumber', 'issueDate', 'expiryDate', 'remarks'];

/** Whitelists text fields from a multipart body (values arrive as strings). */
function pickEditableFields(body = {}) {
  const out = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] === undefined) continue;
    if (['issueDate', 'expiryDate'].includes(key)) {
      if (body[key] === '' || body[key] === null) { out[key] = undefined; continue; }
      const parsed = new Date(body[key]);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid date for ${key}`);
      }
      out[key] = parsed;
      continue;
    }
    out[key] = body[key];
  }
  return out;
}

function validate({ docType, expiryDate }) {
  if (!docType || !DOC_TYPES.includes(docType)) {
    throw new Error(`Invalid document type. Allowed: ${DOC_TYPES.join(', ')}`);
  }
  if (!expiryDate || Number.isNaN(new Date(expiryDate).getTime())) {
    throw new Error('Expiry date is required');
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

router.get('/', async (req, res) => {
  try {
    const docs = await Document.find().populate('truck', 'truckNumber').sort({ expiryDate: 1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    const nextType = fields.docType ?? doc.docType;
    const nextExpiry = fields.expiryDate ?? doc.expiryDate;
    try {
      validate({ docType: nextType, expiryDate: nextExpiry });
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

module.exports = router;
