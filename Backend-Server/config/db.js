const mongoose = require('mongoose');

const TRY_MS = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 8000);

const attempt = async (uri, label) => {
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: TRY_MS });
  const { host, name } = conn.connection;
  console.log(`MongoDB Connected [${label}]: ${host} / ${name || '(default db)'}`);
  return true;
};

const connectDB = async () => {
  const primary = process.env.MONGODB_URI;
  const fallback =
    process.env.MONGODB_URI_LOCAL || 'mongodb://127.0.0.1:27017/truckpro';

  if (primary) {
    try {
      return await attempt(primary, 'atlas');
    } catch (err) {
      console.warn(`MongoDB Atlas unreachable (${err.message}). Trying local fallback...`);
    }
  }

  try {
    return await attempt(fallback, 'local');
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    console.error('Fix MONGODB_URI in .env or start a local mongod, then restart.');
    process.exit(1);
  }
};

module.exports = connectDB;
