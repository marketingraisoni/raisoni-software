const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, minimal API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getServerUrl: () => ipcRenderer.invoke('app:server-url'),
  getRememberedSession: () =>
    ipcRenderer.sendSync('auth:remembered-session:get'),
  setRememberedSession: (session) =>
    ipcRenderer.sendSync('auth:remembered-session:set', session),
  clearRememberedSession: () =>
    ipcRenderer.sendSync('auth:remembered-session:set', null),
  getPlatform: () => process.platform,
  isElectron: true
});
