import test from 'node:test';
import assert from 'node:assert/strict';
import { setRedisClientForTesting, scanKeys } from '../src/config/redis.js';
import { cacheService } from '../src/services/cacheService.js';
import { ResilientStore } from '../src/middleware/rateLimitMiddleware.js';

/**
 * Minimal in-memory stand-in for an ioredis client, reproducing the two behaviours that
 * matter here: keyPrefix is applied to normal key commands but NOT to SCAN patterns/results.
 */
function createFakeRedis(prefix = 'raisoni:test:') {
  const data = new Map();
  const ttls = new Map();
  const glob = (pattern) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  const full = (key) => prefix + key;

  return {
    data,
    status: 'ready',
    options: { keyPrefix: prefix },
    async get(key) { return data.has(full(key)) ? data.get(full(key)) : null; },
    async set(key, value) { data.set(full(key), value); return 'OK'; },
    async del(...keys) {
      let removed = 0;
      for (const key of keys) if (data.delete(full(key))) removed++;
      return removed;
    },
    async scan(_cursor, _match, pattern) {
      // Real Redis matches the raw pattern against full (prefixed) key names.
      return ['0', [...data.keys()].filter((key) => glob(pattern).test(key))];
    },
    async pttl(key) { return ttls.get(full(key)) ?? -2; },
    async decr(key) { data.set(full(key), String(Number(data.get(full(key)) || 0) - 1)); },
    defineCommand(name) {
      this[name] = async (key, windowMs) => {
        const hits = Number(data.get(full(key)) || 0) + 1;
        data.set(full(key), String(hits));
        if (!ttls.has(full(key))) ttls.set(full(key), Number(windowMs));
        return [hits, ttls.get(full(key))];
      };
    },
  };
}

test.afterEach(() => setRedisClientForTesting(null));

test('scanKeys applies the key prefix to SCAN and strips it from results', async () => {
  const fake = createFakeRedis();
  setRedisClientForTesting(fake);
  await fake.set('dashboard:metrics:/api/dashboard', '{}');
  await fake.set('settings:all:/api/settings', '{}');

  assert.deepEqual(await scanKeys('dashboard:*'), ['dashboard:metrics:/api/dashboard']);
});

test('delByPattern really removes prefixed keys from Redis', async () => {
  const fake = createFakeRedis();
  setRedisClientForTesting(fake);

  await cacheService.set('dashboard:metrics:/api/dashboard', { total: 1 }, 30);
  await cacheService.set('settings:all:/api/settings', { a: 1 }, 30);
  assert.equal(fake.data.size, 2);

  await cacheService.delByPattern('dashboard:*');

  assert.equal(await cacheService.get('dashboard:metrics:/api/dashboard'), null);
  assert.deepEqual([...fake.data.keys()], ['raisoni:test:settings:all:/api/settings']);
  await cacheService.flush();
  assert.equal(fake.data.size, 0);
});

test('invalidateChatUsers clears only the given users\' chat caches', async () => {
  const fake = createFakeRedis();
  setRedisClientForTesting(fake);

  await cacheService.set('chat:users:user:aaa:/api/chats/users', [1], 10);
  await cacheService.set('chat:unread:user:aaa:/api/chats/unread-count', 1, 10);
  await cacheService.set('chat:users:user:bbb:/api/chats/users', [2], 10);
  await cacheService.set('chat:users:user:ccc:/api/chats/users', [3], 10);

  await cacheService.invalidateChatUsers('aaa', 'bbb');

  assert.deepEqual([...fake.data.keys()], ['raisoni:test:chat:users:user:ccc:/api/chats/users']);
  await cacheService.flush();
});

test('a corrupted Redis value is treated as a miss instead of throwing', async () => {
  const fake = createFakeRedis();
  setRedisClientForTesting(fake);
  await fake.set('broken', '{not json');

  assert.equal(await cacheService.get('broken'), null);
  assert.equal(fake.data.has('raisoni:test:broken'), false);
});

test('a failing Redis falls back to memory without throwing', async () => {
  const failing = {
    status: 'ready',
    options: { keyPrefix: 'x:' },
    get: async () => { throw new Error('Command timed out'); },
    set: async () => { throw new Error('Command timed out'); },
    del: async () => { throw new Error('Command timed out'); },
    scan: async () => { throw new Error('Command timed out'); },
  };
  setRedisClientForTesting(failing);

  await cacheService.set('k', { v: 1 }, 10);
  assert.deepEqual(await cacheService.get('k'), { v: 1 });
  await cacheService.delByPattern('k*');
  assert.equal(await cacheService.get('k'), null);
});

test('wrap runs one fetch for concurrent callers of the same key', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { value: 7 };
  };

  const results = await Promise.all(Array.from({ length: 5 }, () => cacheService.wrap('wrap:burst', 5, fetcher)));
  assert.equal(calls, 1);
  results.forEach((result) => assert.deepEqual(result, { value: 7 }));
  await cacheService.del('wrap:burst');
});

test('rate-limit store counts atomically in Redis and keeps the window expiry', async () => {
  const fake = createFakeRedis();
  setRedisClientForTesting(fake);
  const store = new ResilientStore('test');
  store.init({ windowMs: 60_000 });

  const first = await store.increment('ip:1');
  const second = await store.increment('ip:1');
  assert.equal(first.totalHits, 1);
  assert.equal(second.totalHits, 2);
  assert.ok(second.resetTime.getTime() > Date.now());
  assert.equal(fake.data.get('raisoni:test:rl:test:ip:1'), '2');

  await store.resetAll();
  assert.equal(fake.data.size, 0);
  store.shutdown();
});

test('rate-limit store uses memory counters while Redis is offline', async () => {
  const store = new ResilientStore('offline');
  store.init({ windowMs: 1000 });
  assert.equal((await store.increment('ip:2')).totalHits, 1);
  assert.equal((await store.increment('ip:2')).totalHits, 2);
  await store.decrement('ip:2');
  assert.equal((await store.get('ip:2')).totalHits, 1);
  await store.resetKey('ip:2');
  assert.equal(await store.get('ip:2'), undefined);
  store.shutdown();
});
