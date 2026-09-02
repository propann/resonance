import { describe, expect, it } from 'vitest';
import {
  EP133_SAMPLE_RATE,
  EP133_BIT_DEPTH,
  clampEp133Slot,
  ep133CategoryFolder,
  ep133FileName,
  ep133WavOptions,
} from './ep133';

describe('ep133 conventions', () => {
  it('standardises on 44.1 kHz / 16-bit (never 46.875 kHz)', () => {
    expect(EP133_SAMPLE_RATE).toBe(44100);
    expect(EP133_BIT_DEPTH).toBe(16);
  });

  it('clamps slots to 1..999', () => {
    expect(clampEp133Slot(0)).toBe(1);
    expect(clampEp133Slot(5000)).toBe(999);
    expect(clampEp133Slot(250.7)).toBe(251);
  });

  it('maps types to sound-group folders, with a percussion fallback', () => {
    expect(ep133CategoryFolder('kick')).toMatch(/KICKS/);
    expect(ep133CategoryFolder('808')).toBe(ep133CategoryFolder('bass'));
    expect(ep133CategoryFolder('totally-unknown')).toMatch(/PERCS/);
  });

  it('builds a zero-padded, sanitised file name', () => {
    expect(
      ep133FileName(7, 'Punchy Kick!', { key: 'C# min', bpm: 140, genre: 'Trap / Drill' })
    ).toBe('007_Punchy_Kick__C#min_140BPM_Trap.wav');
    expect(ep133FileName(42, 'Loop')).toBe('042_Loop.wav');
  });

  it('wav options are 44.1k/16-bit/mono and loudness-matched per loop vs one-shot', () => {
    const loop = ep133WavOptions({ isLoop: true, bpm: 128, key: 'Am' });
    expect(loop.sampleRate).toBe(44100);
    expect(loop.bitDepth).toBe(16);
    expect(loop.monoSum).toBe(true);
    expect(loop.targetLufs).toBe(-14);

    const oneShot = ep133WavOptions({ isLoop: false, bpm: undefined, key: undefined });
    expect(oneShot.targetLufs).toBe(-18);
  });
});
