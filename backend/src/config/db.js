import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

export const persistentDbDir = path.resolve(config.dataDir, 'db');

let embeddedMongoServer = null;
let isUsingEmbedded = false;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (config.useEmbedded) {
    return connectEmbeddedDatabase();
  }

  const uri = config.mongoUri;
  
  try {
    logger.info(`Attempting connection to MongoDB at: ${sanitizeMongoUri(uri)}`);
    // Connect with a 4s timeout for fast failover to embedded fallback if local service isn't running
    await mongoose.connect(uri, {
      dbName: config.databaseName,
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 4000
    });
    
    isUsingEmbedded = false;
    logger.success(`MongoDB Connected successfully to: ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);
    return mongoose.connection;
  } catch (err) {
    logger.warn(`Could not connect to external MongoDB: ${err.message}`);

    if (config.useEmbeddedFallback) {
      return connectEmbeddedDatabase();
    } else {
      throw err;
    }
  }
}

async function connectEmbeddedDatabase() {
  logger.info('Starting the bundled MongoDB instance with persistent disk storage...');

  try {
    fs.mkdirSync(persistentDbDir, { recursive: true });

    const { MongoMemoryServer } = await import('mongodb-memory-server');
    embeddedMongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: config.databaseName,
        dbPath: persistentDbDir,
        storageEngine: 'wiredTiger'
      }
    });
    const embeddedUri = embeddedMongoServer.getUri();
    await mongoose.connect(embeddedUri, { dbName: config.databaseName });
    isUsingEmbedded = true;
    logger.success(`Bundled MongoDB running at: ${sanitizeMongoUri(embeddedUri)} (Persistent disk path: ${persistentDbDir})`);
    return mongoose.connection;
  } catch (err) {
    logger.error(`Bundled MongoDB failed to start: ${err.message}`);
    throw err;
  }
}

export async function disconnectDB() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (embeddedMongoServer) {
      await embeddedMongoServer.stop();
      embeddedMongoServer = null;
    }
    logger.info('MongoDB disconnected.');
  } catch (err) {
    logger.error(`Error during DB disconnect: ${err.message}`);
  }
}

/**
 * Returns safe health metrics without exposing sensitive connection credentials
 */
export async function getDatabaseHealth() {
  const readyState = mongoose.connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const stateMap = {
    0: 'disconnected',
    1: isUsingEmbedded ? 'connected_embedded_fallback' : 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const status = stateMap[readyState] || 'unknown';
  let pingMs = null;
  let collectionsCount = 0;
  let isReplicaSet = false;

  if (readyState === 1 && mongoose.connection.db) {
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      pingMs = Date.now() - start;

      const collections = await mongoose.connection.db.listCollections().toArray();
      collectionsCount = collections.length;

      // Check if replica set (supports multi-document transactions)
      const isMasterResult = await mongoose.connection.db.admin().command({ isMaster: 1 });
      isReplicaSet = Boolean(isMasterResult.setName);
    } catch {
      // Ping check error
    }
  }

  return {
    status,
    connected: readyState === 1,
    database: mongoose.connection.name || config.databaseName,
    environment: config.env,
    host: mongoose.connection.host || 'local',
    port: mongoose.connection.port || 27017,
    isEmbedded: isUsingEmbedded,
    storagePath: isUsingEmbedded ? persistentDbDir : (config.mongoUri || 'External MongoDB Service'),
    storageEngine: 'WiredTiger',
    isReplicaSet,
    pingMs,
    collectionsCount,
    transactionsSupported: isReplicaSet
  };
}

function sanitizeMongoUri(uri) {
  if (!uri) return '';
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}
