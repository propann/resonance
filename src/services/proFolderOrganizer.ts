import { FolderItem, SampleItem, SampleType, SampleCategory, MusicGenre } from '../types/sample';
import {
  calculateAudioMetrics,
  classifySample,
  detectBpm,
  detectPitchAndKey,
  detectLoopVsOneShot,
  classifyGenre,
  assignEp133Slot,
} from './audioAnalyzer';
import { audioBufferToWavBlob } from './audioConverter';

export interface ProFolderDefinition {
  id: string;
  name: string;
  path: string;
  category: 'one-shot' | 'loop' | 'multi-sound' | 'root';
  color: string;
  icon: string;
  parentId?: string;
  description: string;
  targetTypes: SampleType[];
}

/**
 * Standard Golden Industry Folder Structure (inspired by Splice, Native Instruments, Ableton Live 12, FL Studio & Loopcloud)
 */
export const PRO_STUDIO_FOLDER_DEFINITIONS: ProFolderDefinition[] = [
  // === ROOT CATEGORIES ===
  {
    id: 'f-root-oneshots',
    name: '01_ONE_SHOTS',
    path: '/01_ONE_SHOTS',
    category: 'one-shot',
    color: '#00F0FF',
    icon: 'Zap',
    description: 'Éléments percussifs et notes isolées',
    targetTypes: ['kick', 'snare', 'hihat', 'clap', 'cymbal', 'percussion', 'bass', '808', 'lead', 'pad', 'vocal', 'fx'],
  },
  {
    id: 'f-root-loops',
    name: '02_LOOPS',
    path: '/02_LOOPS',
    category: 'loop',
    color: '#10B981',
    icon: 'Repeat',
    description: 'Boucles rythmiques et mélodiques calées au BPM',
    targetTypes: ['loop'],
  },
  {
    id: 'f-root-multisound',
    name: '03_MULTI_SOUND_KITS',
    path: '/03_MULTI_SOUND_KITS',
    category: 'multi-sound',
    color: '#FF7A00',
    icon: 'Scissors',
    description: 'Kits multipistes et stems découpables',
    targetTypes: ['multi-sound'],
  },

  // === ONE-SHOTS SUB-FOLDERS ===
  // 1. Drums & Percussion
  {
    id: 'f-os-drums',
    name: '01_Drums_Percussion',
    path: '/01_ONE_SHOTS/01_Drums_Percussion',
    category: 'one-shot',
    color: '#00F0FF',
    icon: 'Drum',
    parentId: 'f-root-oneshots',
    description: 'Batteries, percussions et bruits de frappe',
    targetTypes: ['kick', 'snare', 'hihat', 'clap', 'cymbal', 'percussion'],
  },
  {
    id: 'f-os-kicks',
    name: '01_Kicks',
    path: '/01_ONE_SHOTS/01_Drums_Percussion/01_Kicks',
    category: 'one-shot',
    color: '#00F0FF',
    icon: 'Disc',
    parentId: 'f-os-drums',
    description: 'Grosses caisses acoustiques, trap & punchy',
    targetTypes: ['kick'],
  },
  {
    id: 'f-os-snares',
    name: '02_Snares_Claps',
    path: '/01_ONE_SHOTS/01_Drums_Percussion/02_Snares_Claps',
    category: 'one-shot',
    color: '#EF4444',
    icon: 'Layers',
    parentId: 'f-os-drums',
    description: 'Caisses claires, claps claquants et rimshots',
    targetTypes: ['snare', 'clap'],
  },
  {
    id: 'f-os-hihats',
    name: '03_HiHats_Cymbals',
    path: '/01_ONE_SHOTS/01_Drums_Percussion/03_HiHats_Cymbals',
    category: 'one-shot',
    color: '#F59E0B',
    icon: 'Sparkles',
    parentId: 'f-os-drums',
    description: 'Charlestons fermés/ouverts, rides et crashs',
    targetTypes: ['hihat', 'cymbal'],
  },
  {
    id: 'f-os-percs',
    name: '04_Toms_Percussion',
    path: '/01_ONE_SHOTS/01_Drums_Percussion/04_Toms_Percussion',
    category: 'one-shot',
    color: '#14B8A6',
    icon: 'CircleDot',
    parentId: 'f-os-drums',
    description: 'Toms, shakers, bongos, congas et cloches',
    targetTypes: ['percussion'],
  },

  // 2. Bass & 808
  {
    id: 'f-os-bass',
    name: '02_Bass_808',
    path: '/01_ONE_SHOTS/02_Bass_808',
    category: 'one-shot',
    color: '#8B5CF6',
    icon: 'Zap',
    parentId: 'f-root-oneshots',
    description: 'Basses synthétiques et sub-basses 808',
    targetTypes: ['808', 'bass'],
  },
  {
    id: 'f-os-808',
    name: '01_808_SubHits',
    path: '/01_ONE_SHOTS/02_Bass_808/01_808_SubHits',
    category: 'one-shot',
    color: '#A855F7',
    icon: 'Flame',
    parentId: 'f-os-bass',
    description: 'Sub 808 saturées, glide hits et sub drops',
    targetTypes: ['808'],
  },
  {
    id: 'f-os-synthbass',
    name: '02_SynthBass_Plucks',
    path: '/01_ONE_SHOTS/02_Bass_808/02_SynthBass_Plucks',
    category: 'one-shot',
    color: '#7C3AED',
    icon: 'Activity',
    parentId: 'f-os-bass',
    description: 'Basses analogiques, reeses et stabs de basse',
    targetTypes: ['bass'],
  },

  // 3. Melodic & Instruments
  {
    id: 'f-os-melodic',
    name: '03_Melodic_Instruments',
    path: '/01_ONE_SHOTS/03_Melodic_Instruments',
    category: 'one-shot',
    color: '#3B82F6',
    icon: 'Music',
    parentId: 'f-root-oneshots',
    description: 'Instruments mélodiques et accords isolés',
    targetTypes: ['lead', 'pad'],
  },
  {
    id: 'f-os-leads',
    name: '01_Synth_Leads_Plucks',
    path: '/01_ONE_SHOTS/03_Melodic_Instruments/01_Synth_Leads_Plucks',
    category: 'one-shot',
    color: '#3B82F6',
    icon: 'Sliders',
    parentId: 'f-os-melodic',
    description: 'Leads, synth plucks et notes uniques',
    targetTypes: ['lead'],
  },
  {
    id: 'f-os-pads',
    name: '02_Pads_Chords',
    path: '/01_ONE_SHOTS/03_Melodic_Instruments/02_Pads_Chords',
    category: 'one-shot',
    color: '#6366F1',
    icon: 'Layers',
    parentId: 'f-os-melodic',
    description: 'Accords de piano, rhodes et nappes synthé',
    targetTypes: ['pad'],
  },

  // 4. Vocals
  {
    id: 'f-os-vocals',
    name: '04_Vocals',
    path: '/01_ONE_SHOTS/04_Vocals',
    category: 'one-shot',
    color: '#EC4899',
    icon: 'Mic',
    parentId: 'f-root-oneshots',
    description: 'Voix, chants, ad-libs et chops de voix',
    targetTypes: ['vocal'],
  },

  // 5. FX & Transitions
  {
    id: 'f-os-fx',
    name: '05_FX_Transitions',
    path: '/01_ONE_SHOTS/05_FX_Transitions',
    category: 'one-shot',
    color: '#EAB308',
    icon: 'Sparkles',
    parentId: 'f-root-oneshots',
    description: 'Impacts, risers, textures foley et downlifters',
    targetTypes: ['fx'],
  },

  // === LOOPS SUB-FOLDERS ===
  // 1. Drum Loops
  {
    id: 'f-lp-drums',
    name: '01_Drum_Loops',
    path: '/02_LOOPS/01_Drum_Loops',
    category: 'loop',
    color: '#10B981',
    icon: 'Drum',
    parentId: 'f-root-loops',
    description: 'Boucles complètes de batterie et rythmiques',
    targetTypes: ['loop'],
  },
  {
    id: 'f-lp-fullbeats',
    name: '01_Full_Beats',
    path: '/02_LOOPS/01_Drum_Loops/01_Full_Beats',
    category: 'loop',
    color: '#10B981',
    icon: 'Disc',
    parentId: 'f-lp-drums',
    description: 'Kits complets de batterie avec kick et snare',
    targetTypes: ['loop'],
  },
  {
    id: 'f-lp-toploops',
    name: '02_Top_Loops_NoKick',
    path: '/02_LOOPS/01_Drum_Loops/02_Top_Loops_NoKick',
    category: 'loop',
    color: '#34D399',
    icon: 'Sparkles',
    parentId: 'f-lp-drums',
    description: 'Boucles de hi-hats et percussions sans grosse caisse',
    targetTypes: ['loop'],
  },
  {
    id: 'f-lp-perc',
    name: '03_Percussion_Grooves',
    path: '/02_LOOPS/01_Drum_Loops/03_Percussion_Grooves',
    category: 'loop',
    color: '#059669',
    icon: 'CircleDot',
    parentId: 'f-lp-drums',
    description: 'Grooves afro, shakers, bongos et rythmes organiques',
    targetTypes: ['loop'],
  },

  // 2. Melodic & Bass Loops
  {
    id: 'f-lp-melodic',
    name: '02_Melodic_Loops',
    path: '/02_LOOPS/02_Melodic_Loops',
    category: 'loop',
    color: '#06B6D4',
    icon: 'Music',
    parentId: 'f-root-loops',
    description: 'Lignes de basse, synth leads, guitares et pianos',
    targetTypes: ['loop'],
  },
  {
    id: 'f-lp-basslines',
    name: '01_Basslines_808',
    path: '/02_LOOPS/02_Melodic_Loops/01_Basslines_808',
    category: 'loop',
    color: '#8B5CF6',
    icon: 'Zap',
    parentId: 'f-lp-melodic',
    description: 'Lignes de basse continues et drill slides',
    targetTypes: ['loop'],
  },
  {
    id: 'f-lp-chords',
    name: '02_Chord_Progressions',
    path: '/02_LOOPS/02_Melodic_Loops/02_Chord_Progressions',
    category: 'loop',
    color: '#3B82F6',
    icon: 'Layers',
    parentId: 'f-lp-melodic',
    description: 'Progressions d accords de piano, synthé et guitare',
    targetTypes: ['loop'],
  },
  {
    id: 'f-lp-leads',
    name: '03_Lead_Melodies',
    path: '/02_LOOPS/02_Melodic_Loops/03_Lead_Melodies',
    category: 'loop',
    color: '#00F0FF',
    icon: 'Sliders',
    parentId: 'f-lp-melodic',
    description: 'Mélodies principales de synthé, flûtes et cloches',
    targetTypes: ['loop'],
  },

  // 3. Atmospheres & Textures
  {
    id: 'f-lp-atmo',
    name: '03_Atmospheres_Textures',
    path: '/02_LOOPS/03_Atmospheres_Textures',
    category: 'loop',
    color: '#6366F1',
    icon: 'Cloud',
    parentId: 'f-root-loops',
    description: 'Nappes ambiantes, drones et textures lo-fi',
    targetTypes: ['loop'],
  },

  // 4. Vocal Loops
  {
    id: 'f-lp-vocals',
    name: '04_Vocal_Loops',
    path: '/02_LOOPS/04_Vocal_Loops',
    category: 'loop',
    color: '#EC4899',
    icon: 'Mic',
    parentId: 'f-root-loops',
    description: 'Toplines vocales, phrases et boucles vocoder',
    targetTypes: ['loop'],
  },
];

