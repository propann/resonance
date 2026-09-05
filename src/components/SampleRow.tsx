import React from 'react';
import { Activity, Download, Flame, Pause, Play, Scissors, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { SampleItem } from '../types/sample';
import { MiniWaveform } from './MiniWaveform';
import { openSampleModal } from '../stores/sampleTargetStore';
import { ROW_HEIGHT, TYPE_BADGES, type ColumnWidths } from './sampleTableColumns';

interface SampleRowProps {
  sample: SampleItem;
  /**
   * The row's decoded audio when it happens to be cached — the manifest gives
   * rows no audio of their own. Passed in rather than read here so that a
   * decode landing changes a prop, which is what gets past `React.memo`.
   */
  audioBuffer?: AudioBuffer;
  colWidths: ColumnWidths;
  isSelected: boolean;
  isPlaying: boolean;
  isChecked: boolean;
  /** Playback position 0-100, only meaningful while this row is playing. */
  playbackProgress: number;
  onSelectSample: (sample: SampleItem) => void;
  onToggleFavorite: (sampleId: string) => void;
  onDeleteSample: (sampleId: string) => void;
  onToggleSelectSample: (sampleId: string) => void;
  onPlaySample: (e: React.MouseEvent, sample: SampleItem) => void;
  onDownloadWav: (e: React.MouseEvent, sample: SampleItem) => void;
}

/**
 * One row of the sample table. Memoized: the table renders only the rows in
 * view, and a scroll must not re-render the rows that stayed put.
 */
export const SampleRow = React.memo(function SampleRow({
  sample,
  audioBuffer,
  colWidths,
  isSelected,
  isPlaying,
  isChecked,
  playbackProgress,
  onSelectSample,
  onToggleFavorite,
  onDeleteSample,
  onToggleSelectSample,
  onPlaySample,
  onDownloadWav,
}: SampleRowProps) {
  const badge = TYPE_BADGES[sample.type] || TYPE_BADGES.other;

  return (
    <div
      id={`sample-row-${sample.id}`}
      onClick={() => onSelectSample(sample)}
      style={{ height: `${ROW_HEIGHT}px` }}
      className={`flex items-center text-xs transition select-none cursor-pointer group min-w-max border-b-2 border-[#14141C] ${
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
          onClick={(e) => onPlaySample(e, sample)}
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
          audioBuffer={audioBuffer}
          sampleId={sample.id}
          type={sample.type}
          isPlaying={isPlaying}
          progress={isPlaying ? playbackProgress : 0}
          width={Math.max(60, colWidths.wave - 16)}
          height={22}
          slices={sample.slices}
          onClick={(e) => onPlaySample(e, sample)}
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
        {(
          <button
            onClick={(e) => {
              e.stopPropagation();
              openSampleModal('loudness', sample);
            }}
            className="p-1 bg-[#10B981]/15 hover:bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/40 pixel-btn"
            title="Calibrer selon l'Étalon Officiel (ITU-R BS.1770 / EBU R128)"
          >
            <ShieldCheck className="w-2.5 h-2.5" />
          </button>
        )}

        {/* DSP FX Rack & Pitch Transposer Button */}

        {/* DSP Audio Analysis Button */}
        {(
          <button
            onClick={(e) => {
              e.stopPropagation();
              openSampleModal('dsp', sample);
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
            openSampleModal('slicer', sample);
          }}
          className="p-1 bg-[#00F0FF]/15 hover:bg-[#00F0FF]/30 text-[#00F0FF] border border-[#00F0FF]/40 pixel-btn"
          title="Découpe"
        >
          <Scissors className="w-2.5 h-2.5" />
        </button>

        {/* Export Single WAV */}
        <button
          onClick={(e) => onDownloadWav(e, sample)}
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
});
