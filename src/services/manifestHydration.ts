/**
 * Turning manifest lines into library items — only the ones that are new.
 *
 * The manifest is the whole library, and it is re-read in full every time the
 * work folder is refreshed: while an import runs, that is every few seconds.
 * Hydration used to build a `SampleItem` for all 282 000 lines and then drop
 * the ones already in the store — so a batch of 64 newly ingested files cost
 * 282 000 object allocations, 282 000 folder classifications and a full
 * rebuild of the array, of which 99.98 % was thrown away on the next line.
 *
 * Measured in the running app: the main thread was busy for 4.4 seconds at a
 * time, back to back, with nothing being clicked. That is what made the
 * playhead jump and the interface feel dead — not the audio, and not the sort.
 *
 * So the identity is computed first, from two string reads, and the item is
 * only built if the store has never seen it.
 */

import type { SampleItem } from '../types/sample';
import { folderIdForPath } from './libraryFolders';
import { classifySampleForLibrary } from './proFolderOrganizer';

const ALLOWED_TYPES = new Set([
  'kick', 'snare', 'hihat', 'clap', 'cymbal', 'percussion', 'bass', '808',
  'lead', 'pad', 'vocal', 'fx', 'loop', 'multi-sound', 'other',
]);
const ALLOWED_CATEGORIES = new Set(['one-shot', 'loop', 'multi-sound']);
const ALLOWED_GENRES = new Set([
  'Hip-Hop / BoomBap', 'Trap / Drill', 'House / EDM', 'Techno',
  'Techno / Industrial', 'Lo-Fi / Chillhop', 'Synthwave / Retro',
  'Drum & Bass', 'Drum & Bass / Jungle', 'Afrobeat / Dancehall',
  'Ambient / Cinematic', 'Pop / R&B', 'Acoustic / Rock',
  'Universal / Multi-Genre',
]);

const DEFAULT_PATH = '/01_ONE_SHOTS/05_FX_TEXTURES';

/** Where a manifest line will sit, and what it will be called. */
const placeOf = (entry: Record<string, unknown>, index: number) => {
  const path = typeof entry.path === 'string' ? entry.path : DEFAULT_PATH;
  const fileName =
    typeof entry.fileName === 'string'
      ? entry.fileName
      : typeof entry.name === 'string'
        ? entry.name
        : `sample-${index}`;
  return { path, fileName };
};

/**
 * The id a manifest line will have in the store. Cheap on purpose: it is
 * computed for every line on every refresh, and decides which lines are worth
 * building.
 */
export const manifestSampleId = (entry: Record<string, unknown>, index: number): string => {
  const { path, fileName } = placeOf(entry, index);
  return `disk-${path}-${fileName}`;
};

function buildSample(entry: Record<string, unknown>, index: number): SampleItem {
  const { path, fileName } = placeOf(entry, index);
  const type = (
    typeof entry.type === 'string' && ALLOWED_TYPES.has(entry.type) ? entry.type : 'other'
  ) as SampleItem['type'];
  const category = (
    typeof entry.category === 'string' && ALLOWED_CATEGORIES.has(entry.category)
      ? entry.category
      : 'one-shot'
  ) as SampleItem['category'];
  const isLoop = category === 'loop';

  return {
    id: `disk-${path}-${fileName}`,
    name: typeof entry.name === 'string' ? entry.name : fileName,
    originalFileName: typeof entry.originalName === 'string' ? entry.originalName : fileName,
    format: entry.format === 'op-1-aiff' ? 'aiff' : 'wav',
    size: 0,
    duration: typeof entry.duration === 'number' ? entry.duration : 0,
    sampleRate: typeof entry.sampleRate === 'number' ? entry.sampleRate : 48000,
    bitDepth: typeof entry.bitDepth === 'number' ? entry.bitDepth : 24,
    channels: 2,
    bpm: typeof entry.bpm === 'number' ? entry.bpm : undefined,
    key: typeof entry.key === 'string' ? entry.key : undefined,
    type,
    category,
    isLoop,
    genre: (ALLOWED_GENRES.has(entry.genre as string)
      ? entry.genre
      : 'Universal / Multi-Genre') as SampleItem['genre'],
    tags: Array.isArray(entry.tags)
      ? entry.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    // Where the file sits on disk is the truth. Re-guessing the folder from
    // the name would file a "...kick..." found in 06_PERCS under kicks, and
    // the sidebar count would stop matching the list.
    folderId:
      folderIdForPath(path) ??
      classifySampleForLibrary({
        type,
        category,
        isLoop,
        name: fileName,
        originalFileName: fileName,
      } as SampleItem).folderId,
    folderPath: path,
    favorite: false,
    rating: 0,
    spectralCentroid: 0,
    dynamicRangeDb: 0,
    peakDb: 0,
    rmsDb: 0,
    lufs: 0,
    loudnessGainDb: 0,
    zeroCrossingRate: 0,
    slices: [],
    blobUrl: '',
    dateAdded: 0,
    diskPath: `${path.replace(/^\//, '')}/${fileName}`,
  };
}

/**
 * The manifest lines the store does not already hold, built into items.
 *
 * `knownIds` is read and added to, so a line appearing twice in one manifest
 * lands once. An empty result means the caller should keep the array it has:
 * replacing it with an equal copy re-sorts the library and recounts every
 * sidebar badge for nothing.
 */
export function hydrateNewManifestSamples(
  entries: Array<Record<string, unknown>>,
  knownIds: Set<string>
): SampleItem[] {
  const fresh: SampleItem[] = [];
  for (let index = 0; index < entries.length; index++) {
    const id = manifestSampleId(entries[index], index);
    if (knownIds.has(id)) continue;
    knownIds.add(id);
    fresh.push(buildSample(entries[index], index));
  }
  return fresh;
}
