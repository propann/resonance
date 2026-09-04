import { describe, expect, it } from 'vitest';
import { buildCarrier, SYNTH_AUDITION_SEC } from './useLiveRack';

/** Just enough of a BaseAudioContext for `createBuffer`. */
const ctx = {
  sampleRate: 48000,
  createBuffer: (channels: number, length: number, sampleRate: number) => {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (c: number) => data[c],
    };
  },
} as unknown as BaseAudioContext;

const sampleBuffer = (seconds: number, channels = 2) => {
  const length = Math.round(48000 * seconds);
  const data = Array.from({ length: channels }, (_, c) =>
    Float32Array.from({ length }, (_v, i) => (c + 1) * 0.5 * Math.sin(i / 30))
  );
  return {
    numberOfChannels: channels,
    length,
    sampleRate: 48000,
    duration: seconds,
    getChannelData: (c: number) => data[c],
  } as unknown as AudioBuffer;
};

describe('buildCarrier', () => {
  it('plays the sample as it is when the chain has no engine', () => {
    const buffer = sampleBuffer(0.5);
    expect(buildCarrier(ctx, buffer, false)).toBe(buffer);
  });

  it('has nothing to play with neither sample nor engine', () => {
    expect(buildCarrier(ctx, undefined, false)).toBeNull();
  });

  it('gives an engine silence of its own to play over', () => {
    const carrier = buildCarrier(ctx, undefined, true);
    expect(carrier).not.toBeNull();
    expect(carrier!.duration).toBeCloseTo(SYNTH_AUDITION_SEC, 2);
  });

  // A half-second kick used to cut the engine off after half a second, which
  // read as the synth being silent.
  it('stretches a short sample so the engine is not cut off', () => {
    const buffer = sampleBuffer(0.5);
    const carrier = buildCarrier(ctx, buffer, true)!;
    expect(carrier).not.toBe(buffer);
    expect(carrier.duration).toBeCloseTo(SYNTH_AUDITION_SEC, 2);
    expect(carrier.numberOfChannels).toBe(2);
  });

  it('keeps the sample audible in the stretched carrier', () => {
    const buffer = sampleBuffer(0.5);
    const carrier = buildCarrier(ctx, buffer, true)!;
    const source = buffer.getChannelData(0);
    const copied = carrier.getChannelData(0);
    expect(copied[0]).toBe(source[0]);
    expect(copied[source.length - 1]).toBe(source[source.length - 1]);
    // and silence after it, so the engine plays on alone
    expect(copied[source.length + 100]).toBe(0);
  });

  it('leaves a sample already long enough alone', () => {
    const buffer = sampleBuffer(SYNTH_AUDITION_SEC + 1);
    expect(buildCarrier(ctx, buffer, true)).toBe(buffer);
  });
});
