const mongoose = require('mongoose');

/**
 * One entry per assignment period. `releasedAt` null means the driver still
 * holds this truck, so the open entry is the current assignment.
 *
 * `truckNumber` / `truckLabel` are denormalised on purpose: history must stay
 * readable even after the truck itself is deleted.
 */
const assignmentEntrySchema = new mongoose.Schema(
  {
    truck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck' },
    truckNumber: { type: String, default: '' },
    truckLabel: { type: String, default: '' },
    assignedAt: { type: Date, required: true },
    releasedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

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
  // Assignment timeline, chronological (oldest first). Written only by the
  // assign route; drivers created before this existed simply have no entries.
  assignmentHistory: { type: [assignmentEntrySchema], default: [] },
  emergencyContact: { type: String, default: '' },
  status: { type: String, enum: ['Available', 'On Trip', 'Inactive'], default: 'Available' },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Driver', driverSchema);
