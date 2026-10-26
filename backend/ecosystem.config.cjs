module.exports = {
  apps: [
    {
      name: 'raisoni-backend',
      cwd: '..',
      script: 'backend/server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
