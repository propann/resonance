/**
 * Every badge in the sidebar, from one pass over the library.
 *
 * The sidebar asked its question once per badge: `samples.filter(...)` for
 * each of the twenty-one folder rows, again for each type, again for each
 * EP-133 pad group. On a library of 282 000 that is about ten million
 * predicate calls, none of them memoised, in a component that re-rendered on
 * every selection — 232 ms for the folders and 211 ms for the types, measured
 * in the running app.
 *
 * It is all the same walk, so it happens once and the answers are looked up.
 */

import type { FolderItem, SampleType } from '../types/sample';
import { folderIdsWithin, folderMatcher, type FolderPlacement } from './libraryFolders';

export interface LibraryCounts {
  /** How many samples name each folder as theirs. Parents sum their children. */
  byFolderId: Map<string, number>;
  byType: Map<string, number>;
  /** Anything a pad group would call a loop, however it says so. */
  loops: number;
  total: number;
  /**
   * Samples with no folder id, kept aside.
   *
   * `folderMatcher` accepts a sample either by id or by its path sitting under
   * the folder, and a tally by id alone would quietly lose the second kind.
   * There are none in a healthy library, so running the real matcher over just
   * these costs nothing and keeps the badge exactly what the list will show.
   */
  unplaced: FolderPlacement[];
}

/** One walk over the library, from which every badge is answered. */
export function countLibrary(samples: readonly FolderPlacement[]): LibraryCounts {
  const byFolderId = new Map<string, number>();
  const byType = new Map<string, number>();
  const unplaced: FolderPlacement[] = [];
  let loops = 0;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] as FolderPlacement & {
      type?: string;
      isLoop?: boolean;
      category?: string;
    };

    if (sample.folderId) byFolderId.set(sample.folderId, (byFolderId.get(sample.folderId) ?? 0) + 1);
    else unplaced.push(sample);

    if (sample.type) byType.set(sample.type, (byType.get(sample.type) ?? 0) + 1);
    if (sample.isLoop || sample.category === 'loop' || sample.type === 'loop') loops++;
  }

  return { byFolderId, byType, loops, total: samples.length, unplaced };
}

/**
 * How many samples a folder holds, itself and everything under it — the same
 * number `folderMatcher` would have counted.
 */
export function countInFolder(
  counts: LibraryCounts,
  folderId: string,
  folders: FolderItem[]
): number {
  let total = 0;
  for (const id of folderIdsWithin(folderId, folders)) total += counts.byFolderId.get(id) ?? 0;

  if (counts.unplaced.length > 0) {
    const matches = folderMatcher(folderId, folders);
    for (const sample of counts.unplaced) if (matches(sample)) total++;
  }
  return total;
}

/**
 * How many samples a type filter would show. Snares carry claps and hi-hats
 * carry cymbals, because that is how the filter itself reads them.
 */
export function countOfType(counts: LibraryCounts, type: SampleType | 'all'): number {
  if (type === 'all') return counts.total;
  const of = (name: string) => counts.byType.get(name) ?? 0;
  if (type === 'snare') return of('snare') + of('clap');
  if (type === 'hihat') return of('hihat') + of('cymbal');
  return of(type);
}
