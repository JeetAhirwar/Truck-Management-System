const Notification = require('../models/Notification');

// Set by `registerSocket(io)` from index.js — avoids a require() cycle.
let io = null;

function registerSocket(instance) {
  io = instance;
}

/**
 * Broadcast a saved notification to the connected frontends.
 *   - user: null   -> every connected user (room "all")
 *   - user: <id>   -> that user's private room only
 */
function emit(notification) {
  if (!io) {
    console.warn('[emit] socket.io not registered yet');
    return;
  }
  const payload = notification.toObject
    ? notification.toObject()
    : notification;
  if (payload.user) {
    console.log('[emit] -> user:' + payload.user, payload.type);
    io.to(`user:${payload.user}`).emit('notification:new', payload);
  } else {
    console.log('[emit] -> all', payload.type);
    io.to('all').emit('notification:new', payload);
  }
}

/**
 * Create a notification — idempotently when a `dedupeKey` is supplied, then
 * push it over the socket. Returns the saved doc (or the existing match when
 * a duplicate is detected).
 */
async function notify({
  type,
  severity = 'info',
  title,
  message = '',
  link = '',
  truckId = null,
  tripId = null,
  docId = null,
  user = null,
  source = 'live',
  dedupeKey = '',
}) {
  if (dedupeKey) {
    const existing = await Notification.findOne({ dedupeKey });
    if (existing) return existing;
  }

  let doc;
  try {
    doc = await Notification.create({
      type,
      severity,
      title,
      message,
      link,
      truckId: truckId || undefined,
      tripId: tripId || undefined,
      docId: docId || undefined,
      user: user || null,
      source,
      dedupeKey: dedupeKey || undefined,
    });
  } catch (err) {
    // Extremely unlikely race: two scanners fired the same dedupeKey at once.
    // Only respond to duplicate errors for keyed pushes — a no-key insert has
    // nothing to dedupe against.
    if (dedupeKey && err && err.code === 11000) {
      const existing = await Notification.findOne({ dedupeKey });
      return existing || null;
    }
    throw err;
  }

  emit(doc);

  // Light housekeeping: don't let the feed grow forever. Keep ~90 days, and
  // hard-cap the newest 500 per user scope.
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const q = { user: user || null };
    await Notification.deleteMany({ ...q, createdAt: { $lt: cutoff } });
    const total = await Notification.countDocuments(q);
    if (total > 500) {
      const excess = await Notification.find(q).sort({ createdAt: -1 }).skip(500).select('_id');
      await Notification.deleteMany({ _id: { $in: excess.map((d) => d._id) } });
    }
  } catch (e) {
    // Trimming is best-effort.
  }

  return doc;
}

/** Convenience for the route hooks — returns a ready-to-await notify() call. */
const eventNotifiers = {
  documentIssued: (doc) =>
    notify({
      type: 'document_expiring',
      severity: 'warning',
      title: `${doc.docType} recorded`,
      message: `${doc.truckNumber} · ${doc.docType} added${doc.expiryDate ? ' (expires soon if under 30 days)' : ''}.`,
      link: '/documents',
      truckId: doc.truck,
      docId: doc._id,
    }),
  tripStarted: (trip) =>
    notify({
      type: 'trip_started',
      severity: 'info',
      title: `Trip ${trip.tripId} started`,
      message: `${trip.truckNumber || ''} · ${trip.from || '?'} → ${trip.to || '?'}.`,
      link: '/trips',
      tripId: trip._id,
      truckId: trip.truck,
      dedupeKey: `trip-started-${trip._id}`,
    }),
  tripCompleted: (trip) =>
    notify({
      type: 'trip_completed',
      severity: 'info',
      title: `Trip ${trip.tripId} completed`,
      message: `${trip.from || '?'} → ${trip.to || '?'} delivered.`,
      link: '/trips',
      tripId: trip._id,
      truckId: trip.truck,
      dedupeKey: `trip-completed-${trip._id}`,
    }),
  tripCancelled: (trip) =>
    notify({
      type: 'trip_cancelled',
      severity: 'warning',
      title: `Trip ${trip.tripId} cancelled`,
      message: `${trip.from || '?'} → ${trip.to || '?'}.`,
      link: '/trips',
      tripId: trip._id,
      truckId: trip.truck,
      dedupeKey: `trip-cancelled-${trip._id}`,
    }),
  fastagLow: (truck, balance) =>
    notify({
      type: 'fastag_low',
      severity: 'critical',
      title: `FASTag low balance`,
      message: `${truck.truckNumber} · ₹${Number(balance || 0).toLocaleString('en-IN')} left (below ₹1,000).`,
      link: '/trucks',
      truckId: truck._id,
      dedupeKey: `fastag-low-${truck.truckNumber}`,
    }),
  maintenanceDue: (truck, entry) =>
    notify({
      type: 'maintenance_due',
      severity: 'warning',
      title: `Maintenance due`,
      message: `${truck.truckNumber}${entry ? ` · ${entry.kms || ''}` : ''} needs service.`,
      link: '/trucks',
      truckId: truck._id || entry?.truck,
    }),
};

module.exports = { notify, registerSocket, eventNotifiers };