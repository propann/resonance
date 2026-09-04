import { describe, expect, it } from 'vitest';
import { declaredTypeFromName } from './nameTokens';
import { drumFamilyFor } from './proFolderOrganizer';
import { keywordTypeFromName } from './audioAnalyzer';

describe('declaredTypeFromName', () => {
  it('reads the type this app writes as the second token', () => {
    expect(declaredTypeFromName('AZ_Clap_Electro_Rim_03_A#m.wav')).toBe('clap');
    expect(declaredTypeFromName('AZ_Cymbal_VEC1_Cymbals_CH_01.wav')).toBe('cymbal');
    expect(declaredTypeFromName('AZ_Kick_Punchy_01.wav')).toBe('kick');
    expect(declaredTypeFromName('AZ_808_Deep.wav')).toBe('808');
  });

  it('reads the three-letter hardware code too', () => {
    expect(declaredTypeFromName('001_KCK_PunchySub.wav')).toBe('kick');
    expect(declaredTypeFromName('001_SNR_Tight.wav')).toBe('snare');
    expect(declaredTypeFromName('TE-HAT-01.wav')).toBe('hihat');
  });

  it('steps past the category when the convention spells it out', () => {
    expect(declaredTypeFromName('AZ_DRUM_KICK_F#_140_Punchy.wav')).toBe('kick');
    expect(declaredTypeFromName('AZ_SYNTH_LEAD_Bright.wav')).toBe('lead');
  });

  it('says nothing about a name that does not follow the convention', () => {
    expect(declaredTypeFromName('1-004_01.wav')).toBeUndefined();
    expect(declaredTypeFromName('my recording.wav')).toBeUndefined();
    expect(declaredTypeFromName('Broken_Glass_Hit.wav')).toBeUndefined();
  });
});

describe('the declared type outranks a passing word', () => {
  // `AZ_Clap_…_Rim_…`: the `Rim` comes from the original source name. Reading
  // it filed the sound under snares, where nobody would look for a clap.
  it('keeps a clap a clap', () => {
    expect(drumFamilyFor('clap', 'AZ_Clap_Electro_Rim_03_A#m.wav')).toBe('claps');
    expect(keywordTypeFromName('AZ_Clap_Electro_Rim_03_A#m.wav')).toBe('clap');
  });

  it('keeps a cymbal a cymbal', () => {
    expect(drumFamilyFor('cymbal', 'AZ_Cymbal_VEC1_Cymbals_CH_01_Cmaj.wav')).toBe('cymbals');
  });

  // `percussion` is the bucket a sound lands in when nothing fitted, so a name
  // with something precise in it still wins.
  it('lets the generic bucket yield to a precise name', () => {
    expect(drumFamilyFor('percussion', 'AZ_Percussion_Rimshot_02_Cm.wav')).toBe('snares');
    expect(drumFamilyFor('percussion', 'AZ_Percussion_Conga_High.wav')).toBe('percs');
    expect(keywordTypeFromName('AZ_Percussion_Rimshot_02.wav')).toBe('snare');
  });

  it('still files an app-named percussion with nothing precise in it', () => {
    expect(drumFamilyFor('percussion', 'AZ_Percussion_4471_Dm.wav')).toBe('percs');
  });
});
