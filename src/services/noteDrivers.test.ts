import { describe, expect, it } from 'vitest';
import {
  arpNoteAt,
  arpOrder,
  emptyPattern,
  STEP_COUNT,
  stepDurationSec,
  stepNote,
  stepVelocity,
  wrapStep,
} from './noteDrivers';

const CHORD = [60, 64, 67]; // C major

describe('arpOrder', () => {
  it('walks a chord up and down', () => {
    expect(arpOrder(CHORD, 'up')).toEqual([60, 64, 67]);
    expect(arpOrder(CHORD, 'down')).toEqual([67, 64, 60]);
  });

  // A hardware arpeggiator does not play the turning notes twice.
  it('does not repeat the turning points going up and down', () => {
    expect(arpOrder(CHORD, 'updown')).toEqual([60, 64, 67, 64]);
  });

  it('spreads over octaves', () => {
    expect(arpOrder(CHORD, 'up', 2)).toEqual([60, 64, 67, 72, 76, 79]);
  });

  it('sorts what is handed to it, and drops duplicates', () => {
    expect(arpOrder([67, 60, 64, 60], 'up')).toEqual([60, 64, 67]);
  });

  it('never leaves the MIDI range when spreading', () => {
    const high = arpOrder([120, 124], 'up', 3);
    expect(high.every((n) => n <= 127)).toBe(true);
  });

  it('has nothing to play with no notes held', () => {
    expect(arpOrder([], 'up')).toEqual([]);
    expect(arpOrder([], 'updown')).toEqual([]);
  });

  it('handles a single note without doubling it', () => {
    expect(arpOrder([60], 'updown')).toEqual([60]);
  });
});

describe('arpNoteAt', () => {
  it('cycles through the order', () => {
    const order = arpOrder(CHORD, 'up');
    expect([0, 1, 2, 3, 4].map((i) => arpNoteAt(order, i, 'up'))).toEqual([60, 64, 67, 60, 64]);
  });

  it('survives a negative index', () => {
    const order = arpOrder(CHORD, 'up');
    expect(arpNoteAt(order, -1, 'up')).toBe(67);
  });

  it('picks from the order in random mode', () => {
    const order = arpOrder(CHORD, 'up');
    // A deterministic "random" so the test means something.
    expect(arpNoteAt(order, 0, 'random', () => 0)).toBe(60);
    expect(arpNoteAt(order, 0, 'random', () => 0.99)).toBe(67);
  });

  it('has nothing to play with an empty order', () => {
    expect(arpNoteAt([], 0, 'up')).toBeUndefined();
  });
});

describe('the step pattern', () => {
  it('starts as sixteen silent steps', () => {
    const pattern = emptyPattern();
    expect(pattern).toHaveLength(STEP_COUNT);
    expect(pattern.every((s) => !s.on)).toBe(true);
  });

  it('a step that is off is a rest', () => {
    expect(stepNote({ on: false, offset: 0, velocity: 1 }, 60)).toBeUndefined();
    expect(stepNote(undefined, 60)).toBeUndefined();
  });

  it('plays the root plus its offset', () => {
    expect(stepNote({ on: true, offset: 0, velocity: 1 }, 60)).toBe(60);
    expect(stepNote({ on: true, offset: 7, velocity: 1 }, 60)).toBe(67);
    expect(stepNote({ on: true, offset: -12, velocity: 1 }, 60)).toBe(48);
  });

  // Transposing a pattern off the end of the keyboard must rest, not throw.
  it('rests rather than leaving the MIDI range', () => {
    expect(stepNote({ on: true, offset: 80, velocity: 1 }, 60)).toBeUndefined();
    expect(stepNote({ on: true, offset: -80, velocity: 1 }, 60)).toBeUndefined();
  });

  it('clamps velocity to what MIDI allows', () => {
    expect(stepVelocity({ on: true, offset: 0, velocity: 0.8 })).toBe(102);
    expect(stepVelocity({ on: true, offset: 0, velocity: 5 })).toBe(127);
    expect(stepVelocity({ on: true, offset: 0, velocity: 0 })).toBe(1);
  });

  it('wraps the step index either way', () => {
    expect(wrapStep(0)).toBe(0);
    expect(wrapStep(16)).toBe(0);
    expect(wrapStep(17)).toBe(1);
    expect(wrapStep(-1)).toBe(15);
  });
});

describe('stepDurationSec', () => {
  it('gives sixteenths at the given tempo', () => {
    // 120 BPM: a beat is 0.5 s, a sixteenth 0.125 s.
    expect(stepDurationSec(120, 4)).toBeCloseTo(0.125, 5);
    expect(stepDurationSec(120, 2)).toBeCloseTo(0.25, 5);
  });

  it('refuses a tempo that would run away', () => {
    expect(stepDurationSec(0)).toBe(stepDurationSec(20));
    expect(stepDurationSec(10000)).toBe(stepDurationSec(300));
  });
});
