import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  hitTest,
  MAX_ZOOM,
  MIN_ZONE_SEC,
  MIN_ZOOM,
  normaliseZone,
  slideZone,
  timeToX,
  xToTime,
  type HitContext,
  type WaveView,
} from './waveGeometry';

/** A 10 s buffer across an 800 px canvas, unzoomed: 80 px per second. */
const view: WaveView = { durationSec: 10, width: 800, zoom: 1, scrollOffset: 0 };

describe('timeToX / xToTime', () => {
  it('maps the buffer across the canvas', () => {
    expect(timeToX(0, view)).toBe(0);
    expect(timeToX(5, view)).toBe(400);
    expect(timeToX(10, view)).toBe(800);
  });

  it('comes back to where it started', () => {
    for (const t of [0, 0.3, 4.2, 9.99, 10]) {
      expect(xToTime(timeToX(t, view), view)).toBeCloseTo(t, 6);
    }
  });

  it('accounts for zoom and scroll', () => {
    const zoomed: WaveView = { ...view, zoom: 2, scrollOffset: 400 };
    // At 2x the buffer is 1600 px wide; scrolled by 400, t=5 sits at 800-400.
    expect(timeToX(5, zoomed)).toBe(400);
    expect(xToTime(400, zoomed)).toBeCloseTo(5, 6);
  });

  // A drag past the edge would otherwise seek to a negative time, which the
  // audio engine reads as "play nothing".
  it('clamps a pixel outside the canvas to the buffer', () => {
    expect(xToTime(-500, view)).toBe(0);
    expect(xToTime(99999, view)).toBe(10);
  });

  it('does not divide by zero on an empty view', () => {
    expect(xToTime(100, { durationSec: 0, width: 800, zoom: 1, scrollOffset: 0 })).toBe(0);
    expect(xToTime(100, { ...view, width: 0 })).toBe(0);
    expect(xToTime(100, { ...view, zoom: 0 })).toBe(0);
  });
});

describe('clampZoom', () => {
  it('never goes below 1:1 nor past the limit', () => {
    expect(clampZoom(-5)).toBe(MIN_ZOOM);
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(999)).toBe(MAX_ZOOM);
    expect(clampZoom(4)).toBe(4);
  });
});

describe('normaliseZone', () => {
  it('keeps a normal drag as it is', () => {
    expect(normaliseZone({ startSec: 2, endSec: 5 }, 10)).toEqual({ startSec: 2, endSec: 5 });
  });

  // Dragging right to left is ordinary; without this the zone would have a
  // negative length and draw as nothing.
  it('puts a right-to-left drag the right way round', () => {
    expect(normaliseZone({ startSec: 5, endSec: 2 }, 10)).toEqual({ startSec: 2, endSec: 5 });
  });

  it('stays inside the buffer', () => {
    expect(normaliseZone({ startSec: -3, endSec: 20 }, 10)).toEqual({ startSec: 0, endSec: 10 });
  });

  // Asserting on the threshold itself is meaningless: 4 + 0.01 - 4 comes to
  // 0.009999999999999787, so the exact boundary falls whichever way the
  // arithmetic lands. What matters is that a stray click gives nothing and a
  // deliberate drag gives a zone.
  it('treats a drag too short to mean anything as no zone', () => {
    expect(normaliseZone({ startSec: 4, endSec: 4 }, 10)).toBeNull();
    expect(normaliseZone({ startSec: 4, endSec: 4 + MIN_ZONE_SEC / 2 }, 10)).toBeNull();
    expect(normaliseZone({ startSec: 4, endSec: 4 + MIN_ZONE_SEC * 2 }, 10)).toEqual({
      startSec: 4,
      endSec: 4 + MIN_ZONE_SEC * 2,
    });
  });
});

describe('slideZone', () => {
  it('moves the whole zone, keeping its length', () => {
    expect(slideZone({ startSec: 2, endSec: 5 }, 1, 10)).toEqual({ startSec: 3, endSec: 6 });
  });

  it('stops at the start rather than going negative', () => {
    expect(slideZone({ startSec: 1, endSec: 3 }, -5, 10)).toEqual({ startSec: 0, endSec: 2 });
  });

  // Clamping the start alone is not enough: the far edge has to stay in too.
  it('stops at the end rather than pushing the far edge out', () => {
    expect(slideZone({ startSec: 7, endSec: 9 }, 5, 10)).toEqual({ startSec: 8, endSec: 10 });
  });
});

/** Everything the hit test needs, with nothing in the way by default. */
const ctx = (over: Partial<HitContext> = {}): HitContext => ({
  view,
  height: 200,
  zone: null,
  playheadSec: null,
  isVolumeEditing: false,
  envelopePoints: [],
  gainAt: () => 1,
  maxEnvelopeGain: 2,
  slices: [],
  ...over,
});

