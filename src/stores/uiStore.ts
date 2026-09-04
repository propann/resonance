import { create } from 'zustand';

/** Every top-level modal window App can show, keyed by a short name. */
export type ModalKey =
  | 'batchConverter'
  | 'recorder'
  | 'smartIngest'
  | 'autoCurator'
  | 'benchmark'
  | 'op1Studio'
  | 'batchNaming'
  | 'dspModal'
  | 'rackHost'
  | 'synthRack'
  | 'advancedRack'
  | 'shortcuts'
  | 'doc'
  | 'patches'
  | 'dedupe'
  | 'loudnessModal';

export type WorkspaceView = 'library' | 'timbre';

const ALL_CLOSED: Record<ModalKey, boolean> = {
  batchConverter: false,
  recorder: false,
  smartIngest: false,
  autoCurator: false,
  benchmark: false,
  op1Studio: false,
  batchNaming: false,
  dspModal: false,
  rackHost: false,
  synthRack: false,
  advancedRack: false,
  shortcuts: false,
  doc: false,
  patches: false,
  dedupe: false,
  loudnessModal: false,
};

interface UiStore {
  modals: Record<ModalKey, boolean>;
  activeView: WorkspaceView;
  openModal: (key: ModalKey) => void;
  closeModal: (key: ModalKey) => void;
  setActiveView: (view: WorkspaceView) => void;
  toggleView: () => void;
}

/**
 * Pure UI shell state: which modal windows are open and which workspace view
 * is active. Sample selection, library data and the work folder live elsewhere.
 */
export const useUiStore = create<UiStore>((set) => ({
  modals: { ...ALL_CLOSED },
  activeView: 'library',
  openModal: (key) => set((state) => ({ modals: { ...state.modals, [key]: true } })),
  closeModal: (key) => set((state) => ({ modals: { ...state.modals, [key]: false } })),
  setActiveView: (view) => set({ activeView: view }),
  toggleView: () =>
    set((state) => ({ activeView: state.activeView === 'library' ? 'timbre' : 'library' })),
}));
