import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Play,
  Pause,
  Square,
  Repeat,
  RotateCcw,
  Sparkles,
  Sliders,
  Activity,
  Layers,
  Volume2,
  Download,
  Plus,
  RefreshCw,
  Zap,
  Scissors,
  Check,
  Disc,
  Radio,
  Waves,
  Eye,
  SlidersHorizontal,
  Flame,
  Binary,
  Compass,
  ArrowRight,
  Maximize2,
  Music,
} from 'lucide-react';
import { SampleItem, SampleType } from '../types/sample';
import { audioEngine } from '../services/audioEngine';
import {
  DspRackConfig,
  DEFAULT_DSP_RACK_CONFIG,
  DSP_RACK_PRESETS,
  applyEffectsToAudioBuffer,
} from '../services/dspEffectsEngine';
import { audioBufferToWavBlob, triggerFileDownload } from '../services/audioConverter';
import { calculateAudioMetrics } from '../services/audioAnalyzer';

interface AudioEffectsRackModalProps {
  isOpen: boolean;
  onClose: () => void;
  sample: SampleItem | null;
  onSaveAsNewSample?: (newSample: SampleItem) => void;
  onOverwriteSample?: (updatedSample: SampleItem) => void;
}

type RackTab =
  | 'sub-bass'
  | 'stutter'
  | 'delay-reverb'
  | 'distortion'
  | 'modulation'
  | 'filter'
  | 'transient-pitch'
  | 'surgical';

