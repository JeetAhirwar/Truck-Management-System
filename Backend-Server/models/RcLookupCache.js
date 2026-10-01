const mongoose = require('mongoose');

/**
 * Caches cStudio RTO vehicle lookups.
 *
 * The cStudio free "Test" plan allows only 10 requests/month, so a cache is
 * mandatory: one upstream call per registration number per cache window,
 * regardless of how many times the UI verifies it.
 *
 * Mirrors the TollCache pattern (unique key + TTL index). `RC_LOOKUP_CACHE_DAYS`
 * controls the window (default 30 days).
 */
const CACHE_DAYS = Number(process.env.RC_LOOKUP_CACHE_DAYS || 30) * 24 * 60 * 60;

const rcLookupCacheSchema = new mongoose.Schema(
  {
    // Normalised registration number (uppercase, no separators).
    // The unique index is declared below, alongside the TTL index.
    vehicleNumber: { type: String, required: true, trim: true, uppercase: true },
    // 'live' — from the cStudio API. Mock lookups are not cached so switching
    // to live mode always re-queries upstream.
    source: { type: String, enum: ['live', 'mock'], default: 'live' },
    // Verbatim upstream `data` payload, so a cache hit re-maps identically.
    data: { type: mongoose.Schema.Types.Mixed, default: null },
    requestId: { type: String, default: '' },
    fetchedAt: { type: Date, default: Date.now },
    hits: { type: Number, default: 0 }
  },
  { timestamps: true, versionKey: false }
);

rcLookupCacheSchema.index({ vehicleNumber: 1 }, { unique: true });
rcLookupCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: CACHE_DAYS });

module.exports = mongoose.model('RcLookupCache', rcLookupCacheSchema);
