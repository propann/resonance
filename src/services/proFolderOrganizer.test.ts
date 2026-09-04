import { describe, expect, it } from 'vitest';
import { drumFamilyFor, drumFamilyPath } from './proFolderOrganizer';

describe('drumFamilyFor', () => {
  it('reads the name first: it is more specific than the detected type', () => {
    // Classified as "percussion", but the name says rimshot -> snares.
    expect(drumFamilyFor('percussion', 'AZ_Percussion_Rimshot_02_Cm')).toBe('snares');
    expect(drumFamilyFor('percussion', 'open_hat_909')).toBe('hats');
    expect(drumFamilyFor('other', 'Crash_Cymbal_Bright')).toBe('cymbals');
  });

  it('sorts the usual drum names', () => {
    expect(drumFamilyFor('kick', 'AZ_Kick_Punch_01_Cm')).toBe('kicks');
    expect(drumFamilyFor('snare', 'AZ_Snare_Tight_Dm')).toBe('snares');
    expect(drumFamilyFor('hihat', 'AZ_Hihat_Closed_01')).toBe('hats');
    expect(drumFamilyFor('clap', 'AZ_Clap_Handclap_01')).toBe('claps');
    expect(drumFamilyFor('cymbal', 'AZ_Cymbal_Ride_Jazz')).toBe('cymbals');
    expect(drumFamilyFor('percussion', 'AZ_Percussion_Conga_High')).toBe('percs');
  });

  it('falls back to the type when the name says nothing', () => {
    expect(drumFamilyFor('kick', 'AZ_808_01_Cm')).toBe('kicks');
    expect(drumFamilyFor('snare', '1-004_01')).toBe('snares');
  });

  it('puts anything percussive it cannot name into percs', () => {
    expect(drumFamilyFor(undefined, 'mystery_hit')).toBe('percs');
    expect(drumFamilyFor('other', '')).toBe('percs');
  });

  it('builds the on-disk path', () => {
    expect(drumFamilyPath('kicks')).toBe('/01_ONE_SHOTS/01_DRUMS/01_KICKS');
    expect(drumFamilyPath('percs')).toBe('/01_ONE_SHOTS/01_DRUMS/06_PERCS');
  });
});
