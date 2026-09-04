import { SampleItem, SampleType, SampleCategory } from '../types/sample';
import { rule, token, word } from './nameTokens';

/** The drum families that get their own folder under 01_DRUMS. */
export type DrumFamily = 'kicks' | 'snares' | 'hats' | 'claps' | 'cymbals' | 'percs';

export const DRUM_FAMILY_FOLDERS: Record<DrumFamily, string> = {
  kicks: '01_KICKS',
  snares: '02_SNARES',
  hats: '03_HATS',
  claps: '04_CLAPS',
  cymbals: '05_CYMBALS',
  percs: '06_PERCS',
};

/** Folder ids used by the sidebar tree, one per drum family. */
export const DRUM_FAMILY_IDS: Record<DrumFamily, string> = {
  kicks: 'f-os-drums-kicks',
  snares: 'f-os-drums-snares',
  hats: 'f-os-drums-hats',
  claps: 'f-os-drums-claps',
  cymbals: 'f-os-drums-cymbals',
  percs: 'f-os-drums-percs',
};

// Read in order: the name is more specific than the detected type ("rimshot"
// is a snare, "open hat" a hat), so it decides first. Short abbreviations go
// through `token` because they turn up inside ordinary words — `Thunderclap`
// is not a clap, `Hatchback` is not a hat, `Ridemore` is not a ride.
const DRUM_NAME_RULES: Array<[RegExp, DrumFamily]> = [
  [
    rule(word('kick', 'bassdrum', 'bass.?drum', 'grosse.?caisse'), token('kck', 'kik', 'bd')),
    'kicks',
  ],
  [
    rule(
      word('snare', 'rimshot', 'rim.?shot', 'sidestick', 'side.?stick', 'caisse.?claire'),
      token('snr', 'sn', 'sd', 'rim')
    ),
    'snares',
  ],
  [
    rule(
      word('hihat', 'hi.?hat', 'closed.?hat', 'open.?hat', 'pedal.?hat', 'closed.?h', 'open.?h'),
      token('hh', 'chh', 'ohh', 'ch', 'oh', 'hat')
    ),
    'hats',
  ],
  [
    rule(word('handclap', 'hand.?clap', 'fingersnap', 'finger.?snap'), token('clap', 'clp', 'snap')),
    'claps',
  ],
  [rule(word('cymbal', 'crash', 'splash', 'china'), token('ride', 'cym', 'gong')), 'cymbals'],
  [
    rule(
      word(
        'percussion',
        'conga',
        'bongo',
        'djembe',
        'darbuka',
        'tabla',
        'shaker',
        'tambour',
        'cowbell',
        'clave',
        'woodblock',
        'cabasa',
        'guiro',
        'triangle',
        'agogo',
        'timbale',
        'floor.?tom'
      ),
      token('tom', 'perc', 'prc')
    ),
    'percs',
  ],
];

const DRUM_TYPE_FAMILY: Partial<Record<SampleType, DrumFamily>> = {
  kick: 'kicks',
  snare: 'snares',
  hihat: 'hats',
  clap: 'claps',
  cymbal: 'cymbals',
  percussion: 'percs',
};

/**
 * Which drum folder a one-shot belongs in. Everything percussive that is not
 * clearly a kick, snare, hat, clap or cymbal lands in percs — the bucket is
 * deliberate, not a failure.
 */
export function drumFamilyFor(type: SampleType | undefined, name: string): DrumFamily {
  return drumFamilyFromName(name) ?? (type ? DRUM_TYPE_FAMILY[type] : undefined) ?? 'percs';
}

/**
 * The family the name itself names, or undefined when it says nothing. The
 * difference matters when re-filing sounds that are already in a folder: only
 * a name that actually names a family is worth moving a file for. Everything
 * else stays where it is, including whatever the user filed by hand.
 */
export function drumFamilyFromName(name: string): DrumFamily | undefined {
  for (const [pattern, family] of DRUM_NAME_RULES) {
    if (pattern.test(name)) return family;
  }
  return undefined;
}

