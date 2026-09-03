import { describe, expect, it } from 'vitest';
import { cleanRawSampleName, deriveSourceName, isMeaninglessName } from './sampleNamingConvention';

describe('isMeaninglessName', () => {
  it('spots names that carry no information', () => {
    expect(isMeaninglessName('')).toBe(true);
    expect(isMeaninglessName('01')).toBe(true);
    expect(isMeaninglessName('1-001_01')).toBe(true);
    expect(isMeaninglessName('Track_02')).toBe(true);
    expect(isMeaninglessName('Untitled')).toBe(true);
  });

  it('keeps real names', () => {
    expect(isMeaninglessName('Darbuka')).toBe(false);
    expect(isMeaninglessName('Moog_Bass_02')).toBe(false);
    expect(isMeaninglessName('Arcade_Time_Drumloop')).toBe(false);
  });
});

describe('deriveSourceName', () => {
  it('keeps a name that already says something', () => {
    expect(deriveSourceName('Large_Darbuka_02.wav', '00_RECEPTION/A_TRIER/Large_Darbuka_02.wav')).toBe(
      cleanRawSampleName('Large_Darbuka_02.wav')
    );
  });

  it('falls back to the pack folder when the file name is just numbers', () => {
    expect(deriveSourceName('1-001_01.wav', '00_RECEPTION/MOOG_SYNTH/1-001_01.wav')).toBe('Moog_Synth_101');
  });

  it('skips staging folders and reaches the meaningful one', () => {
    expect(deriveSourceName('01.wav', '00_RECEPTION/HOUSE_DISCO/A_TRIER/01.wav')).toBe('House_Disco_01');
  });

  it('falls back to the timbre when nothing else says anything', () => {
    expect(
      deriveSourceName('1-002_01.wav', '00_RECEPTION/A_TRIER/1-002_01.wav', { tags: ['sub', 'punchy'] })
    ).toBe('Sub_201');
  });

  it('keeps the full stem when nothing is descriptive, so files stay unique', () => {
    expect(deriveSourceName('14-001_01.wav', '00_RECEPTION/A_TRIER/14-001_01.wav')).toBe('14_001_01');
    expect(deriveSourceName('14-002_01.wav', '00_RECEPTION/A_TRIER/14-002_01.wav')).toBe('14_002_01');
  });

  it('never returns an empty name', () => {
    expect(deriveSourceName('01.wav', '00_RECEPTION/A_TRIER/01.wav')).toBeTruthy();
  });
});
