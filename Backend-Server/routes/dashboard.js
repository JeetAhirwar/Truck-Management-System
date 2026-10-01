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
    // Most urgent first: the dashboard is a triage list, not a register.
    expiredDocs.sort((a, b) => a.daysLeft - b.daysLeft);
    expiringSoon.sort((a, b) => a.daysLeft - b.daysLeft);

    // This month stats
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    // Cancelled trips never ran, so they contribute nothing to distance,
    // fuel or earnings — they are reported on the Trips loss view instead.
    const liveTrips = trips.filter(t => t.status !== 'Cancelled');
    const monthTrips = liveTrips.filter(t => new Date(t.createdAt) >= monthStart);
    const totalDistance = monthTrips.reduce((s, t) => s + (t.distance || 0), 0);
    const totalFuel = monthTrips.reduce((s, t) => s + (t.fuelRequired || 0), 0);
    const totalToll = tolls.reduce((s, t) => s + (t.amount || 0), 0);
    const totalRevenue = liveTrips.reduce((s, t) => s + (t.revenue || 0), 0);
    const totalProfit = liveTrips.reduce((s, t) => s + (t.profit || 0), 0);
    const cancelledTrips = trips.filter(t => t.status === 'Cancelled');
    const pendingTrips = trips.filter(t => !['Completed', 'Cancelled'].includes(t.status)).length;

    // Maintenance due
    const maintDue = maintenances.filter(m => {
      if (m.status === 'Overdue') return true;
      if (m.nextServiceDate && new Date(m.nextServiceDate) <= today) return true;
      return false;
    }).length;

    // FASTag low balance. A truck sitting at exactly Rs.0 is the *most* urgent
    // case, so the threshold must include it — the old `balance > 0 && < 1000`
    // guard silently dropped every zero-balance truck from the alert list.
    const lowFastag = trucks.filter(
      t => typeof t.fastag?.balance === 'number' && t.fastag.balance < 1000
    );
    lowFastag.sort((a, b) => (a.fastag?.balance || 0) - (b.fastag?.balance || 0));

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
        cancelledCount: cancelledTrips.length,
        /* Contract value that was booked on trips that never ran. */
        revenueLost: Math.round(cancelledTrips.reduce((s, t) => s + (t.revenue || 0), 0)),
        pendingTrips,
        totalDrivers: drivers.length,
        lowFastagCount: lowFastag.length,
        /* Aggregate shortfall: how much must be recharged to clear the alert. */
        fastagShortfall: Math.max(
          0,
          Math.round(lowFastag.reduce((sum, t) => sum + (1000 - (t.fastag?.balance || 0)), 0))
        )
      },
      alerts: {
        expiredDocs: expiredDocs.slice(0, 10),
        expiringSoon: expiringSoon.slice(0, 10),
        lowFastag: lowFastag.map(t => ({
          truckNumber: t.truckNumber,
          balance: t.fastag?.balance || 0
        }))
      },
      // Trip.find() returns natural (oldest-first) order, so an unsorted
      // slice(0, 5) shipped the 5 OLDEST trips to a panel labelled "Recent".
      recentTrips: [...trips]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5),
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
