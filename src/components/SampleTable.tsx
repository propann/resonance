import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowUpDown,
  Disc,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { SampleItem, FilterState } from '../types/sample';
import { audioEngine } from '../services/audioEngine';
import { audioBufferToWavBlob, triggerFileDownload } from '../services/audioConverter';
import { loadSampleAudio, peekSampleAudio } from '../services/sampleAudio';
import type { LibraryRoot } from '../services/localLibrary';
import { SampleRow } from './SampleRow';
import { openSampleModal } from '../stores/sampleTargetStore';
import {
  DEFAULT_COLUMN_WIDTHS,
  MIN_COLUMN_WIDTHS,
  ROW_HEIGHT,
  visibleRowRange,
  type ColumnWidths,
} from './sampleTableColumns';

interface SampleTableProps {
  samples: SampleItem[];
  selectedSampleId: string | null;
  onSelectSample: (sample: SampleItem) => void;
  onToggleFavorite: (sampleId: string) => void;
  onDeleteSample: (sampleId: string) => void;
  filterState: FilterState;
  onFilterChange: (newFilter: Partial<FilterState>) => void;
  selectedSampleIds: string[];
  onToggleSelectSample: (sampleId: string) => void;
  onSelectAllSamples: (select: boolean) => void;
  /** Needed to read a row's file: rows arrive from the manifest without audio. */
  libraryRoot: LibraryRoot | null;
}

export const SampleTable: React.FC<SampleTableProps> = ({
  samples,
  selectedSampleId,
  onSelectSample,
  onToggleFavorite,
  onDeleteSample,
  filterState,
  onFilterChange,
  selectedSampleIds,
  onToggleSelectSample,
  onSelectAllSamples,
  libraryRoot,
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

  // Row windowing: 400+ samples must not mean 400+ mounted rows (each one
  // carries a canvas waveform). Only the rows in view plus an overscan margin
  // are rendered; spacer divs above and below keep the scrollbar honest.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sync = () => {
      setScrollTop(el.scrollTop);
      setViewportHeight(el.clientHeight);
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', sync);
      observer.disconnect();
    };
  }, []);

  const { first: firstVisible, last: lastVisible } = visibleRowRange(
    scrollTop,
    viewportHeight,
    samples.length
  );

  // Set lookup: `includes` on the selection array once per rendered row was
  // O(rows x selection).
  const checkedIds = useMemo(() => new Set(selectedSampleIds), [selectedSampleIds]);

  // With only the visible rows mounted, a selection made elsewhere (the
  // restored last sample, a modal, the explorer) has to be scrolled to.
  const revealedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !selectedSampleId || revealedIdRef.current === selectedSampleId) return;
    const index = samples.findIndex((s) => s.id === selectedSampleId);
    if (index < 0) return;
    revealedIdRef.current = selectedSampleId;
    const top = index * ROW_HEIGHT;
    // Leave it alone when the row is already on screen: no jump on a click.
    if (top >= el.scrollTop && top + ROW_HEIGHT <= el.scrollTop + el.clientHeight) return;
    el.scrollTop = Math.max(0, top - el.clientHeight / 2 + ROW_HEIGHT / 2);
  }, [selectedSampleId, samples]);

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

  const handlePlaySample = useCallback(
    async (e: React.MouseEvent, sample: SampleItem) => {
      e.stopPropagation();

      if (audioEngine.getState().isPlaying && audioEngine.getState().sampleId === sample.id) {
        audioEngine.stop();
        setPlayingId(null);
        return;
      }

      onSelectSample(sample);
      // A row almost never carries its own audio — library entries are hydrated
      // from the manifest without any. This used to be `if (!sample.audioBuffer)
      // return`, so the button silently did nothing for every sample on disk.
      const buffer = await loadSampleAudio(libraryRoot, sample);
      if (!buffer) return;
      audioEngine.play(buffer, sample.id);
    },
    [onSelectSample, libraryRoot]
  );

  const handleDownloadSingleWav = useCallback(
    async (e: React.MouseEvent, sample: SampleItem) => {
      e.stopPropagation();
      const buffer = await loadSampleAudio(libraryRoot, sample);
      if (!buffer) return;
      const blob = audioBufferToWavBlob(buffer, {
        bitDepth: 24,
        normalize: true,
        targetPeakDb: -0.2,
      });
      triggerFileDownload(blob, `${sample.name}_24bit.wav`);
    },
    [libraryRoot]
  );

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
          {(
            <button
              onClick={() => {
                const target = samples.find((s) => s.id === selectedSampleId) || samples[0];
                if (target) openSampleModal('loudness', target);
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

      {/* Table Rows Container — windowed: only the visible rows are mounted */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar"
      >
        {samples.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-[#8E8E93] text-xs font-pixel space-y-2">
            <Disc className="w-8 h-8 text-[#5A5A62] animate-spin" style={{ animationDuration: '6s' }} />
            <span>AUCUN SAMPLE TROUVÉ</span>
          </div>
        ) : (
          <>
            <div style={{ height: `${firstVisible * ROW_HEIGHT}px` }} />
            {samples.slice(firstVisible, lastVisible).map((sample) => (
              <SampleRow
                key={sample.id}
                sample={sample}
                audioBuffer={peekSampleAudio(sample)}
                colWidths={colWidths}
                isSelected={selectedSampleId === sample.id}
                isPlaying={playingId === sample.id}
                isChecked={checkedIds.has(sample.id)}
                playbackProgress={playbackProgress}
                onSelectSample={onSelectSample}
                onToggleFavorite={onToggleFavorite}
                onDeleteSample={onDeleteSample}
                onToggleSelectSample={onToggleSelectSample}
                onPlaySample={handlePlaySample}
                onDownloadWav={handleDownloadSingleWav}
              />
            ))}
            <div style={{ height: `${(samples.length - lastVisible) * ROW_HEIGHT}px` }} />
          </>
        )}
      </div>
    </div>
  );
};
