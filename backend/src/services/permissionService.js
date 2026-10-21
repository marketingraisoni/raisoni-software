import {
  PERMISSION_ACTION,
  PERMISSION_ACTIONS,
  PERMISSION_CATALOG,
  PERMISSION_MODULE,
  PERMISSION_MODULES,
} from '../constants/permissions.js';
import { USER_TYPE } from '../constants/user.js';

const fullPermissions = () => PERMISSION_CATALOG.map(({ module, actions }) => ({
  module,
  actions: [...actions],
}));

export function getDefaultPermissions(userType) {
  if ([USER_TYPE.SUPER_ADMIN, USER_TYPE.ADMIN].includes(userType)) {
    return fullPermissions();
  }

  if (userType === USER_TYPE.MANAGER) {
    return [
      { module: PERMISSION_MODULE.DASHBOARD, actions: [PERMISSION_ACTION.READ] },
      { module: PERMISSION_MODULE.CUSTOMERS, actions: [...PERMISSION_ACTIONS] },
      { module: PERMISSION_MODULE.PRODUCTS, actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE, PERMISSION_ACTION.UPDATE] },
      { module: PERMISSION_MODULE.ORDERS, actions: [...PERMISSION_ACTIONS] },
      { module: PERMISSION_MODULE.INVENTORY, actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE] },
      { module: PERMISSION_MODULE.SETTINGS, actions: [PERMISSION_ACTION.READ] },
      { module: PERMISSION_MODULE.LOTS, actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE, PERMISSION_ACTION.UPDATE] },
    ];
  }

  return [
    { module: PERMISSION_MODULE.DASHBOARD, actions: [PERMISSION_ACTION.READ] },
    { module: PERMISSION_MODULE.CUSTOMERS, actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE, PERMISSION_ACTION.UPDATE] },
    { module: PERMISSION_MODULE.PRODUCTS, actions: [PERMISSION_ACTION.READ] },
    { module: PERMISSION_MODULE.ORDERS, actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE] },
    { module: PERMISSION_MODULE.INVENTORY, actions: [PERMISSION_ACTION.READ] },
    { module: PERMISSION_MODULE.LOTS, actions: [PERMISSION_ACTION.READ, PERMISSION_ACTION.CREATE] },
  ];
}

export function normalizePermissions(permissions = []) {
  const permissionMap = new Map();

  for (const permission of permissions) {
    if (!PERMISSION_MODULES.includes(permission.module)) continue;
    const catalogEntry = PERMISSION_CATALOG.find(({ module }) => module === permission.module);
    const allowedActions = new Set(catalogEntry?.actions || []);
    const actions = [...new Set(permission.actions || [])]
      .filter((action) => allowedActions.has(action));
    if (actions.length > 0) permissionMap.set(permission.module, actions);
  }

  return [...permissionMap].map(([module, actions]) => ({ module, actions }));
}

export function hasPermission(user, module, action) {
  if (user?.userType === USER_TYPE.SUPER_ADMIN) return true;
  const permission = user?.permissions?.find((item) => item.module === module);
  return Boolean(permission?.actions?.includes(action));
}

export function canGrantPermissions(actor, requestedPermissions) {
  if (actor.userType === USER_TYPE.SUPER_ADMIN) return true;
  return normalizePermissions(requestedPermissions).every(({ module, actions }) =>
    actions.every((action) => hasPermission(actor, module, action))
  );
}
