import { SampleItem, SampleType, MusicGenre } from '../types/sample';

export type NamingConventionPreset =
  | 'industry_pro' // e.g. DRUM_KICK_F#_140BPM_PunchySub_24b44k
  | 'splice_pro' // e.g. AZ_Kick_PunchySub_F#_140
  | 'teenage_eng' // e.g. 001_KCK_PunchySub
  | 'daw_clean' // e.g. Kick PunchySub F# 140bpm
  | 'minimal_type' // e.g. KICK_PunchySub
  | 'custom';

export interface NamingConventionConfig {
  preset: NamingConventionPreset;
  prefix: string; // e.g. "AZ", "RES", "TE", "STD"
  customPattern: string; // e.g. "{prefix}_{category}_{type}_{name}_{key}_{bpm}bpm_{specs}"
  includeKey: boolean;
  includeBpm: boolean;
  includeCategory: boolean;
  includeSpecs: boolean; // e.g. 24b44k
  includeSlot: boolean;
  casing: 'uppercase' | 'lowercase' | 'titlecase' | 'preserve';
  separator: '_' | '-' | ' ' | '.';
  autoOrganizeFolders: boolean;
}

export const DEFAULT_NAMING_CONFIG: NamingConventionConfig = {
  preset: 'industry_pro',
  prefix: 'AZ',
  customPattern: '{category}_{type}_{key}_{bpm}_{name}_{specs}',
  includeKey: true,
  includeBpm: true,
  includeCategory: true,
  includeSpecs: true,
  includeSlot: false,
  casing: 'preserve',
  separator: '_',
  autoOrganizeFolders: true,
};

// 3-letter hardware and modular abbreviation codes
export const TYPE_3LETTER_CODES: Record<SampleType, string> = {
  kick: 'KCK',
  '808': '808',
  snare: 'SNR',
  hihat: 'HAT',
  clap: 'CLP',
  cymbal: 'CYM',
  percussion: 'PRC',
  bass: 'BAS',
  lead: 'LED',
  pad: 'PAD',
  vocal: 'VOC',
  fx: 'SFX',
  loop: 'LOP',
  'multi-sound': 'MLT',
  other: 'SMP',
};

export const CATEGORY_LABELS: Record<string, string> = {
  kick: 'DRUM',
  snare: 'DRUM',
  hihat: 'DRUM',
  clap: 'DRUM',
  cymbal: 'DRUM',
  percussion: 'DRUM',
  '808': 'BASS',
  bass: 'BASS',
  lead: 'SYNTH',
  pad: 'SYNTH',
  vocal: 'VOCAL',
  fx: 'FX',
  loop: 'LOOP',
  'multi-sound': 'STEM',
  other: 'MISC',
};

/**
 * Cleans garbage suffixes and messy characters from uploaded filenames
 */
export function cleanRawSampleName(raw: string): string {
  if (!raw) return 'Sample';
  let name = raw.replace(/\.[^/.]+$/, ''); // Remove file extension

  // Remove common artifacts from web rips, exports, or DAW bounces
  name = name
    .replace(/\(converted\)/gi, '')
    .replace(/\(normalized\)/gi, '')
    .replace(/\(rendered\)/gi, '')
    .replace(/_final(_v\d+)?/gi, '')
    .replace(/_v\d+/gi, '')
    .replace(/_master(ed)?/gi, '')
    .replace(/_wav/gi, '')
    .replace(/_mp3/gi, '')
    .replace(/_44k(hz)?/gi, '')
    .replace(/_48k(hz)?/gi, '')
    .replace(/_24b(it)?/gi, '')
    .replace(/_16b(it)?/gi, '')
    .replace(/_stereo/gi, '')
    .replace(/_mono/gi, '')
    .replace(/\[[^\]]*\]/g, '') // remove bracketed text like [FREE] or [Splice]
    .replace(/^[0-9]+[\s_.-]+/, '') // remove leading numbers like "01 - " or "12_"
    .replace(/[^\w\s-]/g, '') // strip special unsafe symbols
    .trim();

  // Condense multiple spaces / underscores
  name = name.replace(/[\s_-]+/g, '_');

  // Convert to PascalCase / Clean Title if all lowercase
  if (name.length > 0 && name === name.toLowerCase()) {
    name = name
      .split('_')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join('_');
  }

  return name || 'Sample';
}

