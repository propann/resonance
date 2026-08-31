import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Star,
  Scissors,
  Download,
  Trash2,
  FileCode2,
  Sparkles,
  ArrowUpDown,
  MoreVertical,
  Check,
  Disc,
  Activity,
  FolderTree,
  Flame,
  ShieldCheck,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { SampleItem, SampleType, FilterState } from '../types/sample';
import { audioEngine } from '../services/audioEngine';
import { audioBufferToWavBlob, triggerFileDownload } from '../services/audioConverter';
import { MiniWaveform } from './MiniWaveform';

export interface ColumnWidths {
  select: number;
  wave: number;
  name: number;
  type: number;
  key: number;
  genre: number;
  lufs: number;
  tools: number;
}

const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  select: 55,
  wave: 125,
  name: 240,
  type: 130,
  key: 95,
  genre: 110,
  lufs: 90,
  tools: 155,
};

const MIN_COLUMN_WIDTHS: ColumnWidths = {
  select: 45,
  wave: 70,
  name: 120,
  type: 80,
  key: 60,
  genre: 70,
  lufs: 65,
  tools: 110,
};

interface SampleTableProps {
  samples: SampleItem[];
  selectedSampleId: string | null;
  onSelectSample: (sample: SampleItem) => void;
  onOpenSlicerForSample: (sample: SampleItem) => void;
  onOpenDspAnalyzer?: (sample: SampleItem) => void;
  onOpenFxRack?: (sample: SampleItem) => void;
  onOpenLoudnessStandard?: (sample: SampleItem) => void;
  onOpenBatchNaming?: () => void;
  onToggleFavorite: (sampleId: string) => void;
  onSetRating: (sampleId: string, rating: number) => void;
  onDeleteSample: (sampleId: string) => void;
  filterState: FilterState;
  onFilterChange: (newFilter: Partial<FilterState>) => void;
  selectedSampleIds: string[];
  onToggleSelectSample: (sampleId: string) => void;
  onSelectAllSamples: (select: boolean) => void;
}

