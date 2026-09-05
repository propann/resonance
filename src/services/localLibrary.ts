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

/** A source file seen on disk, without its bytes. */
export interface WorkFolderAudioEntry {
  /** Path relative to the working folder. */
  sourcePath: string;
  name: string;
  size: number;
  mtimeMs: number;
}

export const LIBRARY_FOLDERS = [
  '00_RECEPTION',
  '01_ONE_SHOTS/01_DRUMS',
  '01_ONE_SHOTS/01_DRUMS/01_KICKS',
  '01_ONE_SHOTS/01_DRUMS/02_SNARES',
  '01_ONE_SHOTS/01_DRUMS/03_HATS',
  '01_ONE_SHOTS/01_DRUMS/04_CLAPS',
  '01_ONE_SHOTS/01_DRUMS/05_CYMBALS',
  '01_ONE_SHOTS/01_DRUMS/06_PERCS',
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
  '03_HARDWARE/OP-1_SYNTH_PATCHES',
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

/** The sample id the user last worked on — restored on the next launch. */
export async function getLastSampleId(): Promise<string | null> {
  if (!isDesktop()) return null;
  try {
    const v = await desktopFS().getSetting('lastSampleId');
    return typeof v === 'string' && v ? v : null;
  } catch {
    return null;
  }
}

export function setLastSampleId(id: string | null): void {
  if (!isDesktop()) return;
  void desktopFS().setSetting('lastSampleId', id).catch(() => undefined);
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

/**
 * Names already taken in a destination folder, so a free name is found in
 * memory instead of one `stat` per candidate. Probing `name_2`, `name_3`, …
 * over IPC cost hundreds of round-trips per file once a folder held many
 * variants of the same generated name — it was the ingest's real bottleneck.
 */
const takenNamesByDir = new Map<string, Set<string>>();

/** Drop the cached listings; call it when a batch of writes starts. */
export function resetDirectoryNameCache(): void {
  takenNamesByDir.clear();
}

async function takenNames(dirRel: string): Promise<Set<string>> {
  const cached = takenNamesByDir.get(dirRel);
  if (cached) return cached;
  // Names only: the destination folders hold hundreds of samples, and their
  // sizes are of no use here.
  const entries = await desktopFS().readDir(dirRel, { stats: false }).catch(() => []);
  const names = new Set(entries.map((entry) => entry.name.toLowerCase()));
  takenNamesByDir.set(dirRel, names);
  return names;
}

async function uniqueFileName(dirRel: string, desiredName: string): Promise<string> {
  const fs = desktopFS();
  const clean = cleanFileName(desiredName);
  const dot = clean.lastIndexOf('.');
  const stem = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : '';

  const taken = await takenNames(dirRel);
  let candidate = clean;
  let index = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${stem}_${index++}${ext}`;
  }

  // The listing can be stale (a file added behind our back): confirm the one
  // name we settled on, and only then walk forward. Overwriting a file the
  // user just dropped is exactly what must never happen.
  while ((await fs.stat(j(dirRel, candidate))).exists) {
    taken.add(candidate.toLowerCase());
    candidate = `${stem}_${index++}${ext}`;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

/** Ensures a managed subfolder exists and returns its relative path. */
export async function getDirectoryForPath(_root: LibraryRoot, relPath: string): Promise<string> {
  const rel = j(relPath);
  await desktopFS().mkdirp(rel);
  return rel;
}

/**
 * Claim a free name in `dirRel` without writing anything. Lets a batch decide
 * every destination name first (cheap, sequential) and then write the files in
 * parallel without two of them racing for the same name.
 */
export async function reserveUniqueFileName(dirRel: string, fileName: string): Promise<string> {
  return uniqueFileName(dirRel, fileName);
}

/** Write one blob to an already-reserved path. */
export async function writeFileAt(relPath: string, contents: Blob): Promise<void> {
  await desktopFS().writeFile(j(relPath), await contents.arrayBuffer());
}

/**
 * Run `task` over `items` with at most `limit` in flight. Disk writes spend
 * their time waiting (IPC, the OS, the antivirus), so overlapping them is what
 * makes a batch land in seconds instead of minutes.
 */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let index = next++; index < items.length; index = next++) {
      await task(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
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

/**
 * Metadata for every audio file anywhere in the working folder, skipping the
 * managed output areas (but keeping 00_RECEPTION). Directory listings only —
 * no file bytes are read, so this stays cheap enough for the background scan
 * even with hundreds of files waiting in 00_RECEPTION.
 */
export interface WorkFolderScan {
  entries: WorkFolderAudioEntry[];
  /** The walk stopped at `limit`: more files are waiting behind these. */
  truncated: boolean;
}

/**
 * Walk the drop zones for audio files, newest folder listings only — no file
 * bytes. `limit` stops the walk early, which matters: a working folder can
 * hold tens of thousands of files waiting in 00_RECEPTION, and a full walk of
 * those takes ~20 s. Ingestion works one batch at a time, so it only ever
 * needs the head of the list.
 */
export async function scanWorkFolderAudioEntries(
  _root?: LibraryRoot,
  limit: number = Number.POSITIVE_INFINITY
): Promise<WorkFolderScan> {
  const fs = desktopFS();
  const out: WorkFolderAudioEntry[] = [];
  let truncated = false;

  // Breadth-first, on purpose: what the user just dropped at the top of the
  // folder is ingested before the depths of a sub-folder holding 40 000 files.
  // Depth-first meant a big "A_TRIER" swallowed every batch while the files in
  // plain sight never moved.
  const queue: string[] = [''];
  while (queue.length > 0 && out.length < limit) {
    const rel = queue.shift()!;
    // Names only: a drop folder can hold tens of thousands of files, and one
    // stat per entry there costs more than the whole rest of the scan.
    const entries = await fs.readDir(rel || '.', { stats: false }).catch(() => []);
    for (const entry of entries) {
      const childRel = j(rel, entry.name);
      if (entry.isFile && AUDIO_FILE.test(entry.name)) {
        if (out.length >= limit) {
          truncated = true;
          break;
        }
        out.push({ sourcePath: childRel, name: entry.name, size: 0, mtimeMs: 0 });
      } else if (entry.isDir) {
        if (!rel && MANAGED_TOP_LEVEL_FOLDERS.has(entry.name) && entry.name !== '00_RECEPTION') continue;
        queue.push(childRel);
      }
    }
  }
  if (queue.length > 0) truncated = true;

  // Size and mtime make the entry key, so they are read for the handful of
  // entries that survive the limit — not for the whole backlog.
  await Promise.all(
    out.map(async (entry) => {
      const stat = await fs.stat(entry.sourcePath).catch(() => null);
      if (stat) {
        entry.size = stat.size;
        entry.mtimeMs = stat.mtimeMs;
      }
    })
  );
  return { entries: out, truncated };
}

/** Every audio file waiting in the drop zones. Prefer the bounded scan above. */
export async function listWorkFolderAudioEntries(
  root?: LibraryRoot
): Promise<WorkFolderAudioEntry[]> {
  return (await scanWorkFolderAudioEntries(root)).entries;
}

/** Stable identity of a source file: path + size + mtime. */
export const workFolderEntryKey = (entry: {
  sourcePath: string;
  size: number;
  mtimeMs: number;
}): string => `${entry.sourcePath}:${entry.size}:${entry.mtimeMs}`;

/**
 * Read the bytes of already-listed entries. Call it on the entries you are
 * about to hand to curation, never on a whole folder listing.
 */
/** Disk reads in flight at once: enough to keep the IPC bridge busy. */
const READ_CONCURRENCY = 8;

export async function readWorkFolderAudioFiles(
  entries: WorkFolderAudioEntry[]
): Promise<WorkFolderAudioFile[]> {
  const fs = desktopFS();
  const out: WorkFolderAudioFile[] = new Array(entries.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    for (let index = next++; index < entries.length; index = next++) {
      const entry = entries[index];
      try {
        const buf = await fs.readFile(entry.sourcePath);
        out[index] = {
          file: new File([buf], entry.name, { lastModified: entry.mtimeMs }),
          sourcePath: entry.sourcePath,
        };
      } catch {
        // The listing is a snapshot: a file can be gone by the time we read it
        // (a previous batch just filed it). Skip it, never fail the batch.
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(READ_CONCURRENCY, entries.length) }, () => worker())
  );
  return out.filter(Boolean);
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

/** One audio file sitting in the managed library folders. */
export interface ManagedLibraryFile {
  /** Path relative to the working folder, e.g. `01_ONE_SHOTS/01_DRUMS/kick.wav`. */
  relPath: string;
  name: string;
  size: number;
  mtimeMs: number;
}

/** Every audio file the library actually holds, listings only (no bytes). */
export async function listManagedLibraryFiles(_root?: LibraryRoot): Promise<ManagedLibraryFile[]> {
  const fs = desktopFS();
  const out: ManagedLibraryFile[] = [];

  const walk = async (rel: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readDir(rel);
    } catch {
      return;
    }
    for (const entry of entries) {
      const childRel = j(rel, entry.name);
      if (entry.isFile && AUDIO_FILE.test(entry.name)) {
        out.push({ relPath: childRel, name: entry.name, size: entry.size, mtimeMs: entry.mtimeMs });
      } else if (entry.isDir) {
        await walk(childRel);
      }
    }
  };

  for (const top of ['01_ONE_SHOTS', '02_LOOPS', '03_HARDWARE']) await walk(top);
  return out;
}

/** Move a library file, creating the destination folder as needed. */
export async function renameLibraryFile(fromRel: string, toRel: string): Promise<void> {
  const fs = desktopFS();
  await fs.mkdirp(dirName(j(toRel)));
  await fs.rename(j(fromRel), j(toRel));
}

/**
 * Move a library file into another managed folder, keeping its name unless the
 * destination already holds one: `Kick_01.wav` landing next to an existing
 * `Kick_01.wav` becomes `Kick_01_2.wav`. A bare rename overwrites the file
 * that was already there — on Windows as much as anywhere else — and the
 * sound it held is gone. Returns the path the file now has.
 */
export async function moveLibraryFileInto(
  fromRel: string,
  targetDirRel: string,
  name: string
): Promise<string> {
  const fs = desktopFS();
  const dir = j(targetDirRel);
  await fs.mkdirp(dir);
  const finalName = await uniqueFileName(dir, name);
  const toRel = j(dir, finalName);
  await fs.rename(j(fromRel), toRel);
  return toRel;
}

/**
 * Read the first `bytes` of a library file. Falls back to the whole file when
 * the bridge is too old to slice.
 */
export async function readLibraryFileHead(relPath: string, bytes: number): Promise<Blob> {
  const fs = desktopFS();
  const rel = j(relPath);
  if (fs.readFilePart) return new Blob([await fs.readFilePart(rel, 0, bytes)]);
  return new Blob([await fs.readFile(rel)]);
}

/** Read one library file's bytes for hashing. */
export async function readLibraryFileBlob(relPath: string): Promise<Blob> {
  return new Blob([await desktopFS().readFile(j(relPath))]);
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
    // Prune now-empty, non-managed parent folders. Emptiness is asked for
    // directly: listing the parent meant walking every sibling file, which on
    // a 40 000-file drop folder made each deletion take seconds.
    let parent = dirName(rel);
    while (parent && !MANAGED_TOP_LEVEL_FOLDERS.has(parent.split('/')[0])) {
      const empty = fs.isDirEmpty
        ? await fs.isDirEmpty(parent).catch(() => false)
        : (await fs.readDir(parent, { stats: false }).catch(() => [{ name: '' }])).length === 0;
      if (!empty) break;
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

/**
 * Remove the folders left standing empty once their sounds have been filed.
 *
 * `00_RECEPTION` is walked too, and that is the point: a pack dropped there
 * ends up with every file transferred and a tree of empty directories behind
 * it, which reads as work still to do. The reception folder itself is spared,
 * along with every other folder the library creates at startup — they are
 * expected to be there whether or not they hold anything.
 */
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

  for (const top of ['00_RECEPTION', '01_ONE_SHOTS', '02_LOOPS', '03_HARDWARE']) await clean(top);
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

/**
 * The manifest is the library's record: one entry per filed sound. It is kept
 * as a snapshot (`resonance-library.json`) plus a journal of appended entries
 * (`.journal.ndjson`).
 *
 * Rewriting the snapshot on every ingest batch meant reading, merging and
 * writing ~86 Mo of JSON dozens of times an hour once the library grew past
 * 200 000 sounds. Batches now append a few kilobytes to the journal, and the
 * snapshot is rebuilt only when the journal gets long.
 */
const MANIFEST_JOURNAL = '_MANIFEST/resonance-library.journal.ndjson';
/** Journal entries tolerated before folding them back into the snapshot. */
const JOURNAL_COMPACT_THRESHOLD = 5000;

const manifestKey = (sample: Record<string, unknown>): string =>
  `${sample.path || ''}/${sample.fileName || sample.name || ''}`;

/** Loaded index, shared by every reader for the life of the session. */
let manifestIndex: Map<string, Record<string, unknown>> | null = null;
let journalEntryCount = 0;

/**
 * Snapshot entries, or null when the file exists but cannot be read. The
 * difference matters: an empty library and an unreadable manifest look the
 * same to a merge, and treating the second as the first rewrites the file with
 * only the newest batch — which is how a 2 000-entry manifest became a
 * 1 500-entry one while the folder held 110 000 files.
 */
async function readSnapshotSamples(): Promise<Array<Record<string, unknown>> | null> {
  const stat = await desktopFS().stat(MANIFEST_FILE);
  if (!stat.exists) return [];
  const parsed = (await readJsonFile(MANIFEST_FILE)) as { samples?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.samples)) return null;
  return parsed.samples as Array<Record<string, unknown>>;
}

/** Journal lines, skipping anything that no longer parses. */
async function readJournalSamples(): Promise<Array<Record<string, unknown>>> {
  const stat = await desktopFS().stat(MANIFEST_JOURNAL);
  if (!stat.exists) return [];
  try {
    const text = new TextDecoder().decode(await desktopFS().readFile(MANIFEST_JOURNAL));
    return text
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as Record<string, unknown>];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

/** Build (once) the in-memory index of every manifest entry. */
async function loadManifestIndex(): Promise<Map<string, Record<string, unknown>>> {
  if (manifestIndex) return manifestIndex;
  const snapshot = await readSnapshotSamples();
  if (snapshot === null) {
    throw new Error('Manifeste illisible : la bibliothèque ne peut pas être lue sans risque.');
  }
  const journal = await readJournalSamples();
  journalEntryCount = journal.length;
  const index = new Map<string, Record<string, unknown>>();
  for (const entry of snapshot) index.set(manifestKey(entry), entry);
  for (const entry of journal) index.set(manifestKey(entry), entry);
  manifestIndex = index;
  return index;
}

/** Write the snapshot from the index and drop the journal. */
async function compactManifest(index: Map<string, Record<string, unknown>>): Promise<void> {
  await writeJsonFile(MANIFEST_FILE, {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    samples: [...index.values()],
  });
  await desktopFS().remove(MANIFEST_JOURNAL).catch(() => undefined);
  journalEntryCount = 0;
}

/**
 * Add or update entries. Appends to the journal — callers delete source files
 * once this resolves, so it must be durable, but it must not cost a full
 * rewrite of the library's record.
 */
export async function writeLibraryManifest(
  _root: LibraryRoot,
  samples: Array<Record<string, unknown>>
): Promise<void> {
  if (samples.length === 0) return;
  const index = await loadManifestIndex();
  for (const sample of samples) index.set(manifestKey(sample), sample);

  const lines = `${samples.map((sample) => JSON.stringify(sample)).join('\n')}\n`;
  const bytes = new TextEncoder().encode(lines);
  const fs = desktopFS();
  if (fs.appendFile) {
    await fs.appendFile(MANIFEST_JOURNAL, bytes);
    journalEntryCount += samples.length;
    if (journalEntryCount >= JOURNAL_COMPACT_THRESHOLD) await compactManifest(index);
  } else {
    // No append on this bridge: fall back to rewriting the snapshot.
    await compactManifest(index);
  }
}

export async function readLibraryManifest(_root: LibraryRoot): Promise<Array<Record<string, unknown>>> {
  return [...(await loadManifestIndex()).values()];
}

/**
 * Replace the manifest with `samples` exactly (unlike `writeLibraryManifest`,
 * which merges). Used when entries have to disappear, e.g. after removing
 * duplicate files.
 */
export async function replaceLibraryManifest(
  _root: LibraryRoot,
  samples: Array<Record<string, unknown>>
): Promise<void> {
  const index = new Map<string, Record<string, unknown>>();
  for (const sample of samples) index.set(manifestKey(sample), sample);
  manifestIndex = index;
  await compactManifest(index);
}

/**
 * Content hashes of everything already in the library. A source dropped twice
 * — renamed, moved, re-downloaded — has a different path fingerprint but the
 * same bytes, and must not land a second time as `..._2`.
 */
export async function getLibraryContentHashes(_root: LibraryRoot): Promise<Set<string>> {
  const hashes = new Set<string>();
  for (const entry of (await loadManifestIndex()).values()) {
    if (typeof entry.contentHash === 'string') hashes.add(entry.contentHash);
  }
  return hashes;
}

/** SHA-256 of the source bytes, as hex. Identity of the audio on disk. */
export async function hashFileContent(file: Blob): Promise<string | undefined> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.error('[library] hachage impossible', error);
    return undefined;
  }
}

export async function getProcessedSourceFingerprints(_root: LibraryRoot): Promise<Set<string>> {
  const fingerprints = new Set<string>();
  for (const entry of (await loadManifestIndex()).values()) {
    if (typeof entry.sourceFingerprint === 'string') fingerprints.add(entry.sourceFingerprint);
  }
  return fingerprints;
}

export async function readStudioSettings(_root: LibraryRoot): Promise<Record<string, unknown>> {
  const parsed = await readJsonFile(STUDIO_SETTINGS_FILE);
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
}

export async function writeStudioSettings(_root: LibraryRoot, patch: Record<string, unknown>): Promise<void> {
  const current = await readStudioSettings(_root);
  await writeJsonFile(STUDIO_SETTINGS_FILE, { ...current, ...patch, updatedAt: new Date().toISOString() });
}
