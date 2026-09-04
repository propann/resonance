import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryRoot } from './localLibrary';

const DRUMS = '01_ONE_SHOTS/01_DRUMS';
const MANIFEST_FILE = '_MANIFEST/resonance-library.json';

/**
 * A working folder held as a flat set of paths, so a move shows up as the path
 * that disappears and the one that appears. JSON files are kept apart: the
 * manifest is read back as a snapshot, not as a sound.
 */
function fakeLibrary(paths: string[], manifest: Array<Record<string, unknown>> = []) {
  const files = new Set(paths);
  const json = new Map<string, unknown>([[MANIFEST_FILE, { schemaVersion: 1, samples: manifest }]]);
  /** Every manifest snapshot written, oldest first. */
  const written: Array<Array<Record<string, unknown>>> = [];

  const exists = (rel: string) =>
    files.has(rel) || json.has(rel) || [...files].some((p) => p.startsWith(`${rel}/`));

  const readDir = vi.fn(async (rel: string) => {
    const prefix = rel ? `${rel}/` : '';
    const names = new Map<string, boolean>();
    for (const path of files) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash === -1) names.set(rest, true);
      else names.set(rest.slice(0, slash), false);
    }
    return [...names].map(([name, isFile]) => ({
      name,
      isFile,
      isDir: !isFile,
      size: isFile ? 100 : 0,
      mtimeMs: 1,
    }));
  });

  const stat = vi.fn(async (rel: string) => ({
    exists: exists(rel),
    isFile: files.has(rel) || json.has(rel),
    isDir: [...files].some((p) => p.startsWith(`${rel}/`)),
    size: 100,
    mtimeMs: 1,
  }));

  const readFile = vi.fn(async (rel: string) => {
    if (!json.has(rel)) throw new Error(`ENOENT ${rel}`);
    return new TextEncoder().encode(JSON.stringify(json.get(rel))).buffer;
  });

  const writeFile = vi.fn(async (rel: string, data: ArrayBuffer | Uint8Array) => {
    const text = new TextDecoder().decode(data as Uint8Array);
    const parsed = JSON.parse(text) as { samples?: Array<Record<string, unknown>> };
    json.set(rel, parsed);
    if (rel === MANIFEST_FILE) written.push(parsed.samples ?? []);
    return true;
  });

  const rename = vi.fn(async (from: string, to: string) => {
    if (!files.has(from)) throw new Error(`ENOENT ${from}`);
    files.delete(from);
    files.add(to);
  });

  (globalThis as { window?: unknown }).window = {
    resonanceFS: {
      readDir,
      stat,
      readFile,
      writeFile,
      rename,
      mkdirp: vi.fn(async () => true),
      remove: vi.fn(async (rel: string) => {
        files.delete(rel);
        json.delete(rel);
        return true;
      }),
    },
  };

  return { files, json, rename, written, sounds: () => [...files].sort() };
}

const root = {} as LibraryRoot;

/**
 * localLibrary keeps the manifest index in a module-level cache for the life
 * of a session, so each test needs its own copy of the module.
 */
