import { create } from 'zustand';
import type { SampleItem } from '../types/sample';
import { useUiStore } from './uiStore';
import { useLibraryStore } from './libraryStore';
import { toast } from './toastStore';

/**
 * Which sample a sample-scoped modal should act on. These modals can be opened
 * from a table row, the waveform toolbar, a menu, or a keyboard shortcut, so the
 * "which sample" answer lives in a store rather than being drilled from App.
 */
export type SampleTargetKind = 'dsp' | 'loudness' | 'slicer';

interface SampleTargetStore {
  dsp: SampleItem | null;
  loudness: SampleItem | null;
  slicer: SampleItem | null;
  setTarget: (kind: SampleTargetKind, sample: SampleItem | null) => void;
}

export const useSampleTargetStore = create<SampleTargetStore>((set) => ({
  dsp: null,
  loudness: null,
  slicer: null,
  setTarget: (kind, sample) => set({ [kind]: sample } as Pick<SampleTargetStore, SampleTargetKind>),
}));

// The effects rack no longer has a modal: it lives in the workshop column,
// always mounted, working on whatever sample is selected.
const MODAL_FOR = {
  dsp: 'dspModal',
  loudness: 'loudnessModal',
} as const;

/**
 * Guarded opener for a sample-scoped modal, callable from anywhere.
 * Falls back to the library's selected sample; toasts when there is none.
 * Stores the target sample and opens the matching modal (the slicer has no
 * modal flag — its open state is simply `slicer !== null`).
 */
export function openSampleModal(kind: SampleTargetKind, sample?: SampleItem | null): void {
  const lib = useLibraryStore.getState();
  const resolved = sample ?? lib.samples.find((s) => s.id === lib.selectedSampleId) ?? null;
  if (!resolved) {
    toast.info("Sélectionne d'abord un sample.");
    return;
  }
  useSampleTargetStore.getState().setTarget(kind, resolved);
  if (kind !== 'slicer') useUiStore.getState().openModal(MODAL_FOR[kind]);
}
