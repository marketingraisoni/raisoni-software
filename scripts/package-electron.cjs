const path = require('path');
const { spawnSync } = require('child_process');
const { Arch, Platform, build } = require('electron-builder');
const { bumpProjectPatchVersion } = require('./bump-version.cjs');

// Allows this helper to run through Electron's Node-compatible runtime too.
// Without it, Electron tries to interpret the output app.asar while it is
// still being written by electron-builder.
process.noAsar = true;

const rootDir = path.resolve(__dirname, '..');
const environments = Object.freeze({
  production: {
    appId: 'com.raisoni.erp',
    productName: 'Raisoni ERP',
    artifactLabel: 'Production'
  },
  staging: {
    appId: 'com.raisoni.erp.staging',
    productName: 'Raisoni ERP Staging',
    artifactLabel: 'Staging'
  },
  development: {
    appId: 'com.raisoni.erp.development',
    productName: 'Raisoni ERP Development',
    artifactLabel: 'Development'
  }
});

function runFrontendBuild(environment) {
  const frontendDir = path.join(rootDir, 'frontend');
  const commands = [
    {
      name: 'TypeScript compilation',
      script: path.join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc'),
      arguments: ['-b']
    },
    {
      name: `Vite ${environment} build`,
      script: path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js'),
      arguments: ['build', '--mode', environment]
    }
  ];

  for (const command of commands) {
    const result = spawnSync(process.execPath, [command.script, ...command.arguments], {
      cwd: frontendDir,
      env: {
        ...process.env,
        APP_ENV: environment,
        NODE_ENV: environment === 'development' ? 'development' : 'production'
      },
      stdio: 'inherit'
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${command.name} failed with exit code ${result.status}.`);
    }
  }
}

async function packageEnvironment(environment) {
  const settings = environments[environment];
  console.log(`\n=== Building ${settings.productName} ===`);
  runFrontendBuild(environment);

  const artifacts = await build({
    targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
    publish: 'never',
    config: {
      appId: settings.appId,
      productName: settings.productName,
      artifactName: `Raisoni-ERP-${settings.artifactLabel}-Setup-${'${version}'}.${'${ext}'}`,
      directories: {
        output: `release/${environment}`
      },
      extraMetadata: {
        buildEnvironment: environment
      },
      nsis: {
        shortcutName: settings.productName
      }
    }
  });

  console.log(`Created ${environment} artifacts:`);
  for (const artifact of artifacts) console.log(`  ${artifact}`);
}

async function main() {
  const arguments = process.argv.slice(2);
  const requestedEnvironment = (
    arguments.find((argument) => !argument.startsWith('--')) || 'all'
  ).toLowerCase();
  const selectedEnvironments = requestedEnvironment === 'all'
    ? Object.keys(environments)
    : [requestedEnvironment];
  const supportedFlags = new Set(['--bump-version']);

  for (const argument of arguments.filter((value) => value.startsWith('--'))) {
    if (!supportedFlags.has(argument)) {
      throw new Error(`Unknown packaging option "${argument}".`);
    }
  }

  for (const environment of selectedEnvironments) {
    if (!environments[environment]) {
      throw new Error(
        `Unknown build environment "${environment}". Expected development, staging, production, or all.`
      );
    }
  }

  if (arguments.includes('--bump-version')) {
    bumpProjectPatchVersion(rootDir);
  }

  for (const environment of selectedEnvironments) {
    await packageEnvironment(environment);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