/**
 * Standardized audio file specs string (e.g. 24b44k or 16b44k)
 */
export function getSpecsString(sample: Pick<SampleItem, 'bitDepth' | 'sampleRate' | 'channels'>): string {
  const depth = sample.bitDepth || 24;
  const rate = sample.sampleRate ? Math.round(sample.sampleRate / 1000) : 44;
  const ch = sample.channels === 1 ? 'm' : 's';
  return `${depth}b${rate}k${ch}`;
}

/**
 * Formats musical key into clean safe token (e.g. "F# min" -> "F#m", "C maj" -> "Cmaj")
 */
export function formatSafeKey(key?: string): string {
  if (!key) return '';
  return key
    .replace(/\s+min(or)?/i, 'm')
    .replace(/\s+maj(or)?/i, 'maj')
    .replace(/\s+/g, '');
}

/**
 * Generates standardized professional filename for a sample based on the convention
 */
export function generateStandardSampleName(
  sample: SampleItem,
  config: NamingConventionConfig = DEFAULT_NAMING_CONFIG,
  index: number = 1
): string {
  const cleanName = cleanRawSampleName(sample.name || sample.originalFileName);
  const typeCode = (TYPE_3LETTER_CODES[sample.type] || 'SMP').toUpperCase();
  const typeName = sample.type.charAt(0).toUpperCase() + sample.type.slice(1);
  const category = CATEGORY_LABELS[sample.type] || (sample.isLoop ? 'LOOP' : 'DRUM');
  const safeKey = formatSafeKey(sample.key);
  const bpmStr = sample.bpm ? `${sample.bpm}BPM` : '';
  const specs = getSpecsString(sample);
  const slotStr = String(sample.ep133Slot || index).padStart(3, '0');
  const prefix = config.prefix.trim();
  const sep = config.separator;

  let result = '';

  switch (config.preset) {
    case 'industry_pro': {
      // DRUM_KICK_F#m_140BPM_PunchySub_24b44ks
      const parts: string[] = [];
      if (config.includeCategory) parts.push(category);
      parts.push(typeName.toUpperCase());
      if (config.includeKey && safeKey) parts.push(safeKey);
      if (config.includeBpm && bpmStr) parts.push(bpmStr);
      parts.push(cleanName);
      if (config.includeSpecs) parts.push(specs);
      result = parts.join(sep);
      break;
    }

    case 'splice_pro': {
      // AZ_Kick_PunchySub_F#m_140
      const parts: string[] = [];
      if (prefix) parts.push(prefix);
      parts.push(typeName);
      parts.push(cleanName);
      if (config.includeKey && safeKey) parts.push(safeKey);
      if (config.includeBpm && sample.bpm) parts.push(String(sample.bpm));
      result = parts.join(sep);
      break;
    }

    case 'teenage_eng': {
      // 001_KCK_PunchySub
      const parts: string[] = [];
      parts.push(slotStr);
      parts.push(typeCode);
      parts.push(cleanName.substring(0, 16));
      result = parts.join(sep);
      break;
    }

    case 'daw_clean': {
      // Kick PunchySub F#m 140bpm
      const parts: string[] = [];
      parts.push(typeName);
      parts.push(cleanName);
      if (config.includeKey && safeKey) parts.push(safeKey);
      if (config.includeBpm && sample.bpm) parts.push(`${sample.bpm}bpm`);
      result = parts.join(' ');
      break;
    }

    case 'minimal_type': {
      // KICK_PunchySub
      result = `${typeCode}${sep}${cleanName}`;
      break;
    }

    case 'custom': {
      let custom = config.customPattern;
      custom = custom.replace(/\{prefix\}/g, prefix);
      custom = custom.replace(/\{category\}/g, category);
      custom = custom.replace(/\{type\}/g, typeName);
      custom = custom.replace(/\{type_code\}/g, typeCode);
      custom = custom.replace(/\{name\}/g, cleanName);
      custom = custom.replace(/\{key\}/g, safeKey);
      custom = custom.replace(/\{bpm\}/g, sample.bpm ? String(sample.bpm) : '');
      custom = custom.replace(/\{specs\}/g, specs);
      custom = custom.replace(/\{slot\}/g, slotStr);
      custom = custom.replace(/\{genre\}/g, sample.genre?.replace(/[^\w]/g, '') || 'Universal');

      // Clean dangling separators caused by empty fields
      result = custom
        .replace(/_{2,}/g, '_')
        .replace(/-{2,}/g, '-')
        .replace(/^[_\s-]+|[_\s-]+$/g, '');
      break;
    }
  }

  // Apply Casing option
  if (config.casing === 'uppercase') {
    result = result.toUpperCase();
  } else if (config.casing === 'lowercase') {
    result = result.toLowerCase();
  }

  return result || `Sample_${index}`;
}

