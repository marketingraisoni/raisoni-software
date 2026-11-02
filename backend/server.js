import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './src/config/env.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { initRedis, disconnectRedis, isRedisConnected } from './src/config/redis.js';
import { initSocketIO } from './src/sockets/socketManager.js';
import { logger, startLogMaintenance, closeLogger } from './src/utils/logger.js';
import { registerProcessGuards, startResourceMonitor, stopResourceMonitor } from './src/utils/processGuard.js';
import { getLocalIpAddresses, getPrimaryLanIp } from './src/utils/network.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { apiNotFound } from './src/middleware/notFoundMiddleware.js';
import { requestLogger } from './src/middleware/requestLogger.js';
import { highFrequencyApiLimiter } from './src/middleware/rateLimitMiddleware.js';
import { invalidateDashboardOnWrite } from './src/middleware/cacheMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');

import { User } from './src/models/User.js';
import { Lot } from './src/models/Lot.js';
import { AssortmentPacket } from './src/models/AssortmentPacket.js';
import { AssortmentWriteLock } from './src/models/AssortmentWriteLock.js';
import { Setting } from './src/models/Setting.js';
import { seedDatabase } from './scripts/seed.js';
import { migrateLegacyUserTypes } from './src/services/userMigrationService.js';
import {
  startDatabaseBackupScheduler,
  stopDatabaseBackupScheduler,
} from './src/services/databaseBackupService.js';
import {
  startDiscoveryResponder,
  stopDiscoveryResponder,
} from './src/services/discoveryService.js';

// Route imports
import healthRoutes from './src/routes/healthRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import customerRoutes from './src/routes/customerRoutes.js';
import productRoutes from './src/routes/productRoutes.js';
import orderRoutes from './src/routes/orderRoutes.js';
import inventoryRoutes from './src/routes/inventoryRoutes.js';
import settingRoutes from './src/routes/settingRoutes.js';
import permissionRoutes from './src/routes/permissionRoutes.js';
import lotRoutes from './src/routes/lotRoutes.js';
import semiPolishRoutes from './src/routes/semiPolishRoutes.js';
import chatRoutes from './src/routes/chatRoutes.js';

const app = express();
const httpServer = http.createServer(app);

// 0. Request id + logging first, so even body-parsing failures are logged with an id
app.use(requestLogger);

// 1. Security & Headers
app.use(helmet({
  contentSecurityPolicy: false, // For desktop / SPA flexibility
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// 2. CORS configuration
app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'X-No-Cache'],
  exposedHeaders: ['X-Request-Id', 'X-Cache']
}));

// 3. Request body parsing with strict size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 5. Mount API Routes
app.use('/api/health', healthRoutes);

// Per-IP safety net against runaway clients (health checks above are not limited)
app.use('/api', highFrequencyApiLimiter);
// Any successful write clears the cached dashboard so it never shows stale totals
app.use('/api', invalidateDashboardOnWrite({
  excludePrefixes: ['/api/auth/login', '/api/auth/logout', '/api/chats'],
}));
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/lots', lotRoutes);
app.use('/api/semi-polish', semiPolishRoutes);
app.use('/api/chats', chatRoutes);

