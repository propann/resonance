import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { blendColors, familyColor } from './families';

export interface WaveRegion {
  /** 0..1 fraction of the buffer */
  start: number;
  end: number;
}

interface RackWaveformStripProps {
  /** The untouched source sample. */
  source: AudioBuffer | null;
  /** The rack output, or null while it is being (re)computed. */
  processed: AudioBuffer | null;
  /** Families of the currently-enabled modules, in chain order. */
  activeFamilies: string[];
  /** Selected region to keep on save, as 0..1 fractions. */
  region: WaveRegion;
  onRegionChange: (region: WaveRegion) => void;
  /** Playhead position 0..1, or null when not auditioning. */
  playhead?: number | null;
  /** True while the processed buffer is being rendered offline. */
  isRendering?: boolean;
  height?: number;
}

const MIN_REGION = 0.02;

/** min/max peak envelope, `buckets` wide, from channel 0 (mono-summed). */
function peakEnvelope(buf: AudioBuffer, buckets: number): { min: Float32Array; max: Float32Array } {
  const min = new Float32Array(buckets);
  const max = new Float32Array(buckets);
  const chans = buf.numberOfChannels;
  const len = buf.length;
  const step = len / buckets;
  const data: Float32Array[] = [];
  for (let c = 0; c < chans; c++) data.push(buf.getChannelData(c));
  for (let i = 0; i < buckets; i++) {
    const from = Math.floor(i * step);
    const to = Math.min(len, Math.floor((i + 1) * step));
    let lo = 0;
    let hi = 0;
    for (let j = from; j < to; j++) {
      let s = 0;
      for (let c = 0; c < chans; c++) s += data[c][j];
      s /= chans;
      if (s < lo) lo = s;
      if (s > hi) hi = s;
    }
    min[i] = lo;
    max[i] = hi;
  }
  return { min, max };
}

export const RackWaveformStrip: React.FC<RackWaveformStripProps> = ({
  source,
  processed,
  activeFamilies,
  region,
  onRegionChange,
  playhead,
  isRendering,
  height = 116,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<null | 'start' | 'end' | 'body'>(null);
  const dragOriginRef = useRef<{ x: number; start: number; end: number }>({ x: 0, start: 0, end: 0 });

  const wetColor = useMemo(() => {
    const uniq = Array.from(new Set(activeFamilies)).map(familyColor);
    return blendColors(uniq);
  }, [activeFamilies]);

  const legend = useMemo(() => {
    const seen = new Set<string>();
    return activeFamilies.filter((f) => (seen.has(f) ? false : (seen.add(f), true)));
  }, [activeFamilies]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 600;
    const cssH = height;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    // ground
    ctx.fillStyle = '#06060A';
    ctx.fillRect(0, 0, cssW, cssH);
    const mid = cssH / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(cssW, mid);
    ctx.stroke();

    const buckets = Math.max(1, Math.floor(cssW));
    const amp = mid - 3;

    // source — dim grey reference
    if (source) {
      const env = peakEnvelope(source, buckets);
      ctx.fillStyle = 'rgba(150,160,175,0.28)';
      ctx.beginPath();
      for (let x = 0; x < buckets; x++) ctx.rect(x, mid - env.max[x] * amp, 1, Math.max(1, (env.max[x] - env.min[x]) * amp));
      ctx.fill();
    }

    // processed — bright, tinted by the active families
    const wet = processed ?? source;
    if (wet) {
      const env = peakEnvelope(wet, buckets);
      const grad = ctx.createLinearGradient(0, 0, 0, cssH);
      grad.addColorStop(0, wetColor);
      grad.addColorStop(1, `${wetColor}22`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let x = 0; x < buckets; x++) ctx.rect(x, mid - env.max[x] * amp, 1, Math.max(1, (env.max[x] - env.min[x]) * amp));
      ctx.fill();
    }

    // dim everything outside the kept region
    const xs = region.start * cssW;
    const xe = region.end * cssW;
    ctx.fillStyle = 'rgba(6,6,10,0.68)';
    ctx.fillRect(0, 0, xs, cssH);
    ctx.fillRect(xe, 0, cssW - xe, cssH);
    ctx.strokeStyle = wetColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xs, 0);
    ctx.lineTo(xs, cssH);
    ctx.moveTo(xe, 0);
    ctx.lineTo(xe, cssH);
    ctx.stroke();

    // playhead
    if (playhead != null && playhead >= 0 && playhead <= 1) {
      ctx.strokeStyle = '#FFE600';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(playhead * cssW, 0);
      ctx.lineTo(playhead * cssW, cssH);
      ctx.stroke();
    }
  }, [source, processed, wetColor, region, playhead, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  const fracFromEvent = (clientX: number): number => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const onPointerDown = (which: 'start' | 'end' | 'body') => (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = which;
    dragOriginRef.current = { x: fracFromEvent(e.clientX), start: region.start, end: region.end };
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic / already-released pointer */
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const f = fracFromEvent(e.clientX);
    if (dragRef.current === 'start') {
      onRegionChange({ start: Math.min(f, region.end - MIN_REGION), end: region.end });
    } else if (dragRef.current === 'end') {
      onRegionChange({ start: region.start, end: Math.max(f, region.start + MIN_REGION) });
    } else {
      const delta = f - dragOriginRef.current.x;
      let s = dragOriginRef.current.start + delta;
      let en = dragOriginRef.current.end + delta;
      const w = dragOriginRef.current.end - dragOriginRef.current.start;
      if (s < 0) { s = 0; en = w; }
      if (en > 1) { en = 1; s = 1 - w; }
      onRegionChange({ start: s, end: en });
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

  return (
    <div className="rounded-lg border border-[#202034] bg-[#0A0A16] p-2">
      <div
        ref={wrapRef}
        className="relative select-none"
        style={{ height }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />

        {/* draggable middle band */}
        <div
          className="absolute top-0 bottom-0 cursor-grab active:cursor-grabbing"
          style={{ left: pct(region.start), width: pct(Math.max(0, region.end - region.start)) }}
          onPointerDown={onPointerDown('body')}
        />

        {/* edge handles with a top grab-button each */}
        {(['start', 'end'] as const).map((edge) => (
          <div
            key={edge}
            className="absolute top-0 bottom-0 z-10 -ml-1 w-2 cursor-ew-resize"
            style={{ left: pct(edge === 'start' ? region.start : region.end) }}
            onPointerDown={onPointerDown(edge)}
          >
            <span
              className="absolute -left-1.5 -top-2 h-4 w-4 rounded-sm border border-black/40 shadow"
              style={{ background: wetColor }}
              title={edge === 'start' ? 'Début de la zone gardée' : 'Fin de la zone gardée'}
            />
          </div>
        ))}

        {isRendering && (
          <div className="pointer-events-none absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-[#00F0FF]">
            rendu…
          </div>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {legend.length === 0 ? (
          <span className="font-mono text-[9px] text-[#66667A]">signal brut — aucun module actif</span>
        ) : (
          legend.map((f) => (
            <span
              key={f}
              className="flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9px]"
              style={{ borderColor: `${familyColor(f)}66`, color: familyColor(f) }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: familyColor(f) }} />
              {f}
            </span>
          ))
        )}
        <span className="ml-auto font-mono text-[9px] text-[#66667A]">
          zone gardée&nbsp;{Math.round((region.end - region.start) * 100)}%
        </span>
      </div>
    </div>
  );
};
