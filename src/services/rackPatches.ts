/**
 * Named rack patches: the user's own effect chains, saved by name and recalled
 * from the menu bar. They live in the desktop config (`rackPatches`), so they
 * survive a restart and never touch the sample library; in a plain browser
 * build they fall back to localStorage.
 */
import { desktopFS, isDesktop } from './desktopBridge';
import type { RackState } from '../rack/types';

const STORE_KEY = 'rackPatches';

export interface RackPatch {
  id: string;
  name: string;
  /** Epoch ms of the last write, used to sort the most recent first. */
  savedAt: number;
  state: RackState;
}

function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `patch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isPatch(value: unknown): value is RackPatch {
  const p = value as RackPatch | null;
  return (
    !!p &&
    typeof p === 'object' &&
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    !!p.state &&
    Array.isArray(p.state.modules)
  );
}

/** Newest first, so the menu shows what the user just worked on. */
const sorted = (patches: RackPatch[]): RackPatch[] =>
  [...patches].sort((a, b) => b.savedAt - a.savedAt);

async function readAll(): Promise<RackPatch[]> {
  try {
    const raw = isDesktop()
      ? await desktopFS().getSetting(STORE_KEY)
      : JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    return Array.isArray(raw) ? sorted(raw.filter(isPatch)) : [];
  } catch (error) {
    console.error('[patches] lecture impossible', error);
    return [];
  }
}

async function writeAll(patches: RackPatch[]): Promise<void> {
  if (isDesktop()) await desktopFS().setSetting(STORE_KEY, patches);
  else localStorage.setItem(STORE_KEY, JSON.stringify(patches));
}

export const listRackPatches = (): Promise<RackPatch[]> => readAll();

/** Trims and falls back to a dated name, so a patch is never nameless. */
export function cleanPatchName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 60);
  return clean || `Patch ${new Date().toLocaleString('fr-FR')}`;
}

/**
 * Save under `name`. Saving over an existing name replaces that patch rather
 * than piling up duplicates — the same name is the same patch.
 */
export async function saveRackPatch(name: string, state: RackState): Promise<RackPatch[]> {
  const clean = cleanPatchName(name);
  const patches = await readAll();
  const existing = patches.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  const patch: RackPatch = {
    id: existing?.id ?? newId(),
    name: clean,
    savedAt: Date.now(),
    state: JSON.parse(JSON.stringify(state)) as RackState,
  };
  const next = sorted([...patches.filter((p) => p.id !== patch.id), patch]);
  await writeAll(next);
  return next;
}

export async function renameRackPatch(id: string, name: string): Promise<RackPatch[]> {
  const clean = cleanPatchName(name);
  const next = sorted(
    (await readAll()).map((p) => (p.id === id ? { ...p, name: clean, savedAt: Date.now() } : p))
  );
  await writeAll(next);
  return next;
}

export async function deleteRackPatch(id: string): Promise<RackPatch[]> {
  const next = (await readAll()).filter((p) => p.id !== id);
  await writeAll(next);
  return next;
}
