import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  Repeat,
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Zap,
  SlidersHorizontal,
  Disc,
} from 'lucide-react';
import { SampleItem } from '../types/sample';
import { audioEngine, PlaybackState } from '../services/audioEngine';

interface AudioPlayerBottomBarProps {
  currentSample: SampleItem | null;
  onNextSample?: () => void;
  onPrevSample?: () => void;
}

export const AudioPlayerBottomBar: React.FC<AudioPlayerBottomBarProps> = ({
  currentSample,
  onNextSample,
  onPrevSample,
}) => {
  const [state, setState] = useState<PlaybackState>(audioEngine.getState());
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [prevVolume, setPrevVolume] = useState<number>(0.9);
  const [showPitchPanel, setShowPitchPanel] = useState<boolean>(false);
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);

  useEffect(() => {
    const unsub = audioEngine.subscribe((st) => {
      setState(st);
    });
    return () => unsub();
  }, []);

  if (!currentSample) {
    return (
      <div className="h-14 bg-[#0A0A0D] border-t border-[#222226] flex items-center justify-between px-6 select-none text-[#8E8E93] text-xs font-mono">
        <span>Aucun sample sélectionné • Cliquez sur un fichier ou utilisez les flèches Haut/Bas</span>
        <span className="text-[#5A5A62]">Espace = Play/Pause • L = Loop • R = Reverse</span>
      </div>
    );
  }

  const isPlaying = state.isPlaying && state.sampleId === currentSample.id;

  const handlePlayToggle = () => {
    if (!currentSample.audioBuffer) return;
    if (isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play(currentSample.audioBuffer, currentSample.id);
    }
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      audioEngine.setVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(state.volume);
      audioEngine.setVolume(0);
      setIsMuted(true);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(2);
    return `${m}:${s.padStart(5, '0')}`;
  };

  return (
    <div id="audio-player-bottom-bar" className="h-16 bg-[#0A0A0D] border-t border-[#222226] flex items-center justify-between px-6 select-none z-30 shadow-2xl relative font-sans">
      {/* Sample Info & Navigation */}
      <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevSample}
            className="p-1 rounded-md text-[#8E8E93] hover:text-[#EDEDEE] hover:bg-[#1A1A1E] transition"
            title="Sample précédent (Flèche Haut)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onNextSample}
            className="p-1 rounded-md text-[#8E8E93] hover:text-[#EDEDEE] hover:bg-[#1A1A1E] transition"
            title="Sample suivant (Flèche Bas)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="truncate">
          <div className="text-xs font-bold text-[#EDEDEE] truncate flex items-center gap-2">
            <span>{currentSample.name}</span>
            {currentSample.key && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30">
                {currentSample.key}
              </span>
            )}
          </div>
          <div className="text-[10px] font-mono text-[#8E8E93] mt-0.5">
            {formatTime(state.currentTime)} / {formatTime(currentSample.duration)}
          </div>
        </div>
      </div>

      {/* Center Transport Controls */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2.5">
          {/* Loop toggle */}
          <button
            onClick={() => audioEngine.toggleLoop()}
            className={`p-1.5 rounded-lg border text-xs font-mono transition ${
              state.isLooping
                ? 'bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/40 font-bold'
                : 'bg-[#141417] text-[#8E8E93] border-[#26262B] hover:text-[#EDEDEE]'
            }`}
            title="Activer la lecture en boucle (Touche L)"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Reverse toggle */}
          <button
            onClick={() => audioEngine.toggleReverse()}
            className={`p-1.5 rounded-lg border text-xs font-mono transition ${
              state.isReversed
                ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/40 font-bold'
                : 'bg-[#141417] text-[#8E8E93] border-[#26262B] hover:text-[#EDEDEE]'
            }`}
            title="Inverser le son (Reverse - Touche R)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Big Play / Pause */}
          <button
            id="master-play-btn"
            onClick={handlePlayToggle}
            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold transition-all shadow-md ${
              isPlaying
                ? 'bg-[#00F0FF] text-[#0A0A0B] shadow-xs'
                : 'bg-[#00F0FF] hover:bg-[#38BDF8] text-[#0A0A0B]'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* Stop */}
          <button
            onClick={() => audioEngine.stop()}
            className="p-1.5 rounded-lg bg-[#141417] text-[#8E8E93] border border-[#26262B] hover:text-[#EDEDEE] hover:bg-[#1E1E23] transition"
            title="Stop"
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          {/* Pitch Control Popover Toggle */}
          <button
            onClick={() => setShowPitchPanel(!showPitchPanel)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-mono transition ${
              state.pitchSemitones !== 0 || showPitchPanel
                ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/40 font-bold'
                : 'bg-[#141417] text-[#8E8E93] border-[#26262B] hover:text-[#EDEDEE]'
            }`}
            title="Pitch Shifting & Transposition"
          >
            <span>{state.pitchSemitones > 0 ? `+${state.pitchSemitones}` : state.pitchSemitones} st</span>
          </button>

          {/* Playback Speed Preset */}
          <div className="flex items-center bg-[#141417] border border-[#26262B] rounded-lg p-0.5 text-[9px] font-mono">
            {[0.5, 1.0, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                onClick={() => audioEngine.setPlaybackRate(rate)}
                className={`px-1.5 py-0.5 rounded transition ${
                  state.playbackRate === rate
                    ? 'bg-[#00F0FF] text-[#0A0A0B] font-bold'
                    : 'text-[#8E8E93] hover:text-[#EDEDEE]'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* DJ Filter Toggle */}
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`p-1.5 rounded-lg border text-xs font-mono transition ${
              state.filterType !== 'allpass' || showFilterPanel
                ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40 font-bold'
                : 'bg-[#141417] text-[#8E8E93] border-[#26262B] hover:text-[#EDEDEE]'
            }`}
            title="Filtre DJ (Lowpass / Highpass)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mini progress scrub bar */}
        <div
          className="w-72 h-1 bg-[#1A1A20] rounded-full cursor-pointer overflow-hidden relative"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            audioEngine.seek(pos * currentSample.duration);
          }}
        >
          <div
            className="bg-[#00F0FF] h-full rounded-full transition-all duration-75"
            style={{
              width: `${(state.currentTime / Math.max(0.1, currentSample.duration)) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Right Controls: Volume & Headroom */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
        <button
          onClick={handleMuteToggle}
          className="text-[#8E8E93] hover:text-[#EDEDEE] transition"
        >
          {isMuted || state.volume === 0 ? (
            <VolumeX className="w-4 h-4 text-[#EF4444]" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>

        <input
          type="range"
          min="0"
          max="1.2"
          step="0.02"
          value={isMuted ? 0 : state.volume}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setIsMuted(false);
            audioEngine.setVolume(v);
          }}
          className="w-20 h-1 bg-[#1A1A20] rounded-lg cursor-pointer"
        />
        <span className="text-[10px] font-mono text-[#8E8E93] w-8 text-right">
          {Math.round(state.volume * 100)}%
        </span>
      </div>

      {/* Floating Pitch Popover */}
      {showPitchPanel && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-[#111114] border border-[#8B5CF6]/40 p-3.5 rounded-xl shadow-2xl w-64 space-y-2.5 animate-in fade-in z-40">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#8B5CF6] font-bold">Pitch Shift</span>
            <span className="text-[#EDEDEE] font-bold">{state.pitchSemitones} st</span>
          </div>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={state.pitchSemitones}
            onChange={(e) => audioEngine.setPitch(parseInt(e.target.value), state.pitchCents)}
            className="w-full h-1 bg-[#1E1E24] rounded-lg cursor-pointer"
          />
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#A78BFA]">Fine Tune</span>
            <span className="text-[#8E8E93]">{state.pitchCents} cents</span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            step="1"
            value={state.pitchCents}
            onChange={(e) => audioEngine.setPitch(state.pitchSemitones, parseInt(e.target.value))}
            className="w-full h-1 bg-[#1E1E24] rounded-lg cursor-pointer"
          />
          <button
            onClick={() => audioEngine.setPitch(0, 0)}
            className="w-full py-1 rounded bg-[#18181D] text-[10px] font-mono text-[#EDEDEE] hover:bg-[#222228] transition border border-[#26262B]"
          >
            Réinitialiser (0 st)
          </button>
        </div>
      )}

      {/* Floating Filter Popover */}
      {showFilterPanel && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-[#111114] border border-[#10B981]/40 p-3.5 rounded-xl shadow-2xl w-64 space-y-2.5 animate-in fade-in z-40">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#10B981] font-bold">Filtre DJ</span>
            <span className="text-[#EDEDEE] capitalize">{state.filterType}</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['allpass', 'lowpass', 'highpass'] as const).map((t) => (
              <button
                key={t}
                onClick={() => audioEngine.setFilter(t, state.filterCutoff)}
                className={`py-1 rounded text-xs font-mono capitalize transition ${
                  state.filterType === t
                    ? 'bg-[#10B981] text-[#0A0A0B] font-bold'
                    : 'bg-[#18181D] text-[#8E8E93] hover:text-[#EDEDEE] border border-[#26262B]'
                }`}
              >
                {t === 'allpass' ? 'Off' : t === 'lowpass' ? 'LP (Bass)' : 'HP (High)'}
              </button>
            ))}
          </div>
          {state.filterType !== 'allpass' && (
            <>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#8E8E93]">Coupure</span>
                <span className="text-[#10B981]">{Math.round(state.filterCutoff)} Hz</span>
              </div>
              <input
                type="range"
                min="100"
                max="12000"
                step="50"
                value={state.filterCutoff}
                onChange={(e) => audioEngine.setFilter(state.filterType, parseFloat(e.target.value))}
                className="w-full h-1 bg-[#1E1E24] rounded-lg cursor-pointer"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};
