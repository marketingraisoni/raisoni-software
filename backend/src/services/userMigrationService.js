import { LEGACY_ROLE_TO_USER_TYPE, USER_TYPE } from '../constants/user.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { getDefaultPermissions } from './permissionService.js';

export async function migrateLegacyUserTypes() {
  const result = await User.collection.updateMany(
    { userType: { $exists: false } },
    [{
      $set: {
        userType: {
          $switch: {
            branches: Object.entries(LEGACY_ROLE_TO_USER_TYPE).map(([role, userType]) => ({
              case: { $eq: ['$role', role] },
              then: userType,
            })),
            default: USER_TYPE.STAFF,
          },
        },
      },
    }]
  );

  await User.collection.updateOne(
    { username: 'raisonijauharis' },
    { $set: { userType: USER_TYPE.SUPER_ADMIN } }
  );

  const usersWithoutPermissions = await User.collection
    .find({ permissions: { $exists: false } }, { projection: { _id: 1, userType: 1 } })
    .toArray();

  if (usersWithoutPermissions.length > 0) {
    await User.collection.bulkWrite(usersWithoutPermissions.map((user) => ({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { permissions: getDefaultPermissions(user.userType) } },
      },
    })));
    logger.info(`Assigned default permissions to ${usersWithoutPermissions.length} user account(s).`);
  }

  if (result.modifiedCount > 0) {
    logger.info(`Migrated ${result.modifiedCount} user account(s) to numeric user types.`);
  }
}
