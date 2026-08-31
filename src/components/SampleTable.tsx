import React, { useState } from 'react';
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
} from 'lucide-react';
import { SampleItem, SampleType, FilterState } from '../types/sample';
import { audioEngine } from '../services/audioEngine';
import { audioBufferToWavBlob, triggerFileDownload } from '../services/audioConverter';
import { MiniWaveform } from './MiniWaveform';

interface SampleTableProps {
  samples: SampleItem[];
  selectedSampleId: string | null;
  onSelectSample: (sample: SampleItem) => void;
  onOpenSlicerForSample: (sample: SampleItem) => void;
  onOpenDspAnalyzer?: (sample: SampleItem) => void;
  onOpenFxRack?: (sample: SampleItem) => void;
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

  // Subscribe to engine state
  React.useEffect(() => {
    const unsub = audioEngine.subscribe((st) => {
      setPlayingId(st.isPlaying ? st.sampleId : null);
      if (st.isPlaying && st.duration > 0) {
        setPlaybackProgress(st.currentTime / st.duration);
      } else {
        setPlaybackProgress(0);
      }
    });
    return () => unsub();
  }, []);

  const handlePlaySample = (e: React.MouseEvent, sample: SampleItem) => {
    e.stopPropagation();
    if (!sample.audioBuffer) return;

    if (playingId === sample.id) {
      audioEngine.pause();
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
      {/* Pixel Hardware Table Header */}
      <div className="bg-[#121218] border-b-2 border-[#1E1E26] text-[#8E8E93] text-[9px] font-pixel uppercase tracking-wide grid grid-cols-12 px-3 py-2 items-center select-none">
        {/* Checkbox & Play */}
        <div className="col-span-1 flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={(e) => onSelectAllSamples(e.target.checked)}
            className="rounded-none border-[#333344] text-[#00F0FF] focus:ring-0 w-3 h-3 bg-[#000000] accent-[#00F0FF] cursor-pointer"
          />
          <span>PLAY</span>
        </div>

        {/* Mini Waveform Visualizer */}
        <div className="col-span-2">
          <span>ONDE</span>
        </div>

        {/* Name */}
        <div
          className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-[#00F0FF]"
          onClick={() => handleSort('name')}
        >
          <span>NOM DU FICHIER</span>
          <ArrowUpDown className="w-2.5 h-2.5" />
        </div>

        {/* Category / Type */}
        <div
          className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-[#00F0FF]"
          onClick={() => handleSort('type')}
        >
          <span>TYPE</span>
          <ArrowUpDown className="w-2.5 h-2.5" />
        </div>

        {/* Key / BPM */}
        <div
          className="col-span-1 flex items-center gap-1 cursor-pointer hover:text-[#00F0FF]"
          onClick={() => handleSort('key')}
        >
          <span>KEY/BPM</span>
          <ArrowUpDown className="w-2.5 h-2.5" />
        </div>

        {/* Genre */}
        <div className="col-span-1">
          <span>GENRE</span>
        </div>

        {/* Loudness LUFS & Gain */}
        <div className="col-span-1">
          <span>LUFS</span>
        </div>

        {/* Actions */}
        <div className="col-span-1 text-right pr-2">
          <span>OUTILS</span>
        </div>
      </div>

      {/* Table Rows */}
      <div className="flex-1 overflow-y-auto divide-y-2 divide-[#14141C]">
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
                className={`grid grid-cols-12 px-3 py-1.5 items-center text-xs transition select-none cursor-pointer group ${
                  isSelected
                    ? 'bg-[#00F0FF]/15 border-l-4 border-[#00F0FF]'
                    : 'hover:bg-[#12121A]'
                }`}
              >
                {/* Select Checkbox & Play Button */}
                <div className="col-span-1 flex items-center gap-1.5">
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
                    className={`w-5 h-5 flex items-center justify-center transition border pixel-btn ${
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

                {/* Mini Waveform Visualizer */}
                <div className="col-span-2 pr-2">
                  <MiniWaveform
                    audioBuffer={sample.audioBuffer}
                    sampleId={sample.id}
                    type={sample.type}
                    isPlaying={isPlaying}
                    progress={isPlaying ? playbackProgress : 0}
                    width={110}
                    height={22}
                    slices={sample.slices}
                    onClick={(e) => handlePlaySample(e, sample)}
                  />
                </div>

                {/* Name & Multi-sound slices tag */}
                <div className="col-span-3 flex items-center gap-1.5 truncate pr-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(sample.id);
                    }}
                    className="text-[#5A5A62] hover:text-[#FFE600] transition"
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

                {/* Category & Type Badge */}
                <div className="col-span-2 flex items-center gap-1 flex-wrap">
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

                {/* Musical Key & BPM */}
                <div className="col-span-1 font-pixel flex flex-col gap-0.5 text-[9px]">
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

                {/* Genre */}
                <div className="col-span-1 truncate pr-1 text-[9px] font-pixel text-[#8E8E93]">
                  <span>{sample.genre?.split('/')[0] || 'Universal'}</span>
                </div>

                {/* Loudness LUFS & Gain Matching */}
                <div className="col-span-1 font-pixel text-[9px]">
                  <div className={sample.lufs && sample.lufs > -10 ? 'text-[#FFE600]' : 'text-[#EDEDEE]'}>
                    {sample.lufs ? `${sample.lufs.toFixed(0)} LUF` : `${(sample.rmsDb || -14).toFixed(0)} dB`}
                  </div>
                </div>

                {/* Quick Action Tools */}
                <div className="col-span-1 flex items-center justify-end gap-1">
                  {/* DSP FX Rack & Sound Transformer Button */}
                  {onOpenFxRack && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFxRack(sample);
                      }}
                      className="p-1 bg-[#00F0FF]/15 hover:bg-[#00F0FF]/30 text-[#00F0FF] border border-[#00F0FF]/40 pixel-btn"
                      title="Rack d'Effets DSP & Sound Design"
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
