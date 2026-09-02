// Headless self-test of the fs/secrets/watch building blocks used by main.cjs.
// Run: npx electron desktop/_selftest.cjs
const { app, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');

const ROOT = process.env.SELFTEST_ROOT || path.join(require('node:os').homedir(), 'resonance-test-lib');

const LIBRARY_FOLDERS = [
  '00_RECEPTION',
  '01_ONE_SHOTS/01_DRUMS', '01_ONE_SHOTS/02_BASS_808', '01_ONE_SHOTS/03_MELODIC',
  '01_ONE_SHOTS/04_VOCALS', '01_ONE_SHOTS/05_FX_TEXTURES', '01_ONE_SHOTS/06_KITS_MULTI',
  '02_LOOPS/01_DRUM_LOOPS', '02_LOOPS/02_MELODIC_LOOPS', '02_LOOPS/03_VOCAL_LOOPS', '02_LOOPS/04_TEXTURES',
  '03_HARDWARE/OP-1_DRUM_PATCHES',
  '_MANIFEST',
];

function resolveInRoot(rel) {
  const abs = path.resolve(ROOT, rel || '.');
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) throw new Error('escape: ' + rel);
  return abs;
}

async function run() {
  const results = [];
  const ok = (name, extra = '') => results.push(`  OK   ${name}${extra ? ' — ' + extra : ''}`);
  const bad = (name, err) => results.push(`  FAIL ${name} — ${err}`);

  try {
    // 1. path jail
    try { resolveInRoot('../evil'); bad('path jail', 'did not throw'); }
    catch { ok('path jail rejects ../'); }
    ok('path jail allows nested', resolveInRoot('01_ONE_SHOTS/01_DRUMS'));

    // 2. mkdirp the library structure
    for (const f of LIBRARY_FOLDERS) await fs.mkdir(resolveInRoot(f), { recursive: true });
    const made = LIBRARY_FOLDERS.filter((f) => fsSync.existsSync(resolveInRoot(f)));
    if (made.length === LIBRARY_FOLDERS.length) ok('mkdirp', `${made.length}/${LIBRARY_FOLDERS.length} folders`);
    else bad('mkdirp', `${made.length}/${LIBRARY_FOLDERS.length}`);

    // 3. readdir withFileTypes
    const entries = await fs.readdir(ROOT, { withFileTypes: true });
    ok('readdir root', entries.filter((e) => e.isDirectory()).map((e) => e.name).join(', '));

    // 4. write + read a manifest json
    const manifestRel = '_MANIFEST/resonance-library.json';
    await fs.writeFile(resolveInRoot(manifestRel), JSON.stringify({ schemaVersion: 1, samples: [{ name: 'x' }] }, null, 2));
    const back = JSON.parse(await fs.readFile(resolveInRoot(manifestRel), 'utf8'));
    ok('manifest round-trip', `samples=${back.samples.length}`);

    // 5. readFile -> ArrayBuffer slice (bytesToFile path)
    const buf = await fs.readFile(resolveInRoot(manifestRel));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    ok('readFile -> ArrayBuffer', `${ab.byteLength} bytes`);

    // 6. safeStorage
    if (safeStorage.isEncryptionAvailable()) {
      const enc = safeStorage.encryptString('ghp_secrettoken123');
      const dec = safeStorage.decryptString(Buffer.from(enc));
      ok('safeStorage', dec === 'ghp_secrettoken123' ? 'encrypt/decrypt round-trip' : 'MISMATCH');
    } else {
      results.push('  WARN safeStorage.isEncryptionAvailable() = false (plaintext fallback would be used)');
    }

    // 7. chokidar require + watch
    const chokidar = require('chokidar');
    const w = chokidar.watch(ROOT, { ignoreInitial: true, depth: 2 });
    await new Promise((r) => w.on('ready', r));
    ok('chokidar', 'watcher ready');
    await w.close();

    // 8. rm cleanup of a subtree
    await fs.rm(resolveInRoot('03_HARDWARE'), { recursive: true, force: true });
    ok('fs.rm recursive', !fsSync.existsSync(resolveInRoot('03_HARDWARE')) ? 'removed' : 'STILL THERE');
  } catch (e) {
    bad('unexpected', e && e.stack ? e.stack : String(e));
  }

  console.log('\n=== Electron fs-layer self-test (root: ' + ROOT + ') ===\n' + results.join('\n') + '\n');
  app.quit();
}

app.whenReady().then(run);
