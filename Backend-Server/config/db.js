const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is not set in environment variables');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB Atlas...');

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });

    console.log(
      `MongoDB Connected: ${mongoose.connection.host}/${mongoose.connection.name}`
    );

    return true;
  } catch (error) {
    console.error('MongoDB connection failed:');
    console.error(error.message);

    if (error.reason) {
      console.error('Connection reason:', error.reason);
    }

    process.exit(1);
  }
};

module.exports = connectDB;



// const mongoose = require('mongoose');
// const dns = require('dns');
// const https = require('https');

// const TRY_MS = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 8000);

// // Windows "Local Area Connection" uses a filtered/stub DNS resolver that refuses
// // SRV lookups for *.mongodb.net, so mongoose dies with
// // "querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net" even though the
// // machine has working internet. Workaround: resolve the SRV record ourselves
// // (system resolver first, then DNS-over-HTTPS against a public resolver) and
// // hand mongoose a pre-resolved seed-list URI. Only engaged when the direct
// // lookup fails, so normal environments and Vercel are untouched.
// const ATLAS_SRV = /^_mongodb\._tcp\.(.+)$/;
// const DOH_RESOLVERS = [
//   'https://dns.google/resolve?name=',
//   'https://cloudflare-dns.com/dns-query?name=',
// ];

// const resolveViaDoh = (name) =>
//   new Promise((resolve, reject) => {
//     const tryNext = (index) => {
//       if (index >= DOH_RESOLVERS.length) {
//         reject(new Error('all DoH resolvers failed'));
//         return;
//       }
//       const url = new URL(`${DOH_RESOLVERS[index]}${encodeURIComponent(name)}&type=SRV`);
//       const req = https.get(
//         url,
//         {
//           headers: {
//             accept: 'application/dns-json',
//             timeout: 5000,
//           },
//         },
//         (res) => {
//           let body = '';
//           res.on('data', (c) => (body += c));
//           res.on('end', () => {
//             try {
//               const json = JSON.parse(body);
//               const answers = (json.Answer || []).filter((a) => a.type === 33);
//               if (!answers.length) {
//                 tryNext(index + 1);
//                 return;
//               }
//               resolve(
//                 answers.map((a) => {
//                   // "0 0 27017 host."
//                   const parts = String(a.data).trim().split(/\s+/);
//                   return {
//                     name: parts[parts.length - 1].replace(/\.$/, ''),
//                     port: Number(parts[parts.length - 2]) || 27017,
//                   };
//                 })
//               );
//             } catch (err) {
//               tryNext(index + 1);
//             }
//           });
//         }
//       );
//       req.on('timeout', () => {
//         req.destroy();
//         tryNext(index + 1);
//       });
//       req.on('error', () => tryNext(index + 1));
//     };
//     tryNext(0);
//   });

// const resolveAtlasSrv = async (uri) => {
//   const credMatch = uri.match(/^mongodb\+srv:\/\/([^@]+)@(.+)$/);
//   if (!credMatch) return uri;
//   const [, credentials, rest] = credMatch;

//   const queryIdx = rest.indexOf('?');
//   const hostPort = queryIdx === -1 ? rest : rest.slice(0, queryIdx);
//   const host = hostPort.split('/')[0];
//   const recordName = `_mongodb._tcp.${host}`;
//   if (!ATLAS_SRV.test(recordName)) return uri;

//   let records = [];
//   try {
//     records = await dns.promises.resolveSrv(recordName);
//   } catch {
//     try {
//       records = await resolveViaDoh(recordName);
//     } catch {
//       return uri;
//     }
//   }
//   if (!records || records.length === 0) return uri;

//   // Query part (authSource/retryWrites/appName/...) rides along unchanged.
//   const slashIdx = rest.indexOf('/');
//   const database = slashIdx === -1 ? '' : rest.slice(slashIdx + 1, queryIdx === -1 ? undefined : queryIdx);
//   const query = queryIdx === -1 ? '' : rest.slice(queryIdx);

//   const hosts = records
//     .map((r) => `${r.name}:${r.port || 27017}`)
//     .join(',');

//   return `mongodb://${credentials}@${hosts}/${database}${query}`;
// };

// const attempt = async (uri, label) => {
//   const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: TRY_MS });
//   const { host, name } = conn.connection;
//   console.log(`MongoDB Connected [${label}]: ${host} / ${name || '(default db)'}`);
//   return true;
// };

// const connectDB = async () => {
//   const uri = process.env.MONGODB_URI;
//   if (!uri) {
//     console.error('MONGODB_URI is not set in environment variables');
//     process.exit(1);
//   }

//   try {
//     return await attempt(uri, 'atlas');
//   } catch (err) {
//     // ECONNREFUSED on querySrv means the SRV record could not be looked up.
//     // Retry once with the hosts resolved manually via a public DNS resolver.
//     if (String(err.message || '').includes('querySrv')) {
//       console.warn(`SRV lookup failed (${err.message}). Retrying with resolved hosts...`);
//       const resolved = await resolveAtlasSrv(uri);
//       if (resolved !== uri) {
//         try {
//           return await attempt(resolved, 'atlas+resolved');
//         } catch (err2) {
//           console.error(`MongoDB connection failed: ${err2.message}`);
//           process.exit(1);
//         }
//       }
//     }
//     console.error(`MongoDB connection failed: ${err.message}`);
//     process.exit(1);
//   }
// };

// module.exports = connectDB;
