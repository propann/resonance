const { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

// A clean product name (used for the window title, the process name and the
// per-user data folder). The app carries its own in-page menu bar, so the
// native OS menu is removed entirely.
app.setName('Resonance');
Menu.setApplicationMenu(null);

let mainWindow = null;
let currentRoot = null;
let watcher = null;

const CONFIG_PATH = () => path.join(app.getPath('userData'), 'resonance-config.json');

/**
 * Read the config. A missing file is a normal first run ({}). A parse/read
 * failure falls back to the last-known-good backup so a transient error never
 * makes a caller think the config is empty (which a later merge-write would
 * then persist, wiping libraryRoot / secrets).
 */
async function readConfig() {
  for (const candidate of [CONFIG_PATH(), CONFIG_PATH() + '.bak']) {
    try {
      return JSON.parse(await fs.readFile(candidate, 'utf8'));
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      // parse error / transient read failure — try the next candidate
    }
  }
  return {};
}

// All writes go through one queue so concurrent secret:set / fs:setRoot calls
// can't read-modify-write over each other.
let configWriteQueue = Promise.resolve();
function writeConfig(patch) {
  configWriteQueue = configWriteQueue
    .catch(() => {})
    .then(async () => {
      const p = CONFIG_PATH();
      const current = await readConfig();
      const next = JSON.stringify({ ...current, ...patch }, null, 2);
      // back up the previous good file, then write via a temp + rename swap
      try {
        await fs.copyFile(p, p + '.bak');
      } catch {
        /* no prior file yet */
      }
      const tmp = p + '.tmp';
      await fs.writeFile(tmp, next, 'utf8');
      // Windows rename can hit EPERM/EBUSY if the target is momentarily open
      // (a concurrent read). Retry a few times, then fall back to a plain
      // in-place write so the value is never silently dropped.
      let renamed = false;
      for (let attempt = 0; attempt < 5 && !renamed; attempt++) {
        try {
          await fs.rename(tmp, p);
          renamed = true;
        } catch (err) {
          if (attempt === 4) {
            console.error('[config] rename failed, writing in place', err);
            await fs.writeFile(p, next, 'utf8');
            await fs.rm(tmp, { force: true }).catch(() => {});
            renamed = true;
          } else {
            await new Promise((r) => setTimeout(r, 40));
          }
        }
      }
    })
    .catch((err) => console.error('[config] write failed', err));
  return configWriteQueue;
}

/** Resolve a path relative to the chosen root and refuse anything outside it. */
function resolveInRoot(rel) {
  if (!currentRoot) throw new Error('Aucun dossier de travail sélectionné.');
  const abs = path.resolve(currentRoot, rel || '.');
  if (abs !== currentRoot && !abs.startsWith(currentRoot + path.sep)) {
    throw new Error('Chemin hors du dossier de travail.');
  }
  return abs;
}

function stopWatch() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 680,
    title: 'Resonance',
    backgroundColor: '#060609',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (process.env.RESONANCE_DEV_URL) mainWindow.loadURL(process.env.RESONANCE_DEV_URL);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // Show only once painted, to avoid a white flash on launch.
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
    stopWatch();
  });
}

// ---- filesystem IPC (all paths jailed to currentRoot) -----------------------

ipcMain.handle('fs:pickRoot', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  currentRoot = result.filePaths[0];
  await writeConfig({ libraryRoot: currentRoot });
  return currentRoot;
});

ipcMain.handle('fs:setRoot', async (_e, absPath) => {
  if (typeof absPath !== 'string' || !fsSync.existsSync(absPath)) return null;
  currentRoot = path.resolve(absPath);
  await writeConfig({ libraryRoot: currentRoot });
  return currentRoot;
});

ipcMain.handle('fs:stat', async (_e, rel) => {
  try {
    const st = await fs.stat(resolveInRoot(rel));
    return { exists: true, isDir: st.isDirectory(), isFile: st.isFile(), size: st.size, mtimeMs: st.mtimeMs };
  } catch {
    return { exists: false, isDir: false, isFile: false, size: 0, mtimeMs: 0 };
  }
});

ipcMain.handle('fs:readDir', async (_e, rel) => {
  const dir = resolveInRoot(rel);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    let size = 0;
    let mtimeMs = 0;
    if (entry.isFile()) {
      try {
        const st = await fs.stat(path.join(dir, entry.name));
        size = st.size;
        mtimeMs = st.mtimeMs;
      } catch {
        /* ignore */
      }
    }
    out.push({ name: entry.name, isDir: entry.isDirectory(), isFile: entry.isFile(), size, mtimeMs });
  }
  return out;
});

ipcMain.handle('fs:readFile', async (_e, rel) => {
  const buf = await fs.readFile(resolveInRoot(rel));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
});

ipcMain.handle('fs:writeFile', async (_e, rel, data) => {
  const abs = resolveInRoot(rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(data));
  return true;
});

ipcMain.handle('fs:mkdirp', async (_e, rel) => {
  await fs.mkdir(resolveInRoot(rel), { recursive: true });
  return true;
});

ipcMain.handle('fs:remove', async (_e, rel) => {
  await fs.rm(resolveInRoot(rel), { recursive: true, force: true });
  return true;
});

ipcMain.handle('fs:rename', async (_e, relFrom, relTo) => {
  const to = resolveInRoot(relTo);
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(resolveInRoot(relFrom), to);
  return true;
});

ipcMain.handle('fs:watchStart', async () => {
  stopWatch();
  if (!currentRoot) return false;
  let chokidar;
  try {
    chokidar = require('chokidar');
  } catch {
    // Not bundled — the renderer falls back to its periodic scan.
    return false;
  }
  let timer = null;
  watcher = chokidar.watch(currentRoot, {
    ignoreInitial: true,
    depth: 8,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
  });
  const ping = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('fs:change');
    }, 250);
  };
  watcher.on('add', ping).on('unlink', ping).on('addDir', ping).on('unlinkDir', ping);
  return true;
});

ipcMain.handle('fs:watchStop', async () => {
  stopWatch();
  return true;
});

// ---- config + secrets ------------------------------------------------------

ipcMain.handle('cfg:get', async (_e, key) => (await readConfig())[key] ?? null);
ipcMain.handle('cfg:set', async (_e, key, value) => {
  await writeConfig({ [key]: value });
  return true;
});

ipcMain.handle('secret:get', async (_e, key) => {
  const cfg = await readConfig();
  const stored = cfg.secrets?.[key];
  if (!stored) return null;
  if (stored.enc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(stored.value, 'base64'));
    } catch {
      return null;
    }
  }
  return stored.enc ? null : stored.value;
});

ipcMain.handle('secret:set', async (_e, key, value) => {
  const cfg = await readConfig();
  const secrets = { ...(cfg.secrets || {}) };
  if (!value) {
    delete secrets[key];
  } else if (safeStorage.isEncryptionAvailable()) {
    secrets[key] = { enc: true, value: safeStorage.encryptString(value).toString('base64') };
  } else {
    secrets[key] = { enc: false, value };
  }
  await writeConfig({ secrets });
  return true;
});

// ---- app lifecycle -------------------------------------------------------------

app.whenReady().then(async () => {
  const cfg = await readConfig();
  if (cfg.libraryRoot && fsSync.existsSync(cfg.libraryRoot)) currentRoot = cfg.libraryRoot;
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  stopWatch();
  if (process.platform !== 'darwin') app.quit();
});
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  dialog.showMessageBox({ type: 'info', title: 'Resonance', message: `Fichier reçu : ${filePath}` });
});
