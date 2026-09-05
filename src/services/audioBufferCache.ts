/**
 * Decoded audio, kept for a while.
 *
 * Selecting a sample read its file over IPC and decoded it, every time —
 * including the sample you were on ten seconds ago. Nothing was kept, so
 * moving back and forth through a folder paid the full cost at each step.
 *
 * The cache is bounded by how much audio it holds rather than by how many
 * entries: a hundred kicks and a hundred four-minute loops are not the same
 * amount of memory, and a library like this one holds both.
 */

/** Roughly how much decoded audio to keep. 48 kHz stereo float is 384 kB/s. */
const MAX_SECONDS = 600;

interface Entry {
  buffer: AudioBuffer;
  /** Bumped on every hit, so the least recently wanted goes first. */
  used: number;
}

const entries = new Map<string, Entry>();
let clock = 0;
let heldSeconds = 0;

/** What the cache is holding, for a status line or a test. */
export const cacheStats = (): { count: number; seconds: number } => ({
  count: entries.size,
  seconds: Math.round(heldSeconds),
});

/** The decoded audio for a path, if it is still around. */
export function getCachedBuffer(key: string): AudioBuffer | undefined {
  const entry = entries.get(key);
  if (!entry) return undefined;
  entry.used = ++clock;
  return entry.buffer;
}

/**
 * Keep a decoded buffer under `key`, evicting the least recently used until
 * the cache is back under its budget.
 *
 * A buffer longer than the whole budget is not kept at all: caching it would
 * evict everything else to hold one sound that will not fit anyway.
 */
export function cacheBuffer(key: string, buffer: AudioBuffer): void {
  if (!key || buffer.duration > MAX_SECONDS) return;

  const existing = entries.get(key);
  if (existing) heldSeconds -= existing.buffer.duration;

  entries.set(key, { buffer, used: ++clock });
  heldSeconds += buffer.duration;

  while (heldSeconds > MAX_SECONDS && entries.size > 1) {
    let oldestKey: string | null = null;
    let oldestUse = Infinity;
    for (const [entryKey, entry] of entries) {
      if (entry.used < oldestUse) {
        oldestUse = entry.used;
        oldestKey = entryKey;
      }
    }
    if (!oldestKey) break;
    heldSeconds -= entries.get(oldestKey)!.buffer.duration;
    entries.delete(oldestKey);
  }
}

/**
 * The object URL and byte size that came with a decoded file.
 *
 * They travel with the buffer because the interface needs all three at once —
 * the waveform wants the samples, the player wants a URL, the table wants a
 * size — and keeping them apart would mean reading the file again for two of
 * them.
 */
const blobUrls = new Map<string, { url: string; size: number }>();

export function cacheBlobUrl(key: string, url: string, size: number): void {
  if (!key) return;
  const previous = blobUrls.get(key);
  // Replacing an entry without releasing the old URL leaks the file it holds.
  if (previous && previous.url !== url) URL.revokeObjectURL(previous.url);
  blobUrls.set(key, { url, size });
}

export const getCachedBlobUrl = (key: string): { url: string; size: number } | undefined =>
  blobUrls.get(key);

/** Forget everything. Used when the working folder changes underneath us. */
export function clearBufferCache(): void {
  entries.clear();
  for (const { url } of blobUrls.values()) URL.revokeObjectURL(url);
  blobUrls.clear();
  heldSeconds = 0;
  clock = 0;
}
