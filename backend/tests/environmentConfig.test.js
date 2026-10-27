import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENVIRONMENT_DEFAULTS,
  ENVIRONMENT_NAMES,
  resolveEnvironmentName
} from '../src/config/environments.js';

test('environment defaults use isolated databases and fixed ports', () => {
  assert.deepEqual(ENVIRONMENT_NAMES, [
    'development',
    'staging',
    'production'
  ]);

  assert.deepEqual(
    Object.values(ENVIRONMENT_DEFAULTS).map(({ port }) => port),
    [9090, 7039, 2000]
  );
  assert.equal(
    new Set(Object.values(ENVIRONMENT_DEFAULTS).map(({ port }) => port)).size,
    3
  );
  assert.equal(
    new Set(
      Object.values(ENVIRONMENT_DEFAULTS).map(({ databaseName }) => databaseName)
    ).size,
    3
  );
});

test('environment names are normalized and invalid values fail fast', () => {
  assert.equal(resolveEnvironmentName(' STAGING '), 'staging');
  assert.throws(
    () => resolveEnvironmentName('qa'),
    /Expected one of: development, staging, production/
  );
});
