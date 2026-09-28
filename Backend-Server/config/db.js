const mongoose = require('mongoose');
const dns = require('dns');

/* Some Windows networks (filtered / stub resolvers, some ISPs) refuse SRV
   lookups for *.mongodb.net, so mongoose dies with
   "querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net" even though the
   machine has working internet, nslookup resolves the record, and TCP 27017 to
   the shard hosts is open.

   Fix: retry once through a public resolver. Note that dns.setServers() only
   affects dns.resolve* (c-ares, i.e. SRV/MX/TXT lookups) and NOT dns.lookup(),
   which is what http/https uses for normal hostnames — so Cloudinary, TollGuru
   and every other outbound call keep using the OS resolver. */
const PUBLIC_DNS = ['1.1.1.1', '8.8.8.8'];

const connect = (uri, timeout) =>
  mongoose.connect(uri, {
    serverSelectionTimeoutMS: timeout,
    connectTimeoutMS: timeout,
  });

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is not set in environment variables');
    process.exit(1);
  }

  const timeout = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 15000);

  try {
    console.log('Connecting to MongoDB Atlas...');
    await connect(uri, timeout);
  } catch (error) {
    const message = String(error?.message || '');

    if (!message.includes('querySrv')) {
      console.error('MongoDB connection failed:');
      console.error(message);
      if (error.reason) console.error('Connection reason:', error.reason);
      process.exit(1);
    }

    console.warn(`System DNS refused the SRV lookup (${message}).`);
    console.warn(`Retrying via public DNS: ${PUBLIC_DNS.join(', ')}...`);
    dns.setServers(PUBLIC_DNS);

    try {
      await connect(uri, timeout);
      console.log('SRV lookup succeeded through the public resolver.');
    } catch (retryError) {
      console.error('MongoDB connection failed:');
      console.error(retryError.message);
      if (retryError.reason) console.error('Connection reason:', retryError.reason);
      process.exit(1);
    }
  }

  console.log(`MongoDB Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  return true;
};

module.exports = connectDB;
