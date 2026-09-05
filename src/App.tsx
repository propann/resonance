import React, { lazy, Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from './stores/toastStore';
import { Toaster } from './components/Toaster';
import { useResizablePanels } from './hooks/useResizablePanels';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWorkFolder } from './hooks/useWorkFolder';
import { useUiStore } from './stores/uiStore';
import { useLibraryStore } from './stores/libraryStore';
import { useSampleTargetStore, openSampleModal } from './stores/sampleTargetStore';
import { activeAudition } from './stores/transportStore';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { sampleMatchesQuery } from './services/sampleSearchIndex';
import { sortLibrary } from './services/librarySorter';
import { getCachedBlobUrl, getCachedBuffer } from './services/audioBufferCache';
import {
  cacheSampleAudio,
  loadSampleAudio,
  peekSampleAudio,
  releaseSampleAudio,
} from './services/sampleAudio';
import { hydrateNewManifestSamples } from './services/manifestHydration';
import { folderMatcher } from './services/libraryFolders';
import { usePatchStore } from './stores/patchStore';
import { SampleItem, NewSample, FolderItem, SliceRegion } from './types/sample';
import { AppMenuBar } from './components/AppMenuBar';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SampleTable } from './components/SampleTable';
import { WaveformCanvas } from './components/WaveformCanvas';
import { AtelierColumn } from './components/AtelierColumn';
import { TimbreMap } from './components/TimbreMap';
import { Op1PatchEditor } from './components/Op1PatchEditor';
import { AudioRecorderModal } from './components/AudioRecorderModal';
import { AutoCuratorModal } from './components/AutoCuratorModal';
const AudioAnalysisModal = lazy(() => import('./components/AudioAnalysisModal').then((m) => ({ default: m.AudioAnalysisModal })));
const AutoSlicerModal = lazy(() => import('./components/AutoSlicerModal').then((m) => ({ default: m.AutoSlicerModal })));
const BatchConverterModal = lazy(() => import('./components/BatchConverterModal').then((m) => ({ default: m.BatchConverterModal })));
const BatchNamingModal = lazy(() => import('./components/BatchNamingModal').then((m) => ({ default: m.BatchNamingModal })));
const DocumentationModal = lazy(() => import('./components/DocumentationModal').then((m) => ({ default: m.DocumentationModal })));
const KeyboardShortcutsModal = lazy(() => import('./components/KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal })));
const LoudnessStandardModal = lazy(() => import('./components/LoudnessStandardModal').then((m) => ({ default: m.LoudnessStandardModal })));
const MarketBenchmarkModal = lazy(() => import('./components/MarketBenchmarkModal').then((m) => ({ default: m.MarketBenchmarkModal })));
const Op1KitBuilderModal = lazy(() => import('./components/Op1KitBuilderModal').then((m) => ({ default: m.Op1KitBuilderModal })));
const SmartIngestionModal = lazy(() => import('./components/SmartIngestionModal').then((m) => ({ default: m.SmartIngestionModal })));
const LibraryDedupeModal = lazy(() => import('./components/LibraryDedupeModal').then((m) => ({ default: m.LibraryDedupeModal })));
const PatchesModal = lazy(() => import('./components/PatchesModal').then((m) => ({ default: m.PatchesModal })));

/**
 * Mounts a lazily-loaded modal only while it is open, so its chunk is fetched
 * on first use instead of at startup. Modals that must keep working while
 * closed (the auto-curator's background transfer, the recorder's mic
 * teardown) stay eagerly imported.
 */
const LazyModal: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) =>
  open ? <Suspense fallback={null}>{children}</Suspense> : null;
import { LoudnessAuditReport, LoudnessStandardKey } from './services/audioLoudnessStandard';
import { audioEngine } from './services/audioEngine';
import {
  calculateAudioMetrics,
  classifySample,
  detectPitchAndKey,
} from './services/audioAnalyzer';
import {
  audioBufferToWavBlob,
  triggerFileDownload,
  exportEp133ProjectPack,
  exportMultipleWavsAsZip,
} from './services/audioConverter';
import { parseOp1AiffPatch } from './services/op1PatchEncoder';
import { readOp1PatchInfo, op1FolderPathFor } from './services/op1PatchFile';
import {
  autoOrganizeLibrary,
  classifySampleForLibrary,
} from './services/proFolderOrganizer';
import {
  getDirectoryForPath,
  writeUniqueFile,
  writeLibraryManifest,
  getLastSampleId,
  setLastSampleId,
  type WorkFolderAudioFile,
} from './services/localLibrary';

export default function App() {
  const samples = useLibraryStore((s) => s.samples);
  const setSamples = useLibraryStore((s) => s.setSamples);
  const folders = useLibraryStore((s) => s.folders);
  const setFolders = useLibraryStore((s) => s.setFolders);
  const selectedSampleId = useLibraryStore((s) => s.selectedSampleId);
  const setSelectedSampleId = useLibraryStore((s) => s.setSelectedSampleId);
  const selectedSampleIds = useLibraryStore((s) => s.selectedSampleIds);
  const setSelectedSampleIds = useLibraryStore((s) => s.setSelectedSampleIds);

  // Dynamic Resizable Windows & Panels
  const {
    sidebarWidth,
    waveformHeight,
    atelierWidth,
    isResizingSidebar,
    isResizingWaveform,
    isResizingAtelier,
    startSidebarResize,
    startWaveformResize,
    startAtelierResize,
  } = useResizablePanels();

  // UI shell state (modal windows, workspace view)
  const modals = useUiStore((s) => s.modals);
  const activeView = useUiStore((s) => s.activeView);
  const openModal = useUiStore((s) => s.openModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const toggleView = useUiStore((s) => s.toggleView);

  // Which sample the sample-scoped modals act on (rack / dsp / loudness / slicer).
  const slicerSample = useSampleTargetStore((s) => s.slicer);
  const sampleForDsp = useSampleTargetStore((s) => s.dsp);
  const sampleForLoudness = useSampleTargetStore((s) => s.loudness);
  const setSampleTarget = useSampleTargetStore((s) => s.setTarget);

  const [pendingCurationFiles, setPendingCurationFiles] = useState<Array<File | WorkFolderAudioFile>>([]);
  const [pendingFilesAlreadyArchived, setPendingFilesAlreadyArchived] = useState(false);
  const [isCuratorProcessing, setIsCuratorProcessing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  /**
   * Bumped when a sample's audio finishes loading. It is the whole reason the
   * interface notices: the buffer itself lives in the cache, not in `samples`,
   * so nothing else would tell React that a wave is ready to draw.
   */
  const [loadedAudioVersion, setLoadedAudioVersion] = useState(0);
  const [autoLoudnessLeveling, setAutoLoudnessLeveling] = useState<boolean>(
    audioEngine.isAutoLoudnessEnabled()
  );

  /**
   * Fold a freshly read manifest into the library.
   *
   * The manifest holds the whole library and is re-read on every refresh —
   * every few seconds while an import runs. Building an item for all 282 000
   * lines and then keeping the 64 new ones blocked the main thread for 4.4
   * seconds at a stretch, measured, with nothing being clicked. Only the new
   * lines are built now, and an unchanged manifest returns the array
   * untouched so nothing downstream re-sorts or recounts.
   */
  const hydrateManifestSamples = (entries: Array<Record<string, unknown>>) => {
    setSamples((previous) => {
      const knownIds = new Set(previous.map((sample) => sample.id));
      const fresh = hydrateNewManifestSamples(entries, knownIds);
      return fresh.length === 0 ? previous : previous.concat(fresh);
    });
  };

  const {
    libraryRoot,
    libraryName,
    workFolderStatus,
    diskSampleCount,
    diskFolderCounts,
    incomingCount,
    incomingIsPartial,
    failedIncomingCount,
    failedIncomingReason,
    setFailedIncomingReason,
    setFailedIncomingCount,
    adoptExternalRoot,
    chooseLibrary,
    reactivateWorkFolder,
    refreshLibrary,
    cleanEmptyFolders,
    processReception,
  } = useWorkFolder({
    isCuratorOpen: modals.autoCurator,
    isCuratorProcessing,
    onManifestSamples: hydrateManifestSamples,
    onReceptionFilesReady: (files, openCurator) => {
      setPendingFilesAlreadyArchived(true);
      setPendingCurationFiles(files);
      if (openCurator) openModal('autoCurator');
    },
  });

  // Hidden File Inputs for Menu Bar actions
  const menuFileInputRef = useRef<HTMLInputElement>(null);
  const menuFolderInputRef = useRef<HTMLInputElement>(null);
  const menuOp1InputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedSampleId || !libraryRoot) return;
    // Read `samples` fresh from the store so this effect fires only on a
    // selection or work-folder change, not on every library mutation.
    const selected = useLibraryStore
      .getState()
      .samples.find((sample) => sample.id === selectedSampleId);
    // Going back to a sample used to read its file over IPC and decode it
    // again, every time. The cache makes a return trip free, which is what
    // moving through a folder mostly consists of.
    if (!selected || peekSampleAudio(selected)) return;
    let cancelled = false;
    void loadSampleAudio(selected).then((buffer) => {
      if (cancelled || !buffer) return;
      // Deliberately NOT written into `samples`.
      //
      // Doing so replaced the array, which invalidated the filtered-and-
      // sorted memo, which re-sorted 283 000 items — 113 ms by date, 374 ms
      // by name — on every single selection. That is what made the playhead
      // jump: it is painted from requestAnimationFrame, and a main thread
      // busy for a third of a second skips it forward instead of advancing
      // it. The buffer reaches the interface through `withLoadedAudio`
      // below, on the one sample that needs it.
      setLoadedAudioVersion((version) => version + 1);
    });
    return () => { cancelled = true; };
  }, [selectedSampleId, libraryRoot]);

  // Filters State
  const filterState = useLibraryStore((s) => s.filterState);
  const setFilterState = useLibraryStore((s) => s.setFilterState);

  // The library intentionally starts empty: users import their own source material.

  // Filtered and Sorted Samples list
  // The typed query drives the input; the filter waits for it to settle.
  const searchQuery = useDebouncedValue(filterState.searchQuery, 200);

  const filteredSamples = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    // Same test the sidebar counts with: a parent folder shows what is filed
    // below it, so picking 01_DRUMS lists the kicks, snares and hats.
    const inSelectedFolder = folderMatcher(filterState.selectedFolderId, folders);
    return samples
      .filter((s) => {
        // Search query, against a per-sample text built once
        if (query && !sampleMatchesQuery(s, query)) return false;

        // Folder
        if (!inSelectedFolder(s)) return false;

        // Category (One-Shot vs Loop vs Multi-Sound)
        if (filterState.selectedCategory && filterState.selectedCategory !== 'all') {
          if (filterState.selectedCategory === 'one-shot') {
            if (s.isLoop || s.category === 'loop' || s.type === 'loop') return false;
          } else if (filterState.selectedCategory === 'loop') {
            if (!s.isLoop && s.category !== 'loop' && s.type !== 'loop') return false;
          } else if (filterState.selectedCategory === 'multi-sound') {
            if (!s.isMultiSound && s.type !== 'multi-sound') return false;
          }
        }

        // Genre filter
        if (filterState.selectedGenre && filterState.selectedGenre !== 'all') {
          if (s.genre !== filterState.selectedGenre) {
            return false;
          }
        }

        // Type
        if (filterState.selectedType !== 'all') {
          if (filterState.selectedType === 'multi-sound') {
            if (!s.isMultiSound && s.type !== 'multi-sound') return false;
          } else if (filterState.selectedType === 'snare') {
            if (s.type !== 'snare' && s.type !== 'clap') return false;
          } else if (filterState.selectedType === 'hihat') {
            if (s.type !== 'hihat' && s.type !== 'cymbal') return false;
          } else if (filterState.selectedType === 'loop') {
            if (!s.isLoop && s.type !== 'loop' && s.category !== 'loop') return false;
          } else if (s.type !== filterState.selectedType) {
            return false;
          }
        }

        // Key
        if (filterState.selectedKey !== 'all' && s.key !== filterState.selectedKey) {
          return false;
        }

        // BPM range (if sample has bpm)
        if (s.bpm && (s.bpm < filterState.minBpm || s.bpm > filterState.maxBpm)) {
          return false;
        }

        // Favorites
        if (filterState.favoritesOnly && !s.favorite) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dir = filterState.sortDirection === 'asc' ? 1 : -1;
        switch (filterState.sortField) {
          case 'name':
            return a.name.localeCompare(b.name) * dir;
          case 'bpm':
            return ((a.bpm || 0) - (b.bpm || 0)) * dir;
          case 'key':
            return ((a.key || '').localeCompare(b.key || '')) * dir;
          case 'duration':
            return (a.duration - b.duration) * dir;
          case 'size':
            return (a.size - b.size) * dir;
          case 'rating':
            return (a.rating - b.rating) * dir;
          case 'type':
            return a.type.localeCompare(b.type) * dir;
          case 'dateAdded':
          default:
            return (a.dateAdded - b.dateAdded) * dir;
        }
      });
  }, [samples, folders, filterState, searchQuery]);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Subscribe to audio engine playback state changes
  useEffect(() => {
    const unsub = audioEngine.subscribe((state) => {
      setIsPlaying(state.isPlaying);
    });
    return () => unsub();
  }, []);

  /**
   * Hand a sample its decoded audio, from the cache rather than from the list.
   *
   * The buffer is kept outside `samples` on purpose — writing it in replaced
   * the array and re-sorted 283 000 items on every selection. Merging it here
   * costs one object, and only the samples actually being looked at get it.
   */
  const withLoadedAudio = useCallback(
    (sample: SampleItem | null): SampleItem | null => {
      if (!sample?.diskPath) return sample;
      const buffer = getCachedBuffer(sample.diskPath);
      if (!buffer) return sample;
      const blob = getCachedBlobUrl(sample.diskPath);
      // Not the buffer itself — that is the cache's job now, and a sample that
      // carried one was how the play button and the exports came to fail
      // silently. What the manifest could not know: the file's real size, and
      // the shape the decoder actually found.
      return {
        ...sample,
        blobUrl: blob?.url || sample.blobUrl,
        size: blob?.size ?? sample.size,
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
      };
    },
    // Recomputed when a load lands, which is what makes the buffer appear.
    [loadedAudioVersion]
  );

  const selectedSample = useMemo(
    () =>
      withLoadedAudio(samples.find((s) => s.id === selectedSampleId) || filteredSamples[0] || null),
    [samples, selectedSampleId, filteredSamples, withLoadedAudio]
  );

  /**
   * Play a sample, reading its file first if the cache has not got it.
   *
   * The transport used to check `sample.audioBuffer` and do nothing when it was
   * missing — which, for anything from the manifest, was always.
   */
  /**
   * How tall the middle of the window is, so the wave can fill it while a
   * sound is being edited. Measured rather than assumed: the window is
   * resizable and the panels around it are draggable.
   */
  const centerPaneRef = useRef<HTMLElement>(null);
  const [centerPaneHeight, setCenterPaneHeight] = useState(0);
  useEffect(() => {
    const pane = centerPaneRef.current;
    if (!pane) return;
    const observer = new ResizeObserver(([entry]) =>
      setCenterPaneHeight(entry.contentRect.height)
    );
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  /**
   * Picking a sound is asking to work on it, so the middle of the window
   * becomes the editor. Nothing new opens: it is the same page showing the
   * other thing, and the LISTE tab goes back.
   */
  const openSampleForEditing = useCallback(
    (sample: SampleItem) => {
      setSelectedSampleId(sample.id);
      setActiveView('edit');
    },
    [setSelectedSampleId, setActiveView]
  );

  const playSample = useCallback(async (sample: SampleItem) => {
    const buffer = await loadSampleAudio(sample);
    if (buffer) audioEngine.play(buffer, sample.id, sample.loudnessGainDb);
  }, []);

  // A sample-scoped modal stores a snapshot of its target sample; re-resolve it
  // against the live library so a later disk-decode (audioBuffer) reaches the modal.
  const liveSample = useCallback(
    (snap: SampleItem | null): SampleItem | null =>
      snap ? withLoadedAudio(samples.find((s) => s.id === snap.id) ?? snap) : null,
    [samples, withLoadedAudio]
  );

  /**
   * The ticked samples, for calibrating a whole selection at once. Only
   * gathered while that modal is open: it is a pass over the whole library.
   */
  const selectedSamplesForLoudness = useMemo(() => {
    if (!modals.loudnessModal || selectedSampleIds.length === 0) return undefined;
    const wanted = new Set(selectedSampleIds);
    return samples.filter((s) => wanted.has(s.id)).map((s) => withLoadedAudio(s)!);
  }, [modals.loudnessModal, selectedSampleIds, samples, withLoadedAudio]);

  /**
   * Read the audio for whichever sample a sample-scoped modal is pointed at.
   *
   * These modals can be opened from a table row that is not the selected one —
   * the DSP and calibration buttons do exactly that — and their target would
   * then arrive with no sound at all, the manifest holding none.
   */
  useEffect(() => {
    for (const target of [sampleForDsp, sampleForLoudness, slicerSample]) {
      if (!target || peekSampleAudio(target)) continue;
      void loadSampleAudio(target).then((buffer) => {
        if (buffer) setLoadedAudioVersion((version) => version + 1);
      });
    }
  }, [sampleForDsp, sampleForLoudness, slicerSample]);

  // Restore the last-worked sample once the library is populated, and persist
  // the current selection so a fresh launch lands on it.
  const restoredSampleRef = useRef(false);
  useEffect(() => {
    if (restoredSampleRef.current || samples.length === 0 || selectedSampleId) return;
    restoredSampleRef.current = true;
    void getLastSampleId().then((id) => {
      if (id && samples.some((s) => s.id === id)) setSelectedSampleId(id);
    });
  }, [samples, selectedSampleId, setSelectedSampleId]);
  useEffect(() => {
    if (!selectedSampleId) return;
    const t = setTimeout(() => setLastSampleId(selectedSampleId), 600);
    return () => clearTimeout(t);
  }, [selectedSampleId]);

  // The saved rack patches feed the PATCHS menu.
  const refreshPatches = usePatchStore((s) => s.refresh);
  const applyPatch = usePatchStore((s) => s.apply);
  useEffect(() => {
    void refreshPatches();
  }, [refreshPatches]);

  // A loaded patch lands straight in the workshop column's chain: there is no
  // window left to open.
  const handleLoadPatch = useCallback(
    (patchId: string) => void applyPatch(patchId),
    [applyPatch]
  );

  // Master Playback Transport Handlers (Available globally across all screens)
  const handleTogglePlayPause = useCallback(() => {
    // The page you are on owns the space bar: the waveform's zone, a modal's
    // audition… Only with nothing registered does it fall back to the library
    // selection, so one press never starts two sounds.
    const audition = activeAudition();
    if (audition) {
      audition.toggle();
      return;
    }
    const st = audioEngine.getState();
    if (st.isPlaying) {
      audioEngine.pause();
    } else if (selectedSample) {
      void playSample(selectedSample);
    } else if (filteredSamples.length > 0) {
      const first = filteredSamples[0];
      setSelectedSampleId(first.id);
      void playSample(first);
    }
  }, [selectedSample, filteredSamples, playSample]);

  const handlePlayNext = useCallback(() => {
    if (filteredSamples.length === 0) return;
    const idx = filteredSamples.findIndex((s) => s.id === selectedSampleId);
    const nextSample = filteredSamples[(idx + 1) % filteredSamples.length];
    setSelectedSampleId(nextSample.id);
    void playSample(nextSample);
  }, [filteredSamples, selectedSampleId, playSample]);

  const handlePlayPrev = useCallback(() => {
    if (filteredSamples.length === 0) return;
    const idx = filteredSamples.findIndex((s) => s.id === selectedSampleId);
    const prevSample =
      filteredSamples[(idx - 1 + filteredSamples.length) % filteredSamples.length];
    setSelectedSampleId(prevSample.id);
    void playSample(prevSample);
  }, [filteredSamples, selectedSampleId, playSample]);

  const handleToggleAutoLoudness = () => {
    const newVal = !autoLoudnessLeveling;
    setAutoLoudnessLeveling(newVal);
    audioEngine.setAutoLoudness(newVal);
  };

  // Escape closes whichever modal is open.
  const closeTopModal = useCallback(() => {
    if (slicerSample) {
      setSampleTarget('slicer', null);
      return;
    }
    const openKey = (Object.keys(modals) as Array<keyof typeof modals>).find((k) => modals[k]);
    if (openKey) closeModal(openKey);
  }, [slicerSample, modals, closeModal]);

  // Global transport & workspace keyboard shortcuts
  useKeyboardShortcuts({
    onCloseTopModal: closeTopModal,
    onTogglePlayPause: handleTogglePlayPause,
    onPlayNext: handlePlayNext,
    onPlayPrev: handlePlayPrev,
    onToggleLoop: () => audioEngine.toggleLoop(),
    onOpenBatchNaming: () => openModal('batchNaming'),
    onReactivateWorkFolder: () => void reactivateWorkFolder(),
    onOpenDocumentation: () => openModal('doc'),
    onToggleView: toggleView,
    onOpenDspForSelected: () => handleOpenDspAnalyzer(),
  });

  // All normal imports enter the curator so originals can be archived and
  // processing/classification uses one single pipeline.
  const handleImportFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setPendingCurationFiles(files);
    openModal('autoCurator');
  };

  // Import OP-1 Drum Kit AIFF Patch
  const handleImportOp1Patch = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseOp1AiffPatch(buffer);
      const audioBuf = parsed.audioBuffer || (await audioEngine.decodeAudioData(buffer));

      const slices: SliceRegion[] = parsed.slices.map((sl, idx) => ({
        id: sl.id || `slice-${idx}`,
        index: idx + 1,
        startSec: sl.startSec,
        endSec: sl.endSec,
        label: sl.name || `Pad ${idx + 1}`,
        color: sl.color || '#00F0FF',
      }));

      const op1Metrics = calculateAudioMetrics(audioBuf);

      const newSample: NewSample = {
        id: `op1-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        originalFileName: file.name,
        format: 'aiff',
        size: file.size,
        duration: audioBuf.duration,
        sampleRate: audioBuf.sampleRate,
        bitDepth: 16,
        channels: audioBuf.numberOfChannels,
        type: 'multi-sound',
        category: 'multi-sound',
        genre: 'Synthwave / Retro',
        isLoop: false,
        tags: ['op-1', 'drumkit', 'multi-stem', 'slices'],
        folderId: 'f-root-multisound',
        folderPath: '/03_MULTI_SOUND_KITS',
        favorite: true,
        rating: 5,
        spectralCentroid: op1Metrics.spectralCentroid,
        dynamicRangeDb: op1Metrics.dynamicRangeDb,
        peakDb: op1Metrics.peakDb,
        rmsDb: op1Metrics.rmsDb,
        zeroCrossingRate: op1Metrics.zeroCrossingRate,
        lufs: op1Metrics.lufs,
        loudnessGainDb: 0,
        slices,
        audioBuffer: audioBuf,
        blobUrl: URL.createObjectURL(file),
        dateAdded: Date.now(),
        isMultiSound: true,
      };

      setSamples((prev) => [...adoptNewSamples([newSample]), ...prev]);
      setSelectedSampleId(newSample.id);
      audioEngine.play(audioBuf, newSample.id, 0);
    } catch (err) {
      console.error('Erreur importation patch OP-1:', err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    toast.info("Déposez les sons directement dans le dossier de travail : l'application les détecte et les trie automatiquement.");
  };

  const handleToggleFavorite = (sampleId: string) => {
    setSamples((prev) =>
      prev.map((s) => (s.id === sampleId ? { ...s, favorite: !s.favorite } : s))
    );
  };

  const handleDeleteSample = (sampleId: string) => {
    setSamples((prev) => prev.filter((s) => s.id !== sampleId));
    if (selectedSampleId === sampleId) {
      setSelectedSampleId(null);
    }
  };

  const handleDeleteSelectedSamples = () => {
    if (selectedSampleIds.length === 0) return;
    setSamples((prev) => prev.filter((s) => !selectedSampleIds.includes(s.id)));
    setSelectedSampleIds([]);
  };

  /**
   * Sorting pass on disk: every sound moves to the folder the current rules
   * place it in — the drums still loose in 01_DRUMS, and anything an earlier
   * pass filed elsewhere. Files are moved, never rewritten, so no audio is
   * re-encoded. A sound nobody can name stays exactly where it is.
   */
  const handleAutoOrganizeLibrary = async () => {
    const { organizedSamples } = autoOrganizeLibrary(samples);
    setSamples(organizedSamples);
    if (!libraryRoot) return;
    try {
      // A large library takes a couple of minutes: report each quarter rather
      // than leave the pass looking stuck.
      let nextMark = 0.25;
      const result = await sortLibrary(libraryRoot, {
        onProgress: (done, total) => {
          if (total < 5000 || done / total < nextMark) return;
          toast.info(`Rangement en cours : ${Math.round(nextMark * 100)} %…`);
          nextMark += 0.25;
        },
      });

      const { moved, renamed, skipped, failed } = result;
      if (moved === 0) {
        toast.info('Tri à jour : aucun son à déplacer.');
      } else {
        const top = Object.entries(result.perMove)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([move, count]) => `${count} vers ${move.split(' -> ')[1].split('/').pop()}`)
          .join(', ');
        toast.success(`${moved.toLocaleString('fr-FR')} son(s) rangé(s) — ${top}.`);
      }
      if (renamed > 0) {
        toast.info(`${renamed} son(s) renommé(s) : le dossier avait déjà ce nom, rien n'a été écrasé.`);
      }
      if (skipped > 0) {
        toast.info(`${skipped.toLocaleString('fr-FR')} son(s) laissé(s) en place : leur nom ne dit rien.`);
      }
      if (failed > 0) toast.error(`${failed} fichier(s) n'ont pas pu être déplacés.`);
      await refreshLibrary();
    } catch (error) {
      console.error('Rangement de la bibliothèque impossible', error);
      toast.error('Impossible de ranger la bibliothèque.');
    }
  };

  const handleApplyCuration = (curatedSamples: NewSample[]) => {
    const curated = adoptNewSamples(curatedSamples);
    setSamples((current) => {
      const curatedIds = new Set(curated.map((sample) => sample.id));
      return [...curated, ...current.filter((sample) => !curatedIds.has(sample.id))];
    });
  };

  const handleExportEp133Pack = async () => {
    if (samples.length === 0) {
      toast.info('Aucun sample dans la bibliothèque à exporter.');
      return;
    }
    try {
      const zipBlob = await exportEp133ProjectPack(samples, {
        useMono: true,
        loudnessMatch: true,
      });
      triggerFileDownload(zipBlob, `Resonance_EP133_KO_II_Pack_${Date.now().toString(36)}.zip`);
    } catch (err) {
      console.error('Erreur export EP-133:', err);
      toast.error("Une erreur est survenue lors de l'exportation du pack EP-133.");
    }
  };

  const handleExportZip = async () => {
    const targetSamples =
      selectedSampleIds.length > 0
        ? samples.filter((s) => selectedSampleIds.includes(s.id))
        : filteredSamples;

    if (targetSamples.length === 0) {
      toast.info('Aucun sample à exporter.');
      return;
    }

    try {
      const itemsToExport = targetSamples.map((s) => ({
        sample: s,
        destinationPath: `${s.category === 'loop' ? 'Loops' : `${s.type.toUpperCase()}S`}/${s.name}.wav`,
      }));
      const zipBlob = await exportMultipleWavsAsZip(itemsToExport);
      triggerFileDownload(zipBlob, `Resonance_Selection_${Date.now().toString(36)}.zip`);
    } catch (err) {
      console.error('Erreur export ZIP:', err);
      toast.error("Une erreur est survenue lors de l'exportation ZIP.");
    }
  };

  const handleUpdateSampleSlices = (sampleId: string, newSlices: SliceRegion[]) => {
    setSamples((prev) =>
      prev.map((s) =>
        s.id === sampleId
          ? {
              ...s,
              slices: newSlices,
              isMultiSound: newSlices.length > 1,
            }
          : s
      )
    );
  };

  const handleAddExtractedSamples = (
    extracted: Array<{ fileName: string; blob: Blob; audioBuffer: AudioBuffer; duration: number }>
  ) => {
    const newItems: NewSample[] = extracted.map((ex, i) => {
      const metrics = calculateAudioMetrics(ex.audioBuffer);
      const pitchKey = detectPitchAndKey(ex.audioBuffer);
      const classification = classifySample(ex.audioBuffer, ex.fileName, metrics, 0);

      return {
        id: `extracted-${Date.now().toString(36)}-${i}`,
        name: ex.fileName.replace(/\.[^/.]+$/, ''),
        originalFileName: ex.fileName,
        format: 'wav',
        size: ex.blob.size,
        duration: ex.duration,
        sampleRate: ex.audioBuffer.sampleRate,
        bitDepth: 24,
        channels: ex.audioBuffer.numberOfChannels,
        type: classification.type,
        category: 'one-shot',
        genre: 'Universal / Multi-Genre',
        isLoop: false,
        lufs: metrics.lufs,
        loudnessGainDb: 0,
        key: pitchKey?.keyString,
        tags: [...classification.tags, 'extracted-slice'],
        folderId: 'f-drums',
        folderPath: '/Extracted_Slices',
        favorite: false,
        rating: 4,
        spectralCentroid: metrics.spectralCentroid,
        dynamicRangeDb: metrics.dynamicRangeDb,
        peakDb: metrics.peakDb,
        rmsDb: metrics.rmsDb,
        zeroCrossingRate: metrics.zeroCrossingRate,
        slices: [],
        blobUrl: URL.createObjectURL(ex.blob),
        audioBuffer: ex.audioBuffer,
        dateAdded: Date.now(),
        isMultiSound: false,
      };
    });

    const adopted = adoptNewSamples(newItems);
    setSamples((prev) => [...adopted, ...prev]);
    if (adopted.length > 0) {
      setSelectedSampleId(adopted[0].id);
      audioEngine.play(newItems[0].audioBuffer!, adopted[0].id, 0);
    }
  };

  const handleApplyBatchRename = (updatedSamples: SampleItem[]) => {
    setSamples(updatedSamples);
  };

  /**
   * Take in samples that arrive with their sound — a recording, a rack render,
   * a slice just cut, an imported patch — and put that sound where everything
   * else looks for it.
   *
   * The library array never holds audio: `SampleItem` has no field for it, so
   * nothing downstream can read one and quietly find nothing.
   *
   * `onlyCopy` is for the callers holding something irreplaceable — a take that
   * has not been written anywhere yet. It is off by default: ingestion creates
   * samples with no disk path by the thousand and writes them out moments
   * later, and pinning each of those filled 6 GB in twenty minutes.
   */
  const adoptNewSamples = useCallback(
    (incoming: NewSample[], onlyCopy = false): SampleItem[] =>
      incoming.map(({ audioBuffer, ...sample }) => {
        if (audioBuffer) cacheSampleAudio(sample, audioBuffer, onlyCopy);
        return sample;
      }),
    []
  );

  const handleUpdateSampleFromDsp = (updated: NewSample) => {
    const { audioBuffer, ...sample } = updated;
    // A DC-offset fix or a levelling: the file on disk still holds the old
    // sound, so the cache must keep this one rather than re-read the original.
    if (audioBuffer) cacheSampleAudio(sample, audioBuffer, true);
    setSamples((prev) => prev.map((s) => (s.id === sample.id ? sample : s)));
  };

  // Thin wrappers over the store opener, kept for the internal callers
  // (keyboard shortcuts, LayerSynth "open effects", etc.).
  const handleOpenLoudnessStandard = (targetSample?: SampleItem) =>
    openSampleModal('loudness', targetSample);
  const handleOpenDspAnalyzer = (targetSample?: SampleItem) => openSampleModal('dsp', targetSample);
  const handleOpenSlicer = (targetSample?: SampleItem) => openSampleModal('slicer', targetSample);

  const handleApplyLoudnessNormalization = (updated: NewSample, report: LoudnessAuditReport) => {
    const { audioBuffer, ...sample } = updated;
    // The levelled audio is not what the file holds — nothing has rewritten it
    // — so the cache must not be free to drop it and hand back the original.
    if (audioBuffer) cacheSampleAudio(sample, audioBuffer, true);
    setSamples((prev) => prev.map((s) => (s.id === sample.id ? sample : s)));
    if (audioBuffer) audioEngine.play(audioBuffer, sample.id, 0);
  };

  const handleBatchApplyLoudnessNormalization = (
    updatedList: NewSample[],
    standardKey: LoudnessStandardKey
  ) => {
    const levelled = updatedList.map(({ audioBuffer, ...sample }) => {
      // As above: levelled audio no file holds, so the cache keeps it for good.
      if (audioBuffer) cacheSampleAudio(sample, audioBuffer, true);
      return sample;
    });
    setSamples((prev) => {
      const map = new Map(levelled.map((item) => [item.id, item]));
      return prev.map((s) => map.get(s.id) || s);
    });
  };

  /**
   * Write a finished OP-1 patch where the device expects it. The folder is one
   * of the ones the library creates at startup, so it is always there.
   */
  const handleSaveOp1Kit = async (name: string, aiff: Blob) => {
    if (!libraryRoot) {
      toast.info('Connecte le dossier de travail pour enregistrer le kit.');
      return;
    }
    try {
      // Ask the file what it is rather than assuming: a drum kit and a synth
      // patch look alike from outside and load into different halves of the
      // machine. `readOp1PatchInfo` reads the metadata without decoding audio.
      const info = readOp1PatchInfo(await aiff.arrayBuffer());
      const path = op1FolderPathFor(info?.kind ?? 'drum');
      const directory = await getDirectoryForPath(libraryRoot, path);
      const fileName = await writeUniqueFile(directory, `${name}.aif`, aiff);
      await writeLibraryManifest(libraryRoot, [
        {
          path,
          fileName,
          name,
          type: 'multi-sound',
          category: 'multi-sound',
          format: 'op-1-aiff',
          op1Kind: info?.kind ?? 'drum',
          op1Engine: info?.engine,
        },
      ]);
      toast.success(`Patch OP-1 écrit : ${path.replace(/^\//, '')}/${fileName}`);
    } catch (error) {
      console.error('Écriture du patch OP-1 impossible', error);
      toast.error("Le patch OP-1 n'a pas pu être écrit sur le disque.");
    }
  };

  /**
   * Write what is on the wave as an OP-1 patch, with the markers where they
   * now are. The kit builder writes one as it assembles it, but the markers
   * can be dragged afterwards; this is how that gets onto the device.
   */
  const handleSaveWaveAsOp1 = async () => {
    const target = selectedSample;
    if (!target) {
      toast.info("Choisis un sample : c'est l'onde affichée qui devient le patch.");
      return;
    }
    if (!target.slices || target.slices.length === 0) {
      toast.info('Aucune découpe sur cette onde. Découpe-la, ou pars d’un kit de moteur.');
      return;
    }
    const wave = await loadSampleAudio(target);
    if (!wave) {
      toast.error("Le son de ce sample n'a pas pu être lu depuis le dossier de travail.");
      return;
    }
    try {
      const { encodeOp1FromWave } = await import('./services/op1QuickKit');
      const { aiff, name, pads } = await encodeOp1FromWave(
        wave,
        target.slices,
        target.name
      );
      await handleSaveOp1Kit(name, aiff);
      toast.success(`${pads} pad(s) écrits dans le patch OP-1.`);
    } catch (error) {
      console.error('Patch OP-1 depuis l’onde impossible', error);
      toast.error(
        error instanceof Error ? error.message : "Le patch OP-1 n'a pas pu être écrit."
      );
    }
  };

  const handleSaveProcessedAsNew = async (incoming: NewSample) => {
    const rendered = incoming.audioBuffer;
    // Nothing has written the render yet, and the write below can fail — the
    // cache holds the only copy until it succeeds, and is released there.
    const [newSample] = adoptNewSamples([incoming], true);
    setSamples((prev) => [newSample, ...prev]);
    setSelectedSampleId(newSample.id);
    if (rendered) {
      audioEngine.play(rendered, newSample.id, newSample.loudnessGainDb);
    }
    if (!libraryRoot || !rendered) return;
    try {
      const folder = classifySampleForLibrary(newSample);
      const directory = await getDirectoryForPath(libraryRoot, folder.folderPath);
      const blob = audioBufferToWavBlob(rendered, { bitDepth: 24, normalize: false });
      const fileName = await writeUniqueFile(directory, `${newSample.name}.wav`, blob);
      await writeLibraryManifest(libraryRoot, [{
        name: newSample.name,
        fileName,
        originalName: newSample.originalFileName,
        path: folder.folderPath,
        type: newSample.type,
        category: folder.category,
        bpm: newSample.bpm,
        key: newSample.key,
        tags: newSample.tags,
        duration: newSample.duration,
        sampleRate: newSample.sampleRate,
        bitDepth: 24,
        format: 'wav',
        derivedFrom: newSample.id,
        processing: 'dsp-rack',
      }]);
      // It has a file now. Point the sample at it and file the audio under its
      // path, so the copy pinned under the sample's id — pinned because it was
      // the only one there was — can be let go and evicted like any other.
      const diskPath = `${folder.folderPath.replace(/^\//, '')}/${fileName}`;
      cacheSampleAudio({ id: newSample.id, diskPath }, rendered);
      releaseSampleAudio(newSample);
      setSamples((prev) => prev.map((s) => (s.id === newSample.id ? { ...s, diskPath } : s)));
      await refreshLibrary();
    } catch (error) {
      console.error('Impossible de sauvegarder le rendu DSP dans la bibliothèque', error);
      toast.error("Le rendu DSP est visible dans l'application mais n'a pas pu être écrit dans le dossier de travail.");
    }
  };

  const handleCreateFolder = (name: string, color: string) => {
    const newF: FolderItem = {
      id: `folder-${Date.now().toString(36)}`,
      name,
      path: `/${name}`,
      color,
      count: 0,
    };
    setFolders((prev) => [...prev, newF]);
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (filterState.selectedFolderId === folderId) {
      setFilterState((prev) => ({ ...prev, selectedFolderId: null }));
    }
  };

  const handleToggleSelectSample = (sampleId: string) => {
    setSelectedSampleIds((prev) =>
      prev.includes(sampleId) ? prev.filter((id) => id !== sampleId) : [...prev, sampleId]
    );
  };

  const handleSelectAllSamples = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedSampleIds(filteredSamples.map((s) => s.id));
    } else {
      setSelectedSampleIds([]);
    }
  };

  return (
    <div
      id="app-root-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col h-screen w-screen bg-[#0A0A0B] text-[#EDEDEE] overflow-hidden font-sans relative antialiased"
    >
      {/* Hidden File Inputs for Menu Bar Actions */}
      <input
        ref={menuFileInputRef}
        type="file"
        multiple
        accept="audio/*,.wav,.mp3,.ogg,.flac,.aiff,.aif,.webm,.m4a"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleImportFiles(e.target.files);
          }
        }}
        className="hidden"
      />
      <input
        ref={menuFolderInputRef}
        type="file"
        {...({ webkitdirectory: '', directory: '', multiple: true } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleImportFiles(e.target.files);
          }
        }}
        className="hidden"
      />
      <input
        ref={menuOp1InputRef}
        type="file"
        accept=".aif,.aiff"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleImportOp1Patch(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {/* Drag & Drop Fullscreen Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-md border-2 border-dashed border-[#00F0FF] flex flex-col items-center justify-center pointer-events-none animate-in fade-in">
          <div className="w-16 h-16 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] mb-4 animate-bounce">
            <span className="text-3xl font-extrabold">+</span>
          </div>
          <h2 className="text-lg font-bold text-[#EDEDEE] tracking-tight">Utilisez le dossier de travail</h2>
          <p className="text-xs font-mono text-[#00F0FF] mt-1">
            Déposez vos sons dans le dossier connecté : Resonance les détecte et les classe automatiquement.
          </p>
        </div>
      )}

      {/* 1. TOP CLASSIC DAW MENU BAR */}
      <AppMenuBar
        onChooseLibrary={chooseLibrary}
        onProcessReception={libraryRoot ? processReception : undefined}
        onRefreshLibrary={libraryRoot ? refreshLibrary : undefined}
        onCleanEmptyFolders={libraryRoot ? cleanEmptyFolders : undefined}
        isBackgroundProcessing={isCuratorProcessing}
        libraryName={libraryName}
        onOpenDspAnalyzer={() => handleOpenDspAnalyzer()}
        onOpenLoudnessStandard={() => handleOpenLoudnessStandard()}
        onOpenEp133Export={handleExportEp133Pack}
        onSelectAll={() => handleSelectAllSamples(true)}
        onDeselectAll={() => handleSelectAllSamples(false)}
        onDeleteSelected={handleDeleteSelectedSamples}
        onExportZip={handleExportZip}
        autoLoudnessLeveling={autoLoudnessLeveling}
        onToggleAutoLoudness={handleToggleAutoLoudness}
        activeView={activeView}
        onViewChange={setActiveView}
        onLoadPatch={(patchId) => void handleLoadPatch(patchId)}
        samplesCount={Math.max(samples.length, diskSampleCount)}
      />

      {/* 2. COMPACT HEADER */}
      <Header
        searchQuery={filterState.searchQuery}
        onSearchChange={(q) => setFilterState((prev) => ({ ...prev, searchQuery: q }))}
        onReactivateWorkFolder={() => void reactivateWorkFolder()}
        workFolderName={libraryName}
        workFolderStatus={workFolderStatus}
        incomingCount={incomingCount}
        incomingIsPartial={incomingIsPartial}
        failedIncomingCount={failedIncomingCount}
        failedIncomingReason={failedIncomingReason}
        onOpenDspAnalyzer={() => handleOpenDspAnalyzer()}
        onOpenAutoSlicer={() => handleOpenSlicer()}
        onSaveWaveAsOp1={() => void handleSaveWaveAsOp1()}
        onAutoOrganizeLibrary={() => void handleAutoOrganizeLibrary()}
        isPlaying={isPlaying}
        onTogglePlayPause={handleTogglePlayPause}
        onPlayNext={handlePlayNext}
        onPlayPrev={handlePlayPrev}
        currentSampleName={selectedSample?.name}
        autoLoudnessLeveling={autoLoudnessLeveling}
        onToggleAutoLoudness={handleToggleAutoLoudness}
        samplesCount={Math.max(samples.length, diskSampleCount)}
      />

      {/* 3. MAIN WORKSPACE WITH RESIZABLE SPLITTERS */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar
          width={sidebarWidth}
          folders={folders}
          samples={samples}
          filterState={filterState}
          onFilterChange={(newF) => setFilterState((prev) => ({ ...prev, ...newF }))}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onAutoOrganizeLibrary={handleAutoOrganizeLibrary}
          activeView={activeView}
          onViewChange={setActiveView}
          physicalSampleCount={diskSampleCount}
          diskFolderCounts={diskFolderCounts}
        />

        {/* Vertical Splitter Handle (Resize Sidebar Width with Mouse Drag) */}
        <div
          onMouseDown={startSidebarResize}
          className={`w-2 hover:w-2.5 bg-[#141420] hover:bg-[#00F0FF] cursor-col-resize flex-shrink-0 transition-colors z-20 flex items-center justify-center group select-none ${
            isResizingSidebar ? 'bg-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.5)]' : ''
          }`}
          title="Glisser pour redimensionner la barre latérale"
        >
          <div className="w-0.5 h-6 bg-[#33334A] group-hover:bg-black rounded-full" />
        </div>

        {/* Center Content Pane */}
        <main
          ref={centerPaneRef}
          className="flex-1 flex flex-col p-2.5 overflow-hidden gap-2 bg-[#060609] min-w-0"
        >
          {activeView !== 'timbre' ? (
            <>
              {/* Top Waveform Visualizer with Compact Transport Bar on Top & Draggable Markers */}
              {selectedSample ? (
                <WaveformCanvas
                  height={
                    activeView === 'edit' && centerPaneHeight > 0
                      ? centerPaneHeight - 20
                      : waveformHeight
                  }
                  sample={selectedSample}
                  onUpdateSlices={handleUpdateSampleSlices}
                  onAddExtractedSamples={handleAddExtractedSamples}
                  onNextSample={() => {
                    if (filteredSamples.length > 0) {
                      const idx = filteredSamples.findIndex((s) => s.id === selectedSampleId);
                      const next = filteredSamples[(idx + 1) % filteredSamples.length];
                      setSelectedSampleId(next.id);
                      void playSample(next);
                    }
                  }}
                  onPrevSample={() => {
                    if (filteredSamples.length > 0) {
                      const idx = filteredSamples.findIndex((s) => s.id === selectedSampleId);
                      const prev = filteredSamples[(idx - 1 + filteredSamples.length) % filteredSamples.length];
                      setSelectedSampleId(prev.id);
                      void playSample(prev);
                    }
                  }}
                />
              ) : (
                <div className="h-36 bg-[#0E0E14] border-2 border-[#1E1E26] flex items-center justify-center text-[10px] font-pixel text-[#8E8E93] pixel-box">
                  CHOISISSEZ UN SAMPLE POUR INSPECTER L&apos;ONDE ET LE TRANSPORT
                </div>
              )}

              {/* A patch lays its settings open under its wave; an ordinary
                  sample shows nothing here. */}
              {activeView === 'edit' && <Op1PatchEditor sample={selectedSample} />}

              {/* The list is set aside while a sound is being worked on. */}
              {activeView === 'library' && (
                <>
              {/* Horizontal Splitter Handle (Resize Waveform Height with Mouse Drag) */}
              <div
                onMouseDown={startWaveformResize}
                className={`h-2 hover:h-2.5 bg-[#141420] hover:bg-[#00F0FF] cursor-row-resize flex-shrink-0 transition-colors z-10 flex items-center justify-center group select-none rounded ${
                  isResizingWaveform ? 'bg-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.5)]' : ''
                }`}
                title="Glisser pour redimensionner la hauteur de la forme d'onde"
              >
                <div className="h-0.5 w-8 bg-[#33334A] group-hover:bg-black rounded-full" />
              </div>

              {/* Spreadsheet Resizable Sample Table */}
              <SampleTable
                samples={filteredSamples}
                selectedSampleId={selectedSampleId}
                onSelectSample={openSampleForEditing}
                onToggleFavorite={handleToggleFavorite}
                onDeleteSample={handleDeleteSample}
                filterState={filterState}
                onFilterChange={(newF) => setFilterState((prev) => ({ ...prev, ...newF }))}
                selectedSampleIds={selectedSampleIds}
                onToggleSelectSample={handleToggleSelectSample}
                onSelectAllSamples={handleSelectAllSamples}
              />
                </>
              )}
            </>
          ) : (
            /* 2D Timbre Galaxy View */
            <TimbreMap
              samples={filteredSamples}
              selectedSampleId={selectedSampleId}
              onSelectSample={openSampleForEditing}
            />
          )}
        </main>

        {/* Vertical splitter for the workshop column */}
        <div
          onMouseDown={startAtelierResize}
          className={`w-2 hover:w-2.5 bg-[#141420] hover:bg-[#00F0FF] cursor-col-resize flex-shrink-0 transition-colors z-10 flex items-center justify-center group select-none ${
            isResizingAtelier ? 'bg-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.5)]' : ''
          }`}
          title="Glisser pour redimensionner l'atelier"
        >
          <div className="w-0.5 h-6 bg-[#33334A] group-hover:bg-black rounded-full" />
        </div>

        {/* Workshop column: effects, engines, patches, slicing, OP-1 kit */}
        <aside style={{ width: atelierWidth }} className="flex-shrink-0 overflow-hidden">
          <AtelierColumn
            sample={selectedSample}
            onSaveAsNewSample={handleSaveProcessedAsNew}
            onClearSample={() => setSelectedSampleId(null)}
            onSaveOp1Kit={handleSaveOp1Kit}
            onOpenSlicer={(s) => setSampleTarget('slicer', s)}
          />
        </aside>
      </div>

      {/* Smart Ingestion Magic Drop Modal */}
      <LazyModal open={modals.smartIngest}>
        <SmartIngestionModal
          isOpen={modals.smartIngest}
          onClose={() => closeModal('smartIngest')}
          onImportComplete={(newImportedSamples) => {
            const adopted = adoptNewSamples(newImportedSamples);
            setSamples((prev) => [...adopted, ...prev]);
            if (adopted.length > 0) {
              setSelectedSampleId(adopted[0].id);
              void playSample(adopted[0]);
            }
          }}
        />
      </LazyModal>

      {/* Auto-Curator Studio DSP Pipeline Modal */}
      <AutoCuratorModal
        isOpen={modals.autoCurator}
        onClose={() => closeModal('autoCurator')}
        librarySamples={samples}
        initialFiles={pendingCurationFiles}
        initialFilesAlreadyArchived={pendingFilesAlreadyArchived}
        onInitialFilesHandled={() => {
          setPendingCurationFiles([]);
          setPendingFilesAlreadyArchived(false);
        }}
        libraryRoot={libraryRoot}
        libraryName={libraryName}
        onLibraryRootChange={adoptExternalRoot}
        onLibraryChanged={() => void refreshLibrary()}
        onProcessingChange={setIsCuratorProcessing}
        onQueueResult={({ errors, reason }) => {
          setFailedIncomingCount(errors);
          setFailedIncomingReason(reason ?? '');
        }}
        autoTransfer
        onApplyCuration={handleApplyCuration}
        onOpenBatchNaming={() => openModal('batchNaming')}
      />

      {/* Market Benchmark Modal */}
      <LazyModal open={modals.benchmark}>
        <MarketBenchmarkModal
          isOpen={modals.benchmark}
          onClose={() => closeModal('benchmark')}
        />
      </LazyModal>

      {/* Slicer Modal */}
      <LazyModal open={!!slicerSample}>
        {slicerSample && (
          <AutoSlicerModal
            sample={liveSample(slicerSample)!}
            isOpen
            onClose={() => setSampleTarget('slicer', null)}
            onUpdateSampleSlices={handleUpdateSampleSlices}
            onExtractSlicesToLibrary={(extracted) => setSamples((prev) => [...extracted, ...prev])}
          />
        )}
      </LazyModal>

      {/* Batch Converter Modal */}
      <LazyModal open={modals.batchConverter}>
        <BatchConverterModal
          samples={
            selectedSampleIds.length > 0
              ? samples.filter((s) => selectedSampleIds.includes(s.id))
              : filteredSamples
          }
          isOpen={modals.batchConverter}
          onClose={() => closeModal('batchConverter')}
        />
      </LazyModal>

      {/* OP-1 OG Drum Kit Builder Modal */}
      <LazyModal open={modals.op1Studio}>
        <Op1KitBuilderModal
          isOpen={modals.op1Studio}
          onClose={() => closeModal('op1Studio')}
          availableSamples={samples}
          currentSelectedSample={selectedSample}
          onImportNewSamples={(newS) => {
            const adopted = adoptNewSamples(newS);
            setSamples((prev) => [...adopted, ...prev]);
            if (adopted.length > 0) setSelectedSampleId(adopted[0].id);
          }}
        />
      </LazyModal>

      {/* Audio Recorder Modal */}
      <AudioRecorderModal
        isOpen={modals.recorder}
        onClose={() => closeModal('recorder')}
        onSaveRecordedSample={(newS) => {
          // Nothing has written this take anywhere: the cache holds the only
          // copy of it until the user files it.
          const [adopted] = adoptNewSamples([newS], true);
          setSamples((prev) => [adopted, ...prev]);
          setSelectedSampleId(adopted.id);
        }}
      />

      {/* Professional Batch Naming & Organization Modal */}
      <LazyModal open={modals.batchNaming}>
        <BatchNamingModal
          isOpen={modals.batchNaming}
          onClose={() => closeModal('batchNaming')}
          samples={samples}
          selectedSampleIds={selectedSampleIds}
          onApplyRename={handleApplyBatchRename}
        />
      </LazyModal>

      {/* Studio DSP Audio Analysis Modal */}
      <LazyModal open={modals.dspModal}>
        <AudioAnalysisModal
          isOpen={modals.dspModal}
          onClose={() => {
            closeModal('dspModal');
            setSampleTarget('dsp', null);
          }}
          sample={liveSample(sampleForDsp)}
          onUpdateSample={handleUpdateSampleFromDsp}
        />
      </LazyModal>

      {/* Loudness calibration against a broadcast standard */}
      <LazyModal open={modals.loudnessModal}>
        <LoudnessStandardModal
          isOpen={modals.loudnessModal}
          onClose={() => {
            closeModal('loudnessModal');
            setSampleTarget('loudness', null);
          }}
          sample={liveSample(sampleForLoudness)}
          allSelectedSamples={selectedSamplesForLoudness}
          onApplyNormalization={handleApplyLoudnessNormalization}
          onBatchApplyNormalization={handleBatchApplyLoudnessNormalization}
        />
      </LazyModal>

      {/* Keyboard Shortcuts Modal */}
      <LazyModal open={modals.shortcuts}>
        <KeyboardShortcutsModal
          isOpen={modals.shortcuts}
          onClose={() => closeModal('shortcuts')}
        />
      </LazyModal>

      {/* Documentation & Naming Conventions Modal */}
      <LazyModal open={modals.doc}>
        <DocumentationModal
          isOpen={modals.doc}
          onClose={() => closeModal('doc')}
          onOpenAutoCurator={() => {
            closeModal('doc');
            openModal('autoCurator');
          }}
        />
      </LazyModal>

      <LazyModal open={modals.dedupe}>
        <LibraryDedupeModal
          isOpen={modals.dedupe}
          onClose={() => closeModal('dedupe')}
          libraryRoot={libraryRoot}
          onLibraryChanged={() => void refreshLibrary()}
        />
      </LazyModal>

      <LazyModal open={modals.patches}>
        <PatchesModal
          isOpen={modals.patches}
          onClose={() => closeModal('patches')}
          onOpenRack={() => closeModal('patches')}
        />
      </LazyModal>

      <Toaster />
    </div>
  );
}
