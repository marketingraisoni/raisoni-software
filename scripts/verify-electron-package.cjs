const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');

process.noAsar = true;

const rootDir = path.resolve(__dirname, '..');
const expectedVersion = require(path.join(rootDir, 'package.json')).version;
const archivePath = path.join(rootDir, 'release', 'win-unpacked', 'resources', 'app.asar');

const requiredArchiveEntries = ['/desktop/main.cjs', '/desktop/preload.cjs', '/package.json'];
// The desktop app is a thin client; anything below means the server code leaked into the installer.
const forbiddenArchivePrefixes = ['/backend/', '/frontend/', '/node_modules/'];

if (!fs.existsSync(archivePath)) {
  throw new Error(`Packaged application archive not found: ${archivePath}. Run "npm run pack" first.`);
}

const archiveEntries = asar
  .listPackage(archivePath)
  .map((entry) => `/${entry.replaceAll('\\', '/').replace(/^\/+/, '')}`);
const entrySet = new Set(archiveEntries);

const missingEntries = requiredArchiveEntries.filter((entry) => !entrySet.has(entry));
if (missingEntries.length > 0) {
  throw new Error(`Packaged application is missing:\n${missingEntries.join('\n')}`);
}

const leakedEntries = archiveEntries.filter((entry) =>
  forbiddenArchivePrefixes.some((prefix) => entry.startsWith(prefix))
);
if (leakedEntries.length > 0) {
  throw new Error(`Packaged application should not contain:\n${leakedEntries.slice(0, 20).join('\n')}`);
}

const packagedMetadata = JSON.parse(asar.extractFile(archivePath, 'package.json').toString('utf8'));
if (!packagedMetadata.serverUrl) {
  throw new Error('Packaged package.json has no serverUrl.');
}
if (packagedMetadata.version !== expectedVersion) {
  throw new Error(
    `Packaged version is "${packagedMetadata.version}"; expected "${expectedVersion}".`
  );
}

console.log(
  `Electron package v${expectedVersion} verification passed (server: ${packagedMetadata.serverUrl}).`
);
