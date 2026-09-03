/**
 * Working-folder access. Backed by the Electron fs bridge (`desktopFS`); every
 * path is relative to the folder the user chose and is jailed to it in the main
 * process. In a plain browser build the bridge is absent and
 * `supportsLocalLibrary()` returns false.
 *
 * Function signatures keep a leading `root` argument for source compatibility,
 * but the authoritative root lives in the main process — the argument is only
 * used for display.
 */
import { desktopFS, isDesktop } from './desktopBridge';

/** @deprecated the root is now a plain path string. */
export type DirectoryHandle = string;
export type LibraryRoot = string;

export interface WorkFolderAudioFile {
  file: File;
  /** Path relative to the working folder; used only after a successful transfer. */
  sourcePath: string;
}

export const LIBRARY_FOLDERS = [
  '00_RECEPTION',
  '01_ONE_SHOTS/01_DRUMS',
  '01_ONE_SHOTS/02_BASS_808',
  '01_ONE_SHOTS/03_MELODIC',
  '01_ONE_SHOTS/04_VOCALS',
  '01_ONE_SHOTS/05_FX_TEXTURES',
  '01_ONE_SHOTS/06_KITS_MULTI',
  '02_LOOPS/01_DRUM_LOOPS',
  '02_LOOPS/02_MELODIC_LOOPS',
  '02_LOOPS/03_VOCAL_LOOPS',
  '02_LOOPS/04_TEXTURES',
  '03_HARDWARE/OP-1_DRUM_PATCHES',
  '_MANIFEST',
] as const;

const MANAGED_TOP_LEVEL_FOLDERS = new Set([
  '00_RECEPTION',
  '01_ONE_SHOTS',
  '02_LOOPS',
  '03_HARDWARE',
  '_MANIFEST',
]);

const AUDIO_FILE = /\.(wav|mp3|ogg|flac|aif|aiff|m4a|webm)$/i;

// --- path helpers ------------------------------------------------------------

const j = (...parts: Array<string | undefined>): string =>
  parts
    .filter((p): p is string => !!p)
    .join('/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\//, '');

const baseName = (p: string): string => p.split('/').filter(Boolean).pop() ?? p;

/** Last path segment of a root, for display (handles both slash styles). */
export const folderDisplayName = (root: string): string =>
  root.split(/[/\\]/).filter(Boolean).pop() ?? root;
const dirName = (p: string): string => p.split('/').filter(Boolean).slice(0, -1).join('/');

async function bytesToFile(rel: string): Promise<File> {
  const fs = desktopFS();
  const buf = await fs.readFile(rel);
  const stat = await fs.stat(rel);
  return new File([buf], baseName(rel), { lastModified: stat.mtimeMs || Date.now() });
}

function cleanFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'sample.wav';
}

// --- root selection & restore ---------------------------------------------------

export function supportsLocalLibrary(): boolean {
  return isDesktop();
}

export async function ensureLibraryStructure(_root?: LibraryRoot): Promise<void> {
  const fs = desktopFS();
  for (const folder of LIBRARY_FOLDERS) await fs.mkdirp(folder);
}

export async function chooseLibraryRoot(): Promise<LibraryRoot> {
  if (!isDesktop()) throw new Error('Application de bureau requise pour choisir un dossier de travail.');
  const root = await desktopFS().pickRoot();
  if (!root) throw new DOMException('Sélection annulée', 'AbortError');
  await ensureLibraryStructure();
  return root;
}

export async function restoreLibraryRoot(): Promise<LibraryRoot | null> {
  if (!isDesktop()) return null;
  let saved: unknown;
  try {
    saved = await desktopFS().getSetting('libraryRoot');
  } catch (error) {
    console.error('[library] could not read the saved work folder', error);
    return null;
  }
  if (typeof saved !== 'string' || !saved) return null;

  let adopted: LibraryRoot | null = null;
  try {
    adopted = await desktopFS().setRoot(saved);
  } catch (error) {
    console.error('[library] saved work folder could not be re-adopted:', saved, error);
    return null;
  }
  if (!adopted) {
    console.warn('[library] saved work folder no longer exists:', saved);
    return null;
  }

  // Best-effort — a read-only or partially-populated folder should still open.
  try {
    await ensureLibraryStructure();
  } catch (error) {
    console.warn('[library] could not ensure the folder structure (read-only?)', error);
  }
  return adopted;
}

/** Re-point the main process at a root the caller already has (e.g. from the curator). */
export async function adoptLibraryRoot(root: LibraryRoot): Promise<LibraryRoot | null> {
  if (!isDesktop()) return null;
  return desktopFS().setRoot(root);
}

