/**
 * What plays the engines when your hands are busy: an arpeggiator and a small
 * step sequencer.
 *
 * Neither is a dependency. The search for a drop-in MIDI arpeggiator turned up
 * whole applications rather than libraries, and Tone.js — already in the
 * project — carries the transport and the scheduling. What was missing was the
 * musical logic, which is the part worth owning and testing: it is pure here,
 * and the runtime around it is a thin shell that calls the same
 * `noteOn`/`noteOff` the keyboards do.
 */

/** How an arpeggiator walks through the notes it is holding. */
export type ArpMode = 'up' | 'down' | 'updown' | 'random' | 'chord';

/**
 * The order an arpeggiator plays a held chord in, spread over `octaves`.
 *
 * `updown` does not repeat the turning points — going up C E G and back down
 * gives C E G E, not C E G G E, which is how a hardware arpeggiator phrases
 * it. `chord` returns the notes as one block, for the runtime to play at once.
 */
export function arpOrder(notes: number[], mode: ArpMode, octaves = 1): number[] {
  const sorted = [...new Set(notes)].sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const spread: number[] = [];
  for (let octave = 0; octave < Math.max(1, octaves); octave++) {
    for (const note of sorted) {
      const shifted = note + octave * 12;
      if (shifted <= 127) spread.push(shifted);
    }
  }

  switch (mode) {
    case 'up':
      return spread;
    case 'down':
      return [...spread].reverse();
    case 'updown':
      // Drop first and last of the descent: the turning notes are already there.
      return spread.length <= 1 ? spread : [...spread, ...[...spread].reverse().slice(1, -1)];
    case 'random':
      return spread;
    case 'chord':
      return spread;
  }
}

/**
 * Which note comes next, given where the arpeggiator is in its cycle.
 * `random` ignores the index and picks with `pick`, injected so a test can
 * make it deterministic.
 */
export function arpNoteAt(
  order: number[],
  index: number,
  mode: ArpMode,
  pick: () => number = Math.random
): number | undefined {
  if (order.length === 0) return undefined;
  if (mode === 'random') return order[Math.floor(pick() * order.length) % order.length];
  return order[((index % order.length) + order.length) % order.length];
}

/** One step of the sequencer. A step that is off leaves a rest. */
export interface Step {
  on: boolean;
  /** Semitones from the pattern's root. */
  offset: number;
  /** 0..1, scaled to MIDI velocity when played. */
  velocity: number;
}

export const STEP_COUNT = 16;

export const emptyPattern = (): Step[] =>
  Array.from({ length: STEP_COUNT }, () => ({ on: false, offset: 0, velocity: 0.8 }));

/**
 * The note a step plays, or undefined for a rest. Out-of-range steps are rests
 * rather than errors: transposing a pattern up must not throw.
 */
export function stepNote(step: Step | undefined, root: number): number | undefined {
  if (!step?.on) return undefined;
  const note = root + step.offset;
  return note >= 0 && note <= 127 ? note : undefined;
}

/** MIDI velocity of a step, clamped to what the protocol allows. */
export const stepVelocity = (step: Step): number =>
  Math.max(1, Math.min(127, Math.round(step.velocity * 127)));

/** Wrap a step index into the pattern, whichever way it ran off. */
export const wrapStep = (index: number, length = STEP_COUNT): number =>
  ((index % length) + length) % length;

/**
 * Seconds between two steps, from a tempo and a division.
 * `division` is how many steps fill a beat: 4 is sixteenth notes at 4/4.
 */
export function stepDurationSec(bpm: number, division = 4): number {
  const safeBpm = Math.max(20, Math.min(300, bpm));
  return 60 / safeBpm / Math.max(1, division);
}
