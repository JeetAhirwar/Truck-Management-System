const express = require('express');
const Toll = require('../models/Toll');
const { protect } = require('../middleware/auth');
const router = express.Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    const tolls = await Toll.find().sort({ date: -1 });
    res.json(tolls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const toll = await Toll.create(req.body);
    res.status(201).json(toll);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const toll = await Toll.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!toll) return res.status(404).json({ error: 'Not found' });
    res.json(toll);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Toll.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
