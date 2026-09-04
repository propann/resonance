import { describe, expect, it } from 'vitest';
import {
  clampOctave,
  DEFAULT_OCTAVE,
  isPlayableKey,
  isSharpKey,
  MAX_OCTAVE,
  MIN_OCTAVE,
  noteForKey,
  noteName,
  PLAYABLE_KEYS,
  shouldPlay,
} from './playableKeys';

describe('noteForKey', () => {
  it('puts the home row on the white keys of one octave', () => {
    // C D E F G A B, then C D E of the next
    const row = ['KeyQ', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
    expect(row.map((code) => noteForKey(code, 3))).toEqual([48, 50, 52, 53, 55, 57, 59, 60, 62, 64]);
  });

  it('puts the black keys where a piano puts them', () => {
    // No key between E and F, nor between B and C: Digit4 and Digit8 are gaps.
    expect(noteForKey('Digit2', 3)).toBe(49); // C#
    expect(noteForKey('Digit3', 3)).toBe(51); // D#
    expect(noteForKey('Digit4', 3)).toBeUndefined();
    expect(noteForKey('Digit5', 3)).toBe(54); // F#
    expect(noteForKey('Digit6', 3)).toBe(56); // G#
    expect(noteForKey('Digit7', 3)).toBe(58); // A#
    expect(noteForKey('Digit8', 3)).toBeUndefined();
  });

  it('shifts by twelve semitones an octave', () => {
    expect(noteForKey('KeyQ', 4)! - noteForKey('KeyQ', 3)!).toBe(12);
    expect(noteForKey('KeyQ', 0)).toBe(12);
  });

  it('ignores a key that is not part of the layout', () => {
    expect(noteForKey('KeyZ', 3)).toBeUndefined();
    expect(noteForKey('Space', 3)).toBeUndefined();
    expect(noteForKey('Enter', 3)).toBeUndefined();
  });

  it('never leaves the MIDI range', () => {
    for (let octave = MIN_OCTAVE; octave <= MAX_OCTAVE; octave++) {
      for (const code of PLAYABLE_KEYS) {
        const note = noteForKey(code, octave);
        if (note !== undefined) {
          expect(note).toBeGreaterThanOrEqual(0);
          expect(note).toBeLessThanOrEqual(127);
        }
      }
    }
  });
});

describe('the layout itself', () => {
  it('gives every key its own note', () => {
    const notes = PLAYABLE_KEYS.map((code) => noteForKey(code, DEFAULT_OCTAVE));
    expect(new Set(notes).size).toBe(notes.length);
  });

  it('knows its black keys', () => {
    expect(isSharpKey('Digit2')).toBe(true);
    expect(isSharpKey('KeyQ')).toBe(false);
    expect(isSharpKey('KeyZ')).toBe(false);
  });

  it('recognises the keys it answers to', () => {
    expect(isPlayableKey('KeyQ')).toBe(true);
    expect(isPlayableKey('KeyZ')).toBe(false);
  });
});

describe('noteName', () => {
  it('names a note the way a synth does', () => {
    expect(noteName(48)).toBe('C3');
    expect(noteName(60)).toBe('C4');
    expect(noteName(49)).toBe('C#3');
    expect(noteName(0)).toBe('C-1');
  });
});

describe('clampOctave', () => {
  it('stays inside what the keyboard can reach', () => {
    expect(clampOctave(-3)).toBe(MIN_OCTAVE);
    expect(clampOctave(99)).toBe(MAX_OCTAVE);
    expect(clampOctave(4)).toBe(4);
  });
});

describe('shouldPlay', () => {
  const event = (over: Partial<Parameters<typeof shouldPlay>[0]> = {}) => ({
    code: 'KeyQ',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    target: null,
    ...over,
  });

  it('plays an ordinary key press', () => {
    expect(shouldPlay(event())).toBe(true);
  });

  // Typing a sample name must not turn the library into a synthesiser.
  it('stays silent while a field has focus', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(shouldPlay(event({ target: { tagName, isContentEditable: false } as HTMLElement }))).toBe(false);
    }
    expect(
      shouldPlay(event({ target: { tagName: 'DIV', isContentEditable: true } as HTMLElement }))
    ).toBe(false);
  });

  it('leaves shortcuts alone', () => {
    expect(shouldPlay(event({ ctrlKey: true }))).toBe(false);
    expect(shouldPlay(event({ metaKey: true }))).toBe(false);
    expect(shouldPlay(event({ altKey: true }))).toBe(false);
  });

  // Holding a key repeats the event; a note must not retrigger sixty times.
  it('ignores the auto-repeat of a held key', () => {
    expect(shouldPlay(event({ repeat: true }))).toBe(false);
  });

  it('ignores a key outside the layout', () => {
    expect(shouldPlay(event({ code: 'Space' }))).toBe(false);
  });
});
