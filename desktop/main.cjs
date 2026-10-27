const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let stopBackend = null;
let isStopping = false;
let applicationOrigin = null;

const supportedEnvironments = new Set(['development', 'staging', 'production']);

function getApplicationEnvironment() {
  const requestedEnvironment = app.isPackaged
    ? require(path.join(app.getAppPath(), 'package.json')).buildEnvironment
    : process.env.APP_ENV;
  const environment = String(requestedEnvironment || 'development').toLowerCase();

  if (!supportedEnvironments.has(environment)) {
    throw new Error(`Unsupported desktop environment: ${environment}`);
  }

  return environment;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function inlinePage(title, message) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font:16px/1.5 system-ui,sans-serif}.card{width:min(620px,calc(100% - 48px));padding:32px;border:1px solid #e2e8f0;border-radius:16px;background:white;box-shadow:0 16px 40px #0f172a12}h1{margin:0 0 12px;font-size:24px}p{margin:0;color:#475569;white-space:pre-wrap}</style></head><body><main class="card"><h1>${safeTitle}</h1><p>${safeMessage}</p></main></body></html>`;
  return `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;
}

function getOrCreateDesktopJwtSecret(environment) {
  const configDir = path.join(app.getPath('userData'), 'config');
  const secretPath = path.join(configDir, `${environment}-jwt-secret`);
  fs.mkdirSync(configDir, { recursive: true });

  if (fs.existsSync(secretPath)) {
    const existingSecret = fs.readFileSync(secretPath, 'utf8').trim();
    if (existingSecret.length >= 32) return existingSecret;
  }

  const newSecret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, newSecret, { encoding: 'utf8', mode: 0o600 });
  return newSecret;
}

async function startBundledBackend() {
  const appEnvironment = getApplicationEnvironment();
  const dataDir = path.join(app.getPath('userData'), 'data', appEnvironment);
  const mongoBinary = app.isPackaged
    ? path.join(process.resourcesPath, 'mongodb', 'mongod.exe')
    : path.join(__dirname, '..', 'resources', 'mongodb', 'mongod.exe');

  fs.mkdirSync(dataDir, { recursive: true });

  process.env.APP_ENV = appEnvironment;
  process.env.NODE_ENV = appEnvironment === 'development' ? 'development' : 'production';
  process.env.APP_VERSION = app.getVersion();
  process.env.RAISONI_DATA_DIR = dataDir;
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || getOrCreateDesktopJwtSecret(appEnvironment);
  process.env.MONGOMS_SYSTEM_BINARY = mongoBinary;
  process.env.MONGOMS_SYSTEM_BINARY_VERSION_CHECK = 'false';

  if (!fs.existsSync(mongoBinary)) {
    throw new Error(`The bundled database executable is missing at ${mongoBinary}. Rebuild the installer with npm run dist.`);
  }

  const serverEntry = path.join(__dirname, '..', 'backend', 'server.js');
  const backend = await import(pathToFileURL(serverEntry).href);
  const started = await backend.startServer();
  stopBackend = backend.stopServer;
  applicationOrigin = `http://127.0.0.1:${started.port}`;
  return applicationOrigin;
}

async function createWindow() {
  const iconPath = path.join(__dirname, '..', 'frontend', 'public', 'images', 'logo.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    title: 'Raisoni ERP',
    backgroundColor: '#f8fafc',
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase();
    const isDevToolsShortcut =
      key === 'f12' ||
      ((input.control || input.meta) && input.shift && ['i', 'j', 'c'].includes(key)) ||
      (input.meta && input.alt && ['i', 'j', 'c'].includes(key));

    if (isDevToolsShortcut) event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const allowedDevelopmentUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:9091';
    if (
      !navigationUrl.startsWith(applicationOrigin || allowedDevelopmentUrl) &&
      !navigationUrl.startsWith('data:text/html')
    ) {
      event.preventDefault();
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const isViteDevelopment = !app.isPackaged && Boolean(devServerUrl);

  if (isViteDevelopment) {
    applicationOrigin = devServerUrl;
    await mainWindow.loadURL(devServerUrl);
    return;
  }

  await mainWindow.loadURL(inlinePage('Starting Raisoni ERP', 'Preparing the local database and application…'));
  mainWindow.show();

  try {
    const appUrl = await startBundledBackend();
    await mainWindow.loadURL(appUrl);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error('Desktop startup failed:', error);
    await mainWindow.loadURL(
      inlinePage(
        'Raisoni ERP could not start',
        `${details}\n\nClose the application and run it again. If the problem continues, reinstall the software.`
      )
    );
  }
}

ipcMain.handle('app:version', () => app.getVersion());

app.whenReady().then(createWindow).catch((error) => {
  console.error('Unable to create the desktop window:', error);
  app.quit();
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch(console.error);
  }
});

app.on('before-quit', (event) => {
  if (!stopBackend || isStopping) return;

  event.preventDefault();
  isStopping = true;
  Promise.resolve(stopBackend())
    .catch((error) => console.error('Backend shutdown failed:', error))
    .finally(() => {
      stopBackend = null;
      app.quit();
    });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
