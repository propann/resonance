import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryRoot } from './localLibrary';

const MANIFEST_FILE = '_MANIFEST/resonance-library.json';

/** A working folder as a flat set of paths; a move is a path that changes. */
function fakeLibrary(paths: string[], manifest: Array<Record<string, unknown>> = []) {
  const files = new Set(paths);
  const json = new Map<string, unknown>([[MANIFEST_FILE, { schemaVersion: 1, samples: manifest }]]);
  const written: Array<Array<Record<string, unknown>>> = [];

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
      size: 100,
      mtimeMs: 1,
    }));
  });

  const rename = vi.fn(async (from: string, to: string) => {
    if (!files.has(from)) throw new Error(`ENOENT ${from}`);
    files.delete(from);
    files.add(to);
  });

  (globalThis as { window?: unknown }).window = {
    resonanceFS: {
      readDir,
      rename,
      stat: vi.fn(async (rel: string) => ({
        exists: files.has(rel) || json.has(rel) || [...files].some((p) => p.startsWith(`${rel}/`)),
        isFile: files.has(rel) || json.has(rel),
        isDir: [...files].some((p) => p.startsWith(`${rel}/`)),
        size: 100,
        mtimeMs: 1,
      })),
      readFile: vi.fn(async (rel: string) => {
        if (!json.has(rel)) throw new Error(`ENOENT ${rel}`);
        return new TextEncoder().encode(JSON.stringify(json.get(rel))).buffer;
      }),
      writeFile: vi.fn(async (rel: string, data: Uint8Array) => {
        const parsed = JSON.parse(new TextDecoder().decode(data)) as {
          samples?: Array<Record<string, unknown>>;
        };
        json.set(rel, parsed);
        if (rel === MANIFEST_FILE) written.push(parsed.samples ?? []);
        return true;
      }),
      mkdirp: vi.fn(async () => true),
      remove: vi.fn(async () => true),
    },
  };

  return { files, rename, written, sounds: () => [...files].sort() };
}

const root = {} as LibraryRoot;

