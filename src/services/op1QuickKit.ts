/**
 * A drum kit for the OP-1 in one step, from sounds you already have.
 *
 * The OP-1's drum format is one twelve-second audio file with twenty-four
 * markers in it, one per pad. Building that by hand meant opening the kit
 * builder, filling slots, then exporting. Given a handful of buffers — the
 * models of an engine, the same patch played at different pitches — this
 * assembles the whole thing: the composite audio, the markers laid over it,
 * and the `.aif` ready to write.
 *
 * The markers come back as `SliceRegion`s too, which is what the waveform
 * editor already knows how to draw and drag, so the kit lands on the wave as
 * something you can still move around rather than a finished file.
 */
import { buildOp1DrumBuffer, encodeOp1AiffPatch, type Op1DrumSlice } from './op1PatchEncoder';
import { OP1_MAX_DRUM_SEC, OP1_SAMPLE_RATE } from './hardware/op1og';
import type { SliceRegion } from '../types/sample';

/** The OP-1 has twenty-four pads, and no more. */
export const OP1_PAD_COUNT = 24;

/** A sound going into a pad. */
export interface Op1KitSound {
  label: string;
  buffer: AudioBuffer;
}

export interface Op1QuickKit {
  /** The twelve-second composite, ready for the wave. */
  buffer: AudioBuffer;
  /** One region per pad, drawn and draggable in the editor. */
  slices: SliceRegion[];
  /** The patch itself, ready to write into 03_OP-1/drum. */
  aiff: Blob;
  /** File-safe kit name, without extension. */
  name: string;
}

/** Pads cycle through these so neighbours are told apart at a glance. */
const PAD_COLOURS = [
  '#00F0FF',
  '#A855F7',
  '#FFE600',
  '#FF7A00',
  '#10B981',
  '#EF4444',
];

/** `Plaits — Corde pincée` → `PLAITS_Corde_pincee`, safe on any filesystem. */
export function kitFileName(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned || 'KIT').slice(0, 40);
}

/**
 * Assemble up to twenty-four sounds into an OP-1 drum patch.
 *
 * Fewer than twenty-four is fine — the OP-1 simply has empty pads past the
 * end. More are dropped rather than squeezed in, because a pad that holds a
 * sliver of a sound is worse than no pad.
 */
export async function buildOp1QuickKit(
  sounds: Op1KitSound[],
  kitName: string
): Promise<Op1QuickKit> {
  if (sounds.length === 0) {
    throw new Error('Aucun son à mettre dans le kit.');
  }
  const kept = sounds.slice(0, OP1_PAD_COUNT);

  const slots: Op1DrumSlice[] = kept.map((sound, index) => ({
    id: `pad-${index}`,
    name: sound.label,
    type: 'other',
    startSec: 0,
    endSec: sound.buffer.duration,
    pitch: 0,
    reverse: false,
    playmode: 0,
    // 8192 is the encoder's unity gain, not a maximum.
    volume: 8192,
    audioBuffer: sound.buffer,
    color: PAD_COLOURS[index % PAD_COLOURS.length],
  }));

  // The builder lays the sounds end to end inside the twelve seconds the
  // format allows, and reports where each one actually landed.
  const { audioBuffer, calculatedSlices } = await buildOp1DrumBuffer(slots, {
    useMono: true,
    loudnessMatch: true,
  });

  const name = kitFileName(kitName);
  const aiff = encodeOp1AiffPatch(audioBuffer, calculatedSlices, name);

  // The builder always reports twenty-four slots, filling the ones it was not
  // given with the OP-1's default pad names. Those are not pads that hold
  // anything, and drawing a marker for them would put "Break / Mini Loop" on
  // the wave where there is silence — so only the ones we supplied are kept.
  const filled = calculatedSlices.slice(0, kept.length);

  const slices: SliceRegion[] = filled.map((slice, index) => ({
    id: slice.id || `pad-${index}`,
    index,
    startSec: slice.startSec,
    endSec: slice.endSec,
    label: slice.name || `Pad ${index + 1}`,
    color: slice.color || PAD_COLOURS[index % PAD_COLOURS.length],
  }));

  return { buffer: audioBuffer, slices, aiff, name };
}


/**
 * Re-encode whatever is on the wave as an OP-1 patch, using the markers where
 * they now sit.
 *
 * The kit builder writes a patch as it assembles one, but the markers can be
 * dragged afterwards, and the file on disk would then no longer match what is
 * on screen. This takes the current positions and writes them.
 *
 * The OP-1 wants 44.1 kHz mono and no more than twelve seconds. The encoder
 * downmixes and truncates on its own, but it reads marker times against
 * 44.1 kHz, so a 48 kHz buffer has to be resampled first or every pad lands
 * about a tenth early.
 */
export async function encodeOp1FromWave(
  buffer: AudioBuffer,
  regions: SliceRegion[],
  kitName: string
): Promise<{ aiff: Blob; name: string; pads: number }> {
  if (regions.length === 0) {
    throw new Error('Aucune découpe sur l’onde : rien à mettre sur les pads.');
  }

  const work =
    Math.abs(buffer.sampleRate - OP1_SAMPLE_RATE) < 1
      ? buffer
      : await resampleTo(buffer, OP1_SAMPLE_RATE);

  const limit = Math.min(work.duration, OP1_MAX_DRUM_SEC);
  const slices: Op1DrumSlice[] = regions
    .slice(0, OP1_PAD_COUNT)
    // A marker dragged past the twelve-second edge would encode as a pad that
    // starts after the audio ends, which the OP-1 reads as silence.
    .filter((region) => region.startSec < limit)
    .map((region, index) => ({
      id: region.id || `pad-${index}`,
      name: region.label || `Pad ${index + 1}`,
      type: 'other',
      startSec: Math.max(0, Math.min(region.startSec, limit)),
      endSec: Math.max(region.startSec, Math.min(region.endSec, limit)),
      pitch: 0,
      reverse: false,
      playmode: 0,
      volume: 8192,
      color: region.color,
    }));

  if (slices.length === 0) {
    throw new Error('Toutes les découpes sont au-delà des 12 s du format OP-1.');
  }

  const name = kitFileName(kitName);
  return { aiff: encodeOp1AiffPatch(work, slices, name), name, pads: slices.length };
}

/** Render a buffer through an offline context at another rate. */
async function resampleTo(buffer: AudioBuffer, targetRate: number): Promise<AudioBuffer> {
  const Ctx = globalThis.OfflineAudioContext;
  const frames = Math.max(1, Math.round(buffer.duration * targetRate));
  const ctx = new Ctx(buffer.numberOfChannels, frames, targetRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  return ctx.startRendering();
}
