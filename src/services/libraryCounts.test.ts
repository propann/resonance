import { describe, expect, it } from 'vitest';
import { countInFolder, countLibrary, countOfType } from './libraryCounts';
import { folderMatcher, type FolderPlacement } from './libraryFolders';
import { DEFAULT_FOLDERS } from '../data/defaultSampleLibrary';

type Sample = FolderPlacement & { type?: string; isLoop?: boolean; category?: string };

const sample = (fields: Sample = {}): Sample => ({ folderId: 'f-os-drums-kicks', ...fields });

/** What the sidebar used to do, kept here as the thing to agree with. */
const oldCount = (samples: Sample[], folderId: string) =>
  samples.filter(folderMatcher(folderId, DEFAULT_FOLDERS)).length;

describe('countInFolder', () => {
  it('counts the samples that name the folder', () => {
    const samples = [sample(), sample(), sample({ folderId: 'f-os-drums-snares' })];
    expect(countInFolder(countLibrary(samples), 'f-os-drums-kicks', DEFAULT_FOLDERS)).toBe(2);
  });

  it('rolls children up into their parent', () => {
    const samples = [sample({ folderId: 'f-os-drums-kicks' }), sample({ folderId: 'f-os-drums-snares' })];
    const counts = countLibrary(samples);
    expect(countInFolder(counts, 'f-os-drums', DEFAULT_FOLDERS)).toBe(2);
  });

  // folderMatcher accepts a sample by id *or* by its path sitting under the
  // folder. A tally by id alone would silently lose the second kind.
  it('still counts a sample placed only by its path', () => {
    const samples = [sample({ folderId: undefined, folderPath: '/01_ONE_SHOTS/01_DRUMS/01_KICKS' })];
    const counts = countLibrary(samples);
    expect(counts.unplaced).toHaveLength(1);
    expect(countInFolder(counts, 'f-os-drums-kicks', DEFAULT_FOLDERS)).toBe(1);
  });

  it('agrees with folderMatcher on a mixed library, folder by folder', () => {
    const samples: Sample[] = [
      sample({ folderId: 'f-os-drums-kicks' }),
      sample({ folderId: 'f-os-drums-snares' }),
      sample({ folderId: 'f-lp-drums' }),
      // Placed by path only, at three different depths.
      sample({ folderId: undefined, folderPath: '/01_ONE_SHOTS/01_DRUMS/01_KICKS' }),
      sample({ folderId: undefined, folderPath: '/01_ONE_SHOTS' }),
      sample({ folderId: undefined, folderPath: '/02_LOOPS' }),
      // Neither id nor a path anyone claims.
      sample({ folderId: undefined, folderPath: '/99_NOWHERE' }),
      sample({ folderId: undefined }),
    ];
    const counts = countLibrary(samples);

    for (const folder of DEFAULT_FOLDERS) {
      expect(
        countInFolder(counts, folder.id, DEFAULT_FOLDERS),
        `désaccord sur ${folder.id}`
      ).toBe(oldCount(samples, folder.id));
    }
  });

  it('does not let one folder swallow another whose name it prefixes', () => {
    const samples = [sample({ folderId: undefined, folderPath: '/02_LOOPS_ARCHIVE/old.wav' })];
    const counts = countLibrary(samples);
    expect(countInFolder(counts, 'f-root-loops', DEFAULT_FOLDERS)).toBe(
      oldCount(samples, 'f-root-loops')
    );
  });

  it('counts nothing for an empty library', () => {
    const counts = countLibrary([]);
    expect(countInFolder(counts, 'f-os-drums-kicks', DEFAULT_FOLDERS)).toBe(0);
    expect(counts.total).toBe(0);
  });
});

describe('countOfType', () => {
  const samples = [
    sample({ type: 'kick' }),
    sample({ type: 'snare' }),
    sample({ type: 'clap' }),
    sample({ type: 'hihat' }),
    sample({ type: 'cymbal' }),
    sample({ type: 'cymbal' }),
  ];
  const counts = countLibrary(samples);

  it('counts a plain type', () => {
    expect(countOfType(counts, 'kick')).toBe(1);
  });

  // The type filter reads them together, so the badge has to as well.
  it('counts claps with snares and cymbals with hi-hats', () => {
    expect(countOfType(counts, 'snare')).toBe(2);
    expect(countOfType(counts, 'hihat')).toBe(3);
  });

  it('counts everything for "all"', () => {
    expect(countOfType(counts, 'all')).toBe(6);
  });

  it('counts none of a type nothing has', () => {
    expect(countOfType(counts, 'vocal')).toBe(0);
  });
});

describe('loops', () => {
  it('counts a loop however the sample says it is one', () => {
    const counts = countLibrary([
      sample({ isLoop: true }),
      sample({ category: 'loop' }),
      sample({ type: 'loop' }),
      sample({ type: 'kick' }),
    ]);
    expect(counts.loops).toBe(3);
  });

  it('counts a sample that says it three ways only once', () => {
    const counts = countLibrary([sample({ isLoop: true, category: 'loop', type: 'loop' })]);
    expect(counts.loops).toBe(1);
  });
});
