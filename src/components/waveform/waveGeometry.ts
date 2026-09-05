/**
 * Where things are on the waveform, and what the pointer is over.
 *
 * `WaveformCanvas` is the largest component in the app and had no tests at
 * all, which matters because the wave is meant to become the one editing
 * window: every future gesture lands here. The drawing is not worth testing —
 * the arithmetic under it is, and this is that arithmetic, lifted out
 * unchanged.
 *
 * The interesting part is `hitTest`. The gestures overlap by design — the zone
 * handles, the playhead handle and the zone band all live in the same strip
 * along the top — so which one wins is a matter of order, not of geometry
 * alone. That order is the thing worth pinning down.
 */

/** Shorter alt-drags are treated as a stray click, not a zone. */
export const MIN_ZONE_SEC = 0.01;
/** Side of the square grab handles at the top of the zone edges. */
export const ZONE_HANDLE_PX = 11;
/** Side of the square grab handle at the top of the playhead. */
export const PLAYHEAD_HANDLE_PX = 11;
/** Click slop, in pixels, for grabbing a handle or an envelope point. */
export const GRAB_SLOP_PX = 7;

/** How far the view can be zoomed in, and that it can never go below 1:1. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 30;

/** What is on screen: the buffer, the canvas, and where the view sits. */
export interface WaveView {
  durationSec: number;
  /** Canvas width in CSS pixels. */
  width: number;
  /** 1 is the whole buffer across the canvas. */
  zoom: number;
  /** Horizontal scroll, in pixels of the zoomed image. */
  scrollOffset: number;
}

/** Seconds to a pixel on the canvas. May fall outside it when scrolled. */
export const timeToX = (timeSec: number, view: WaveView): number =>
  (timeSec / view.durationSec) * view.width * view.zoom - view.scrollOffset;

/**
 * A pixel on the canvas back to seconds, clamped to the buffer.
 *
 * Clamping is what stops a drag past the edge from seeking to a negative time
 * or past the end, which the audio engine reads as "play nothing".
 */
export function xToTime(x: number, view: WaveView): number {
  if (view.durationSec <= 0 || view.width <= 0 || view.zoom <= 0) return 0;
  const time = ((x + view.scrollOffset) / (view.width * view.zoom)) * view.durationSec;
  return Math.max(0, Math.min(view.durationSec, time));
}

/** Zoom stays between 1:1 and 30:1 however hard the wheel is turned. */
export const clampZoom = (level: number): number =>
  Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));

export interface Zone {
  startSec: number;
  endSec: number;
}

/**
 * A zone with its edges the right way round and inside the buffer, or null
 * when the drag was too short to have meant anything.
 *
 * Dragging right-to-left is normal; without this the zone would have a
 * negative length and render as nothing.
 */
export function normaliseZone(zone: Zone, durationSec: number): Zone | null {
  const start = Math.max(0, Math.min(zone.startSec, zone.endSec));
  const end = Math.min(durationSec, Math.max(zone.startSec, zone.endSec));
  if (end - start < MIN_ZONE_SEC) return null;
  return { startSec: start, endSec: end };
}

/** Move a whole zone by a delta, without letting it leave the buffer. */
export function slideZone(zone: Zone, deltaSec: number, durationSec: number): Zone {
  const length = zone.endSec - zone.startSec;
  // Clamp the start so the far edge cannot be pushed past the end either.
  const start = Math.max(0, Math.min(durationSec - length, zone.startSec + deltaSec));
  return { startSec: start, endSec: start + length };
}

/** What the pointer grabbed, if anything. */
export type WaveGrab =
  | { kind: 'zone-start' }
  | { kind: 'zone-end' }
  | { kind: 'zone-band' }
  | { kind: 'playhead' }
  | { kind: 'envelope-point'; id: string }
  | { kind: 'envelope-line' }
  | { kind: 'slice-marker'; index: number }
  | { kind: 'none' };

export interface HitContext {
  view: WaveView;
  /** Canvas height in CSS pixels, for the envelope's vertical placement. */
  height: number;
  zone: Zone | null;
  /** Where the playhead is, or null when there is none to grab. */
  playheadSec: number | null;
  /** True while the volume line is being edited; it takes over the surface. */
  isVolumeEditing: boolean;
  envelopePoints: Array<{ id: string; timeSec: number; gain: number }>;
  /** Gain of the envelope line at a given time, for the "click the line" test. */
  gainAt: (timeSec: number) => number;
  maxEnvelopeGain: number;
  slices: Array<{ startSec: number }>;
}

/**
 * What a press at (x, y) grabs.
 *
 * Order matters more than geometry here, because the targets overlap:
 *
 * 1. The zone's two edge handles, in the top strip.
 * 2. The playhead handle — checked *before* the zone band, so a head parked
 *    inside a zone can still be picked up instead of sliding the band out
 *    from under it.
 * 3. The zone band itself, between the two edges.
 * 4. The playhead handle again, outside any zone.
 * 5. The volume envelope, when editing: a point, else the line.
 * 6. A slice marker.
 *
 * Alt-drag draws a new zone and is handled by the caller before this: it must
 * beat everything, including a press that lands on an existing handle.
 */
export function hitTest(localX: number, localY: number, ctx: HitContext): WaveGrab {
  const { view, zone, playheadSec } = ctx;
  const headX = playheadSec === null ? null : timeToX(playheadSec, view);
  const overHead = headX !== null && Math.abs(localX - headX) <= PLAYHEAD_HANDLE_PX;

  // --- the top strip: zone edges, playhead, zone band ----------------------
  if (zone && localY <= ZONE_HANDLE_PX + 2) {
    const startX = timeToX(zone.startSec, view);
    const endX = timeToX(zone.endSec, view);
    if (Math.abs(localX - startX) <= ZONE_HANDLE_PX) return { kind: 'zone-start' };
    if (Math.abs(localX - endX) <= ZONE_HANDLE_PX) return { kind: 'zone-end' };
    if (!overHead && localX > startX && localX < endX) return { kind: 'zone-band' };
  }

  if (localY <= PLAYHEAD_HANDLE_PX + 2) {
    // With no playhead yet, pressing anywhere in the strip parks one.
    if (playheadSec === null || overHead) return { kind: 'playhead' };
  }

  // --- the volume envelope takes the whole surface while editing -----------
  if (ctx.isVolumeEditing) {
    const gainToY = (gain: number) => ctx.height * (1 - gain / ctx.maxEnvelopeGain);
    const point = ctx.envelopePoints.find(
      (p) => Math.hypot(localX - timeToX(p.timeSec, view), localY - gainToY(p.gain)) <= GRAB_SLOP_PX + 2
    );
    if (point) return { kind: 'envelope-point', id: point.id };

    const timeSec = xToTime(localX, view);
    const lineY = gainToY(ctx.gainAt(timeSec));
    if (Math.abs(localY - lineY) <= GRAB_SLOP_PX + 3) return { kind: 'envelope-line' };
    return { kind: 'none' };
  }

  // --- slice markers -------------------------------------------------------
  for (let i = 0; i < ctx.slices.length; i++) {
    const markerX = timeToX(ctx.slices[i].startSec, view);
    // Either right on the line, or on the little label tab beside it.
    const onLine = Math.abs(localX - markerX) <= 8;
    const onTab = localX >= markerX && localX <= markerX + 28 && localY <= 18;
    if (onLine || onTab) return { kind: 'slice-marker', index: i };
  }

  return { kind: 'none' };
}
