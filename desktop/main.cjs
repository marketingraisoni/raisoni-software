const { app, BrowserWindow, Menu, shell, ipcMain, net } = require('electron');
const path = require('path');
const fs = require('fs');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// The desktop app is a thin client: all data lives on the LAN server, which serves
// both the UI and the API. Nothing (backend, database, UI build) is bundled here.
const DEFAULT_SERVER_URL = 'http://192.168.1.125:2000';
const HEALTH_TIMEOUT_MS = 4000;
const RETRY_DELAY_MS = 5000;

let mainWindow = null;
let serverUrl = null;
let retryTimer = null;
let isConnecting = false;

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

function getUserConfigPath() {
  return path.join(app.getPath('userData'), 'server.json');
}

function normalizeServerUrl(value) {
  const url = new URL(String(value).trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported protocol ${url.protocol}`);
  }
  return url.origin;
}

function readUserServerUrl() {
  try {
    return JSON.parse(fs.readFileSync(getUserConfigPath(), 'utf8')).serverUrl;
  } catch {
    return undefined;
  }
}

function readPackagedServerUrl() {
  try {
    return require(path.join(app.getAppPath(), 'package.json')).serverUrl;
  } catch {
    return undefined;
  }
}

// Precedence: RAISONI_SERVER_URL env > %APPDATA%\<app>\server.json > URL baked in at build > default.
function resolveServerUrl() {
  const candidates = [
    process.env.RAISONI_SERVER_URL,
    readUserServerUrl(),
    readPackagedServerUrl(),
    DEFAULT_SERVER_URL
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return normalizeServerUrl(candidate);
    } catch {
      console.warn(`Ignoring invalid server URL: ${candidate}`);
    }
  }
  return DEFAULT_SERVER_URL;
}

async function isServerReachable() {
  try {
    const response = await net.fetch(`${serverUrl}/api/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      cache: 'no-store'
    });
    return response.ok;
  } catch {
    return false;
  }
}

function scheduleReconnect() {
  if (retryTimer || !mainWindow) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connectToServer().catch(console.error);
  }, RETRY_DELAY_MS);
}

async function showOfflinePage() {
  if (!mainWindow) return;
  await mainWindow.loadURL(
    inlinePage(
      'Waiting for the Raisoni ERP server',
      `Cannot reach the server at ${serverUrl}.\n\n` +
        'Check that this PC is connected to the office network and that the server PC is switched on. ' +
        `This screen retries automatically every ${RETRY_DELAY_MS / 1000} seconds.\n\n` +
        `To use a different server address, create ${getUserConfigPath()} containing:\n` +
        '{ "serverUrl": "http://<server-ip>:2000" }'
    )
  );
}

async function connectToServer() {
  if (!mainWindow || isConnecting) return;
  isConnecting = true;
  try {
    if (await isServerReachable()) {
      await mainWindow.loadURL(serverUrl);
      return;
    }
    await showOfflinePage();
    scheduleReconnect();
  } catch (error) {
    console.error('Unable to load the server UI:', error);
    await showOfflinePage().catch(() => {});
    scheduleReconnect();
  } finally {
    isConnecting = false;
  }
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
      devTools: !app.isPackaged
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

    if (isDevToolsShortcut && app.isPackaged) event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!navigationUrl.startsWith(serverUrl) && !navigationUrl.startsWith('data:text/html')) {
      event.preventDefault();
    }
  });

  // Server went away (reboot, network drop) while the user reloads or navigates.
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _description, validatedUrl, isMainFrame) => {
    const isAborted = errorCode === -3;
    if (isConnecting || !isMainFrame || isAborted || !validatedUrl.startsWith(serverUrl)) return;
    showOfflinePage().catch(() => {});
    scheduleReconnect();
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    clearTimeout(retryTimer);
    retryTimer = null;
    mainWindow = null;
  });

  serverUrl = resolveServerUrl();
  await mainWindow.loadURL(inlinePage('Starting Raisoni ERP', `Connecting to ${serverUrl}…`));
  mainWindow.show();
  await connectToServer();
}

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:server-url', () => serverUrl);

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
