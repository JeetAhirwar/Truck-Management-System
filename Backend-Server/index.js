const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const connectDB = require('./config/db');
const { registerSocket } = require('./services/notificationService');

connectDB();

const app = express();
const server = http.createServer(app);

// Real-time notifications. JWT is verified on the handshake so only
// authenticated frontends can connect, then each user joins a private room
// (`user:<id>`) plus the broadcast room (`all`) for fleet-wide notifications.
const io = new Server(server, {
  transports: ['websocket', 'polling'],
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Not authorized, no token'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'truckpro_super_secret_2026');
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error('Not authorized, token failed'));
  }
});
io.on('connection', (socket) => {
  socket.join('all');
  if (socket.userId) socket.join(`user:${socket.userId}`);
});
registerSocket(io);

app.use(cors());
// 2 MB: a saved trip carries an OSRM route polyline, which easily exceeds the
// default 100 KB limit.
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Local-disk document storage (used when Cloudinary env vars are absent).
// Noop when Cloudinary is configured — files are served from Cloudinary.
const { isLocalStorage, LOCAL_UPLOAD_DIR } = require('./utils/upload');
if (isLocalStorage) {
  app.use('/uploads', express.static(LOCAL_UPLOAD_DIR));
  console.log('📎 Document storage: LOCAL disk at', LOCAL_UPLOAD_DIR);
} else {
  console.log('📎 Document storage: Cloudinary');
}

app.use('/api/auth', require('./routes/auth'));
app.use('/api/trucks', require('./routes/trucks'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/tolls', require('./routes/tolls'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TruckPro MERN API', time: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error', message: err.message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚛 TruckPro Server running on http://localhost:${PORT}`);
});

// Idempotent scanner: backfills notifications for documents/FASTag/maintenance
// once Mongo is connected, then re-checks periodically while the process runs.
const { startNotificationScanner } = require('./services/notificationScanner');
const runScanner = () => {
  try {
    startNotificationScanner();
  } catch (err) {
    console.error('Scanner error:', err.message);
  }
};
if (mongoose.connection.readyState === 1) runScanner();
else mongoose.connection.once('connected', runScanner);
