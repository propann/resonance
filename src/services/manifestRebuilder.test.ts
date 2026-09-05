import { describe, expect, it } from 'vitest';
import { entryFromPath } from './manifestRebuilder';

describe('entryFromPath', () => {
  it('reads type, key and BPM back from a studio-convention name', () => {
    const entry = entryFromPath('02_LOOPS/01_DRUM_LOOPS/AZ_Loop_Arcade_Drumloop_Cmaj_171.wav');
    expect(entry.type).toBe('loop');
    expect(entry.key).toBe('Cmaj');
    expect(entry.bpm).toBe(171);
    expect(entry.category).toBe('loop');
    expect(entry.path).toBe('/02_LOOPS/01_DRUM_LOOPS');
    expect(entry.fileName).toBe('AZ_Loop_Arcade_Drumloop_Cmaj_171.wav');
  });

  it('falls back to the folder when the name says nothing', () => {
    expect(entryFromPath('01_ONE_SHOTS/01_DRUMS/01_KICKS/mystery.wav').type).toBe('kick');
    expect(entryFromPath('01_ONE_SHOTS/01_DRUMS/03_HATS/mystery.wav').type).toBe('hihat');
    expect(entryFromPath('01_ONE_SHOTS/04_VOCALS/mystery.wav').type).toBe('vocal');
  });

  it('keeps one-shots and loops apart', () => {
    expect(entryFromPath('01_ONE_SHOTS/02_BASS_808/AZ_808_Sub_Cm.wav').category).toBe('one-shot');
    expect(entryFromPath('02_LOOPS/02_MELODIC_LOOPS/AZ_Lead_Riff_Am_120.wav').category).toBe('loop');
  });

  it('marks OP-1 patches by their extension', () => {
    expect(entryFromPath('03_OP-1/drum/kit.aif').format).toBe('op-1-aiff');
    expect(entryFromPath('01_ONE_SHOTS/01_DRUMS/01_KICKS/kick.wav').format).toBe('wav');
  });

  it('does not mistake a collision suffix for a BPM', () => {
    const entry = entryFromPath('01_ONE_SHOTS/01_DRUMS/03_HATS/AZ_Hihat_Shaker_Gm_3.wav');
    expect(entry.key).toBe('Gm');
    expect(entry.bpm).toBeUndefined();
  });
});
