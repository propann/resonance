import { describe, expect, it } from 'vitest';
import { sampleHaystack, sampleMatchesQuery } from './sampleSearchIndex';
import type { SampleItem } from '../types/sample';

const sample = (over: Partial<SampleItem> = {}): SampleItem =>
  ({
    id: 's1',
    name: 'AZ_Kick_Punch_01_Cm',
    type: 'kick',
    key: 'Cm',
    genre: 'Techno',
    bpm: 128,
    tags: ['punchy', 'analog'],
    ...over,
  }) as SampleItem;

describe('sampleHaystack', () => {
  it('gathers everything the search looks at, lower-cased', () => {
    const text = sampleHaystack(sample());
    for (const needle of ['az_kick_punch', 'kick', 'cm', 'techno', '128', 'punchy', 'analog']) {
      expect(text).toContain(needle);
    }
  });

  it('returns the very same string for the same sample, so a keystroke costs nothing', () => {
    const one = sample();
    expect(sampleHaystack(one)).toBe(sampleHaystack(one));
  });

  it('survives a sample with no key, genre, bpm or tags', () => {
    const bare = sample({ key: undefined, genre: undefined, bpm: undefined, tags: undefined });
    expect(() => sampleHaystack(bare)).not.toThrow();
    expect(sampleMatchesQuery(bare, 'kick')).toBe(true);
  });
});

describe('sampleMatchesQuery', () => {
  it('matches on any field', () => {
    const one = sample();
    expect(sampleMatchesQuery(one, 'punch')).toBe(true);
    expect(sampleMatchesQuery(one, 'techno')).toBe(true);
    expect(sampleMatchesQuery(one, '128')).toBe(true);
    expect(sampleMatchesQuery(one, 'snare')).toBe(false);
  });
});
