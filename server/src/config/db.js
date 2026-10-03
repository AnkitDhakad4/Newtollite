const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is required. Set it to your MongoDB Atlas connection string in server/.env.');
  }

  console.log(`[Database] Connecting to configured MongoDB${process.env.NODE_ENV === 'test' ? ' (test run)' : ''}...`);
  return mongoose.connect(uri);
}
 
async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };

