const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('resonanceDesktop', {
  platform: process.platform,
  version: process.versions.electron,
  nativeEngines: false,
});

contextBridge.exposeInMainWorld('resonanceFS', {
  // working folder — all fs.* paths are relative to the chosen root and jailed to it
  pickRoot: () => ipcRenderer.invoke('fs:pickRoot'),
  setRoot: (absPath) => ipcRenderer.invoke('fs:setRoot', absPath),
  stat: (rel) => ipcRenderer.invoke('fs:stat', rel),
  readDir: (rel) => ipcRenderer.invoke('fs:readDir', rel),
  isDirEmpty: (rel) => ipcRenderer.invoke('fs:isDirEmpty', rel),
  readFile: (rel) => ipcRenderer.invoke('fs:readFile', rel),
  writeFile: (rel, data) => ipcRenderer.invoke('fs:writeFile', rel, data),
  mkdirp: (rel) => ipcRenderer.invoke('fs:mkdirp', rel),
  remove: (rel) => ipcRenderer.invoke('fs:remove', rel),
  rename: (relFrom, relTo) => ipcRenderer.invoke('fs:rename', relFrom, relTo),

  watchStart: () => ipcRenderer.invoke('fs:watchStart'),
  watchStop: () => ipcRenderer.invoke('fs:watchStop'),
  onChange: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('fs:change', handler);
    return () => ipcRenderer.removeListener('fs:change', handler);
  },

  getSetting: (key) => ipcRenderer.invoke('cfg:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('cfg:set', key, value),
  getSecret: (key) => ipcRenderer.invoke('secret:get', key),
  setSecret: (key, value) => ipcRenderer.invoke('secret:set', key, value),
});
