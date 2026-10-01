const express = require('express');
const Driver = require('../models/Driver');
const Truck = require('../models/Truck');
const { protect } = require('../middleware/auth');
const router = express.Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    const drivers = await Driver.find().populate('assignedTruck', 'truckNumber model').sort({ createdAt: -1 });
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id).populate('assignedTruck');
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const driver = await Driver.create(req.body);
    res.status(201).json(driver);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    res.json(driver);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    res.json({ message: 'Driver deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign driver to truck
router.post('/:id/assign', async (req, res) => {
  try {
    const { truckId } = req.body;
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const sameTruck = (a, b) => (a ? String(a) : null) === (b ? String(b) : null);
    // Re-selecting the same truck must not write a duplicate history entry.
    if (sameTruck(driver.assignedTruck, truckId)) {
      const current = await Driver.findById(driver._id).populate('assignedTruck', 'truckNumber model');
      return res.json(current);
    }

    const now = new Date();
    const openEntry = (d) => (d.assignmentHistory || []).find((h) => !h.releasedAt);

    // 1. Close this driver's open assignment period (if any).
    const mine = openEntry(driver);
    if (mine) mine.releasedAt = now;

    // 2. Unassign previous truck on the truck side.
    if (driver.assignedTruck) {
      await Truck.findByIdAndUpdate(driver.assignedTruck, { currentDriver: null });
    }

    if (truckId) {
      // 3. Anyone else currently holding this truck loses it — clear them and
      //    close their history too, otherwise they would stay "current" forever.
      const displaced = await Driver.find({ assignedTruck: truckId, _id: { $ne: driver._id } });
      for (const other of displaced) {
        const otherOpen = openEntry(other);
        if (otherOpen) otherOpen.releasedAt = now;
        other.assignedTruck = null;
        await other.save();
      }

      const truck = await Truck.findById(truckId).select('truckNumber brand model');
      await Truck.findByIdAndUpdate(truckId, { currentDriver: driver._id });
      driver.assignedTruck = truckId;
      driver.assignmentHistory = driver.assignmentHistory || [];
      driver.assignmentHistory.push({
        truck: truckId,
        truckNumber: truck ? truck.truckNumber : '',
        truckLabel: truck ? [truck.brand, truck.model].filter(Boolean).join(' ') : '',
        assignedAt: now,
        releasedAt: null,
      });
    } else {
      driver.assignedTruck = null;
    }

    await driver.save();
    const updated = await Driver.findById(driver._id).populate('assignedTruck', 'truckNumber model');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
