const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('aurora', {
  version: () => ipcRenderer.invoke('app:version'),
  checkForUpdate: () => ipcRenderer.invoke('app:check-update'),
  getUpdateState: () => ipcRenderer.invoke('app:update-state'),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  onUpdateState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('update:state', listener);
    return () => ipcRenderer.removeListener('update:state', listener);
  },
  scanDevices: () => ipcRenderer.invoke('devices:scan'),
  discoverGames: () => ipcRenderer.invoke('games:discover'),
  optimizeGame: game => ipcRenderer.invoke('games:optimize', game),
  restoreGame: game => ipcRenderer.invoke('games:restore', game),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close')
  }
});
