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

  // `` treats `_` as a word character, so `hat` never matched
  // `Hat_Loose.wav` — and `_` is this app's own separator. Every one of these
  // used to land in percs.
  it('reads a token the underscore separator sits against', () => {
    expect(drumFamilyFor(undefined, 'Hat_Loose.wav')).toBe('hats');
    expect(drumFamilyFor(undefined, 'HH_Pedal.wav')).toBe('hats');
    expect(drumFamilyFor(undefined, 'CH_Closed_01.wav')).toBe('hats');
    expect(drumFamilyFor(undefined, 'OH_Open_Long.wav')).toBe('hats');
    expect(drumFamilyFor(undefined, 'Clap_Wide_Stack.wav')).toBe('claps');
    expect(drumFamilyFor(undefined, 'Snap_Finger.wav')).toBe('claps');
    expect(drumFamilyFor(undefined, 'Ride_Bell.wav')).toBe('cymbals');
    expect(drumFamilyFor(undefined, 'Rim_Click.wav')).toBe('snares');
    expect(drumFamilyFor(undefined, 'BD_909_Hard.wav')).toBe('kicks');
    expect(drumFamilyFor(undefined, 'KCK_Sub.wav')).toBe('kicks');
    expect(drumFamilyFor(undefined, 'SD_Rim_02.wav')).toBe('snares');
    expect(drumFamilyFor(undefined, 'Perc_Metal_03.wav')).toBe('percs');
  });

  it('reads a plural and a name run together', () => {
    expect(drumFamilyFor(undefined, 'Kicks.wav')).toBe('kicks');
    expect(drumFamilyFor(undefined, 'Hats-04.wav')).toBe('hats');
    expect(drumFamilyFor(undefined, 'TrapKick.wav')).toBe('kicks');
    expect(drumFamilyFor(undefined, 'KickDrum808.wav')).toBe('kicks');
    expect(drumFamilyFor(undefined, 'Claps 02.wav')).toBe('claps');
  });

  it('does not read a short code out of the middle of a word', () => {
    // Each of these contains clap / hat / ride / tom / perc as a substring.
    expect(drumFamilyFor(undefined, 'Thunderclap_FX.wav')).toBe('percs');
    expect(drumFamilyFor(undefined, 'Hatchback_Foley.wav')).toBe('percs');
    expect(drumFamilyFor(undefined, 'Ridemore_Lead.wav')).toBe('percs');
    expect(drumFamilyFor(undefined, 'Tomahawk_Impact.wav')).toBe('percs');
    expect(drumFamilyFor(undefined, 'Percolator_Texture.wav')).toBe('percs');
    expect(drumFamilyFor(undefined, 'Chatter_Vox.wav')).toBe('percs');
    expect(drumFamilyFor(undefined, 'Snarling_Bass.wav')).toBe('percs');
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
