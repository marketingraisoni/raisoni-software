import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMISSION_ACTION,
  PERMISSION_CATALOG,
  PERMISSION_MODULE,
} from '../src/constants/permissions.js';
import { USER_TYPE } from '../src/constants/user.js';
import {
  getDefaultPermissions,
  normalizePermissions,
} from '../src/services/permissionService.js';

test('permission catalog includes independently assignable workflow modules', () => {
  const catalog = new Map(PERMISSION_CATALOG.map((item) => [item.module, item.actions]));

  assert.deepEqual(catalog.get(PERMISSION_MODULE.PERMISSIONS), [
    PERMISSION_ACTION.READ,
    PERMISSION_ACTION.UPDATE,
  ]);
  assert.deepEqual(catalog.get(PERMISSION_MODULE.ASSORTMENT), [
    PERMISSION_ACTION.READ,
    PERMISSION_ACTION.CREATE,
    PERMISSION_ACTION.UPDATE,
    PERMISSION_ACTION.DELETE,
  ]);
  assert.deepEqual(catalog.get(PERMISSION_MODULE.SEMI_POLISH), [
    PERMISSION_ACTION.READ,
    PERMISSION_ACTION.CREATE,
    PERMISSION_ACTION.UPDATE,
    PERMISSION_ACTION.DELETE,
  ]);
  assert.equal(catalog.has(PERMISSION_MODULE.CUSTOMERS), false);
  assert.equal(catalog.has(PERMISSION_MODULE.PRODUCTS), false);
  assert.equal(catalog.has(PERMISSION_MODULE.ORDERS), false);
  assert.equal(catalog.has(PERMISSION_MODULE.INVENTORY), false);
});

test('default permissions are generated from module definitions', () => {
  const admin = new Map(
    getDefaultPermissions(USER_TYPE.ADMIN).map((grant) => [grant.module, grant.actions]),
  );
  const staff = new Map(
    getDefaultPermissions(USER_TYPE.STAFF).map((grant) => [grant.module, grant.actions]),
  );

  assert.deepEqual(admin.get(PERMISSION_MODULE.PERMISSIONS), [
    PERMISSION_ACTION.READ,
    PERMISSION_ACTION.UPDATE,
  ]);
  assert.deepEqual(staff.get(PERMISSION_MODULE.ASSORTMENT), [
    PERMISSION_ACTION.READ,
    PERMISSION_ACTION.CREATE,
  ]);
  assert.deepEqual(staff.get(PERMISSION_MODULE.SEMI_POLISH), [
    PERMISSION_ACTION.READ,
    PERMISSION_ACTION.CREATE,
  ]);
});

test('permission normalization rejects unsupported module actions', () => {
  assert.deepEqual(
    normalizePermissions([
      {
        module: PERMISSION_MODULE.PERMISSIONS,
        actions: [
          PERMISSION_ACTION.READ,
          PERMISSION_ACTION.CREATE,
          PERMISSION_ACTION.UPDATE,
          PERMISSION_ACTION.DELETE,
        ],
      },
      { module: 'unknown', actions: [PERMISSION_ACTION.READ] },
    ]),
    [
      {
        module: PERMISSION_MODULE.PERMISSIONS,
        actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE],
      },
    ],
  );
});