const TYPE_BADGES: Record<SampleType, { bg: string; text: string; label: string }> = {
  kick: { bg: 'bg-[#00F0FF]/10 border-[#00F0FF]/30', text: 'text-[#00F0FF]', label: 'Kick' },
  '808': { bg: 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30', text: 'text-[#8B5CF6]', label: '808' },
  snare: { bg: 'bg-[#EF4444]/10 border-[#EF4444]/30', text: 'text-[#EF4444]', label: 'Snare' },
  hihat: { bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/30', text: 'text-[#F59E0B]', label: 'Hi-Hat' },
  clap: { bg: 'bg-[#F97316]/10 border-[#F97316]/30', text: 'text-[#F97316]', label: 'Clap' },
  cymbal: { bg: 'bg-[#EAB308]/10 border-[#EAB308]/30', text: 'text-[#EAB308]', label: 'Cymbal' },
  percussion: { bg: 'bg-[#14B8A6]/10 border-[#14B8A6]/30', text: 'text-[#14B8A6]', label: 'Perc' },
  bass: { bg: 'bg-[#7C3AED]/10 border-[#7C3AED]/30', text: 'text-[#A78BFA]', label: 'Bass' },
  lead: { bg: 'bg-[#3B82F6]/10 border-[#3B82F6]/30', text: 'text-[#60A5FA]', label: 'Lead' },
  pad: { bg: 'bg-[#EC4899]/10 border-[#EC4899]/30', text: 'text-[#F472B6]', label: 'Pad' },
  vocal: { bg: 'bg-[#D946EF]/10 border-[#D946EF]/30', text: 'text-[#E879F9]', label: 'Vocal' },
  fx: { bg: 'bg-[#6366F1]/10 border-[#6366F1]/30', text: 'text-[#818CF8]', label: 'FX' },
  loop: { bg: 'bg-[#10B981]/10 border-[#10B981]/30', text: 'text-[#34D399]', label: 'Loop' },
  'multi-sound': { bg: 'bg-[#00F0FF]/15 border-[#00F0FF]/40', text: 'text-[#00F0FF]', label: 'Multi-Stem' },
  other: { bg: 'bg-[#18181D] border-[#26262B]', text: 'text-[#8E8E93]', label: 'Sample' },
};

export const SampleTable: React.FC<SampleTableProps> = ({
  samples,
  selectedSampleId,
  onSelectSample,
  onOpenSlicerForSample,
  onOpenDspAnalyzer,
  onOpenFxRack,
  onOpenLoudnessStandard,
  onOpenBatchNaming,
  onToggleFavorite,
  onSetRating,
  onDeleteSample,
  filterState,
  onFilterChange,
  selectedSampleIds,
  onToggleSelectSample,
  onSelectAllSamples,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);

  // Colonnes redimensionnables comme un tableur
  const [colWidths, setColWidths] = useState<ColumnWidths>(() => {
    try {
      const saved = localStorage.getItem('resonance_sample_table_col_widths_v2');
      if (saved) {
        return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) };
      }
    } catch (e) {
      // Ignorer
    }
    return DEFAULT_COLUMN_WIDTHS;
  });

  const [activeResizingCol, setActiveResizingCol] = useState<keyof ColumnWidths | null>(null);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);

  // Sauvegarde des largeurs
  useEffect(() => {
    try {
      localStorage.setItem('resonance_sample_table_col_widths_v2', JSON.stringify(colWidths));
    } catch (e) {
      // Ignorer
    }
  }, [colWidths]);

  // Gestionnaire de redimensionnement de colonne (Spreadsheet resize handler)
  const handleStartResize = (e: React.MouseEvent, colKey: keyof ColumnWidths) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveResizingCol(colKey);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = colWidths[colKey];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - resizeStartXRef.current;
      const minW = MIN_COLUMN_WIDTHS[colKey] || 50;
      const newWidth = Math.max(minW, resizeStartWidthRef.current + deltaX);

      setColWidths((prev) => ({
        ...prev,
        [colKey]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setActiveResizingCol(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Double-clic sur le resizer pour reset la colonne
  const handleResetColWidth = (colKey: keyof ColumnWidths) => {
    setColWidths((prev) => ({
      ...prev,
      [colKey]: DEFAULT_COLUMN_WIDTHS[colKey],
    }));
  };

  // Reset toutes les colonnes
  const handleResetAllCols = () => {
    setColWidths(DEFAULT_COLUMN_WIDTHS);
  };

  // Subscribe to audio engine playback state
  useEffect(() => {
    const unsub = audioEngine.subscribe((state) => {
      setPlayingId(state.isPlaying ? state.sampleId : null);
      const prog = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
      setPlaybackProgress(prog);
    });
    return () => unsub();
  }, []);

  const handlePlaySample = (e: React.MouseEvent, sample: SampleItem) => {
    e.stopPropagation();
    if (!sample.audioBuffer) return;

    if (playingId === sample.id) {
      audioEngine.stop();
      setPlayingId(null);
    } else {
      onSelectSample(sample);
      audioEngine.play(sample.audioBuffer, sample.id);
    }
  };

  const handleDownloadSingleWav = (e: React.MouseEvent, sample: SampleItem) => {
    e.stopPropagation();
    if (!sample.audioBuffer) return;
    const blob = audioBufferToWavBlob(sample.audioBuffer, {
      bitDepth: 24,
      normalize: true,
      targetPeakDb: -0.2,
    });
    triggerFileDownload(blob, `${sample.name}_24bit.wav`);
  };

  const isAllSelected = samples.length > 0 && selectedSampleIds.length === samples.length;

  const handleSort = (field: FilterState['sortField']) => {
    if (filterState.sortField === field) {
      onFilterChange({
        sortDirection: filterState.sortDirection === 'asc' ? 'desc' : 'asc',
      });
    } else {
      onFilterChange({
        sortField: field,
        sortDirection: 'asc',
      });
    }
  };

  return (
    <div id="sample-table-container" className="flex-1 flex flex-col bg-[#0A0A0E] border-2 border-[#1E1E26] overflow-hidden select-none pixel-box">
      {/* Table Top Controls & Info Bar */}
      <div className="bg-[#0E0E14] border-b border-[#1E1E26] px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-[#8E8E98]">
        <div className="flex items-center gap-3">
          <span className="text-[#00F0FF] font-bold">
            {samples.length} sample{samples.length > 1 ? 's' : ''}
          </span>
          {selectedSampleIds.length > 0 && (
            <span className="bg-[#00F0FF]/15 text-[#00F0FF] px-1.5 py-0.5 rounded border border-[#00F0FF]/30">
              {selectedSampleIds.length} sélectionné{selectedSampleIds.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="hidden sm:inline text-[#5A5A68]">
            | Glissez les séparateurs pour redimensionner les colonnes comme un tableur
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenLoudnessStandard && (
            <button
              onClick={() => {
                const target = samples.find((s) => s.id === selectedSampleId) || samples[0];
                if (target) onOpenLoudnessStandard(target);
              }}
              className="px-2 py-0.5 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/25 text-[#00F0FF] border border-[#00F0FF]/40 rounded text-[10px] flex items-center gap-1 transition-colors"
              title="Ouvrir l'étalon international de normalisation sonore"
            >
              <ShieldCheck className="w-3 h-3" />
              <span>ÉTALON ITU-R BS.1770</span>
            </button>
          )}

          <button
            onClick={handleResetAllCols}
            className="p-1 hover:text-white text-[#8E8E98] hover:bg-[#1E1E28] rounded border border-transparent hover:border-[#333348] transition-colors"
            title="Réinitialiser la largeur des colonnes"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Spreadsheet-like Resizable Table Header */}
      <div className="bg-[#121218] border-b-2 border-[#1E1E26] text-[#8E8E93] text-[9px] font-pixel uppercase tracking-wide flex items-center select-none overflow-x-auto custom-scrollbar">
        {/* Column 1: Checkbox & Play */}
        <div
          style={{ width: `${colWidths.select}px`, minWidth: `${colWidths.select}px` }}
          className="relative px-2 py-2 flex items-center gap-1.5 flex-shrink-0 border-r border-[#1E1E28]"
        >
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={(e) => onSelectAllSamples(e.target.checked)}
            className="rounded-none border-[#333344] text-[#00F0FF] focus:ring-0 w-3 h-3 bg-[#000000] accent-[#00F0FF] cursor-pointer"
          />
          <span className="truncate">PLAY</span>
          <div
            onMouseDown={(e) => handleStartResize(e, 'select')}
            onDoubleClick={() => handleResetColWidth('select')}
            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00F0FF] transition-colors z-10 ${
              activeResizingCol === 'select' ? 'bg-[#00F0FF]' : ''
            }`}
            title="Double-clic pour réinitialiser"
          />
        </div>

        {/* Column 2: Mini Waveform */}
        <div
          style={{ width: `${colWidths.wave}px`, minWidth: `${colWidths.wave}px` }}
          className="relative px-2 py-2 flex items-center flex-shrink-0 border-r border-[#1E1E28]"
        >
          <span className="truncate">ONDE</span>
          <div
            onMouseDown={(e) => handleStartResize(e, 'wave')}
            onDoubleClick={() => handleResetColWidth('wave')}
            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00F0FF] transition-colors z-10 ${
              activeResizingCol === 'wave' ? 'bg-[#00F0FF]' : ''
            }`}
            title="Double-clic pour réinitialiser"
          />
        </div>

        {/* Column 3: Name */}
        <div
          style={{ width: `${colWidths.name}px`, minWidth: `${colWidths.name}px` }}
          className="relative px-2 py-2 flex items-center gap-1 cursor-pointer hover:text-[#00F0FF] flex-shrink-0 border-r border-[#1E1E28]"
          onClick={() => handleSort('name')}
        >
          <span className="truncate">NOM DU FICHIER</span>
          <ArrowUpDown className="w-2.5 h-2.5 flex-shrink-0" />
          <div
            onMouseDown={(e) => handleStartResize(e, 'name')}
            onDoubleClick={() => handleResetColWidth('name')}
            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00F0FF] transition-colors z-10 ${
              activeResizingCol === 'name' ? 'bg-[#00F0FF]' : ''
            }`}
            title="Double-clic pour réinitialiser"
          />
        </div>

        {/* Column 4: Type */}
        <div
          style={{ width: `${colWidths.type}px`, minWidth: `${colWidths.type}px` }}
          className="relative px-2 py-2 flex items-center gap-1 cursor-pointer hover:text-[#00F0FF] flex-shrink-0 border-r border-[#1E1E28]"
          onClick={() => handleSort('type')}
        >
          <span className="truncate">TYPE</span>
          <ArrowUpDown className="w-2.5 h-2.5 flex-shrink-0" />
          <div
            onMouseDown={(e) => handleStartResize(e, 'type')}
            onDoubleClick={() => handleResetColWidth('type')}
            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00F0FF] transition-colors z-10 ${
              activeResizingCol === 'type' ? 'bg-[#00F0FF]' : ''
            }`}
            title="Double-clic pour réinitialiser"
          />
        </div>

        {/* Column 5: Key / BPM */}
        <div
          style={{ width: `${colWidths.key}px`, minWidth: `${colWidths.key}px` }}
          className="relative px-2 py-2 flex items-center gap-1 cursor-pointer hover:text-[#00F0FF] flex-shrink-0 border-r border-[#1E1E28]"
          onClick={() => handleSort('key')}
        >
          <span className="truncate">KEY/BPM</span>
          <ArrowUpDown className="w-2.5 h-2.5 flex-shrink-0" />
          <div
            onMouseDown={(e) => handleStartResize(e, 'key')}
            onDoubleClick={() => handleResetColWidth('key')}
            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00F0FF] transition-colors z-10 ${
              activeResizingCol === 'key' ? 'bg-[#00F0FF]' : ''
            }`}
            title="Double-clic pour réinitialiser"
          />
        </div>

        {/* Column 6: Genre */}
        <div
          style={{ width: `${colWidths.genre}px`, minWidth: `${colWidths.genre}px` }}
          className="relative px-2 py-2 flex items-center flex-shrink-0 border-r border-[#1E1E28]"
        >
          <span className="truncate">GENRE</span>
          <div
            onMouseDown={(e) => handleStartResize(e, 'genre')}
            onDoubleClick={() => handleResetColWidth('genre')}
            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00F0FF] transition-colors z-10 ${
              activeResizingCol === 'genre' ? 'bg-[#00F0FF]' : ''
            }`}
            title="Double-clic pour réinitialiser"
          />
        </div>

        {/* Column 7: LUFS */}
        <div
          style={{ width: `${colWidths.lufs}px`, minWidth: `${colWidths.lufs}px` }}
          className="relative px-2 py-2 flex items-center flex-shrink-0 border-r border-[#1E1E28]"
        >
          <span className="truncate">LUFS / ÉTALON</span>
          <div
            onMouseDown={(e) => handleStartResize(e, 'lufs')}
            onDoubleClick={() => handleResetColWidth('lufs')}
            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00F0FF] transition-colors z-10 ${
              activeResizingCol === 'lufs' ? 'bg-[#00F0FF]' : ''
            }`}
            title="Double-clic pour réinitialiser"
          />
        </div>

        {/* Column 8: Tools */}
        <div
          style={{ width: `${colWidths.tools}px`, minWidth: `${colWidths.tools}px` }}
          className="relative px-2 py-2 flex items-center justify-end pr-2 flex-shrink-0"
        >
          <span className="truncate">OUTILS</span>
          <div
            onMouseDown={(e) => handleStartResize(e, 'tools')}
            onDoubleClick={() => handleResetColWidth('tools')}
            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#00F0FF] transition-colors z-10 ${
              activeResizingCol === 'tools' ? 'bg-[#00F0FF]' : ''
            }`}
            title="Double-clic pour réinitialiser"
          />
        </div>
      </div>

      {/* Table Rows Container */}
      <div className="flex-1 overflow-y-auto overflow-x-auto divide-y-2 divide-[#14141C] custom-scrollbar">
        {samples.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-[#8E8E93] text-xs font-pixel space-y-2">
            <Disc className="w-8 h-8 text-[#5A5A62] animate-spin" style={{ animationDuration: '6s' }} />
            <span>AUCUN SAMPLE TROUVÉ</span>
          </div>
        ) : (
          samples.map((sample) => {
            const isSelected = selectedSampleId === sample.id;
            const isPlaying = playingId === sample.id;
            const isChecked = selectedSampleIds.includes(sample.id);
            const badge = TYPE_BADGES[sample.type] || TYPE_BADGES.other;

            return (
              <div
                key={sample.id}
                id={`sample-row-${sample.id}`}
                onClick={() => onSelectSample(sample)}
                className={`flex items-center text-xs transition select-none cursor-pointer group min-w-max ${
                  isSelected
                    ? 'bg-[#00F0FF]/15 border-l-4 border-[#00F0FF]'
                    : 'hover:bg-[#12121A]'
                }`}
              >
                {/* 1. Select Checkbox & Play Button */}
                <div
                  style={{ width: `${colWidths.select}px`, minWidth: `${colWidths.select}px` }}
                  className="px-2 py-1.5 flex items-center gap-1.5 flex-shrink-0"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleSelectSample(sample.id);
                    }}
                    className="rounded-none border-[#333344] text-[#00F0FF] focus:ring-0 w-3 h-3 bg-[#000000] accent-[#00F0FF] cursor-pointer"
                  />
                  <button
                    onClick={(e) => handlePlaySample(e, sample)}
                    className={`w-5 h-5 flex items-center justify-center transition border pixel-btn flex-shrink-0 ${
                      isPlaying
                        ? 'bg-[#FFE600] text-black font-bold border-[#FFE600]'
                        : 'bg-[#14141C] hover:bg-[#1E1E28] text-[#00F0FF] border-[#2A2A3A]'
                    }`}
                  >
                    {isPlaying ? (
                      <Pause className="w-2.5 h-2.5 fill-current" />
                    ) : (
                      <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                    )}
                  </button>
                </div>

                {/* 2. Mini Waveform Visualizer */}
                <div
                  style={{ width: `${colWidths.wave}px`, minWidth: `${colWidths.wave}px` }}
                  className="px-2 py-1.5 flex-shrink-0"
                >
                  <MiniWaveform
                    audioBuffer={sample.audioBuffer}
                    sampleId={sample.id}
                    type={sample.type}
                    isPlaying={isPlaying}
                    progress={isPlaying ? playbackProgress : 0}
                    width={Math.max(60, colWidths.wave - 16)}
                    height={22}
                    slices={sample.slices}
                    onClick={(e) => handlePlaySample(e, sample)}
                  />
                </div>

                {/* 3. Name & Multi-sound slices tag */}
                <div
                  style={{ width: `${colWidths.name}px`, minWidth: `${colWidths.name}px` }}
                  className="px-2 py-1.5 flex items-center gap-1.5 truncate flex-shrink-0"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(sample.id);
                    }}
                    className="text-[#5A5A62] hover:text-[#FFE600] transition flex-shrink-0"
                  >
                    <Star
                      className={`w-3 h-3 ${
                        sample.favorite ? 'fill-[#FFE600] text-[#FFE600]' : ''
                      }`}
                    />
                  </button>

                  <span className="font-pixel text-[10px] text-[#EDEDEE] truncate group-hover:text-[#00F0FF] transition">
                    {sample.name}
                  </span>

                  {sample.isMultiSound && (
                    <span className="px-1 py-0.2 text-[8px] font-pixel bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40 flex items-center gap-0.5 flex-shrink-0">
                      <Scissors className="w-2 h-2" />
                      <span>{sample.slices?.length || 1}</span>
                    </span>
                  )}
                </div>

                {/* 4. Category & Type Badge */}
                <div
                  style={{ width: `${colWidths.type}px`, minWidth: `${colWidths.type}px` }}
                  className="px-2 py-1.5 flex items-center gap-1 flex-wrap flex-shrink-0"
                >
                  {sample.isLoop ? (
                    <span className="px-1 py-0.2 text-[8px] font-pixel bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/40">
                      LOOP
                    </span>
                  ) : (
                    <span className="px-1 py-0.2 text-[8px] font-pixel bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30">
                      1-SHOT
                    </span>
                  )}
                  <span
                    className={`px-1 py-0.2 text-[8px] font-pixel border uppercase ${badge.bg} ${badge.text}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* 5. Musical Key & BPM */}
                <div
                  style={{ width: `${colWidths.key}px`, minWidth: `${colWidths.key}px` }}
                  className="px-2 py-1.5 font-pixel flex flex-col gap-0.5 text-[9px] flex-shrink-0"
                >
                  {sample.key ? (
                    <span className="text-[#FFE600]">
                      {sample.key}
                    </span>
                  ) : null}
                  {sample.bpm ? (
                    <span className="text-[#34D399]">{sample.bpm} BPM</span>
                  ) : (
                    !sample.key && <span className="text-[#5A5A62]">—</span>
                  )}
                </div>

                {/* 6. Genre */}
                <div
                  style={{ width: `${colWidths.genre}px`, minWidth: `${colWidths.genre}px` }}
                  className="px-2 py-1.5 truncate text-[9px] font-pixel text-[#8E8E93] flex-shrink-0"
                >
                  <span>{sample.genre?.split('/')[0] || 'Universal'}</span>
                </div>

                {/* 7. Loudness LUFS & Étalon Status */}
                <div
                  style={{ width: `${colWidths.lufs}px`, minWidth: `${colWidths.lufs}px` }}
                  className="px-2 py-1.5 font-pixel text-[9px] flex-shrink-0 flex items-center gap-1"
                >
                  <div className={sample.lufs && sample.lufs > -10 ? 'text-[#FFE600]' : 'text-[#EDEDEE]'}>
                    {sample.lufs ? `${sample.lufs.toFixed(0)} LUF` : `${(sample.rmsDb || -14).toFixed(0)} dB`}
                  </div>
                  {sample.lufs && Math.abs(sample.lufs - (-14)) <= 1.0 && (
                    <span className="text-[8px] text-[#10B981]" title="Conforme Étalon Streaming -14 LUFS">
                      ✓
                    </span>
                  )}
                </div>

                {/* 8. Quick Action Tools */}
                <div
                  style={{ width: `${colWidths.tools}px`, minWidth: `${colWidths.tools}px` }}
                  className="px-2 py-1.5 flex items-center justify-end gap-1 flex-shrink-0"
                >
                  {/* Étalon Loudness Button */}
                  {onOpenLoudnessStandard && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenLoudnessStandard(sample);
                      }}
                      className="p-1 bg-[#10B981]/15 hover:bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/40 pixel-btn"
                      title="Calibrer selon l'Étalon Officiel (ITU-R BS.1770 / EBU R128)"
                    >
                      <ShieldCheck className="w-2.5 h-2.5" />
                    </button>
                  )}

                  {/* DSP FX Rack & Pitch Transposer Button */}
                  {onOpenFxRack && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFxRack(sample);
                      }}
                      className="p-1 bg-[#00F0FF]/15 hover:bg-[#00F0FF]/30 text-[#00F0FF] border border-[#00F0FF]/40 pixel-btn"
                      title="Rack FX, Transposition de Note & DSP"
                    >
                      <Flame className="w-2.5 h-2.5" />
                    </button>
                  )}

                  {/* DSP Audio Analysis Button */}
                  {onOpenDspAnalyzer && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDspAnalyzer(sample);
                      }}
                      className="p-1 bg-[#A855F7]/15 hover:bg-[#A855F7]/30 text-[#A855F7] border border-[#A855F7]/40 pixel-btn"
                      title="DSP Lab"
                    >
                      <Activity className="w-2.5 h-2.5" />
                    </button>
                  )}

                  {/* Découpe Auto Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSlicerForSample(sample);
                    }}
                    className="p-1 bg-[#00F0FF]/15 hover:bg-[#00F0FF]/30 text-[#00F0FF] border border-[#00F0FF]/40 pixel-btn"
                    title="Découpe"
                  >
                    <Scissors className="w-2.5 h-2.5" />
                  </button>

                  {/* Export Single WAV */}
                  <button
                    onClick={(e) => handleDownloadSingleWav(e, sample)}
                    className="p-1 bg-[#14141C] hover:bg-[#1E1E28] text-[#EDEDEE] border border-[#26262B] pixel-btn"
                    title="Télécharger WAV"
                  >
                    <Download className="w-2.5 h-2.5" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSample(sample.id);
                    }}
                    className="p-1 text-[#5A5A62] hover:text-[#EF4444] pixel-btn"
                    title="Supprimer"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
