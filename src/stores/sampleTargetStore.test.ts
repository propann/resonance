import { beforeEach, describe, expect, it } from 'vitest';
import type { SampleItem } from '../types/sample';
import { useSampleTargetStore, openSampleModal } from './sampleTargetStore';
import { useUiStore } from './uiStore';
import { useLibraryStore } from './libraryStore';
import { useToastStore } from './toastStore';

const mkSample = (id: string): SampleItem => ({ id, name: id } as unknown as SampleItem);

beforeEach(() => {
  useSampleTargetStore.setState({ dsp: null, loudness: null, slicer: null });
  useUiStore.setState({ modals: { ...useUiStore.getState().modals, dspModal: false, loudnessModal: false } });
  useLibraryStore.setState({ samples: [], selectedSampleId: null });
  useToastStore.setState({ toasts: [] });
});

describe('openSampleModal', () => {
  it('stores an explicit sample and opens the matching modal', () => {
    const s = mkSample('kick-01');
    openSampleModal('dsp', s);
    expect(useSampleTargetStore.getState().dsp).toBe(s);
    expect(useUiStore.getState().modals.dspModal).toBe(true);
  });

  it('maps each kind to its modal (slicer has none)', () => {
    openSampleModal('dsp', mkSample('a'));
    openSampleModal('loudness', mkSample('b'));
    openSampleModal('slicer', mkSample('c'));
    const ui = useUiStore.getState().modals;
    expect(ui.dspModal).toBe(true);
    expect(ui.loudnessModal).toBe(true);
    expect(useSampleTargetStore.getState().slicer?.id).toBe('c');
    // slicer opens no modal flag
    expect(Object.entries(ui).filter(([, v]) => v).map(([k]) => k).sort()).toEqual(['dspModal', 'loudnessModal']);
  });

  it('falls back to the library-selected sample when none is passed', () => {
    const sel = mkSample('selected');
    useLibraryStore.setState({ samples: [sel, mkSample('other')], selectedSampleId: 'selected' });
    openSampleModal('dsp');
    expect(useSampleTargetStore.getState().dsp).toBe(sel);
    expect(useUiStore.getState().modals.dspModal).toBe(true);
  });

  it('toasts and opens nothing when there is no sample at all', () => {
    openSampleModal('dsp');
    expect(useSampleTargetStore.getState().dsp).toBeNull();
    expect(useUiStore.getState().modals.dspModal).toBe(false);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].kind).toBe('info');
  });

  it('setTarget(kind, null) clears just that slot', () => {
    openSampleModal('dsp', mkSample('x'));
    openSampleModal('loudness', mkSample('y'));
    useSampleTargetStore.getState().setTarget('dsp', null);
    expect(useSampleTargetStore.getState().dsp).toBeNull();
    expect(useSampleTargetStore.getState().loudness?.id).toBe('y');
  });

  // The effects rack lost its modal: it is a column now, always mounted on the
  // library's selected sample, so nothing has to be "opened" for it.
  it('no longer knows a rack target', () => {
    expect('rack' in useSampleTargetStore.getState()).toBe(false);
  });
});
