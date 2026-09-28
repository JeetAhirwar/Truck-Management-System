const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  truck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', required: true },
  truckNumber: { type: String, required: true },
  serviceType: { type: String, required: true },
  date: { type: Date, default: Date.now },
  odometer: { type: Number },
  nextServiceOdometer: { type: Number },
  nextServiceDate: { type: Date },
  cost: { type: Number, default: 0 },
  workshop: { type: String, default: '' },
  invoice: { type: String, default: '' },
  items: [{ type: String }],
  notes: { type: String, default: '' },
  status: { type: String, enum: ['Completed', 'Scheduled', 'Overdue'], default: 'Completed' }
}, { timestamps: true });

module.exports = mongoose.model('Maintenance', maintenanceSchema);
