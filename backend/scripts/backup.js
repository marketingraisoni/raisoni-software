import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Customer } from '../src/models/Customer.js';
import { Product } from '../src/models/Product.js';
import { Order } from '../src/models/Order.js';
import { InventoryMovement } from '../src/models/InventoryMovement.js';
import { User } from '../src/models/User.js';
import { Setting } from '../src/models/Setting.js';
import { logger } from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function exportDatabaseBackup(customDest) {
  try {
    await connectDB();
    const backupDir = customDest || path.resolve(__dirname, '../../data/backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `raisoni_backup_${timestamp}.json`;
    const destPath = path.join(backupDir, filename);

    logger.info('Extracting MongoDB collections for backup snapshot...');

    const collections = {
      meta: {
        exportedAt: new Date().toISOString(),
        appName: 'Raisoni Software Demo',
        version: '1.0.0'
      },
      users: await User.find().select('-password').lean(),
      customers: await Customer.find().lean(),
      products: await Product.find().lean(),
      orders: await Order.find().lean(),
      inventoryMovements: await InventoryMovement.find().lean(),
      settings: await Setting.find().lean()
    };

    fs.writeFileSync(destPath, JSON.stringify(collections, null, 2), 'utf8');
    const stats = fs.statSync(destPath);
    logger.success(`Backup archive written successfully to: ${destPath} (${Math.round(stats.size / 1024)} KB)`);
    return destPath;
  } catch (err) {
    logger.error(`Backup failed: ${err.message}`);
    throw err;
  } finally {
    if (process.argv[1] && process.argv[1].endsWith('backup.js')) {
      await disconnectDB();
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('backup.js')) {
  exportDatabaseBackup()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
