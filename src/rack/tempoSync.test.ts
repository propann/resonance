import { describe, expect, it } from 'vitest';
import { syncDivisionToSeconds } from './tempoSync';

describe('syncDivisionToSeconds', () => {
  it('maps straight divisions at 120 BPM', () => {
    expect(syncDivisionToSeconds('1/4', 120)).toBeCloseTo(0.5);
    expect(syncDivisionToSeconds('1/8', 120)).toBeCloseTo(0.25);
    expect(syncDivisionToSeconds('1/16', 120)).toBeCloseTo(0.125);
    expect(syncDivisionToSeconds('1/2', 120)).toBeCloseTo(1);
  });

  it('applies dotted and triplet factors', () => {
    expect(syncDivisionToSeconds('1/8D', 120)).toBeCloseTo(0.375);
    expect(syncDivisionToSeconds('1/8T', 120)).toBeCloseTo(1 / 6);
  });

  it('clamps absurdly low BPM to 20', () => {
    expect(syncDivisionToSeconds('1/4', 5)).toBeCloseTo(3);
  });

  it('falls back to 0.25 for an unknown division', () => {
    expect(syncDivisionToSeconds('7/13', 120)).toBe(0.25);
  });
});
