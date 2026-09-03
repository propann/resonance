/**
 * The user's named rack patches, kept in sync with what is on disk so the menu
 * bar and the patch window always show the same list.
 */
import { create } from 'zustand';
import { toast } from './toastStore';
import {
  deleteRackPatch,
  listRackPatches,
  renameRackPatch,
  saveRackPatch,
  type RackPatch,
} from '../services/rackPatches';

interface PatchStore {
  patches: RackPatch[];
  loaded: boolean;
  /** Read the patches from storage; call it once at startup. */
  refresh: () => Promise<void>;
  /** Save the rack as it stands right now under `name`. */
  saveCurrent: (name: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Load a patch into the rack. Resolves false if it has gone missing. */
  apply: (id: string) => Promise<boolean>;
}

export const usePatchStore = create<PatchStore>((set, get) => ({
  patches: [],
  loaded: false,

  refresh: async () => {
    set({ patches: await listRackPatches(), loaded: true });
  },

  saveCurrent: async (name) => {
    // Imported on use: the rack kernel is a lazy chunk, and the menu bar reads
    // this store at startup — pulling it in eagerly would drag the whole rack
    // into the startup bundle.
    const { useRackStore } = await import('./rackStore');
    const { rack } = useRackStore.getState();
    if (rack.modules.length === 0) {
      toast.info('Le rack est vide : ajoutez au moins un module avant d’enregistrer.');
      return;
    }
    const patches = await saveRackPatch(name, rack);
    set({ patches, loaded: true });
    toast.success(`Patch « ${patches[0].name} » enregistré (${rack.modules.length} module(s)).`);
  },

  rename: async (id, name) => {
    set({ patches: await renameRackPatch(id, name), loaded: true });
  },

  remove: async (id) => {
    const removed = get().patches.find((p) => p.id === id);
    set({ patches: await deleteRackPatch(id), loaded: true });
    if (removed) toast.info(`Patch « ${removed.name} » supprimé.`);
  },

  apply: async (id) => {
    const patch = get().patches.find((p) => p.id === id);
    if (!patch) return false;
    const { useRackStore } = await import('./rackStore');
    useRackStore.getState().loadState(patch.state);
    toast.success(`Patch « ${patch.name} » chargé dans le rack.`);
    return true;
  },
}));
