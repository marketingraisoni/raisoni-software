import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENVIRONMENT_DEFAULTS,
  ENVIRONMENT_NAMES,
  resolveEnvironmentName
} from '../src/config/environments.js';

test('environment defaults use isolated databases and fixed ports', () => {
  assert.deepEqual(ENVIRONMENT_NAMES, ['development', 'production']);

  assert.deepEqual(
    Object.values(ENVIRONMENT_DEFAULTS).map(({ port }) => port),
    [9090, 2000]
  );
  assert.equal(
    new Set(
      Object.values(ENVIRONMENT_DEFAULTS).map(({ databaseName }) => databaseName)
    ).size,
    2
  );
});

test('environment names are normalized and invalid values fail fast', () => {
  assert.equal(resolveEnvironmentName(' PRODUCTION '), 'production');
  assert.throws(
    () => resolveEnvironmentName('staging'),
    /Expected one of: development, production/
  );
});
