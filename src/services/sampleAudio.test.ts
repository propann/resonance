import { beforeEach, describe, expect, it, vi } from 'vitest';

const readLibraryAudioFile = vi.fn();
const decodeAudioData = vi.fn();

vi.mock('./localLibrary', () => ({
  readLibraryAudioFile: (...args: unknown[]) => readLibraryAudioFile(...args),
}));
vi.mock('./audioEngine', () => ({
  audioEngine: { decodeAudioData: (...args: unknown[]) => decodeAudioData(...args) },
}));

import {
  cacheSampleAudio,
  loadSampleAudio,
  peekSampleAudio,
  releaseSampleAudio,
} from './sampleAudio';
import { cacheBuffer, clearBufferCache } from './audioBufferCache';
import type { SampleItem } from '../types/sample';

/** Only the fields this service looks at. */
const item = (fields: Partial<SampleItem>) => fields as SampleItem;
const sound = (seconds = 1) => ({ duration: seconds }) as AudioBuffer;
const fileOf = (bytes = 8) =>
  ({ size: bytes, arrayBuffer: async () => new ArrayBuffer(bytes) }) as unknown as File;

beforeEach(() => {
  clearBufferCache();
  readLibraryAudioFile.mockReset();
  decodeAudioData.mockReset();
  // Node has no object URLs, and the cache hands them out alongside buffers.
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('loadSampleAudio', () => {
  // A recording or a rack render has no file; its sound is filed under its id.
  it('hands back the audio of a sample that was never written to disk', async () => {
    const recorded = sound();
    const take = item({ id: 'take-1' });
    cacheSampleAudio(take, recorded);

    expect(await loadSampleAudio(take)).toBe(recorded);
    expect(readLibraryAudioFile).not.toHaveBeenCalled();
  });

  // Ingestion creates samples with no disk path by the thousand and writes
  // them out moments later. Holding on to each of those filled 6 GB, so the
  // default has to be the evictable one.
  it('lets go of a cached sound like any other unless told otherwise', async () => {
    const take = item({ id: 'take-1' });
    cacheSampleAudio(take, sound(30));
    for (let i = 0; i < 20; i++) cacheBuffer(`loop${i}.wav`, sound(100));

    expect(await loadSampleAudio(take)).toBeUndefined();
  });

  it('keeps a sound the caller says is the only copy', async () => {
    const take = item({ id: 'take-1' });
    cacheSampleAudio(take, sound(30), true);
    for (let i = 0; i < 20; i++) cacheBuffer(`loop${i}.wav`, sound(100));

    expect(await loadSampleAudio(take)).toBeDefined();
  });

  it('lets that one go once it has been written somewhere', async () => {
    const take = item({ id: 'take-1' });
    cacheSampleAudio(take, sound(30), true);
    releaseSampleAudio(take);
    for (let i = 0; i < 20; i++) cacheBuffer(`loop${i}.wav`, sound(100));

    expect(await loadSampleAudio(take)).toBeUndefined();
  });

  it('files a sample that has a file under its path, not its id', async () => {
    const kick = sound();
    cacheSampleAudio(item({ id: 'disk-x', diskPath: '01_KICKS/k.wav' }), kick);

    expect(peekSampleAudio(item({ id: 'other', diskPath: '01_KICKS/k.wav' }))).toBe(kick);
    expect(peekSampleAudio(item({ id: 'disk-x' }))).toBeUndefined();
  });

  it('hands back a cached buffer, touching no disk', async () => {
    const kick = sound();
    cacheBuffer('01_KICKS/kick.wav', kick);
    const buffer = await loadSampleAudio(item({ diskPath: '01_KICKS/kick.wav' }));
    expect(buffer).toBe(kick);
    expect(readLibraryAudioFile).not.toHaveBeenCalled();
  });

  it('reads and decodes on a miss, then keeps the result', async () => {
    const decoded = sound();
    readLibraryAudioFile.mockResolvedValue(fileOf());
    decodeAudioData.mockResolvedValue(decoded);

    const sample = item({ diskPath: '01_KICKS/kick.wav' });
    expect(await loadSampleAudio(sample)).toBe(decoded);
    // Second time round it comes from the cache, not from another read.
    expect(await loadSampleAudio(sample)).toBe(decoded);
    expect(readLibraryAudioFile).toHaveBeenCalledTimes(1);
  });

  // Selecting a row and hitting its play button ask within the same frame.
  it('decodes once when two callers ask for the same file at once', async () => {
    readLibraryAudioFile.mockResolvedValue(fileOf());
    decodeAudioData.mockResolvedValue(sound());

    const sample = item({ diskPath: '02_LOOPS/loop.wav' });
    const [first, second] = await Promise.all([
      loadSampleAudio(sample),
      loadSampleAudio(sample),
    ]);

    expect(first).toBe(second);
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
  });

  it('has nothing to offer for a sample that never touched disk', async () => {
    expect(await loadSampleAudio(item({ name: 'take 1' }))).toBeUndefined();
    expect(await loadSampleAudio(item({ diskPath: undefined }))).toBeUndefined();
    expect(await loadSampleAudio(null)).toBeUndefined();
  });

  it('gives up quietly on an unreadable file rather than throwing at the caller', async () => {
    readLibraryAudioFile.mockRejectedValue(new Error('disparu'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await loadSampleAudio(item({ diskPath: 'gone.wav' }))).toBeUndefined();
    // The failure is not remembered: a later attempt tries the file again.
    readLibraryAudioFile.mockResolvedValue(fileOf());
    decodeAudioData.mockResolvedValue(sound());
    expect(await loadSampleAudio(item({ diskPath: 'gone.wav' }))).toBeDefined();
  });
});

describe('peekSampleAudio', () => {
  it('reports only what is already to hand', () => {
    cacheBuffer('here.wav', sound());
    expect(peekSampleAudio(item({ diskPath: 'here.wav' }))).toBeDefined();
    expect(peekSampleAudio(item({ diskPath: 'elsewhere.wav' }))).toBeUndefined();
    expect(peekSampleAudio(null)).toBeUndefined();
    expect(readLibraryAudioFile).not.toHaveBeenCalled();
  });
});
