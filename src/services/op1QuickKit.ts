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
  /** The patch itself, ready to write into 03_HARDWARE/OP-1_DRUM_PATCHES. */
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
