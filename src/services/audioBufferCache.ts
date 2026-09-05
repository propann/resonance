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

/**
 * A ceiling on sound the cache is holding as the only copy.
 *
 * Pinned entries are exempt from eviction, which makes them a way to leak the
 * whole machine: pinning every ingested sample once filled 6 GB in twenty
 * minutes and left the renderer unresponsive. Only a handful of things should
 * ever be pinned — an unsaved take, a render that has not been written yet —
 * so anything past this is a mistake, and dropping the oldest of them is a far
 * better failure than taking the app down.
 */
const MAX_PINNED_SECONDS = 300;

interface Entry {
  buffer: AudioBuffer;
  /** Bumped on every hit, so the least recently wanted goes first. */
  used: number;
  /**
   * There is no file behind this one.
   *
   * Eviction is only safe because the sound can be read again from disk. A
   * recording, a rack render or a freshly cut slice has no file yet — and may
   * never get one, if writing it out fails — so the cache holds the only copy
   * and must not throw it away.
   */
  pinned: boolean;
}

const entries = new Map<string, Entry>();
let clock = 0;
/** Only what can be evicted counts against the budget. */
let heldSeconds = 0;

/** What the cache is holding, for a status line or a test. */
export const cacheStats = (): { count: number; seconds: number; pinned: number } => {
  let pinned = 0;
  for (const entry of entries.values()) if (entry.pinned) pinned++;
  return { count: entries.size, seconds: Math.round(heldSeconds), pinned };
};

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
export function cacheBuffer(key: string, buffer: AudioBuffer, pinned = false): void {
  // A pinned sound is kept whatever its length: there is nowhere else to read
  // it from, so refusing it would simply lose it.
  if (!key || (!pinned && buffer.duration > MAX_SECONDS)) return;

  const existing = entries.get(key);
  if (existing && !existing.pinned) heldSeconds -= existing.buffer.duration;

  entries.set(key, { buffer, used: ++clock, pinned });
  if (!pinned) heldSeconds += buffer.duration;

  if (pinned) dropOldestPinnedOverCeiling();

  let evictable = 0;
  for (const entry of entries.values()) if (!entry.pinned) evictable++;

  while (heldSeconds > MAX_SECONDS && evictable > 1) {
    let oldestKey: string | null = null;
    let oldestUse = Infinity;
    for (const [entryKey, entry] of entries) {
      if (entry.pinned) continue;
      if (entry.used < oldestUse) {
        oldestUse = entry.used;
        oldestKey = entryKey;
      }
    }
    if (!oldestKey) break;
    heldSeconds -= entries.get(oldestKey)!.buffer.duration;
    entries.delete(oldestKey);
    evictable--;
  }
}

/**
 * Keep the pinned set within its ceiling, oldest first.
 *
 * Reaching this means something is pinning far more than it should; the drop
 * is announced rather than done quietly, because a sound is being lost.
 */
function dropOldestPinnedOverCeiling(): void {
  let held = 0;
  for (const entry of entries.values()) if (entry.pinned) held += entry.buffer.duration;
  if (held <= MAX_PINNED_SECONDS) return;

  const oldestFirst = [...entries.entries()]
    .filter(([, entry]) => entry.pinned)
    .sort((a, b) => a[1].used - b[1].used);

  // Never down to nothing: the ceiling is against many pins piling up, not
  // against one long sound, and the last pinned entry is someone's only copy.
  let remaining = oldestFirst.length;
  for (const [key, entry] of oldestFirst) {
    if (held <= MAX_PINNED_SECONDS || remaining <= 1) break;
    remaining--;
    console.warn(
      `[audio] ${Math.round(held)}s d'audio épinglé dépasse le plafond de ${MAX_PINNED_SECONDS}s — abandon de « ${key} ». Quelque chose épingle trop.`
    );
    held -= entry.buffer.duration;
    entries.delete(key);
  }
}

/**
 * Let go of a sound the cache was holding as the only copy — once it has been
 * written to disk, or once the sample it belonged to is gone.
 */
export function unpinBuffer(key: string): void {
  const entry = entries.get(key);
  if (!entry?.pinned) return;
  entry.pinned = false;
  heldSeconds += entry.buffer.duration;
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
