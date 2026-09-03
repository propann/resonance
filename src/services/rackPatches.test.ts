import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanPatchName,
  deleteRackPatch,
  listRackPatches,
  renameRackPatch,
  saveRackPatch,
} from './rackPatches';
import type { RackState } from '../rack/types';

const state = (type: string): RackState => ({
  version: 1,
  modules: [{ id: 'm1', type, enabled: true, params: { gain: 1 } }],
});

/** Browser fallback path: no desktop bridge, so it writes to localStorage. */
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('rack patches', () => {
  it('starts empty and keeps what it saved', async () => {
    expect(await listRackPatches()).toEqual([]);
    await saveRackPatch('Mon filtre', state('fx.filter'));
    const patches = await listRackPatches();
    expect(patches).toHaveLength(1);
    expect(patches[0].name).toBe('Mon filtre');
    expect(patches[0].state.modules[0].type).toBe('fx.filter');
  });

  it('replaces a patch saved under the same name instead of duplicating it', async () => {
    await saveRackPatch('Bus mix', state('fx.filter'));
    const after = await saveRackPatch('bus MIX', state('fx.reverb'));
    expect(after).toHaveLength(1);
    expect(after[0].state.modules[0].type).toBe('fx.reverb');
  });

  it('snapshots the state, so later edits do not rewrite the patch', async () => {
    const live = state('fx.filter');
    await saveRackPatch('Snapshot', live);
    live.modules[0].params.gain = 99;
    const [saved] = await listRackPatches();
    expect(saved.state.modules[0].params.gain).toBe(1);
  });

  it('renames and deletes', async () => {
    const [saved] = await saveRackPatch('Avant', state('fx.filter'));
    const renamed = await renameRackPatch(saved.id, '  Après  ');
    expect(renamed[0].name).toBe('Après');
    expect(await deleteRackPatch(saved.id)).toEqual([]);
  });

  it('never leaves a patch nameless', () => {
    expect(cleanPatchName('   ')).toMatch(/^Patch /);
    expect(cleanPatchName('  Deux   mots ')).toBe('Deux mots');
  });

  it('ignores junk left in storage', async () => {
    localStorage.setItem('rackPatches', JSON.stringify([{ nope: true }, null, 'x']));
    expect(await listRackPatches()).toEqual([]);
  });
});
