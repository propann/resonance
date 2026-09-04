import { describe, expect, it } from 'vitest';
import { classifySample } from './audioAnalyzer';

const metrics = {
  peakDb: -3,
  rmsDb: -14,
  spectralCentroid: 2000,
  zeroCrossingRate: 0.1,
  dynamicRangeDb: 11,
  sustainFactor: 0.3,
};

const data = new Float32Array(Math.round(48000 * 0.4)).map(
  (_, i) => Math.sin(i / 20) * Math.exp(-i / 3000)
);
const buffer = {
  duration: 0.4,
  numberOfChannels: 1,
  sampleRate: 48000,
  length: data.length,
  getChannelData: () => data,
} as unknown as AudioBuffer;

/**
 * The type the *name* settles, or undefined when the name says nothing and the
 * sound goes on to the acoustic analysis. Keyword verdicts are the ones that
 * explain themselves with "Keyword:".
 */
function keywordType(name: string): string | undefined {
  const result = classifySample(buffer, name, metrics, 0);
  return result.acousticDetails.startsWith('Keyword:') ? result.type : undefined;
}

describe('classifySample keyword stage', () => {
  it('reads the sound a name states', () => {
    expect(keywordType('Kick_01.wav')).toBe('kick');
    expect(keywordType('TrapKick.wav')).toBe('kick');
    expect(keywordType('Snare_Tight.wav')).toBe('snare');
    expect(keywordType('Hihat_Closed.wav')).toBe('hihat');
    expect(keywordType('Clap_Wide.wav')).toBe('clap');
    expect(keywordType('Crash_18in.wav')).toBe('cymbal');
    expect(keywordType('808_Deep.wav')).toBe('808');
    expect(keywordType('Vocal_Chop.wav')).toBe('vocal');
    expect(keywordType('Riser_FX.wav')).toBe('fx');
    expect(keywordType('Pad_Warm.wav')).toBe('pad');
    expect(keywordType('Synth_Lead_A.wav')).toBe('lead');
    expect(keywordType('Drum_Loop_120.wav')).toBe('loop');
  });

  // These need `bd_`, `sd_`, `hh_` before: a dash or a digit did not count as
  // a separator, so the codes went unread and the sound was guessed from DSP.
  it('reads a short code whatever separates it', () => {
    expect(keywordType('BD_909.wav')).toBe('kick');
    expect(keywordType('BD-909.wav')).toBe('kick');
    expect(keywordType('SD-02.wav')).toBe('snare');
    expect(keywordType('HH-01.wav')).toBe('hihat');
    expect(keywordType('Hat_Loose.wav')).toBe('hihat');
    expect(keywordType('Ride_Bell.wav')).toBe('cymbal');
    expect(keywordType('Vox 04.wav')).toBe('vocal');
    expect(keywordType('Keys_Soft.wav')).toBe('lead');
  });

  // A bare `includes('hat')` used to read a hi-hat out of `Whatever_Vox.wav`.
  it('does not read a code out of the middle of a word', () => {
    expect(keywordType('That_Sound.wav')).toBeUndefined();
    expect(keywordType('Chat_Ambience.wav')).toBeUndefined();
    expect(keywordType('Hatchback_Foley.wav')).toBeUndefined();
    expect(keywordType('Sharp_Stab.wav')).toBeUndefined();
    expect(keywordType('Harp_Gliss.wav')).toBeUndefined();
    expect(keywordType('Monkey_Scream.wav')).toBeUndefined();
    expect(keywordType('Launchpad_Rec.wav')).toBeUndefined();
    expect(keywordType('Broken_Glass.wav')).toBeUndefined();
  });

  // The word that really names the sound has to win over the one hiding inside
  // another word.
  it('reads the word that names the sound, not the one it contains', () => {
    expect(keywordType('Whatever_Vox.wav')).toBe('vocal');
    expect(keywordType('Override_Lead.wav')).toBe('lead');
    expect(keywordType('Bride_Choir.wav')).toBe('vocal');
    expect(keywordType('Thunderclap_FX.wav')).toBe('fx');
    expect(keywordType('Keyboard_Take.wav')).toBe('lead');
    expect(keywordType('Warped_Texture.wav')).toBe('pad');
  });

  it('leaves a nameless sound to the acoustic analysis', () => {
    const result = classifySample(buffer, '1-004_01.wav', metrics, 0);
    expect(result.acousticDetails.startsWith('Keyword:')).toBe(false);
    expect(result.type).toBeTruthy();
  });

  it('still recognises a multi-hit strip before looking at the audio', () => {
    const strip = { ...buffer, duration: 4 } as unknown as AudioBuffer;
    const result = classifySample(strip, '1-004_01.wav', metrics, 6);
    expect(result.type).toBe('multi-sound');
    expect(result.isMultiSound).toBe(true);
  });
});