/**
 * Returns clean list of FolderItem objects calculated with real-time sample counts
 */
export function generateProFolderHierarchy(samples: SampleItem[]): FolderItem[] {
  return PRO_STUDIO_FOLDER_DEFINITIONS.map((def) => {
    // Count samples that match this folder path or start with this folder path
    const count = samples.filter((s) => {
      if (s.folderId === def.id) return true;
      if (s.folderPath && s.folderPath.startsWith(def.path)) return true;
      return false;
    }).length;

    return {
      id: def.id,
      name: def.name,
      path: def.path,
      color: def.color,
      icon: def.icon,
      count,
      parentId: def.parentId,
    };
  });
}

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
// is a snare, "open hat" a hat), so it decides first.
const DRUM_NAME_RULES: Array<[RegExp, DrumFamily]> = [
  [/kick|\bkck\b|\bbd\b|bassdrum|grosse.?caisse/i, 'kicks'],
  [/snare|\bsnr\b|\bsd\b|caisse.?claire|rimshot|\brim\b|sidestick/i, 'snares'],
  [/hi.?hat|hihat|\bhh\b|\bhat\b|closed.?h|open.?h|pedal.?h/i, 'hats'],
  [/hand.?clap|\bclap\b|\bsnap\b|finger.?snap/i, 'claps'],
  [/crash|\bride\b|splash|china|cymbal|\bcym\b|\bgong\b/i, 'cymbals'],
  [
    /\btom\b|floor.?tom|conga|bongo|djembe|darbuka|tabla|shaker|tambour|cowbell|clave|woodblock|cabasa|guiro|triangle|agogo|timbale|perc/i,
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
  for (const [pattern, family] of DRUM_NAME_RULES) {
    if (pattern.test(name)) return family;
  }
  return (type && DRUM_TYPE_FAMILY[type]) || 'percs';
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
