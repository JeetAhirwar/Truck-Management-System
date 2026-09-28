const Document = require('../models/Document');
const Truck = require('../models/Truck');
const Maintenance = require('../models/Maintenance');
const { notify } = require('./notificationService');

const INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const LOW_FASTAG_THRESHOLD = 1000;

let timer = null;
let running = false;

/** Mostly dedupe-key asserts — identical keys to the live route hooks. */
const dayDiff = (date) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

async function scanDocuments() {
  const docs = await Document.find();
  for (const doc of docs) {
    if (!doc.expiryDate) continue;
    const days = dayDiff(doc.expiryDate);
    const truckNumber = doc.truckNumber || '';
    if (days < 0) {
      await notify({
        type: 'document_expired',
        severity: 'critical',
        title: `${doc.docType} expired`,
        message: `${truckNumber} · ${doc.docType} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago.`,
        link: '/documents',
        truckId: doc.truck,
        docId: doc._id,
        source: 'scanner',
        dedupeKey: `doc-${doc._id}-expired`,
      });
    } else if (days <= 30) {
      await notify({
        type: 'document_expiring',
        severity: 'warning',
        title: `${doc.docType} expiring soon`,
        message: `${truckNumber} · ${doc.docType} expires in ${days} day${days === 1 ? '' : 's'}.`,
        link: '/documents',
        truckId: doc.truck,
        docId: doc._id,
        source: 'scanner',
        dedupeKey: `doc-${doc._id}-expiring`,
      });
    }
  }
}

async function scanFastag() {
  const trucks = await Truck.find({ 'fastag.balance': { $lt: LOW_FASTAG_THRESHOLD } });
  for (const truck of trucks) {
    const balance = Number(truck.fastag && truck.fastag.balance != null ? truck.fastag.balance : 0);
    if (balance >= LOW_FASTAG_THRESHOLD) continue;
    await notify({
      type: 'fastag_low',
      severity: 'critical',
      title: 'FASTag low balance',
      message: `${truck.truckNumber} · ₹${balance.toLocaleString('en-IN')} left (below ₹1,000).`,
      link: '/trucks',
      truckId: truck._id,
      source: 'scanner',
      dedupeKey: `fastag-low-${truck.truckNumber}`,
    });
  }
}

async function scanMaintenance() {
  const now = new Date();
  const entries = await Maintenance.find({
    $or: [{ status: 'Overdue' }, { nextServiceDate: { $lt: now } }],
  });
  for (const entry of entries) {
    await notify({
      type: 'maintenance_due',
      severity: 'warning',
      title: 'Maintenance due',
      message: `${entry.truckNumber || ''} · ${entry.serviceType || 'service'}${entry.nextServiceDate ? ` due by ${new Date(entry.nextServiceDate).toLocaleDateString('en-IN')}` : ' has no service record'}.`,
      link: '/trucks',
      truckId: entry.truck,
      source: 'scanner',
      dedupeKey: `maintenance-${entry._id}-overdue`,
    });
  }
}

async function runScan() {
  if (running) return;
  running = true;
  try {
    await Promise.allSettled([scanDocuments(), scanFastag(), scanMaintenance()]);
  } finally {
    running = false;
  }
}

/** Starts the recurring scanner. Idempotent — safe to call after reconnect. */
function startNotificationScanner() {
  if (timer) return timer;
  runScan().catch((err) => console.error('[scanner] initial pass failed:', err.message));
  timer = setInterval(() => {
    runScan().catch((err) => console.error('[scanner] pass failed:', err.message));
  }, INTERVAL_MS);
  console.log('📣 Notification scanner started (initial scan + every 5 min)');
  return timer;
}

module.exports = { startNotificationScanner, runScan };