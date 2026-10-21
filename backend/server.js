import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './src/config/env.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { initSocketIO } from './src/sockets/socketManager.js';
import { logger } from './src/utils/logger.js';
import { getLocalIpAddresses, getPrimaryLanIp } from './src/utils/network.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { apiNotFound } from './src/middleware/notFoundMiddleware.js';
import { requestLogger } from './src/middleware/requestLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');

import { User } from './src/models/User.js';
import { Lot } from './src/models/Lot.js';
import { seedDatabase } from './scripts/seed.js';
import { migrateLegacyUserTypes } from './src/services/userMigrationService.js';

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

const app = express();
const httpServer = http.createServer(app);

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 3. Request body parsing with strict size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Request logging
app.use(requestLogger);

// 5. Mount API Routes
app.use('/api/health', healthRoutes);
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

// 6. 404 Route handler for API endpoints
app.use('/api/*', apiNotFound);

// 7. Serve frontend static build on port 3000 for LAN office access
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/socket.io')) {
      return next();
    }
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
    await connectDB();
    // Replace the former global Kapan uniqueness index with the active-only
    // index required by soft deletion and Kapan reuse.
    await Lot.syncIndexes();
    await migrateLegacyUserTypes();

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

    return new Promise((resolve) => {
      httpServer.listen(port, config.host, () => {
        const primaryLanIp = getPrimaryLanIp();
        const lanIps = getLocalIpAddresses();

        logger.success('====================================================');
        logger.success(` ${config.appName} Backend API Started`);
        logger.success(` Local URL:    http://127.0.0.1:${port}/api`);
        logger.success(` LAN URL:      http://${primaryLanIp}:${port}/api`);
        logger.success(' Available network interfaces:');
        lanIps.forEach(net => {
          logger.info(`   - [${net.interface}]: http://${net.address}:${port}/api`);
        });
        logger.success('====================================================');
        resolve({ app, httpServer, port, primaryLanIp });
      });
    });
  } catch (err) {
    logger.error(`Server startup failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
export async function stopServer() {
  logger.info('Shutting down server gracefully...');
  return new Promise((resolve) => {
    httpServer.close(async () => {
      await disconnectDB();
      logger.info('Server and DB stopped.');
      resolve();
    });
  });
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

process.on('SIGINT', async () => {
  await stopServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopServer();
  process.exit(0);
});

export { app, httpServer };
