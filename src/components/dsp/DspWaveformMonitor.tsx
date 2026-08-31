import React, { useEffect, useRef } from 'react';
import { Volume2, Play, Pause, Repeat, Activity, Sparkles } from 'lucide-react';
import { SampleItem } from '../../types/sample';

interface DspWaveformMonitorProps {
  sample: SampleItem;
  processedBuffer: AudioBuffer | null;
  isPlaying: boolean;
  isProcessing: boolean;
  playbackProgress: number; // 0 to 1
  previewMode: 'processed' | 'dry';
  onTogglePreviewMode: (mode: 'processed' | 'dry') => void;
  isLiveAuditionLoop: boolean;
  onToggleLiveAuditionLoop: () => void;
  enabledCount: number;
}

export const DspWaveformMonitor: React.FC<DspWaveformMonitorProps> = ({
  sample,
  processedBuffer,
  isPlaying,
  isProcessing,
  playbackProgress,
  previewMode,
  onTogglePreviewMode,
  isLiveAuditionLoop,
  onToggleLiveAuditionLoop,
  enabledCount,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !sample?.audioBuffer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Deep Studio Background with subtle grid
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#07070D');
    bgGrad.addColorStop(1, '#020204');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Zero-crossing center line
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

    // 1. Draw Original Ghost Waveform (Translucent Purple)
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
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

    // 2. Draw Transformed Processed Waveform (Neon Cyan Glow)
    const procStep = Math.max(1, Math.floor(procData.length / width));
    ctx.strokeStyle = '#00F0FF';
    ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.5;
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

    // 3. Playhead Cursor if playing
    if (isPlaying && playbackProgress >= 0) {
      const playheadX = Math.min(width, Math.max(0, playbackProgress * width));
      ctx.strokeStyle = '#FFE600';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(255, 230, 0, 0.8)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [sample, processedBuffer, isPlaying, playbackProgress]);

  return (
    <div className="p-3 bg-[#06060C] border-b border-[#1E1E2C] flex flex-col gap-2 shrink-0 select-none">
      {/* Waveform Screen Canvas */}
      <div className="relative w-full h-20 sm:h-24 bg-[#030306] border border-[#1E1E2C] rounded overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          width={1200}
          height={96}
          className="w-full h-full block"
        />

        {/* Top Info Overlays */}
        <div className="absolute top-1.5 left-2 flex items-center gap-3 text-[9px] font-mono">
          <div className="flex items-center gap-1 text-[#A855F7]">
            <span className="w-2.5 h-0.5 bg-[#A855F7] inline-block"></span>
            <span>ORIGINAL (DRY)</span>
          </div>
          <div className="flex items-center gap-1 text-[#00F0FF] font-bold">
            <span className="w-2.5 h-0.5 bg-[#00F0FF] inline-block"></span>
            <span>TRAITÉ ({enabledCount} EFFETS)</span>
          </div>
          {isProcessing && (
            <span className="text-[#FFE600] font-bold animate-pulse flex items-center gap-1">
              <Activity className="w-3 h-3 animate-spin" /> CALCUL DSP EN TEMPS RÉEL...
            </span>
          )}
        </div>

        {/* Right audio specs */}
        <div className="absolute bottom-1 right-2 text-[9px] font-mono text-[#8E8E98] bg-[#0A0A14]/80 px-1.5 py-0.5 rounded border border-[#202030]">
          {processedBuffer
            ? `${processedBuffer.duration.toFixed(2)}s • ${processedBuffer.sampleRate} Hz • 24-bit PCM`
            : `${sample.duration.toFixed(2)}s`}
        </div>
      </div>

      {/* Monitor Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          {/* A/B Mode Toggle */}
          <div className="flex items-center bg-[#10101C] border border-[#222232] rounded p-0.5">
            <button
              onClick={() => onTogglePreviewMode('dry')}
              className={`px-2.5 py-1 rounded transition text-[11px] font-mono ${
                previewMode === 'dry'
                  ? 'bg-[#A855F7] text-black font-bold shadow'
                  : 'text-[#8E8E98] hover:text-white'
              }`}
            >
              BRUT (DRY)
            </button>
            <button
              onClick={() => onTogglePreviewMode('processed')}
              className={`px-2.5 py-1 rounded transition text-[11px] font-mono ${
                previewMode === 'processed'
                  ? 'bg-[#00F0FF] text-black font-bold shadow'
                  : 'text-[#8E8E98] hover:text-white'
              }`}
            >
              AVEC EFFETS (WET)
            </button>
          </div>

          {/* Auto-Loop Live Audition Button */}
          <button
            onClick={onToggleLiveAuditionLoop}
            className={`px-2.5 py-1 rounded border text-[11px] font-mono flex items-center gap-1.5 transition ${
              isLiveAuditionLoop
                ? 'bg-[#FFE600]/20 text-[#FFE600] border-[#FFE600]/60 font-bold ring-1 ring-[#FFE600]/30'
                : 'bg-[#12121E] text-[#8E8E98] border-[#222232] hover:text-white'
            }`}
            title="Lecture en boucle continue pour entendre les réglages des sliders en direct"
          >
            <Repeat className={`w-3 h-3 ${isLiveAuditionLoop ? 'animate-spin' : ''}`} />
            <span>{isLiveAuditionLoop ? 'BOUCLE CONTINUE : ON' : 'BOUCLE CONTINUE : OFF'}</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#8E8E98]">
          <span>Fichier source : <strong className="text-white">{sample.name}</strong></span>
          {sample.bpm && <span className="px-1.5 py-0.5 bg-[#141424] border border-[#242436] text-[#00F0FF] rounded font-bold">{sample.bpm} BPM</span>}
          {sample.key && <span className="px-1.5 py-0.5 bg-[#141424] border border-[#242436] text-[#FFE600] rounded font-bold">{sample.key}</span>}
        </div>
      </div>
    </div>
  );
};
