const mongoose = require('mongoose');

const fuelSchema = new mongoose.Schema({
  truck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', required: true },
  truckNumber: { type: String, required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  driverName: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  litres: { type: Number, required: true },
  pricePerLitre: { type: Number, required: true },
  totalCost: { type: Number },
  odometer: { type: Number },
  fuelStation: { type: String, default: '' },
  receipt: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { timestamps: true });

fuelSchema.pre('save', function (next) {
  try {
    this.totalCost = Math.round((this.litres || 0) * (this.pricePerLitre || 0));
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('FuelRecord', fuelSchema);
