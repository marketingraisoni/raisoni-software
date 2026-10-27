const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');

process.noAsar = true;

const rootDir = path.resolve(__dirname, '..');
const expectedVersion = require(path.join(rootDir, 'package.json')).version;
const environment = (process.argv[2] || 'production').toLowerCase();
const supportedEnvironments = new Set(['development', 'staging', 'production']);

if (!supportedEnvironments.has(environment)) {
  throw new Error(`Unknown environment "${environment}".`);
}

const unpackedDir = path.join(rootDir, 'release', environment, 'win-unpacked');
const archivePath = path.join(unpackedDir, 'resources', 'app.asar');
const mongoPath = path.join(unpackedDir, 'resources', 'mongodb', 'mongod.exe');

const requiredArchiveEntries = [
  '/desktop/main.cjs',
  '/desktop/preload.cjs',
  '/backend/server.js',
  '/backend/src/config/environments.js',
  '/frontend/dist/index.html',
  '/node_modules/express/package.json',
  '/node_modules/mongoose/package.json',
  '/node_modules/mongodb-memory-server/package.json',
  '/node_modules/socket.io/package.json'
];

if (!fs.existsSync(archivePath)) {
  throw new Error(`Packaged application archive not found: ${archivePath}`);
}

const listedEntries = asar.listPackage(archivePath);
const archiveEntries = new Set(
  listedEntries.map((entry) => `/${entry.replaceAll('\\', '/').replace(/^\/+/, '')}`)
);
const missingEntries = requiredArchiveEntries.filter((entry) => !archiveEntries.has(entry));

if (missingEntries.length > 0) {
  throw new Error(`Packaged application is missing:\n${missingEntries.join('\n')}`);
}

const packagedMetadata = JSON.parse(asar.extractFile(archivePath, 'package.json').toString('utf8'));
if (packagedMetadata.buildEnvironment !== environment) {
  throw new Error(
    `Packaged environment is "${packagedMetadata.buildEnvironment}"; expected "${environment}".`
  );
}
if (packagedMetadata.version !== expectedVersion) {
  throw new Error(
    `Packaged version is "${packagedMetadata.version}"; expected "${expectedVersion}".`
  );
}

if (!fs.existsSync(mongoPath) || fs.statSync(mongoPath).size < 10 * 1024 * 1024) {
  throw new Error(`Bundled MongoDB executable is missing or invalid: ${mongoPath}`);
}

console.log(`Electron ${environment} package v${expectedVersion} verification passed.`);
