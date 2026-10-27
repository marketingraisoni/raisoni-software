const path = require('path');
const { Arch, Platform, build } = require('electron-builder');
const { bumpProjectPatchVersion } = require('./bump-version.cjs');

// Allows this helper to run through Electron's Node-compatible runtime too.
// Without it, Electron tries to interpret the output app.asar while it is
// still being written by electron-builder.
process.noAsar = true;

const rootDir = path.resolve(__dirname, '..');
const DEFAULT_SERVER_URL = 'http://192.168.1.125:2000';

function parseArguments(argv) {
  const options = { bumpVersion: false, dirOnly: false, serverUrl: process.env.RAISONI_SERVER_URL || DEFAULT_SERVER_URL };

  for (const argument of argv) {
    if (argument === '--bump-version') options.bumpVersion = true;
    else if (argument === '--dir') options.dirOnly = true;
    else if (argument.startsWith('--server=')) options.serverUrl = argument.slice('--server='.length);
    else throw new Error(`Unknown packaging option "${argument}". Expected --bump-version, --dir or --server=<url>.`);
  }

  const url = new URL(options.serverUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Server URL must be http(s): ${options.serverUrl}`);
  }
  options.serverUrl = url.origin;
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  if (options.bumpVersion) {
    bumpProjectPatchVersion(rootDir);
  }

  console.log(`\n=== Building Raisoni ERP desktop client (server: ${options.serverUrl}) ===`);

  const artifacts = await build({
    targets: Platform.WINDOWS.createTarget(options.dirOnly ? ['dir'] : ['nsis'], Arch.x64),
    publish: 'never',
    config: {
      artifactName: `Raisoni-ERP-Setup-${'${version}'}.${'${ext}'}`,
      extraMetadata: {
        serverUrl: options.serverUrl
      }
    }
  });

  console.log('Created artifacts:');
  for (const artifact of artifacts) console.log(`  ${artifact}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
