import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, ZoomIn, ZoomOut, Scissors, Repeat, Volume2, Sparkles, MoveHorizontal } from 'lucide-react';
import { SampleItem, SliceRegion } from '../types/sample';
import { audioEngine, PlaybackState } from '../services/audioEngine';

interface WaveformCanvasProps {
  sample: SampleItem;
  onSliceClick?: (slice: SliceRegion) => void;
  onOpenSlicer?: () => void;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  sample,
  onSliceClick,
  onOpenSlicer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [playbackState, setPlaybackState] = useState<PlaybackState>(audioEngine.getState());
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [scrollOffset, setScrollOffset] = useState<number>(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [activeSliceHover, setActiveSliceHover] = useState<SliceRegion | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<SliceRegion | null>(null);
  const [showChannels, setShowChannels] = useState<'both' | 'mono'>('both');
  const [showTransients, setShowTransients] = useState<boolean>(true);

  // Subscribe to audio engine updates
  useEffect(() => {
    const unsub = audioEngine.subscribe((st) => {
      setPlaybackState(st);
    });
    return () => unsub();
  }, []);

  const isCurrentSample = playbackState.sampleId === sample.id;
  const currentTime = isCurrentSample ? playbackState.currentTime : 0;
  const isPlaying = isCurrentSample && playbackState.isPlaying;

  // Render Waveform Canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sample.audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const buffer = sample.audioBuffer;
    const numChannels = buffer.numberOfChannels;
    const duration = buffer.duration;
    const channelHeight = showChannels === 'both' && numChannels > 1 ? height / 2 : height;

    // Clear background
    ctx.fillStyle = '#09090C'; // Deep geometric canvas
    ctx.fillRect(0, 0, width, height);

    // Draw Subtle Grid lines (time markers)
    ctx.strokeStyle = '#18181D';
    ctx.lineWidth = 1;
    const timeStep = duration > 5 ? 1 : duration > 1 ? 0.5 : 0.1;
    for (let t = 0; t <= duration; t += timeStep) {
      const x = ((t / duration) * width * zoomLevel) - scrollOffset;
      if (x >= 0 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Time label
        ctx.fillStyle = '#5A5A62';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(`${t.toFixed(2)}s`, x + 4, 12);
      }
    }

    // Zero-crossing center line
    ctx.strokeStyle = '#222228';
    ctx.beginPath();
    ctx.moveTo(0, channelHeight / 2);
    ctx.lineTo(width, channelHeight / 2);
    if (showChannels === 'both' && numChannels > 1) {
      ctx.moveTo(0, channelHeight + channelHeight / 2);
      ctx.lineTo(width, channelHeight + channelHeight / 2);
    }
    ctx.stroke();

    // Draw Slices background bands
    if (sample.slices && sample.slices.length > 0) {
      sample.slices.forEach((slice, idx) => {
        const xStart = ((slice.startSec / duration) * width * zoomLevel) - scrollOffset;
        const xEnd = ((slice.endSec / duration) * width * zoomLevel) - scrollOffset;
        const sliceWidth = Math.max(1, xEnd - xStart);

        const isHovered = activeSliceHover?.id === slice.id;
        const isSelected = selectedSlice?.id === slice.id;

        // Slice fill tint
        ctx.fillStyle = isSelected
          ? 'rgba(0, 240, 255, 0.18)'
          : isHovered
          ? 'rgba(139, 92, 246, 0.15)'
          : idx % 2 === 0
          ? 'rgba(18, 18, 23, 0.4)'
          : 'rgba(26, 26, 32, 0.3)';
        ctx.fillRect(xStart, 0, sliceWidth, height);

        // Slice boundary line
        ctx.strokeStyle = isSelected ? '#00F0FF' : slice.color || '#38bdf8';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xStart, 0);
        ctx.lineTo(xStart, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Slice index pill on top
        if (xStart >= -50 && xStart <= width) {
          ctx.fillStyle = slice.color || '#00F0FF';
          ctx.fillRect(xStart + 2, 4, 20, 13);
          ctx.fillStyle = '#0A0A0B';
          ctx.font = 'bold 8px "JetBrains Mono", monospace';
          ctx.fillText(`S${slice.index}`, xStart + 4, 13);
        }
      });
    }

    // Draw Waveform Data
    const channelsToDraw = showChannels === 'both' && numChannels > 1 ? 2 : 1;

    for (let c = 0; c < channelsToDraw; c++) {
      const channelData = buffer.getChannelData(c);
      const chOffset = c * channelHeight;
      const chCenter = chOffset + channelHeight / 2;
      const maxAmp = channelHeight * 0.45;

      const totalVisibleSamples = Math.floor(channelData.length / zoomLevel);
      const startSample = Math.floor((scrollOffset / (width * zoomLevel)) * channelData.length);
      const samplesPerPixel = Math.max(1, Math.floor(totalVisibleSamples / width));

      // Gradient for Waveform Bars
      const grad = ctx.createLinearGradient(0, chOffset, 0, chOffset + channelHeight);
      if (c === 0) {
        grad.addColorStop(0, '#38BDF8');
        grad.addColorStop(0.5, '#00F0FF');
        grad.addColorStop(1, '#0284C7');
      } else {
        grad.addColorStop(0, '#C084FC');
        grad.addColorStop(0.5, '#EC4899');
        grad.addColorStop(1, '#8B5CF6');
      }

      ctx.fillStyle = grad;

      for (let x = 0; x < width; x++) {
        const sampleIndex = startSample + x * samplesPerPixel;
        if (sampleIndex >= channelData.length) break;

        let min = 1.0;
        let max = -1.0;

        for (let s = 0; s < samplesPerPixel; s++) {
          const val = channelData[sampleIndex + s] || 0;
          if (val < min) min = val;
          if (val > max) max = val;
        }

        const yMin = chCenter - max * maxAmp;
        const yMax = chCenter - min * maxAmp;
        const barHeight = Math.max(1, yMax - yMin);

        ctx.fillRect(x, yMin, 1.2, barHeight);
      }
    }

    // Draw Transients Markers (if enabled)
    if (showTransients && sample.slices) {
      sample.slices.forEach((slice) => {
        const x = ((slice.startSec / duration) * width * zoomLevel) - scrollOffset;
        if (x >= 0 && x <= width) {
          ctx.fillStyle = '#F59E0B'; // sharp yellow marker
          ctx.beginPath();
          ctx.moveTo(x - 3, 0);
          ctx.lineTo(x + 3, 0);
          ctx.lineTo(x, 6);
          ctx.closePath();
          ctx.fill();
        }
      });
    }

    // Hover Scrub Line
    if (hoverTime !== null) {
      const hoverX = ((hoverTime / duration) * width * zoomLevel) - scrollOffset;
      if (hoverX >= 0 && hoverX <= width) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hoverX, 0);
        ctx.lineTo(hoverX, height);
        ctx.stroke();

        // Time tooltip
        ctx.fillStyle = 'rgba(10, 10, 11, 0.9)';
        ctx.fillRect(hoverX + 4, height - 20, 56, 16);
        ctx.fillStyle = '#EDEDEE';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(`${hoverTime.toFixed(3)}s`, hoverX + 7, height - 8);
      }
    }

    // Active Playhead Cursor
    if (isCurrentSample) {
      const playheadX = ((currentTime / duration) * width * zoomLevel) - scrollOffset;
      if (playheadX >= 0 && playheadX <= width) {
        // Glowing playhead line
        ctx.shadowColor = '#00F0FF';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Playhead handle top
        ctx.fillStyle = '#00F0FF';
        ctx.beginPath();
        ctx.moveTo(playheadX - 5, 0);
        ctx.lineTo(playheadX + 5, 0);
        ctx.lineTo(playheadX, 8);
        ctx.closePath();
        ctx.fill();
      }
    }
  }, [
    sample,
    zoomLevel,
    scrollOffset,
    showChannels,
    showTransients,
    activeSliceHover,
    selectedSlice,
    hoverTime,
    isCurrentSample,
    currentTime,
  ]);

  // Request redraw on state change
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Mouse interactions (Click to seek, Scrub, Drag, Slice Selection)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !sample.audioBuffer) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const duration = sample.audioBuffer.duration;
    const clickedTime = ((x + scrollOffset) / (rect.width * zoomLevel)) * duration;
    const clampedTime = Math.max(0, Math.min(duration, clickedTime));

    // Check if clicked inside a specific slice
    const clickedSlice = sample.slices?.find(
      (s) => clampedTime >= s.startSec && clampedTime <= s.endSec
    );

    if (clickedSlice) {
      setSelectedSlice(clickedSlice);
      if (onSliceClick) onSliceClick(clickedSlice);
    }

    // Play or seek
    if (sample.audioBuffer) {
      audioEngine.play(sample.audioBuffer, sample.id, {
        startSec: clampedTime,
        endSec: clickedSlice ? clickedSlice.endSec : duration,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !sample.audioBuffer) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const duration = sample.audioBuffer.duration;
    const time = ((x + scrollOffset) / (rect.width * zoomLevel)) * duration;
    const clampedTime = Math.max(0, Math.min(duration, time));

    setHoverTime(clampedTime);

    const hovered = sample.slices?.find(
      (s) => clampedTime >= s.startSec && clampedTime <= s.endSec
    );
    setActiveSliceHover(hovered || null);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
    setActiveSliceHover(null);
  };

  const handlePlayToggle = () => {
    if (!sample.audioBuffer) return;
    if (isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play(sample.audioBuffer, sample.id, {
        startSec: selectedSlice ? selectedSlice.startSec : 0,
        endSec: selectedSlice ? selectedSlice.endSec : sample.audioBuffer.duration,
      });
    }
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.max(1, Math.min(25, prev + delta)));
  };

  return (
    <div id={`waveform-container-${sample.id}`} className="flex flex-col bg-[#0D0D10] rounded-xl border border-[#222226] p-3 shadow-lg select-none" ref={containerRef}>
      {/* Top Waveform Controls Bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[#1E1E22] mb-2.5">
        <div className="flex items-center gap-2.5">
          {/* Big Audition / Play Button */}
          <button
            id="waveform-play-btn"
            onClick={handlePlayToggle}
            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold transition-all ${
              isPlaying
                ? 'bg-[#00F0FF] text-[#0A0A0B] shadow-xs'
                : 'bg-[#141417] hover:bg-[#1E1E23] text-[#00F0FF] border border-[#26262B]'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          {/* Sample Title & Metrics */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-[#EDEDEE] truncate max-w-xs">{sample.name}</h3>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold uppercase bg-[#18181D] text-[#00F0FF] border border-[#26262B]">
                {sample.format}
              </span>
              {sample.key && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30">
                  {sample.key}
                </span>
              )}
              {sample.bpm && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  {sample.bpm} BPM
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[#8E8E93] font-mono mt-0.5">
              <span>{currentTime.toFixed(3)}s / {sample.duration.toFixed(3)}s</span>
              <span>•</span>
              <span>{sample.sampleRate} Hz</span>
              <span>•</span>
              <span>{sample.bitDepth}-bit</span>
              <span>•</span>
              <span className="capitalize">{sample.channels === 2 ? 'Stereo' : 'Mono'}</span>
            </div>
          </div>
        </div>

        {/* View & Tool Options */}
        <div className="flex items-center gap-2">
          {/* Multi-sound Slicer Trigger */}
          {onOpenSlicer && (
            <button
              id="open-slicer-btn"
              onClick={onOpenSlicer}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30 text-xs font-semibold transition"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Découpe Auto {sample.slices?.length ? `(${sample.slices.length})` : ''}</span>
            </button>
          )}

          {/* Transients Toggle */}
          <button
            id="toggle-transients-btn"
            onClick={() => setShowTransients(!showTransients)}
            className={`p-1.5 rounded-lg border text-xs transition ${
              showTransients
                ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
                : 'bg-[#141417] text-[#8E8E93] border-[#26262B] hover:text-[#EDEDEE]'
            }`}
            title="Afficher les marqueurs de transitoires"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>

          {/* Channel view toggle */}
          <button
            id="toggle-channels-btn"
            onClick={() => setShowChannels(showChannels === 'both' ? 'mono' : 'both')}
            className="px-2 py-1 rounded-lg bg-[#141417] text-xs text-[#8E8E93] border border-[#26262B] hover:bg-[#1E1E23] hover:text-[#EDEDEE] font-mono transition text-[10px]"
            title="Afficher les canaux stéréo séparés ou sommés"
          >
            {showChannels === 'both' ? 'L / R' : 'Sum'}
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-[#141417] rounded-lg border border-[#26262B] p-0.5">
            <button
              id="zoom-out-btn"
              onClick={() => handleZoom(-1)}
              className="p-1 text-[#8E8E93] hover:text-[#EDEDEE] transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[9px] font-mono text-[#8E8E93] px-1">{zoomLevel}x</span>
            <button
              id="zoom-in-btn"
              onClick={() => handleZoom(1)}
              className="p-1 text-[#8E8E93] hover:text-[#EDEDEE] transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main High-Resolution Canvas */}
      <div className="relative w-full h-36 rounded-lg overflow-hidden border border-[#1E1E22] bg-[#09090C] cursor-crosshair group">
        <canvas
          id="main-waveform-canvas"
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full block"
        />

        {/* Selected Slice Overlay Badge */}
        {selectedSlice && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-[#0D0D10]/95 backdrop-blur-md px-2 py-0.5 rounded border border-[#00F0FF]/40 text-[10px] font-mono">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedSlice.color }} />
            <span className="text-[#00F0FF] font-bold">{selectedSlice.label}</span>
            <span className="text-[#8E8E93]">
              [{(selectedSlice.endSec - selectedSlice.startSec).toFixed(3)}s]
            </span>
          </div>
        )}
      </div>

      {/* Slices Quick Strip (if slices exist) */}
      {sample.slices && sample.slices.length > 1 && (
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider font-mono mr-1">Slices:</span>
          {sample.slices.map((slice) => {
            const isSel = selectedSlice?.id === slice.id;
            return (
              <button
                key={slice.id}
                id={`slice-pill-${slice.id}`}
                onClick={() => {
                  setSelectedSlice(slice);
                  if (onSliceClick) onSliceClick(slice);
                  if (sample.audioBuffer) {
                    audioEngine.play(sample.audioBuffer, sample.id, {
                      startSec: slice.startSec,
                      endSec: slice.endSec,
                    });
                  }
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono font-medium flex items-center gap-1.5 transition whitespace-nowrap ${
                  isSel
                    ? 'bg-[#00F0FF] text-[#0A0A0B] font-bold shadow-xs'
                    : 'bg-[#141417] hover:bg-[#1E1E23] text-[#EDEDEE] border border-[#26262B]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: slice.color }} />
                <span>{slice.label}</span>
                <span className="text-[9px] opacity-70">
                  {((slice.endSec - slice.startSec) * 1000).toFixed(0)}ms
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
