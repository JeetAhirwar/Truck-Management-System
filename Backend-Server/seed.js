require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Truck = require('./models/Truck');
const Driver = require('./models/Driver');
const Document = require('./models/Document');
const Settings = require('./models/Settings');
const Notification = require('./models/Notification');

const seed = async () => {
  try {
    await connectDB();
    console.log('Seeding database...');

    await User.deleteMany({});
    await Truck.deleteMany({});
    await Driver.deleteMany({});
    await Document.deleteMany({});
    await Settings.deleteMany({});
    await Notification.deleteMany({});

    const admin = await User.create({
      name: 'Admin',
      email: 'admin@truck.com',
      password: 'admin123',
      role: 'admin'
    });
    console.log('Admin created:', admin.email);

    await Settings.create({
      dieselPrice: 92,
      cngPrice: 75,
      petrolPrice: 105,
      defaultDriverExpense: 2500,
      defaultOtherExpense: 500,
      defaultAvgSpeed: 50
    });

    const drivers = await Driver.insertMany([
      { name: 'Rahul Sharma', mobile: '9876543210', licenseNumber: 'MH1420110012345', licenseType: 'HMV', experience: 8, status: 'Available', emergencyContact: '9876500001' },
      { name: 'Suresh Patil', mobile: '9876543211', licenseNumber: 'MH1420110012346', licenseType: 'HMV', experience: 5, status: 'Available', emergencyContact: '9876500002' },
      { name: 'Amit Kumar', mobile: '9876543212', licenseNumber: 'MP0920150056789', licenseType: 'HMV', experience: 12, status: 'Available' }
    ]);

    const trucks = await Truck.insertMany([
      {
        truckNumber: 'MH12AB1234',
        registrationNumber: 'MH12AB1234',
        truckType: 'LCV',
        brand: 'Tata',
        model: '407',
        manufacturingYear: 2022,
        fuelType: 'Diesel',
        tankCapacity: 200,
        currentOdometer: 45000,
        currentMileage: 8.5,
        avgSpeed: 55,
        loadCapacity: 5,
        status: 'Available',
        currentDriver: drivers[0]._id,
        fastag: { id: 'FT1234567890', bank: 'HDFC', balance: 2500 }
      },
      {
        truckNumber: 'MH14CD5678',
        registrationNumber: 'MH14CD5678',
        truckType: 'HCV',
        brand: 'Ashok Leyland',
        model: '1920',
        manufacturingYear: 2021,
        fuelType: 'Diesel',
        tankCapacity: 400,
        currentOdometer: 78000,
        currentMileage: 4.2,
        avgSpeed: 50,
        loadCapacity: 16,
        status: 'Available',
        currentDriver: drivers[1]._id,
        fastag: { id: 'FT9876543210', bank: 'SBI', balance: 820 }
      },
      {
        truckNumber: 'MP09EF9012',
        registrationNumber: 'MP09EF9012',
        truckType: 'HCV',
        brand: 'Eicher',
        model: 'Pro 3015',
        manufacturingYear: 2023,
        fuelType: 'Diesel',
        tankCapacity: 350,
        currentOdometer: 22000,
        currentMileage: 5.8,
        avgSpeed: 52,
        loadCapacity: 12,
        status: 'Available',
        fastag: { id: 'FT5555666677', bank: 'ICICI', balance: 4500 }
      }
    ]);

    // Assign trucks to drivers
    await Driver.findByIdAndUpdate(drivers[0]._id, { assignedTruck: trucks[0]._id });
    await Driver.findByIdAndUpdate(drivers[1]._id, { assignedTruck: trucks[1]._id });

    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const soon = new Date();
    soon.setDate(soon.getDate() + 15);
    const expired = new Date();
    expired.setMonth(expired.getMonth() - 1);

    await Document.insertMany([
      { truck: trucks[0]._id, truckNumber: trucks[0].truckNumber, docType: 'RC', docNumber: 'RC-MH12AB1234', issueDate: new Date('2022-03-15'), expiryDate: nextYear },
      { truck: trucks[0]._id, truckNumber: trucks[0].truckNumber, docType: 'Insurance', docNumber: 'INS-2025-8891', issueDate: new Date('2025-04-01'), expiryDate: soon },
      { truck: trucks[1]._id, truckNumber: trucks[1].truckNumber, docType: 'Insurance', docNumber: 'INS-2024-1122', issueDate: new Date('2024-09-01'), expiryDate: expired },
      { truck: trucks[1]._id, truckNumber: trucks[1].truckNumber, docType: 'PUC', docNumber: 'PUC-9912', issueDate: new Date('2025-06-01'), expiryDate: soon },
      { truck: trucks[2]._id, truckNumber: trucks[2].truckNumber, docType: 'Fitness Certificate', docNumber: 'FC-3344', issueDate: new Date('2025-01-15'), expiryDate: nextYear },
      { truck: trucks[2]._id, truckNumber: trucks[2].truckNumber, docType: 'National Permit', docNumber: 'NP-44521', issueDate: new Date('2024-01-10'), expiryDate: nextYear }
    ]);

    // Demo notifications (source: seed) so the feed has content on first run.
    // Dedupe keys mirror the live/scanner ones, so an already-existing
    // notification of the same kind is never duplicated.
    await Notification.insertMany([
      {
        type: 'system',
        severity: 'info',
        title: 'Welcome to TruckPro',
        message: 'Fleet notifications are now live. You will get real-time alerts for trips, documents and FASTag.',
        link: '/dashboard',
        source: 'seed',
      },
      {
        type: 'document_expired',
        severity: 'critical',
        title: 'Insurance expired',
        message: `${trucks[1].truckNumber} · Insurance expired 30 days ago.`,
        link: '/documents',
        truckId: trucks[1]._id,
        source: 'seed',
        dedupeKey: `seed-doc-expired-${trucks[1]._id}`,
      },
      {
        type: 'document_expiring',
        severity: 'warning',
        title: 'PUC expiring soon',
        message: `${trucks[1].truckNumber} · PUC expires in 15 days.`,
        link: '/documents',
        truckId: trucks[1]._id,
        source: 'seed',
        dedupeKey: `seed-doc-expiring-${trucks[1]._id}`,
      },
      {
        type: 'fastag_low',
        severity: 'critical',
        title: 'FASTag low balance',
        message: `${trucks[1].truckNumber} · ₹820 left (below ₹1,000).`,
        link: '/trucks',
        truckId: trucks[1]._id,
        source: 'seed',
        dedupeKey: `seed-fastag-low-${trucks[1]._id}`,
      }
    ]);
    console.log('Demo notifications inserted (source: seed).');

    console.log('✅ Seed completed successfully!');
    console.log('Login: admin@truck.com / admin123');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seed();
