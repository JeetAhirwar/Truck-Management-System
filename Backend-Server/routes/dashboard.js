const express = require('express');
const Truck = require('../models/Truck');
const Driver = require('../models/Driver');
const Document = require('../models/Document');
const Trip = require('../models/Trip');
const Toll = require('../models/Toll');
const Maintenance = require('../models/Maintenance');
const { protect } = require('../middleware/auth');
const router = express.Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    const [trucks, drivers, docs, trips, tolls, maintenances] = await Promise.all([
      Truck.find(),
      Driver.find(),
      Document.find(),
      Trip.find(),
      Toll.find(),
      Maintenance.find()
    ]);

    const totalTrucks = trucks.length;
    const activeTrucks = trucks.filter(t => t.status !== 'Inactive').length;
    const inTransit = trucks.filter(t => t.status === 'On Trip').length;
    const available = trucks.filter(t => t.status === 'Available').length;
    const maintenanceStatus = trucks.filter(t => t.status === 'Maintenance').length;

    // Document alerts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiredDocs = [];
    const expiringSoon = [];
    docs.forEach(d => {
      if (!d.expiryDate) return;
      const diff = Math.ceil((new Date(d.expiryDate) - today) / (1000 * 60 * 60 * 24));
      if (diff < 0) expiredDocs.push({ ...d.toObject(), daysLeft: diff });
      else if (diff <= 30) expiringSoon.push({ ...d.toObject(), daysLeft: diff });
    });

    // This month stats
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthTrips = trips.filter(t => new Date(t.createdAt) >= monthStart);
    const totalDistance = monthTrips.reduce((s, t) => s + (t.distance || 0), 0);
    const totalFuel = monthTrips.reduce((s, t) => s + (t.fuelRequired || 0), 0);
    const totalToll = tolls.reduce((s, t) => s + (t.amount || 0), 0);
    const totalRevenue = trips.reduce((s, t) => s + (t.revenue || 0), 0);
    const totalProfit = trips.reduce((s, t) => s + (t.profit || 0), 0);
    const pendingTrips = trips.filter(t => !['Completed', 'Cancelled'].includes(t.status)).length;

    // Maintenance due
    const maintDue = maintenances.filter(m => {
      if (m.status === 'Overdue') return true;
      if (m.nextServiceDate && new Date(m.nextServiceDate) <= today) return true;
      return false;
    }).length;

    // FASTag low balance
    const lowFastag = trucks.filter(t => t.fastag?.balance > 0 && t.fastag.balance < 1000);

    res.json({
      summary: {
        totalTrucks,
        activeTrucks,
        inTransit,
        available,
        maintenance: maintenanceStatus,
        maintenanceDue: maintDue,
        documentsExpiring: expiringSoon.length,
        documentsExpired: expiredDocs.length,
        totalDistanceThisMonth: Math.round(totalDistance),
        totalFuelConsumed: Math.round(totalFuel * 10) / 10,
        totalTollExpense: Math.round(totalToll),
        revenue: Math.round(totalRevenue),
        estimatedProfit: Math.round(totalProfit),
        pendingTrips,
        totalDrivers: drivers.length,
        lowFastagCount: lowFastag.length
      },
      alerts: {
        expiredDocs: expiredDocs.slice(0, 10),
        expiringSoon: expiringSoon.slice(0, 10),
        lowFastag: lowFastag.map(t => ({
          truckNumber: t.truckNumber,
          balance: t.fastag?.balance || 0
        }))
      },
      recentTrips: trips.slice(0, 5)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
