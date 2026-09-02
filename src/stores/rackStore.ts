import { create } from 'zustand';
import { defaultParams } from '../rack/params';
import { getModuleDef } from '../rack/registry';
import { registerBuiltinModules } from '../rack/modules';
import { emptyRackState, type ParamValue, type RackState } from '../rack/types';

registerBuiltinModules();

function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface RackStore {
  rack: RackState;
  addModule: (type: string) => void;
  removeModule: (id: string) => void;
  toggleModule: (id: string) => void;
  moveModule: (id: string, direction: -1 | 1) => void;
  setParams: (id: string, partial: Record<string, ParamValue>) => void;
  loadState: (state: RackState) => void;
  reset: () => void;
  exportJson: () => string;
  importJson: (json: string) => boolean;
}

function isRackState(value: unknown): value is RackState {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as RackState).version === 1 &&
    Array.isArray((value as RackState).modules)
  );
}

export const useRackStore = create<RackStore>((set, get) => ({
  rack: emptyRackState(),

  addModule: (type) => {
    const def = getModuleDef(type);
    if (!def) {
      console.warn(`[rackStore] cannot add unknown module "${type}"`);
      return;
    }
    set((s) => ({
      rack: {
        ...s.rack,
        modules: [
          ...s.rack.modules,
          { id: newId(), type, enabled: true, params: defaultParams(def) },
        ],
      },
    }));
  },

  removeModule: (id) =>
    set((s) => ({ rack: { ...s.rack, modules: s.rack.modules.filter((m) => m.id !== id) } })),

  toggleModule: (id) =>
    set((s) => ({
      rack: {
        ...s.rack,
        modules: s.rack.modules.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
      },
    })),

  moveModule: (id, direction) =>
    set((s) => {
      const modules = [...s.rack.modules];
      const from = modules.findIndex((m) => m.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= modules.length) return s;
      [modules[from], modules[to]] = [modules[to], modules[from]];
      return { rack: { ...s.rack, modules } };
    }),

  setParams: (id, partial) =>
    set((s) => ({
      rack: {
        ...s.rack,
        modules: s.rack.modules.map((m) =>
          m.id === id ? { ...m, params: { ...m.params, ...partial } } : m
        ),
      },
    })),

  loadState: (state) => set({ rack: isRackState(state) ? state : emptyRackState() }),

  reset: () => set({ rack: emptyRackState() }),

  exportJson: () => JSON.stringify(get().rack),

  importJson: (json) => {
    try {
      const parsed = JSON.parse(json);
      if (!isRackState(parsed)) return false;
      set({ rack: parsed });
      return true;
    } catch {
      return false;
    }
  },
}));
