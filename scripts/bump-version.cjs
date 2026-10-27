const fs = require('fs');
const path = require('path');

function getNextPatchVersion(currentVersion) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(currentVersion));
  if (!match) {
    throw new Error(
      `Cannot automatically increment version "${currentVersion}". Expected MAJOR.MINOR.PATCH.`
    );
  }

  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function updateEnvironmentVersion(filePath, version) {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, 'utf8');
  const versionLine = `APP_VERSION=${version}`;
  const updatedContents = /^APP_VERSION=.*$/m.test(contents)
    ? contents.replace(/^APP_VERSION=.*$/m, versionLine)
    : `${contents.trimEnd()}\n${versionLine}\n`;

  fs.writeFileSync(filePath, updatedContents, 'utf8');
}

function bumpProjectPatchVersion(rootDir = path.resolve(__dirname, '..')) {
  const packagePath = path.join(rootDir, 'package.json');
  const lockPath = path.join(rootDir, 'package-lock.json');
  const packageMetadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const previousVersion = packageMetadata.version;
  const nextVersion = getNextPatchVersion(previousVersion);

  packageMetadata.version = nextVersion;
  writeJson(packagePath, packageMetadata);

  if (fs.existsSync(lockPath)) {
    const lockMetadata = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lockMetadata.version = nextVersion;
    if (lockMetadata.packages?.['']) {
      lockMetadata.packages[''].version = nextVersion;
    }
    writeJson(lockPath, lockMetadata);
  }

  updateEnvironmentVersion(path.join(rootDir, '.env'), nextVersion);
  process.env.APP_VERSION = nextVersion;
  console.log(`Release version incremented: ${previousVersion} -> ${nextVersion}`);
  return nextVersion;
}

if (require.main === module) {
  bumpProjectPatchVersion();
}

module.exports = {
  bumpProjectPatchVersion,
  getNextPatchVersion
};
