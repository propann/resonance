import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, ZoomIn, ZoomOut, Maximize2, Filter, Volume2, Info } from 'lucide-react';
import { SampleItem, SampleType } from '../types/sample';
import { audioEngine } from '../services/audioEngine';

interface TimbreMapProps {
  samples: SampleItem[];
  selectedSampleId: string | null;
  onSelectSample: (sample: SampleItem) => void;
}

const TYPE_COLORS: Record<SampleType, string> = {
  kick: '#06b6d4', // cyan
  '808': '#8b5cf6', // purple
  snare: '#f43f5e', // rose
  hihat: '#eab308', // yellow
  clap: '#f97316', // orange
  cymbal: '#f59e0b', // amber
  percussion: '#14b8a6', // teal
  bass: '#a855f7', // violet
  lead: '#3b82f6', // blue
  pad: '#ec4899', // pink
  vocal: '#d946ef', // fuchsia
  fx: '#6366f1', // indigo
  loop: '#10b981', // emerald
  'multi-sound': '#06b6d4',
  other: '#94a3b8',
};

export const TimbreMap: React.FC<TimbreMapProps> = ({
  samples,
  selectedSampleId,
  onSelectSample,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hoveredSample, setHoveredSample] = useState<SampleItem | null>(null);
  const [activeFilterType, setActiveFilterType] = useState<string>('all');
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Map coordinates: X = Spectral Centroid (logarithmic scale 50Hz to 12000Hz), Y = Dynamic Range / Peak (0 to 30dB)
  const getSampleCoordinates = (sample: SampleItem, width: number, height: number) => {
    const minFreq = Math.log10(50);
    const maxFreq = Math.log10(12000);
    const freq = Math.max(50, Math.min(12000, sample.spectralCentroid || 2000));
    const logFreq = Math.log10(freq);

    const normX = (logFreq - minFreq) / (maxFreq - minFreq); // 0 to 1
    const normY = Math.max(0, Math.min(1, (sample.dynamicRangeDb || 10) / 28)); // 0 to 1

    const padding = 50;
    const drawWidth = width - padding * 2;
    const drawHeight = height - padding * 2;

    const x = padding + normX * drawWidth;
    // Invert Y so punchy transients are at top
    const y = padding + (1 - normY) * drawHeight;

    return {
      x: x * zoom + panOffset.x,
      y: y * zoom + panOffset.y,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Background Galaxy
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, width, height);

    // Background Grid & Radial Glow
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Quadrant / Axis Labels
    ctx.fillStyle = '#475569';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText('◄ BASS & SUB (Dark)', 20, height - 16);
    ctx.fillText('AIGUS & HATS (Bright) ►', width - 180, height - 16);
    ctx.fillText('▲ TRANSIENT / PUNCHY', width / 2 - 70, 24);
    ctx.fillText('▼ SUSTAINED / AMBIENT', width / 2 - 75, height - 36);

    // Draw connecting cluster lines for same types
    const filtered =
      activeFilterType === 'all'
        ? samples
        : samples.filter((s) => s.type === activeFilterType);

    // Draw Samples as Glowing Orbs
    filtered.forEach((sample) => {
      const { x, y } = getSampleCoordinates(sample, width, height);
      const isSelected = sample.id === selectedSampleId;
      const isHovered = sample.id === hoveredSample?.id;
      const baseColor = TYPE_COLORS[sample.type] || '#06b6d4';
      const radius = isSelected ? 9 : isHovered ? 8 : 6;

      // Glow effect
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = isSelected ? 16 : isHovered ? 12 : 6;

      // Fill Circle
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring for selected
      if (isSelected || isHovered) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.shadowBlur = 0; // reset

      // Label text
      if (isSelected || isHovered || samples.length <= 15) {
        ctx.fillStyle = isSelected ? '#ffffff' : '#94a3b8';
        ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(sample.name.slice(0, 16), x + radius + 5, y + 3);
      }
    });
  }, [samples, selectedSampleId, hoveredSample, activeFilterType, zoom, panOffset]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      setPanOffset({
        x: panOffset.x + (e.clientX - dragStart.x),
        y: panOffset.y + (e.clientY - dragStart.y),
      });
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const filtered =
      activeFilterType === 'all'
        ? samples
        : samples.filter((s) => s.type === activeFilterType);

    let found: SampleItem | null = null;
    for (const sample of filtered) {
      const { x, y } = getSampleCoordinates(sample, width, height);
      const dist = Math.hypot(mouseX - x, mouseY - y);
      if (dist <= 14) {
        found = sample;
        break;
      }
    }

    if (found !== hoveredSample) {
      setHoveredSample(found);
      if (found && found.audioBuffer) {
        // Fast hover audition
        audioEngine.play(found.audioBuffer, found.id);
      }
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    if (hoveredSample) {
      onSelectSample(hoveredSample);
    }
  };

  const sampleTypes: (SampleType | 'all')[] = [
    'all',
    'kick',
    '808',
    'snare',
    'hihat',
    'clap',
    'percussion',
    'loop',
    'multi-sound',
    'fx',
  ];

  return (
    <div id="timbre-map-container" className="flex flex-col h-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl" ref={containerRef}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/90">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Espace Timbre 2D (Visual Similarity Galaxy)</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {samples.length} Samples
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Survolez les sphères pour écouter instantanément • Regroupement par brillance & dynamique
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-md">
          {sampleTypes.map((t) => {
            const isSel = activeFilterType === t;
            return (
              <button
                key={t}
                id={`timbre-filter-${t}`}
                onClick={() => setActiveFilterType(t)}
                className={`px-2 py-1 rounded-lg text-xs font-mono capitalize transition ${
                  isSel
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Galaxy Canvas */}
      <div className="relative flex-1 bg-slate-950 cursor-grab active:cursor-grabbing">
        <canvas
          id="timbre-galaxy-canvas"
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          className="w-full h-full block"
        />

        {/* Hovered Sample Floating Card */}
        {hoveredSample && (
          <div className="absolute top-4 left-4 bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 p-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in pointer-events-none">
            <div
              className="w-3.5 h-3.5 rounded-full shadow-lg"
              style={{ backgroundColor: TYPE_COLORS[hoveredSample.type] || '#06b6d4' }}
            />
            <div>
              <div className="text-xs font-bold text-slate-100">{hoveredSample.name}</div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                <span className="text-cyan-400 capitalize">{hoveredSample.type}</span>
                <span>•</span>
                {hoveredSample.key && <span>Key: {hoveredSample.key}</span>}
                {hoveredSample.bpm && <span>• {hoveredSample.bpm} BPM</span>}
                <span>• {hoveredSample.duration.toFixed(2)}s</span>
              </div>
            </div>
          </div>
        )}

        {/* Zoom Controls Overlay */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 shadow-lg">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-300 px-1">{zoom.toFixed(1)}x</span>
          <button
            onClick={() => setZoom((z) => Math.min(3.0, z + 0.2))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition text-xs font-mono"
            title="Reset position"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};
