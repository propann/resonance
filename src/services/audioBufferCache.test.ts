import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheBuffer,
  cacheStats,
  clearBufferCache,
  getCachedBuffer,
  unpinBuffer,
} from './audioBufferCache';

/** Just the one property the cache reads. */
const sound = (seconds: number) => ({ duration: seconds }) as AudioBuffer;

beforeEach(() => clearBufferCache());

describe('audioBufferCache', () => {
  it('gives back what it was given', () => {
    const kick = sound(0.5);
    cacheBuffer('01_KICKS/kick.wav', kick);
    expect(getCachedBuffer('01_KICKS/kick.wav')).toBe(kick);
  });

  it('says nothing about a sound it does not hold', () => {
    expect(getCachedBuffer('nowhere.wav')).toBeUndefined();
  });

  it('ignores an empty key rather than caching under it', () => {
    cacheBuffer('', sound(1));
    expect(cacheStats().count).toBe(0);
  });

  it('replaces a sound cached twice without counting it twice', () => {
    cacheBuffer('a.wav', sound(10));
    cacheBuffer('a.wav', sound(20));
    expect(cacheStats().count).toBe(1);
    expect(cacheStats().seconds).toBe(20);
  });

  // The budget is in seconds of audio, not in entries: a hundred kicks and a
  // hundred four-minute loops are not the same amount of memory.
  it('evicts once it holds more audio than its budget', () => {
    for (let i = 0; i < 8; i++) cacheBuffer(`loop${i}.wav`, sound(100));
    expect(cacheStats().seconds).toBeLessThanOrEqual(600);
    expect(cacheStats().count).toBeLessThan(8);
  });

  it('evicts the one wanted longest ago, not the one added longest ago', () => {
    cacheBuffer('first.wav', sound(200));
    cacheBuffer('second.wav', sound(200));
    cacheBuffer('third.wav', sound(200));
    // Ask for the oldest, which should protect it from the next eviction.
    expect(getCachedBuffer('first.wav')).toBeDefined();
    cacheBuffer('fourth.wav', sound(200));

    expect(getCachedBuffer('first.wav')).toBeDefined();
    expect(getCachedBuffer('second.wav')).toBeUndefined();
  });

  // Caching it would throw everything else out to hold one sound that still
  // does not fit.
  it('refuses a sound longer than the whole budget', () => {
    cacheBuffer('kick.wav', sound(1));
    cacheBuffer('epic.wav', sound(5000));
    expect(getCachedBuffer('epic.wav')).toBeUndefined();
    expect(getCachedBuffer('kick.wav')).toBeDefined();
  });

  it('keeps a single oversized-for-the-rest entry rather than emptying itself', () => {
    cacheBuffer('long.wav', sound(590));
    cacheBuffer('other.wav', sound(100));
    // One of them had to go, but the cache never ends up empty.
    expect(cacheStats().count).toBeGreaterThanOrEqual(1);
  });

  it('forgets everything when told to', () => {
    cacheBuffer('a.wav', sound(1));
    clearBufferCache();
    expect(cacheStats()).toEqual({ count: 0, seconds: 0, pinned: 0 });
  });
});

// Eviction is only safe because the sound can be read from disk again. A
// recording or a rack render has no file yet, so the cache holds the only copy.
describe('pinned entries', () => {
  it('keeps a pinned sound however much else arrives', () => {
    cacheBuffer('take-1', sound(30), true);
    for (let i = 0; i < 20; i++) cacheBuffer(`loop${i}.wav`, sound(100));

    expect(getCachedBuffer('take-1')).toBeDefined();
    expect(cacheStats().pinned).toBe(1);
  });

  it('does not count a pinned sound against the budget', () => {
    cacheBuffer('take-1', sound(500), true);
    cacheBuffer('kick.wav', sound(10));
    expect(cacheStats().seconds).toBe(10);
  });

  it('accepts a pinned sound longer than the whole budget', () => {
    cacheBuffer('epic-take', sound(5000), true);
    expect(getCachedBuffer('epic-take')).toBeDefined();
  });

  it('lets a sound go once it has been written to disk', () => {
    cacheBuffer('take-1', sound(100), true);
    unpinBuffer('take-1');
    expect(cacheStats().pinned).toBe(0);
    expect(cacheStats().seconds).toBe(100);

    for (let i = 0; i < 20; i++) cacheBuffer(`loop${i}.wav`, sound(100));
    expect(getCachedBuffer('take-1')).toBeUndefined();
  });

  it('ignores an unpin for something it never held', () => {
    expect(() => unpinBuffer('nowhere')).not.toThrow();
    expect(cacheStats().count).toBe(0);
  });

  it('stops pinning when the same key is cached again unpinned', () => {
    cacheBuffer('take-1', sound(5), true);
    cacheBuffer('take-1', sound(5));
    expect(cacheStats().pinned).toBe(0);
    expect(cacheStats().seconds).toBe(5);
  });
});
