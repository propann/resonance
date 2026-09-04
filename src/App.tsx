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
import { folderIdForPath, folderMatcher } from './services/libraryFolders';
import { usePatchStore } from './stores/patchStore';
import { SampleItem, FolderItem, SliceRegion } from './types/sample';
import { AppMenuBar } from './components/AppMenuBar';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SampleTable } from './components/SampleTable';
import { WaveformCanvas } from './components/WaveformCanvas';
import { AtelierColumn } from './components/AtelierColumn';
import { TimbreMap } from './components/TimbreMap';
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
const LayerSynthRackModal = lazy(() => import('./components/LayerSynthRackModal').then((module) => ({ default: module.LayerSynthRackModal })));

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
import {
  autoOrganizeLibrary,
  classifySampleForLibrary,
} from './services/proFolderOrganizer';
import {
  getDirectoryForPath,
  writeUniqueFile,
  writeLibraryManifest,
  readLibraryAudioFile,
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
  const [autoLoudnessLeveling, setAutoLoudnessLeveling] = useState<boolean>(
    audioEngine.isAutoLoudnessEnabled()
  );

  const hydrateManifestSamples = (entries: Array<Record<string, unknown>>) => {
    const allowedTypes = new Set(['kick', 'snare', 'hihat', 'clap', 'cymbal', 'percussion', 'bass', '808', 'lead', 'pad', 'vocal', 'fx', 'loop', 'multi-sound', 'other']);
    const allowedCategories = new Set(['one-shot', 'loop', 'multi-sound']);
    const allowedGenres = new Set(['Hip-Hop / BoomBap', 'Trap / Drill', 'House / EDM', 'Techno', 'Techno / Industrial', 'Lo-Fi / Chillhop', 'Synthwave / Retro', 'Drum & Bass', 'Drum & Bass / Jungle', 'Afrobeat / Dancehall', 'Ambient / Cinematic', 'Pop / R&B', 'Acoustic / Rock', 'Universal / Multi-Genre']);
    const hydrated: SampleItem[] = entries.map((entry, index) => {
      const type = typeof entry.type === 'string' && allowedTypes.has(entry.type) ? entry.type as SampleItem['type'] : 'other';
      const category = typeof entry.category === 'string' && allowedCategories.has(entry.category) ? entry.category as SampleItem['category'] : 'one-shot';
      const path = typeof entry.path === 'string' ? entry.path : '/01_ONE_SHOTS/05_FX_TEXTURES';
      const fileName = typeof entry.fileName === 'string' ? entry.fileName : typeof entry.name === 'string' ? entry.name : `sample-${index}`;
      return {
        id: `disk-${path}-${fileName}`,
        name: typeof entry.name === 'string' ? entry.name : fileName,
        originalFileName: typeof entry.originalName === 'string' ? entry.originalName : fileName,
        format: entry.format === 'op-1-aiff' ? 'aiff' : 'wav',
        size: 0, duration: typeof entry.duration === 'number' ? entry.duration : 0,
        sampleRate: typeof entry.sampleRate === 'number' ? entry.sampleRate : 48000,
        bitDepth: typeof entry.bitDepth === 'number' ? entry.bitDepth : 24, channels: 2,
        bpm: typeof entry.bpm === 'number' ? entry.bpm : undefined,
        key: typeof entry.key === 'string' ? entry.key : undefined,
        type, category, isLoop: category === 'loop', genre: allowedGenres.has(entry.genre as string) ? entry.genre as SampleItem['genre'] : 'Universal / Multi-Genre',
        tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        // Where the file sits on disk is the truth. Re-guessing the folder
        // from the name would file a "...kick..." found in 06_PERCS under
        // kicks, and the sidebar count would stop matching the list.
        folderId:
          folderIdForPath(path) ??
          classifySampleForLibrary({ type, category, isLoop: category === 'loop', name: fileName, originalFileName: fileName } as SampleItem).folderId,
        folderPath: path, favorite: false, rating: 0,
        spectralCentroid: 0, dynamicRangeDb: 0, peakDb: 0, rmsDb: 0, lufs: 0, loudnessGainDb: 0, zeroCrossingRate: 0,
        slices: [], blobUrl: '', dateAdded: 0, diskPath: `${path.replace(/^\//, '')}/${fileName}`,
      };
    });
    setSamples((previous) => {
      const byId = new Map(previous.map((sample) => [sample.id, sample]));
      hydrated.forEach((sample) => { if (!byId.has(sample.id)) byId.set(sample.id, sample); });
      return [...byId.values()];
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
    if (!selected || selected.audioBuffer || !selected.diskPath) return;
    let cancelled = false;
    const loadSelectedAudio = async () => {
      try {
        const file = await readLibraryAudioFile(libraryRoot, selected.diskPath!);
        const audioBuffer = await audioEngine.decodeAudioData(await file.arrayBuffer());
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(file);
        setSamples((previous) => previous.map((sample) => sample.id === selected.id ? {
          ...sample, audioBuffer, blobUrl, size: file.size, duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate, channels: audioBuffer.numberOfChannels,
        } : sample));
      } catch (error) {
        console.error('Impossible de charger le sample sélectionné depuis le dossier de travail', error);
      }
    };
    void loadSelectedAudio();
    return () => { cancelled = true; };
  }, [selectedSampleId, libraryRoot, setSamples]);

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

  const selectedSample = useMemo(() => {
    return samples.find((s) => s.id === selectedSampleId) || filteredSamples[0] || null;
  }, [samples, selectedSampleId, filteredSamples]);

  // A sample-scoped modal stores a snapshot of its target sample; re-resolve it
  // against the live library so a later disk-decode (audioBuffer) reaches the modal.
  const liveSample = useCallback(
    (snap: SampleItem | null): SampleItem | null =>
      snap ? samples.find((s) => s.id === snap.id) ?? snap : null,
    [samples]
  );

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
    } else if (selectedSample && selectedSample.audioBuffer) {
      audioEngine.play(selectedSample.audioBuffer, selectedSample.id, selectedSample.loudnessGainDb);
    } else if (filteredSamples.length > 0) {
      const first = filteredSamples[0];
      setSelectedSampleId(first.id);
      if (first.audioBuffer) {
        audioEngine.play(first.audioBuffer, first.id, first.loudnessGainDb);
      }
    }
  }, [selectedSample, filteredSamples]);

  const handlePlayNext = useCallback(() => {
    if (filteredSamples.length === 0) return;
    const idx = filteredSamples.findIndex((s) => s.id === selectedSampleId);
    const nextIdx = (idx + 1) % filteredSamples.length;
    const nextSample = filteredSamples[nextIdx];
    setSelectedSampleId(nextSample.id);
    if (nextSample.audioBuffer) {
      audioEngine.play(nextSample.audioBuffer, nextSample.id, nextSample.loudnessGainDb);
    }
  }, [filteredSamples, selectedSampleId]);

  const handlePlayPrev = useCallback(() => {
    if (filteredSamples.length === 0) return;
    const idx = filteredSamples.findIndex((s) => s.id === selectedSampleId);
    const prevIdx = (idx - 1 + filteredSamples.length) % filteredSamples.length;
    const prevSample = filteredSamples[prevIdx];
    setSelectedSampleId(prevSample.id);
    if (prevSample.audioBuffer) {
      audioEngine.play(prevSample.audioBuffer, prevSample.id, prevSample.loudnessGainDb);
    }
  }, [filteredSamples, selectedSampleId]);

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

      const newSample: SampleItem = {
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

      setSamples((prev) => [newSample, ...prev]);
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

  const handleApplyCuration = (curatedSamples: SampleItem[]) => {
    setSamples((current) => {
      const curatedIds = new Set(curatedSamples.map((sample) => sample.id));
      return [...curatedSamples, ...current.filter((sample) => !curatedIds.has(sample.id))];
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
    const newItems: SampleItem[] = extracted.map((ex, i) => {
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

    setSamples((prev) => [...newItems, ...prev]);
    if (newItems.length > 0) {
      setSelectedSampleId(newItems[0].id);
      audioEngine.play(newItems[0].audioBuffer!, newItems[0].id, 0);
    }
  };

  const handleApplyBatchRename = (updatedSamples: SampleItem[]) => {
    setSamples(updatedSamples);
  };

  const handleUpdateSampleFromDsp = (updatedSample: SampleItem) => {
    setSamples((prev) =>
      prev.map((s) => (s.id === updatedSample.id ? updatedSample : s))
    );
  };

  // Thin wrappers over the store opener, kept for the internal callers
  // (keyboard shortcuts, LayerSynth "open effects", etc.).
  const handleOpenLoudnessStandard = (targetSample?: SampleItem) =>
    openSampleModal('loudness', targetSample);
  const handleOpenDspAnalyzer = (targetSample?: SampleItem) => openSampleModal('dsp', targetSample);
  const handleOpenSlicer = (targetSample?: SampleItem) => openSampleModal('slicer', targetSample);

  const handleApplyLoudnessNormalization = (updatedSample: SampleItem, report: LoudnessAuditReport) => {
    setSamples((prev) =>
      prev.map((s) => (s.id === updatedSample.id ? updatedSample : s))
    );
    if (updatedSample.audioBuffer) {
      audioEngine.play(updatedSample.audioBuffer, updatedSample.id, 0);
    }
  };

  const handleBatchApplyLoudnessNormalization = (
    updatedList: SampleItem[],
    standardKey: LoudnessStandardKey
  ) => {
    setSamples((prev) => {
      const map = new Map(updatedList.map((item) => [item.id, item]));
      return prev.map((s) => map.get(s.id) || s);
    });
  };

  const handleSaveProcessedAsNew = async (newSample: SampleItem) => {
    setSamples((prev) => [newSample, ...prev]);
    setSelectedSampleId(newSample.id);
    if (newSample.audioBuffer) {
      audioEngine.play(newSample.audioBuffer, newSample.id, newSample.loudnessGainDb);
    }
    if (!libraryRoot || !newSample.audioBuffer) return;
    try {
      const folder = classifySampleForLibrary(newSample);
      const directory = await getDirectoryForPath(libraryRoot, folder.folderPath);
      const blob = audioBufferToWavBlob(newSample.audioBuffer, { bitDepth: 24, normalize: false });
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
      await refreshLibrary();
    } catch (error) {
      console.error('Impossible de sauvegarder le rendu DSP dans la bibliothèque', error);
      toast.error("Le rendu DSP est visible dans l'application mais n'a pas pu être écrit dans le dossier de travail.");
    }
  };

  const handleCreateSynthSample = (audioBuffer: AudioBuffer, name: string) => {
    const metrics = calculateAudioMetrics(audioBuffer);
    const blob = audioBufferToWavBlob(audioBuffer, { bitDepth: 24, normalize: false });
    const sample: SampleItem = {
      id: `synth-${Date.now().toString(36)}`,
      name,
      originalFileName: `${name}.wav`,
      format: 'wav', size: blob.size, duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate, bitDepth: 24, channels: audioBuffer.numberOfChannels,
      type: 'lead', category: 'one-shot', isLoop: false, genre: 'Universal / Multi-Genre',
      tags: ['synth', 'layer-rack', 'created'], folderId: 'f-os-melodic', folderPath: '/01_ONE_SHOTS/03_MELODIC',
      favorite: false, rating: 0, spectralCentroid: metrics.spectralCentroid, dynamicRangeDb: metrics.dynamicRangeDb,
      peakDb: metrics.peakDb, rmsDb: metrics.rmsDb, lufs: metrics.lufs, loudnessGainDb: metrics.loudnessGainDb,
      zeroCrossingRate: metrics.zeroCrossingRate, slices: [], blobUrl: URL.createObjectURL(blob), audioBuffer, dateAdded: Date.now(),
    };
    void handleSaveProcessedAsNew(sample);
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
        onOpenDspAnalyzer={() => handleOpenDspAnalyzer()}
        onOpenAutoSlicer={() => handleOpenSlicer()}
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
        <main className="flex-1 flex flex-col p-2.5 overflow-hidden gap-2 bg-[#060609] min-w-0">
          {activeView === 'library' ? (
            <>
              {/* Top Waveform Visualizer with Compact Transport Bar on Top & Draggable Markers */}
              {selectedSample ? (
                <WaveformCanvas
                  height={waveformHeight}
                  sample={selectedSample}
                  onUpdateSlices={handleUpdateSampleSlices}
                  onAddExtractedSamples={handleAddExtractedSamples}
                  onNextSample={() => {
                    if (filteredSamples.length > 0) {
                      const idx = filteredSamples.findIndex((s) => s.id === selectedSampleId);
                      const next = filteredSamples[(idx + 1) % filteredSamples.length];
                      setSelectedSampleId(next.id);
                      if (next.audioBuffer) audioEngine.play(next.audioBuffer, next.id, next.loudnessGainDb);
                    }
                  }}
                  onPrevSample={() => {
                    if (filteredSamples.length > 0) {
                      const idx = filteredSamples.findIndex((s) => s.id === selectedSampleId);
                      const prev = filteredSamples[(idx - 1 + filteredSamples.length) % filteredSamples.length];
                      setSelectedSampleId(prev.id);
                      if (prev.audioBuffer) audioEngine.play(prev.audioBuffer, prev.id, prev.loudnessGainDb);
                    }
                  }}
                />
              ) : (
                <div className="h-36 bg-[#0E0E14] border-2 border-[#1E1E26] flex items-center justify-center text-[10px] font-pixel text-[#8E8E93] pixel-box">
                  CHOISISSEZ UN SAMPLE POUR INSPECTER L&apos;ONDE ET LE TRANSPORT
                </div>
              )}

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
                onSelectSample={(s) => setSelectedSampleId(s.id)}
                onToggleFavorite={handleToggleFavorite}
                onDeleteSample={handleDeleteSample}
                filterState={filterState}
                onFilterChange={(newF) => setFilterState((prev) => ({ ...prev, ...newF }))}
                selectedSampleIds={selectedSampleIds}
                onToggleSelectSample={handleToggleSelectSample}
                onSelectAllSamples={handleSelectAllSamples}
              />
            </>
          ) : (
            /* 2D Timbre Galaxy View */
            <TimbreMap
              samples={filteredSamples}
              selectedSampleId={selectedSampleId}
              onSelectSample={(s) => setSelectedSampleId(s.id)}
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
            setSamples((prev) => [...newImportedSamples, ...prev]);
            if (newImportedSamples.length > 0) {
              setSelectedSampleId(newImportedSamples[0].id);
              if (newImportedSamples[0].audioBuffer) {
                audioEngine.play(
                  newImportedSamples[0].audioBuffer,
                  newImportedSamples[0].id,
                  newImportedSamples[0].loudnessGainDb
                );
              }
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
        onQueueResult={({ errors }) => setFailedIncomingCount(errors)}
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
            setSamples((prev) => [...newS, ...prev]);
            if (newS.length > 0) setSelectedSampleId(newS[0].id);
          }}
        />
      </LazyModal>

      {/* Audio Recorder Modal */}
      <AudioRecorderModal
        isOpen={modals.recorder}
        onClose={() => closeModal('recorder')}
        onSaveRecordedSample={(newS) => {
          setSamples((prev) => [newS, ...prev]);
          setSelectedSampleId(newS.id);
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
