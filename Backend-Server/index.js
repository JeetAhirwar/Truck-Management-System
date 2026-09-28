const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();
const connectDB = require('./config/db');

connectDB();

const app = express();
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
app.listen(PORT, () => {
  console.log(`🚛 TruckPro Server running on http://localhost:${PORT}`);
});
