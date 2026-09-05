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
  | 'synthRack'
  | 'shortcuts'
  | 'doc'
  | 'patches'
  | 'dedupe'
  | 'loudnessModal';

/**
 * What the middle of the window is showing.
 *
 * `edit` is where a sound is worked on, and picking one from the list goes
 * straight there — that is what you wanted it for. Everything stays on this
 * one page; nothing here opens a second.
 */
export type WorkspaceView = 'library' | 'edit' | 'timbre';

const ALL_CLOSED: Record<ModalKey, boolean> = {
  batchConverter: false,
  recorder: false,
  smartIngest: false,
  autoCurator: false,
  benchmark: false,
  op1Studio: false,
  batchNaming: false,
  dspModal: false,
  synthRack: false,
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
