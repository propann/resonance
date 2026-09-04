/**
 * Library de-duplication: finds files whose bytes are identical, keeps one
 * copy of each and removes the rest (with the matching manifest entries).
 *
 * Only files that share a size can possibly be duplicates, so hashing is
 * limited to those groups — a 500-file library usually means hashing a few
 * dozen files instead of all of them. Nothing is deleted by the scan; removal
 * is a separate, explicit step.
 */
import {
  hashFileContent,
  listManagedLibraryFiles,
  readLibraryFileBlob,
  readLibraryFileHead,
  readLibraryManifest,
  removeWorkFolderFiles,
  replaceLibraryManifest,
  runWithConcurrency,
  writeLibraryManifest,
  type LibraryRoot,
  type ManagedLibraryFile,
} from './localLibrary';

/** Files hashed at once during a de-duplication scan. */
const HASH_CONCURRENCY = 8;
/** Bytes read to fingerprint a file before deciding to read it whole. */
const HEAD_BYTES = 64 * 1024;

export interface DuplicateGroup {
  hash: string;
  /** The copy that stays. */
  keep: ManagedLibraryFile;
  /** The copies to remove. */
  duplicates: ManagedLibraryFile[];
}

export interface DedupeScan {
  groups: DuplicateGroup[];
  /** Files examined in total. */
  scanned: number;
  /** Files whose bytes had to be read. */
  hashed: number;
  /** Bytes reclaimed if every duplicate is removed. */
  reclaimedBytes: number;
}

/** Files grouped by exact size; a group of one cannot hold a duplicate. */
export function groupBySize(files: ManagedLibraryFile[]): ManagedLibraryFile[][] {
  const bySize = new Map<number, ManagedLibraryFile[]>();
  for (const file of files) {
    const bucket = bySize.get(file.size);
    if (bucket) bucket.push(file);
    else bySize.set(file.size, [file]);
  }
  return [...bySize.values()].filter((bucket) => bucket.length > 1);
}

const stemOf = (name: string): string => name.replace(/\.[^/.]+$/, '');

/**
 * True when this copy only exists because its name was taken: dropping a
 * trailing `_2`/`_3` lands exactly on another file of the same group. Checking
 * against the group matters — a trailing number is usually a BPM
 * (`..._Drumloop_Cmaj_171.wav`), not a collision suffix.
 */
export function isCollisionCopy(file: ManagedLibraryFile, group: ManagedLibraryFile[]): boolean {
  const match = stemOf(file.name).match(/^(.*)_(\d{1,2})$/);
  if (!match) return false;
  return group.some((other) => other.relPath !== file.relPath && stemOf(other.name) === match[1]);
}

/**
 * Which copy survives: never one that was pushed aside by a name collision,
 * then the oldest file, then the shortest name. Deterministic, so a scan run
 * twice proposes the same thing.
 */
export function pickKeeper(files: ManagedLibraryFile[]): ManagedLibraryFile {
  const byAge = (a: ManagedLibraryFile, b: ManagedLibraryFile) =>
    a.mtimeMs - b.mtimeMs ||
    stemOf(a.name).length - stemOf(b.name).length ||
    a.relPath.localeCompare(b.relPath);
  const originals = files.filter((file) => !isCollisionCopy(file, files));
  return [...(originals.length > 0 ? originals : files)].sort(byAge)[0];
}

/** Split one same-size bucket into duplicate groups, by content hash. */
export function groupByHash(
  hashes: Map<string, string>,
  bucket: ManagedLibraryFile[]
): DuplicateGroup[] {
  const byHash = new Map<string, ManagedLibraryFile[]>();
  for (const file of bucket) {
    const hash = hashes.get(file.relPath);
    if (!hash) continue;
    const group = byHash.get(hash);
    if (group) group.push(file);
    else byHash.set(hash, [file]);
  }
  return [...byHash.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([hash, files]) => {
      const keep = pickKeeper(files);
      return { hash, keep, duplicates: files.filter((f) => f.relPath !== keep.relPath) };
    });
}

/**
 * Scan the library for identical files. `onProgress` reports hashing progress
 * so a long pass can show something moving.
 */
export async function scanLibraryDuplicates(
  root: LibraryRoot,
  onProgress?: (done: number, total: number) => void
): Promise<DedupeScan> {
  const files = await listManagedLibraryFiles(root);
  const buckets = groupBySize(files);
  const candidates = buckets.flat();

  // Two passes, because a 200 000-file library is 40 Go of audio and reading
  // all of it to find duplicates is not an option:
  //  1. fingerprint the head of each same-size file (cheap, eliminates almost
  //     every unique file);
  //  2. hash in full only the files that still look alike.
  let done = 0;
  const total = candidates.length;
  const heads = new Map<string, string>();
  await runWithConcurrency(candidates, HASH_CONCURRENCY, async (file) => {
    const head = await hashFileContent(await readLibraryFileHead(file.relPath, HEAD_BYTES)).catch(
      () => undefined
    );
    if (head) heads.set(file.relPath, head);
    done++;
    if (done % 50 === 0 || done === total) onProgress?.(done, total);
  });

  const suspects = buckets.flatMap((bucket) =>
    groupByHash(heads, bucket).flatMap((group) => [group.keep, ...group.duplicates])
  );

  const hashes = new Map<string, string>();
  let hashed = 0;
  await runWithConcurrency(suspects, HASH_CONCURRENCY, async (file) => {
    const hash = await hashFileContent(await readLibraryFileBlob(file.relPath)).catch(() => undefined);
    if (hash) hashes.set(file.relPath, hash);
    hashed++;
    if (hashed % 25 === 0 || hashed === suspects.length) onProgress?.(total, total);
  });

  const groups = buckets.flatMap((bucket) => groupByHash(hashes, bucket));
  const reclaimedBytes = groups.reduce(
    (total, group) => total + group.duplicates.reduce((sum, file) => sum + file.size, 0),
    0
  );
  return { groups, scanned: files.length, hashed: suspects.length, reclaimedBytes };
}

export interface DedupeResult {
  removedFiles: number;
  prunedEntries: number;
}

const entryPath = (entry: Record<string, unknown>): string =>
  `${String(entry.path ?? '').replace(/^\//, '')}/${String(entry.fileName ?? entry.name ?? '')}`;

/**
 * Remove the duplicate copies and their manifest entries, and stamp the kept
 * copy with its content hash so the ingestion never files it again.
 */
export async function removeDuplicateGroups(
  root: LibraryRoot,
  groups: DuplicateGroup[]
): Promise<DedupeResult> {
  if (groups.length === 0) return { removedFiles: 0, prunedEntries: 0 };

  const doomed = new Set(groups.flatMap((group) => group.duplicates.map((file) => file.relPath)));
  const removedFiles = await removeWorkFolderFiles(root, [...doomed]);

  const manifest = await readLibraryManifest(root);
  const kept = manifest.filter((entry) => !doomed.has(entryPath(entry)));
  const prunedEntries = manifest.length - kept.length;
  if (prunedEntries > 0) await replaceLibraryManifest(root, kept);

  // Record the hash of every survivor: that is what stops a re-import.
  const hashByPath = new Map(groups.map((group) => [group.keep.relPath, group.hash]));
  const stamped = kept
    .filter((entry) => hashByPath.has(entryPath(entry)))
    .map((entry) => ({ ...entry, contentHash: hashByPath.get(entryPath(entry)) }));
  if (stamped.length > 0) await writeLibraryManifest(root, stamped);

  return { removedFiles, prunedEntries };
}
