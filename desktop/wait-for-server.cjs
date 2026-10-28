/**
 * Polls the backend health endpoint until it responds, then exits.
 *
 * Usage:
 *   node desktop/wait-for-server.cjs [serverUrl]
 *
 * Defaults to http://localhost:9091 (the Vite dev proxy) when no argument is
 * given — matching the `desktop:dev` workflow where Vite proxies /api/* to the
 * real backend.
 *
 * Exit codes:
 *   0 – server is healthy
 *   1 – timed out after MAX_WAIT_MS
 */

const http = require('http');
const https = require('https');

const serverUrl = process.argv[2] || 'http://localhost:9091';
const healthUrl = `${serverUrl}/api/health`;
const POLL_INTERVAL_MS = 800;
const MAX_WAIT_MS = 120_000; // 2 minutes hard cap

const start = Date.now();

function probe() {
  const elapsed = Date.now() - start;
  if (elapsed >= MAX_WAIT_MS) {
    console.error(`[wait-for-server] Timed out after ${(elapsed / 1000).toFixed(0)}s waiting for ${healthUrl}`);
    process.exit(1);
  }

  const transport = healthUrl.startsWith('https') ? https : http;
  const req = transport.get(healthUrl, { timeout: 3000 }, (res) => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      console.log(`[wait-for-server] Backend ready at ${serverUrl} (${(elapsed / 1000).toFixed(1)}s)`);
      process.exit(0);
    }
    // Non-success status; retry
    res.resume();
    scheduleRetry();
  });

  req.on('error', () => scheduleRetry());
  req.on('timeout', () => {
    req.destroy();
    scheduleRetry();
  });
}

function scheduleRetry() {
  setTimeout(probe, POLL_INTERVAL_MS);
}

console.log(`[wait-for-server] Waiting for ${healthUrl} …`);
probe();

