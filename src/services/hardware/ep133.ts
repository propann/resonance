/**
 * Teenage Engineering EP-133 K.O. II sample conventions.
 *
 * Locked project decision: the library is stored at max quality, and the
 * EP-133 export is a *downstream* conversion to **44.1 kHz / 16-bit / mono**.
 * Early K.O. II firmware used 46.875 kHz; we deliberately do NOT target it —
 * 44.1 kHz plays back correctly and keeps the pipeline predictable.
 *
 * See memory: resonance-refonte.
 */

import type { SampleItem } from '../../types/sample';

export const EP133_SAMPLE_RATE = 44100 as const;
export const EP133_BIT_DEPTH = 16 as const;
/** Sum L+R — halves the flash footprint, and the EP-133 pads are mono anyway. */
export const EP133_MONO = true;

export const EP133_TARGET_LUFS_LOOP = -14;
export const EP133_TARGET_LUFS_ONESHOT = -18;
export const EP133_TARGET_PEAK_DB = -0.1;

export const EP133_MIN_SLOT = 1;
export const EP133_MAX_SLOT = 999;

/** Sound-group folders, keyed by our internal sample `type`. */
export const EP133_CATEGORY_FOLDERS: Record<string, string> = {
  kick: '01_KICKS (Slots 001-099)',
  snare: '02_SNARES (Slots 100-199)',
  clap: '02_SNARES (Slots 100-199)',
  hihat: '03_HATS (Slots 200-299)',
  cymbal: '03_HATS (Slots 200-299)',
  percussion: '04_PERCS (Slots 300-399)',
  bass: '05_BASS_808 (Slots 400-499)',
  '808': '05_BASS_808 (Slots 400-499)',
  lead: '06_LEADS_KEYS (Slots 500-599)',
  pad: '07_PADS_CHORDS (Slots 600-699)',
  vocal: '08_VOCALS (Slots 700-799)',
  fx: '09_FX_HITS (Slots 800-899)',
  loop: '00_LOOPS_STEMS (Slots 900-999)',
  'multi-sound': '00_LOOPS_STEMS (Slots 900-999)',
  other: '04_PERCS (Slots 300-399)',
};

export function ep133CategoryFolder(type: string): string {
  return EP133_CATEGORY_FOLDERS[type] || EP133_CATEGORY_FOLDERS.other;
}

/** Clamp any value to a valid EP-133 slot number. */
export function clampEp133Slot(slot: number): number {
  return Math.max(EP133_MIN_SLOT, Math.min(EP133_MAX_SLOT, Math.round(slot)));
}

/** `007_Kick_Cm_140BPM_Trap.wav` style name for a slot. */
export function ep133FileName(
  slot: number,
  name: string,
  opts?: { key?: string; bpm?: number; genre?: string }
): string {
  const paddedSlot = String(clampEp133Slot(slot)).padStart(3, '0');
  const clean = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const keyStr = opts?.key ? `_${opts.key.replace(/\s+/g, '')}` : '';
  const bpmStr = opts?.bpm ? `_${opts.bpm}BPM` : '';
  const genreStr = opts?.genre ? `_${opts.genre.split('/')[0].trim().replace(/\s+/g, '')}` : '';
  return `${paddedSlot}_${clean}${keyStr}${bpmStr}${genreStr}.wav`;
}

/**
 * `audioBufferToWavBlob` options for one EP-133-bound sample: 44.1 k / 16-bit /
 * mono, loudness-matched (loops hotter than one-shots), DC-removed, de-silenced.
 */
export function ep133WavOptions(sample: Pick<SampleItem, 'isLoop' | 'bpm' | 'key'>) {
  return {
    bitDepth: EP133_BIT_DEPTH,
    sampleRate: EP133_SAMPLE_RATE,
    monoSum: EP133_MONO,
    normalize: false,
    loudnessMatch: true,
    targetLufs: sample.isLoop ? EP133_TARGET_LUFS_LOOP : EP133_TARGET_LUFS_ONESHOT,
    targetPeakDb: EP133_TARGET_PEAK_DB,
    removeDc: true,
    trimSilence: true,
    silenceThresholdDb: -50,
    bpm: sample.bpm,
    rootKey: sample.key,
  };
}
