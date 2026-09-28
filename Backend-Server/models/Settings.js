const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  dieselPrice: { type: Number, default: 92 },
  cngPrice: { type: Number, default: 75 },
  petrolPrice: { type: Number, default: 105 },
  defaultDriverExpense: { type: Number, default: 2500 },
  defaultOtherExpense: { type: Number, default: 500 },
  defaultAvgSpeed: { type: Number, default: 50 },
  currency: { type: String, default: 'INR' }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
