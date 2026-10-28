import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
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

  // A bundled mongod left running by the previous process is the fastest path back.
  if (config.useEmbeddedFallback) {
    const reused = await reuseRunningEmbeddedDatabase();
    if (reused) return reused;
  }

  const uri = config.mongoUri;
  // Retrying only helps when a MongoDB service exists and may still be booting. On a PC that
  // relies on the bundled database, waiting would just delay every start by ~70 seconds.
  const attempts = isMongoServiceStartingOrRunning(uri) ? config.mongoConnectRetries + 1 : 1;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      logger.info(`Attempting connection to MongoDB at: ${sanitizeMongoUri(uri)} (attempt ${attempt}/${attempts})`);
      // Short per-attempt timeout; the retry loop covers a MongoDB service that is still booting.
      await mongoose.connect(uri, {
        dbName: config.databaseName,
        serverSelectionTimeoutMS: 4000,
        connectTimeoutMS: 4000
      });

      isUsingEmbedded = false;
      logger.success(`MongoDB Connected successfully to: ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);
      return mongoose.connection;
    } catch (err) {
      lastError = err;
      logger.warn(`Could not connect to MongoDB: ${err.message}`);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, config.mongoRetryDelayMs));
      }
    }
  }

  if (config.useEmbeddedFallback) {
    return connectEmbeddedDatabase();
  }

  logger.error(
    `MongoDB is not reachable at ${sanitizeMongoUri(uri)}. Start the "MongoDB" Windows service ` +
    '(services.msc or "net start MongoDB"), or set USE_EMBEDDED_MONGODB_FALLBACK=true to use the bundled database.'
  );
  throw lastError;
}

function isMongoServiceStartingOrRunning(uri) {
  const isLocalUri = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/i.test(uri);
  if (!isLocalUri || process.platform !== 'win32') return true;

  const result = spawnSync('sc.exe', ['query', 'MongoDB'], { timeout: 3000, windowsHide: true });
  // A stopped service cannot become ready through retries; use the configured fallback.
  return result.status === 0 && !/\bSTOPPED\b/.test(result.stdout?.toString() || '');
}

// Remembers where the bundled mongod is listening. If the backend was killed without a
// graceful shutdown (common with PM2 on Windows), mongod.exe keeps running and holds the
// data-folder lock, so a fresh start must reconnect to it instead of failing with DBPathInUse.
const embeddedStatePath = path.resolve(config.dataDir, 'embedded-mongod.json');

async function reuseRunningEmbeddedDatabase() {
  let state;
  try {
    state = JSON.parse(fs.readFileSync(embeddedStatePath, 'utf8'));
  } catch {
    return null;
  }
  if (!state?.uri) return null;

  try {
    await mongoose.connect(state.uri, {
      dbName: config.databaseName,
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000
    });
    isUsingEmbedded = true;
    logger.success(`Reconnected to the bundled MongoDB already running at: ${sanitizeMongoUri(state.uri)}`);
    return mongoose.connection;
  } catch {
    fs.rmSync(embeddedStatePath, { force: true });
    return null;
  }
}

async function connectEmbeddedDatabase() {
  const reused = await reuseRunningEmbeddedDatabase();
  if (reused) return reused;

  logger.info('Starting the bundled MongoDB instance with persistent disk storage...');

  try {
    fs.mkdirSync(persistentDbDir, { recursive: true });

    const bundledMongoBinary = path.join(config.projectRoot, 'resources', 'mongodb', 'mongod.exe');
    if (!process.env.MONGOMS_SYSTEM_BINARY && fs.existsSync(bundledMongoBinary)) {
      process.env.MONGOMS_SYSTEM_BINARY = bundledMongoBinary;
      process.env.MONGOMS_SYSTEM_BINARY_VERSION_CHECK = 'false';
    }
    if (process.env.MONGOMS_SYSTEM_BINARY && !fs.existsSync(process.env.MONGOMS_SYSTEM_BINARY)) {
      throw new Error(
        `Bundled mongod.exe not found at ${process.env.MONGOMS_SYSTEM_BINARY}. Run "npm run mongodb:download" once to download it.`
      );
    }

    const { MongoMemoryServer } = await import('mongodb-memory-server');
    embeddedMongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: config.databaseName,
        dbPath: persistentDbDir,
        port: 27017,
        storageEngine: 'wiredTiger'
      }
    });
    const embeddedUri = embeddedMongoServer.getUri();
    fs.writeFileSync(embeddedStatePath, JSON.stringify({ uri: embeddedUri }), 'utf8');
    await mongoose.connect(embeddedUri, { dbName: config.databaseName });
    isUsingEmbedded = true;
    logger.success(`Bundled MongoDB running at: ${sanitizeMongoUri(embeddedUri)} (Persistent disk path: ${persistentDbDir})`);
    return mongoose.connection;
  } catch (err) {
    logger.error(`Bundled MongoDB failed to start: ${err.message}`);
    if (/DBPathInUse/.test(err.message)) {
      logger.error(
        `Another mongod.exe is still using ${persistentDbDir}. Stop the other backend (npm run pm2:status), ` +
        'or end the leftover "mongod.exe" in Task Manager, then start again.'
      );
    }
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
      fs.rmSync(embeddedStatePath, { force: true });
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
