const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, minimal API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getServerUrl: () => ipcRenderer.invoke('app:server-url'),
  getPlatform: () => process.platform,
  isElectron: true
});
