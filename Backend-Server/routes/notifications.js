const express = require('express');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { notify } = require('../services/notificationService');
const router = express.Router();
router.use(protect);

// Scope: fleet-wide notifications (user null) get delivered to everyone, so a
// given feed is: broadcast + anything addressed to this specific user.
const scopeFor = (req) => [
  { user: null },
  ...(req.user.id ? [{ user: req.user.id }] : []),
];

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const q = { $or: scopeFor(req) };
    const items = await Notification.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const q = { ...{ $or: scopeFor(req) }, read: false };
    const count = await Notification.countDocuments(q);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const doc = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...{ $or: scopeFor(req) } },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Notification not found' });
    res.json(doc);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    const { modifiedCount } = await Notification.updateMany(
      { read: false, ...{ $or: scopeFor(req) } },
      { read: true, readAt: new Date() }
    );
    res.json({ updated: modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a single notification (scoped to what this user's feed can see).
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Notification.findOneAndDelete({
      _id: req.params.id,
      ...{ $or: scopeFor(req) },
    });
    if (!doc) return res.status(404).json({ error: 'Notification not found' });
    res.json({ deleted: 1, _id: doc._id });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// Clear the whole feed for this user.
router.delete('/', async (req, res) => {
  try {
    const { deletedCount } = await Notification.deleteMany({ $or: scopeFor(req) });
    res.json({ deleted: deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dev-only self-test: fires a notification through the normal pipeline so you
// can verify the real-time push (bell badge + snackbar) without touching data.
router.post('/test', async (req, res) => {
  try {
    const rnd = Math.floor(Math.random() * 3);
    const demo = [
      { type: 'info', title: 'Test: fleet snapshot updated', message: 'Realtime socket push is working.' },
      { type: 'warning', title: 'Test: document nearing expiry', message: 'PUC for MH14CD5678 expires in 16 days.' },
      { type: 'critical', title: 'Test: FASTag low balance', message: 'MH14CD5678 · ₹820 left.' },
    ][rnd];
    const doc = await notify({
      type: demo.type === 'critical' ? 'fastag_low' : demo.type === 'warning' ? 'document_expiring' : 'info',
      severity: demo.type,
      title: demo.title,
      message: demo.message,
      link: '/trucks',
      source: 'test',
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;