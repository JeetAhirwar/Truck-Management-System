const mongoose = require('mongoose');

/**
 * Caches TollGuru results so the 15/day free-tier quota is spent only once
 * per origin/destination pair. Entries expire after 30 days (TTL index).
 */
const tollCacheSchema = new mongoose.Schema(
  {
    origin: { type: String, required: true, trim: true, index: true },
    destination: { type: String, required: true, trim: true, index: true },
    distance: { type: Number, required: true, min: 0 },
    tollAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    source: { type: String, default: 'tollguru' },
    vehicleType: { type: String, default: '3AxlesTruck' },
    hasTolls: { type: Boolean, default: true },
    tollCount: { type: Number, default: 0 },
    hits: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true, versionKey: false }
);

tollCacheSchema.index({ origin: 1, destination: 1 }, { unique: true });
tollCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('TollCache', tollCacheSchema);
