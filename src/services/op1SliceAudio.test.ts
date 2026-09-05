import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadSampleAudio = vi.fn();
vi.mock('./sampleAudio', () => ({
  loadSampleAudio: (...args: unknown[]) => loadSampleAudio(...args),
}));
// Pulled in by the encoder, and neither is reachable from a test runner.
vi.mock('./audioEngine', () => ({ audioEngine: {} }));
vi.mock('./audioConverter', () => ({ audioBufferToWavBlob: () => new Blob() }));

import { withLoadedSlices } from './op1PatchEncoder';
import type { Op1DrumSlice } from './op1PatchEncoder';
import type { SampleItem } from '../types/sample';

const sound = (seconds = 1) => ({ duration: seconds }) as AudioBuffer;
const slice = (fields: Partial<Op1DrumSlice> = {}) =>
  ({ id: 'pad-0', name: 'Kick', type: 'kick', ...fields }) as Op1DrumSlice;
const fromLibrary = (path: string) => ({ diskPath: path, name: path }) as SampleItem;

beforeEach(() => loadSampleAudio.mockReset());

describe('withLoadedSlices', () => {
  // The whole reason a kit built from the library came out silent.
  it('reads the audio for a slot filled from the library', async () => {
    const kick = sound();
    loadSampleAudio.mockResolvedValue(kick);

    const [loaded] = await withLoadedSlices([slice({ sampleItem: fromLibrary('01_KICKS/k.wav') })]);

    expect(loaded.audioBuffer).toBe(kick);
  });

  it('leaves a slot that already has its audio alone', async () => {
    const already = sound();
    const [loaded] = await withLoadedSlices([
      slice({ audioBuffer: already, sampleItem: fromLibrary('k.wav') }),
    ]);

    expect(loaded.audioBuffer).toBe(already);
    expect(loadSampleAudio).not.toHaveBeenCalled();
  });

  it('leaves an empty pad empty rather than inventing a sound for it', async () => {
    const [loaded] = await withLoadedSlices([slice()]);
    expect(loaded.audioBuffer).toBeUndefined();
    expect(loadSampleAudio).not.toHaveBeenCalled();
  });

  it('does not touch the slices it was given: they are React state', async () => {
    loadSampleAudio.mockResolvedValue(sound());
    const original = slice({ sampleItem: fromLibrary('k.wav') });

    const [loaded] = await withLoadedSlices([original]);

    expect(original.audioBuffer).toBeUndefined();
    expect(loaded).not.toBe(original);
  });

  it('keeps a pad whose file has gone missing, without audio', async () => {
    loadSampleAudio.mockResolvedValue(undefined);
    const [loaded] = await withLoadedSlices([slice({ sampleItem: fromLibrary('gone.wav') })]);

    expect(loaded.audioBuffer).toBeUndefined();
    expect(loaded.name).toBe('Kick');
  });

  it('keeps the twenty-four pads in the order they were given', async () => {
    loadSampleAudio.mockResolvedValue(sound());
    const pads = Array.from({ length: 24 }, (_, i) =>
      slice({ id: `pad-${i}`, sampleItem: fromLibrary(`s${i}.wav`) })
    );

    const loaded = await withLoadedSlices(pads);

    expect(loaded).toHaveLength(24);
    expect(loaded.map((s) => s.id)).toEqual(pads.map((s) => s.id));
  });
});