// 5b. Uploads static directory
const uploadsDir = path.resolve(config.dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// 6. 404 Route handler for API endpoints
app.use('/api/*', apiNotFound);

// 7. Serve frontend static build on configured port (port 2000 in production) for LAN office access
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath, {
    setHeaders(res, filePath) {
      // Always revalidate the entry point after a server/frontend deployment.
      // Hashed assets can still use normal static-file caching.
      if (path.basename(filePath) === 'index.html') res.setHeader('Cache-Control', 'no-store');
    }
  }));
  app.get('*', (req, res, next) => {
    if (
      req.originalUrl.startsWith('/api') ||
      req.originalUrl.startsWith('/socket.io') ||
      req.originalUrl.startsWith('/uploads')
    ) {
      return next();
    }
    if (req.path.startsWith('/assets/')) return res.sendStatus(404);
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// 8. Global Error Handler
app.use(errorHandler);

// 9. Initialize WebSockets
initSocketIO(httpServer);

/**
 * Start the server and connect to database
 */
export async function startServer(port = config.port) {
  try {
    logger.info(`Starting ${config.appName} backend v${config.appVersion} (${config.env}, pid ${process.pid}, node ${process.version})`);
    if (config.logToFile) logger.info(`Log files: ${config.logDir} (level: ${config.logLevel}, kept ${config.logRetentionDays} days)`);
    startLogMaintenance();
    await connectDB();
    await initRedis();
    // Replace the former global Kapan uniqueness index with the active-only
    // index required by soft deletion and Kapan reuse.
    await Lot.syncIndexes();
    // Explicitly create packet sequence and idempotency indexes before serving
    // traffic so concurrent assortment writes have database-level guarantees.
    await AssortmentPacket.createIndexes();
    await AssortmentWriteLock.createIndexes();
    await migrateLegacyUserTypes();
    await Setting.updateOne(
      { key: 'appName', value: 'Raisoni Software Demo' },
      { $set: { value: 'Raisoni ERP' } }
    );

    // Auto-seed initial accounts if database is empty
    try {
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        logger.info('Database missing user records. Initializing default accounts...');
        await seedDatabase({ reset: false });
      }
    } catch (seedErr) {
      logger.warn(`Auto-seeding check skipped: ${seedErr.message}`);
    }

    return new Promise((resolve, reject) => {
      const handleStartupError = (error) => {
        httpServer.off('listening', handleListening);
        if (error.code === 'EADDRINUSE') {
          error.message =
            `Port ${port} is already in use on ${config.host}. Another copy of the backend is probably running ` +
            `(check "npm run pm2:status" or run "netstat -ano | findstr :${port}").`;
        }
        reject(error);
      };
      const handleListening = () => {
        httpServer.off('error', handleStartupError);
        startDatabaseBackupScheduler();
        startDiscoveryResponder();
        startResourceMonitor();
        const primaryLanIp = getPrimaryLanIp();
        const lanIps = getLocalIpAddresses();

        logger.success('====================================================');
        logger.success(` ${config.appName} Backend API Started`);
        logger.success(` Environment:  ${config.env}`);
        logger.success(` Database:     ${config.databaseName}`);
        logger.success(` Cache:        ${isRedisConnected() ? 'Redis' : 'In-Memory Fallback'}`);
        const address = httpServer.address();
        const actualPort = typeof address === 'object' && address ? address.port : port;
        logger.success(` Local URL:    http://127.0.0.1:${actualPort}/api`);
        logger.success(` LAN URL:      http://${primaryLanIp}:${actualPort}/api`);
        logger.success(' Available network interfaces:');
        lanIps.forEach(net => {
          logger.info(`   - [${net.interface}]: http://${net.address}:${actualPort}/api`);
        });
        logger.success('====================================================');
        if (process.send) process.send('ready');
        resolve({ app, httpServer, port: actualPort, primaryLanIp });
      };

      httpServer.once('error', handleStartupError);
      httpServer.once('listening', handleListening);
      httpServer.listen(port, config.host);
    });
  } catch (err) {
    logger.error(`Server startup failed: ${err.message}`, { error: err });
    throw err;
  }
}

/**
 * Graceful shutdown handler
 */
let stopPromise = null;
export function stopServer() {
  if (stopPromise) return stopPromise;
  logger.info('Shutting down server gracefully...');
  stopPromise = (async () => {
    stopDiscoveryResponder();
    stopResourceMonitor();
    await stopDatabaseBackupScheduler();
    if (httpServer.listening) {
      await new Promise((resolve) => httpServer.close(() => resolve()));
    }
    await disconnectDB();
    await disconnectRedis();
    logger.info('Server, DB, and Redis stopped.');
  })();
  return stopPromise;
}

// Auto-run if executed directly
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === __filename;
const isPm2Execution = process.env.NODE_APP_INSTANCE !== undefined || process.env.pm_id !== undefined;

const SHUTDOWN_TIMEOUT_MS = 8000; // below PM2 kill_timeout (10s)

let exiting = false;
async function shutdownAndExit(reason, exitCode = 0) {
  if (exiting) return;
  exiting = true;
  logger[exitCode === 0 ? 'info' : 'error'](`Shutdown requested (${reason}).`);
  const forceExit = setTimeout(() => {
    logger.error(`Graceful shutdown took longer than ${SHUTDOWN_TIMEOUT_MS}ms; forcing exit.`);
    closeLogger().finally(() => process.exit(exitCode || 1));
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();
  try {
    await stopServer();
  } catch (err) {
    logger.error(`Error during shutdown: ${err.message}`, { error: err });
  }
  logger.info(`Process exiting with code ${exitCode}.`);
  await closeLogger();
  process.exit(exitCode);
}

if (isDirectExecution || isPm2Execution) {
  registerProcessGuards({
    onFatal: () => shutdownAndExit('uncaught exception', 1),
  });

  startServer().catch(() => {
    // Exit for real so PM2 restarts us; an open DB handle would otherwise keep a
    // non-listening process alive and PM2 would report it as "online".
    shutdownAndExit('startup failure', 1);
  });
}

process.on('SIGINT', () => shutdownAndExit('SIGINT'));
process.on('SIGTERM', () => shutdownAndExit('SIGTERM'));
// PM2 on Windows cannot deliver signals; with shutdown_with_message it sends this instead.
process.on('message', (message) => {
  if (message === 'shutdown') shutdownAndExit('PM2 shutdown message');
});

export { app, httpServer };
