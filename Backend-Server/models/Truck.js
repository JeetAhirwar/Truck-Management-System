const mongoose = require('mongoose');

const truckSchema = new mongoose.Schema({
  truckNumber: { type: String, required: true, unique: true, uppercase: true },
  registrationNumber: { type: String, default: '' },
  truckType: { type: String, default: 'Truck' },
  brand: { type: String, default: '' },
  model: { type: String, default: '' },
  manufacturingYear: { type: Number },
  fuelType: { type: String, enum: ['Diesel', 'CNG', 'Petrol', 'Electric'], default: 'Diesel' },
  tankCapacity: { type: Number, default: 0 },
  currentOdometer: { type: Number, default: 0 },
  currentMileage: { type: Number, required: true },
  avgSpeed: { type: Number, default: 50 },
  loadCapacity: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Available', 'On Trip', 'Maintenance', 'Inactive'],
    default: 'Available'
  },
  currentDriver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
  // Trip currently holding this truck (cleared when the trip completes)
  currentTrip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
  fastag: {
    id: { type: String, default: '' },
    bank: { type: String, default: '' },
    balance: { type: Number, default: 0 },
    lastTransaction: { type: Date }
  },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Truck', truckSchema);