export const AudioEffectsRackModal: React.FC<AudioEffectsRackModalProps> = ({
  isOpen,
  onClose,
  sample,
  onSaveAsNewSample,
  onOverwriteSample,
}) => {
  const [config, setConfig] = useState<DspRackConfig>(DEFAULT_DSP_RACK_CONFIG);
  const [activeTab, setActiveTab] = useState<RackTab>('sub-bass');

  // Processed audio buffer state for live comparison
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<'processed' | 'dry'>('processed');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize config from sample BPM if available
  useEffect(() => {
    if (sample && isOpen) {
      const initial = { ...DEFAULT_DSP_RACK_CONFIG };
      if (sample.bpm) {
        initial.stutter.bpm = sample.bpm;
      }
      setConfig(initial);
      setProcessedBuffer(sample.audioBuffer || null);
    }
  }, [sample, isOpen]);

  // Debounced auto-render processed buffer when config changes
  useEffect(() => {
    if (!isOpen || !sample?.audioBuffer) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsProcessing(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await applyEffectsToAudioBuffer(sample.audioBuffer!, config);
        setProcessedBuffer(result);
      } catch (err) {
        console.error('DSP processing error:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 180);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [config, sample, isOpen]);

  // Audio Playback Listener
  useEffect(() => {
    const unsub = audioEngine.subscribe((st) => {
      setIsPlaying(st.isPlaying);
    });
    return () => unsub();
  }, []);

  // Handle Play/Stop Preview
  const handleTogglePlay = () => {
    if (isPlaying) {
      audioEngine.stop();
      return;
    }

    const bufferToPlay = previewMode === 'dry' ? sample?.audioBuffer : processedBuffer;
    if (bufferToPlay) {
      audioEngine.play(bufferToPlay, `preview-fx-${sample?.id || 'dsp'}`);
    }
  };

  // Draw comparison waveform (Original vs Processed)
  useEffect(() => {
    if (!canvasRef.current || !sample?.audioBuffer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Dark Studio Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#06060B');
    bgGrad.addColorStop(1, '#020204');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Center grid line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const origBuffer = sample.audioBuffer;
    const procBuffer = processedBuffer || origBuffer;

    const origData = origBuffer.getChannelData(0);
    const procData = procBuffer.getChannelData(0);

    // 1. Draw Original Ghost Waveform (Translucent Purple/Gray)
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const origStep = Math.max(1, Math.floor(origData.length / width));
    for (let x = 0; x < width; x++) {
      const idx = x * origStep;
      if (idx < origData.length) {
        const val = origData[idx];
        const y = height / 2 - val * (height * 0.42);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // 2. Draw Transformed Processed Waveform (Neon Cyan / Gold Glow)
    const procStep = Math.max(1, Math.floor(procData.length / width));
    const waveGrad = ctx.createLinearGradient(0, 0, 0, height);
    waveGrad.addColorStop(0, 'rgba(0, 240, 255, 0.85)');
    waveGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.15)');
    waveGrad.addColorStop(1, 'rgba(0, 240, 255, 0.85)');

    ctx.strokeStyle = '#00F0FF';
    ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.4;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const idx = x * procStep;
      if (idx < procData.length) {
        const val = procData[idx];
        const y = height / 2 - val * (height * 0.44);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [sample, processedBuffer]);

  // Preset Loader
  const handleLoadPreset = (presetId: string) => {
    const found = DSP_RACK_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setConfig({ ...found, stutter: { ...found.stutter, bpm: sample?.bpm || found.stutter.bpm } });
      setStatusMessage(`Preset appliqué : ${found.name}`);
      setTimeout(() => setStatusMessage(null), 2500);
    }
  };

  // Mutation / Randomize Sound Design
  const handleRandomize = () => {
    const randomPreset = DSP_RACK_PRESETS[Math.floor(Math.random() * DSP_RACK_PRESETS.length)];
    setConfig({ ...randomPreset });
    setStatusMessage(`Mutation Aléatoire : ${randomPreset.name}`);
    setTimeout(() => setStatusMessage(null), 2500);
  };

  // Reset to default
  const handleReset = () => {
    setConfig({ ...DEFAULT_DSP_RACK_CONFIG });
    setStatusMessage('Rack réinitialisé à zéro (Clean Neutral)');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  // Export & Save as New Sample
  const handleSaveAsNew = async () => {
    if (!processedBuffer || !sample) return;
    try {
      const wavBlob = audioBufferToWavBlob(processedBuffer, { bitDepth: 24, normalize: false });
      const metrics = calculateAudioMetrics(processedBuffer);
      const newName = `${sample.name.replace(/\.[^/.]+$/, '')}_FX.wav`;

      const newSample: SampleItem = {
        ...sample,
        id: `sample-fx-${Date.now().toString(36)}`,
        name: newName,
        originalFileName: newName,
        duration: processedBuffer.duration,
        sampleRate: processedBuffer.sampleRate,
        channels: processedBuffer.numberOfChannels,
        peakDb: metrics.peakDb,
        rmsDb: metrics.rmsDb,
        dynamicRangeDb: metrics.dynamicRangeDb,
        lufs: metrics.lufs,
        zeroCrossingRate: metrics.zeroCrossingRate,
        spectralCentroid: metrics.spectralCentroid,
        tags: [...sample.tags, 'fx-processed'],
        dateAdded: Date.now(),
        audioBuffer: processedBuffer,
        blobUrl: URL.createObjectURL(wavBlob),
        slices: [],
      };

      if (onSaveAsNewSample) {
        onSaveAsNewSample(newSample);
      }
      setStatusMessage(`Nouveau sample créé : ${newName}`);
      setTimeout(() => {
        setStatusMessage(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error saving new sample:', err);
    }
  };

  // Overwrite current sample
  const handleOverwrite = () => {
    if (!processedBuffer || !sample) return;
    const wavBlob = audioBufferToWavBlob(processedBuffer, { bitDepth: 24, normalize: false });
    const metrics = calculateAudioMetrics(processedBuffer);

    const updatedSample: SampleItem = {
      ...sample,
      duration: processedBuffer.duration,
      sampleRate: processedBuffer.sampleRate,
      channels: processedBuffer.numberOfChannels,
      peakDb: metrics.peakDb,
      rmsDb: metrics.rmsDb,
      dynamicRangeDb: metrics.dynamicRangeDb,
      lufs: metrics.lufs,
      zeroCrossingRate: metrics.zeroCrossingRate,
      spectralCentroid: metrics.spectralCentroid,
      audioBuffer: processedBuffer,
      blobUrl: URL.createObjectURL(wavBlob),
    };

    if (onOverwriteSample) {
      onOverwriteSample(updatedSample);
    }
    setStatusMessage('Sample mis à jour avec succès !');
    setTimeout(() => {
      setStatusMessage(null);
      onClose();
    }, 1200);
  };

  // Direct WAV Download
  const handleDownloadWav = () => {
    if (!processedBuffer || !sample) return;
    const blob = audioBufferToWavBlob(processedBuffer, { bitDepth: 24 });
    const filename = `${sample.name.replace(/\.[^/.]+$/, '')}_Transformed.wav`;
    triggerFileDownload(blob, filename);
  };

  if (!isOpen || !sample) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-6xl h-[94vh] bg-[#0A0A10] border-2 border-[#202030] flex flex-col shadow-2xl pixel-box text-[#EDEDEE] overflow-hidden">
        {/* ======================================================== */}
        {/* HEADER                                                   */}
        {/* ======================================================== */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0E0E18] border-b border-[#202030]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF]">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-pixel font-bold text-[#00F0FF] uppercase tracking-wider flex items-center gap-2">
                STUDIO DSP FX RACK & TRANSFORMATION AUDIO
              </h2>
              <p className="text-[10px] font-mono text-[#8E8E98]">
                Basses profondes 808, saccades rythmiques, décalages delay, shimmer, saturation analogique & chirurgie sonore
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {statusMessage && (
              <span className="px-2.5 py-1 bg-[#10B981]/20 border border-[#10B981] text-[#34D399] text-[10px] font-mono animate-in fade-in">
                {statusMessage}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1 text-[#8E8E98] hover:text-white hover:bg-[#1C1C28] pixel-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PRESETS & QUICK SOUND DESIGN BAR                         */}
        {/* ======================================================== */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[#08080E] border-b border-[#1A1A26]">
          {/* Preset Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-[#FFE600] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              RECETTES CRÉATIVES :
            </span>
            <select
              onChange={(e) => handleLoadPreset(e.target.value)}
              className="bg-[#12121C] text-[#00F0FF] border border-[#242436] px-2 py-1 text-xs font-mono outline-none rounded"
              defaultValue=""
            >
              <option value="" disabled>
                -- Charger un Preset DSP --
              </option>
              {DSP_RACK_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category})
                </option>
              ))}
            </select>

            <button
              onClick={handleRandomize}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#A855F7]/20 hover:bg-[#A855F7]/30 text-[#A855F7] border border-[#A855F7]/50 text-xs font-mono transition"
              title="Générer une mutation sonore aléatoire"
            >
              <RefreshCw className="w-3 h-3" />
              <span>MUTATION ALÉATOIRE</span>
            </button>

            <button
              onClick={handleReset}
              className="px-2 py-1 bg-[#141420] text-[#8E8E98] hover:text-white border border-[#222232] text-xs font-mono transition"
              title="Remettre tous les effets à zéro"
            >
              RÉINITIALISER
            </button>
          </div>

          {/* Master Dry/Wet & Gain Controls */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-[#8E8E98]">MIX GLOBAL :</span>
              <input
                type="range"
                min="0"
                max="100"
                value={config.dryWetBalance}
                onChange={(e) => setConfig({ ...config, dryWetBalance: Number(e.target.value) })}
                className="w-20 accent-[#00F0FF] cursor-pointer"
              />
              <span className="text-[#00F0FF] font-bold w-9 text-right">{config.dryWetBalance}%</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[#8E8E98]">OUT GAIN :</span>
              <input
                type="range"
                min="-18"
                max="12"
                step="0.5"
                value={config.masterGainDb}
                onChange={(e) => setConfig({ ...config, masterGainDb: Number(e.target.value) })}
                className="w-16 accent-[#FFE600] cursor-pointer"
              />
              <span className="text-[#FFE600] font-bold w-12 text-right">{config.masterGainDb > 0 ? `+${config.masterGainDb}` : config.masterGainDb} dB</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* WAVEFORM MONITOR & AUDITION TRANSPORT BAR                */}
        {/* ======================================================== */}
        <div className="p-3 bg-[#06060A] border-b border-[#1E1E2C] flex flex-col gap-2">
          {/* Comparison Waveform Canvas */}
          <div className="relative w-full h-24 bg-[#030306] border border-[#1C1C28] overflow-hidden">
            <canvas ref={canvasRef} width={1000} height={96} className="w-full h-full block" />
            
            {/* Top legend overlay */}
            <div className="absolute top-1.5 left-2 flex items-center gap-3 text-[9px] font-mono">
              <div className="flex items-center gap-1 text-[#A855F7]">
                <span className="w-2.5 h-0.5 bg-[#A855F7] inline-block"></span>
                <span>ORIGINAL (BRUT)</span>
              </div>
              <div className="flex items-center gap-1 text-[#00F0FF] font-bold">
                <span className="w-2.5 h-0.5 bg-[#00F0FF] inline-block"></span>
                <span>TRAITÉ (DSP FX RACK)</span>
              </div>
              {isProcessing && (
                <span className="text-[#FFE600] animate-pulse">● CALCUL DSP EN COURS...</span>
              )}
            </div>

            {/* Duration and specs */}
            <div className="absolute bottom-1 right-2 text-[9px] font-mono text-[#8E8E98]">
              {processedBuffer
                ? `${processedBuffer.duration.toFixed(2)}s • ${processedBuffer.sampleRate} Hz • 24-bit PCM`
                : `${sample.duration.toFixed(2)}s`}
            </div>
          </div>

          {/* Transport Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePlay}
                className={`px-4 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 transition ${
                  isPlaying
                    ? 'bg-[#FFE600] text-black hover:bg-[#FACC15]'
                    : 'bg-[#00F0FF] text-black hover:bg-[#38BDF8]'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>ARRÊTER</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>ÉCOUTER</span>
                  </>
                )}
              </button>

              {/* A/B Comparison Toggle */}
              <div className="flex items-center bg-[#12121C] border border-[#222232] rounded p-0.5 text-xs font-mono">
                <button
                  onClick={() => setPreviewMode('dry')}
                  className={`px-2 py-0.5 rounded transition ${
                    previewMode === 'dry' ? 'bg-[#A855F7] text-black font-bold' : 'text-[#8E8E98] hover:text-white'
                  }`}
                >
                  BRUT (DRY)
                </button>
                <button
                  onClick={() => setPreviewMode('processed')}
                  className={`px-2 py-0.5 rounded transition ${
                    previewMode === 'processed' ? 'bg-[#00F0FF] text-black font-bold' : 'text-[#8E8E98] hover:text-white'
                  }`}
                >
                  AVEC EFFETS (WET)
                </button>
              </div>
            </div>

            <div className="text-[11px] font-mono text-[#8E8E98]">
              Sample source : <strong className="text-white">{sample.name}</strong>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MODULAR FX RACK NAVIGATION TABS                          */}
        {/* ======================================================== */}
        <div className="flex border-b border-[#1E1E2C] bg-[#09090F] overflow-x-auto text-xs font-mono">
          <button
            onClick={() => setActiveTab('sub-bass')}
            className={`px-3.5 py-2 flex items-center gap-1.5 border-r border-[#1E1E2C] transition whitespace-nowrap ${
              activeTab === 'sub-bass'
                ? 'bg-[#141424] text-[#00F0FF] font-bold border-b-2 border-b-[#00F0FF]'
                : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${config.subBass.enabled ? 'bg-[#00F0FF]' : 'bg-[#4B4B58]'}`} />
            <span>1. BASSES PROFONDES & 808</span>
          </button>

          <button
            onClick={() => setActiveTab('stutter')}
            className={`px-3.5 py-2 flex items-center gap-1.5 border-r border-[#1E1E2C] transition whitespace-nowrap ${
              activeTab === 'stutter'
                ? 'bg-[#141424] text-[#FFE600] font-bold border-b-2 border-b-[#FFE600]'
                : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${config.stutter.enabled ? 'bg-[#FFE600]' : 'bg-[#4B4B58]'}`} />
            <span>2. SACCADES & TRANCE GATE</span>
          </button>

          <button
            onClick={() => setActiveTab('delay-reverb')}
            className={`px-3.5 py-2 flex items-center gap-1.5 border-r border-[#1E1E2C] transition whitespace-nowrap ${
              activeTab === 'delay-reverb'
                ? 'bg-[#141424] text-[#A855F7] font-bold border-b-2 border-b-[#A855F7]'
                : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${config.delay.enabled || config.reverb.enabled ? 'bg-[#A855F7]' : 'bg-[#4B4B58]'}`} />
            <span>3. DELAY & SHIMMER REVERB</span>
          </button>

          <button
            onClick={() => setActiveTab('distortion')}
            className={`px-3.5 py-2 flex items-center gap-1.5 border-r border-[#1E1E2C] transition whitespace-nowrap ${
              activeTab === 'distortion'
                ? 'bg-[#141424] text-[#EF4444] font-bold border-b-2 border-b-[#EF4444]'
                : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${config.distortion.enabled ? 'bg-[#EF4444]' : 'bg-[#4B4B58]'}`} />
            <span>4. SATURATION & 12-BIT LO-FI</span>
          </button>

          <button
            onClick={() => setActiveTab('modulation')}
            className={`px-3.5 py-2 flex items-center gap-1.5 border-r border-[#1E1E2C] transition whitespace-nowrap ${
              activeTab === 'modulation'
                ? 'bg-[#141424] text-[#EC4899] font-bold border-b-2 border-b-[#EC4899]'
                : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${config.modulation.enabled ? 'bg-[#EC4899]' : 'bg-[#4B4B58]'}`} />
            <span>5. CHORUS & HAAS 3D</span>
          </button>

          <button
            onClick={() => setActiveTab('filter')}
            className={`px-3.5 py-2 flex items-center gap-1.5 border-r border-[#1E1E2C] transition whitespace-nowrap ${
              activeTab === 'filter'
                ? 'bg-[#141424] text-[#10B981] font-bold border-b-2 border-b-[#10B981]'
                : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${config.filter.enabled ? 'bg-[#10B981]' : 'bg-[#4B4B58]'}`} />
            <span>6. FILTRE ACID & LFO</span>
          </button>

          <button
            onClick={() => setActiveTab('transient-pitch')}
            className={`px-3.5 py-2 flex items-center gap-1.5 border-r border-[#1E1E2C] transition whitespace-nowrap ${
              activeTab === 'transient-pitch'
                ? 'bg-[#141424] text-[#38BDF8] font-bold border-b-2 border-b-[#38BDF8]'
                : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${config.transient.enabled || config.pitchRing.enabled ? 'bg-[#38BDF8]' : 'bg-[#4B4B58]'}`} />
            <span>7. PUNCH & PITCH / RING MOD</span>
          </button>

          <button
            onClick={() => setActiveTab('surgical')}
            className={`px-3.5 py-2 flex items-center gap-1.5 border-r border-[#1E1E2C] transition whitespace-nowrap ${
              activeTab === 'surgical'
                ? 'bg-[#141424] text-[#F97316] font-bold border-b-2 border-b-[#F97316]'
                : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${config.surgical.reverse || config.surgical.tapeStopBrakeSec > 0 ? 'bg-[#F97316]' : 'bg-[#4B4B58]'}`} />
            <span>8. GESTES & CHIRURGIE (TAPE STOP)</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB CONTENT: MODULE CONTROLS & KNOBS                     */}
        {/* ======================================================== */}
        <div className="flex-1 p-4 overflow-y-auto bg-[#07070C]">
          {/* TAB 1: SUB & DEEP BASS ENHANCER */}
          {activeTab === 'sub-bass' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between p-3 bg-[#0D0D18] border border-[#00F0FF]/30">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#00F0FF]" />
                  <div>
                    <h3 className="text-xs font-pixel font-bold text-[#00F0FF]">
                      AMPLIFICATEUR DE BASSES PROFONDES & GÉNÉRATEUR SUB-HARMONIQUE
                    </h3>
                    <p className="text-[10px] font-mono text-[#8E8E98]">
                      Génère une harmonique sous-jacente à l'octave inférieure (-12 demi-tons), sature le bas du spectre façon 808 et recentre le sub en mono.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-mono text-[#8E8E98]">ACTIVER :</span>
                  <input
                    type="checkbox"
                    checked={config.subBass.enabled}
                    onChange={(e) =>
                      setConfig({ ...config, subBass: { ...config.subBass, enabled: e.target.checked } })
                    }
                    className="w-4 h-4 accent-[#00F0FF]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* Boost Gain */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Boost Basses (dB)</span>
                    <span className="text-[#00F0FF] font-bold">+{config.subBass.boostDb} dB</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    step="0.5"
                    value={config.subBass.boostDb}
                    onChange={(e) =>
                      setConfig({ ...config, subBass: { ...config.subBass, boostDb: Number(e.target.value) } })
                    }
                    className="w-full accent-[#00F0FF]"
                  />
                </div>

                {/* Sub Frequency */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Fréquence Cible Sub</span>
                    <span className="text-[#00F0FF] font-bold">{config.subBass.frequency} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="140"
                    value={config.subBass.frequency}
                    onChange={(e) =>
                      setConfig({ ...config, subBass: { ...config.subBass, frequency: Number(e.target.value) } })
                    }
                    className="w-full accent-[#00F0FF]"
                  />
                </div>

                {/* Sub Harmonics Generator */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Générateur Sous-Octave</span>
                    <span className="text-[#00F0FF] font-bold">{config.subBass.subHarmonics}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.subBass.subHarmonics}
                    onChange={(e) =>
                      setConfig({ ...config, subBass: { ...config.subBass, subHarmonics: Number(e.target.value) } })
                    }
                    className="w-full accent-[#00F0FF]"
                  />
                </div>

                {/* 808 Drive Saturation */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Saturation 808 Drive</span>
                    <span className="text-[#FFE600] font-bold">{config.subBass.subDrive}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.subBass.subDrive}
                    onChange={(e) =>
                      setConfig({ ...config, subBass: { ...config.subBass, subDrive: Number(e.target.value) } })
                    }
                    className="w-full accent-[#FFE600]"
                  />
                </div>

                {/* Mono Sub Filter */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Mono Sub Maker (Club)</span>
                    <span className="text-[#10B981] font-bold">&lt; {config.subBass.monoSubCutoff} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="250"
                    value={config.subBass.monoSubCutoff}
                    onChange={(e) =>
                      setConfig({ ...config, subBass: { ...config.subBass, monoSubCutoff: Number(e.target.value) } })
                    }
                    className="w-full accent-[#10B981]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STUTTER & TRANCE GATE */}
          {activeTab === 'stutter' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between p-3 bg-[#0D0D18] border border-[#FFE600]/30">
                <div className="flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-[#FFE600]" />
                  <div>
                    <h3 className="text-xs font-pixel font-bold text-[#FFE600]">
                      HACHOIR RYTHMIQUE (STUTTER / TRANCE GATE / SACCADES)
                    </h3>
                    <p className="text-[10px] font-mono text-[#8E8E98]">
                      Découpe et saccade le son de manière synchronisée au tempo (1/4 à 1/64, glitch ou trémolo fluide).
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-mono text-[#8E8E98]">ACTIVER :</span>
                  <input
                    type="checkbox"
                    checked={config.stutter.enabled}
                    onChange={(e) =>
                      setConfig({ ...config, stutter: { ...config.stutter, enabled: e.target.checked } })
                    }
                    className="w-4 h-4 accent-[#FFE600]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* Rhythmic Division */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <span className="text-xs font-mono text-[#EDEDEE]">Division Temporelle</span>
                  <select
                    value={config.stutter.division}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        stutter: { ...config.stutter, division: e.target.value as any },
                      })
                    }
                    className="w-full bg-[#141420] text-[#FFE600] border border-[#242436] p-1.5 text-xs font-mono rounded outline-none"
                  >
                    <option value="1/4">1/4 (Noire)</option>
                    <option value="1/8">1/8 (Croche)</option>
                    <option value="1/8T">1/8T (Triolet)</option>
                    <option value="1/16">1/16 (Double-Croche / Glitch)</option>
                    <option value="1/16T">1/16T (Triolet Double)</option>
                    <option value="1/32">1/32 (Roll Rapide)</option>
                    <option value="1/64">1/64 (Micro-Stutter)</option>
                  </select>
                </div>

                {/* Gate Shape */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <span className="text-xs font-mono text-[#EDEDEE]">Forme de la Saccade</span>
                  <select
                    value={config.stutter.shape}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        stutter: { ...config.stutter, shape: e.target.value as any },
                      })
                    }
                    className="w-full bg-[#141420] text-[#FFE600] border border-[#242436] p-1.5 text-xs font-mono rounded outline-none"
                  >
                    <option value="hard-gate">Hachoir Net (Square Glitch)</option>
                    <option value="smooth-tremolo">Trémolo Fluide (Sine Wave)</option>
                    <option value="random-glitch">Glitch Chaotique Aléatoire</option>
                  </select>
                </div>

                {/* Duty Cycle */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Largeur de Porte (Duty)</span>
                    <span className="text-[#FFE600] font-bold">{config.stutter.dutyCycle}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={config.stutter.dutyCycle}
                    onChange={(e) =>
                      setConfig({ ...config, stutter: { ...config.stutter, dutyCycle: Number(e.target.value) } })
                    }
                    className="w-full accent-[#FFE600]"
                  />
                </div>

                {/* BPM Sync */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Tempo (BPM)</span>
                    <span className="text-[#34D399] font-bold">{config.stutter.bpm} BPM</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={config.stutter.bpm}
                    onChange={(e) =>
                      setConfig({ ...config, stutter: { ...config.stutter, bpm: Number(e.target.value) } })
                    }
                    className="w-full accent-[#34D399]"
                  />
                </div>

                {/* Stutter Mix */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Mix Saccade</span>
                    <span className="text-[#FFE600] font-bold">{config.stutter.mix}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.stutter.mix}
                    onChange={(e) =>
                      setConfig({ ...config, stutter: { ...config.stutter, mix: Number(e.target.value) } })
                    }
                    className="w-full accent-[#FFE600]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DELAY & SHIMMER REVERB */}
          {activeTab === 'delay-reverb' && (
            <div className="space-y-4 max-w-4xl">
              {/* SECTION DELAY */}
              <div className="p-3 bg-[#0D0D18] border border-[#A855F7]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#A855F7]" />
                    <h3 className="text-xs font-pixel font-bold text-[#A855F7]">
                      DELAY STÉRÉO PING-PONG & ÉCHO À BANDE (TAPE WOW)
                    </h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-mono text-[#8E8E98]">ACTIVER :</span>
                    <input
                      type="checkbox"
                      checked={config.delay.enabled}
                      onChange={(e) =>
                        setConfig({ ...config, delay: { ...config.delay, enabled: e.target.checked } })
                      }
                      className="w-4 h-4 accent-[#A855F7]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <span className="text-[11px] font-mono text-[#EDEDEE]">Temps / Synchro</span>
                    <select
                      value={config.delay.syncDivision}
                      onChange={(e) =>
                        setConfig({ ...config, delay: { ...config.delay, syncDivision: e.target.value as any } })
                      }
                      className="w-full bg-[#141420] text-[#A855F7] border border-[#242436] p-1 text-xs font-mono rounded"
                    >
                      <option value="1/16">1/16 Double</option>
                      <option value="1/8">1/8 Croche</option>
                      <option value="1/8D">1/8D Pointée</option>
                      <option value="1/4">1/4 Noire</option>
                      <option value="1/2">1/2 Blanche</option>
                    </select>
                  </div>

                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span>Feedback</span>
                      <span className="text-[#A855F7] font-bold">{config.delay.feedback}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="95"
                      value={config.delay.feedback}
                      onChange={(e) =>
                        setConfig({ ...config, delay: { ...config.delay, feedback: Number(e.target.value) } })
                      }
                      className="w-full accent-[#A855F7]"
                    />
                  </div>

                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span>Amortissement (Hz)</span>
                      <span className="text-[#A855F7] font-bold">{config.delay.dampingHz} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="18000"
                      step="500"
                      value={config.delay.dampingHz}
                      onChange={(e) =>
                        setConfig({ ...config, delay: { ...config.delay, dampingHz: Number(e.target.value) } })
                      }
                      className="w-full accent-[#A855F7]"
                    />
                  </div>

                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span>Mix Delay</span>
                      <span className="text-[#A855F7] font-bold">{config.delay.mix}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.delay.mix}
                      onChange={(e) =>
                        setConfig({ ...config, delay: { ...config.delay, mix: Number(e.target.value) } })
                      }
                      className="w-full accent-[#A855F7]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION REVERB & SHIMMER */}
              <div className="p-3 bg-[#0D0D18] border border-[#EC4899]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#EC4899]" />
                    <h3 className="text-xs font-pixel font-bold text-[#EC4899]">
                      RÉVERBÉRATION SPATIALE & SHIMMER CÉLESTE (+12 SEMITONES)
                    </h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-mono text-[#8E8E98]">ACTIVER :</span>
                    <input
                      type="checkbox"
                      checked={config.reverb.enabled}
                      onChange={(e) =>
                        setConfig({ ...config, reverb: { ...config.reverb, enabled: e.target.checked } })
                      }
                      className="w-4 h-4 accent-[#EC4899]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <span className="text-[11px] font-mono text-[#EDEDEE]">Type de Pièce</span>
                    <select
                      value={config.reverb.roomSize}
                      onChange={(e) =>
                        setConfig({ ...config, reverb: { ...config.reverb, roomSize: e.target.value as any } })
                      }
                      className="w-full bg-[#141420] text-[#EC4899] border border-[#242436] p-1 text-xs font-mono rounded"
                    >
                      <option value="small-room">Petite Pièce (Room)</option>
                      <option value="studio-plate">Plaque Studio (Plate)</option>
                      <option value="concert-hall">Salle de Concert (Hall)</option>
                      <option value="cathedral">Cathédrale Immense</option>
                      <option value="cosmic-void">Vide Cosmique Infini</option>
                    </select>
                  </div>

                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span>Temps Déclin (s)</span>
                      <span className="text-[#EC4899] font-bold">{config.reverb.decaySec} s</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="12"
                      step="0.2"
                      value={config.reverb.decaySec}
                      onChange={(e) =>
                        setConfig({ ...config, reverb: { ...config.reverb, decaySec: Number(e.target.value) } })
                      }
                      className="w-full accent-[#EC4899]"
                    />
                  </div>

                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span>Shimmer (+1 Octave)</span>
                      <span className="text-[#FFE600] font-bold">{config.reverb.shimmer}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.reverb.shimmer}
                      onChange={(e) =>
                        setConfig({ ...config, reverb: { ...config.reverb, shimmer: Number(e.target.value) } })
                      }
                      className="w-full accent-[#FFE600]"
                    />
                  </div>

                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span>Mix Réverb</span>
                      <span className="text-[#EC4899] font-bold">{config.reverb.mix}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.reverb.mix}
                      onChange={(e) =>
                        setConfig({ ...config, reverb: { ...config.reverb, mix: Number(e.target.value) } })
                      }
                      className="w-full accent-[#EC4899]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SATURATION, OVERDRIVE & 12-BIT BITCRUSHER */}
          {activeTab === 'distortion' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between p-3 bg-[#0D0D18] border border-[#EF4444]/30">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#EF4444]" />
                  <div>
                    <h3 className="text-xs font-pixel font-bold text-[#EF4444]">
                      DISTORSION ANALOGIQUE, WAVEFOLDER & BITCRUSHER 12-BIT VINTAGE
                    </h3>
                    <p className="text-[10px] font-mono text-[#8E8E98]">
                      Chaleur à lampes, wavefolding west-coast, réduction de résolution (SP-1200 / Amiga) et souffle de bande.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-mono text-[#8E8E98]">ACTIVER :</span>
                  <input
                    type="checkbox"
                    checked={config.distortion.enabled}
                    onChange={(e) =>
                      setConfig({ ...config, distortion: { ...config.distortion, enabled: e.target.checked } })
                    }
                    className="w-4 h-4 accent-[#EF4444]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* Saturation Type */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <span className="text-xs font-mono text-[#EDEDEE]">Type de Saturation</span>
                  <select
                    value={config.distortion.driveType}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        distortion: { ...config.distortion, driveType: e.target.value as any },
                      })
                    }
                    className="w-full bg-[#141420] text-[#EF4444] border border-[#242436] p-1.5 text-xs font-mono rounded outline-none"
                  >
                    <option value="tube-warmth">Lampe Chaude (Tube Warmth)</option>
                    <option value="tape-sat">Bande Magnétique (Tape Sat)</option>
                    <option value="hard-clip">Écrêtage Dur (Hard Clip)</option>
                    <option value="wavefolder">Pliage d'Onde (Wavefolder)</option>
                    <option value="germanium-fuzz">Fuzz Germanium Agressive</option>
                  </select>
                </div>

                {/* Gain Drive */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Gain / Drive (dB)</span>
                    <span className="text-[#EF4444] font-bold">+{config.distortion.gainDb} dB</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="36"
                    value={config.distortion.gainDb}
                    onChange={(e) =>
                      setConfig({ ...config, distortion: { ...config.distortion, gainDb: Number(e.target.value) } })
                    }
                    className="w-full accent-[#EF4444]"
                  />
                </div>

                {/* Bit Depth */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Résolution Bitcrusher</span>
                    <span className="text-[#FFE600] font-bold">{config.distortion.bitDepth}-Bit</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="16"
                    value={config.distortion.bitDepth}
                    onChange={(e) =>
                      setConfig({ ...config, distortion: { ...config.distortion, bitDepth: Number(e.target.value) } })
                    }
                    className="w-full accent-[#FFE600]"
                  />
                </div>

                {/* Downsample */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Sous-Échantillonnage</span>
                    <span className="text-[#00F0FF] font-bold">{config.distortion.downsample}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    value={config.distortion.downsample}
                    onChange={(e) =>
                      setConfig({ ...config, distortion: { ...config.distortion, downsample: Number(e.target.value) } })
                    }
                    className="w-full accent-[#00F0FF]"
                  />
                </div>

                {/* Analog Noise Hiss */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Bruit / Souffle Vinyle</span>
                    <span className="text-[#8E8E98] font-bold">{config.distortion.noiseHiss}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    value={config.distortion.noiseHiss}
                    onChange={(e) =>
                      setConfig({ ...config, distortion: { ...config.distortion, noiseHiss: Number(e.target.value) } })
                    }
                    className="w-full accent-[#8E8E98]"
                  />
                </div>

                {/* Mix */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Mix Distorsion</span>
                    <span className="text-[#EF4444] font-bold">{config.distortion.mix}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.distortion.mix}
                    onChange={(e) =>
                      setConfig({ ...config, distortion: { ...config.distortion, mix: Number(e.target.value) } })
                    }
                    className="w-full accent-[#EF4444]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MODULATION & HAAS 3D */}
          {activeTab === 'modulation' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between p-3 bg-[#0D0D18] border border-[#EC4899]/30">
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-[#EC4899]" />
                  <div>
                    <h3 className="text-xs font-pixel font-bold text-[#EC4899]">
                      MODULATION SPATIALE & ÉLARGISSEMENT STÉRÉO HAAS 3D
                    </h3>
                    <p className="text-[10px] font-mono text-[#8E8E98]">
                      Chorus multi-voix, flanger spatial, phaser à balayage et élargisseur stéréo psychoacoustique par micro-délai.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-mono text-[#8E8E98]">ACTIVER :</span>
                  <input
                    type="checkbox"
                    checked={config.modulation.enabled}
                    onChange={(e) =>
                      setConfig({ ...config, modulation: { ...config.modulation, enabled: e.target.checked } })
                    }
                    className="w-4 h-4 accent-[#EC4899]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <span className="text-xs font-mono text-[#EDEDEE]">Type d'Effet</span>
                  <select
                    value={config.modulation.type}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        modulation: { ...config.modulation, type: e.target.value as any },
                      })
                    }
                    className="w-full bg-[#141420] text-[#EC4899] border border-[#242436] p-1.5 text-xs font-mono rounded outline-none"
                  >
                    <option value="chorus">Chorus Doux Multi-Voix</option>
                    <option value="flanger">Flanger Jet Métallique</option>
                    <option value="phaser">Phaser 6-Pôles</option>
                    <option value="haas-widener">Élargisseur Stéréo Haas 3D</option>
                    <option value="dimension-d">Dimension D Spatializer</option>
                  </select>
                </div>

                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Vitesse / Rate (Hz)</span>
                    <span className="text-[#EC4899] font-bold">{config.modulation.rateHz} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={config.modulation.rateHz}
                    onChange={(e) =>
                      setConfig({ ...config, modulation: { ...config.modulation, rateHz: Number(e.target.value) } })
                    }
                    className="w-full accent-[#EC4899]"
                  />
                </div>

                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Profondeur (Depth)</span>
                    <span className="text-[#EC4899] font-bold">{config.modulation.depth}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.modulation.depth}
                    onChange={(e) =>
                      setConfig({ ...config, modulation: { ...config.modulation, depth: Number(e.target.value) } })
                    }
                    className="w-full accent-[#EC4899]"
                  />
                </div>

                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Micro-Délai Haas (ms)</span>
                    <span className="text-[#00F0FF] font-bold">{config.modulation.haasDelayMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="35"
                    value={config.modulation.haasDelayMs}
                    onChange={(e) =>
                      setConfig({ ...config, modulation: { ...config.modulation, haasDelayMs: Number(e.target.value) } })
                    }
                    className="w-full accent-[#00F0FF]"
                  />
                </div>

                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Mix Modulation</span>
                    <span className="text-[#EC4899] font-bold">{config.modulation.mix}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.modulation.mix}
                    onChange={(e) =>
                      setConfig({ ...config, modulation: { ...config.modulation, mix: Number(e.target.value) } })
                    }
                    className="w-full accent-[#EC4899]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: DYNAMIC FILTER & LFO */}
          {activeTab === 'filter' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between p-3 bg-[#0D0D18] border border-[#10B981]/30">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#10B981]" />
                  <div>
                    <h3 className="text-xs font-pixel font-bold text-[#10B981]">
                      FILTRE RÉSONANT DYNAMIQUE ACID 303 & MODULATION LFO
                    </h3>
                    <p className="text-[10px] font-mono text-[#8E8E98]">
                      Passe-bas 24dB, passe-haut, passe-bande, résonance acide extrême et balayage LFO automatique.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-mono text-[#8E8E98]">ACTIVER :</span>
                  <input
                    type="checkbox"
                    checked={config.filter.enabled}
                    onChange={(e) =>
                      setConfig({ ...config, filter: { ...config.filter, enabled: e.target.checked } })
                    }
                    className="w-4 h-4 accent-[#10B981]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <span className="text-xs font-mono text-[#EDEDEE]">Type de Filtre</span>
                  <select
                    value={config.filter.type}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        filter: { ...config.filter, type: e.target.value as any },
                      })
                    }
                    className="w-full bg-[#141420] text-[#10B981] border border-[#242436] p-1.5 text-xs font-mono rounded outline-none"
                  >
                    <option value="lowpass">Passe-Bas (Lowpass 24dB)</option>
                    <option value="highpass">Passe-Haut (Highpass)</option>
                    <option value="bandpass">Passe-Bande (Bandpass)</option>
                    <option value="notch">Filtre Réjecteur (Notch)</option>
                    <option value="acid-303">Acid TB-303 Résonant</option>
                  </select>
                </div>

                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Fréquence Coupure (Hz)</span>
                    <span className="text-[#10B981] font-bold">{config.filter.cutoffHz} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="18000"
                    value={config.filter.cutoffHz}
                    onChange={(e) =>
                      setConfig({ ...config, filter: { ...config.filter, cutoffHz: Number(e.target.value) } })
                    }
                    className="w-full accent-[#10B981]"
                  />
                </div>

                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Résonance (Q Peak)</span>
                    <span className="text-[#10B981] font-bold">{config.filter.resonance} Q</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="22"
                    step="0.5"
                    value={config.filter.resonance}
                    onChange={(e) =>
                      setConfig({ ...config, filter: { ...config.filter, resonance: Number(e.target.value) } })
                    }
                    className="w-full accent-[#10B981]"
                  />
                </div>

                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Balayage LFO Profondeur</span>
                    <span className="text-[#FFE600] font-bold">{config.filter.lfoDepth}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.filter.lfoDepth}
                    onChange={(e) =>
                      setConfig({ ...config, filter: { ...config.filter, lfoDepth: Number(e.target.value) } })
                    }
                    className="w-full accent-[#FFE600]"
                  />
                </div>

                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Vitesse LFO (Hz)</span>
                    <span className="text-[#FFE600] font-bold">{config.filter.lfoRateHz} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="15"
                    step="0.1"
                    value={config.filter.lfoRateHz}
                    onChange={(e) =>
                      setConfig({ ...config, filter: { ...config.filter, lfoRateHz: Number(e.target.value) } })
                    }
                    className="w-full accent-[#FFE600]"
                  />
                </div>

                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <span className="text-xs font-mono text-[#EDEDEE]">Forme LFO</span>
                  <select
                    value={config.filter.lfoShape}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        filter: { ...config.filter, lfoShape: e.target.value as any },
                      })
                    }
                    className="w-full bg-[#141420] text-[#FFE600] border border-[#242436] p-1.5 text-xs font-mono rounded outline-none"
                  >
                    <option value="sine">Sinusoïde (Sine)</option>
                    <option value="triangle">Triangle</option>
                    <option value="saw">Dent de Scie (Saw)</option>
                    <option value="square">Carré (Square)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: TRANSIENT SHAPER & PITCH / RING MOD */}
          {activeTab === 'transient-pitch' && (
            <div className="space-y-4 max-w-4xl">
              {/* Transient Shaper */}
              <div className="p-3 bg-[#0D0D18] border border-[#38BDF8]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#38BDF8]" />
                    <h3 className="text-xs font-pixel font-bold text-[#38BDF8]">
                      TRANSIENT SHAPER (ATTAQUE DU PUNCH & CORPS DU SOUTIEN)
                    </h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-mono text-[#8E8E98]">ACTIVER :</span>
                    <input
                      type="checkbox"
                      checked={config.transient.enabled}
                      onChange={(e) =>
                        setConfig({ ...config, transient: { ...config.transient, enabled: e.target.checked } })
                      }
                      className="w-4 h-4 accent-[#38BDF8]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span>Attaque Punch (dB)</span>
                      <span className="text-[#38BDF8] font-bold">{config.transient.attackDb > 0 ? `+${config.transient.attackDb}` : config.transient.attackDb} dB</span>
                    </div>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      value={config.transient.attackDb}
                      onChange={(e) =>
                        setConfig({ ...config, transient: { ...config.transient, attackDb: Number(e.target.value) } })
                      }
                      className="w-full accent-[#38BDF8]"
                    />
                  </div>

                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span>Soutien / Sustain (dB)</span>
                      <span className="text-[#38BDF8] font-bold">{config.transient.sustainDb > 0 ? `+${config.transient.sustainDb}` : config.transient.sustainDb} dB</span>
                    </div>
                    <input
                      type="range"
                      min="-18"
                      max="12"
                      value={config.transient.sustainDb}
                      onChange={(e) =>
                        setConfig({ ...config, transient: { ...config.transient, sustainDb: Number(e.target.value) } })
                      }
                      className="w-full accent-[#38BDF8]"
                    />
                  </div>

                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span>Vitesse Punch</span>
                      <span className="text-[#38BDF8] font-bold">{config.transient.punchSpeedMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={config.transient.punchSpeedMs}
                      onChange={(e) =>
                        setConfig({ ...config, transient: { ...config.transient, punchSpeedMs: Number(e.target.value) } })
                      }
                      className="w-full accent-[#38BDF8]"
                    />
                  </div>
                </div>
              </div>

              {/* Pitch Shifter & Ring Mod */}
              <div className="p-3 bg-[#0D0D18] border border-[#FFE600]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music className="w-5 h-5 text-[#FFE600]" />
                    <h3 className="text-xs font-pixel font-bold text-[#FFE600]">
                      PITCH TRANSPOSITION & MODULATEUR EN ANNEAU (RING MOD ROBOTIQUE)
                    </h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-mono text-[#8E8E98]">ACTIVER :</span>
                    <input
                      type="checkbox"
                      checked={config.pitchRing.enabled}
                      onChange={(e) =>
                        setConfig({ ...config, pitchRing: { ...config.pitchRing, enabled: e.target.checked } })
                      }
                      className="w-4 h-4 accent-[#FFE600]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span>Transposition Pitch (Demi-tons)</span>
                      <span className="text-[#FFE600] font-bold">{config.pitchRing.pitchSemitones > 0 ? `+${config.pitchRing.pitchSemitones}` : config.pitchRing.pitchSemitones} ST</span>
                    </div>
                    <input
                      type="range"
                      min="-24"
                      max="24"
                      value={config.pitchRing.pitchSemitones}
                      onChange={(e) =>
                        setConfig({ ...config, pitchRing: { ...config.pitchRing, pitchSemitones: Number(e.target.value) } })
                      }
                      className="w-full accent-[#FFE600]"
                    />
                  </div>

                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span>Fréquence Ring Mod (Hz)</span>
                      <span className="text-[#00F0FF] font-bold">{config.pitchRing.ringModFreqHz} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1500"
                      value={config.pitchRing.ringModFreqHz}
                      onChange={(e) =>
                        setConfig({ ...config, pitchRing: { ...config.pitchRing, ringModFreqHz: Number(e.target.value) } })
                      }
                      className="w-full accent-[#00F0FF]"
                    />
                  </div>

                  <div className="p-2.5 bg-[#08080E] border border-[#1E1E2C] space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span>Mix Ring Mod</span>
                      <span className="text-[#00F0FF] font-bold">{config.pitchRing.ringModMix}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.pitchRing.ringModMix}
                      onChange={(e) =>
                        setConfig({ ...config, pitchRing: { ...config.pitchRing, ringModMix: Number(e.target.value) } })
                      }
                      className="w-full accent-[#00F0FF]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: SURGICAL GESTURES & TAPE STOP */}
          {activeTab === 'surgical' && (
            <div className="space-y-4 max-w-4xl">
              <div className="p-3 bg-[#0D0D18] border border-[#F97316]/30 space-y-2">
                <div className="flex items-center gap-2 text-[#F97316]">
                  <Scissors className="w-5 h-5" />
                  <h3 className="text-xs font-pixel font-bold">
                    GESTES CRÉATIFS & CHIRURGIE AUDIO DE PRÉCISION
                  </h3>
                </div>
                <p className="text-[10px] font-mono text-[#8E8E98]">
                  Arrêt vinyle progressif (Tape Stop), inversion (Reverse), suppression de composante continue DC, fondu et normalisation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* Reverse */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-mono text-[#EDEDEE] font-bold">Inversion (Reverse)</span>
                    <p className="text-[9px] font-mono text-[#8E8E98]">Lit le son de droite à gauche</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.surgical.reverse}
                    onChange={(e) =>
                      setConfig({ ...config, surgical: { ...config.surgical, reverse: e.target.checked } })
                    }
                    className="w-5 h-5 accent-[#F97316]"
                  />
                </div>

                {/* Tape Stop Brake */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Freinage Vinyle (Tape Stop)</span>
                    <span className="text-[#F97316] font-bold">
                      {config.surgical.tapeStopBrakeSec > 0 ? `${config.surgical.tapeStopBrakeSec}s` : 'DÉSACTIVÉ'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2.5"
                    step="0.05"
                    value={config.surgical.tapeStopBrakeSec}
                    onChange={(e) =>
                      setConfig({ ...config, surgical: { ...config.surgical, tapeStopBrakeSec: Number(e.target.value) } })
                    }
                    className="w-full accent-[#F97316]"
                  />
                </div>

                {/* Fade In */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Fondu Entrée (Fade In)</span>
                    <span className="text-[#00F0FF] font-bold">{config.surgical.fadeInSec}s</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.02"
                    value={config.surgical.fadeInSec}
                    onChange={(e) =>
                      setConfig({ ...config, surgical: { ...config.surgical, fadeInSec: Number(e.target.value) } })
                    }
                    className="w-full accent-[#00F0FF]"
                  />
                </div>

                {/* Fade Out */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#EDEDEE]">Fondu Sortie (Fade Out)</span>
                    <span className="text-[#00F0FF] font-bold">{config.surgical.fadeOutSec}s</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.02"
                    value={config.surgical.fadeOutSec}
                    onChange={(e) =>
                      setConfig({ ...config, surgical: { ...config.surgical, fadeOutSec: Number(e.target.value) } })
                    }
                    className="w-full accent-[#00F0FF]"
                  />
                </div>

                {/* Peak Normalization */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-mono text-[#EDEDEE] font-bold">Normaliser Crête (-0.3 dBFS)</span>
                    <p className="text-[9px] font-mono text-[#8E8E98]">Maximise le niveau sans écrêter</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.surgical.normalizePeak}
                    onChange={(e) =>
                      setConfig({ ...config, surgical: { ...config.surgical, normalizePeak: e.target.checked } })
                    }
                    className="w-5 h-5 accent-[#10B981]"
                  />
                </div>

                {/* DC Offset Removal */}
                <div className="p-3 bg-[#0B0B14] border border-[#1E1E2C] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-mono text-[#EDEDEE] font-bold">Supprimer DC Offset</span>
                    <p className="text-[9px] font-mono text-[#8E8E98]">Recentre la forme d'onde sur 0V</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.surgical.removeDc}
                    onChange={(e) =>
                      setConfig({ ...config, surgical: { ...config.surgical, removeDc: e.target.checked } })
                    }
                    className="w-5 h-5 accent-[#38BDF8]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* FOOTER ACTIONS: EXPORT / SAVE AS NEW / OVERWRITE         */}
        {/* ======================================================== */}
        <div className="p-3 bg-[#0B0B14] border-t border-[#202030] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadWav}
              className="px-3 py-1.5 bg-[#1C1C28] hover:bg-[#28283C] text-[#EDEDEE] border border-[#343448] text-xs font-mono flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>TÉLÉCHARGER WAV (24-BIT)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOverwrite}
              className="px-3.5 py-1.5 bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#EF4444] border border-[#EF4444]/50 text-xs font-mono flex items-center gap-1.5 transition"
              title="Remplacer le fichier original par le son transformé"
            >
              <Check className="w-3.5 h-3.5" />
              <span>ÉCRASER LE SAMPLE ACTUEL</span>
            </button>

            <button
              onClick={handleSaveAsNew}
              className="px-4 py-1.5 bg-[#00F0FF] hover:bg-[#38BDF8] text-black font-bold text-xs font-mono flex items-center gap-1.5 shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span>CRÉER NOUVEAU SAMPLE DANS LA BIBLIOTHÈQUE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
