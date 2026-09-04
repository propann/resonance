/**
 * Second sorting pass over 01_DRUMS: everything sitting loose in the folder is
 * moved into its family (kicks, snares, hats, claps, cymbals, percs) and the
 * manifest follows. Files are moved, never rewritten — a rename keeps the
 * audio and its analysis untouched.
 */
import {
  listManagedLibraryFiles,
  moveLibraryFileInto,
  readLibraryManifest,
  replaceLibraryManifest,
  resetDirectoryNameCache,
  type LibraryRoot,
} from './localLibrary';
import {
  DRUM_FAMILY_FOLDERS,
  drumFamilyFor,
  drumFamilyFromName,
  type DrumFamily,
} from './proFolderOrganizer';
import type { SampleType } from '../types/sample';

const DRUMS_DIR = '01_ONE_SHOTS/01_DRUMS';

/** `01_KICKS` → `kicks`, to read which family a file is currently filed under. */
const FAMILY_BY_FOLDER = new Map(
  (Object.entries(DRUM_FAMILY_FOLDERS) as Array<[DrumFamily, string]>).map(([family, folder]) => [
    folder,
    family,
  ])
);

export interface DrumSortResult {
  moved: number;
  /** How many files landed in each family. */
  perFamily: Record<string, number>;
  failed: number;
  /** Files that had to be renamed because the family already held that name. */
  renamed: number;
  /** Files that were in the wrong family folder and got moved to the right one. */
  refiled: number;
}

/** `AZ_Kick_Punch_01_Cm.wav` → `kick`, so a moved file keeps its detected type. */
function typeFromName(name: string): SampleType | undefined {
  const parts = name.replace(/\.[^/.]+$/, '').split('_');
  const candidate = parts[1]?.toLowerCase();
  const known: SampleType[] = ['kick', 'snare', 'hihat', 'clap', 'cymbal', 'percussion'];
  return known.find((type) => type === candidate);
}

/** One move that happened, keyed by where the file used to be. */
interface DrumMove {
  path: string;
  name: string;
  family: DrumFamily;
}

/**
 * File every drum sound under its family: the ones loose in 01_DRUMS, and the
 * ones an earlier pass put in the wrong family folder. Running it again on a
 * tidy library moves nothing.
 */
export async function sortDrumFolder(root: LibraryRoot): Promise<DrumSortResult> {
  const files = await listManagedLibraryFiles(root);

  /**
   * What to do with one file: the family it should be in, or nothing.
   *
   * A file loose in 01_DRUMS is always filed. A file already inside a family
   * folder is only moved when its name names a different family — the rules
   * used to misread `Clap_Wide.wav` and pile such sounds into percs, and this
   * is what walks them back. A name that says nothing leaves the file where it
   * is, so hand-filing survives the pass.
   */
  const plan = (relPath: string, name: string): DrumFamily | undefined => {
    const parent = relPath.slice(0, relPath.lastIndexOf('/'));
    if (parent === DRUMS_DIR) return drumFamilyFor(typeFromName(name), name);
    const current = FAMILY_BY_FOLDER.get(parent.slice(`${DRUMS_DIR}/`.length));
    if (!current || parent !== `${DRUMS_DIR}/${DRUM_FAMILY_FOLDERS[current]}`) return undefined;
    const named = drumFamilyFromName(name);
    return named && named !== current ? named : undefined;
  };

  const perFamily: Record<string, number> = {};
  const moves = new Map<string, DrumMove>();
  let failed = 0;
  let renamed = 0;
  let refiled = 0;

  // The families are about to gain files; start from a fresh listing so the
  // free-name search sees what is really there.
  resetDirectoryNameCache();

  for (const file of files) {
    const family = plan(file.relPath, file.name);
    if (!family) continue;
    const wasFiled = file.relPath.slice(0, file.relPath.lastIndexOf('/')) !== DRUMS_DIR;
    try {
      const target = await moveLibraryFileInto(
        file.relPath,
        `${DRUMS_DIR}/${DRUM_FAMILY_FOLDERS[family]}`,
        file.name
      );
      const name = target.slice(target.lastIndexOf('/') + 1);
      if (name !== file.name) renamed++;
      if (wasFiled) refiled++;
      moves.set(file.relPath, { path: target, name, family });
      perFamily[family] = (perFamily[family] ?? 0) + 1;
    } catch {
      failed++;
    }
  }

  if (moves.size > 0) {
    const manifest = await readLibraryManifest(root);
    const updated = manifest.map((entry) => {
      const relPath = `${String(entry.path ?? '').replace(/^\//, '')}/${String(entry.fileName ?? '')}`;
      const move = moves.get(relPath);
      if (!move) return entry;
      // The name can have changed to dodge a collision: carry it over, or the
      // manifest would point at a file that is not there.
      return {
        ...entry,
        path: `/${move.path.slice(0, move.path.lastIndexOf('/'))}`,
        fileName: move.name,
      };
    });
    await replaceLibraryManifest(root, updated);
  }

  return { moved: moves.size, perFamily, failed, renamed, refiled };
}
