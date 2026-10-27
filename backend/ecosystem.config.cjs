const path = require('path');
const projectRoot = path.resolve(__dirname, '..');
const bundledMongoBinary = path.join(projectRoot, 'resources', 'mongodb', 'mongod.exe');

module.exports = {
  apps: [
    {
      name: 'raisoni-backend',
      cwd: projectRoot,
      script: 'backend/server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        USE_EMBEDDED_MONGODB_FALLBACK: 'true',
        MONGOMS_SYSTEM_BINARY: bundledMongoBinary,
        MONGOMS_SYSTEM_BINARY_VERSION_CHECK: 'false',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
