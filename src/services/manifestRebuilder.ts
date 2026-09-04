/**
 * Rebuilds the library manifest from what is actually on disk.
 *
 * The manifest is the app's record of the library; if it is lost or truncated,
 * the sounds are still there but the app no longer sees them. Names follow the
 * studio convention (`AZ_<Type>_<Nom>_<Clé>[_<BPM>]`), so most of the metadata
 * can be read straight back from the file name and its folder.
 */
import {
  listManagedLibraryFiles,
  readLibraryManifest,
  replaceLibraryManifest,
  type LibraryRoot,
} from './localLibrary';
import type { SampleType } from '../types/sample';

const KNOWN_TYPES: SampleType[] = [
  'kick',
  'snare',
  'hihat',
  'clap',
  'cymbal',
  'percussion',
  'bass',
  '808',
  'lead',
  'pad',
  'vocal',
  'fx',
  'loop',
  'multi-sound',
  'other',
];

/** Folder → type, for files whose name says nothing useful. */
const TYPE_BY_FOLDER: Array<[RegExp, SampleType]> = [
  [/01_DRUMS\/01_KICKS/, 'kick'],
  [/01_DRUMS\/02_SNARES/, 'snare'],
  [/01_DRUMS\/03_HATS/, 'hihat'],
  [/01_DRUMS\/04_CLAPS/, 'clap'],
  [/01_DRUMS\/05_CYMBALS/, 'cymbal'],
  [/01_DRUMS\/06_PERCS/, 'percussion'],
  [/01_DRUMS/, 'percussion'],
  [/02_BASS_808/, '808'],
  [/03_MELODIC/, 'lead'],
  [/04_VOCALS/, 'vocal'],
  [/05_FX_TEXTURES/, 'fx'],
  [/06_KITS_MULTI/, 'multi-sound'],
  [/02_LOOPS/, 'loop'],
];

const KEY_PATTERN = /^[A-G](#|b)?(m|maj|min)?$/;

/** One manifest entry read back from a file's path and name. */
export function entryFromPath(relPath: string): Record<string, unknown> {
  const cut = relPath.lastIndexOf('/');
  const folder = relPath.slice(0, cut);
  const fileName = relPath.slice(cut + 1);
  const stem = fileName.replace(/\.[^/.]+$/, '');
  const parts = stem.split('_');

  const named = parts[1]?.toLowerCase().replace('multi-sound', 'multi-sound');
  const type =
    KNOWN_TYPES.find((known) => known === named) ??
    TYPE_BY_FOLDER.find(([pattern]) => pattern.test(folder))?.[1] ??
    'other';

  const key = parts.find((part) => KEY_PATTERN.test(part) && part.length <= 4);
  const bpmPart = parts.find((part) => /^\d{2,3}$/.test(part) && Number(part) >= 40 && Number(part) <= 300);

  return {
    name: stem,
    fileName,
    originalName: fileName,
    path: `/${folder}`,
    type,
    category: folder.startsWith('02_LOOPS') ? 'loop' : 'one-shot',
    key,
    bpm: bpmPart ? Number(bpmPart) : undefined,
    format: /\.aif{1,2}$/i.test(fileName) ? 'op-1-aiff' : 'wav',
    rebuiltFromDisk: true,
  };
}

export interface ManifestRebuild {
  /** Files found in the library folders. */
  onDisk: number;
  /** Entries the manifest had before. */
  before: number;
  /** Entries after the rebuild. */
  after: number;
}

/**
 * Add an entry for every file the manifest is missing. Existing entries win —
 * they carry the analysis (LUFS, tags, content hash) that a file name cannot.
 */
export async function rebuildManifestFromDisk(root: LibraryRoot): Promise<ManifestRebuild> {
  const files = await listManagedLibraryFiles(root);
  const existing = await readLibraryManifest(root);

  const byKey = new Map<string, Record<string, unknown>>();
  for (const entry of existing) {
    byKey.set(`${String(entry.path ?? '').replace(/^\//, '')}/${String(entry.fileName ?? '')}`, entry);
  }
  for (const file of files) {
    if (!byKey.has(file.relPath)) byKey.set(file.relPath, entryFromPath(file.relPath));
  }

  await replaceLibraryManifest(root, [...byKey.values()]);
  return { onDisk: files.length, before: existing.length, after: byKey.size };
}
