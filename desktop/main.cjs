const { app, BrowserWindow, Menu, shell, ipcMain, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dgram = require('dgram');

// Same settings folder whether installed or started with "npm run desktop".
app.setPath('userData', path.join(app.getPath('appData'), 'Raisoni ERP'));

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// The desktop app is a thin client: all data lives on the LAN server, which serves
// both the UI and the API. Nothing (backend, database, UI build) is bundled here.
const DEFAULT_SERVER_URL = 'http://192.168.1.125:2000';
const HEALTH_TIMEOUT_MS = 4000;
const RETRY_DELAY_MS = 1000;
// Must match backend/src/services/discoveryService.js.
const DISCOVERY_PORT = 47800;
const DISCOVERY_REQUEST = 'RAISONI_ERP_DISCOVER_V1';
const DISCOVERY_SERVICE = 'raisoni-erp';
const DISCOVERY_TIMEOUT_MS = 2000;
// "Retry now" link on the waiting screen; intercepted in will-navigate, never actually loaded.
const ACTION_RETRY = 'raisoni-action://retry';

let mainWindow = null;
let serverUrl = null;
let isServerUrlForced = false;
let retryTimer = null;
let isConnecting = false;
let connectionController = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function inlinePage(title, message, actions = []) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const buttons = actions
    .map(({ href, label }) => `<a class="button" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font:16px/1.5 system-ui,sans-serif}.card{width:min(620px,calc(100% - 48px));padding:32px;border:1px solid #e2e8f0;border-radius:16px;background:white;box-shadow:0 16px 40px #0f172a12}h1{margin:0 0 12px;font-size:24px}p{margin:0;color:#475569;white-space:pre-wrap}.actions{display:flex;gap:12px;margin-top:24px}.button{padding:10px 18px;border-radius:10px;background:#0f172a;color:white;text-decoration:none;font-weight:600}.button+.button{background:#e2e8f0;color:#0f172a}</style></head><body><main class="card"><h1>${safeTitle}</h1><p>${safeMessage}</p>${buttons ? `<div class="actions">${buttons}</div>` : ''}</main></body></html>`;
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

function saveUserServerUrl(url) {
  try {
    fs.mkdirSync(path.dirname(getUserConfigPath()), { recursive: true });
    fs.writeFileSync(getUserConfigPath(), `${JSON.stringify({ serverUrl: url }, null, 2)}
`, 'utf8');
  } catch (error) {
    console.warn('Unable to remember the server address:', error);
  }
}

// Precedence: RAISONI_SERVER_URL env > %APPDATA%Raisoni ERPserver.json > URL baked in at build > default.
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

async function isServerReachable(url, signal) {
  try {
    const options = {
      signal: AbortSignal.any([signal, AbortSignal.timeout(HEALTH_TIMEOUT_MS)]),
      cache: 'no-store'
    };
    let response = await net.fetch(`${url}/api/health/ready`, options);
    // Older LAN servers do not yet have the lightweight readiness endpoint.
    if (response.status === 404) response = await net.fetch(`${url}/api/health`, options);
    if (!response.ok) return false;
    const health = await response.json();
    return health.success === true && health.data?.status === 'ok' &&
      health.data?.database?.connected === true;
  } catch {
    return false;
  }
}

function getBroadcastAddresses() {
  const addresses = new Set(['255.255.255.255']);
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal || !entry.netmask) continue;
      const ip = entry.address.split('.').map(Number);
      const mask = entry.netmask.split('.').map(Number);
      // Directed broadcast (e.g. 192.168.1.255) reaches every adapter, not just the primary one.
      addresses.add(ip.map((part, index) => part | (~mask[index] & 255)).join('.'));
    }
  }
  return [...addresses];
}

// Broadcasts on the LAN and resolves with the first server that answers, or null.
function discoverServer(signal) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    let settled = false;
    const finish = (url) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      try {
        socket.close();
      } catch {
        // Already closed
      }
      resolve(url);
    };
    const timer = setTimeout(() => finish(null), DISCOVERY_TIMEOUT_MS);
    const onAbort = () => finish(null);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) return finish(null);

    socket.on('error', () => finish(null));
    socket.on('message', (message, remote) => {
      try {
        const reply = JSON.parse(message.toString('utf8'));
        if (reply.service === DISCOVERY_SERVICE && Number.isInteger(reply.port) && reply.port > 0 && reply.port <= 65535) {
          finish(`http://${remote.address}:${reply.port}`);
        }
      } catch {
        // Not a Raisoni reply
      }
    });
    socket.bind(() => {
      socket.setBroadcast(true);
      const request = Buffer.from(DISCOVERY_REQUEST);
      for (const address of getBroadcastAddresses()) {
        socket.send(request, DISCOVERY_PORT, address, () => {});
      }
    });
  });
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
  const searchNote = isServerUrlForced ? '' : ' and searches the office network for the server';
  await mainWindow.loadURL(
    inlinePage(
      'Waiting for the Raisoni ERP server',
      `Cannot reach the server at ${serverUrl}.

` +
        'Check that this PC is connected to the office network and that the server PC is switched on. ' +
        `This screen retries automatically every ${RETRY_DELAY_MS / 1000} seconds${searchNote}.`,
      [{ href: ACTION_RETRY, label: 'Retry now' }]
    )
  );
}

async function connectToServer() {
  if (!mainWindow || isConnecting) return;
  isConnecting = true;
  clearTimeout(retryTimer);
  retryTimer = null;
  const window = mainWindow;
  const controller = new AbortController();
  connectionController = controller;
  try {
    const checkServer = async (url) => {
      if (url && await isServerReachable(url, controller.signal)) return url;
      throw new Error('Server is not ready');
    };
    const candidates = [checkServer(serverUrl)];
    if (!isServerUrlForced) {
      candidates.push(discoverServer(controller.signal).then(checkServer));
    }
    const readyUrl = await Promise.any(candidates).catch(() => null);
    controller.abort();
    if (mainWindow !== window || window.isDestroyed()) return;
    if (readyUrl) {
      if (serverUrl !== readyUrl) saveUserServerUrl(readyUrl);
      serverUrl = readyUrl;
      await window.loadURL(serverUrl);
      return;
    }
    await showOfflinePage();
    scheduleReconnect();
  } catch (error) {
    console.error('Unable to load the server UI:', error);
    await showOfflinePage().catch(() => {});
    scheduleReconnect();
  } finally {
    controller.abort();
    if (connectionController === controller) connectionController = null;
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
    if (navigationUrl.startsWith(ACTION_RETRY)) {
      event.preventDefault();
      // Always give feedback; if an automatic check is already running it finishes and updates the screen.
      mainWindow
        .loadURL(inlinePage('Connecting to Raisoni ERP', 'Looking for the server…'))
        .then(() => connectToServer())
        .catch(console.error);
      return;
    }
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
    connectionController?.abort();
    clearTimeout(retryTimer);
    retryTimer = null;
    mainWindow = null;
  });

  isServerUrlForced = Boolean(process.env.RAISONI_SERVER_URL);
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