/** localLibrary caches the manifest per session, so reload it for each test. */
async function loadSorter() {
  vi.resetModules();
  return (await import('./librarySorter')).sortLibrary;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('sortLibrary', () => {
  it('files a sound the name states, wherever it currently sits', async () => {
    const lib = fakeLibrary([
      '01_ONE_SHOTS/01_DRUMS/AZ_Kick_Punchy.wav',
      '01_ONE_SHOTS/01_DRUMS/06_PERCS/AZ_Clap_Wide.wav',
      '01_ONE_SHOTS/05_FX_TEXTURES/AZ_Vocal_Ahh.wav',
    ]);
    const sortLibrary = await loadSorter();

    const result = await sortLibrary(root);

    expect(result.moved).toBe(3);
    expect(result.failed).toBe(0);
    expect(lib.sounds()).toEqual([
      '01_ONE_SHOTS/01_DRUMS/01_KICKS/AZ_Kick_Punchy.wav',
      '01_ONE_SHOTS/01_DRUMS/04_CLAPS/AZ_Clap_Wide.wav',
      '01_ONE_SHOTS/04_VOCALS/AZ_Vocal_Ahh.wav',
    ]);
  });

  it('leaves a sound nobody can name where it is', async () => {
    const lib = fakeLibrary(['01_ONE_SHOTS/05_FX_TEXTURES/1-004_01.wav']);
    const sortLibrary = await loadSorter();

    const result = await sortLibrary(root);

    expect(result.skipped).toBe(1);
    expect(result.moved).toBe(0);
    expect(lib.rename).not.toHaveBeenCalled();
  });

  it('falls back to the type the manifest holds', async () => {
    // The name says nothing, but the acoustic analysis called it a kick.
    const lib = fakeLibrary(
      ['01_ONE_SHOTS/05_FX_TEXTURES/1-004_01.wav'],
      [{ path: '/01_ONE_SHOTS/05_FX_TEXTURES', fileName: '1-004_01.wav', type: 'kick' }]
    );
    const sortLibrary = await loadSorter();

    const result = await sortLibrary(root);

    expect(result.moved).toBe(1);
    expect(lib.sounds()).toEqual(['01_ONE_SHOTS/01_DRUMS/01_KICKS/1-004_01.wav']);
  });

  it('never touches the hardware patches', async () => {
    const lib = fakeLibrary(['03_HARDWARE/OP-1_DRUM_PATCHES/AZ_Kick_Kit.aif']);
    const sortLibrary = await loadSorter();

    const result = await sortLibrary(root);

    expect(result.scanned).toBe(0);
    expect(lib.sounds()).toEqual(['03_HARDWARE/OP-1_DRUM_PATCHES/AZ_Kick_Kit.aif']);
  });

  it('never overwrites a namesake at the destination', async () => {
    const lib = fakeLibrary([
      '01_ONE_SHOTS/01_DRUMS/AZ_Kick_Punchy.wav',
      '01_ONE_SHOTS/01_DRUMS/01_KICKS/AZ_Kick_Punchy.wav',
    ]);
    const sortLibrary = await loadSorter();

    const result = await sortLibrary(root);

    expect(result.renamed).toBe(1);
    expect(lib.sounds()).toEqual([
      '01_ONE_SHOTS/01_DRUMS/01_KICKS/AZ_Kick_Punchy.wav',
      '01_ONE_SHOTS/01_DRUMS/01_KICKS/AZ_Kick_Punchy_2.wav',
    ]);
  });

  it('a dry run reports the moves and touches nothing', async () => {
    const lib = fakeLibrary(['01_ONE_SHOTS/01_DRUMS/AZ_Kick_Punchy.wav']);
    const sortLibrary = await loadSorter();

    const result = await sortLibrary(root, { dryRun: true });

    expect(result.moved).toBe(1);
    expect(result.perMove).toEqual({
      '01_ONE_SHOTS/01_DRUMS -> 01_ONE_SHOTS/01_DRUMS/01_KICKS': 1,
    });
    expect(lib.rename).not.toHaveBeenCalled();
    expect(lib.sounds()).toEqual(['01_ONE_SHOTS/01_DRUMS/AZ_Kick_Punchy.wav']);
  });

  it('is safe to run twice', async () => {
    const lib = fakeLibrary(['01_ONE_SHOTS/01_DRUMS/AZ_Snare_Tight.wav']);
    const sortLibrary = await loadSorter();

    await sortLibrary(root);
    const second = await sortLibrary(root);

    expect(second.moved).toBe(0);
    expect(second.inPlace).toBe(1);
    expect(lib.sounds()).toEqual(['01_ONE_SHOTS/01_DRUMS/02_SNARES/AZ_Snare_Tight.wav']);
  });

  it('carries the moved file over in the manifest', async () => {
    const lib = fakeLibrary(
      ['01_ONE_SHOTS/01_DRUMS/AZ_Kick_Punchy.wav'],
      [
        { path: '/01_ONE_SHOTS/01_DRUMS', fileName: 'AZ_Kick_Punchy.wav', name: 'Punchy', type: 'kick' },
        { path: '/01_ONE_SHOTS/04_VOCALS', fileName: 'AZ_Vocal_Ahh.wav', name: 'Ahh', type: 'vocal' },
      ]
    );
    const sortLibrary = await loadSorter();

    await sortLibrary(root);

    const manifest = lib.written.at(-1);
    expect(manifest![0]).toMatchObject({
      path: '/01_ONE_SHOTS/01_DRUMS/01_KICKS',
      fileName: 'AZ_Kick_Punchy.wav',
      name: 'Punchy',
    });
    // An entry the pass did not touch is left exactly as it was.
    expect(manifest![1]).toMatchObject({ path: '/01_ONE_SHOTS/04_VOCALS', fileName: 'AZ_Vocal_Ahh.wav' });
  });

  it('reports progress up to the total', async () => {
    fakeLibrary(['01_ONE_SHOTS/01_DRUMS/AZ_Kick_A.wav', '01_ONE_SHOTS/01_DRUMS/AZ_Kick_B.wav']);
    const sortLibrary = await loadSorter();

    const seen: Array<[number, number]> = [];
    await sortLibrary(root, { onProgress: (done, total) => seen.push([done, total]) });

    expect(seen.at(-1)).toEqual([2, 2]);
  });
});
