import React, { useRef, useEffect, memo } from 'react';
import { audioEngine } from '../services/audioEngine';
import { SampleType, SliceRegion } from '../types/sample';

interface MiniWaveformProps {
  audioBuffer?: AudioBuffer;
  sampleId?: string;
  type?: SampleType;
  isPlaying?: boolean;
  progress?: number; // 0 to 1
  width?: number;
  height?: number;
  slices?: SliceRegion[];
  color?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

// Peak cache to prevent recalculating on every render
const PEAKS_CACHE = new Map<string, Float32Array>();

function getPeaks(buffer: AudioBuffer, numBars: number, cacheKey?: string): Float32Array {
  if (cacheKey && PEAKS_CACHE.has(`${cacheKey}-${numBars}`)) {
    return PEAKS_CACHE.get(`${cacheKey}-${numBars}`)!;
  }

  const channelData = buffer.getChannelData(0);
  const bufferLength = channelData.length;
  const step = Math.floor(bufferLength / numBars);
  const peaks = new Float32Array(numBars);

  for (let i = 0; i < numBars; i++) {
    const start = i * step;
    let max = 0;
    for (let j = 0; j < step && start + j < bufferLength; j += 2) {
      const abs = Math.abs(channelData[start + j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }

  if (cacheKey) {
    PEAKS_CACHE.set(`${cacheKey}-${numBars}`, peaks);
  }

  return peaks;
}

const TYPE_COLORS: Record<string, { primary: string; secondary: string }> = {
  kick: { primary: '#00F0FF', secondary: '#0080FF' },
  '808': { primary: '#8B5CF6', secondary: '#6366F1' },
  snare: { primary: '#EF4444', secondary: '#F97316' },
  hihat: { primary: '#F59E0B', secondary: '#EAB308' },
  clap: { primary: '#F97316', secondary: '#EF4444' },
  cymbal: { primary: '#EAB308', secondary: '#F59E0B' },
  percussion: { primary: '#14B8A6', secondary: '#10B981' },
  bass: { primary: '#A78BFA', secondary: '#7C3AED' },
  lead: { primary: '#60A5FA', secondary: '#3B82F6' },
  pad: { primary: '#F472B6', secondary: '#EC4899' },
  vocal: { primary: '#E879F9', secondary: '#D946EF' },
  fx: { primary: '#818CF8', secondary: '#6366F1' },
  loop: { primary: '#34D399', secondary: '#10B981' },
  'multi-sound': { primary: '#00F0FF', secondary: '#3B82F6' },
  other: { primary: '#9CA3AF', secondary: '#6B7280' },
};

export const MiniWaveform: React.FC<MiniWaveformProps> = memo(({
  audioBuffer,
  sampleId,
  type = 'other',
  isPlaying = false,
  progress = 0,
  width = 110,
  height = 26,
  slices = [],
  color,
  className = '',
  onClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const numBars = Math.max(20, Math.floor(width / 2.5));
    const peaks = getPeaks(audioBuffer, numBars, sampleId);
    const colors = color
      ? { primary: color, secondary: color }
      : TYPE_COLORS[type] || TYPE_COLORS.other;

    const barWidth = Math.max(1.5, (width - numBars * 0.8) / numBars);
    const midY = height / 2;

    // Draw Slices indicator background if present
    if (slices && slices.length > 1 && audioBuffer.duration > 0) {
      slices.forEach((s) => {
        const xStart = (s.startSec / audioBuffer.duration) * width;
        ctx.fillStyle = s.color || 'rgba(0, 240, 255, 0.4)';
        ctx.fillRect(xStart, 0, 1, height);
      });
    }

    // Draw Waveform Bars
    for (let i = 0; i < numBars; i++) {
      const x = i * (barWidth + 0.8);
      const amp = Math.max(0.08, peaks[i]);
      const barHeight = Math.max(2, amp * (height * 0.85));

      const isPlayed = isPlaying && (x / width) <= progress;

      if (isPlayed) {
        ctx.fillStyle = '#FFFFFF';
      } else if (isPlaying) {
        ctx.fillStyle = colors.primary;
      } else {
        ctx.fillStyle = colors.primary;
        ctx.globalAlpha = 0.75;
      }

      // Rounded pill bar
      const topY = midY - barHeight / 2;
      ctx.beginPath();
      ctx.roundRect(x, topY, barWidth, barHeight, 1);
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;

    // Playhead line
    if (isPlaying && progress > 0) {
      const playheadX = Math.min(width - 1, progress * width);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = colors.primary;
      ctx.shadowBlur = 4;
      ctx.fillRect(playheadX, 0, 1.5, height);
      ctx.shadowBlur = 0;
    }
  }, [audioBuffer, sampleId, type, isPlaying, progress, width, height, slices, color]);

  if (!audioBuffer) {
    return (
      <div
        style={{ width, height }}
        className={`bg-[#141418] rounded border border-[#222226] flex items-center justify-center ${className}`}
      >
        <div className="w-8 h-[2px] bg-[#2A2A32] rounded" />
      </div>
    );
  }

  return (
    <div
      style={{ width, height }}
      onClick={onClick}
      className={`relative rounded overflow-hidden bg-[#0A0A0E] border border-[#20222C] hover:border-[#383B4C] transition-colors cursor-pointer shrink-0 ${className}`}
      title="Aperçu forme d'onde acoustique"
    >
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="block"
      />
    </div>
  );
});
