const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  truck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', required: true },
  truckNumber: { type: String, required: true },
  docType: {
    type: String,
    required: true,
    enum: [
      'RC', 'Insurance', 'PUC', 'Fitness Certificate', 'Permit', 'National Permit',
      'Tax', 'Roadworthiness', 'NOC', 'Other',
    ]
  },
  // For docType='Other': the user-supplied label (e.g. "Fitness Receipt",
  // "Police Clearance"). Lets a vehicle hold unlimited custom documents.
  customLabel: { type: String, default: '' },
  // Authority that issued the document (RTO, insurer, testing agency, ...).
  issuingAuthority: { type: String, default: '' },
  docNumber: { type: String, default: '' },
  issueDate: { type: Date },
  // Optional: lifetime documents (RC, NOC, Some 'Other') have no expiry.
  expiryDate: { type: Date, required: false },
  // 'manual' (user added) | 'rc-suggested' (user confirmed from RC lookup).
  // A date from the RC API is NOT a file upload, so these stay distinguishable.
  source: { type: String, default: 'manual', enum: ['manual', 'rc-suggested'] },
  // Absolute URL of the stored file (Cloudinary https URL, or /uploads/<name>).
  uploadedFile: { type: String, default: '' },
  // Cloudinary public_id (or local filename) — required to delete the old file
  // when a document is replaced.
  filePublicId: { type: String, default: '' },
  fileProvider: { type: String, default: '', enum: ['', 'cloudinary', 'local'] },
  fileOriginalName: { type: String, default: '' },
  fileMimeType: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
}, { timestamps: true });

// Alias used across the API/UI as `documentUrl`.
documentSchema.virtual('documentUrl').get(function () {
  return this.uploadedFile || '';
});

documentSchema.virtual('fileExt').get(function () {
  if (!this.uploadedFile) return '';
  const ext = this.uploadedFile.split('?')[0].split('#')[0].split('.').pop();
  return (ext || '').toLowerCase();
});

documentSchema.virtual('hasFile').get(function () {
  return Boolean(this.uploadedFile);
});

// Virtual for status. A document with no expiry (RC, NOC, custom docs) is
// "No Expiry" — a valid state, not the old "Unknown".
documentSchema.virtual('status').get(function () {
  try {
    if (!this.expiryDate) return 'No Expiry';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((this.expiryDate - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Expired';
    if (diff <= 30) return 'Expiring Soon';
    return 'Valid';
  } catch {
    return 'Unknown';
  }
});

// `hasFile` above is the single source of truth for "a file is actually
// stored". A document can hold external (RC-suggested) validity information
// *without* a file, so the UI must not present validity as proof that the scan
// is on record.

/** Human label: custom label for 'Other', otherwise the type. */
documentSchema.virtual('displayType').get(function () {
  if (this.docType === 'Other' && this.customLabel) return this.customLabel;
  return this.docType;
});

documentSchema.virtual('daysLeft').get(function () {
  try {
    if (!this.expiryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((this.expiryDate - today) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
});

documentSchema.set('toJSON', { virtuals: true });
documentSchema.set('toObject', { virtuals: true });

// One vehicle can hold many documents: this index powers the per-vehicle
// document list and its type grouping.
documentSchema.index({ truck: 1, docType: 1 });

module.exports = mongoose.model('Document', documentSchema);
