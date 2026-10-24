const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const downloadDir = path.join(rootDir, 'resources', 'mongodb');
const packagedBinary = path.join(downloadDir, 'mongod.exe');

async function main() {
  if (fs.existsSync(packagedBinary)) {
    console.log(`Bundled MongoDB already exists: ${packagedBinary}`);
    return;
  }

  fs.mkdirSync(downloadDir, { recursive: true });
  process.env.MONGOMS_DOWNLOAD_DIR = downloadDir;

  const { MongoBinary } = require('mongodb-memory-server-core');
  const downloadedBinary = await MongoBinary.getPath({ downloadDir });

  if (!fs.existsSync(downloadedBinary)) {
    throw new Error(`MongoDB download completed without a binary at ${downloadedBinary}`);
  }

  fs.copyFileSync(downloadedBinary, packagedBinary);
  console.log(`MongoDB prepared for Electron packaging: ${packagedBinary}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
