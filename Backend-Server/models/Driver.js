const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  address: { type: String, default: '' },
  dob: { type: Date },
  licenseNumber: { type: String, required: true },
  licenseType: { type: String, default: 'HMV' },
  licenseExpiry: { type: Date },
  experience: { type: Number, default: 0 },
  assignedTruck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', default: null },
  emergencyContact: { type: String, default: '' },
  status: { type: String, enum: ['Available', 'On Trip', 'Inactive'], default: 'Available' },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Driver', driverSchema);
