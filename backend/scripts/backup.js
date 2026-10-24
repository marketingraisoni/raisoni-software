import { connectDB, disconnectDB } from '../src/config/db.js';
import {
  exportDatabaseBackup as exportConnectedDatabaseBackup,
} from '../src/services/databaseBackupService.js';
import { logger } from '../src/utils/logger.js';

export async function exportDatabaseBackup(customDest) {
  try {
    await connectDB();
    logger.info('Creating a complete, verified database backup...');
    return await exportConnectedDatabaseBackup({
      ...(customDest ? { backupDir: customDest } : {}),
    });
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
