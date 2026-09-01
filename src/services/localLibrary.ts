/**
 * Browser-side library access. Every filesystem write follows an explicit user
 * directory selection made through the File System Access API.
 */
export type DirectoryHandle = any;

export interface WorkFolderAudioFile {
  file: File;
  /** Path relative to the chosen working folder; used only after a successful transfer. */
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

const DB_NAME = 'resonance-local-library';
const STORE_NAME = 'settings';
const HANDLE_KEY = 'library-handle';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeValue(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function readValue<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();
  const value = await new Promise<T | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

export function supportsLocalLibrary(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function ensureLibraryStructure(root: DirectoryHandle): Promise<void> {
  for (const path of LIBRARY_FOLDERS) {
    let current = root;
    for (const name of path.split('/')) current = await current.getDirectoryHandle(name, { create: true });
  }
}

export async function chooseLibraryRoot(): Promise<DirectoryHandle> {
  if (!supportsLocalLibrary()) throw new Error('Navigateur non compatible : utilisez Chrome ou Edge sur ordinateur.');
  const root = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  await ensureLibraryStructure(root);
  try {
    await storeValue(HANDLE_KEY, root);
  } catch {
    // Some browsers allow the session handle but forbid persistent handles.
  }
  return root;
}

export async function restoreLibraryRoot(): Promise<DirectoryHandle | null> {
  try {
    const root = await readValue<DirectoryHandle>(HANDLE_KEY);
    if (!root) return null;
    const permission = await root.queryPermission?.({ mode: 'readwrite' });
    if (permission !== 'granted') return null;
    await ensureLibraryStructure(root);
    return root;
  } catch {
    return null;
  }
}

function cleanFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'sample.wav';
}

async function uniqueFileHandle(directory: DirectoryHandle, desiredName: string): Promise<any> {
  const dot = desiredName.lastIndexOf('.');
  const stem = dot > 0 ? desiredName.slice(0, dot) : desiredName;
  const extension = dot > 0 ? desiredName.slice(dot) : '';
  let candidate = cleanFileName(desiredName);
  let index = 2;
  while (true) {
    try {
      await directory.getFileHandle(candidate);
      candidate = `${stem}_${index++}${extension}`;
    } catch {
      return directory.getFileHandle(candidate, { create: true });
    }
  }
}

export async function writeUniqueFile(directory: DirectoryHandle, fileName: string, contents: Blob): Promise<string> {
  const handle = await uniqueFileHandle(directory, fileName);
  const writer = await handle.createWritable();
  await writer.write(contents);
  await writer.close();
  return handle.name;
}

export async function archiveIncomingFiles(root: DirectoryHandle, files: File[]): Promise<string[]> {
  const reception = await root.getDirectoryHandle('00_RECEPTION', { create: true });
  const written: string[] = [];
  for (const file of files) written.push(await writeUniqueFile(reception, file.name, file));
  return written;
}

export async function listReceptionAudioFiles(root: DirectoryHandle): Promise<File[]> {
  const reception = await root.getDirectoryHandle('00_RECEPTION', { create: true });
  const files: File[] = [];
  const audioPattern = /\.(wav|mp3|ogg|flac|aif|aiff|m4a|webm)$/i;
  for await (const entry of reception.values()) {
    if (entry.kind !== 'file' || !audioPattern.test(entry.name)) continue;
    files.push(await entry.getFile());
  }
  return files;
}

const MANAGED_TOP_LEVEL_FOLDERS = new Set([
  '00_RECEPTION',
  '01_ONE_SHOTS',
  '02_LOOPS',
  '03_HARDWARE',
  '_MANIFEST',
]);

/** Finds new audio anywhere in the working folder, while ignoring managed outputs. */
export async function listWorkFolderAudioFiles(root: DirectoryHandle): Promise<WorkFolderAudioFile[]> {
  const files: WorkFolderAudioFile[] = [];
  const visit = async (directory: DirectoryHandle, relativePath = ''): Promise<void> => {
    for await (const entry of directory.values()) {
      const path = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.kind === 'file' && AUDIO_FILE.test(entry.name)) {
        files.push({ file: await entry.getFile(), sourcePath: path });
      } else if (entry.kind === 'directory') {
        // Reception is also a valid inbox for libraries created by earlier versions.
        if (!relativePath && MANAGED_TOP_LEVEL_FOLDERS.has(entry.name) && entry.name !== '00_RECEPTION') continue;
        await visit(entry, path);
      }
    }
  };
  await visit(root);
  return files;
}

async function getExistingDirectory(root: DirectoryHandle, parts: string[]): Promise<DirectoryHandle | null> {
  let current = root;
  try {
    for (const part of parts) current = await current.getDirectoryHandle(part);
    return current;
  } catch {
    return null;
  }
}

/** Removes transferred source files and then their now-empty, non-managed parent folders. */
export async function removeWorkFolderFiles(root: DirectoryHandle, sourcePaths: string[]): Promise<number> {
  let removed = 0;
  for (const sourcePath of new Set(sourcePaths)) {
    const parts = sourcePath.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) continue;
    const parent = await getExistingDirectory(root, parts);
    if (!parent) continue;
    try {
      await parent.removeEntry(fileName);
      removed++;
    } catch {
      continue;
    }

    for (let length = parts.length; length > 0; length--) {
      const folderParts = parts.slice(0, length);
      if (MANAGED_TOP_LEVEL_FOLDERS.has(folderParts[0])) break;
      const folder = await getExistingDirectory(root, folderParts);
      const parentFolder = await getExistingDirectory(root, folderParts.slice(0, -1));
      if (!folder || !parentFolder) break;
      let isEmpty = true;
      for await (const _entry of folder.values()) {
        isEmpty = false;
        break;
      }
      if (!isEmpty) break;
      try {
        await parentFolder.removeEntry(folderParts[folderParts.length - 1]);
      } catch {
        break;
      }
    }
  }
  return removed;
}

