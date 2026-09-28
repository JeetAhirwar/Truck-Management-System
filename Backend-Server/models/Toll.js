const mongoose = require('mongoose');

const tollSchema = new mongoose.Schema({
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  truck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck' },
  truckNumber: { type: String, default: '' },
  plazaName: { type: String, required: true },
  location: { type: String, default: '' },
  highway: { type: String, default: '' },
  amount: { type: Number, required: true },
  vehicleCategory: { type: String, default: 'Truck' },
  paymentMode: { type: String, enum: ['FASTag', 'Cash', 'UPI'], default: 'FASTag' },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Failed'], default: 'Paid' },
  transactionId: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  remarks: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Toll', tollSchema);