describe('hitTest — the top strip', () => {
  const zone = { startSec: 2, endSec: 5 }; // 160 px .. 400 px

  it('grabs a zone edge by its handle', () => {
    expect(hitTest(160, 4, ctx({ zone }))).toEqual({ kind: 'zone-start' });
    expect(hitTest(400, 4, ctx({ zone }))).toEqual({ kind: 'zone-end' });
  });

  it('grabs an edge from within the handle, and not beyond it', () => {
    expect(hitTest(160 + 11, 4, ctx({ zone }))).toEqual({ kind: 'zone-start' });
    expect(hitTest(160 + 12, 4, ctx({ zone })).kind).not.toBe('zone-start');
  });

  it('slides the band when pressed between the edges', () => {
    expect(hitTest(300, 4, ctx({ zone }))).toEqual({ kind: 'zone-band' });
  });

  // The head can be parked inside a zone. Sliding the band out from under it
  // would make it impossible to pick the head back up.
  it('lets a playhead inside the zone be grabbed instead of the band', () => {
    expect(hitTest(300, 4, ctx({ zone, playheadSec: 3.75 }))).toEqual({ kind: 'playhead' });
  });

  it('still slides the band when the head is elsewhere', () => {
    expect(hitTest(300, 4, ctx({ zone, playheadSec: 8 }))).toEqual({ kind: 'zone-band' });
  });

  it('grabs the playhead outside any zone', () => {
    expect(hitTest(640, 4, ctx({ playheadSec: 8 }))).toEqual({ kind: 'playhead' });
  });

  // With no head yet, pressing the strip is how you put one down.
  it('parks a playhead anywhere in the strip when there is none', () => {
    expect(hitTest(123, 4, ctx())).toEqual({ kind: 'playhead' });
  });

  it('ignores the strip once the pointer is below it', () => {
    expect(hitTest(300, 40, ctx({ zone }))).toEqual({ kind: 'none' });
    expect(hitTest(640, 40, ctx({ playheadSec: 8 }))).toEqual({ kind: 'none' });
  });
});

describe('hitTest — the volume envelope', () => {
  const points = [
    { id: 'a', timeSec: 2, gain: 1 },
    { id: 'b', timeSec: 6, gain: 0.5 },
  ];
  const editing = ctx({ isVolumeEditing: true, envelopePoints: points, gainAt: () => 1 });

  // height 200, maxGain 2: gain 1 sits at y = 200 * (1 - 0.5) = 100.
  it('grabs a point', () => {
    expect(hitTest(160, 100, editing)).toEqual({ kind: 'envelope-point', id: 'a' });
  });

  it('grabs the line where there is no point', () => {
    expect(hitTest(400, 100, editing)).toEqual({ kind: 'envelope-line' });
  });

  it('grabs nothing away from the line', () => {
    expect(hitTest(400, 180, editing)).toEqual({ kind: 'none' });
  });

  // In edit mode the wave is a canvas, not a transport: a stray click must not
  // fall through to a slice marker and start playing.
  it('does not fall through to the slices while editing', () => {
    const withSlices = ctx({
      isVolumeEditing: true,
      envelopePoints: [],
      slices: [{ startSec: 5 }],
    });
    expect(hitTest(400, 180, withSlices)).toEqual({ kind: 'none' });
  });
});

describe('hitTest — slice markers', () => {
  const slices = [{ startSec: 2.5 }, { startSec: 7 }]; // 200 px, 560 px

  it('grabs a marker on its line', () => {
    expect(hitTest(200, 100, ctx({ slices }))).toEqual({ kind: 'slice-marker', index: 0 });
    expect(hitTest(560, 100, ctx({ slices }))).toEqual({ kind: 'slice-marker', index: 1 });
  });

  it('grabs a marker by its label tab, below the playhead strip', () => {
    // The tab is drawn 18 px tall; only its lower part is reachable, see below.
    expect(hitTest(215, 15, ctx({ slices, playheadSec: 1 }))).toEqual({
      kind: 'slice-marker',
      index: 0,
    });
    expect(hitTest(215, 100, ctx({ slices, playheadSec: 1 }))).toEqual({ kind: 'none' });
  });

  /**
   * A defect this extraction brought to light, kept as it is rather than
   * changed under cover of a refactor.
   *
   * The playhead strip is 13 px tall and, with no playhead yet, a press
   * anywhere in it parks one. A slice's label tab is 18 px tall and starts at
   * the very top, so its first 13 px are swallowed: on a freshly loaded sample
   * the tab only answers in its bottom 5 px. Once a playhead exists the strip
   * only claims presses within 11 px of it, and the tab works normally.
   */
  it('has its label tab swallowed by the playhead strip while no head exists', () => {
    expect(hitTest(215, 10, ctx({ slices }))).toEqual({ kind: 'playhead' });
    expect(hitTest(215, 15, ctx({ slices }))).toEqual({ kind: 'slice-marker', index: 0 });
  });

  it('grabs nothing between markers', () => {
    expect(hitTest(400, 100, ctx({ slices }))).toEqual({ kind: 'none' });
  });

  it('takes the first marker when two overlap', () => {
    const stacked = [{ startSec: 5 }, { startSec: 5.01 }];
    expect(hitTest(400, 100, ctx({ slices: stacked }))).toEqual({ kind: 'slice-marker', index: 0 });
  });
});
