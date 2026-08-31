import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SampleTable } from './components/SampleTable';
import { WaveformCanvas } from './components/WaveformCanvas';
import { TimbreMap } from './components/TimbreMap';
import { AudioPlayerBottomBar } from './components/AudioPlayerBottomBar';
import { AutoSlicerModal } from './components/AutoSlicerModal';
import { BatchConverterModal } from './components/BatchConverterModal';
import { AudioRecorderModal } from './components/AudioRecorderModal';
import { SmartIngestionModal } from './components/SmartIngestionModal';
import { MarketBenchmarkModal } from './components/MarketBenchmarkModal';
import { Op1KitBuilderModal } from './components/Op1KitBuilderModal';
import { GitHubSyncModal } from './components/GitHubSyncModal';
import { BatchNamingModal } from './components/BatchNamingModal';
import { AudioAnalysisModal } from './components/AudioAnalysisModal';
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
import { audioBufferToWavBlob, triggerFileDownload } from './services/audioConverter';

export default function App() {
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>(DEFAULT_FOLDERS);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<'library' | 'timbre'>('library');

  // Modals state
  const [slicerSample, setSlicerSample] = useState<SampleItem | null>(null);
  const [isBatchConverterOpen, setIsBatchConverterOpen] = useState<boolean>(false);
  const [isRecorderOpen, setIsRecorderOpen] = useState<boolean>(false);
  const [isSmartIngestOpen, setIsSmartIngestOpen] = useState<boolean>(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);
  const [isOp1StudioOpen, setIsOp1StudioOpen] = useState<boolean>(false);
  const [isGitHubSyncOpen, setIsGitHubSyncOpen] = useState<boolean>(false);
  const [isBatchNamingOpen, setIsBatchNamingOpen] = useState<boolean>(false);
  const [isDspModalOpen, setIsDspModalOpen] = useState<boolean>(false);
  const [sampleForDsp, setSampleForDsp] = useState<SampleItem | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [autoLoudnessLeveling, setAutoLoudnessLeveling] = useState<boolean>(
    audioEngine.isAutoLoudnessEnabled()
  );

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

  const selectedSample = useMemo(() => {
    return samples.find((s) => s.id === selectedSampleId) || filteredSamples[0] || null;
  }, [samples, selectedSampleId, filteredSamples]);

  // Global Keyboard Shortcuts (Spacebar to play/pause, Arrow keys to navigate)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        const st = audioEngine.getState();
        if (st.isPlaying) {
          audioEngine.pause();
        } else if (selectedSample && selectedSample.audioBuffer) {
          audioEngine.play(selectedSample.audioBuffer, selectedSample.id, selectedSample.loudnessGainDb);
        }
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (filteredSamples.length > 0) {
          const idx = filteredSamples.findIndex((s) => s.id === selectedSampleId);
          const nextIdx = (idx + 1) % filteredSamples.length;
          const nextSample = filteredSamples[nextIdx];
          setSelectedSampleId(nextSample.id);
          if (nextSample.audioBuffer) {
            audioEngine.play(nextSample.audioBuffer, nextSample.id, nextSample.loudnessGainDb);
          }
        }
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        if (filteredSamples.length > 0) {
          const idx = filteredSamples.findIndex((s) => s.id === selectedSampleId);
          const prevIdx = (idx - 1 + filteredSamples.length) % filteredSamples.length;
          const prevSample = filteredSamples[prevIdx];
          setSelectedSampleId(prevSample.id);
          if (prevSample.audioBuffer) {
            audioEngine.play(prevSample.audioBuffer, prevSample.id, prevSample.loudnessGainDb);
          }
        }
      } else if (e.key.toLowerCase() === 'l') {
        audioEngine.toggleLoop();
      } else if (e.key.toLowerCase() === 'r') {
        audioEngine.toggleReverse();
      } else if (e.key.toLowerCase() === 's' && selectedSample) {
        setSlicerSample(selectedSample);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredSamples, selectedSampleId, selectedSample]);

  // Toggle Auto-Loudness Leveling (EBU R128 -14 LUFS)
  const handleToggleAutoLoudness = () => {
    const nextState = !autoLoudnessLeveling;
    audioEngine.setAutoLoudness(nextState);
    setAutoLoudnessLeveling(nextState);
  };

  // Import audio files/folders with automatic DSP feature extraction
  const handleImportFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const audioFiles = files.filter(
        (f) =>
          f.type.startsWith('audio/') ||
          /\.(wav|mp3|ogg|flac|aiff|m4a|webm)$/i.test(f.name)
      );

      if (audioFiles.length === 0) return;

      const newSampleItems: SampleItem[] = [];

      for (const file of audioFiles) {
        try {
          const arrayBuf = await file.arrayBuffer();
          const buffer = await audioEngine.decodeAudioData(arrayBuf);
          const cleanName = file.name.replace(/\.[^/.]+$/, '');

          // DSP Analysis: Metrics, Pitch & Key, BPM, Loop vs One-Shot, Genre, EP-133 Slot
          const metrics = calculateAudioMetrics(buffer);
          const pitchKey = detectPitchAndKey(buffer);
          const loopAnalysis = detectLoopVsOneShot(buffer);
          const bpm = loopAnalysis.bpm || detectBpm(buffer);
          const slices = detectAutoSlices(buffer, { sensitivity: 0.5 });
          const classification = classifySample(buffer, cleanName, metrics, slices.length);
          const genre = classifyGenre(cleanName, bpm, loopAnalysis.isLoop, classification.type);
          const ep133Slot = assignEp133Slot(classification.type, loopAnalysis.isLoop, Math.floor(Math.random() * 80) + 1);

          // Loudness leveling gain computation
          const targetLufs = -14.0;
          const loudnessGainDb = Math.max(-12, Math.min(12, targetLufs - metrics.lufs));

          const wavBlob = audioBufferToWavBlob(buffer, { bitDepth: 24, normalize: true });
          const blobUrl = URL.createObjectURL(wavBlob);

          const item: SampleItem = {
            id: `user-sample-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            name: cleanName,
            originalFileName: file.name,
            format: (file.name.split('.').pop()?.toLowerCase() || 'wav') as SampleItem['format'],
            size: file.size,
            duration: buffer.duration,
            sampleRate: buffer.sampleRate,
            bitDepth: 24,
            channels: buffer.numberOfChannels,
            bpm,
            key: pitchKey?.keyString,
            musicalMode: pitchKey?.mode,
            confidence: pitchKey?.confidence,
            pitchHz: pitchKey?.pitchHz,
            type: classification.type,
            category: loopAnalysis.isLoop ? 'loop' : 'one-shot',
            genre,
            isLoop: loopAnalysis.isLoop,
            loopBars: loopAnalysis.estimatedBars,
            lufs: metrics.lufs,
            loudnessGainDb,
            ep133Slot,
            tags: [...classification.tags, genre.split(' ')[0]],
            folderId: 'f-drums',
            folderPath: '/Imported',
            favorite: false,
            rating: 3,
            spectralCentroid: metrics.spectralCentroid,
            dynamicRangeDb: metrics.dynamicRangeDb,
            peakDb: metrics.peakDb,
            rmsDb: metrics.rmsDb,
            zeroCrossingRate: metrics.zeroCrossingRate,
            slices,
            blobUrl,
            audioBuffer: buffer,
            dateAdded: Date.now(),
            isMultiSound: classification.isMultiSound,
          };

          newSampleItems.push(item);
        } catch (err) {
          console.error(`Error decoding audio file ${file.name}:`, err);
        }
      }

      if (newSampleItems.length > 0) {
        setSamples((prev) => [...newSampleItems, ...prev]);
        setSelectedSampleId(newSampleItems[0].id);
        if (newSampleItems[0].audioBuffer) {
          audioEngine.play(newSampleItems[0].audioBuffer, newSampleItems[0].id, newSampleItems[0].loudnessGainDb);
        }
      }
    },
    []
  );

  // Drag and drop handlers - Open Smart Ingestion modal for pro automated workflow
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
      // Open the smart ingestion pipeline modal for automatic analysis and leveling
      setIsSmartIngestOpen(true);
    }
  };

  // Export full EP-133 Sound Pack
  const handleExportEp133Pack = () => {
    const listToExport = filteredSamples.length > 0 ? filteredSamples : samples;
    const epSummary = listToExport.map((s) => ({
      slot: s.ep133Slot ? String(s.ep133Slot).padStart(3, '0') : '999',
      name: s.name,
      type: s.type,
      category: s.isLoop ? 'LOOP' : 'ONE-SHOT',
      bpm: s.bpm || 'Free',
      key: s.key || 'N/A',
      lufs: s.lufs?.toFixed(1) || '-14.0',
      sampleRate: '46.875 kHz (Native EP-133)',
      bitDepth: '16-bit PCM Linear',
    }));

    const jsonBlob = new Blob([JSON.stringify(epSummary, null, 2)], {
      type: 'application/json',
    });
    triggerFileDownload(jsonBlob, 'EP133_KO_II_Sample_Bank_Map.json');
  };

  // Sample management callbacks
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
    setSelectedSampleIds((prev) => prev.filter((id) => id !== sampleId));
    if (selectedSampleId === sampleId) {
      setSelectedSampleId(null);
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

  const handleExtractSlicesToLibrary = (newSamples: SampleItem[]) => {
    setSamples((prev) => [...newSamples, ...prev]);
  };

  const handleApplyBatchRename = (updatedSamples: SampleItem[]) => {
    setSamples(updatedSamples);
  };

  const handleUpdateSampleFromDsp = (updatedSample: SampleItem) => {
    setSamples((prev) =>
      prev.map((s) => (s.id === updatedSample.id ? updatedSample : s))
    );
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
      {/* Drag & Drop Fullscreen Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-[#0A0A0B]/90 backdrop-blur-md border-2 border-dashed border-[#00F0FF] flex flex-col items-center justify-center pointer-events-none animate-in fade-in">
          <div className="w-16 h-16 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] mb-4 animate-bounce">
            <span className="text-3xl font-extrabold">+</span>
          </div>
          <h2 className="text-lg font-bold text-[#EDEDEE] tracking-tight">Déposez vos Samples ou Dossiers Audio</h2>
          <p className="text-xs font-mono text-[#00F0FF] mt-1">
            Décodage DSP, auto-triage BPM / Tonalité, égalisation LUFS & export EP-133
          </p>
        </div>
      )}

      {/* Header */}
      <Header
        searchQuery={filterState.searchQuery}
        onSearchChange={(q) => setFilterState((prev) => ({ ...prev, searchQuery: q }))}
        onImportFiles={handleImportFiles}
        onOpenSmartIngest={() => setIsSmartIngestOpen(true)}
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
        autoLoudnessLeveling={autoLoudnessLeveling}
        onToggleAutoLoudness={handleToggleAutoLoudness}
        samplesCount={samples.length}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          folders={folders}
          samples={samples}
          filterState={filterState}
          onFilterChange={(newF) => setFilterState((prev) => ({ ...prev, ...newF }))}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onOpenRecorder={() => setIsRecorderOpen(true)}
          onOpenOp1Studio={() => setIsOp1StudioOpen(true)}
          onOpenGitHubSync={() => setIsGitHubSyncOpen(true)}
          activeView={activeView}
          onViewChange={setActiveView}
        />

        {/* Center Content Pane */}
        <main className="flex-1 flex flex-col p-3 overflow-hidden gap-3 studio-grid-bg">
          {activeView === 'library' ? (
            <>
              {/* Top Waveform Visualizer for Selected Sample */}
              {selectedSample ? (
                <WaveformCanvas
                  sample={selectedSample}
                  onOpenSlicer={() => setSlicerSample(selectedSample)}
                />
              ) : (
                <div className="h-44 bg-[#111114] rounded-xl border border-[#222226] flex items-center justify-center text-xs font-mono text-[#8E8E93]">
                  Sélectionnez un sample pour inspecter son onde, ses transitoires et ses découpes
                </div>
              )}

              {/* Sample Table */}
              <SampleTable
                samples={filteredSamples}
                selectedSampleId={selectedSampleId}
                onSelectSample={(s) => setSelectedSampleId(s.id)}
                onOpenSlicerForSample={(s) => setSlicerSample(s)}
                onOpenDspForSample={(s) => {
                  setSampleForDsp(s);
                  setIsDspModalOpen(true);
                }}
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

      {/* Bottom Transport Master Player */}
      <AudioPlayerBottomBar
        currentSample={selectedSample}
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
          onExtractSlicesToLibrary={handleExtractSlicesToLibrary}
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
    </div>
  );
}

