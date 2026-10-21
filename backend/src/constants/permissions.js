export const PERMISSION_ACTION = Object.freeze({
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
});

export const PERMISSION_ACTIONS = Object.freeze(Object.values(PERMISSION_ACTION));

export const PERMISSION_MODULE = Object.freeze({
  DASHBOARD: 'dashboard',
  USERS: 'users',
  CUSTOMERS: 'customers',
  PRODUCTS: 'products',
  ORDERS: 'orders',
  INVENTORY: 'inventory',
  SETTINGS: 'settings',
  LOTS: 'lots',
});

export const PERMISSION_MODULES = Object.freeze(Object.values(PERMISSION_MODULE));

export const PERMISSION_CATALOG = Object.freeze([
  { module: PERMISSION_MODULE.DASHBOARD, label: 'Dashboard', actions: [PERMISSION_ACTION.READ] },
  { module: PERMISSION_MODULE.USERS, label: 'Users', actions: PERMISSION_ACTIONS },
  { module: PERMISSION_MODULE.CUSTOMERS, label: 'Customers', actions: PERMISSION_ACTIONS },
  { module: PERMISSION_MODULE.PRODUCTS, label: 'Products', actions: PERMISSION_ACTIONS },
  { module: PERMISSION_MODULE.ORDERS, label: 'Orders', actions: PERMISSION_ACTIONS },
  { module: PERMISSION_MODULE.INVENTORY, label: 'Inventory', actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE] },
  { module: PERMISSION_MODULE.SETTINGS, label: 'Settings', actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE] },
  { module: PERMISSION_MODULE.LOTS, label: 'Lots', actions: PERMISSION_ACTIONS },
]);
