import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import mongoose from 'mongoose';
import { BSON } from 'mongodb';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

let initialBackupTimer = null;
let recurringBackupTimer = null;
let activeBackup = null;

function safeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function defaultBackupDirectory() {
  return path.resolve(config.dataDir, 'backups');
}

async function verifyArchive(buffer, expectedCollectionCount, expectedDocumentCount) {
  const restored = BSON.EJSON.parse((await gunzip(buffer)).toString('utf8'));
  const collections = restored?.collections || {};
  const collectionCount = Object.keys(collections).length;
  const documentCount = Object.values(collections).reduce(
    (total, collection) => total + (collection.documents?.length || 0),
    0
  );

  if (
    restored?.metadata?.formatVersion !== 1 ||
    collectionCount !== expectedCollectionCount ||
    documentCount !== expectedDocumentCount
  ) {
    throw new Error('Backup verification failed: archive counts do not match the database.');
  }
}

async function pruneExpiredBackups(backupDir, retentionDays) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await fs.readdir(backupDir, { withFileTypes: true });
  const archives = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.ejson.gz')) continue;
    const archivePath = path.join(backupDir, entry.name);
    const stats = await fs.stat(archivePath);
    archives.push({ archivePath, stats });
  }

  archives.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
  for (const archive of archives.slice(1)) {
    if (archive.stats.mtimeMs >= cutoff) continue;
    await fs.rm(archive.archivePath, { force: true });
    await fs.rm(`${archive.archivePath}.sha256`, { force: true });
  }
}

export async function exportDatabaseBackup(options = {}) {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new Error('Database must be connected before a backup can be created.');
  }

  const backupDir = path.resolve(options.backupDir || defaultBackupDirectory());
  const retentionDays = options.retentionDays || config.backupRetentionDays;
  await fs.mkdir(backupDir, { recursive: true });

  const database = mongoose.connection.db;
  const collectionEntries = await database
    .listCollections({}, { nameOnly: true })
    .toArray();
  const collectionNames = collectionEntries
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('system.'))
    .sort();

  const collections = {};
  let totalDocuments = 0;
  for (const name of collectionNames) {
    const collection = database.collection(name);
    const documents = await collection.find({}).toArray();
    const indexes = await collection.indexes();
    collections[name] = { documents, indexes };
    totalDocuments += documents.length;
  }

  const exportedAt = new Date();
  const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-');
  const databaseName = mongoose.connection.name || config.databaseName;
  const filename = `${safeFilePart(databaseName)}_${timestamp}.ejson.gz`;
  const archivePath = path.join(backupDir, filename);
  const temporaryPath = `${archivePath}.${process.pid}.tmp`;
  const payload = {
    metadata: {
      formatVersion: 1,
      exportedAt,
      environment: config.env,
      database: databaseName,
      appVersion: config.appVersion,
      collectionCount: collectionNames.length,
      documentCount: totalDocuments,
    },
    collections,
  };

  try {
    const serialized = BSON.EJSON.stringify(payload, null, 0, { relaxed: false });
    const compressed = await gzip(Buffer.from(serialized, 'utf8'), { level: 9 });
    await verifyArchive(compressed, collectionNames.length, totalDocuments);
    await fs.writeFile(temporaryPath, compressed, { flag: 'wx' });
    await fs.rename(temporaryPath, archivePath);

    const checksum = crypto.createHash('sha256').update(compressed).digest('hex');
    await fs.writeFile(`${archivePath}.sha256`, `${checksum}  ${filename}\n`, 'utf8');
    await pruneExpiredBackups(backupDir, retentionDays);

    logger.success(
      `Database backup verified: ${archivePath} (${collectionNames.length} collections, ${totalDocuments} documents)`
    );
    return {
      archivePath,
      checksum,
      collectionCount: collectionNames.length,
      documentCount: totalDocuments,
    };
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function runScheduledBackup() {
  if (activeBackup) return activeBackup;
  activeBackup = exportDatabaseBackup()
    .catch((error) => {
      logger.error(`Automatic database backup failed: ${error.message}`);
    })
    .finally(() => {
      activeBackup = null;
    });
  return activeBackup;
}

export function startDatabaseBackupScheduler() {
  if (!config.autoBackupEnabled || recurringBackupTimer) return;

  const intervalMs = config.backupIntervalHours * 60 * 60 * 1000;
  initialBackupTimer = setTimeout(runScheduledBackup, 60 * 1000);
  recurringBackupTimer = setInterval(runScheduledBackup, intervalMs);
  initialBackupTimer.unref?.();
  recurringBackupTimer.unref?.();
  logger.info(
    `Automatic database backups enabled every ${config.backupIntervalHours} hours with ${config.backupRetentionDays}-day retention.`
  );
}

export async function stopDatabaseBackupScheduler() {
  if (initialBackupTimer) clearTimeout(initialBackupTimer);
  if (recurringBackupTimer) clearInterval(recurringBackupTimer);
  initialBackupTimer = null;
  recurringBackupTimer = null;
  if (activeBackup) await activeBackup;
}