/** Deletes only transferred files from the managed reception folder. */
export async function removeReceptionFiles(root: DirectoryHandle, fileNames: string[]): Promise<number> {
  const reception = await root.getDirectoryHandle('00_RECEPTION', { create: true });
  let removed = 0;
  for (const fileName of new Set(fileNames)) {
    try {
      await reception.removeEntry(fileName);
      removed++;
    } catch {
      // Missing/renamed files are deliberately left alone.
    }
  }
  return removed;
}

export interface LibraryScanResult {
  totalSamples: number;
  folderCounts: Record<string, number>;
}

const AUDIO_FILE = /\.(wav|mp3|ogg|flac|aif|aiff|m4a|webm)$/i;

export async function scanManagedLibrary(root: DirectoryHandle): Promise<LibraryScanResult> {
  const folderCounts: Record<string, number> = {};
  let totalSamples = 0;
  const scanDirectory = async (directory: DirectoryHandle, relativePath: string): Promise<number> => {
    let count = 0;
    for await (const entry of directory.values()) {
      if (entry.kind === 'file' && AUDIO_FILE.test(entry.name)) count++;
      if (entry.kind === 'directory') count += await scanDirectory(entry, `${relativePath}/${entry.name}`);
    }
    folderCounts[relativePath] = count;
    return count;
  };

  for (const topLevel of ['01_ONE_SHOTS', '02_LOOPS', '03_HARDWARE']) {
    try {
      totalSamples += await scanDirectory(await root.getDirectoryHandle(topLevel), topLevel);
    } catch {
      // A missing category simply contains no samples.
    }
  }
  return { totalSamples, folderCounts };
}

/** Removes only non-canonical empty folders within the managed output areas. */
export async function removeEmptyManagedFolders(root: DirectoryHandle): Promise<number> {
  const protectedFolders = new Set<string>(LIBRARY_FOLDERS);
  let removed = 0;
  const clean = async (directory: DirectoryHandle, relativePath: string): Promise<boolean> => {
    let hasEntries = false;
    const entries: any[] = [];
    for await (const entry of directory.values()) entries.push(entry);
    for (const entry of entries) {
      if (entry.kind === 'file') {
        hasEntries = true;
        continue;
      }
      const childPath = `${relativePath}/${entry.name}`;
      const childEmpty = await clean(entry, childPath);
      if (childEmpty && !protectedFolders.has(childPath)) {
        await directory.removeEntry(entry.name);
        removed++;
      } else {
        hasEntries = true;
      }
    }
    return !hasEntries;
  };

  for (const topLevel of ['01_ONE_SHOTS', '02_LOOPS', '03_HARDWARE']) {
    try {
      await clean(await root.getDirectoryHandle(topLevel), topLevel);
    } catch {
      // Ignore a category that does not exist yet.
    }
  }
  return removed;
}

