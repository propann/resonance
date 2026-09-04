/**
 * The computer keyboard as an instrument.
 *
 * The engines could be auditioned but not played: the Creator offered eight
 * notes to click with the mouse, and MIDI for whoever had a controller
 * plugged in. Two rows of the typing keyboard are laid out here like a piano —
 * the home row is the white keys, the row above holds the black ones where a
 * piano has them — so an engine can be played with nothing but the laptop.
 *
 * Layout is read from `event.code`, not `event.key`, so it lands on the same
 * physical keys on AZERTY and QWERTY alike.
 */

/** Semitones above the octave's C, by physical key. */
const KEY_SEMITONES: Record<string, number> = {
  // white keys — the home row
  KeyQ: 0, // C
  KeyS: 2, // D
  KeyD: 4, // E
  KeyF: 5, // F
  KeyG: 7, // G
  KeyH: 9, // A
  KeyJ: 11, // B
  KeyK: 12, // C, one octave up
  KeyL: 14, // D
  Semicolon: 16, // E
  // black keys — the row above, where a piano puts them
  Digit2: 1, // C#
  Digit3: 3, // D#
  Digit5: 6, // F#
  Digit6: 8, // G#
  Digit7: 10, // A#
  Digit9: 13, // C#
  Digit0: 15, // D#
};

/** Lowest and highest octave the keyboard can be shifted to. */
export const MIN_OCTAVE = 0;
export const MAX_OCTAVE = 8;
/** Where the keyboard sits by default: C3, comfortable for basses and leads. */
export const DEFAULT_OCTAVE = 3;

/**
 * The MIDI note a physical key plays at the given octave, or undefined when
 * the key is not part of the layout.
 *
 * Octave 3 puts `KeyQ` on note 48 (C3), which is where a hardware synth
 * usually starts.
 */
export function noteForKey(code: string, octave: number): number | undefined {
  const semitones = KEY_SEMITONES[code];
  if (semitones === undefined) return undefined;
  const note = (octave + 1) * 12 + semitones;
  // Outside the MIDI range the note simply does not exist.
  return note >= 0 && note <= 127 ? note : undefined;
}

/** Every physical key the layout uses, in playing order. */
export const PLAYABLE_KEYS = Object.keys(KEY_SEMITONES);

/** True when the key is one the instrument answers to. */
export const isPlayableKey = (code: string): boolean => code in KEY_SEMITONES;

/** True for the black keys, so the strip can draw them differently. */
export function isSharpKey(code: string): boolean {
  const semitones = KEY_SEMITONES[code];
  return semitones !== undefined && [1, 3, 6, 8, 10].includes(((semitones % 12) + 12) % 12);
}

/** `48` → `C3`, for labelling a key. */
export function noteName(note: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`;
}

/** Keep an octave shift inside what the keyboard can reach. */
export const clampOctave = (octave: number): number =>
  Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, octave));

/**
 * Whether a key event should reach the instrument at all.
 *
 * Typing a sample name must not play notes, and neither should a shortcut:
 * the instrument stays out of the way while a field has focus or a modifier
 * is held.
 */
export function shouldPlay(event: {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  target: EventTarget | null;
}): boolean {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (!isPlayableKey(event.code)) return false;
  const target = event.target as HTMLElement | null;
  if (!target) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  return !target.isContentEditable;
}
