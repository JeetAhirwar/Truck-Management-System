const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  truck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', required: true },
  truckNumber: { type: String, required: true },
  docType: {
    type: String,
    required: true,
    enum: ['RC', 'Insurance', 'PUC', 'Fitness Certificate', 'Permit', 'National Permit', 'Tax', 'Roadworthiness', 'Other']
  },
  docNumber: { type: String, default: '' },
  issueDate: { type: Date },
  expiryDate: { type: Date, required: true },
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

// Virtual for status
documentSchema.virtual('status').get(function () {
  try {
    if (!this.expiryDate) return 'Unknown';
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

module.exports = mongoose.model('Document', documentSchema);
