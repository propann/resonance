import { describe, expect, it } from 'vitest';
import {
  envelopeGainAt,
  renderRegionChannels,
  sortGainPoints,
  type GainPoint,
} from './gainEnvelope';

const p = (timeSec: number, gain: number): GainPoint => ({ id: `${timeSec}`, timeSec, gain });

describe('envelopeGainAt', () => {
  it('is unity with no points', () => {
    expect(envelopeGainAt([], 0)).toBe(1);
    expect(envelopeGainAt([], 12.5)).toBe(1);
  });

  it('holds flat outside the first and last point', () => {
    const points = [p(1, 0.5), p(2, 1.5)];
    expect(envelopeGainAt(points, 0)).toBe(0.5);
    expect(envelopeGainAt(points, 9)).toBe(1.5);
  });

  it('interpolates linearly between points', () => {
    const points = [p(0, 0), p(1, 1)];
    expect(envelopeGainAt(points, 0.25)).toBeCloseTo(0.25, 6);
    expect(envelopeGainAt(points, 0.5)).toBeCloseTo(0.5, 6);
  });

  it('survives two points at the same time', () => {
    const points = [p(1, 0.2), p(1, 0.9)];
    expect(envelopeGainAt(points, 1)).toBe(0.2);
  });
});

describe('sortGainPoints', () => {
  it('orders by time without mutating the input', () => {
    const points = [p(2, 1), p(0.5, 1)];
    expect(sortGainPoints(points).map((x) => x.timeSec)).toEqual([0.5, 2]);
    expect(points[0].timeSec).toBe(2);
  });
});

describe('renderRegionChannels', () => {
  const ones = () => [new Float32Array(1000).fill(1)];

  it('cuts the requested region', () => {
    const [out] = renderRegionChannels(ones(), 1000, {
      startSec: 0.2,
      endSec: 0.5,
      points: [],
      fadeInMs: 0,
      fadeOutMs: 0,
    });
    expect(out.length).toBe(300);
    expect(out[150]).toBeCloseTo(1, 6);
  });

  it('fades both edges in and out', () => {
    const [out] = renderRegionChannels(ones(), 1000, {
      startSec: 0,
      endSec: 1,
      points: [],
      fadeInMs: 10,
      fadeOutMs: 10,
    });
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(0);
    expect(out[5]).toBeCloseTo(0.5, 2);
    expect(out[500]).toBeCloseTo(1, 6);
  });

  it('never lets the fades overlap', () => {
    const [out] = renderRegionChannels(ones(), 1000, {
      startSec: 0,
      endSec: 0.01,
      points: [],
      fadeInMs: 500,
      fadeOutMs: 500,
    });
    expect(out.length).toBe(10);
    expect(Math.max(...out)).toBeGreaterThan(0);
  });

  it('bakes the envelope, in the source timeline', () => {
    const [out] = renderRegionChannels(ones(), 1000, {
      startSec: 0.5,
      endSec: 1,
      points: [p(0.5, 0), p(1, 1)],
      fadeInMs: 0,
      fadeOutMs: 0,
    });
    expect(out[0]).toBeCloseTo(0, 6);
    expect(out[250]).toBeCloseTo(0.5, 2);
    expect(out[out.length - 1]).toBeCloseTo(1, 2);
  });

  it('clamps a region that runs past the buffer', () => {
    const [out] = renderRegionChannels(ones(), 1000, {
      startSec: 0.9,
      endSec: 5,
      points: [],
      fadeInMs: 0,
      fadeOutMs: 0,
    });
    expect(out.length).toBe(100);
  });
});
