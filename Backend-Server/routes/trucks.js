const express = require('express');
const Truck = require('../models/Truck');
const { protect } = require('../middleware/auth');
const { eventNotifiers } = require('../services/notificationService');
const router = express.Router();
router.use(protect);

function maybeNotifyFastag(truck) {
  const balance = Number(truck.fastag && truck.fastag.balance != null ? truck.fastag.balance : 0);
  if (balance < 1000) {
    return eventNotifiers.fastagLow(truck, balance).catch((err) => console.error('[notify] fastag low:', err.message));
  }
  return Promise.resolve();
}

router.get('/', async (req, res) => {
  try {
    const trucks = await Truck.find().populate('currentDriver', 'name mobile').sort({ createdAt: -1 });
    res.json(trucks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id).populate('currentDriver');
    if (!truck) return res.status(404).json({ error: 'Truck not found' });
    res.json(truck);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const truck = await Truck.create(req.body);
    maybeNotifyFastag(truck);
    res.status(201).json(truck);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const truck = await Truck.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!truck) return res.status(404).json({ error: 'Truck not found' });
    maybeNotifyFastag(truck);
    res.json(truck);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const truck = await Truck.findByIdAndDelete(req.params.id);
    if (!truck) return res.status(404).json({ error: 'Truck not found' });
    res.json({ message: 'Truck deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
