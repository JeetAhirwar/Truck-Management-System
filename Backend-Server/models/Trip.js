const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  tripId: { type: String, unique: true },
  truck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', required: true },
  truckNumber: { type: String, required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  driverName: { type: String, default: '' },
  from: { type: String, required: true },
  to: { type: String, required: true },
  // Endpoints picked on the map (from/to above stay the human readable names)
  origin: {
    label: { type: String, default: '' },
    lat: Number,
    lng: Number
  },
  destination: {
    label: { type: String, default: '' },
    lat: Number,
    lng: Number
  },
  // GeoJSON LineString [[lng, lat], ...] as returned by OSRM, for the map
  routeGeometry: { type: mongoose.Schema.Types.Mixed, default: null },
  routeDistanceKm: { type: Number, default: 0 },
  routeDuration: { type: String, default: '' },
  routeDurationSeconds: { type: Number, default: 0 },
  routeCoordinateCount: { type: Number, default: 0 },
  tollIsEstimated: { type: Boolean, default: false },
  tollSource: { type: String, default: '' },
  distance: { type: Number, required: true },
  startDate: { type: Date },
  expectedDelivery: { type: Date },
  completedDate: { type: Date },
  cargo: { type: String, default: '' },
  cargoWeight: { type: Number, default: 0 },
  customer: { type: String, default: '' },
  // Snapshot of truck data at trip time
  mileageUsed: { type: Number },
  fuelType: { type: String },
  avgSpeed: { type: Number },
  // Calculated fields (stored for history)
  fuelRequired: { type: Number, default: 0 },
  fuelCost: { type: Number, default: 0 },
  fuelPrice: { type: Number, default: 0 },
  tollCost: { type: Number, default: 0 },
  driverExpense: { type: Number, default: 0 },
  otherExpenses: { type: Number, default: 0 },
  totalExpense: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  profitPercent: { type: Number, default: 0 },
  travelTimeHours: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Planned', 'Assigned', 'Started', 'In Transit', 'Reached', 'Completed', 'Cancelled'],
    default: 'Planned'
  },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Trip', tripSchema);
