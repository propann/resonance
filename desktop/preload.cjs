const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('resonanceDesktop', { platform: process.platform, version: process.versions.electron, nativeEngines: false });
