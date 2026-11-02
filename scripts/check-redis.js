import { config } from '../backend/src/config/env.js';
import { getRedisHealth, initRedis, disconnectRedis } from '../backend/src/config/redis.js';

console.log('====================================================');
console.log(' Raisoni ERP - Redis Diagnostics & Diagnostics Tool');
console.log('====================================================');
console.log(` Target Host: ${config.redisHost}`);
console.log(` Target Port: ${config.redisPort}`);
console.log(` Key Prefix:  "${config.redisKeyPrefix}"`);
console.log(` Enabled:     ${config.redisEnabled ? 'Yes' : 'No'}`);
console.log('----------------------------------------------------');

async function run() {
  try {
    await initRedis();
    const health = await getRedisHealth();

    if (health.connected) {
      console.log(' ✅ Redis Connection: CONNECTED');
      console.log(` 🚀 Version:          ${health.version}`);
      console.log(` ⚡ Ping Latency:     ${health.pingMs} ms`);
      console.log(` 💾 Memory Used:      ${health.usedMemory}`);
      console.log(` 🎯 Operating Mode:   ${health.mode}`);
      console.log('\nBackend caching and rate limiting are operating at peak Redis speed!');
    } else {
      console.log(' ⚠️ Redis Connection: OFFLINE');
      console.log(` 🛡️ Operating Mode:   ${health.mode}`);
      console.log(` ℹ️ Status Message:   ${health.message}`);
      console.log('\nOptions to start Redis on Windows:');
      console.log(' 1. Native Windows Service (Recommended):');
      console.log('    winget install Redis.Redis');
      console.log('    net start redis');
      console.log('\n 2. Memurai Developer (Redis 7 compatible for Windows):');
      console.log('    winget install Memurai.MemuraiDeveloper');
      console.log('\n 3. Docker:');
      console.log('    docker run -d -p 6379:6379 --name raisoni-redis redis:alpine');
      console.log('\nNote: The backend is resilient. Even without Redis, requests are cached');
      console.log('safely in high-performance application memory without crashing.');
    }
  } catch (err) {
    console.error('Diagnostic error:', err.message);
  } finally {
    await disconnectRedis();
    console.log('====================================================');
    process.exit(0);
  }
}

run();

