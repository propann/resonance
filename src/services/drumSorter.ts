/**
 * Second sorting pass over 01_DRUMS: everything sitting loose in the folder is
 * moved into its family (kicks, snares, hats, claps, cymbals, percs) and the
 * manifest follows. Files are moved, never rewritten — a rename keeps the
 * audio and its analysis untouched.
 */
import {
  listManagedLibraryFiles,
  readLibraryManifest,
  renameLibraryFile,
  replaceLibraryManifest,
  type LibraryRoot,
} from './localLibrary';
import { DRUM_FAMILY_FOLDERS, drumFamilyFor, type DrumFamily } from './proFolderOrganizer';
import type { SampleType } from '../types/sample';

const DRUMS_DIR = '01_ONE_SHOTS/01_DRUMS';

export interface DrumSortResult {
  moved: number;
  /** How many files landed in each family. */
  perFamily: Record<string, number>;
  failed: number;
}

/** `AZ_Kick_Punch_01_Cm.wav` → `kick`, so a moved file keeps its detected type. */
function typeFromName(name: string): SampleType | undefined {
  const parts = name.replace(/\.[^/.]+$/, '').split('_');
  const candidate = parts[1]?.toLowerCase();
  const known: SampleType[] = ['kick', 'snare', 'hihat', 'clap', 'cymbal', 'percussion'];
  return known.find((type) => type === candidate);
}

/**
 * Move every loose file of 01_DRUMS into its family folder. Files already in a
 * family are left alone, so the pass is safe to run again.
 */
export async function sortDrumFolder(root: LibraryRoot): Promise<DrumSortResult> {
  const files = await listManagedLibraryFiles(root);
  const loose = files.filter((file) => {
    const parent = file.relPath.slice(0, file.relPath.lastIndexOf('/'));
    return parent === DRUMS_DIR;
  });

  const perFamily: Record<string, number> = {};
  const movedPaths = new Map<string, { path: string; family: DrumFamily }>();
  let failed = 0;

  for (const file of loose) {
    const family = drumFamilyFor(typeFromName(file.name), file.name);
    const target = `${DRUMS_DIR}/${DRUM_FAMILY_FOLDERS[family]}/${file.name}`;
    try {
      await renameLibraryFile(file.relPath, target);
      movedPaths.set(file.relPath, { path: target, family });
      perFamily[family] = (perFamily[family] ?? 0) + 1;
    } catch {
      failed++;
    }
  }

  if (movedPaths.size > 0) {
    const manifest = await readLibraryManifest(root);
    const updated = manifest.map((entry) => {
      const relPath = `${String(entry.path ?? '').replace(/^\//, '')}/${String(entry.fileName ?? '')}`;
      const move = movedPaths.get(relPath);
      if (!move) return entry;
      return { ...entry, path: `/${move.path.slice(0, move.path.lastIndexOf('/'))}` };
    });
    await replaceLibraryManifest(root, updated);
  }

  return { moved: movedPaths.size, perFamily, failed };
}
