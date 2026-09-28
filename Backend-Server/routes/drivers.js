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

    // Unassign previous
    if (driver.assignedTruck) {
      await Truck.findByIdAndUpdate(driver.assignedTruck, { currentDriver: null });
    }

    if (truckId) {
      // Clear previous driver on this truck
      await Driver.updateMany({ assignedTruck: truckId }, { assignedTruck: null });
      await Truck.findByIdAndUpdate(truckId, { currentDriver: driver._id });
      driver.assignedTruck = truckId;
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
