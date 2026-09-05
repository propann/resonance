import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryRoot } from './localLibrary';

/**
 * A working folder as a set of file paths. Directories exist implicitly, as
 * prefixes — except the ones listed in `dirs`, which is how an emptied folder
 * that still sits on disk is represented.
 */
function fakeTree(files: string[], dirs: string[] = []) {
  const filePaths = new Set(files);
  const dirPaths = new Set(dirs);
  for (const path of files) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) dirPaths.add(parts.slice(0, i).join('/'));
  }

  const readDir = vi.fn(async (rel: string) => {
    const prefix = rel ? `${rel}/` : '';
    const seen = new Map<string, boolean>();
    for (const path of filePaths) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash === -1) seen.set(rest, true);
      else seen.set(rest.slice(0, slash), false);
    }
    for (const dir of dirPaths) {
      if (!dir.startsWith(prefix) || dir === rel) continue;
      const rest = dir.slice(prefix.length);
      const slash = rest.indexOf('/');
      const name = slash === -1 ? rest : rest.slice(0, slash);
      if (!seen.has(name)) seen.set(name, false);
    }
    return [...seen].map(([name, isFile]) => ({
      name,
      isFile,
      isDir: !isFile,
      size: 0,
      mtimeMs: 0,
    }));
  });

  const remove = vi.fn(async (rel: string) => {
    dirPaths.delete(rel);
    filePaths.delete(rel);
    return true;
  });

  (globalThis as { window?: unknown }).window = {
    resonanceFS: { readDir, remove, mkdirp: vi.fn(async () => true) },
  };
  return { dirPaths, remove, removed: () => remove.mock.calls.map((c) => c[0] as string).sort() };
}

const root = {} as LibraryRoot;

async function load() {
  vi.resetModules();
  return (await import('./localLibrary')).removeEmptyManagedFolders;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('removeEmptyManagedFolders', () => {
  // The complaint that prompted this: a pack dropped in reception has every
  // file transferred, and leaves a tree of empty directories reading as work
  // still to do.
  it('clears the empty tree a transferred pack leaves in reception', async () => {
    const tree = fakeTree(
      ['01_ONE_SHOTS/01_DRUMS/01_KICKS/kick.wav'],
      ['00_RECEPTION/PACK_A/KICKS', '00_RECEPTION/PACK_A/SNARES', '00_RECEPTION/PACK_B']
    );
    const removeEmptyManagedFolders = await load();

    const removed = await removeEmptyManagedFolders(root);

    expect(removed).toBe(4);
    expect(tree.removed()).toEqual([
      '00_RECEPTION/PACK_A',
      '00_RECEPTION/PACK_A/KICKS',
      '00_RECEPTION/PACK_A/SNARES',
      '00_RECEPTION/PACK_B',
    ]);
  });

  it('leaves a reception folder that still holds a sound', async () => {
    const tree = fakeTree(['00_RECEPTION/PACK_A/still-here.wav'], ['00_RECEPTION/PACK_B']);
    const removeEmptyManagedFolders = await load();

    await removeEmptyManagedFolders(root);

    expect(tree.removed()).toEqual(['00_RECEPTION/PACK_B']);
  });

  // The library's own folders are expected to exist whether or not they hold
  // anything; removing them would make the app rebuild them on next launch.
  it('never removes the folders the library creates at startup', async () => {
    const tree = fakeTree([], [
      '00_RECEPTION',
      '01_ONE_SHOTS',
      '01_ONE_SHOTS/01_DRUMS',
      '01_ONE_SHOTS/01_DRUMS/01_KICKS',
      '02_LOOPS',
      '03_HARDWARE',
    ]);
    const removeEmptyManagedFolders = await load();

    const removed = await removeEmptyManagedFolders(root);

    expect(removed).toBe(0);
    expect(tree.removed()).toEqual([]);
  });

  it('clears a nested tree from the inside out', async () => {
    const tree = fakeTree([], ['00_RECEPTION/A/B/C']);
    const removeEmptyManagedFolders = await load();

    await removeEmptyManagedFolders(root);

    // Deepest first: a folder can only go once its children have.
    expect(tree.remove.mock.calls.map((c) => c[0])).toEqual([
      '00_RECEPTION/A/B/C',
      '00_RECEPTION/A/B',
      '00_RECEPTION/A',
    ]);
  });

  it('keeps a branch whose deepest folder still holds something', async () => {
    const tree = fakeTree(['00_RECEPTION/A/B/C/keep.wav'], []);
    const removeEmptyManagedFolders = await load();

    expect(await removeEmptyManagedFolders(root)).toBe(0);
    expect(tree.removed()).toEqual([]);
  });

  it('has nothing to do on an empty working folder', async () => {
    const tree = fakeTree([], []);
    const removeEmptyManagedFolders = await load();

    expect(await removeEmptyManagedFolders(root)).toBe(0);
    expect(tree.removed()).toEqual([]);
  });
});
