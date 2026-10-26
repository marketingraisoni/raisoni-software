const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let applicationOrigin = 'http://192.168.1.125:3000';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getRemoteServerUrl() {
  try {
    const configPath = path.join(app.getPath('userData'), 'config', 'server-url.txt');
    if (fs.existsSync(configPath)) {
      const saved = fs.readFileSync(configPath, 'utf8').trim();
      if (saved.startsWith('http://') || saved.startsWith('https://')) {
        return saved.replace(/\/+$/, '');
      }
    }
  } catch {
    // ignore
  }

  const envUrl =
    process.env.SERVER_URL ||
    (process.env.VITE_API_URL ? process.env.VITE_API_URL.replace(/\/api\/?$/, '') : null);

  return (envUrl || 'http://192.168.1.125:3000').replace(/\/+$/, '');
}

function errorPage(serverUrl, errorDetails) {
  const safeUrl = escapeHtml(serverUrl);
  const safeDetails = escapeHtml(errorDetails || '');
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Raisoni ERP - Server Connection</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #0f172a;
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .card {
      width: min(560px, calc(100% - 48px));
      padding: 36px;
      border: 1px solid #1e293b;
      border-radius: 16px;
      background: #1e293b;
      box-shadow: 0 20px 45px rgba(0,0,0,0.4);
    }
    h1 { margin: 0 0 12px; font-size: 22px; color: #f8fafc; }
    p { margin: 0 0 14px; color: #94a3b8; font-size: 14px; line-height: 1.6; }
    .server-box {
      background: #0f172a;
      padding: 10px 14px;
      border-radius: 8px;
      font-family: monospace;
      color: #38bdf8;
      font-size: 14px;
      display: block;
      margin-bottom: 20px;
      border: 1px solid #334155;
      word-break: break-all;
    }
    ul { margin: 0 0 24px 0; padding-left: 20px; color: #94a3b8; font-size: 13px; line-height: 1.8; }
    strong { color: #f1f5f9; }
    button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 11px 22px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }
    button:hover { background: #1d4ed8; }
    .error-msg { font-size: 12px; color: #ef4444; margin-top: 16px; font-family: monospace; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Unable to Connect to Server</h1>
    <p>Raisoni ERP could not connect to your office server at:</p>
    <div class="server-box">${safeUrl}</div>
    <ul>
      <li>Ensure the server PC (<strong>192.168.1.125</strong>) is powered on and the backend is running.</li>
      <li>Ensure this computer is connected to the same office Wi-Fi / LAN network.</li>
      <li>Check that <strong>Port 3000</strong> is allowed in Windows Firewall on the server PC.</li>
    </ul>
    <button onclick="window.location.reload()">Retry Connection</button>
    ${safeDetails ? `<div class="error-msg">Error: ${safeDetails}</div>` : ''}
  </main>
</body>
</html>`;
  return `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;
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
    backgroundColor: '#0f172a',
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: false,
    },
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
    const allowedDevelopmentUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:9090';
    if (
      !navigationUrl.startsWith(applicationOrigin) &&
      !navigationUrl.startsWith(allowedDevelopmentUrl) &&
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

  const targetServerUrl = getRemoteServerUrl();
  applicationOrigin = targetServerUrl;

  try {
    await mainWindow.loadURL(targetServerUrl);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error('Connection failed:', details);
    await mainWindow.loadURL(errorPage(targetServerUrl, details));
  }
}

ipcMain.handle('app:version', () => app.getVersion());

app.whenReady().then(createWindow).catch((error) => {
  console.error('Unable to create desktop window:', error);
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
