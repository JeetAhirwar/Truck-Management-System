/**
 * Vehicle reference-data routes.
 *
 * GET /api/vehicles/lookup?number=MP09AB1234
 *   Verifies a vehicle registration number through services/rcLookup.js
 *   (cStudio sandbox/live) and returns RC *reference* data for the onboarding
 *   form. Nothing is persisted here — the user reviews the values and saves the
 *   vehicle explicitly via POST/PUT /api/trucks.
 *
 * The cStudio API key never leaves the server; the browser only ever sees the
 * mapped RC fields.
 */
const express = require('express');
const Truck = require('../models/Truck');
const { protect } = require('../middleware/auth');
const { lookupVehicle, normalizeVehicleNumber } = require('../services/rcLookup');

const router = express.Router();
router.use(protect);

/* ------------------------------------------------------------- rate guard */
// The cStudio free plan allows only 10 lookups/month, so a cheap in-memory
// guard per authenticated user stops accidental refresh-loops from burning the
// quota. Process-local: fine for a single-instance backend, and it is only a
// courtesy limit (the real limit is the upstream quota + our cache).
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 20;
const hits = new Map();

function rateLimited(userId) {
  const now = Date.now();
  const entry = hits.get(userId);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    hits.set(userId, { start: now, count: 1 });
    return null;
  }
  entry.count += 1;
  if (entry.count > RATE_MAX) {
    return Math.ceil((entry.start + RATE_WINDOW_MS - now) / 1000);
  }
  return null;
}

/* ------------------------------------------------------------------ lookup */
router.get('/lookup', async (req, res) => {
  try {
    const userId = (req.user && req.user.id) || 'anon';
    const retryAfter = rateLimited(userId);
    if (retryAfter) {
      return res.status(429).json({
        error: 'Too many verification attempts. Please wait a moment and try again.',
        code: 'RC_RATE_LIMITED',
        retryAfter,
      });
    }

    const vehicleNumber = normalizeVehicleNumber(req.query.number);
    const result = await lookupVehicle(vehicleNumber, { refresh: req.query.refresh === 'true' });

    // Duplicate check: reported, never blocking — the user may legitimately
    // verify a number they are about to add.
    const existing = await Truck.findOne({ registrationNumber: vehicleNumber })
      .select('_id truckNumber brand model status')
      .lean();

    return res.json({
      vehicleNumber: result.vehicleNumber,
      source: result.source,
      fetchedAt: result.fetchedAt,
      rc: result.rc,
      suggestions: result.suggestions,
      duplicate: existing
        ? {
            exists: true,
            truckId: existing._id,
            truckNumber: existing.truckNumber,
            brand: existing.brand,
            model: existing.model,
            status: existing.status,
          }
        : { exists: false },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    const code = err.code || 'RC_UNAVAILABLE';
    // Log the code + upstream detail server-side only — never the RC payload,
    // the API key, or the upstream body. The client gets the generic message.
    if (status >= 500) {
      console.error(`[vehicles] lookup failed (${code}): ${err.message}${err.internal ? ` | upstream: ${err.internal}` : ''}`);
    }
    return res.status(status).json({ error: err.message, code });
  }
});

module.exports = router;
