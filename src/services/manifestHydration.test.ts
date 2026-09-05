import { describe, expect, it } from 'vitest';
import { hydrateNewManifestSamples, manifestSampleId } from './manifestHydration';

const line = (fields: Record<string, unknown> = {}) => ({
  path: '/01_ONE_SHOTS/01_DRUMS/01_KICKS',
  fileName: 'kick_01.wav',
  name: 'Kick 01',
  type: 'kick',
  category: 'one-shot',
  ...fields,
});

describe('hydrateNewManifestSamples', () => {
  it('builds an item for a line the store has never seen', () => {
    const [sample] = hydrateNewManifestSamples([line()], new Set());
    expect(sample.name).toBe('Kick 01');
    expect(sample.type).toBe('kick');
    expect(sample.diskPath).toBe('01_ONE_SHOTS/01_DRUMS/01_KICKS/kick_01.wav');
    // Where the file sits decides the folder, not what it is called: a kick
    // sitting in 06_PERCS must be counted under percussion, or the sidebar
    // badge stops matching the list.
    expect(sample.folderId).toBe('f-os-drums-kicks');
    const [misfiled] = hydrateNewManifestSamples(
      [line({ path: '/01_ONE_SHOTS/01_DRUMS/06_PERCS', fileName: 'kick_stray.wav' })],
      new Set()
    );
    expect(misfiled.folderId).not.toBe('f-os-drums-kicks');
  });

  // The whole point: a refresh re-reads the entire manifest, and building all
  // of it froze the main thread for seconds at a time.
  it('builds nothing for lines already in the store', () => {
    const known = new Set([manifestSampleId(line(), 0)]);
    expect(hydrateNewManifestSamples([line()], known)).toEqual([]);
  });

  it('builds only the new lines out of a manifest that is mostly known', () => {
    const existing = Array.from({ length: 50 }, (_, i) => line({ fileName: `kick_${i}.wav` }));
    const known = new Set(existing.map((entry, i) => manifestSampleId(entry, i)));

    const fresh = hydrateNewManifestSamples([...existing, line({ fileName: 'new.wav' })], known);

    expect(fresh).toHaveLength(1);
    expect(fresh[0].diskPath).toContain('new.wav');
  });

  it('keeps one line when the same file appears twice in a manifest', () => {
    expect(hydrateNewManifestSamples([line(), line()], new Set())).toHaveLength(1);
  });

  it('adds what it built to the known set, so a second call repeats nothing', () => {
    const known = new Set<string>();
    expect(hydrateNewManifestSamples([line()], known)).toHaveLength(1);
    expect(hydrateNewManifestSamples([line()], known)).toHaveLength(0);
  });

  it('falls back to sane values for a line missing nearly everything', () => {
    const [sample] = hydrateNewManifestSamples([{}], new Set());
    expect(sample.name).toBe('sample-0');
    expect(sample.type).toBe('other');
    expect(sample.category).toBe('one-shot');
    expect(sample.sampleRate).toBe(48000);
    expect(sample.bitDepth).toBe(24);
    expect(sample.folderId).toBeTruthy();
  });

  it('refuses a type or genre the interface does not know how to show', () => {
    const [sample] = hydrateNewManifestSamples(
      [line({ type: 'didgeridoo', genre: 'Chiptune', category: 'album' })],
      new Set()
    );
    expect(sample.type).toBe('other');
    expect(sample.genre).toBe('Universal / Multi-Genre');
    expect(sample.category).toBe('one-shot');
  });

  it('marks a loop as one, so the filters and the sidebar agree', () => {
    const [sample] = hydrateNewManifestSamples([line({ category: 'loop' })], new Set());
    expect(sample.isLoop).toBe(true);
  });

  it('keeps only the string tags', () => {
    const [sample] = hydrateNewManifestSamples(
      [line({ tags: ['punchy', 7, null, 'analog'] })],
      new Set()
    );
    expect(sample.tags).toEqual(['punchy', 'analog']);
  });
});

describe('manifestSampleId', () => {
  it('gives the same id as the item that would be built from the line', () => {
    const entry = line();
    const [sample] = hydrateNewManifestSamples([entry], new Set());
    expect(manifestSampleId(entry, 0)).toBe(sample.id);
  });

  it('separates two files of the same name in different folders', () => {
    const a = manifestSampleId(line({ path: '/01_ONE_SHOTS/01_DRUMS/01_KICKS' }), 0);
    const b = manifestSampleId(line({ path: '/02_LOOPS' }), 0);
    expect(a).not.toBe(b);
  });
});
