import { describe, expect, it } from 'vitest';
import { DEFAULT_FOLDERS } from '../data/defaultSampleLibrary';
import {
  diskPathForFolder,
  folderIdForPath,
  folderIdsWithin,
  folderMatcher,
  normalizeFolderPath,
} from './libraryFolders';
import type { FolderItem } from '../types/sample';

describe('normalizeFolderPath', () => {
  it('reads one folder out of every spelling of its path', () => {
    const same = ['/01_ONE_SHOTS/01_DRUMS', '01_ONE_SHOTS/01_DRUMS', '01_ONE_SHOTS/01_DRUMS/', '\\01_ONE_SHOTS\\01_DRUMS'];
    for (const path of same) {
      expect(normalizeFolderPath(path)).toBe('/01_ONE_SHOTS/01_DRUMS');
    }
  });
});

describe('folderIdForPath', () => {
  it('names the folder a file actually sits in', () => {
    expect(folderIdForPath('/01_ONE_SHOTS/01_DRUMS/01_KICKS')).toBe('f-os-drums-kicks');
    expect(folderIdForPath('01_ONE_SHOTS/01_DRUMS/06_PERCS')).toBe('f-os-drums-percs');
    expect(folderIdForPath('/02_LOOPS/03_VOCAL_LOOPS')).toBe('f-lp-vocals');
    expect(folderIdForPath('/03_HARDWARE/OP-1_DRUM_PATCHES')).toBe('f-op1-patches');
  });

  it('says nothing about a path outside the managed tree', () => {
    expect(folderIdForPath('/00_RECEPTION')).toBeUndefined();
    expect(folderIdForPath('/01_ONE_SHOTS/01_DRUMS/99_UNKNOWN')).toBeUndefined();
  });

  it('resolves every folder the app advertises', () => {
    for (const folder of DEFAULT_FOLDERS) {
      expect(folderIdForPath(folder.path)).toBe(folder.id);
    }
  });
});

describe('diskPathForFolder', () => {
  it('drops the leading slash for the on-disk listing', () => {
    expect(diskPathForFolder(DEFAULT_FOLDERS.find((f) => f.id === 'f-os-drums-hats')!)).toBe(
      '01_ONE_SHOTS/01_DRUMS/03_HATS'
    );
  });
});

describe('folderIdsWithin', () => {
  it('gathers a family under its drum folder', () => {
    const ids = folderIdsWithin('f-os-drums');
    expect(ids.has('f-os-drums')).toBe(true);
    expect(ids.has('f-os-drums-kicks')).toBe(true);
    expect(ids.has('f-os-drums-percs')).toBe(true);
    expect(ids.has('f-os-bass')).toBe(false);
  });

  it('reaches the third level from the root', () => {
    expect(folderIdsWithin('f-root-oneshots').has('f-os-drums-cymbals')).toBe(true);
  });

  it('stops at a leaf', () => {
    expect([...folderIdsWithin('f-os-vocals')]).toEqual(['f-os-vocals']);
  });

  it('does not care what order the folders come in', () => {
    const shuffled = [...DEFAULT_FOLDERS].reverse();
    expect(folderIdsWithin('f-root-oneshots', shuffled)).toEqual(folderIdsWithin('f-root-oneshots'));
  });
});

describe('folderMatcher', () => {
  const kick = { folderId: 'f-os-drums-kicks', folderPath: '/01_ONE_SHOTS/01_DRUMS/01_KICKS' };
  const perc = { folderId: 'f-os-drums-percs', folderPath: '/01_ONE_SHOTS/01_DRUMS/06_PERCS' };
  const pad = { folderId: 'f-os-melodic', folderPath: '/01_ONE_SHOTS/03_MELODIC' };

  it('lets everything through when no folder is selected', () => {
    const all = folderMatcher(null);
    expect([kick, perc, pad].every(all)).toBe(true);
  });

  it('selecting a parent shows the sounds filed below it', () => {
    // The badge on 01_DRUMS counts the whole family; the list has to agree.
    const drums = folderMatcher('f-os-drums');
    expect(drums(kick)).toBe(true);
    expect(drums(perc)).toBe(true);
    expect(drums(pad)).toBe(false);
  });

  it('selecting a family shows only that family', () => {
    const kicks = folderMatcher('f-os-drums-kicks');
    expect(kicks(kick)).toBe(true);
    expect(kicks(perc)).toBe(false);
  });

  it('matches on the path when the id is stale', () => {
    const percs = folderMatcher('f-os-drums-percs');
    // Moved on disk, id not refreshed yet: the disk wins.
    expect(percs({ folderId: 'f-os-drums-kicks', folderPath: '/01_ONE_SHOTS/01_DRUMS/06_PERCS' })).toBe(true);
  });

  it('a sibling folder with a longer name is not swallowed', () => {
    const loops = folderMatcher('f-root-loops');
    expect(loops({ folderPath: '/02_LOOPS_ARCHIVE/01_DRUM_LOOPS' })).toBe(false);
    expect(loops({ folderPath: '/02_LOOPS/01_DRUM_LOOPS' })).toBe(true);
  });

  it('a user folder with no disk path still matches by id', () => {
    const folders: FolderItem[] = [
      ...DEFAULT_FOLDERS,
      { id: 'mine', name: 'À TRIER', path: '/À TRIER', color: '#fff', icon: 'Folder', count: 0 },
    ];
    const mine = folderMatcher('mine', folders);
    expect(mine({ folderId: 'mine' })).toBe(true);
    expect(mine(kick)).toBe(false);
  });

  it('an unknown folder id matches nothing rather than everything', () => {
    const gone = folderMatcher('f-deleted');
    expect(gone(kick)).toBe(false);
    expect(gone({})).toBe(false);
  });
});
