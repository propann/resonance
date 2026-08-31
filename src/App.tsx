import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  generateDefaultLibrary,
  DEFAULT_FOLDERS,
} from './data/defaultSampleLibrary';
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
import { LoudnessAuditReport, LoudnessStandardKey } from './services/audioLoudnessStandard';
import { audioEngine } from './services/audioEngine';
import {
  calculateAudioMetrics,
  classifySample,
  detectAutoSlices,
  detectBpm,
  detectPitch,
  detectPitchAndKey,
  detectLoopVsOneShot,
  classifyGenre,
  assignEp133Slot,
} from './services/audioAnalyzer';
import {
  audioBufferToWavBlob,
  triggerFileDownload,
  exportEp133ProjectPack,
  exportMultipleWavsAsZip,
} from './services/audioConverter';
import { parseOp1AiffPatch, extractSlicesToWavBlobs } from './services/op1PatchEncoder';
import {
  classifySampleToProFolder,
  autoOrganizeLibrary,
} from './services/proFolderOrganizer';

export default function App() {
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>(DEFAULT_FOLDERS);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<'library' | 'timbre'>('library');

  // Dynamic Resizable Windows & Panels
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('resonance_sidebar_width_v2');
      if (saved) return Number(saved);
    } catch (e) {
      // Ignorer
    }
    return 280;
  });

  const [waveformHeight, setWaveformHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('resonance_waveform_height_v2');
      if (saved) return Number(saved);
    } catch (e) {
      // Ignorer
    }
    return 175;
  });

  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);
  const [isResizingWaveform, setIsResizingWaveform] = useState<boolean>(false);

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
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isDocOpen, setIsDocOpen] = useState<boolean>(false);
  const [isLoudnessModalOpen, setIsLoudnessModalOpen] = useState<boolean>(false);
  const [sampleForLoudness, setSampleForLoudness] = useState<SampleItem | null>(null);

  const [sampleForDsp, setSampleForDsp] = useState<SampleItem | null>(null);
  const [sampleForFxRack, setSampleForFxRack] = useState<SampleItem | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [autoLoudnessLeveling, setAutoLoudnessLeveling] = useState<boolean>(
    audioEngine.isAutoLoudnessEnabled()
  );

  // Hidden File Inputs for Menu Bar actions
  const menuFileInputRef = useRef<HTMLInputElement>(null);
  const menuFolderInputRef = useRef<HTMLInputElement>(null);
  const menuOp1InputRef = useRef<HTMLInputElement>(null);

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

  // Load starter sound pack on mount
  useEffect(() => {
    async function init() {
      try {
        const initialSamples = await generateDefaultLibrary();
        setSamples(initialSamples);
        if (initialSamples.length > 0) {
          setSelectedSampleId(initialSamples[0].id);
        }
      } catch (err) {
        console.error('Failed to init default sample library:', err);
      }
    }
    init();
  }, []);

  // Handlers pour le redimensionnement vertical à la souris (Sidebar Splitter)
  const handleStartSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newW = Math.max(190, Math.min(520, startWidth + deltaX));
      setSidebarWidth(newW);
      try {
        localStorage.setItem('resonance_sidebar_width_v2', String(newW));
      } catch (err) {}
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handlers pour le redimensionnement horizontal à la souris (Waveform Splitter)
  const handleStartWaveformResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingWaveform(true);
    const startY = e.clientY;
    const startHeight = waveformHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newH = Math.max(100, Math.min(420, startHeight + deltaY));
      setWaveformHeight(newH);
      try {
        localStorage.setItem('resonance_waveform_height_v2', String(newH));
      } catch (err) {}
    };

    const handleMouseUp = () => {
      setIsResizingWaveform(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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
            return (b.dateAdded - a.dateAdded) * (filterState.sortDirection === 'asc' ? -1 : 1);
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
        setIsSmartIngestOpen(true);
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

  // Import files pipeline
  const handleImportFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const audioFiles = files.filter((f) => {
      return (
        f.type.startsWith('audio/') ||
        /\.(wav|mp3|ogg|flac|aiff|aif|webm|m4a)$/i.test(f.name)
      );
    });

    if (audioFiles.length === 0) return;

    const newSamples: SampleItem[] = [];

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioEngine.decodeAudioData(arrayBuffer);
        const metrics = calculateAudioMetrics(audioBuffer);
        const pitchKey = detectPitchAndKey(audioBuffer);
        const autoSlices = detectAutoSlices(audioBuffer);
        const loopInfo = detectLoopVsOneShot(audioBuffer);
        const detectedGenre = classifyGenre(file.name, loopInfo.bpm, loopInfo.isLoop, 'other');

        const classification = classifySample(audioBuffer, file.name, metrics, pitchKey?.pitchHz || 0);

        const sampleType = classification.type;
        const epSlot = assignEp133Slot(sampleType, i);

        // Auto-Dossier Pro Standard
        const sampleItemStub: SampleItem = {
          id: `stub-${i}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          originalFileName: file.name,
          format: (file.name.split('.').pop()?.toLowerCase() || 'wav') as 'wav' | 'mp3' | 'ogg' | 'flac' | 'aiff' | 'webm' | 'm4a',
          size: file.size,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          bitDepth: 24,
          channels: audioBuffer.numberOfChannels,
          type: sampleType,
          category: autoSlices.length > 1 ? 'multi-sound' : loopInfo.isLoop ? 'loop' : 'one-shot',
          genre: detectedGenre,
          isLoop: loopInfo.isLoop,
          bpm: loopInfo.bpm || undefined,
          key: pitchKey?.keyString,
          tags: [...classification.tags, detectedGenre.split('/')[0].toLowerCase().trim()],
          folderId: 'f-root-oneshots',
          folderPath: '/01_ONE_SHOTS',
          favorite: false,
          rating: 4,
          spectralCentroid: metrics.spectralCentroid,
          dynamicRangeDb: metrics.dynamicRangeDb,
          peakDb: metrics.peakDb,
          rmsDb: metrics.rmsDb,
          zeroCrossingRate: metrics.zeroCrossingRate,
          lufs: metrics.lufs,
          loudnessGainDb: 0,
          blobUrl: '',
          slices: autoSlices,
          audioBuffer,
          dateAdded: Date.now(),
          isMultiSound: autoSlices.length > 1,
        };

        const { folderId, folderPath, category } = classifySampleToProFolder(sampleItemStub);

        const sampleItem: SampleItem = {
          id: `sample-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          originalFileName: file.name,
          format: (file.name.split('.').pop()?.toLowerCase() || 'wav') as 'wav' | 'mp3' | 'ogg' | 'flac' | 'aiff' | 'webm' | 'm4a',
          size: file.size,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          bitDepth: 24,
          channels: audioBuffer.numberOfChannels,
          type: sampleType,
          category,
          genre: detectedGenre,
          isLoop: loopInfo.isLoop,
          bpm: loopInfo.bpm || undefined,
          key: pitchKey?.keyString,
          tags: [...classification.tags, detectedGenre.split('/')[0].toLowerCase().trim()],
          folderId,
          folderPath,
          favorite: false,
          rating: 4,
          spectralCentroid: metrics.spectralCentroid,
          dynamicRangeDb: metrics.dynamicRangeDb,
          peakDb: metrics.peakDb,
          rmsDb: metrics.rmsDb,
          zeroCrossingRate: metrics.zeroCrossingRate,
          slices: autoSlices,
          blobUrl: URL.createObjectURL(file),
          audioBuffer,
          dateAdded: Date.now(),
          ep133Slot: epSlot,
          isMultiSound: autoSlices.length > 1,
          lufs: metrics.lufs,
          loudnessGainDb: 0,
        };

        newSamples.push(sampleItem);
      } catch (err) {
        console.error(`Error loading file ${file.name}:`, err);
      }
    }

    if (newSamples.length > 0) {
      setSamples((prev) => [...newSamples, ...prev]);
      setSelectedSampleId(newSamples[0].id);
      if (newSamples[0].audioBuffer) {
        audioEngine.play(newSamples[0].audioBuffer, newSamples[0].id, 0);
      }
    }
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImportFiles(e.dataTransfer.files);
    }
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
    setSamples(curatedSamples);
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

  const handleSaveProcessedAsNew = (newSample: SampleItem) => {
    setSamples((prev) => [newSample, ...prev]);
    setSelectedSampleId(newSample.id);
    if (newSample.audioBuffer) {
      audioEngine.play(newSample.audioBuffer, newSample.id, newSample.loudnessGainDb);
    }
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
          <h2 className="text-lg font-bold text-[#EDEDEE] tracking-tight">Déposez vos Samples ou Dossiers Audio</h2>
          <p className="text-xs font-mono text-[#00F0FF] mt-1">
            Décodage DSP, auto-triage BPM / Tonalité, égalisation LUFS & export EP-133 / OP-1
          </p>
        </div>
      )}

      {/* 1. TOP CLASSIC DAW MENU BAR */}
      <AppMenuBar
        onImportFiles={() => menuFileInputRef.current?.click()}
        onImportFolder={() => menuFolderInputRef.current?.click()}
        onImportOp1Patch={() => menuOp1InputRef.current?.click()}
        onOpenAutoCurator={() => setIsAutoCuratorOpen(true)}
        onOpenSmartIngest={() => setIsSmartIngestOpen(true)}
        onOpenBatchNaming={() => setIsBatchNamingOpen(true)}
        onOpenBatchConverter={() => setIsBatchConverterOpen(true)}
        onOpenDspAnalyzer={() => {
          setSampleForDsp(selectedSample);
          setIsDspModalOpen(true);
        }}
        onOpenFxRack={() => handleOpenFxRack()}
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
        samplesCount={samples.length}
      />

      {/* 2. COMPACT HEADER */}
      <Header
        searchQuery={filterState.searchQuery}
        onSearchChange={(q) => setFilterState((prev) => ({ ...prev, searchQuery: q }))}
        onImportFiles={handleImportFiles}
        onOpenSmartIngest={() => setIsSmartIngestOpen(true)}
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
        samplesCount={samples.length}
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
        />

        {/* Vertical Splitter Handle (Resize Sidebar Width with Mouse Drag) */}
        <div
          onMouseDown={handleStartSidebarResize}
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
                onMouseDown={handleStartWaveformResize}
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
        />
      )}

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
