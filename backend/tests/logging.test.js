import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { logger } from '../src/utils/logger.js';
import { getCrashContext } from '../src/utils/requestContext.js';
import { requestLogger } from '../src/middleware/requestLogger.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

function captureConsole(run) {
  const lines = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (line) => lines.push(String(line));
  try {
    run();
  } finally {
    Object.assign(console, original);
  }
  return lines;
}

async function withServer(app, run) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('logger redacts secrets and expands errors in metadata', () => {
  const lines = captureConsole(() => {
    logger.warn('login attempt', { username: 'admin', password: 'hunter2', headers: { authorization: 'Bearer abc' } });
    logger.error('boom', { error: new Error('database down') });
  });

  assert.match(lines[0], /\[WARN\]/);
  assert.match(lines[0], /"password":"\[REDACTED\]"/);
  assert.match(lines[0], /"authorization":"\[REDACTED\]"/);
  assert.doesNotMatch(lines[0], /hunter2|Bearer abc/);
  assert.match(lines[1], /database down/);
  assert.match(lines[1], /at .*logging\.test\.js/); // stack trace printed
});

test('logger never throws on circular or odd metadata', () => {
  const circular = { name: 'loop' };
  circular.self = circular;
  captureConsole(() => {
    assert.doesNotThrow(() => logger.info('circular', circular));
    assert.doesNotThrow(() => logger.info('bigint', { value: 10n }));
    assert.doesNotThrow(() => logger.info('primitive meta', 'just text'));
  });
});

test('every request gets an X-Request-Id and errors return it to the client', async () => {
  const app = express();
  app.use(requestLogger);
  app.get('/api/ok', (_req, res) => res.json({ ok: true }));
  app.get('/api/fail', () => {
    throw new Error('unexpected failure');
  });
  app.use(errorHandler);

  await withServer(app, async (baseUrl) => {
    const ok = await fetch(`${baseUrl}/api/ok`);
    assert.match(ok.headers.get('x-request-id'), /^[a-f0-9]{12}$/);

    const reused = await fetch(`${baseUrl}/api/ok`, { headers: { 'X-Request-Id': 'client-supplied-123' } });
    assert.equal(reused.headers.get('x-request-id'), 'client-supplied-123');

    const failed = await fetch(`${baseUrl}/api/fail`);
    const body = await failed.json();
    assert.equal(failed.status, 500);
    assert.equal(body.requestId, failed.headers.get('x-request-id'));
    assert.doesNotMatch(JSON.stringify(body), /unexpected failure/); // internals not leaked
  });

  const { lastRequests } = getCrashContext();
  const failedEntry = lastRequests.find((entry) => entry.url === '/api/fail');
  assert.equal(failedEntry.status, 500);
});

test('malformed JSON bodies return 400 instead of 500', async () => {
  const app = express();
  app.use(requestLogger);
  app.use(express.json());
  app.post('/api/echo', (req, res) => res.json(req.body));
  app.use(errorHandler);

  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"broken": ',
    });
    assert.equal(res.status, 400);
  });
});
