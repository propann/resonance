/**
 * Volume envelope drawn over the waveform, plus the region renderer that bakes
 * it (and the edge fades) into audio. Pure functions on channel data so they
 * can be unit-tested without an AudioContext.
 */

export interface GainPoint {
  id: string;
  timeSec: number;
  /** Linear gain, 1 = unity. */
  gain: number;
}

/** Ceiling of the envelope, i.e. +6 dB. */
export const MAX_ENVELOPE_GAIN = 2;

/** Points sorted along the timeline; the editor keeps them in this order. */
export const sortGainPoints = (points: GainPoint[]): GainPoint[] =>
  [...points].sort((a, b) => a.timeSec - b.timeSec);

/**
 * Envelope value at a given time: piecewise-linear between points, held flat
 * before the first and after the last one. No points means unity gain.
 */
export function envelopeGainAt(points: GainPoint[], timeSec: number): number {
  if (points.length === 0) return 1;
  if (timeSec <= points[0].timeSec) return points[0].gain;
  const last = points[points.length - 1];
  if (timeSec >= last.timeSec) return last.gain;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (timeSec <= b.timeSec) {
      const span = b.timeSec - a.timeSec;
      if (span <= 0) return b.gain;
      return a.gain + ((b.gain - a.gain) * (timeSec - a.timeSec)) / span;
    }
  }
  return last.gain;
}

export interface RegionRenderOptions {
  startSec: number;
  endSec: number;
  /** Sorted envelope points, in the source's timeline. */
  points: GainPoint[];
  /** Linear fade at the start of the region, in milliseconds. */
  fadeInMs: number;
  /** Linear fade at the end of the region, in milliseconds. */
  fadeOutMs: number;
}

/**
 * Cut [startSec, endSec) out of the channels with the envelope applied and a
 * linear fade on each edge — the fades are what keep a cut from clicking.
 * Fades are clamped so they can never overlap.
 */
export function renderRegionChannels(
  channels: Float32Array[],
  sampleRate: number,
  { startSec, endSec, points, fadeInMs, fadeOutMs }: RegionRenderOptions
): Float32Array[] {
  const sourceLength = channels[0]?.length ?? 0;
  const startSample = Math.max(0, Math.min(sourceLength, Math.floor(startSec * sampleRate)));
  const endSample = Math.max(startSample, Math.min(sourceLength, Math.floor(endSec * sampleRate)));
  const length = Math.max(1, endSample - startSample);

  const maxFade = Math.floor(length / 2);
  const fadeIn = Math.min(maxFade, Math.max(0, Math.round((fadeInMs / 1000) * sampleRate)));
  const fadeOut = Math.min(maxFade, Math.max(0, Math.round((fadeOutMs / 1000) * sampleRate)));

  return channels.map((source) => {
    const out = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let gain = envelopeGainAt(points, (startSample + i) / sampleRate);
      if (fadeIn > 0 && i < fadeIn) gain *= i / fadeIn;
      if (fadeOut > 0 && i >= length - fadeOut) gain *= (length - 1 - i) / fadeOut;
      out[i] = (source[startSample + i] ?? 0) * gain;
    }
    return out;
  });
}
