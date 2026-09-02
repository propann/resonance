import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Plus,
  RefreshCw,
  Download,
  Flame,
  Binary,
  Layers,
  Sparkles,
  Sliders,
  Volume2,
  Check,
  Zap,
  Save,
} from 'lucide-react';
import { SampleItem } from '../types/sample';
import {
  DspRackConfig,
  DEFAULT_DSP_RACK_CONFIG,
  applyEffectsToAudioBuffer,
} from '../services/dspEffectsEngine';
import { audioBufferToWavBlob } from '../services/audioConverter';
import { audioGraph } from '../services/audioGraph';
import { DspSidebar } from './dsp/DspSidebar';
import { DspWaveformMonitor } from './dsp/DspWaveformMonitor';
import { DspControlsCards } from './dsp/DspControlsCards';
import { EffectModuleKey, EFFECT_MODULES } from './dsp/dspTypes';
import { readStudioSettings, writeStudioSettings, type DirectoryHandle } from '../services/localLibrary';

interface AudioEffectsRackModalProps {
  sample: SampleItem;
  isOpen: boolean;
  onClose: () => void;
  onSaveAsNewSample: (newSample: SampleItem) => void;
  onOverwriteSample?: (updatedSample: SampleItem) => void;
  libraryRoot?: DirectoryHandle | null;
}

interface StoredDspPreset {
  id: string;
  name: string;
  config: DspRackConfig;
}

const CUSTOM_DSP_PRESETS_KEY = 'resonance-custom-dsp-presets-v1';

function cloneRackConfig(config: DspRackConfig): DspRackConfig {
  return JSON.parse(JSON.stringify(config)) as DspRackConfig;
}