/**
 * Standard Studio Folder Hierarchy
 */
export function getStandardFolderPath(sample: SampleItem): { folderPath: string; folderId: string } {
  const type = sample.type;
  const isLoop = sample.isLoop;

  if (isLoop) {
    if (type === 'kick' || type === 'snare' || type === 'hihat' || type === 'percussion' || type === 'multi-sound') {
      return { folderPath: '/06_Loops_Stems/Drum_Loops', folderId: 'f-drum-loops' };
    }
    if (type === 'lead' || type === 'pad' || type === 'bass' || type === '808') {
      return { folderPath: '/06_Loops_Stems/Melodic_Loops', folderId: 'f-melodic-loops' };
    }
    return { folderPath: '/06_Loops_Stems/Universal_Loops', folderId: 'f-loops' };
  }

  switch (type) {
    case 'kick':
      return { folderPath: '/01_Drums/Kicks', folderId: 'f-kicks' };
    case 'snare':
      return { folderPath: '/01_Drums/Snares', folderId: 'f-snares' };
    case 'hihat':
      return { folderPath: '/01_Drums/HiHats', folderId: 'f-hihats' };
    case 'clap':
      return { folderPath: '/01_Drums/Claps', folderId: 'f-claps' };
    case 'cymbal':
      return { folderPath: '/01_Drums/Cymbals_Rides', folderId: 'f-cymbals' };
    case 'percussion':
      return { folderPath: '/01_Drums/Percussion', folderId: 'f-percussion' };
    case '808':
      return { folderPath: '/02_Bass_808/808_Sub', folderId: 'f-808' };
    case 'bass':
      return { folderPath: '/02_Bass_808/Bass_Stabs', folderId: 'f-bass' };
    case 'lead':
      return { folderPath: '/03_Melodic/Leads_Synths', folderId: 'f-leads' };
    case 'pad':
      return { folderPath: '/03_Melodic/Pads_Chords', folderId: 'f-pads' };
    case 'vocal':
      return { folderPath: '/04_Vocals/Chants_Hooks', folderId: 'f-vocals' };
    case 'fx':
      return { folderPath: '/05_FX_Textures/Risers_Impacts', folderId: 'f-fx' };
    case 'multi-sound':
      return { folderPath: '/06_Loops_Stems/Multi_Kits', folderId: 'f-multi' };
    default:
      return { folderPath: '/07_Instruments_Misc', folderId: 'f-misc' };
  }
}

/**
 * Batch rename and re-folder samples with diff preview
 */
export function batchRenameSamples(
  samples: SampleItem[],
  config: NamingConventionConfig = DEFAULT_NAMING_CONFIG
): {
  updatedSamples: SampleItem[];
  diffList: {
    id: string;
    oldName: string;
    newName: string;
    oldPath: string;
    newPath: string;
    changed: boolean;
  }[];
} {
  const diffList: {
    id: string;
    oldName: string;
    newName: string;
    oldPath: string;
    newPath: string;
    changed: boolean;
  }[] = [];

  const updatedSamples = samples.map((sample, idx) => {
    const newName = generateStandardSampleName(sample, config, idx + 1);
    const { folderPath, folderId } = config.autoOrganizeFolders
      ? getStandardFolderPath(sample)
      : { folderPath: sample.folderPath, folderId: sample.folderId };

    const changed = newName !== sample.name || (config.autoOrganizeFolders && folderPath !== sample.folderPath);

    diffList.push({
      id: sample.id,
      oldName: sample.name,
      newName,
      oldPath: sample.folderPath || '/',
      newPath: folderPath,
      changed,
    });

    return {
      ...sample,
      name: newName,
      folderPath,
      folderId,
    };
  });

  return { updatedSamples, diffList };
}
