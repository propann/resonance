import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FsEntry } from './desktopBridge';
import {
  listWorkFolderAudioEntries,
  readWorkFolderAudioFiles,
  workFolderEntryKey,
} from './localLibrary';

/** Minimal fake working folder: a map of dir path -> entries. */
function fakeRoot(tree: Record<string, FsEntry[]>) {
  const readDir = vi.fn(async (rel: string) => tree[rel] ?? []);
  const readFile = vi.fn(async (rel: string) => new TextEncoder().encode(rel).buffer);
  (globalThis as { window?: unknown }).window = {
    resonanceFS: { readDir, readFile, mkdirp: vi.fn(async () => true) },
  };
  return { readDir, readFile };
}

const file = (name: string, size = 10, mtimeMs = 1): FsEntry => ({
  name,
  isDir: false,
  isFile: true,
  size,
  mtimeMs,
});
const dir = (name: string): FsEntry => ({ name, isDir: true, isFile: false, size: 0, mtimeMs: 0 });

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('listWorkFolderAudioEntries', () => {
  it('walks the drop zones, skips managed output folders, and reads no bytes', async () => {
    const { readFile } = fakeRoot({
      '.': [
        file('kick.wav'),
        file('notes.txt'),
        dir('00_RECEPTION'),
        dir('01_ONE_SHOTS'),
        dir('02_LOOPS'),
        dir('03_HARDWARE'),
        dir('_MANIFEST'),
        dir('mon_pack'),
      ],
      '00_RECEPTION': [file('snare.aiff'), dir('nested')],
      '00_RECEPTION/nested': [file('hat.mp3')],
      mon_pack: [file('loop.wav')],
      // Managed output areas must never be visited.
      '01_ONE_SHOTS': [file('should-be-ignored.wav')],
    });

    const entries = await listWorkFolderAudioEntries();
    expect(entries.map((e) => e.sourcePath).sort()).toEqual([
      '00_RECEPTION/nested/hat.mp3',
      '00_RECEPTION/snare.aiff',
      'kick.wav',
      'mon_pack/loop.wav',
    ]);
    expect(readFile).not.toHaveBeenCalled();
  });

  it('carries size and mtime so the key changes when a file is rewritten', async () => {
    fakeRoot({ '.': [file('kick.wav', 128, 1000)] });
    const [entry] = await listWorkFolderAudioEntries();
    expect(workFolderEntryKey(entry)).toBe('kick.wav:128:1000');
    expect(workFolderEntryKey({ ...entry, size: 256 })).not.toBe(workFolderEntryKey(entry));
  });
});

describe('readWorkFolderAudioFiles', () => {
  it('reads exactly the entries it is given', async () => {
    const { readFile } = fakeRoot({
      '.': [file('a.wav'), file('b.wav'), file('c.wav')],
    });
    const entries = await listWorkFolderAudioEntries();
    const files = await readWorkFolderAudioFiles(entries.slice(0, 1));
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(files).toHaveLength(1);
    expect(files[0].sourcePath).toBe('a.wav');
    expect(files[0].file.name).toBe('a.wav');
    expect(files[0].file.lastModified).toBe(1);
  });
});
