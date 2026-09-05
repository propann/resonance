/**
 * Getting the sound of a sample, from wherever it already is.
 *
 * The library holds 283 000 entries hydrated from a manifest, and none of them
 * carry audio: the file is only read and decoded when something actually wants
 * to hear it. That decode used to live inside one `useEffect` in `App.tsx`, so
 * it was reachable only by the current selection. Every other place that wanted
 * a buffer — the play button on a table row, the WAV download — read
 * `sample.audioBuffer`, found `undefined`, and returned silently. The button
 * looked enabled and did nothing.
 *
 * So the decode lives here instead, behind one function everyone can call.
 */

import { getCachedBuffer, cacheBuffer, cacheBlobUrl } from './audioBufferCache';
import { readLibraryAudioFile } from './localLibrary';
import { audioEngine } from './audioEngine';
import type { SampleItem } from '../types/sample';

/**
 * Decodes in flight, keyed by disk path.
 *
 * Selecting a row and hitting its play button asks for the same file twice
 * within a frame; without this the file is read and decoded twice, and the
 * second decode costs the same again for nothing.
 */
const pending = new Map<string, Promise<AudioBuffer | undefined>>();

/**
 * The decoded audio for a sample: from the sample itself, from the cache, or
 * read from disk — in that order. `undefined` when there is nothing to read,
 * which is the case for a sample that only ever existed in memory.
 *
 * No work folder is passed in because there is nothing to choose: the desktop
 * bridge resolves a `diskPath` against the folder it has adopted, and
 * `readLibraryAudioFile` ignores the root handed to it. Asking every caller
 * for one would have meant threading it through five components to reach the
 * batch exporters.
 */
export async function loadSampleAudio(
  sample: SampleItem | null | undefined
): Promise<AudioBuffer | undefined> {
  if (!sample) return undefined;
  if (sample.audioBuffer) return sample.audioBuffer;

  const path = sample.diskPath;
  if (!path) return undefined;

  const cached = getCachedBuffer(path);
  if (cached) return cached;

  const inFlight = pending.get(path);
  if (inFlight) return inFlight;

  const decode = (async () => {
    try {
      const file = await readLibraryAudioFile('', path);
      const buffer = await audioEngine.decodeAudioData(await file.arrayBuffer());
      cacheBuffer(path, buffer);
      cacheBlobUrl(path, URL.createObjectURL(file), file.size);
      return buffer;
    } catch (error) {
      console.error(`Impossible de lire ${path} depuis le dossier de travail`, error);
      return undefined;
    } finally {
      pending.delete(path);
    }
  })();

  pending.set(path, decode);
  return decode;
}

/**
 * The buffer if it is already to hand, without reading anything.
 *
 * For the places that render many rows at once: a mini waveform draws what the
 * cache happens to hold, and shows its placeholder otherwise. Scrolling past a
 * thousand rows must not queue a thousand decodes.
 */
export function peekSampleAudio(sample: SampleItem | null | undefined): AudioBuffer | undefined {
  if (!sample) return undefined;
  return sample.audioBuffer ?? (sample.diskPath ? getCachedBuffer(sample.diskPath) : undefined);
}
