/**
 * Re-file the whole library on disk, by moving files — never by rewriting
 * them.
 *
 * The drum pass (`drumSorter`) only ever looked at 01_DRUMS. This one covers
 * every managed folder, so a sound that the corrected rules place elsewhere
 * gets walked over to where it belongs. Nothing is decoded, analysed or
 * re-encoded: a rename keeps the audio and its analysis untouched, which is
 * why this takes minutes where a re-ingest would take a day and would put the
 * sounds through the encoder again.
 *
 * The rule for moving is deliberately narrow: a file moves only when there is
 * an opinion worth moving it for — a name that states the type, or a manifest
 * entry that carries one. A sound nobody can name stays exactly where it is,
 * so hand-filing survives the pass.
 */
import {
  listManagedLibraryFiles,
  moveLibraryFileInto,
  readLibraryManifest,
  replaceLibraryManifest,
  resetDirectoryNameCache,
  type LibraryRoot,
} from './localLibrary';
import { classifySampleForLibrary } from './proFolderOrganizer';
import { keywordTypeFromName } from './audioAnalyzer';
import type { SampleItem, SampleType } from '../types/sample';

/**
 * Hardware patches are filed by the device that owns them, not by what they
 * sound like: an OP-1 drum kit is an OP-1 drum kit wherever the classifier
 * would otherwise put it.
 */
const UNTOUCHED_ROOTS = ['03_HARDWARE'];

/** Types that actually say something. `other` is the absence of an answer. */
const REAL_TYPES = new Set<SampleType>([
  'kick', 'snare', 'hihat', 'clap', 'cymbal', 'percussion',
  'bass', '808', 'lead', 'pad', 'vocal', 'fx', 'loop', 'multi-sound',
]);

export interface LibrarySortResult {
  /** Audio files considered. */
  scanned: number;
  /** Files moved to another folder. */
  moved: number;
  /** Of those, how many were renamed to avoid overwriting a namesake. */
  renamed: number;
  /** Already in the right place. */
  inPlace: number;
  /** No opinion worth moving them for; left untouched. */
  skipped: number;
  failed: number;
  /** `<from> -> <to>` counted, for the report. */
  perMove: Record<string, number>;
}

export interface LibrarySortOptions {
  /** Work out every move and report it, without touching a single file. */
  dryRun?: boolean;
  /** Called as the scan advances, for a progress bar. */
  onProgress?: (done: number, total: number) => void;
}

const dirOf = (relPath: string) => relPath.slice(0, relPath.lastIndexOf('/'));

/**
 * Where a file should live, or undefined when nothing about it says so.
 *
 * The name comes first: it is what the app itself wrote when it filed the
 * sound, and it survives a manifest that has drifted. The manifest's stored
 * type is the fallback, because it holds what the acoustic analysis found for
 * sounds whose names say nothing.
 */
function destinationFor(
  fileName: string,
  entry: Record<string, unknown> | undefined
): string | undefined {
  const stored =
    typeof entry?.type === 'string' && REAL_TYPES.has(entry.type as SampleType)
      ? (entry.type as SampleType)
      : undefined;
  const type = keywordTypeFromName(fileName) ?? stored;
  if (!type) return undefined;

  const isLoop = entry?.category === 'loop' || type === 'loop';
  return classifySampleForLibrary({
    type,
    category: isLoop ? 'loop' : 'one-shot',
    isLoop,
    name: fileName,
    originalFileName: fileName,
  } as SampleItem).folderPath.replace(/^\//, '');
}

/** `<folder>/<file>` as the manifest keys an entry. */
const manifestKeyOf = (entry: Record<string, unknown>) =>
  `${String(entry.path ?? '').replace(/^\//, '')}/${String(entry.fileName ?? entry.name ?? '')}`;

/**
 * File every sound in the library where the current rules place it. Safe to
 * run again: a tidy library moves nothing.
 */
export async function sortLibrary(
  root: LibraryRoot,
  options: LibrarySortOptions = {}
): Promise<LibrarySortResult> {
  const files = (await listManagedLibraryFiles(root)).filter(
    (file) => !UNTOUCHED_ROOTS.some((top) => file.relPath.startsWith(`${top}/`))
  );
  const manifest = await readLibraryManifest(root);
  const byPath = new Map(manifest.map((entry) => [manifestKeyOf(entry), entry]));

  const result: LibrarySortResult = {
    scanned: files.length,
    moved: 0,
    renamed: 0,
    inPlace: 0,
    skipped: 0,
    failed: 0,
    perMove: {},
  };
  /** Old path -> where the file ended up, to carry the manifest over. */
  const moves = new Map<string, { path: string; name: string }>();

  // Folders are about to gain files; start from a fresh listing so the
  // free-name search sees what is really there.
  resetDirectoryNameCache();

  let done = 0;
  for (const file of files) {
    options.onProgress?.(done++, files.length);

    const from = dirOf(file.relPath);
    const to = destinationFor(file.name, byPath.get(file.relPath));
    if (!to) {
      result.skipped++;
      continue;
    }
    if (to === from) {
      result.inPlace++;
      continue;
    }

    result.perMove[`${from} -> ${to}`] = (result.perMove[`${from} -> ${to}`] ?? 0) + 1;
    if (options.dryRun) {
      result.moved++;
      continue;
    }

    try {
      const target = await moveLibraryFileInto(file.relPath, to, file.name);
      const name = target.slice(target.lastIndexOf('/') + 1);
      if (name !== file.name) result.renamed++;
      moves.set(file.relPath, { path: target, name });
      result.moved++;
    } catch {
      result.failed++;
    }
  }
  options.onProgress?.(files.length, files.length);

  if (moves.size > 0) {
    const updated = manifest.map((entry) => {
      const move = moves.get(manifestKeyOf(entry));
      if (!move) return entry;
      return {
        ...entry,
        path: `/${dirOf(move.path)}`,
        // The name can have changed to dodge a collision; without carrying it
        // over, the manifest would point at a file that is not there.
        fileName: move.name,
      };
    });
    await replaceLibraryManifest(root, updated);
  }

  return result;
}
