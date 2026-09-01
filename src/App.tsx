import React, { lazy, Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DEFAULT_FOLDERS } from './data/defaultSampleLibrary';
import { useResizablePanels } from './hooks/useResizablePanels';
import {
  SampleItem,
  FolderItem,
  FilterState,
  SliceRegion,
} from './types/sample';
import { AppMenuBar } from './components/AppMenuBar';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SampleTable } from './components/SampleTable';
import { WaveformCanvas } from './components/WaveformCanvas';
import { TimbreMap } from './components/TimbreMap';
import { AutoSlicerModal } from './components/AutoSlicerModal';
import { BatchConverterModal } from './components/BatchConverterModal';
import { AudioRecorderModal } from './components/AudioRecorderModal';
import { SmartIngestionModal } from './components/SmartIngestionModal';
import { AutoCuratorModal } from './components/AutoCuratorModal';
import { MarketBenchmarkModal } from './components/MarketBenchmarkModal';
import { Op1KitBuilderModal } from './components/Op1KitBuilderModal';
import { GitHubSyncModal } from './components/GitHubSyncModal';
import { BatchNamingModal } from './components/BatchNamingModal';
import { AudioAnalysisModal } from './components/AudioAnalysisModal';
import { AudioEffectsRackModal } from './components/AudioEffectsRackModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { DocumentationModal } from './components/DocumentationModal';
import { LoudnessStandardModal } from './components/LoudnessStandardModal';
const LayerSynthRackModal = lazy(() => import('./components/LayerSynthRackModal').then((module) => ({ default: module.LayerSynthRackModal })));
const AdvancedEngineRackModal = lazy(() => import('./components/AdvancedEngineRackModal').then((module) => ({ default: module.AdvancedEngineRackModal })));
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
import { parseOp1AiffPatch, extractSlicesToWavBlobs } from './services/op1PatchEncoder';
import {
  autoOrganizeLibrary,
  classifySampleForLibrary,
} from './services/proFolderOrganizer';
import {
  chooseLibraryRoot,
  listWorkFolderAudioFiles,
  removeEmptyManagedFolders,
  restoreLibraryRoot,
  scanManagedLibrary,
  supportsLocalLibrary,
  getDirectoryForPath,
  writeUniqueFile,
  writeLibraryManifest,
  readLibraryManifest,
  readLibraryAudioFile,
  type DirectoryHandle,
  type WorkFolderAudioFile,
} from './services/localLibrary';