async function loadSorter() {
  vi.resetModules();
  return (await import('./drumSorter')).sortDrumFolder;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('sortDrumFolder', () => {
  it('files each loose sound under its family', async () => {
    const lib = fakeLibrary([
      `${DRUMS}/AZ_Kick_Punchy.wav`,
      `${DRUMS}/AZ_Snare_Tight.wav`,
      `${DRUMS}/AZ_Hihat_Closed.wav`,
      `${DRUMS}/AZ_Clap_Wide.wav`,
      `${DRUMS}/AZ_Crash_Long.wav`,
      `${DRUMS}/AZ_Conga_Hi.wav`,
    ]);
    const sortDrumFolder = await loadSorter();

    const result = await sortDrumFolder(root);

    expect(result.moved).toBe(6);
    expect(result.failed).toBe(0);
    expect(result.perFamily).toEqual({ kicks: 1, snares: 1, hats: 1, claps: 1, cymbals: 1, percs: 1 });
    expect(lib.sounds()).toEqual([
      `${DRUMS}/01_KICKS/AZ_Kick_Punchy.wav`,
      `${DRUMS}/02_SNARES/AZ_Snare_Tight.wav`,
      `${DRUMS}/03_HATS/AZ_Hihat_Closed.wav`,
      `${DRUMS}/04_CLAPS/AZ_Clap_Wide.wav`,
      `${DRUMS}/05_CYMBALS/AZ_Crash_Long.wav`,
      `${DRUMS}/06_PERCS/AZ_Conga_Hi.wav`,
    ]);
  });

  it('never overwrites a sound the family already holds', async () => {
    const lib = fakeLibrary([`${DRUMS}/AZ_Kick_Punchy.wav`, `${DRUMS}/01_KICKS/AZ_Kick_Punchy.wav`]);
    const sortDrumFolder = await loadSorter();

    const result = await sortDrumFolder(root);

    expect(result.moved).toBe(1);
    expect(result.renamed).toBe(1);
    // Both sounds survive: the one already filed, and the newcomer beside it.
    expect(lib.sounds()).toEqual([
      `${DRUMS}/01_KICKS/AZ_Kick_Punchy.wav`,
      `${DRUMS}/01_KICKS/AZ_Kick_Punchy_2.wav`,
    ]);
  });

  it('leaves sounds already filed in the right family alone', async () => {
    const lib = fakeLibrary([`${DRUMS}/01_KICKS/AZ_Kick_A.wav`, `${DRUMS}/06_PERCS/AZ_Shaker_B.wav`]);
    const sortDrumFolder = await loadSorter();

    const result = await sortDrumFolder(root);

    expect(result.moved).toBe(0);
    expect(lib.rename).not.toHaveBeenCalled();
  });

  it('walks back a sound the old rules misfiled', async () => {
    // `Clap_Wide.wav` and `Ride_Bell.wav` used to land in percs, because the
    // word boundary did not see the underscore.
    const lib = fakeLibrary([
      `${DRUMS}/06_PERCS/Clap_Wide.wav`,
      `${DRUMS}/06_PERCS/Ride_Bell.wav`,
      `${DRUMS}/06_PERCS/Conga_Slap.wav`,
    ]);
    const sortDrumFolder = await loadSorter();

    const result = await sortDrumFolder(root);

    expect(result.refiled).toBe(2);
    expect(lib.sounds()).toEqual([
      `${DRUMS}/04_CLAPS/Clap_Wide.wav`,
      `${DRUMS}/05_CYMBALS/Ride_Bell.wav`,
      // The conga belongs in percs and stays there.
      `${DRUMS}/06_PERCS/Conga_Slap.wav`,
    ]);
  });

  it('leaves a hand-filed sound whose name says nothing where it is', async () => {
    const lib = fakeLibrary([`${DRUMS}/06_PERCS/1-004_01.wav`, `${DRUMS}/01_KICKS/mystery_hit.wav`]);
    const sortDrumFolder = await loadSorter();

    const result = await sortDrumFolder(root);

    expect(result.moved).toBe(0);
    expect(result.refiled).toBe(0);
    expect(lib.rename).not.toHaveBeenCalled();
  });

  it('ignores a folder of 01_DRUMS that is not a family', async () => {
    const lib = fakeLibrary([`${DRUMS}/_ARCHIVE/Clap_Wide.wav`]);
    const sortDrumFolder = await loadSorter();

    const result = await sortDrumFolder(root);

    expect(result.moved).toBe(0);
    expect(lib.sounds()).toEqual([`${DRUMS}/_ARCHIVE/Clap_Wide.wav`]);
  });

  it('is safe to run twice', async () => {
    const lib = fakeLibrary([`${DRUMS}/AZ_Kick_Punchy.wav`]);
    const sortDrumFolder = await loadSorter();

    await sortDrumFolder(root);
    const second = await sortDrumFolder(root);

    expect(second.moved).toBe(0);
    expect(lib.sounds()).toEqual([`${DRUMS}/01_KICKS/AZ_Kick_Punchy.wav`]);
  });

  it('follows the moved file in the manifest, new name included', async () => {
    const lib = fakeLibrary(
      [`${DRUMS}/AZ_Kick_Punchy.wav`, `${DRUMS}/01_KICKS/AZ_Kick_Punchy.wav`],
      [
        { path: '/01_ONE_SHOTS/01_DRUMS', fileName: 'AZ_Kick_Punchy.wav', name: 'Punchy' },
        { path: '/01_ONE_SHOTS/02_BASS_808', fileName: 'AZ_808_Deep.wav', name: 'Deep' },
      ]
    );
    const sortDrumFolder = await loadSorter();

    await sortDrumFolder(root);

    const manifest = lib.written.at(-1);
    expect(manifest).toBeDefined();
    expect(manifest![0]).toMatchObject({
      path: '/01_ONE_SHOTS/01_DRUMS/01_KICKS',
      fileName: 'AZ_Kick_Punchy_2.wav',
      name: 'Punchy',
    });
    // An entry the pass did not touch stays exactly as it was.
    expect(manifest![1]).toMatchObject({
      path: '/01_ONE_SHOTS/02_BASS_808',
      fileName: 'AZ_808_Deep.wav',
    });
  });

  it('counts a file it could not move instead of dropping the pass', async () => {
    const lib = fakeLibrary([`${DRUMS}/AZ_Kick_A.wav`, `${DRUMS}/AZ_Snare_B.wav`]);
    lib.rename.mockImplementationOnce(async () => {
      throw new Error('EPERM');
    });
    const sortDrumFolder = await loadSorter();

    const result = await sortDrumFolder(root);

    expect(result.failed).toBe(1);
    expect(result.moved).toBe(1);
  });
});
