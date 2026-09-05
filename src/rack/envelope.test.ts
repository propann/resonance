import { describe, expect, it } from 'vitest';
import {
  attackPoints,
  ENVELOPE_PARAMS,
  envelopeFrom,
  envelopeTailSec,
  MIN_RAMP_SEC,
  releasePoints,
} from './envelope';

const env = { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 };

describe('envelopeFrom', () => {
  it('reads the four controls out of a module’s params', () => {
    expect(envelopeFrom({ attack: 0.02, decay: 0.3, sustain: 0.4, release: 1, note: -12 })).toEqual({
      attack: 0.02,
      decay: 0.3,
      sustain: 0.4,
      release: 1,
    });
  });

  it('falls back to something playable when a control is missing', () => {
    const fallback = envelopeFrom({});
    expect(fallback.attack).toBeGreaterThan(0);
    expect(fallback.release).toBeGreaterThan(0);
    expect(fallback.sustain).toBeGreaterThan(0);
  });

  // A zero-length ramp is a step, and a step in a gain is heard as a click.
  it('never lets a ramp be instantaneous', () => {
    const clamped = envelopeFrom({ attack: 0, decay: -5, release: 0 });
    expect(clamped.attack).toBe(MIN_RAMP_SEC);
    expect(clamped.decay).toBe(MIN_RAMP_SEC);
    expect(clamped.release).toBe(MIN_RAMP_SEC);
  });

  it('keeps sustain inside its range', () => {
    expect(envelopeFrom({ sustain: 5 }).sustain).toBe(1);
    expect(envelopeFrom({ sustain: -2 }).sustain).toBe(0);
  });

  it('ignores a value that is not a number', () => {
    const safe = envelopeFrom({ attack: 'loud' as unknown as number, sustain: NaN });
    expect(safe.attack).toBeGreaterThan(0);
    expect(Number.isFinite(safe.sustain)).toBe(true);
  });
});

describe('attackPoints', () => {
  it('rises from silence to the peak, then settles on the sustain', () => {
    expect(attackPoints(10, 1, env)).toEqual([
      { time: 10, value: 0 },
      { time: 10.01, value: 1 },
      { time: 10.11, value: 0.5 },
    ]);
  });

  // Starting from zero on every strike is what stops a note retriggered mid-fade
  // from jumping to full level.
  it('always starts from zero', () => {
    expect(attackPoints(4, 0.3, env)[0]).toEqual({ time: 4, value: 0 });
  });

  it('scales the whole shape by velocity', () => {
    const soft = attackPoints(0, 0.25, env);
    expect(soft[1].value).toBe(0.25);
    expect(soft[2].value).toBe(0.125);
  });

  it('refuses a negative velocity rather than inverting the phase', () => {
    expect(attackPoints(0, -1, env)[1].value).toBe(0);
  });

  it('keeps its points in order', () => {
    const points = attackPoints(0, 1, env);
    expect(points[1].time).toBeGreaterThan(points[0].time);
    expect(points[2].time).toBeGreaterThan(points[1].time);
  });
});

describe('releasePoints', () => {
  it('fades from where it was to silence', () => {
    expect(releasePoints(20, 0.5, env)).toEqual([
      { time: 20, value: 0.5 },
      { time: 20.2, value: 0 },
    ]);
  });

  // Reaching exactly zero is what stops a source droning after the key is up.
  it('ends at exactly zero', () => {
    expect(releasePoints(0, 0.8, env)[1].value).toBe(0);
  });

  it('takes the release time rather than cutting', () => {
    const points = releasePoints(0, 1, { ...env, release: 1.5 });
    expect(points[1].time - points[0].time).toBeCloseTo(1.5, 6);
  });
});

describe('envelopeTailSec', () => {
  it('is how long a note takes from strike to silence', () => {
    expect(envelopeTailSec(env)).toBeCloseTo(0.31, 6);
  });
});

describe('ENVELOPE_PARAMS', () => {
  it('offers the four controls, each with a usable default', () => {
    expect(ENVELOPE_PARAMS.map((p) => p.key)).toEqual(['attack', 'decay', 'sustain', 'release']);
    for (const spec of ENVELOPE_PARAMS) {
      expect(typeof spec.default).toBe('number');
      expect(spec.default as number).toBeGreaterThanOrEqual(spec.min ?? 0);
      expect(spec.default as number).toBeLessThanOrEqual(spec.max ?? 1);
    }
  });

  // The defaults are what a source sounds like before anyone touches it: a
  // short attack so a key feels immediate, and a release short enough not to
  // smear one note into the next.
  it('defaults to something that plays like an instrument', () => {
    const defaults = envelopeFrom(
      Object.fromEntries(ENVELOPE_PARAMS.map((p) => [p.key, p.default as number]))
    );
    expect(defaults.attack).toBeLessThan(0.05);
    expect(defaults.release).toBeLessThan(1);
    expect(defaults.sustain).toBeGreaterThan(0);
  });
});
