import { describe, expect, it } from 'vitest';
import { groupByHash, groupBySize, isCollisionCopy, pickKeeper } from './libraryDedupe';
import type { ManagedLibraryFile } from './localLibrary';

const f = (relPath: string, size: number, mtimeMs = 1000): ManagedLibraryFile => ({
  relPath,
  name: relPath.split('/').pop() ?? relPath,
  size,
  mtimeMs,
});

describe('groupBySize', () => {
  it('keeps only sizes shared by several files — the rest cannot be duplicates', () => {
    const groups = groupBySize([f('a/x.wav', 100), f('a/y.wav', 100), f('a/z.wav', 200)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((x) => x.name).sort()).toEqual(['x.wav', 'y.wav']);
  });

  it('returns nothing when every file has its own size', () => {
    expect(groupBySize([f('a.wav', 1), f('b.wav', 2)])).toEqual([]);
  });
});

describe('pickKeeper', () => {
  it('keeps the name that was not pushed aside by a collision suffix', () => {
    const keep = pickKeeper([f('a/kick_2.wav', 10), f('a/kick.wav', 10), f('a/kick_3.wav', 10)]);
    expect(keep.name).toBe('kick.wav');
  });

  it('does not mistake a trailing BPM for a collision suffix', () => {
    const files = [
      f('a/AZ_Loop_Drumloop_Cmaj_171_2.wav', 10, 200),
      f('a/AZ_Loop_Drumloop_Cmaj_171.wav', 10, 100),
    ];
    expect(pickKeeper(files).name).toBe('AZ_Loop_Drumloop_Cmaj_171.wav');
    expect(isCollisionCopy(files[0], files)).toBe(true);
    expect(isCollisionCopy(files[1], files)).toBe(false);
  });

  it('falls back to the oldest file, then the shortest name', () => {
    expect(pickKeeper([f('a/aa.wav', 10, 500), f('b/bb.wav', 10, 100)]).relPath).toBe('b/bb.wav');
    expect(pickKeeper([f('a/kick_long_name.wav', 10), f('a/kick.wav', 10)]).name).toBe('kick.wav');
  });

  it('still picks one when every copy carries a collision suffix', () => {
    const keep = pickKeeper([f('a/kick_2.wav', 10, 300), f('a/kick_3.wav', 10, 100)]);
    expect(keep.name).toBe('kick_3.wav');
  });

  it('is deterministic whatever the input order', () => {
    const files = [f('b/kick.wav', 10, 100), f('a/kick.wav', 10, 100)];
    expect(pickKeeper(files).relPath).toBe(pickKeeper([...files].reverse()).relPath);
  });
});

describe('groupByHash', () => {
  const bucket = [f('a/kick.wav', 10), f('a/kick_2.wav', 10), f('a/other.wav', 10)];

  it('groups identical content and marks the extra copies', () => {
    const hashes = new Map([
      ['a/kick.wav', 'h1'],
      ['a/kick_2.wav', 'h1'],
      ['a/other.wav', 'h2'],
    ]);
    const groups = groupByHash(hashes, bucket);
    expect(groups).toHaveLength(1);
    expect(groups[0].keep.name).toBe('kick.wav');
    expect(groups[0].duplicates.map((d) => d.name)).toEqual(['kick_2.wav']);
  });

  it('ignores files whose hash could not be read', () => {
    expect(groupByHash(new Map(), bucket)).toEqual([]);
  });
});
