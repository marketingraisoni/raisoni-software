import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheService } from '../src/services/cacheService.js';
import { getRedisHealth, isRedisConnected } from '../src/config/redis.js';

test('CacheService operates cleanly in fallback mode without Redis', async () => {
  await cacheService.flush();

  // Test set and get
  const key = 'test:item:1';
  const data = { id: 1, name: 'Diamond Lot 100', carats: 5.25 };
  await cacheService.set(key, data, 10);

  const cached = await cacheService.get(key);
  assert.deepEqual(cached, data);

  // Test del
  await cacheService.del(key);
  const afterDel = await cacheService.get(key);
  assert.equal(afterDel, null);
});

test('CacheService wrap helper caches and avoids re-fetching', async () => {
  const key = 'test:wrap:metrics';
  let fetchCount = 0;

  const fetcher = async () => {
    fetchCount++;
    return { count: 42, computedAt: Date.now() };
  };

  // First call should run fetcher
  const res1 = await cacheService.wrap(key, 5, fetcher);
  assert.equal(fetchCount, 1);
  assert.equal(res1.count, 42);

  // Second call should return cached value without running fetcher
  const res2 = await cacheService.wrap(key, 5, fetcher);
  assert.equal(fetchCount, 1);
  assert.equal(res2.computedAt, res1.computedAt);

  await cacheService.del(key);
});

test('CacheService delByPattern removes matching wildcard keys', async () => {
  await cacheService.set('dashboard:metrics:1', { a: 1 }, 10);
  await cacheService.set('dashboard:metrics:2', { b: 2 }, 10);
  await cacheService.set('other:data', { c: 3 }, 10);

  assert.notEqual(await cacheService.get('dashboard:metrics:1'), null);
  assert.notEqual(await cacheService.get('dashboard:metrics:2'), null);
  assert.notEqual(await cacheService.get('other:data'), null);

  await cacheService.delByPattern('dashboard:*');

  assert.equal(await cacheService.get('dashboard:metrics:1'), null);
  assert.equal(await cacheService.get('dashboard:metrics:2'), null);
  assert.notEqual(await cacheService.get('other:data'), null);

  await cacheService.del('other:data');
});

test('CacheService handles TTL expiration properly', async () => {
  const key = 'test:ttl:fast';
  // 1 second TTL
  await cacheService.set(key, { expiredSoon: true }, 1);

  const immediate = await cacheService.get(key);
  assert.equal(immediate?.expiredSoon, true);

  // Wait 1.1s for expiration
  await new Promise((resolve) => setTimeout(resolve, 1100));

  const expired = await cacheService.get(key);
  assert.equal(expired, null);
});

test('getRedisHealth reports structured diagnostics', async () => {
  const health = await getRedisHealth();
  assert.ok(health);
  assert.ok(['ready', 'offline', 'disabled', 'error'].includes(health.status));
  assert.ok(['redis', 'memory_fallback'].includes(health.mode));
  assert.equal(typeof health.connected, 'boolean');
});

