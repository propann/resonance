import { create } from 'zustand';
import { DEFAULT_FOLDERS } from '../data/defaultSampleLibrary';
import type { FilterState, FolderItem, SampleItem } from '../types/sample';

type Updater<T> = T | ((prev: T) => T);
const apply = <T>(u: Updater<T>, prev: T): T =>
  typeof u === 'function' ? (u as (p: T) => T)(prev) : u;

export const INITIAL_FILTER_STATE: FilterState = {
  searchQuery: '',
  selectedFolderId: null,
  selectedType: 'all',
  selectedCategory: 'all',
  selectedGenre: 'all',
  selectedKey: 'all',
  minBpm: 60,
  maxBpm: 180,
  minDuration: 0,
  maxDuration: 60,
  favoritesOnly: false,
  hasSlicesOnly: false,
  selectedTags: [],
  sortField: 'dateAdded',
  sortDirection: 'desc',
};

interface LibraryStore {
  samples: SampleItem[];
  folders: FolderItem[];
  selectedSampleId: string | null;
  selectedSampleIds: string[];
  filterState: FilterState;

  // useState-shaped setters so existing call sites work unchanged
  setSamples: (u: Updater<SampleItem[]>) => void;
  setFolders: (u: Updater<FolderItem[]>) => void;
  setSelectedSampleId: (u: Updater<string | null>) => void;
  setSelectedSampleIds: (u: Updater<string[]>) => void;
  setFilterState: (u: Updater<FilterState>) => void;
}

/**
 * The sample library: samples, folders, selection and the filter panel state.
 * Setters keep the React.useState shape (value or updater fn) so App's existing
 * handlers move over without changes. Derived views (filtered/sorted list,
 * selected sample) stay in the component layer.
 */
export const useLibraryStore = create<LibraryStore>((set) => ({
  samples: [],
  folders: DEFAULT_FOLDERS,
  selectedSampleId: null,
  selectedSampleIds: [],
  filterState: INITIAL_FILTER_STATE,

  setSamples: (u) => set((s) => ({ samples: apply(u, s.samples) })),
  setFolders: (u) => set((s) => ({ folders: apply(u, s.folders) })),
  setSelectedSampleId: (u) => set((s) => ({ selectedSampleId: apply(u, s.selectedSampleId) })),
  setSelectedSampleIds: (u) => set((s) => ({ selectedSampleIds: apply(u, s.selectedSampleIds) })),
  setFilterState: (u) => set((s) => ({ filterState: apply(u, s.filterState) })),
}));
