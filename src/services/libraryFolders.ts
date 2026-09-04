/**
 * One reading of the folder tree, shared by everything that asks "where does
 * this sound live?".
 *
 * Three things used to answer that question separately: the sidebar counted a
 * folder by comparing paths, the library filter compared folder ids, and the
 * manifest hydration re-guessed the id from the file name. They disagreed —
 * a badge could read 400 over a list that showed nothing. This module is the
 * single answer, and `DEFAULT_FOLDERS` (the tree actually created on disk) is
 * its only source.
 */
import { DEFAULT_FOLDERS } from '../data/defaultSampleLibrary';
import type { FolderItem } from '../types/sample';

/** `01_ONE_SHOTS/01_DRUMS/` and `/01_ONE_SHOTS/01_DRUMS` are the same folder. */
export function normalizeFolderPath(path: string): string {
  const trimmed = path.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed ? `/${trimmed}` : '/';
}

/** Path of a library folder relative to the working folder, no leading slash. */
export const diskPathForFolder = (folder: FolderItem): string =>
  normalizeFolderPath(folder.path).slice(1);

const ID_BY_PATH = new Map(DEFAULT_FOLDERS.map((f) => [normalizeFolderPath(f.path), f.id]));

/**
 * The folder id a file on disk belongs to, from where it actually sits —
 * `/01_ONE_SHOTS/01_DRUMS/01_KICKS` → `f-os-drums-kicks`. Returns undefined
 * for a path outside the managed tree, so the caller can fall back to
 * classifying by name.
 */
export const folderIdForPath = (path: string): string | undefined =>
  ID_BY_PATH.get(normalizeFolderPath(path));

/** Every folder nested under `folderId`, itself included. */
export function folderIdsWithin(folderId: string, folders: FolderItem[] = DEFAULT_FOLDERS): Set<string> {
  const ids = new Set([folderId]);
  // The tree is three levels deep; loop until nothing new is added so the
  // order of `folders` never matters.
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** What a sample has to say about where it lives. */
interface FolderPlacement {
  folderId?: string;
  folderPath?: string;
}

/**
 * Builds the "is this sample in that folder?" test used by both the library
 * filter and the sidebar badge, so the two can never drift apart again.
 * Selecting a parent folder includes everything below it — picking 01_DRUMS
 * shows the kicks, snares and hats it contains.
 *
 * Pass `null` for "no folder selected": every sample matches.
 */
export function folderMatcher(
  folderId: string | null,
  folders: FolderItem[] = DEFAULT_FOLDERS
): (sample: FolderPlacement) => boolean {
  if (!folderId) return () => true;

  const ids = folderIdsWithin(folderId, folders);
  const folder = folders.find((f) => f.id === folderId);
  const base = folder ? normalizeFolderPath(folder.path) : undefined;

  return (sample) => {
    if (sample.folderId && ids.has(sample.folderId)) return true;
    if (!base || !sample.folderPath) return false;
    const path = normalizeFolderPath(sample.folderPath);
    // `/02_LOOPS` must not swallow a `/02_LOOPS_ARCHIVE` sitting beside it.
    return path === base || path.startsWith(`${base}/`);
  };
}
