const mongoose = require('mongoose');

/**
 * `rc` holds *external* RTO/RC facts fetched from the cStudio vehicle lookup.
 *
 * These are derived, re-verifiable reference data — NOT VTMS-managed records.
 * Everything operational (driver, status, mileage, capacity, fastag, notes)
 * lives on the parent Truck and is never written by the RC lookup.
 *
 * `rc.fetchedAt` is the marker for "this vehicle was verified"; it is absent on
 * trucks that were created manually.
 */
const rcSchema = new mongoose.Schema(
  {
    vehicleClass: { type: String, default: '' },
    vehicleClassDescription: { type: String, default: '' },
    registrationDate: { type: Date },
    // Sensitive RTO data — treat as PII, never log it.
    ownerName: { type: String, default: '' },
    ownerAddress: { type: String, default: '' },
    chassisNumber: { type: String, default: '' },
    engineNumber: { type: String, default: '' },
    bodyType: { type: String, default: '' },
    color: { type: String, default: '' },
    emissionNorm: { type: String, default: '' },
    financed: { type: Boolean, default: false },
    insurance: {
      company: { type: String, default: '' },
      policyNumber: { type: String, default: '' },
      validTill: { type: Date }
    },
    fitness: { validTill: { type: Date } },
    tax: { validTill: { type: Date } },
    pucc: {
      number: { type: String, default: '' },
      validTill: { type: Date }
    },
    rtoOffice: { type: String, default: '' },
    status: { type: String, default: '' },
    cubicCapacity: { type: Number },
    unladenWeightKg: { type: Number },
    wheelbaseMm: { type: Number },
    seatCapacity: { type: Number },
    transmission: { type: String, default: '' },
    variant: { type: String, default: '' },
    // 'mock' | 'live' | 'cache' — lets the UI state the provenance of the data.
    source: { type: String, enum: ['', 'mock', 'live', 'cache'], default: '' },
    fetchedAt: { type: Date },
    // Untouched upstream payload, kept verbatim for re-mapping/auditing.
    raw: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const truckSchema = new mongoose.Schema({
  truckNumber: { type: String, required: true, unique: true, uppercase: true },
  // Always stored normalised (upper-cased, separators stripped) by the routes.
  registrationNumber: { type: String, default: '', trim: true, uppercase: true },
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
  // External RC reference data (see rcSchema). Empty object until verified.
  rc: { type: rcSchema, default: () => ({}) },
  notes: { type: String, default: '' }
}, { timestamps: true });

// Registration lookups (duplicate check + per-vehicle document views).
truckSchema.index({ registrationNumber: 1 });

module.exports = mongoose.model('Truck', truckSchema);
