const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoMemoryServer = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      console.log(`[Database] Connecting to configured MongoDB at ${uri.replace(/\/\/.*@/, '//***@')}...`);
      return await mongoose.connect(uri);
    } catch (err) {
      console.warn(`[Database] Connection to MONGODB_URI failed. Falling back to in-memory MongoDB...`, err.message);
    }
  }

  // Automatic in-memory MongoDB server for instant setup
  console.log('[Database] Starting in-memory MongoDB server (zero external dependency mode)...');
  mongoMemoryServer = await MongoMemoryServer.create();
  const memUri = mongoMemoryServer.getUri();
  console.log(`[Database] In-memory MongoDB running at: ${memUri}`);
  
  return await mongoose.connect(memUri);
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
}

module.exports = { connectDB, disconnectDB };