export async function getDirectoryForPath(root: DirectoryHandle, path: string): Promise<DirectoryHandle> {
  let current = root;
  for (const part of path.split('/').filter(Boolean)) current = await current.getDirectoryHandle(part, { create: true });
  return current;
}

/** Reads one managed sound by relative path without scanning the complete library. */
export async function readLibraryAudioFile(root: DirectoryHandle, relativePath: string): Promise<File> {
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error('Chemin de fichier invalide.');
  const directory = await getExistingDirectory(root, parts);
  if (!directory) throw new Error('Dossier introuvable.');
  const handle = await directory.getFileHandle(fileName);
  return await handle.getFile();
}

export async function writeLibraryManifest(root: DirectoryHandle, samples: Array<Record<string, unknown>>): Promise<void> {
  const manifestDirectory = await root.getDirectoryHandle('_MANIFEST', { create: true });
  const file = await manifestDirectory.getFileHandle('resonance-library.json', { create: true });
  let existingSamples: Array<Record<string, unknown>> = [];
  try {
    const existing = JSON.parse(await (await file.getFile()).text());
    if (Array.isArray(existing.samples)) existingSamples = existing.samples;
  } catch {
    // First export or an older malformed manifest: start a clean registry.
  }
  const merged = new Map<string, Record<string, unknown>>();
  for (const sample of existingSamples) {
    merged.set(`${sample.path || ''}/${sample.fileName || sample.name || ''}`, sample);
  }
  for (const sample of samples) {
    merged.set(`${sample.path || ''}/${sample.fileName || sample.name || ''}`, sample);
  }
  const writer = await file.createWritable();
  await writer.write(JSON.stringify({
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    samples: [...merged.values()],
  }, null, 2));
  await writer.close();
}

/** Source fingerprints already committed to the manifest; prevents replay after a partial transfer. */
export async function getProcessedSourceFingerprints(root: DirectoryHandle): Promise<Set<string>> {
  try {
    const manifestDirectory = await root.getDirectoryHandle('_MANIFEST');
    const file = await manifestDirectory.getFileHandle('resonance-library.json');
    const parsed = JSON.parse(await (await file.getFile()).text());
    if (!Array.isArray(parsed.samples)) return new Set();
    return new Set(parsed.samples
      .map((sample: Record<string, unknown>) => sample.sourceFingerprint)
      .filter((fingerprint: unknown): fingerprint is string => typeof fingerprint === 'string'));
  } catch {
    return new Set();
  }
}

export async function readLibraryManifest(root: DirectoryHandle): Promise<Array<Record<string, unknown>>> {
  try {
    const manifestDirectory = await root.getDirectoryHandle('_MANIFEST');
    const file = await manifestDirectory.getFileHandle('resonance-library.json');
    const parsed = JSON.parse(await (await file.getFile()).text());
    return Array.isArray(parsed.samples) ? parsed.samples : [];
  } catch {
    return [];
  }
}

export async function readStudioSettings(root: DirectoryHandle): Promise<Record<string, unknown>> {
  try {
    const directory = await root.getDirectoryHandle('_MANIFEST');
    const handle = await directory.getFileHandle('resonance-studio-settings.json');
    const parsed = JSON.parse(await (await handle.getFile()).text());
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Saves non-audio studio settings beside the manifest, so they travel with the library. */
export async function writeStudioSettings(root: DirectoryHandle, patch: Record<string, unknown>): Promise<void> {
  const directory = await root.getDirectoryHandle('_MANIFEST', { create: true });
  const handle = await directory.getFileHandle('resonance-studio-settings.json', { create: true });
  const current = await readStudioSettings(root);
  const writer = await handle.createWritable();
  await writer.write(JSON.stringify({ ...current, ...patch, updatedAt: new Date().toISOString() }, null, 2));
  await writer.close();
}