/** Full library path of a drum family, e.g. `/01_ONE_SHOTS/01_DRUMS/01_KICKS`. */
export const drumFamilyPath = (family: DrumFamily): string =>
  `/01_ONE_SHOTS/01_DRUMS/${DRUM_FAMILY_FOLDERS[family]}`;

/**
 * Canonical on-disk layout for Resonance. It deliberately has only two main
 * sound families: one-shots and loops. Multi-hit kits live with one-shots.
 */
export function classifySampleForLibrary(sample: SampleItem): { folderPath: string; folderId: string; category: SampleCategory } {
  const name = `${sample.name} ${sample.originalFileName || ''}`.toLowerCase();
  const isLoop = sample.isLoop || sample.category === 'loop' || sample.type === 'loop';
  if (isLoop) {
    if (sample.type === 'vocal' || /vox|vocal|chant|choir/.test(name)) {
      return { folderPath: '/02_LOOPS/03_VOCAL_LOOPS', folderId: 'f-lp-vocals', category: 'loop' };
    }
    if (sample.type === 'pad' || /ambient|texture|drone|atmo/.test(name)) {
      return { folderPath: '/02_LOOPS/04_TEXTURES', folderId: 'f-lp-atmo', category: 'loop' };
    }
    if (sample.type === 'kick' || sample.type === 'snare' || sample.type === 'hihat' || sample.type === 'clap' || sample.type === 'percussion' || /drum|beat|break|groove|perc/.test(name)) {
      return { folderPath: '/02_LOOPS/01_DRUM_LOOPS', folderId: 'f-lp-drums', category: 'loop' };
    }
    return { folderPath: '/02_LOOPS/02_MELODIC_LOOPS', folderId: 'f-lp-melodic', category: 'loop' };
  }

  if (sample.type === 'multi-sound' || sample.isMultiSound) {
    return { folderPath: '/01_ONE_SHOTS/06_KITS_MULTI', folderId: 'f-root-multisound', category: 'multi-sound' };
  }
  if (['kick', 'snare', 'hihat', 'clap', 'cymbal', 'percussion'].includes(sample.type)) {
    // One level deeper: kicks, snares, hats, claps, cymbals and percs each get
    // their own folder instead of a single 01_DRUMS bucket.
    const family = drumFamilyFor(sample.type, name);
    return { folderPath: drumFamilyPath(family), folderId: DRUM_FAMILY_IDS[family], category: 'one-shot' };
  }
  if (sample.type === '808' || sample.type === 'bass') {
    return { folderPath: '/01_ONE_SHOTS/02_BASS_808', folderId: 'f-os-bass', category: 'one-shot' };
  }
  if (sample.type === 'lead' || sample.type === 'pad') {
    return { folderPath: '/01_ONE_SHOTS/03_MELODIC', folderId: 'f-os-melodic', category: 'one-shot' };
  }
  if (sample.type === 'vocal') {
    return { folderPath: '/01_ONE_SHOTS/04_VOCALS', folderId: 'f-os-vocals', category: 'one-shot' };
  }
  if (sample.type === 'fx') {
    return { folderPath: '/01_ONE_SHOTS/05_FX_TEXTURES', folderId: 'f-os-fx', category: 'one-shot' };
  }
  return { folderPath: '/01_ONE_SHOTS/05_FX_TEXTURES', folderId: 'f-os-fx', category: 'one-shot' };
}

/** Backwards-compatible API: all tools now use the single canonical layout. */
export function classifySampleToProFolder(sample: SampleItem): { folderPath: string; folderId: string; category: SampleCategory } {
  return classifySampleForLibrary(sample);
}

/**
 * Automatically reorganizes an entire sample collection into the Pro Structure
 */
export function autoOrganizeLibrary(samples: SampleItem[]): { organizedSamples: SampleItem[]; totalMoved: number } {
  let totalMoved = 0;
  const organizedSamples = samples.map((sample) => {
    const { folderPath, folderId, category } = classifySampleToProFolder(sample);
    const isDifferent = sample.folderPath !== folderPath || sample.folderId !== folderId;
    if (isDifferent) totalMoved++;

    return {
      ...sample,
      folderPath,
      folderId,
      category,
      isLoop: category === 'loop',
    };
  });

  return { organizedSamples, totalMoved };
}
