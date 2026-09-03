/**
 * Shared audition transport. One concept everywhere: the space bar plays or
 * stops the sound of the page you are on. Any view or modal that can audition
 * something registers its own toggle here while it is open; the space bar
 * shortcut routes to the top-most registration, and falls back to the library
 * selection when nothing is registered.
 *
 * Registering (rather than each page adding its own key listener) keeps a
 * single Space handler in the app, so one press can never start two sounds.
 */
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

export interface AuditionSource {
  /** Stable identity of the registration, used to remove it. */
  id: number;
  /** Where the sound comes from, e.g. "Rack modulaire". Shown in the hints. */
  label: string;
  /** Start the sound if it is idle, stop it if it is playing. */
  toggle: () => void;
}

interface TransportState {
  /** Registration stack: the last one on top is what Space drives. */
  sources: AuditionSource[];
  pushSource: (source: AuditionSource) => void;
  removeSource: (id: number) => void;
}

export const useTransportStore = create<TransportState>((set) => ({
  sources: [],
  pushSource: (source) => set((s) => ({ sources: [...s.sources, source] })),
  removeSource: (id) => set((s) => ({ sources: s.sources.filter((x) => x.id !== id) })),
}));

/** The audition Space should drive right now, or null for the library selection. */
export const activeAudition = (): AuditionSource | null => {
  const { sources } = useTransportStore.getState();
  return sources.length > 0 ? sources[sources.length - 1] : null;
};

/** Label of the sound Space would play, for the transport hints. */
export const useAuditionLabel = (): string | null =>
  useTransportStore((s) => (s.sources.length > 0 ? s.sources[s.sources.length - 1].label : null));

let nextId = 1;

/**
 * Register this page's audition while `active`. `toggle` is read through a ref,
 * so it can close over fresh state without re-registering on every render.
 */
export function useAudition(label: string, toggle: () => void, active: boolean = true): void {
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;

  useEffect(() => {
    if (!active) return;
    const id = nextId++;
    useTransportStore.getState().pushSource({ id, label, toggle: () => toggleRef.current() });
    return () => useTransportStore.getState().removeSource(id);
  }, [active, label]);
}