export const AudioEffectsRackModal: React.FC<AudioEffectsRackModalProps> = ({
  sample,
  isOpen,
  onClose,
  onSaveAsNewSample,
  onOverwriteSample,
  libraryRoot,
}) => {
  // DSP Configuration state
  const [config, setConfig] = useState<DspRackConfig>(() => ({
    ...DEFAULT_DSP_RACK_CONFIG,
  }));

  // Processed buffer state
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<'processed' | 'dry'>('processed');
  const [isLiveAuditionLoop, setIsLiveAuditionLoop] = useState<boolean>(true);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [customPresets, setCustomPresets] = useState<StoredDspPreset[]>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_DSP_PRESETS_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Layout focus state
  const [activeFocus, setActiveFocus] = useState<EffectModuleKey | 'all'>('all');

  // Audio nodes refs for live audition
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const playheadRafRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem(CUSTOM_DSP_PRESETS_KEY, JSON.stringify(customPresets));
  }, [customPresets]);

  useEffect(() => {
    if (!isOpen || !libraryRoot) return;
    readStudioSettings(libraryRoot).then((settings) => {
      if (Array.isArray(settings.dspPresets)) setCustomPresets(settings.dspPresets as StoredDspPreset[]);
    });
  }, [isOpen, libraryRoot]);

  // Check if a specific module is enabled
  const isModuleActive = useCallback(
    (key: EffectModuleKey): boolean => {
      switch (key) {
        case 'subBass':
          return config.subBass.enabled;
        case 'distortion':
          return config.distortion.enabled;
        case 'delay':
          return config.delay.enabled;
        case 'reverb':
          return config.reverb.enabled;
        case 'stutter':
          return config.stutter.enabled;
        case 'filter':
          return config.filter.enabled;
        case 'compressor':
          return config.compressor.enabled;
        case 'modulation':
          return config.modulation.enabled;
        case 'transient':
          return config.transient.enabled;
        case 'pitchRing':
          return config.pitchRing.enabled;
        case 'imager':
          return config.imager.enabled;
        case 'formant':
          return config.formant.enabled;
        case 'vinylTape':
          return config.vinylTape.enabled;
        case 'freqShifter':
          return config.freqShifter.enabled;
        case 'exciter':
          return config.exciter.enabled;
        case 'autoWah':
          return config.autoWah.enabled;
        case 'combResonator':
          return config.combResonator.enabled;
        case 'surgical':
          return (
            config.surgical.reverse ||
            config.surgical.tapeStopBrakeSec > 0 ||
            config.surgical.fadeInSec > 0 ||
            config.surgical.fadeOutSec > 0 ||
            config.surgical.normalizePeak
          );
        default:
          return false;
      }
    },
    [config]
  );

  // Count active modules
  const enabledCount = EFFECT_MODULES.filter((m) => isModuleActive(m.key)).length;

  // Stop currently playing audio
  const stopAudio = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.onended = null;
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch (e) {
        // Source might already have stopped
      }
      currentSourceRef.current = null;
    }
    if (playheadRafRef.current) {
      cancelAnimationFrame(playheadRafRef.current);
      playheadRafRef.current = null;
    }
    setIsPlaying(false);
    setPlaybackProgress(0);
  }, []);

  // Play audio buffer with playhead tracking
  const playBuffer = useCallback(
    (buf: AudioBuffer, loop: boolean) => {
      if (!buf) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = audioGraph.getContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      stopAudio();

      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = loop;

      if (!gainNodeRef.current) {
        gainNodeRef.current = ctx.createGain();
        gainNodeRef.current.connect(audioGraph.getMasterInput());
      }
      gainNodeRef.current.gain.value = 1.0;
      source.connect(gainNodeRef.current);

      startTimeRef.current = ctx.currentTime;
      currentSourceRef.current = source;
      setIsPlaying(true);

      const duration = buf.duration;

      const trackProgress = () => {
        if (!currentSourceRef.current) return;
        const elapsed = ctx.currentTime - startTimeRef.current;
        const currentPos = loop ? (elapsed % duration) / duration : Math.min(1, elapsed / duration);
        setPlaybackProgress(currentPos);

        if (loop || elapsed < duration) {
          playheadRafRef.current = requestAnimationFrame(trackProgress);
        } else {
          setIsPlaying(false);
          setPlaybackProgress(0);
        }
      };

      source.onended = () => {
        if (!loop) {
          setIsPlaying(false);
          setPlaybackProgress(0);
        }
      };

      source.start(0);
      playheadRafRef.current = requestAnimationFrame(trackProgress);
    },
    [stopAudio]
  );

  // Real-time DSP Recompute Engine (with 35ms ultra-low debounce)
  useEffect(() => {
    if (!sample?.audioBuffer) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsProcessing(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await applyEffectsToAudioBuffer(sample.audioBuffer, config);
        setProcessedBuffer(result);
        setIsProcessing(false);

        // If continuous audition loop is running, seamlessly hot-swap the buffer
        if (isPlaying && isLiveAuditionLoop && previewMode === 'processed') {
          playBuffer(result, true);
        }
      } catch (err) {
        console.error('DSP Processing Error:', err);
        setIsProcessing(false);
      }
    }, 35);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [config, sample.audioBuffer]);

  // Initial playback start on modal open
  useEffect(() => {
    if (sample?.audioBuffer) {
      const timer = setTimeout(() => {
        if (isLiveAuditionLoop) {
          playBuffer(processedBuffer || sample.audioBuffer, true);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // Cleanup on unmount. The AudioContext is shared (audioGraph) — never close it,
  // just stop this modal's source and disconnect its local gain node.
  useEffect(() => {
    return () => {
      stopAudio();
      if (gainNodeRef.current) {
        try {
          gainNodeRef.current.disconnect();
        } catch {
          // already disconnected
        }
        gainNodeRef.current = null;
      }
      audioCtxRef.current = null;
    };
  }, [stopAudio]);

  // Toggle play/pause
  const handleTogglePlayback = useCallback(() => {
    if (isPlaying) {
      stopAudio();
    } else {
      const targetBuffer =
        previewMode === 'processed'
          ? processedBuffer || sample.audioBuffer
          : sample.audioBuffer;
      playBuffer(targetBuffer, isLiveAuditionLoop);
    }
  }, [isPlaying, previewMode, processedBuffer, sample.audioBuffer, isLiveAuditionLoop, playBuffer, stopAudio]);

  // Global spacebar listener inside effects modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        const isTextInput =
          (target instanceof HTMLInputElement &&
            target.type !== 'range' &&
            target.type !== 'checkbox' &&
            target.type !== 'radio') ||
          target instanceof HTMLTextAreaElement ||
          target?.isContentEditable;

        if (!isTextInput) {
          e.preventDefault();
          e.stopPropagation();
          if (target && typeof target.blur === 'function') {
            target.blur();
          }
          handleTogglePlayback();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleTogglePlayback]);

  // Toggle Preview Mode (Wet vs Dry)
  const handleTogglePreviewMode = (mode: 'processed' | 'dry') => {
    setPreviewMode(mode);
    const targetBuffer =
      mode === 'processed'
        ? processedBuffer || sample.audioBuffer
        : sample.audioBuffer;
    if (isPlaying) {
      playBuffer(targetBuffer, isLiveAuditionLoop);
    }
  };

  // Toggle Live Audition Loop
  const handleToggleLiveAuditionLoop = () => {
    const nextLoop = !isLiveAuditionLoop;
    setIsLiveAuditionLoop(nextLoop);
    if (isPlaying) {
      const targetBuffer =
        previewMode === 'processed'
          ? processedBuffer || sample.audioBuffer
          : sample.audioBuffer;
      playBuffer(targetBuffer, nextLoop);
    }
  };

  // Toggle specific module
  const handleToggleModule = (key: EffectModuleKey) => {
    setConfig((prev) => {
      const next = { ...prev };
      switch (key) {
        case 'subBass':
          next.subBass = { ...next.subBass, enabled: !next.subBass.enabled };
          break;
        case 'distortion':
          next.distortion = { ...next.distortion, enabled: !next.distortion.enabled };
          break;
        case 'delay':
          next.delay = { ...next.delay, enabled: !next.delay.enabled };
          break;
        case 'reverb':
          next.reverb = { ...next.reverb, enabled: !next.reverb.enabled };
          break;
        case 'stutter':
          next.stutter = { ...next.stutter, enabled: !next.stutter.enabled };
          break;
        case 'filter':
          next.filter = { ...next.filter, enabled: !next.filter.enabled };
          break;
        case 'compressor':
          next.compressor = { ...next.compressor, enabled: !next.compressor.enabled };
          break;
        case 'modulation':
          next.modulation = { ...next.modulation, enabled: !next.modulation.enabled };
          break;
        case 'transient':
          next.transient = { ...next.transient, enabled: !next.transient.enabled };
          break;
        case 'pitchRing':
          next.pitchRing = { ...next.pitchRing, enabled: !next.pitchRing.enabled };
          break;
        case 'imager':
          next.imager = { ...next.imager, enabled: !next.imager.enabled };
          break;
        case 'formant':
          next.formant = { ...next.formant, enabled: !next.formant.enabled };
          break;
        case 'vinylTape':
          next.vinylTape = { ...next.vinylTape, enabled: !next.vinylTape.enabled };
          break;
        case 'freqShifter':
          next.freqShifter = { ...next.freqShifter, enabled: !next.freqShifter.enabled };
          break;
        case 'exciter':
          next.exciter = { ...next.exciter, enabled: !next.exciter.enabled };
          break;
        case 'autoWah':
          next.autoWah = { ...next.autoWah, enabled: !next.autoWah.enabled };
          break;
        case 'combResonator':
          next.combResonator = { ...next.combResonator, enabled: !next.combResonator.enabled };
          break;
        case 'surgical': {
          const isActive =
            next.surgical.reverse ||
            next.surgical.tapeStopBrakeSec > 0 ||
            next.surgical.fadeInSec > 0 ||
            next.surgical.fadeOutSec > 0 ||
            next.surgical.normalizePeak;
          if (isActive) {
            next.surgical = {
              reverse: false,
              tapeStopBrakeSec: 0,
              fadeInSec: 0,
              fadeOutSec: 0,
              normalizePeak: false,
            };
          } else {
            next.surgical = {
              ...next.surgical,
              normalizePeak: true,
              fadeInSec: 0.05,
              fadeOutSec: 0.05,
            };
          }
          break;
        }
      }
      return next;
    });
  };

  // Toggle all modules
  const handleToggleAll = (enable: boolean) => {
    setConfig((prev) => ({
      ...prev,
      subBass: { ...prev.subBass, enabled: enable },
      distortion: { ...prev.distortion, enabled: enable },
      delay: { ...prev.delay, enabled: enable },
      reverb: { ...prev.reverb, enabled: enable },
      stutter: { ...prev.stutter, enabled: enable },
      filter: { ...prev.filter, enabled: enable },
      compressor: { ...prev.compressor, enabled: enable },
      modulation: { ...prev.modulation, enabled: enable },
      transient: { ...prev.transient, enabled: enable },
      pitchRing: { ...prev.pitchRing, enabled: enable },
      imager: { ...prev.imager, enabled: enable },
      formant: { ...prev.formant, enabled: enable },
      vinylTape: { ...prev.vinylTape, enabled: enable },
      freqShifter: { ...prev.freqShifter, enabled: enable },
      exciter: { ...prev.exciter, enabled: enable },
      autoWah: { ...prev.autoWah, enabled: enable },
      combResonator: { ...prev.combResonator, enabled: enable },
    }));
  };

  // Apply Quick Combos
  const handleApplyCombo = (comboName: string) => {
    switch (comboName) {
      case 'drill-808':
        setConfig((prev) => ({
          ...DEFAULT_DSP_RACK_CONFIG,
          subBass: { ...prev.subBass, enabled: true, boostDb: 12, subHarmonics: 40, subDrive: 35 },
          distortion: { ...prev.distortion, enabled: true, driveType: 'hard-clip', gainDb: 8, mix: 45 },
          transient: { ...prev.transient, enabled: true, attackDb: 4, sustainDb: 2 },
          compressor: { ...prev.compressor, enabled: true, thresholdDb: -14, ratio: 4, makeupGainDb: 3 },
        }));
        break;
      case 'cosmic-echo':
        setConfig((prev) => ({
          ...DEFAULT_DSP_RACK_CONFIG,
          delay: { ...prev.delay, enabled: true, syncDivision: '1/8D', feedback: 55, mix: 40, wowFlutter: 20 },
          reverb: { ...prev.reverb, enabled: true, roomSize: 'cosmic-void', decaySec: 6.5, shimmer: 45, mix: 50 },
          imager: { ...prev.imager, enabled: true, widthPercent: 160, autopanDepth: 35, autopanRateHz: 0.4 },
        }));
        break;
      case 'lofi-sampler':
        setConfig((prev) => ({
          ...DEFAULT_DSP_RACK_CONFIG,
          distortion: { ...prev.distortion, enabled: true, bitDepth: 12, downsample: 2, driveType: 'tape-sat', gainDb: 6, noiseHiss: 20, mix: 65 },
          filter: { ...prev.filter, enabled: true, type: 'lowpass', cutoffHz: 4500, resonance: 2 },
          vinylTape: { ...prev.vinylTape, enabled: true, crackleAmount: 30, vintageCurve: '1980-walkman', tapeFlutterDepth: 25, mix: 50 },
        }));
        break;
      case 'vinyl-cassette':
        setConfig((prev) => ({
          ...DEFAULT_DSP_RACK_CONFIG,
          vinylTape: { ...prev.vinylTape, enabled: true, crackleAmount: 55, vinylDustPops: 40, vintageCurve: '1970-cassette', tapeFlutterDepth: 35, mix: 70 },
          distortion: { ...prev.distortion, enabled: true, driveType: 'tube-warmth', gainDb: 5, noiseHiss: 15, mix: 40 },
          compressor: { ...prev.compressor, enabled: true, thresholdDb: -18, ratio: 3, makeupGainDb: 2 },
        }));
        break;
      case 'glitch-acid':
        setConfig((prev) => ({
          ...DEFAULT_DSP_RACK_CONFIG,
          stutter: { ...prev.stutter, enabled: true, division: '1/16', shape: 'random-glitch', dutyCycle: 50, mix: 80 },
          filter: { ...prev.filter, enabled: true, type: 'acid-303', cutoffHz: 1800, resonance: 14, lfoDepth: 60, lfoRateHz: 1.2 },
          distortion: { ...prev.distortion, enabled: true, driveType: 'wavefolder', gainDb: 10, mix: 50 },
        }));
        break;
      case 'funk-wah':
        setConfig((prev) => ({
          ...DEFAULT_DSP_RACK_CONFIG,
          autoWah: { ...prev.autoWah, enabled: true, sensitivity: 65, baseCutoffHz: 450, sweepRangeHz: 2800, resonance: 8, mix: 85 },
          exciter: { ...prev.exciter, enabled: true, frequencyHz: 8000, harmonicsDrive: 40, airBoostDb: 6, mix: 60 },
          compressor: { ...prev.compressor, enabled: true, thresholdDb: -12, ratio: 3.5, attackMs: 15, makeupGainDb: 2.5 },
        }));
        break;
    }
  };

  const handleSavePreset = () => {
    const name = window.prompt('Nom du preset DSP :');
    if (!name?.trim()) return;
    const normalizedName = name.trim().slice(0, 60);
    setCustomPresets((previous) => {
      const nextPreset: StoredDspPreset = {
        id: `custom-${Date.now().toString(36)}`,
        name: normalizedName,
        config: cloneRackConfig(config),
      };
      const next = [...previous.filter((preset) => preset.name.toLowerCase() !== normalizedName.toLowerCase()), nextPreset];
      if (libraryRoot) void writeStudioSettings(libraryRoot, { dspPresets: next });
      return next;
    });
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = customPresets.find((item) => item.id === presetId);
    if (preset) setConfig(cloneRackConfig(preset.config));
  };

  // Download treated WAV file
  const handleDownloadWav = () => {
    const targetBuffer = processedBuffer || sample.audioBuffer;
    if (!targetBuffer) return;
    const blob = audioBufferToWavBlob(targetBuffer, { bitDepth: 24 });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sample.name.replace(/\.[^/.]+$/, '')}_DSP_MASTER.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Save As New Sample
  const handleSaveAsNew = () => {
    const targetBuffer = processedBuffer || sample.audioBuffer;
    if (!targetBuffer) return;

    const blob = audioBufferToWavBlob(targetBuffer, { bitDepth: 24, normalize: false });
    const name = `${sample.name.replace(/\.[^/.]+$/, '')}_DSP`;

    onSaveAsNewSample({
      ...sample,
      id: `dsp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      originalFileName: sample.originalFileName || sample.name,
      audioBuffer: targetBuffer,
      blobUrl: URL.createObjectURL(blob),
      size: blob.size,
      duration: targetBuffer.duration,
      sampleRate: targetBuffer.sampleRate,
      channels: targetBuffer.numberOfChannels,
      format: 'wav',
      category: sample.category,
      bpm: sample.bpm,
      key: sample.key,
      tags: Array.from(new Set([...(sample.tags || []), 'dsp-rack', 'processed'])),
      dateAdded: Date.now(),
    });
    stopAudio();
    onClose();
  };

  // Overwrite existing sample
  const handleOverwrite = () => {
    if (!onOverwriteSample) return;
    const targetBuffer = processedBuffer || sample.audioBuffer;
    if (!targetBuffer) return;

    onOverwriteSample({
      ...sample,
      audioBuffer: targetBuffer,
      duration: targetBuffer.duration,
      tags: Array.from(new Set([...(sample.tags || []), 'dsp-processed'])),
    });
    stopAudio();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-7xl h-[94vh] bg-[#07070E] border-2 border-[#00F0FF]/40 rounded-lg flex flex-col overflow-hidden shadow-2xl">
        {/* ======================================================== */}
        {/* 1. TOP APPLICATION BANNER / HEADER (ALL ACTIONS CONSOLIDATED) */}
        {/* ======================================================== */}
        <div className="px-4 py-2.5 bg-[#0E0E1A] border-b border-[#202034] flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
          {/* Left Title & Status */}
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-[#00F0FF]/20 border border-[#00F0FF]/50 text-[#00F0FF] rounded">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-pixel font-bold text-white uppercase tracking-wider">
                  STUDIO DSP MODULAR RACK
                </h2>
                <span className="px-2 py-0.5 bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[10px] font-mono text-[#00F0FF] font-bold rounded">
                  {enabledCount} EFFETS ACTIFS
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#8E8E98] truncate max-w-xs sm:max-w-md">
                Traitement studio professionnel sur : <strong className="text-white">{sample.name}</strong>
              </p>
            </div>
          </div>

          {/* Center Playback & Audition Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePlayback}
              className={`px-4 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition shadow ${
                isPlaying
                  ? 'bg-[#EF4444] text-white hover:bg-[#DC2626]'
                  : 'bg-[#00F0FF] text-black hover:bg-[#38BDF8]'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'PAUSE' : 'ÉCOUTER'}</span>
            </button>

            <button
              onClick={handleDownloadWav}
              className="px-3 py-1.5 bg-[#18182A] hover:bg-[#25253C] text-[#EDEDEE] border border-[#303046] rounded text-xs font-mono flex items-center gap-1.5 transition"
              title="Télécharger le fichier WAV 24-bit traité directement sur votre disque"
            >
              <Download className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span className="hidden sm:inline">EXPORT WAV</span>
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <select
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) handleLoadPreset(event.target.value);
                event.currentTarget.value = '';
              }}
              className="max-w-32 bg-[#18182A] border border-[#303046] rounded px-2 py-1.5 text-xs font-mono text-white"
              title="Charger un preset DSP sauvegardé"
            >
              <option value="">PRESET…</option>
              {customPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
            <button
              onClick={handleSavePreset}
              className="px-2.5 py-1.5 bg-[#A855F7]/20 hover:bg-[#A855F7]/35 text-[#E9D5FF] border border-[#A855F7]/50 rounded text-xs font-mono font-bold flex items-center gap-1"
              title="Sauvegarder ces réglages comme preset"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">SAUVER FX</span>
            </button>
            {onOverwriteSample && (
              <button
                onClick={handleOverwrite}
                className="px-3 py-1.5 bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#EF4444] border border-[#EF4444]/50 rounded text-xs font-mono font-bold transition flex items-center gap-1.5"
                title="Remplacer définitivement le sample actuel par cette version transformée"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">REMPLACER</span>
              </button>
            )}

            <button
              onClick={handleSaveAsNew}
              className="px-3.5 py-1.5 bg-[#10B981] hover:bg-[#059669] text-black rounded text-xs font-mono font-bold transition flex items-center gap-1.5 shadow"
              title="Créer un nouveau sample dans la bibliothèque avec ces effets appliqués"
            >
              <Plus className="w-4 h-4" />
              <span>ENREGISTRER SAMPLE</span>
            </button>

            <button
              onClick={() => {
                stopAudio();
                onClose();
              }}
              className="p-1.5 bg-[#1A1A2A] hover:bg-[#2A2A3E] text-[#8E8E98] hover:text-white rounded border border-[#2C2C40] transition"
              title="Fermer la fenêtre DSP"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. TOP WAVEFORM MONITOR (DRY vs WET + PLAYHEAD CURSOR)    */}
        {/* ======================================================== */}
        <DspWaveformMonitor
          sample={sample}
          processedBuffer={processedBuffer}
          isPlaying={isPlaying}
          isProcessing={isProcessing}
          playbackProgress={playbackProgress}
          previewMode={previewMode}
          onTogglePreviewMode={handleTogglePreviewMode}
          isLiveAuditionLoop={isLiveAuditionLoop}
          onToggleLiveAuditionLoop={handleToggleLiveAuditionLoop}
          enabledCount={enabledCount}
        />

        {/* ======================================================== */}
        {/* 3. MAIN WORKSPACE: LEFT SIDEBAR + ADAPTIVE CARDS RACK    */}
        {/* ======================================================== */}
        <div className="flex-1 flex overflow-hidden bg-[#06060A]">
          {/* LEFT COLUMN: EFFECTS SELECTOR & RECIPES */}
          <DspSidebar
            config={config}
            onToggleModule={handleToggleModule}
            onToggleAll={handleToggleAll}
            onApplyCombo={handleApplyCombo}
            activeFocus={activeFocus}
            onSelectFocus={setActiveFocus}
            isModuleActive={isModuleActive}
            enabledCount={enabledCount}
          />

          {/* MAIN COLUMN: DYNAMIC SLIDERS & CONTROLS */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#07070E]">
            {enabledCount === 0 ? (
              /* EMPTY RACK STATE */
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#202036] rounded-lg bg-[#0A0A16]/50 text-center space-y-4 max-w-xl mx-auto my-auto">
                <div className="p-3 bg-[#00F0FF]/10 rounded-full border border-[#00F0FF]/30 text-[#00F0FF]">
                  <Layers className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-pixel font-bold text-white uppercase">
                    AUCUN EFFET COCHÉ DANS LA COLONNE DE GAUCHE
                  </h3>
                  <p className="text-xs font-mono text-[#8E8E98] leading-relaxed">
                    Cochez un ou plusieurs effets dans la colonne de gauche (ou cliquez sur une recette rapide ci-dessous) pour afficher immédiatement tous leurs curseurs de réglage en direct sous l'onde !
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => handleApplyCombo('drill-808')}
                    className="px-3 py-1.5 bg-[#00F0FF]/20 hover:bg-[#00F0FF]/30 border border-[#00F0FF] text-[#00F0FF] text-xs font-mono font-bold rounded"
                  >
                    ⚡ Combo 808 Drill
                  </button>
                  <button
                    onClick={() => handleApplyCombo('cosmic-echo')}
                    className="px-3 py-1.5 bg-[#A855F7]/20 hover:bg-[#A855F7]/30 border border-[#A855F7] text-[#A855F7] text-xs font-mono font-bold rounded"
                  >
                    🌌 Combo Space Ambient
                  </button>
                  <button
                    onClick={() => handleApplyCombo('lofi-sampler')}
                    className="px-3 py-1.5 bg-[#EF4444]/20 hover:bg-[#EF4444]/30 border border-[#EF4444] text-[#EF4444] text-xs font-mono font-bold rounded"
                  >
                    📻 Combo SP-1200 Lo-Fi
                  </button>
                  <button
                    onClick={() => handleToggleAll(true)}
                    className="px-3 py-1.5 bg-[#FFE600]/20 hover:bg-[#FFE600]/30 border border-[#FFE600] text-[#FFE600] text-xs font-mono font-bold rounded"
                  >
                    ✨ Tout Activer
                  </button>
                </div>
              </div>
            ) : (
              /* DYNAMIC CARDS RENDERER */
              <DspControlsCards
                config={config}
                onChangeConfig={setConfig}
                activeFocus={activeFocus}
              />
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 4. BOTTOM ACTION STATUS BAR                              */}
        {/* ======================================================== */}
        <div className="px-4 py-2 bg-[#0A0A14] border-t border-[#1C1C2C] flex items-center justify-between text-[11px] font-mono text-[#8E8E98] shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-white">
              <Zap className="w-3.5 h-3.5 text-[#00F0FF]" />
              Moteur DSP 64-bit AudioBuffer temps réel actif
            </span>
            <span className="hidden sm:inline text-[#404052]">|</span>
            <span className="hidden sm:inline">
              Modifications répercutées instantanément sans interruption sonore
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setConfig({ ...DEFAULT_DSP_RACK_CONFIG });
              }}
              className="hover:text-white transition flex items-center gap-1"
              title="Réinitialiser tous les paramètres du rack"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Réinitialiser</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
