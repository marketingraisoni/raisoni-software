import {
  PERMISSION_MODULE_DEFINITIONS,
  PERMISSION_MODULES,
} from "../constants/permissions.js";
import { USER_TYPE } from "../constants/user.js";

const fullPermissions = () =>
  Object.values(PERMISSION_MODULE_DEFINITIONS).map(
    ({ module, actions }) => ({
      module,
      actions: [...actions],
    }),
  );

export function getDefaultPermissions(userType) {
  if ([USER_TYPE.SUPER_ADMIN, USER_TYPE.ADMIN].includes(userType)) {
    return fullPermissions();
  }

  const profile = userType === USER_TYPE.MANAGER ? "manager" : "staff";
  return Object.values(PERMISSION_MODULE_DEFINITIONS)
    .map(({ module, defaults }) => ({
      module,
      actions: [...(defaults[profile] || [])],
    }))
    .filter(({ actions }) => actions.length > 0);
}

export function normalizePermissions(permissions = []) {
  const permissionMap = new Map();

  for (const permission of permissions) {
    if (!PERMISSION_MODULES.includes(permission.module)) continue;
    const moduleDefinition = Object.values(PERMISSION_MODULE_DEFINITIONS).find(
      ({ module }) => module === permission.module,
    );
    const allowedActions = new Set(moduleDefinition?.actions || []);
    const actions = [...new Set(permission.actions || [])].filter((action) =>
      allowedActions.has(action),
    );
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
  return normalizePermissions(requestedPermissions).every(
    ({ module, actions }) =>
      actions.every((action) => hasPermission(actor, module, action)),
  );
}
