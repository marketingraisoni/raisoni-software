import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheResponse, invalidateCacheMiddleware } from '../src/middleware/cacheMiddleware.js';
import { cacheService } from '../src/services/cacheService.js';

test('cacheResponse middleware emits X-Cache MISS on first call and caches output', async () => {
  await cacheService.flush();

  const middleware = cacheResponse(10, { prefix: 'test-route' });
  const req = {
    method: 'GET',
    originalUrl: '/api/test/metrics',
    query: {},
    headers: {},
  };

  const headers = {};
  let sentBody = null;
  const res = {
    statusCode: 200,
    setHeader(key, value) {
      headers[key] = value;
    },
    json(body) {
      sentBody = body;
      return body;
    },
  };

  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headers['X-Cache'], 'MISS');

  // Simulate controller response
  const payload = { success: true, count: 99 };
  res.json(payload);
  assert.deepEqual(sentBody, payload);

  // Second call with same URL
  const headers2 = {};
  let cachedSent = null;
  const res2 = {
    statusCode: 200,
    setHeader(key, value) {
      headers2[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      cachedSent = body;
      return body;
    },
  };

  let nextCalled2 = false;
  await middleware(req, res2, () => {
    nextCalled2 = true;
  });

  assert.equal(nextCalled2, false); // Next should not be called on cache hit!
  assert.equal(headers2['X-Cache'], 'HIT');
  assert.deepEqual(cachedSent, payload);
});

test('cacheResponse middleware respects ?nocache=1 bypass', async () => {
  const middleware = cacheResponse(10, { prefix: 'test-bypass' });
  const req = {
    method: 'GET',
    originalUrl: '/api/test/metrics?nocache=1',
    query: { nocache: '1' },
    headers: {},
  };

  const headers = {};
  const res = {
    setHeader(key, value) {
      headers[key] = value;
    },
  };

  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headers['X-Cache'], 'BYPASS');
});

test('invalidateCacheMiddleware purges matching keys on successful mutations', async () => {
  await cacheService.set('dashboard:metrics', { data: 123 }, 10);
  assert.notEqual(await cacheService.get('dashboard:metrics'), null);

  const invalidate = invalidateCacheMiddleware('dashboard:*');
  const req = { method: 'POST' };
  let resolveSent;
  const sent = new Promise((resolve) => {
    resolveSent = resolve;
  });
  let cacheEntryWhenSent = 'not-sent';
  const res = {
    statusCode: 201,
    headersSent: false,
    async json(body) {
      cacheEntryWhenSent = await cacheService.get('dashboard:metrics');
      resolveSent(body);
      return body;
    },
  };

  let nextCalled = false;
  invalidate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);

  // Trigger controller completion
  res.json({ success: true });
  await sent;

  // The cache was already purged at the moment the response went out
  assert.equal(cacheEntryWhenSent, null);
});

test('invalidateCacheMiddleware keeps the cache on failed mutations', async () => {
  await cacheService.set('dashboard:metrics', { data: 1 }, 10);
  const invalidate = invalidateCacheMiddleware('dashboard:*');
  const res = { statusCode: 400, json: (body) => body };
  invalidate({ method: 'POST' }, res, () => {});
  res.json({ success: false });
  assert.deepEqual(await cacheService.get('dashboard:metrics'), { data: 1 });
  await cacheService.del('dashboard:metrics');
});

test('cacheResponse personalize adjusts shared cached bodies per request', async () => {
  await cacheService.flush();
  const middleware = cacheResponse(10, {
    prefix: 'test-personal',
    personalize: (body, req) => ({ ...body, viewer: req.ip }),
  });

  const makeRes = (sink) => ({
    statusCode: 200,
    setHeader() {},
    locals: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      sink.body = body;
      return body;
    },
  });

  const first = {};
  const res1 = makeRes(first);
  await middleware({ method: 'GET', originalUrl: '/api/p', query: {}, headers: {}, ip: '10.0.0.1' }, res1, () => {});
  res1.json({ success: true, total: 5 });
  assert.deepEqual(first.body, { success: true, total: 5, viewer: '10.0.0.1' });

  const second = {};
  await middleware({ method: 'GET', originalUrl: '/api/p', query: {}, headers: {}, ip: '10.0.0.2' }, makeRes(second), () => {
    throw new Error('should be served from cache');
  });
  assert.deepEqual(second.body, { success: true, total: 5, viewer: '10.0.0.2' });
});

