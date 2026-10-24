export const PERMISSION_ACTION = Object.freeze({
  READ: "read",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
});

export const PERMISSION_ACTIONS = Object.freeze(
  Object.values(PERMISSION_ACTION),
);

const ALL_ACTIONS = PERMISSION_ACTIONS;
const READ_ONLY = Object.freeze([PERMISSION_ACTION.READ]);
const READ_UPDATE = Object.freeze([
  PERMISSION_ACTION.READ,
  PERMISSION_ACTION.UPDATE,
]);

const moduleDefinitions = {
  DASHBOARD: {
    module: "dashboard",
    label: "Dashboard",
    actions: READ_ONLY,
    defaults: { manager: READ_ONLY, staff: READ_ONLY },
  },
  USERS: {
    module: "users",
    label: "User Management",
    actions: ALL_ACTIONS,
    defaults: {},
  },
  PERMISSIONS: {
    module: "permissions",
    label: "Permission Management",
    actions: READ_UPDATE,
    defaults: {},
  },
  CUSTOMERS: {
    module: "customers",
    label: "Customers",
    actions: ALL_ACTIONS,
    defaults: {
      manager: ALL_ACTIONS,
      staff: [
        PERMISSION_ACTION.READ,
        PERMISSION_ACTION.CREATE,
        PERMISSION_ACTION.UPDATE,
      ],
    },
  },
  PRODUCTS: {
    module: "products",
    label: "Products",
    actions: ALL_ACTIONS,
    defaults: {
      manager: [
        PERMISSION_ACTION.READ,
        PERMISSION_ACTION.CREATE,
        PERMISSION_ACTION.UPDATE,
      ],
      staff: READ_ONLY,
    },
  },
  ORDERS: {
    module: "orders",
    label: "Orders",
    actions: ALL_ACTIONS,
    defaults: {
      manager: ALL_ACTIONS,
      staff: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE],
    },
  },
  INVENTORY: {
    module: "inventory",
    label: "Inventory",
    actions: READ_UPDATE,
    defaults: { manager: READ_UPDATE, staff: READ_ONLY },
  },
  SETTINGS: {
    module: "settings",
    label: "Settings",
    actions: READ_UPDATE,
    defaults: { manager: READ_ONLY },
  },
  LOTS: {
    module: "lots",
    label: "Lot Management",
    actions: ALL_ACTIONS,
    defaults: {
      manager: [
        PERMISSION_ACTION.READ,
        PERMISSION_ACTION.CREATE,
        PERMISSION_ACTION.UPDATE,
      ],
      staff: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE],
    },
  },
  ASSORTMENT: {
    module: "assortment",
    label: "Assortment / Packet Creation",
    actions: ALL_ACTIONS,
    defaults: {
      manager: [
        PERMISSION_ACTION.READ,
        PERMISSION_ACTION.CREATE,
        PERMISSION_ACTION.UPDATE,
      ],
      staff: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE],
    },
  },
  SEMI_POLISH: {
    module: "semi_polish",
    label: "4P Semi-Polish",
    actions: ALL_ACTIONS,
    defaults: {
      manager: [
        PERMISSION_ACTION.READ,
        PERMISSION_ACTION.CREATE,
        PERMISSION_ACTION.UPDATE,
      ],
      staff: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE],
    },
  },
  CHAT: {
    module: "chat",
    label: "Chat",
    actions: Object.freeze([
      PERMISSION_ACTION.READ,
      PERMISSION_ACTION.CREATE,
    ]),
    defaults: Object.freeze({
      manager: Object.freeze([
        PERMISSION_ACTION.READ,
        PERMISSION_ACTION.CREATE,
      ]),
      staff: Object.freeze([
        PERMISSION_ACTION.READ,
        PERMISSION_ACTION.CREATE,
      ]),
    }),
  },
};

export const PERMISSION_MODULE_DEFINITIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(moduleDefinitions).map(([key, definition]) => [
      key,
      Object.freeze({
        ...definition,
        actions: Object.freeze([...definition.actions]),
        defaults: Object.freeze(definition.defaults),
      }),
    ]),
  ),
);

export const PERMISSION_MODULE = Object.freeze(
  Object.fromEntries(
    Object.entries(PERMISSION_MODULE_DEFINITIONS).map(([key, definition]) => [
      key,
      definition.module,
    ]),
  ),
);

export const PERMISSION_MODULES = Object.freeze(
  Object.values(PERMISSION_MODULE),
);

export const MANAGEABLE_PERMISSION_MODULES = Object.freeze([
  PERMISSION_MODULE.DASHBOARD,
  PERMISSION_MODULE.USERS,
  PERMISSION_MODULE.PERMISSIONS,
  PERMISSION_MODULE.SETTINGS,
  PERMISSION_MODULE.LOTS,
  PERMISSION_MODULE.ASSORTMENT,
  PERMISSION_MODULE.SEMI_POLISH,
  PERMISSION_MODULE.CHAT,
]);

export const PERMISSION_CATALOG = Object.freeze(
  Object.values(PERMISSION_MODULE_DEFINITIONS)
    .filter(({ module }) => MANAGEABLE_PERMISSION_MODULES.includes(module))
    .map(({ module, label, actions }) => ({ module, label, actions })),
);
