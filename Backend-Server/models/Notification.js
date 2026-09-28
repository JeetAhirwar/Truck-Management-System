const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'document_expired',
        'document_expiring',
        'fastag_low',
        'maintenance_due',
        'trip_started',
        'trip_completed',
        'trip_cancelled',
        'truck_created',
        'system',
        'info',
      ],
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    // Deep-link the user to the relevant page (e.g. /documents, /trucks, /trips).
    link: { type: String, default: '' },
    // Entity references for extra context / future filtering.
    truckId: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', default: null },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
    docId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
    // `null` = broadcast to every user (single-fleet feed). If a specific user
    // is set, only that user's room receives it.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    source: { type: String, enum: ['live', 'scanner', 'seed', 'test'], default: 'live' },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    // Idempotency key: re-scanning / re-firing the same condition must not
    // create a second notification. Unique + partial so null-ish duplicates
    // can't slip through either.
    dedupeKey: { type: String, default: '' },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
// NOTE: do NOT add a unique index on `dedupeKey`. MongoDB treats a missing
// field as `null`, so a plain unique index would reject every notification
// that is created *without* a dedupe key (test/dev pushes). Deduping is done
// in app logic (findOne before insert) instead.

module.exports = mongoose.model('Notification', notificationSchema);