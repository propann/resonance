const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');

function createWindow() {
  const window = new BrowserWindow({ width: 1440, height: 920, minWidth: 1080, minHeight: 680, backgroundColor: '#060609', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false } });
  if (process.env.RESONANCE_DEV_URL) window.loadURL(process.env.RESONANCE_DEV_URL);
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('open-file', (event, filePath) => { event.preventDefault(); dialog.showMessageBox({ type: 'info', title: 'Resonance', message: `Fichier reçu : ${filePath}` }); });