export default function App() {
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>(DEFAULT_FOLDERS);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<'library' | 'timbre'>('library');

  // Dynamic Resizable Windows & Panels
  const {
    sidebarWidth,
    waveformHeight,
    isResizingSidebar,
    isResizingWaveform,
    startSidebarResize,
    startWaveformResize,
  } = useResizablePanels();

  // Modals state
  const [slicerSample, setSlicerSample] = useState<SampleItem | null>(null);
  const [isBatchConverterOpen, setIsBatchConverterOpen] = useState<boolean>(false);
  const [isRecorderOpen, setIsRecorderOpen] = useState<boolean>(false);
  const [isSmartIngestOpen, setIsSmartIngestOpen] = useState<boolean>(false);
  const [isAutoCuratorOpen, setIsAutoCuratorOpen] = useState<boolean>(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);
  const [isOp1StudioOpen, setIsOp1StudioOpen] = useState<boolean>(false);
  const [isGitHubSyncOpen, setIsGitHubSyncOpen] = useState<boolean>(false);
  const [isBatchNamingOpen, setIsBatchNamingOpen] = useState<boolean>(false);
  const [isDspModalOpen, setIsDspModalOpen] = useState<boolean>(false);
  const [isFxRackOpen, setIsFxRackOpen] = useState<boolean>(false);
  const [isSynthRackOpen, setIsSynthRackOpen] = useState<boolean>(false);
  const [isAdvancedRackOpen, setIsAdvancedRackOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isDocOpen, setIsDocOpen] = useState<boolean>(false);
  const [isLoudnessModalOpen, setIsLoudnessModalOpen] = useState<boolean>(false);
  const [pendingCurationFiles, setPendingCurationFiles] = useState<Array<File | WorkFolderAudioFile>>([]);
  const [pendingFilesAlreadyArchived, setPendingFilesAlreadyArchived] = useState(false);
  const [libraryRoot, setLibraryRoot] = useState<DirectoryHandle | null>(null);
  const [libraryName, setLibraryName] = useState<string | null>(null);
  const [diskSampleCount, setDiskSampleCount] = useState(0);
  const [diskFolderCounts, setDiskFolderCounts] = useState<Record<string, number>>({});
  const [isCuratorProcessing, setIsCuratorProcessing] = useState(false);
  const [workFolderStatus, setWorkFolderStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [incomingCount, setIncomingCount] = useState(0);
  const [failedIncomingCount, setFailedIncomingCount] = useState(0);
  const scanInFlightRef = useRef(false);
  const queuedSourceKeysRef = useRef(new Set<string>());
  const [sampleForLoudness, setSampleForLoudness] = useState<SampleItem | null>(null);

  const [sampleForDsp, setSampleForDsp] = useState<SampleItem | null>(null);
  const [sampleForFxRack, setSampleForFxRack] = useState<SampleItem | null>(null);
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
        folderId: classifySampleForLibrary({ type, category, isLoop: category === 'loop', name: fileName, originalFileName: fileName } as SampleItem).folderId,
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

  // Hidden File Inputs for Menu Bar actions
  const menuFileInputRef = useRef<HTMLInputElement>(null);
  const menuFolderInputRef = useRef<HTMLInputElement>(null);
  const menuOp1InputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const selected = samples.find((sample) => sample.id === selectedSampleId);
    if (!selected || selected.audioBuffer || !selected.diskPath || !libraryRoot) return;
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
  }, [selectedSampleId, samples, libraryRoot]);

  // Filters State
  const [filterState, setFilterState] = useState<FilterState>({
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
  });

  // The library intentionally starts empty: users import their own source material.

  useEffect(() => {
    restoreLibraryRoot().then((root) => {
      if (root) {
        setLibraryRoot(root);
        setLibraryName(root.name);
        setWorkFolderStatus('connected');
        scanManagedLibrary(root).then((scan) => {
          setDiskSampleCount(scan.totalSamples);
          setDiskFolderCounts(scan.folderCounts);
        });
        readLibraryManifest(root).then(hydrateManifestSamples);
      }
    });
  }, []);

  const handleChooseLibrary = async () => {
    if (!supportsLocalLibrary()) {
      alert("Le choix d'un dossier de travail nécessite Chrome ou Microsoft Edge sur ordinateur. Ouvrez http://localhost:3000 dans l'un de ces navigateurs, puis réessayez.");
      return;
    }
    try {
      setWorkFolderStatus('connecting');
      const root = await chooseLibraryRoot();
      setLibraryRoot(root);
      setLibraryName(root.name);
      const scan = await scanManagedLibrary(root);
      setDiskSampleCount(scan.totalSamples);
      setDiskFolderCounts(scan.folderCounts);
      hydrateManifestSamples(await readLibraryManifest(root));
      setWorkFolderStatus('connected');
    } catch (error) {
      setWorkFolderStatus(libraryRoot ? 'connected' : 'error');
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Erreur dossier de travail', error);
        alert(error instanceof Error ? `Impossible de connecter ce dossier : ${error.message}` : "Impossible de connecter ce dossier de travail.");
      }
    }
  };

  const handleReactivateWorkFolder = async () => {
    if (!libraryRoot) {
      await handleChooseLibrary();
      return;
    }
    try {
      const permission = await libraryRoot.requestPermission?.({ mode: 'readwrite' });
      if (permission === 'granted') {
        await handleRefreshLibrary();
        return;
      }
    } catch (error) {
      console.warn('Autorisation du dossier à renouveler', error);
    }
    await handleChooseLibrary();
  };

  const handleRefreshLibrary = async () => {
    if (!libraryRoot) return;
    try {
      const scan = await scanManagedLibrary(libraryRoot);
      setDiskSampleCount(scan.totalSamples);
      setDiskFolderCounts(scan.folderCounts);
      hydrateManifestSamples(await readLibraryManifest(libraryRoot));
      setWorkFolderStatus('connected');
    } catch (error) {
      setWorkFolderStatus('error');
      console.error('Erreur rafraîchissement bibliothèque', error);
      alert("Impossible de lire le dossier de travail. Reconnectez-le depuis Fichier.");
    }
  };

  const handleCleanEmptyFolders = async () => {
    if (!libraryRoot) return;
    try {
      const removed = await removeEmptyManagedFolders(libraryRoot);
      await handleRefreshLibrary();
      alert(removed > 0 ? `${removed} dossier(s) vide(s) supprimé(s).` : 'Aucun dossier vide à supprimer.');
    } catch (error) {
      console.error('Erreur nettoyage dossiers', error);
      alert("Impossible de nettoyer les dossiers. Reconnectez le dossier de travail.");
    }
  };

  const handleProcessReception = async () => {
    if (!libraryRoot) return;
    try {
      const files = await listWorkFolderAudioFiles(libraryRoot);
      queuedSourceKeysRef.current.clear();
      if (files.length === 0) {
        alert("Aucun nouveau fichier audio dans le dossier de travail. Déposez vos sons ou dossiers à sa racine, puis relancez cette commande.");
        return;
      }
      setPendingFilesAlreadyArchived(true);
      setPendingCurationFiles(files);
      setIsAutoCuratorOpen(true);
    } catch (error) {
      console.error('Erreur analyse réception', error);
      alert("Impossible de lire 00_RECEPTION. Reconnectez le dossier de travail depuis le menu Fichier.");
    }
  };

  useEffect(() => {
    if (!libraryRoot || isAutoCuratorOpen || isCuratorProcessing) return;
    let cancelled = false;
    const scanReception = async () => {
      if (scanInFlightRef.current) return;
      scanInFlightRef.current = true;
      try {
        const files = await listWorkFolderAudioFiles(libraryRoot);
        if (cancelled) return;
        setIncomingCount(files.length);
        const currentKeys = new Set(files.map(({ sourcePath, file }) => `${sourcePath}:${file.size}:${file.lastModified}`));
        for (const knownKey of queuedSourceKeysRef.current) {
          if (!currentKeys.has(knownKey)) queuedSourceKeysRef.current.delete(knownKey);
        }
        const freshFiles = files.filter(({ sourcePath, file }) => {
          const key = `${sourcePath}:${file.size}:${file.lastModified}`;
          if (queuedSourceKeysRef.current.has(key)) return false;
          queuedSourceKeysRef.current.add(key);
          return true;
        });
        if (freshFiles.length === 0) return;
        setPendingFilesAlreadyArchived(true);
        setPendingCurationFiles(freshFiles);
        // Keep automatic intake in the background; the red menu indicator opens details on demand.
      } catch (error) {
        console.error('Surveillance de réception indisponible', error);
        setWorkFolderStatus('error');
      } finally {
        scanInFlightRef.current = false;
      }
    };
    void scanReception();
    const timer = window.setInterval(() => void scanReception(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [libraryRoot, isAutoCuratorOpen, isCuratorProcessing]);

  // Filtered and Sorted Samples list
  const filteredSamples = useMemo(() => {
    return samples
      .filter((s) => {
        // Search query
        if (filterState.searchQuery.trim()) {
          const q = filterState.searchQuery.toLowerCase();
          const matchesName = s.name.toLowerCase().includes(q);
          const matchesType = s.type.toLowerCase().includes(q);
          const matchesKey = s.key?.toLowerCase().includes(q);
          const matchesTag = s.tags.some((t) => t.toLowerCase().includes(q));
          const matchesBpm = s.bpm && s.bpm.toString().includes(q);
          const matchesGenre = s.genre?.toLowerCase().includes(q);
          if (!matchesName && !matchesType && !matchesKey && !matchesTag && !matchesBpm && !matchesGenre) {
            return false;
          }
        }

        // Folder
        if (filterState.selectedFolderId && s.folderId !== filterState.selectedFolderId) {
          return false;
        }

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
  }, [samples, filterState]);

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

  // Master Playback Transport Handlers (Available globally across all screens)
  const handleTogglePlayPause = useCallback(() => {
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

  // Keyboard Shortcuts (Space for Play/Pause, Up/Down for next/prev)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when user is in input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlayPause();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyJ') {
        e.preventDefault();
        handlePlayNext();
      } else if (e.code === 'ArrowUp' || e.code === 'KeyK') {
        e.preventDefault();
        handlePlayPrev();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        audioEngine.toggleLoop();
      } else if (e.code === 'KeyN' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsBatchNamingOpen(true);
      } else if (e.code === 'KeyI' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void handleReactivateWorkFolder();
      } else if (e.code === 'KeyE' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (selectedSample) {
          setSampleForFxRack(selectedSample);
          setIsFxRackOpen(true);
        }
      } else if (e.code === 'F1') {
        e.preventDefault();
        setIsDocOpen(true);
      } else if (e.code === 'F2') {
        e.preventDefault();
        setActiveView((prev) => (prev === 'library' ? 'timbre' : 'library'));
      } else if (e.code === 'F4') {
        e.preventDefault();
        if (selectedSample) {
          setSampleForDsp(selectedSample);
          setIsDspModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlayPause, handlePlayNext, handlePlayPrev, selectedSample]);

  // All normal imports enter the curator so originals can be archived and
  // processing/classification uses one single pipeline.
  const handleImportFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setPendingCurationFiles(files);
    setIsAutoCuratorOpen(true);
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
    alert("Déposez les sons directement dans le dossier de travail : l'application les détecte et les trie automatiquement.");
  };

  const handleToggleFavorite = (sampleId: string) => {
    setSamples((prev) =>
      prev.map((s) => (s.id === sampleId ? { ...s, favorite: !s.favorite } : s))
    );
  };

  const handleSetRating = (sampleId: string, rating: number) => {
    setSamples((prev) =>
      prev.map((s) => (s.id === sampleId ? { ...s, rating } : s))
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

  const handleAutoOrganizeLibrary = () => {
    const { organizedSamples } = autoOrganizeLibrary(samples);
    setSamples(organizedSamples);
  };

  const handleApplyCuration = (curatedSamples: SampleItem[]) => {
    setSamples((current) => {
      const curatedIds = new Set(curatedSamples.map((sample) => sample.id));
      return [...curatedSamples, ...current.filter((sample) => !curatedIds.has(sample.id))];
    });
  };

  const handleExportEp133Pack = async () => {
    if (samples.length === 0) {
      alert('Aucun sample dans la bibliothèque à exporter.');
      return;
    }
    try {
      const zipBlob = await exportEp133ProjectPack(samples, {
        useMono: true,
        sampleRate: 46875,
        loudnessMatch: true,
      });
      triggerFileDownload(zipBlob, `Resonance_EP133_KO_II_Pack_${Date.now().toString(36)}.zip`);
    } catch (err) {
      console.error('Erreur export EP-133:', err);
      alert("Une erreur est survenue lors de l'exportation du pack EP-133.");
    }
  };

  const handleExportZip = async () => {
    const targetSamples =
      selectedSampleIds.length > 0
        ? samples.filter((s) => selectedSampleIds.includes(s.id))
        : filteredSamples;

    if (targetSamples.length === 0) {
      alert('Aucun sample à exporter.');
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
      alert("Une erreur est survenue lors de l'exportation ZIP.");
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

  const handleOpenFxRack = (targetSample?: SampleItem) => {
    const s = targetSample || selectedSample;
    if (s) {
      setSampleForFxRack(s);
      setIsFxRackOpen(true);
    }
  };

  const handleOpenLoudnessStandard = (targetSample?: SampleItem) => {
    const s = targetSample || selectedSample;
    if (s) {
      setSampleForLoudness(s);
      setIsLoudnessModalOpen(true);
    }
  };

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
      await handleRefreshLibrary();
    } catch (error) {
      console.error('Impossible de sauvegarder le rendu DSP dans la bibliothèque', error);
      alert("Le rendu DSP est visible dans l'application mais n'a pas pu être écrit dans le dossier de travail.");
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

  const handleOverwriteSample = (updatedSample: SampleItem) => {
    setSamples((prev) => prev.map((s) => (s.id === updatedSample.id ? updatedSample : s)));
    setSelectedSampleId(updatedSample.id);
    if (updatedSample.audioBuffer) {
      audioEngine.play(updatedSample.audioBuffer, updatedSample.id, updatedSample.loudnessGainDb);
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
        onChooseLibrary={handleChooseLibrary}
        onProcessReception={libraryRoot ? handleProcessReception : undefined}
        onRefreshLibrary={libraryRoot ? handleRefreshLibrary : undefined}
        onCleanEmptyFolders={libraryRoot ? handleCleanEmptyFolders : undefined}
        isBackgroundProcessing={isCuratorProcessing}
        onOpenBackgroundProcessing={() => setIsAutoCuratorOpen(true)}
        libraryName={libraryName}
        onOpenAutoCurator={() => setIsAutoCuratorOpen(true)}
        onOpenBatchNaming={() => setIsBatchNamingOpen(true)}
        onOpenBatchConverter={() => setIsBatchConverterOpen(true)}
        onOpenDspAnalyzer={() => {
          setSampleForDsp(selectedSample);
          setIsDspModalOpen(true);
        }}
        onOpenFxRack={() => handleOpenFxRack()}
        onOpenSynthRack={() => setIsSynthRackOpen(true)}
        onOpenAdvancedRack={() => setIsAdvancedRackOpen(true)}
        onOpenLoudnessStandard={() => handleOpenLoudnessStandard()}
        onOpenOp1Studio={() => setIsOp1StudioOpen(true)}
        onOpenEp133Export={handleExportEp133Pack}
        onOpenGitHubSync={() => setIsGitHubSyncOpen(true)}
        onOpenRecorder={() => setIsRecorderOpen(true)}
        onOpenBenchmark={() => setIsBenchmarkOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenDocumentation={() => setIsDocOpen(true)}
        onSelectAll={() => handleSelectAllSamples(true)}
        onDeselectAll={() => handleSelectAllSamples(false)}
        onDeleteSelected={handleDeleteSelectedSamples}
        onExportZip={handleExportZip}
        autoLoudnessLeveling={autoLoudnessLeveling}
        onToggleAutoLoudness={handleToggleAutoLoudness}
        activeView={activeView}
        onViewChange={setActiveView}
        samplesCount={Math.max(samples.length, diskSampleCount)}
      />

      {/* 2. COMPACT HEADER */}
      <Header
        searchQuery={filterState.searchQuery}
        onSearchChange={(q) => setFilterState((prev) => ({ ...prev, searchQuery: q }))}
        onReactivateWorkFolder={() => void handleReactivateWorkFolder()}
        workFolderName={libraryName}
        workFolderStatus={workFolderStatus}
        incomingCount={incomingCount}
        failedIncomingCount={failedIncomingCount}
        onOpenAutoCurator={() => setIsAutoCuratorOpen(true)}
        onOpenDocumentation={() => setIsDocOpen(true)}
        onOpenBenchmark={() => setIsBenchmarkOpen(true)}
        onExportEp133Pack={handleExportEp133Pack}
        onOpenOp1Studio={() => setIsOp1StudioOpen(true)}
        onOpenGitHubSync={() => setIsGitHubSyncOpen(true)}
        onOpenRecorder={() => setIsRecorderOpen(true)}
        onOpenBatchConverter={() => setIsBatchConverterOpen(true)}
        onOpenBatchNaming={() => setIsBatchNamingOpen(true)}
        onOpenDspAnalyzer={() => {
          setSampleForDsp(selectedSample);
          setIsDspModalOpen(true);
        }}
        onOpenFxRack={() => handleOpenFxRack()}
        onOpenAutoSlicer={() => {
          if (selectedSample) setSlicerSample(selectedSample);
        }}
        onAutoOrganizeLibrary={handleAutoOrganizeLibrary}
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
          onOpenRecorder={() => setIsRecorderOpen(true)}
          onOpenOp1Studio={() => setIsOp1StudioOpen(true)}
          onOpenGitHubSync={() => setIsGitHubSyncOpen(true)}
          onOpenAutoCurator={() => setIsAutoCuratorOpen(true)}
          onOpenDocumentation={() => setIsDocOpen(true)}
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
        <main className="flex-1 flex flex-col p-2.5 overflow-hidden gap-2 bg-[#060609]">
          {activeView === 'library' ? (
            <>
              {/* Top Waveform Visualizer with Compact Transport Bar on Top & Draggable Markers */}
              {selectedSample ? (
                <WaveformCanvas
                  height={waveformHeight}
                  sample={selectedSample}
                  onOpenSlicer={() => setSlicerSample(selectedSample)}
                  onOpenDspAnalyzer={() => {
                    setSampleForDsp(selectedSample);
                    setIsDspModalOpen(true);
                  }}
                  onOpenFxRack={() => handleOpenFxRack(selectedSample)}
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
                onOpenSlicerForSample={(s) => setSlicerSample(s)}
                onOpenDspAnalyzer={(s) => {
                  setSampleForDsp(s);
                  setIsDspModalOpen(true);
                }}
                onOpenFxRack={(s) => handleOpenFxRack(s)}
                onOpenLoudnessStandard={(s) => handleOpenLoudnessStandard(s)}
                onOpenBatchNaming={() => setIsBatchNamingOpen(true)}
                onToggleFavorite={handleToggleFavorite}
                onSetRating={handleSetRating}
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
      </div>

      {/* Smart Ingestion Magic Drop Modal */}
      <SmartIngestionModal
        isOpen={isSmartIngestOpen}
        onClose={() => setIsSmartIngestOpen(false)}
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

      {/* Auto-Curator Studio DSP Pipeline Modal */}
      <AutoCuratorModal
        isOpen={isAutoCuratorOpen}
        onClose={() => setIsAutoCuratorOpen(false)}
        librarySamples={samples}
        initialFiles={pendingCurationFiles}
        initialFilesAlreadyArchived={pendingFilesAlreadyArchived}
        onInitialFilesHandled={() => {
          setPendingCurationFiles([]);
          setPendingFilesAlreadyArchived(false);
        }}
        libraryRoot={libraryRoot}
        libraryName={libraryName}
        onLibraryRootChange={(root) => {
          setLibraryRoot(root);
          setLibraryName(root.name);
        }}
        onLibraryChanged={() => void handleRefreshLibrary()}
        onProcessingChange={setIsCuratorProcessing}
        onQueueResult={({ errors }) => setFailedIncomingCount(errors)}
        autoTransfer
        onApplyCuration={handleApplyCuration}
        onOpenBatchNaming={() => setIsBatchNamingOpen(true)}
      />

      {/* Market Benchmark Modal */}
      <MarketBenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />

      {/* Slicer Modal */}
      {slicerSample && (
        <AutoSlicerModal
          sample={slicerSample}
          isOpen={!!slicerSample}
          onClose={() => setSlicerSample(null)}
          onUpdateSampleSlices={handleUpdateSampleSlices}
          onExtractSlicesToLibrary={(extracted) => setSamples((prev) => [...extracted, ...prev])}
        />
      )}

      {/* Batch Converter Modal */}
      <BatchConverterModal
        samples={
          selectedSampleIds.length > 0
            ? samples.filter((s) => selectedSampleIds.includes(s.id))
            : filteredSamples
        }
        isOpen={isBatchConverterOpen}
        onClose={() => setIsBatchConverterOpen(false)}
      />

      {/* OP-1 OG Drum Kit Builder Modal */}
      <Op1KitBuilderModal
        isOpen={isOp1StudioOpen}
        onClose={() => setIsOp1StudioOpen(false)}
        availableSamples={samples}
        currentSelectedSample={selectedSample}
        onImportNewSamples={(newS) => {
          setSamples((prev) => [...newS, ...prev]);
          if (newS.length > 0) setSelectedSampleId(newS[0].id);
        }}
        onOpenGitHubSync={() => setIsGitHubSyncOpen(true)}
      />

      {/* Audio Recorder Modal */}
      <AudioRecorderModal
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        onSaveRecordedSample={(newS) => {
          setSamples((prev) => [newS, ...prev]);
          setSelectedSampleId(newS.id);
        }}
      />

      {/* GitHub Hub (propann/az-sample) Modal */}
      <GitHubSyncModal
        isOpen={isGitHubSyncOpen}
        onClose={() => setIsGitHubSyncOpen(false)}
        samples={samples}
      />

      {/* Professional Batch Naming & Organization Modal */}
      <BatchNamingModal
        isOpen={isBatchNamingOpen}
        onClose={() => setIsBatchNamingOpen(false)}
        samples={samples}
        selectedSampleIds={selectedSampleIds}
        onApplyRename={handleApplyBatchRename}
        onOpenGitHubSync={() => setIsGitHubSyncOpen(true)}
      />

      {/* Studio DSP Audio Analysis Modal */}
      <AudioAnalysisModal
        isOpen={isDspModalOpen}
        onClose={() => {
          setIsDspModalOpen(false);
          setSampleForDsp(null);
        }}
        sample={sampleForDsp || selectedSample}
        onUpdateSample={handleUpdateSampleFromDsp}
      />

      {/* Creative Studio DSP Effects Rack & Pitch Tuner Modal */}
      {isFxRackOpen && (
        <AudioEffectsRackModal
          isOpen={isFxRackOpen}
          onClose={() => {
            setIsFxRackOpen(false);
            setSampleForFxRack(null);
          }}
          sample={sampleForFxRack || selectedSample}
          onSaveAsNewSample={handleSaveProcessedAsNew}
          onOverwriteSample={handleOverwriteSample}
          libraryRoot={libraryRoot}
        />
      )}

      <Suspense fallback={isSynthRackOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 text-xs text-[#00F0FF]">Chargement du Creator Studio…</div> : null}>
        <LayerSynthRackModal isOpen={isSynthRackOpen} onClose={() => setIsSynthRackOpen(false)} libraryRoot={libraryRoot} onCreateSample={handleCreateSynthSample} librarySamples={samples} onSelectLibrarySample={setSelectedSampleId} onOpenEffects={(sample) => { setSelectedSampleId(sample.id); handleOpenFxRack(sample); }} />
      </Suspense>
      <Suspense fallback={null}><AdvancedEngineRackModal isOpen={isAdvancedRackOpen} onClose={() => setIsAdvancedRackOpen(false)} libraryRoot={libraryRoot} /></Suspense>

      {/* International Loudness Standard Modal (ITU-R BS.1770-4 / EBU R128) */}
      <LoudnessStandardModal
        isOpen={isLoudnessModalOpen}
        onClose={() => {
          setIsLoudnessModalOpen(false);
          setSampleForLoudness(null);
        }}
        sample={sampleForLoudness || selectedSample}
        allSelectedSamples={
          selectedSampleIds.length > 0
            ? samples.filter((s) => selectedSampleIds.includes(s.id))
            : filteredSamples
        }
        onApplyNormalization={handleApplyLoudnessNormalization}
        onBatchApplyNormalization={handleBatchApplyLoudnessNormalization}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Documentation & Naming Conventions Modal */}
      <DocumentationModal
        isOpen={isDocOpen}
        onClose={() => setIsDocOpen(false)}
        onOpenAutoCurator={() => {
          setIsDocOpen(false);
          setIsAutoCuratorOpen(true);
        }}
        onOpenGitHubSync={() => {
          setIsDocOpen(false);
          setIsGitHubSyncOpen(true);
        }}
      />
    </div>
  );
}