/**
 * Watch the working folder for changes. Returns a cleanup function.
 * No-op in the browser build.
 */
export function watchWorkFolder(onChange: () => void): () => void {
  if (!isDesktop()) return () => undefined;
  const fs = desktopFS();
  const unsub = fs.onChange(onChange);
  void fs.watchStart();
  return () => {
    unsub();
    void fs.watchStop();
  };
}

// --- writing --------------------------------------------------------------------

async function uniqueFileName(dirRel: string, desiredName: string): Promise<string> {
  const fs = desktopFS();
  const clean = cleanFileName(desiredName);
  const dot = clean.lastIndexOf('.');
  const stem = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : '';
  let candidate = clean;
  let index = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const stat = await fs.stat(j(dirRel, candidate));
    if (!stat.exists) return candidate;
    candidate = `${stem}_${index++}${ext}`;
  }
}

/** Ensures a managed subfolder exists and returns its relative path. */
export async function getDirectoryForPath(_root: LibraryRoot, relPath: string): Promise<string> {
  const rel = j(relPath);
  await desktopFS().mkdirp(rel);
  return rel;
}

export async function writeUniqueFile(dirRel: string, fileName: string, contents: Blob): Promise<string> {
  const name = await uniqueFileName(dirRel, fileName);
  await desktopFS().writeFile(j(dirRel, name), await contents.arrayBuffer());
  return name;
}

export async function archiveIncomingFiles(_root: LibraryRoot, files: File[]): Promise<string[]> {
  await desktopFS().mkdirp('00_RECEPTION');
  const written: string[] = [];
  for (const file of files) written.push(await writeUniqueFile('00_RECEPTION', file.name, file));
  return written;
}

// --- reading ------------------------------------------------------------------

export async function listReceptionAudioFiles(_root: LibraryRoot): Promise<File[]> {
  const fs = desktopFS();
  await fs.mkdirp('00_RECEPTION');
  const entries = await fs.readDir('00_RECEPTION');
  const files: File[] = [];
  for (const entry of entries) {
    if (entry.isFile && AUDIO_FILE.test(entry.name)) files.push(await bytesToFile(j('00_RECEPTION', entry.name)));
  }
  return files;
}

/**
 * Every audio file anywhere in the working folder, skipping the managed output
 * areas (but keeping 00_RECEPTION). Reads file bytes eagerly — call it on a
 * change event, not on a timer.
 */
export async function listWorkFolderAudioFiles(_root: LibraryRoot): Promise<WorkFolderAudioFile[]> {
  const fs = desktopFS();
  const out: WorkFolderAudioFile[] = [];

  const visit = async (rel: string): Promise<void> => {
    const entries = await fs.readDir(rel || '.');
    for (const entry of entries) {
      const childRel = j(rel, entry.name);
      if (entry.isFile && AUDIO_FILE.test(entry.name)) {
        out.push({ file: await bytesToFile(childRel), sourcePath: childRel });
      } else if (entry.isDir) {
        if (!rel && MANAGED_TOP_LEVEL_FOLDERS.has(entry.name) && entry.name !== '00_RECEPTION') continue;
        await visit(childRel);
      }
    }
  };

  await visit('');
  return out;
}

export async function readLibraryAudioFile(_root: LibraryRoot, relativePath: string): Promise<File> {
  return bytesToFile(j(relativePath));
}

export interface LibraryScanResult {
  totalSamples: number;
  folderCounts: Record<string, number>;
}

export async function scanManagedLibrary(_root: LibraryRoot): Promise<LibraryScanResult> {
  const fs = desktopFS();
  const folderCounts: Record<string, number> = {};
  let totalSamples = 0;

  const scan = async (rel: string): Promise<number> => {
    let count = 0;
    let entries;
    try {
      entries = await fs.readDir(rel);
    } catch {
      return 0;
    }
    for (const entry of entries) {
      if (entry.isFile && AUDIO_FILE.test(entry.name)) count++;
      else if (entry.isDir) count += await scan(j(rel, entry.name));
    }
    folderCounts[rel] = count;
    return count;
  };

  for (const top of ['01_ONE_SHOTS', '02_LOOPS', '03_HARDWARE']) {
    totalSamples += await scan(top);
  }
  return { totalSamples, folderCounts };
}

// --- deletion / cleanup -----------------------------------------------------

