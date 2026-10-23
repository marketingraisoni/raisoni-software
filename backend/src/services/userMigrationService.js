import { LEGACY_ROLE_TO_USER_TYPE, USER_TYPE } from "../constants/user.js";
import {
  PERMISSION_ACTION,
  PERMISSION_MODULE,
} from "../constants/permissions.js";
import { User } from "../models/User.js";
import { logger } from "../utils/logger.js";
import { getDefaultPermissions } from "./permissionService.js";

export async function migrateLegacyUserTypes() {
  const result = await User.collection.updateMany(
    { userType: { $exists: false } },
    [
      {
        $set: {
          userType: {
            $switch: {
              branches: Object.entries(LEGACY_ROLE_TO_USER_TYPE).map(
                ([role, userType]) => ({
                  case: { $eq: ["$role", role] },
                  then: userType,
                }),
              ),
              default: USER_TYPE.STAFF,
            },
          },
        },
      },
    ],
  );

  await User.collection.updateOne(
    { username: "raisonijauharis" },
    { $set: { userType: USER_TYPE.SUPER_ADMIN } },
  );

  const usersWithoutPermissions = await User.collection
    .find(
      { permissions: { $exists: false } },
      { projection: { _id: 1, userType: 1 } },
    )
    .toArray();

  if (usersWithoutPermissions.length > 0) {
    await User.collection.bulkWrite(
      usersWithoutPermissions.map((user) => ({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: { permissions: getDefaultPermissions(user.userType) },
          },
        },
      })),
    );
    logger.info(
      `Assigned default permissions to ${usersWithoutPermissions.length} user account(s).`,
    );
  }

  const usersWithLegacyPermissionCatalog = await User.collection
    .find(
      {
        permissions: { $exists: true },
        $or: [
          { "permissions.module": { $ne: PERMISSION_MODULE.ASSORTMENT } },
          { "permissions.module": { $ne: PERMISSION_MODULE.SEMI_POLISH } },
          { "permissions.module": { $ne: PERMISSION_MODULE.PERMISSIONS } },
        ],
      },
      { projection: { _id: 1, userType: 1, permissions: 1 } },
    )
    .toArray();

  const permissionMigrations = usersWithLegacyPermissionCatalog.flatMap(
    (user) => {
      const current = Array.isArray(user.permissions)
        ? [...user.permissions]
        : [];
      const originalPermissionCount = current.length;
      const existingModules = new Set(
        current.map((permission) => permission.module),
      );
      const isAdministrator = [USER_TYPE.SUPER_ADMIN, USER_TYPE.ADMIN].includes(
        user.userType,
      );
      const defaults = getDefaultPermissions(user.userType);
      const legacyLots =
        current.find(
          (permission) => permission.module === PERMISSION_MODULE.LOTS,
        )?.actions || [];
      const legacyUsers =
        current.find(
          (permission) => permission.module === PERMISSION_MODULE.USERS,
        )?.actions || [];

      const addGrant = (module, actions) => {
        if (!existingModules.has(module) && actions.length) {
          current.push({ module, actions: [...new Set(actions)] });
          existingModules.add(module);
        }
      };
      const defaultActions = (module) =>
        defaults.find((permission) => permission.module === module)?.actions ||
        [];

      addGrant(
        PERMISSION_MODULE.ASSORTMENT,
        isAdministrator
          ? defaultActions(PERMISSION_MODULE.ASSORTMENT)
          : legacyLots,
      );
      addGrant(
        PERMISSION_MODULE.SEMI_POLISH,
        isAdministrator
          ? defaultActions(PERMISSION_MODULE.SEMI_POLISH)
          : legacyLots,
      );
      addGrant(
        PERMISSION_MODULE.PERMISSIONS,
        isAdministrator
          ? defaultActions(PERMISSION_MODULE.PERMISSIONS)
          : legacyUsers.filter((action) =>
              [PERMISSION_ACTION.READ, PERMISSION_ACTION.UPDATE].includes(
                action,
              ),
            ),
      );

      if (current.length === originalPermissionCount) return [];
      return [
        {
          updateOne: {
            filter: { _id: user._id },
            update: { $set: { permissions: current } },
          },
        },
      ];
    },
  );

  if (permissionMigrations.length > 0) {
    await User.collection.bulkWrite(permissionMigrations);
    logger.info(
      `Added new module permissions to ${permissionMigrations.length} user account(s).`,
    );
  }

  if (result.modifiedCount > 0) {
    logger.info(
      `Migrated ${result.modifiedCount} user account(s) to numeric user types.`,
    );
  }
}
