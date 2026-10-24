import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Customer } from '../src/models/Customer.js';
import { Product } from '../src/models/Product.js';
import { Order } from '../src/models/Order.js';
import { InventoryMovement } from '../src/models/InventoryMovement.js';
import { Setting } from '../src/models/Setting.js';
import { logger } from '../src/utils/logger.js';
import { USER_TYPE, USER_STATUS } from '../src/constants/user.js';
import { getDefaultPermissions } from '../src/services/permissionService.js';

export async function cleanupDummyData() {
  try {
    const [deletedOrders, deletedProducts, deletedCustomers, deletedMovements] = await Promise.all([
      Order.deleteMany({}),
      Product.deleteMany({}),
      Customer.deleteMany({}),
      InventoryMovement.deleteMany({}),
    ]);

    logger.info(
      `Purged dummy seeder data: ${deletedOrders.deletedCount} orders, ${deletedProducts.deletedCount} products, ${deletedCustomers.deletedCount} customers, ${deletedMovements.deletedCount} movements.`
    );
  } catch (err) {
    logger.warn(`Cleanup dummy data skipped: ${err.message}`);
  }
}

export async function seedDatabase(options = { reset: false }) {
  try {
    await connectDB();
    logger.info('Starting database seeding...');

    if (options.reset) {
      logger.warn('Reset flag enabled: cleaning business data, users, and settings...');
      await cleanupDummyData();
      await User.deleteMany({});
      await Setting.deleteMany({});
    }

    // 1. Seed Real Users (Configured Admin, Manager, and Staff accounts)
    const initialUsers = [
      {
        name: 'Raisoni Jauharis',
        username: 'raisonijauharis',
        email: 'raisonijauharis@gmail.com',
        password: 'Raisoni@1999',
        userType: USER_TYPE.SUPER_ADMIN,
        status: USER_STATUS.ACTIVE,
      },
      {
        name: 'Marketing Raisoni',
        username: 'marketing.raisoni',
        email: 'marketing.raisoni@gmail.com',
        password: 'MRaisoni@1999',
        userType: USER_TYPE.MANAGER,
        status: USER_STATUS.ACTIVE,
      },
      {
        name: 'Divyesh Raisoni',
        username: 'divyesh.raisoni',
        email: 'divyesh.raisoni@gmail.com',
        password: 'DRaisoni@1999',
        userType: USER_TYPE.ADMIN,
        status: USER_STATUS.ACTIVE,
      },
      {
        name: 'Accounts Raisoni',
        username: 'accounts.raisoni',
        email: 'accounts.raisoni@gmail.com',
        password: 'ARaisoni@1999',
        userType: USER_TYPE.ADMIN,
        status: USER_STATUS.ACTIVE,
      },
      {
        name: 'Staff Raisoni',
        username: 'staff.raisoni',
        email: 'staff.raisoni@gmail.com',
        password: 'SRaisoni@1999',
        userType: USER_TYPE.STAFF,
        status: USER_STATUS.ACTIVE,
      },
    ];

    const usersMap = {};
    for (const u of initialUsers) {
      const seededUser = {
        ...u,
        permissions: getDefaultPermissions(u.userType),
      };
      let user = await User.findOne({
        $or: [{ email: u.email }, { username: u.username }],
      });
      if (!user) {
        user = await User.create(seededUser);
        logger.info(`Created user: ${u.email} (type ${u.userType})`);
      } else {
        user.name = u.name;
        user.userType = u.userType;
        user.status = USER_STATUS.ACTIVE;
        user.permissions = seededUser.permissions;
        await user.save();
        logger.info(`Updated user permissions: ${u.email} (type ${u.userType})`);
      }
      usersMap[u.userType] = user;
    }

    const adminUser =
      usersMap[USER_TYPE.SUPER_ADMIN] ||
      (await User.findOne({ userType: USER_TYPE.SUPER_ADMIN }));

    // 2. Seed Essential System Settings
    const defaultSettings = [
      {
        key: 'appName',
        value: 'Raisoni ERP',
        category: 'general',
        description: 'Application display name',
      },
      {
        key: 'companyName',
        value: 'Raisoni Jauharis',
        category: 'general',
        description: 'Company legal entity',
      },
      {
        key: 'currencySymbol',
        value: '₹',
        category: 'financial',
        description: 'Default currency symbol',
      },
      {
        key: 'taxRate',
        value: 18,
        category: 'financial',
        description: 'Standard GST / VAT percentage',
      },
      {
        key: 'lowStockThreshold',
        value: 10,
        category: 'inventory',
        description: 'Default low stock warning threshold',
      },
    ];

    for (const s of defaultSettings) {
      await Setting.findOneAndUpdate(
        { key: s.key },
        { ...s, updatedBy: adminUser?._id },
        { upsert: true }
      );
    }
    logger.info('Application settings initialized.');

    logger.success('✅ Database seeding finished successfully (dummy data excluded)!');
    return true;
  } catch (err) {
    logger.error(`Database seeding failed: ${err.message}`);
    throw err;
  } finally {
    if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
      await disconnectDB();
    }
  }
}

// Auto-run if executed from CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const reset = process.argv.includes('--reset');
  seedDatabase({ reset })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
