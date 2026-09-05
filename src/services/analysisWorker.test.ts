import { describe, expect, it } from 'vitest';
import { analyseBuffer, bufferLike } from './analysisWorker';
import { workerCount } from './analysisPool';
import { calculateAudioMetrics, detectBpm } from './audioAnalyzer';

const RATE = 48000;

/** A decaying tone, the shape of an ordinary one-shot. */
function tone(seconds = 0.5, hz = 220): Float32Array {
  const n = Math.round(RATE * seconds);
  return Float32Array.from({ length: n }, (_, i) =>
    Math.sin((2 * Math.PI * hz * i) / RATE) * Math.exp(-i / (RATE * 0.15))
  );
}

describe('bufferLike', () => {
  // The analysis reads exactly four members of an AudioBuffer. Standing them
  // up around plain arrays is what lets the same code run in a worker.
  it('presents channel data as the analysis expects a buffer to look', () => {
    const left = tone(0.25);
    const right = tone(0.25, 330);
    const buffer = bufferLike([left, right], RATE);

    expect(buffer.sampleRate).toBe(RATE);
    expect(buffer.numberOfChannels).toBe(2);
    expect(buffer.duration).toBeCloseTo(0.25, 6);
    expect(buffer.getChannelData(0)).toBe(left);
    expect(buffer.getChannelData(1)).toBe(right);
  });

  // Mono material asked for its right channel must not come back undefined:
  // several detectors read channel 1 without checking.
  it('answers for a channel that is not there', () => {
    const mono = tone(0.1);
    const buffer = bufferLike([mono], RATE);
    expect(buffer.getChannelData(1)).toBe(mono);
  });

  it('survives an empty buffer without dividing by zero', () => {
    const empty = bufferLike([], RATE);
    expect(empty.duration).toBe(0);
    expect(empty.numberOfChannels).toBe(0);
  });
});

describe('analyseBuffer', () => {
  const request = {
    id: 7,
    channels: [tone()],
    sampleRate: RATE,
    name: 'AZ_Kick_Test.wav',
    index: 3,
  };

  it('returns everything the curator needs, in one answer', () => {
    const result = analyseBuffer(request);
    expect(result.id).toBe(7);
    for (const key of [
      'metrics',
      'features',
      'pitchKey',
      'bpm',
      'loopAnalysis',
      'slices',
      'classification',
      'genre',
      'ep133Slot',
      'timbralTags',
    ]) {
      expect(result).toHaveProperty(key);
    }
  });

  // The whole point of the port is that the analysis is unchanged. If the
  // worker's answer drifted from the main thread's, the ingest would classify
  // sounds differently depending on where it ran.
  it('gives the same answer as calling the analysis directly', () => {
    const direct = bufferLike(request.channels, RATE) as unknown as AudioBuffer;
    const result = analyseBuffer(request);
    expect(result.metrics).toEqual(calculateAudioMetrics(direct));
    expect(result.bpm).toEqual(detectBpm(direct));
  });

  it('reads the name, which several detectors depend on', () => {
    const kick = analyseBuffer({ ...request, name: 'AZ_Kick_Punchy.wav' });
    const vocal = analyseBuffer({ ...request, name: 'AZ_Vocal_Ahh.wav' });
    expect(kick.classification.type).toBe('kick');
    expect(vocal.classification.type).toBe('vocal');
  });

  it('handles a very short sound rather than throwing', () => {
    expect(() => analyseBuffer({ ...request, channels: [tone(0.01)] })).not.toThrow();
  });
});

describe('workerCount', () => {
  // The main thread still has decoding and the interface to do, so it keeps a
  // core; and past a handful the copying costs more than the parallelism wins.
  it('leaves a core for the main thread', () => {
    expect(workerCount(8)).toBe(6);
    expect(workerCount(4)).toBe(3);
  });

  it('always returns at least one', () => {
    expect(workerCount(1)).toBe(1);
    expect(workerCount(0)).toBe(1);
  });

  it('does not spawn a worker per core on a large machine', () => {
    expect(workerCount(64)).toBe(6);
  });
});
