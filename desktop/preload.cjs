const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, minimal API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => process.platform,
  isElectron: true
});
