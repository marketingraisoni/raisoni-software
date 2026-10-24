const { Arch, Platform, build } = require('electron-builder');

// Allows this helper to run through Electron's Node-compatible runtime too.
// Without it, Electron tries to interpret the output app.asar while it is
// still being written by electron-builder.
process.noAsar = true;

build({
  targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
  publish: 'never'
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