export async function removeWorkFolderFiles(_root: LibraryRoot, sourcePaths: string[]): Promise<number> {
  const fs = desktopFS();
  let removed = 0;
  for (const sourcePath of new Set(sourcePaths)) {
    const rel = j(sourcePath);
    try {
      await fs.remove(rel);
      removed++;
    } catch {
      continue;
    }
    // prune now-empty, non-managed parent folders
    let parent = dirName(rel);
    while (parent && !MANAGED_TOP_LEVEL_FOLDERS.has(parent.split('/')[0])) {
      const entries = await fs.readDir(parent).catch(() => []);
      if (entries.length > 0) break;
      await fs.remove(parent).catch(() => undefined);
      parent = dirName(parent);
    }
  }
  return removed;
}

export async function removeReceptionFiles(_root: LibraryRoot, fileNames: string[]): Promise<number> {
  const fs = desktopFS();
  let removed = 0;
  for (const name of new Set(fileNames)) {
    try {
      await fs.remove(j('00_RECEPTION', name));
      removed++;
    } catch {
      /* missing/renamed files are left alone */
    }
  }
  return removed;
}

export async function removeEmptyManagedFolders(_root: LibraryRoot): Promise<number> {
  const fs = desktopFS();
  const protectedFolders = new Set<string>(LIBRARY_FOLDERS);
  let removed = 0;

  const clean = async (rel: string): Promise<boolean> => {
    let entries;
    try {
      entries = await fs.readDir(rel);
    } catch {
      return false;
    }
    let hasEntries = false;
    for (const entry of entries) {
      if (entry.isFile) {
        hasEntries = true;
        continue;
      }
      const childRel = j(rel, entry.name);
      const childEmpty = await clean(childRel);
      if (childEmpty && !protectedFolders.has(childRel)) {
        await fs.remove(childRel).catch(() => undefined);
        removed++;
      } else {
        hasEntries = true;
      }
    }
    return !hasEntries;
  };

  for (const top of ['01_ONE_SHOTS', '02_LOOPS', '03_HARDWARE']) await clean(top);
  return removed;
}

// --- manifest & settings (_MANIFEST/*.json) --------------------------------

const MANIFEST_FILE = '_MANIFEST/resonance-library.json';
const STUDIO_SETTINGS_FILE = '_MANIFEST/resonance-studio-settings.json';

async function readJsonFile(rel: string): Promise<unknown> {
  try {
    const buf = await desktopFS().readFile(rel);
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return null;
  }
}

async function writeJsonFile(rel: string, value: unknown): Promise<void> {
  await desktopFS().mkdirp(dirName(rel));
  await desktopFS().writeFile(rel, new TextEncoder().encode(JSON.stringify(value, null, 2)));
}

export async function writeLibraryManifest(
  _root: LibraryRoot,
  samples: Array<Record<string, unknown>>
): Promise<void> {
  const existing = (await readJsonFile(MANIFEST_FILE)) as { samples?: Array<Record<string, unknown>> } | null;
  const merged = new Map<string, Record<string, unknown>>();
  for (const sample of existing?.samples ?? []) {
    merged.set(`${sample.path || ''}/${sample.fileName || sample.name || ''}`, sample);
  }
  for (const sample of samples) {
    merged.set(`${sample.path || ''}/${sample.fileName || sample.name || ''}`, sample);
  }
  await writeJsonFile(MANIFEST_FILE, {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    samples: [...merged.values()],
  });
}

export async function readLibraryManifest(_root: LibraryRoot): Promise<Array<Record<string, unknown>>> {
  const parsed = (await readJsonFile(MANIFEST_FILE)) as { samples?: unknown } | null;
  return Array.isArray(parsed?.samples) ? (parsed!.samples as Array<Record<string, unknown>>) : [];
}

export async function getProcessedSourceFingerprints(_root: LibraryRoot): Promise<Set<string>> {
  const parsed = (await readJsonFile(MANIFEST_FILE)) as { samples?: Array<Record<string, unknown>> } | null;
  if (!Array.isArray(parsed?.samples)) return new Set();
  return new Set(
    parsed!.samples
      .map((sample) => sample.sourceFingerprint)
      .filter((fp): fp is string => typeof fp === 'string')
  );
}

export async function readStudioSettings(_root: LibraryRoot): Promise<Record<string, unknown>> {
  const parsed = await readJsonFile(STUDIO_SETTINGS_FILE);
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
}

export async function writeStudioSettings(_root: LibraryRoot, patch: Record<string, unknown>): Promise<void> {
  const current = await readStudioSettings(_root);
  await writeJsonFile(STUDIO_SETTINGS_FILE, { ...current, ...patch, updatedAt: new Date().toISOString() });
}
