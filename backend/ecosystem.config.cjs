const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const bundledMongoBinary = path.join(projectRoot, 'resources', 'mongodb', 'mongod.exe');
const logDir = path.join(projectRoot, 'logs');

// Only point mongodb-memory-server at the bundled binary when it is actually present;
// otherwise the fallback fails with a confusing "binary not found" error.
const bundledMongoEnv = fs.existsSync(bundledMongoBinary)
  ? {
      MONGOMS_SYSTEM_BINARY: bundledMongoBinary,
      MONGOMS_SYSTEM_BINARY_VERSION_CHECK: 'false',
    }
  : {};

// Values here override .env.<environment>. Everything else (PORT, MONGODB_URI,
// JWT_SECRET, ...) comes from the .env files in the project root.
const sharedEnv = {
  USE_EMBEDDED_MONGODB_FALLBACK: 'true',
  // After a reboot PM2 can start before the MongoDB service; wait ~70s before falling back.
  MONGODB_CONNECT_RETRIES: '10',
  ...bundledMongoEnv,
};

module.exports = {
  apps: [
    {
      name: 'raisoni-backend',
      cwd: projectRoot,
      script: 'backend/server.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      watch: false,

      // Production server: serves the UI and API on 0.0.0.0:2000 for every LAN PC and desktop app.
      env: {
        ...sharedEnv,
        NODE_ENV: 'production',
        APP_ENV: 'production',
      },

      // Restart policy: back off instead of burning through max_restarts while
      // MongoDB or the network is still coming up after a reboot.
      autorestart: true,
      exp_backoff_restart_delay: 1000,
      max_restarts: 50,
      min_uptime: '20s',
      max_memory_restart: '1G',

      // Graceful shutdown (Windows has no POSIX signals, so PM2 sends a message).
      kill_timeout: 10000,
      shutdown_with_message: true,

      // Logs
      out_file: path.join(logDir, 'backend-out.log'),
      error_file: path.join(logDir, 'backend-error.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
