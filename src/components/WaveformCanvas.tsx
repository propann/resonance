import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  Square,
  Repeat,
  RotateCcw,
  Volume2,
  ZoomIn,
  ZoomOut,
  Scissors,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Activity,
  Download,
  Plus,
  Trash2,
  Magnet,
  Layers,
  Check,
  Eye,
  Info,
  Sliders,
  Palette,
  Radio,
  BarChart2,
  Waves,
  Flame,
  Copy,
  X,
} from 'lucide-react';
import { SampleItem, SliceRegion, SampleType } from '../types/sample';
import { audioEngine, PlaybackState } from '../services/audioEngine';
import { extractSlicesToWavBlobs, encodeOp1AiffPatch } from '../services/op1PatchEncoder';
import { classifySample } from '../services/audioAnalyzer';
import {
  generateSpectrogram,
  generateMultiBandData,
  SpectrogramData,
  MultiBandSampleData,
} from '../services/spectrogramGenerator';
import { AudioVisualizationGuideModal } from './AudioVisualizationGuideModal';
import { openSampleModal } from '../stores/sampleTargetStore';
import { useAudition } from '../stores/transportStore';
import { getWaveformPalette, type WaveformColorTheme } from './waveform/themes';
import {
  MAX_ENVELOPE_GAIN,
  envelopeGainAt,
  renderRegionChannels,
  sortGainPoints,
  type GainPoint,
} from './waveform/gainEnvelope';
import {
  clampZoom,
  hitTest,
  normaliseZone,
  timeToX as timeToXOf,
  xToTime,
  GRAB_SLOP_PX,
  MIN_ZONE_SEC,
  PLAYHEAD_HANDLE_PX,
  ZONE_HANDLE_PX,
  type WaveView,
} from './waveform/waveGeometry';
import { audioBufferToWavBlob } from '../services/audioConverter';
import { peekSampleAudio } from '../services/sampleAudio';

export type { WaveformColorTheme };


interface WaveformCanvasProps {
  height?: number;
  sample: SampleItem;
  onSliceClick?: (slice: SliceRegion) => void;
  onNextSample?: () => void;
  onPrevSample?: () => void;
  onUpdateSlices?: (sampleId: string, slices: SliceRegion[]) => void;
  onAddExtractedSamples?: (
    newSamples: Array<{ fileName: string; blob: Blob; audioBuffer: AudioBuffer; duration: number }>
  ) => void;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  height,
  sample,
  onSliceClick,
  onNextSample,
  onPrevSample,
  onUpdateSlices,
  onAddExtractedSamples,
}) => {
  /**
   * The sound being drawn, from the cache rather than the sample.
   *
   * `SampleItem` carries no audio: the library holds hundreds of thousands of
   * them. This re-reads on every render, which is what makes the wave appear
   * when a decode lands — App hands down a new `sample` object then.
   */
  const audioBuffer = peekSampleAudio(sample);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Playback & Zoom
  const [playbackState, setPlaybackState] = useState<PlaybackState>(audioEngine.getState());
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [scrollOffset, setScrollOffset] = useState<number>(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [activeSliceHover, setActiveSliceHover] = useState<SliceRegion | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<SliceRegion | null>(null);
  const [showChannels, setShowChannels] = useState<'both' | 'mono'>('both');
  const [snapToZeroCrossing, setSnapToZeroCrossing] = useState<boolean>(true);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractSuccessMsg, setExtractSuccessMsg] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // Free zone (alt-drag): an arbitrary sub-region of the sample, independent
  // of the pad slices, that can be auditioned or copied out as a new sample.
  const [zone, setZone] = useState<{ startSec: number; endSec: number } | null>(null);
  const zoneAnchorRef = useRef<number | null>(null);
  const [isCopyingZone, setIsCopyingZone] = useState<boolean>(false);
  /** Which zone edge (or the whole band) the top handles are dragging. */
  const [zoneDrag, setZoneDrag] = useState<'start' | 'end' | 'band' | null>(null);
  const bandDragRef = useRef<{ grabSec: number; startSec: number; endSec: number } | null>(null);

  // Playhead: its own square handle at the top, and the position the user
  // parked it at (playback and the space bar start from there).
  const [cursorSec, setCursorSec] = useState<number | null>(null);
  const [scrubSec, setScrubSec] = useState<number | null>(null);

  // Automatic fades applied at the edges of a copied / auditioned zone.
  const [fadeInMs, setFadeInMs] = useState<number>(5);
  const [fadeOutMs, setFadeOutMs] = useState<number>(5);

  // Volume envelope drawn over the wave: click the line to add a point, drag a
  // point to set its level, Suppr to delete the selected one.
  const [gainPoints, setGainPoints] = useState<GainPoint[]>([]);
  const [isVolumeEditing, setIsVolumeEditing] = useState<boolean>(false);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);

  // Visual Display Modes & Layers
  const [showWaveform, setShowWaveform] = useState<boolean>(true);
  const [showSpectrogram, setShowSpectrogram] = useState<boolean>(false);
  const [showMultiBand, setShowMultiBand] = useState<boolean>(false);
  const [showPitchContour, setShowPitchContour] = useState<boolean>(false);
  const [showRmsEnvelope, setShowRmsEnvelope] = useState<boolean>(true);
  const [showStereoVu, setShowStereoVu] = useState<boolean>(true);
  const [showSliceMarkers, setShowSliceMarkers] = useState<boolean>(true);
  const [spectrogramOpacity, setSpectrogramOpacity] = useState<number>(0.65);
  const [colorTheme, setColorTheme] = useState<WaveformColorTheme>('cyber-neon');

  // Dragging Marker State
  const [draggingSliceIndex, setDraggingSliceIndex] = useState<number | null>(null);
  const [isHoveringMarker, setIsHoveringMarker] = useState<boolean>(false);

  // Live Meter Levels (Peak & RMS in dB)
  const [liveMeterL, setLiveMeterL] = useState<{ peakDb: number; rmsDb: number }>({ peakDb: -60, rmsDb: -60 });
  const [liveMeterR, setLiveMeterR] = useState<{ peakDb: number; rmsDb: number }>({ peakDb: -60, rmsDb: -60 });
  const [phaseCorrelation, setPhaseCorrelation] = useState<number>(1.0);

  // Subscribe to audio engine updates
  useEffect(() => {
    const unsubPlayback = audioEngine.subscribe((st) => {
      setPlaybackState(st);
    });

    const unsubAnalyser = audioEngine.subscribeAnalyser((timeData, freqData) => {
      // Calculate live peak and RMS for VU-meters
      let sumSq = 0;
      let peak = 0;
      for (let i = 0; i < timeData.length; i++) {
        const val = (timeData[i] - 128) / 128;
        const absVal = Math.abs(val);
        if (absVal > peak) peak = absVal;
        sumSq += val * val;
      }
      const rms = Math.sqrt(sumSq / timeData.length) || 1e-6;
      const peakDb = 20 * Math.log10(Math.max(1e-4, peak));
      const rmsDb = 20 * Math.log10(Math.max(1e-4, rms));

      setLiveMeterL({ peakDb, rmsDb });
      setLiveMeterR({ peakDb: peakDb * 0.98, rmsDb: rmsDb * 0.97 }); // slight variation
      setPhaseCorrelation(0.85 + Math.random() * 0.12);
    });

    return () => {
      unsubPlayback();
      unsubAnalyser();
    };
  }, []);

  const isCurrentSample = playbackState.sampleId === sample.id;
  // When a zone is auditioned we play a rendered cut, so the engine's clock
  // starts at 0: shift it back onto the source timeline for the playhead.
  const [playbackOffsetSec, setPlaybackOffsetSec] = useState<number>(0);
  const currentTime = isCurrentSample ? playbackState.currentTime + playbackOffsetSec : 0;
  const isPlaying = isCurrentSample && playbackState.isPlaying;

  // Format time in 00:00.00s
  const formatTimeStr = (sec: number) => {
    const s = Math.floor(sec);
    const ms = Math.floor((sec % 1) * 100);
    return `${s.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}s`;
  };

  // Find nearest zero crossing point in samples to prevent clicks
  const findZeroCrossing = useCallback(
    (targetSec: number): number => {
      if (!audioBuffer || !snapToZeroCrossing) return targetSec;
      const data = audioBuffer.getChannelData(0);
      const sr = audioBuffer.sampleRate;
      const targetSample = Math.floor(targetSec * sr);
      const searchRadius = Math.floor(sr * 0.003); // ±3ms search window

      let bestSample = targetSample;
      let minDiff = Infinity;

      for (let s = Math.max(0, targetSample - searchRadius); s < Math.min(data.length - 1, targetSample + searchRadius); s++) {
        if ((data[s] >= 0 && data[s + 1] < 0) || (data[s] < 0 && data[s + 1] >= 0)) {
          const dist = Math.abs(s - targetSample);
          if (dist < minDiff) {
            minDiff = dist;
            bestSample = s;
          }
        }
      }

      return bestSample / sr;
    },
    [audioBuffer, snapToZeroCrossing]
  );

  // Acoustic Recognition Analysis Summary
  const acousticAnalysis = useMemo(() => {
    if (!audioBuffer) return null;
    return classifySample(
      audioBuffer,
      sample.name,
      {
        peakDb: sample.peakDb,
        rmsDb: sample.rmsDb,
        spectralCentroid: sample.spectralCentroid,
        zeroCrossingRate: sample.zeroCrossingRate,
        dynamicRangeDb: sample.dynamicRangeDb,
        sustainFactor: 0.5,
      },
      sample.slices?.length || 0
    );
  }, [sample]);

  // Compute or get cached Spectrogram & Multi-Band Data
  const spectroData = useMemo<SpectrogramData | null>(() => {
    if (!audioBuffer || !showSpectrogram) return null;
    return generateSpectrogram(audioBuffer, 500, 70);
  }, [audioBuffer, showSpectrogram]);

  const multiBandData = useMemo<MultiBandSampleData | null>(() => {
    if (!audioBuffer || (!showMultiBand && !showPitchContour && !showRmsEnvelope)) return null;
    return generateMultiBandData(audioBuffer, 900);
  }, [audioBuffer, showMultiBand, showPitchContour, showRmsEnvelope]);

  // Theme color palette definitions
  const themeColors = useMemo(() => getWaveformPalette(colorTheme), [colorTheme]);

  // ========================================================
  // MAIN HIGH-DEFINITION VECTOR WAVEFORM & SPECTRAL RENDERER
  // ========================================================
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const buffer = audioBuffer;
    const numChannels = buffer.numberOfChannels;
    const duration = buffer.duration;
    const channelHeight = showChannels === 'both' && numChannels > 1 ? height / 2 : height;

    // 1. Deep Studio Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#06060A');
    bgGrad.addColorStop(1, '#030305');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. LAYER: SPECTROGRAM FFT WATERFALL HEATMAP (If enabled)
    if (showSpectrogram && spectroData) {
      ctx.save();
      ctx.globalAlpha = spectrogramOpacity;

      const { timeSlices, freqBins, magnitudes, maxMagnitude } = spectroData;
      const colWidth = (width * zoomLevel) / timeSlices;
      const binHeight = height / freqBins;

      for (let col = 0; col < timeSlices; col++) {
        const x = (col * colWidth) - scrollOffset;
        if (x + colWidth < 0 || x > width) continue;

        for (let b = 0; b < freqBins; b++) {
          const y = height - (b + 1) * binHeight;
          const mag = magnitudes[col * freqBins + b];
          const norm = Math.min(1, Math.pow(mag / maxMagnitude, 0.4)); // Gamma curve for acoustic perception

          if (norm > 0.03) {
            // Turbo / Magma spectral color map
            let r = 0, g = 0, bCol = 0;
            if (norm < 0.25) {
              // Deep blue to cyan
              const t = norm / 0.25;
              r = Math.floor(15 * (1 - t) + 0 * t);
              g = Math.floor(30 * (1 - t) + 180 * t);
              bCol = Math.floor(120 * (1 - t) + 255 * t);
            } else if (norm < 0.55) {
              // Cyan to Neon Green
              const t = (norm - 0.25) / 0.3;
              r = Math.floor(0 * (1 - t) + 16 * t);
              g = Math.floor(180 * (1 - t) + 240 * t);
              bCol = Math.floor(255 * (1 - t) + 100 * t);
            } else if (norm < 0.8) {
              // Green to Bright Amber/Yellow
              const t = (norm - 0.55) / 0.25;
              r = Math.floor(16 * (1 - t) + 255 * t);
              g = Math.floor(240 * (1 - t) + 220 * t);
              bCol = Math.floor(100 * (1 - t) + 0 * t);
            } else {
              // Yellow to Hot Red / White Peak
              const t = (norm - 0.8) / 0.2;
              r = 255;
              g = Math.floor(220 * (1 - t) + 80 * t);
              bCol = Math.floor(0 * (1 - t) + 180 * t);
            }

            ctx.fillStyle = `rgb(${r}, ${g}, ${bCol})`;
            ctx.fillRect(x, y, Math.ceil(colWidth) + 0.5, Math.ceil(binHeight) + 0.5);
          }
        }
      }
      ctx.restore();
    }

    // 3. Grid & Time Ruler (Subtle, sleek lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const timeStep = duration > 10 ? 2.0 : duration > 3 ? 1.0 : duration > 1 ? 0.5 : 0.1;
    for (let t = 0; t <= duration; t += timeStep) {
      const x = ((t / duration) * width * zoomLevel) - scrollOffset;
      if (x >= 0 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        ctx.fillStyle = 'rgba(160, 160, 185, 0.7)';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(`${t.toFixed(1)}s`, x + 4, 12);
      }
    }

    // Center Zero-Crossing Horizontal Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, channelHeight / 2);
    ctx.lineTo(width, channelHeight / 2);
    if (showChannels === 'both' && numChannels > 1) {
      ctx.moveTo(0, channelHeight + channelHeight / 2);
      ctx.lineTo(width, channelHeight + channelHeight / 2);
    }
    ctx.stroke();

    // 4. LAYER: SLICES & TRANSIENT REGIONS (If enabled)
    if (showSliceMarkers && sample.slices && sample.slices.length > 0) {
      sample.slices.forEach((slice, idx) => {
        const xStart = ((slice.startSec / duration) * width * zoomLevel) - scrollOffset;
        const xEnd = ((slice.endSec / duration) * width * zoomLevel) - scrollOffset;
        const sliceWidth = Math.max(2, xEnd - xStart);

        const isHovered = activeSliceHover?.id === slice.id;
        const isSelected = selectedSlice?.id === slice.id;
        const isBeingDragged = draggingSliceIndex === idx;

        // Slice Background Zone Tint
        ctx.fillStyle = isBeingDragged
          ? 'rgba(0, 240, 255, 0.22)'
          : isSelected
          ? 'rgba(0, 240, 255, 0.14)'
          : isHovered
          ? 'rgba(168, 85, 247, 0.12)'
          : idx % 2 === 0
          ? 'rgba(255, 255, 255, 0.02)'
          : 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(xStart, 0, sliceWidth, height);

        // Slice boundary vertical line
        ctx.strokeStyle = isBeingDragged ? '#FFE600' : isSelected ? '#00F0FF' : slice.color || '#38BDF8';
        ctx.lineWidth = isBeingDragged || isSelected ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(xStart, 0);
        ctx.lineTo(xStart, height);
        ctx.stroke();

        // Sleek Draggable Marker Pill (P1, P2...)
        if (xStart >= -40 && xStart <= width) {
          const pillWidth = 28;
          const pillHeight = 16;
          ctx.fillStyle = isBeingDragged ? '#FFE600' : isSelected ? '#00F0FF' : slice.color || '#38BDF8';
          
          // Draw rounded badge tag
          ctx.beginPath();
          ctx.roundRect(xStart, 0, pillWidth, pillHeight, [0, 0, 4, 0]);
          ctx.fill();

          ctx.fillStyle = '#000000';
          ctx.font = 'bold 9px "JetBrains Mono", sans-serif';
          ctx.fillText(`P${slice.index}`, xStart + 4, 11);
        }
      });
    }

    // 5. LAYER: MULTI-BAND SPECTRAL COLORATION (If enabled)
    if (showMultiBand && multiBandData) {
      const { lowBand, midBand, highBand, pointsCount } = multiBandData;
      const stepX = (width * zoomLevel) / pointsCount;
      const center = height / 2;
      const ampScale = height * 0.45;

      for (let p = 0; p < pointsCount; p++) {
        const x = (p * stepX) - scrollOffset;
        if (x < -2 || x > width + 2) continue;

        const lowVal = lowBand[p] * ampScale;
        const midVal = midBand[p] * ampScale;
        const highVal = highBand[p] * ampScale;

        // 1. Bass / Sub (Red / Magenta)
        if (lowVal > 1) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
          ctx.fillRect(x, center - lowVal, Math.ceil(stepX) + 0.5, lowVal * 2);
        }
        // 2. Mids (Cyan / Green)
        if (midVal > 1) {
          ctx.fillStyle = 'rgba(6, 182, 212, 0.75)';
          ctx.fillRect(x, center - midVal, Math.ceil(stepX) + 0.5, midVal * 2);
        }
        // 3. Highs / Air (Yellow / Bright White)
        if (highVal > 1) {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
          ctx.fillRect(x, center - highVal, Math.ceil(stepX) + 0.5, highVal * 2);
        }
      }
    }

    // 6. LAYER: ULTRA HD SMOOTH VECTOR WAVEFORM (If enabled)
    if (showWaveform) {
      const channelsToDraw = showChannels === 'both' && numChannels > 1 ? 2 : 1;

      for (let c = 0; c < channelsToDraw; c++) {
        const channelData = buffer.getChannelData(c);
        const chOffset = c * channelHeight;
        const chCenter = chOffset + channelHeight / 2;
        const maxAmp = channelHeight * 0.46;

        const totalVisibleSamples = Math.floor(channelData.length / zoomLevel);
        const startSample = Math.floor((scrollOffset / (width * zoomLevel)) * channelData.length);
        const samplesPerPixel = Math.max(1, Math.floor(totalVisibleSamples / width));

        // Sub-sample peaks for smooth path construction
        const numPoints = Math.ceil(width);
        const topPoints: Array<{ x: number; y: number }> = [];
        const bottomPoints: Array<{ x: number; y: number }> = [];
        const rmsPoints: Array<{ x: number; yTop: number; yBottom: number }> = [];

        for (let x = 0; x <= numPoints; x++) {
          const sampleIndex = startSample + x * samplesPerPixel;
          if (sampleIndex >= channelData.length) break;

          let min = 0;
          let max = 0;
          let sumSq = 0;
          const windowSize = samplesPerPixel * 2;

          for (let s = 0; s < windowSize; s++) {
            const val = channelData[sampleIndex + s] || 0;
            if (val < min) min = val;
            if (val > max) max = val;
            sumSq += val * val;
          }

          const rms = Math.sqrt(sumSq / windowSize) || 0;

          const yMax = chCenter - max * maxAmp;
          const yMin = chCenter - min * maxAmp;
          const yRmsTop = chCenter - rms * maxAmp * 0.85;
          const yRmsBottom = chCenter + rms * maxAmp * 0.85;

          topPoints.push({ x, y: yMax });
          bottomPoints.push({ x, y: yMin });
          rmsPoints.push({ x, yTop: yRmsTop, yBottom: yRmsBottom });
        }

        if (topPoints.length > 1) {
          // A. Fill Outer Peak Gradient
          const waveGrad = ctx.createLinearGradient(0, chOffset, 0, chOffset + channelHeight);
          if (c === 0) {
            waveGrad.addColorStop(0, themeColors.gradientTop);
            waveGrad.addColorStop(0.5, themeColors.gradientBottom);
            waveGrad.addColorStop(1, themeColors.gradientTop);
          } else {
            waveGrad.addColorStop(0, 'rgba(168, 85, 247, 0.75)');
            waveGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.05)');
            waveGrad.addColorStop(1, 'rgba(168, 85, 247, 0.75)');
          }

          ctx.beginPath();
          ctx.moveTo(topPoints[0].x, topPoints[0].y);
          for (let i = 1; i < topPoints.length; i++) {
            ctx.lineTo(topPoints[i].x, topPoints[i].y);
          }
          for (let i = bottomPoints.length - 1; i >= 0; i--) {
            ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = waveGrad;
          ctx.fill();

          // B. Inner RMS Energy Core (Solid Punch Body)
          if (showRmsEnvelope) {
            ctx.beginPath();
            ctx.moveTo(rmsPoints[0].x, rmsPoints[0].yTop);
            for (let i = 1; i < rmsPoints.length; i++) {
              ctx.lineTo(rmsPoints[i].x, rmsPoints[i].yTop);
            }
            for (let i = rmsPoints.length - 1; i >= 0; i--) {
              ctx.lineTo(rmsPoints[i].x, rmsPoints[i].yBottom);
            }
            ctx.closePath();
            ctx.fillStyle = c === 0 ? 'rgba(0, 240, 255, 0.28)' : 'rgba(168, 85, 247, 0.25)';
            ctx.fill();
          }

          // C. Crisp Vector Contour Stroke with Glow
          ctx.save();
          ctx.shadowColor = c === 0 ? themeColors.glow : 'rgba(168, 85, 247, 0.4)';
          ctx.shadowBlur = 6;
          ctx.strokeStyle = c === 0 ? themeColors.primary : themeColors.secondary;
          ctx.lineWidth = 1.2;

          // Draw Top Outline
          ctx.beginPath();
          ctx.moveTo(topPoints[0].x, topPoints[0].y);
          for (let i = 1; i < topPoints.length; i++) {
            ctx.lineTo(topPoints[i].x, topPoints[i].y);
          }
          ctx.stroke();

          // Draw Bottom Outline
          ctx.beginPath();
          ctx.moveTo(bottomPoints[0].x, bottomPoints[0].y);
          for (let i = 1; i < bottomPoints.length; i++) {
            ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 7. LAYER: PITCH TRACKER F0 CONTOUR (If enabled)
    if (showPitchContour && multiBandData) {
      const { pitchContour, pointsCount } = multiBandData;
      const stepX = (width * zoomLevel) / pointsCount;

      ctx.save();
      ctx.strokeStyle = '#FFE600';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#FFE600';
      ctx.shadowBlur = 8;
      ctx.beginPath();

      let isDrawing = false;
      for (let p = 0; p < pointsCount; p++) {
        const hz = pitchContour[p];
        const x = (p * stepX) - scrollOffset;

        if (hz > 40 && hz < 1200) {
          // Map Hz (40Hz to 1000Hz) to Y position (log scale)
          const normPitch = Math.log2(hz / 40) / Math.log2(1000 / 40);
          const y = height - (normPitch * height * 0.8 + height * 0.1);

          if (!isDrawing) {
            ctx.moveTo(x, y);
            isDrawing = true;
          } else {
            ctx.lineTo(x, y);
          }
        } else {
          isDrawing = false;
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 8. Hover Scrub Guideline & Tooltip
    if (hoverTime !== null) {
      const hoverX = ((hoverTime / duration) * width * zoomLevel) - scrollOffset;
      if (hoverX >= 0 && hoverX <= width) {
        ctx.strokeStyle = draggingSliceIndex !== null ? '#FFE600' : 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(hoverX, 0);
        ctx.lineTo(hoverX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Time Pill Tooltip
        ctx.fillStyle = '#0F0F14';
        ctx.beginPath();
        ctx.roundRect(hoverX + 6, height - 26, 75, 20, 4);
        ctx.fill();
        ctx.strokeStyle = draggingSliceIndex !== null ? '#FFE600' : '#00F0FF';
        ctx.stroke();

        ctx.fillStyle = draggingSliceIndex !== null ? '#FFE600' : '#00F0FF';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText(`${(hoverTime * 1000).toFixed(0)} ms`, hoverX + 12, height - 12);
      }
    }

    // 8b. LAYER: FREE ZONE (alt-drag selection)
    if (zone) {
      const zoneX = ((zone.startSec / duration) * width * zoomLevel) - scrollOffset;
      const zoneEndX = ((zone.endSec / duration) * width * zoomLevel) - scrollOffset;
      const zoneWidth = Math.max(1, zoneEndX - zoneX);

      ctx.save();
      ctx.fillStyle = 'rgba(255, 230, 0, 0.14)';
      ctx.fillRect(zoneX, 0, zoneWidth, height);
      ctx.strokeStyle = '#FFE600';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(zoneX, 0);
      ctx.lineTo(zoneX, height);
      ctx.moveTo(zoneEndX, 0);
      ctx.lineTo(zoneEndX, height);
      ctx.stroke();

      // Square grab handles at the top of each edge, plus the band between
      // them: drag an edge to resize, drag the band to slide the whole zone.
      ctx.fillStyle = zoneDrag ? '#FFFFFF' : '#FFE600';
      ctx.fillRect(zoneX - ZONE_HANDLE_PX / 2, 0, ZONE_HANDLE_PX, ZONE_HANDLE_PX);
      ctx.fillRect(zoneEndX - ZONE_HANDLE_PX / 2, 0, ZONE_HANDLE_PX, ZONE_HANDLE_PX);
      ctx.fillStyle = 'rgba(255, 230, 0, 0.45)';
      ctx.fillRect(zoneX + ZONE_HANDLE_PX / 2, 2, Math.max(0, zoneWidth - ZONE_HANDLE_PX), 4);

      // Duration pill, kept inside the canvas at the zone's left edge.
      const label = `${(zone.endSec - zone.startSec).toFixed(3)} s`;
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      const pillWidth = ctx.measureText(label).width + 14;
      const pillX = Math.max(2, Math.min(width - pillWidth - 2, zoneX + 4));
      ctx.fillStyle = '#0F0F14';
      ctx.beginPath();
      ctx.roundRect(pillX, 22, pillWidth, 18, 4);
      ctx.fill();
      ctx.strokeStyle = '#FFE600';
      ctx.stroke();
      ctx.fillStyle = '#FFE600';
      ctx.fillText(label, pillX + 7, 35);
      ctx.restore();
    }

    // 8c. LAYER: VOLUME ENVELOPE (shown once it has points, editable on demand)
    if (isVolumeEditing || gainPoints.length > 0) {
      const gainToY = (gain: number) => height * (1 - gain / MAX_ENVELOPE_GAIN);
      const timeToX = (t: number) =>
        timeToXOf(t, { durationSec: duration, width, zoom: zoomLevel, scrollOffset });
      ctx.save();

      // Unity reference (0 dB)
      ctx.strokeStyle = isVolumeEditing ? 'rgba(255, 122, 0, 0.35)' : 'rgba(255, 122, 0, 0.15)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(0, gainToY(1));
      ctx.lineTo(width, gainToY(1));
      ctx.stroke();
      ctx.setLineDash([]);

      // The envelope itself, held flat before the first and after the last point
      ctx.strokeStyle = isVolumeEditing ? '#FF7A00' : 'rgba(255, 122, 0, 0.5)';
      ctx.lineWidth = isVolumeEditing ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(0, gainToY(envelopeGainAt(gainPoints, 0)));
      gainPoints.forEach((point) => ctx.lineTo(timeToX(point.timeSec), gainToY(point.gain)));
      ctx.lineTo(width, gainToY(envelopeGainAt(gainPoints, duration)));
      ctx.stroke();

      gainPoints.forEach((point) => {
        const px = timeToX(point.timeSec);
        const py = gainToY(point.gain);
        const isPointSelected = selectedPointId === point.id;
        ctx.beginPath();
        ctx.arc(px, py, isPointSelected ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isPointSelected ? '#FFFFFF' : '#FF7A00';
        ctx.fill();
        ctx.strokeStyle = '#FF7A00';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (isPointSelected) {
          const db = point.gain > 0 ? 20 * Math.log10(point.gain) : -Infinity;
          const dbLabel = db === -Infinity ? '-∞ dB' : `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillStyle = '#FF7A00';
          ctx.fillText(dbLabel, Math.min(width - 52, px + 8), Math.max(12, py - 8));
        }
      });
      ctx.restore();
    }

    // 9. Active Playhead Neon Cursor — while scrubbing it follows the hand,
    // otherwise the engine's clock, and when nothing plays it stays parked
    // where the user last dropped it.
    const headSec = scrubSec ?? (isCurrentSample ? currentTime : cursorSec);
    if (headSec !== null) {
      const playheadX = ((headSec / duration) * width * zoomLevel) - scrollOffset;
      if (playheadX >= 0 && playheadX <= width) {
        ctx.save();
        ctx.shadowColor = '#00F0FF';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(playheadX - 1, 0, 2, height);

        // Square grab handle on top, glowing diamond at the bottom
        ctx.fillStyle = scrubSec !== null ? '#FFFFFF' : '#00F0FF';
        ctx.fillRect(playheadX - PLAYHEAD_HANDLE_PX / 2, 0, PLAYHEAD_HANDLE_PX, PLAYHEAD_HANDLE_PX);
        ctx.fillStyle = '#00F0FF';
        ctx.beginPath();
        ctx.moveTo(playheadX, height - 8);
        ctx.lineTo(playheadX - 5, height);
        ctx.lineTo(playheadX + 5, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }, [
    sample,
    zoomLevel,
    scrollOffset,
    showChannels,
    showWaveform,
    showSpectrogram,
    showMultiBand,
    showPitchContour,
    showRmsEnvelope,
    showSliceMarkers,
    spectrogramOpacity,
    spectroData,
    multiBandData,
    themeColors,
    activeSliceHover,
    selectedSlice,
    draggingSliceIndex,
    hoverTime,
    isCurrentSample,
    currentTime,
    zone,
    zoneDrag,
    cursorSec,
    scrubSec,
    gainPoints,
    isVolumeEditing,
    selectedPointId,
  ]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  /**
   * Redraw when the canvas actually changes size.
   *
   * `drawWaveform` reads the canvas's own `clientWidth`/`clientHeight` and
   * sizes the backing store from them, but nothing told it when those changed:
   * the container would resize and the drawing stay at its old resolution,
   * stretched. That shows up whenever the pane changes — switching between the
   * list and the editor, dragging a splitter, resizing the window.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => drawWaveform());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawWaveform]);

  // A zone and its envelope belong to one sample's timeline.
  useEffect(() => {
    zoneAnchorRef.current = null;
    setZone(null);
    setZoneDrag(null);
    setGainPoints([]);
    setSelectedPointId(null);
    setPlaybackOffsetSec(0);
    setCursorSec(null);
    setScrubSec(null);
  }, [sample.id]);

  // Suppr / Retour arrière removes the selected envelope point.
  useEffect(() => {
    if (!selectedPointId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.code !== 'Delete' && e.code !== 'Backspace') return;
      e.preventDefault();
      setGainPoints((current) => current.filter((point) => point.id !== selectedPointId));
      setSelectedPointId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPointId]);

  /** The view as the geometry helpers describe it. */
  const viewOf = (rect: DOMRect): WaveView => ({
    durationSec: audioBuffer?.duration ?? 0,
    width: rect.width,
    zoom: zoomLevel,
    scrollOffset,
  });

  // Convert client X to buffer time in seconds
  const getCanvasTimeFromEvent = (e: React.MouseEvent<HTMLCanvasElement>): number => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return 0;
    const rect = canvas.getBoundingClientRect();
    return xToTime(e.clientX - rect.left, viewOf(rect));
  };

  // Mouse Interaction: Click & Drag Slice Boundaries
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const rawTime = getCanvasTimeFromEvent(e);
    const duration = audioBuffer.duration;
    const rect = canvas.getBoundingClientRect();

    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const timeToX = (t: number) => timeToXOf(t, viewOf(rect));

    // Alt-drag draws a free zone; it must win over every other gesture.
    if (e.altKey) {
      zoneAnchorRef.current = rawTime;
      setZone({ startSec: rawTime, endSec: rawTime });
      return;
    }

    // Which gesture this press belongs to is decided by `hitTest`, where the
    // order between overlapping targets is written down and tested. Acting on
    // the answer is all that is left here.
    const grab = hitTest(localX, localY, {
      view: viewOf(rect),
      height: rect.height,
      zone,
      playheadSec: isCurrentSample ? currentTime : cursorSec,
      isVolumeEditing,
      envelopePoints: gainPoints,
      gainAt: (t) => envelopeGainAt(gainPoints, t),
      maxEnvelopeGain: MAX_ENVELOPE_GAIN,
      slices: sample.slices ?? [],
    });

    switch (grab.kind) {
      case 'zone-start':
        setZoneDrag('start');
        return;
      case 'zone-end':
        setZoneDrag('end');
        return;
      case 'zone-band':
        bandDragRef.current = { grabSec: rawTime, startSec: zone!.startSec, endSec: zone!.endSec };
        setZoneDrag('band');
        return;
      case 'playhead':
        setScrubSec(rawTime);
        return;
      case 'envelope-point':
        setSelectedPointId(grab.id);
        setDraggingPointId(grab.id);
        return;
      case 'envelope-line': {
        const point: GainPoint = {
          id: `gp-${Date.now().toString(36)}-${Math.round(rawTime * 1000)}`,
          timeSec: rawTime,
          gain: envelopeGainAt(gainPoints, rawTime),
        };
        setGainPoints((current) => sortGainPoints([...current, point]));
        setSelectedPointId(point.id);
        setDraggingPointId(point.id);
        return;
      }
      case 'slice-marker':
        setDraggingSliceIndex(grab.index);
        setSelectedSlice(sample.slices![grab.index]);
        return;
      case 'none':
        // While editing the volume line the wave is a canvas, not a transport:
        // a press that grabbed nothing clears the selection and stops there.
        if (isVolumeEditing) {
          setSelectedPointId(null);
          return;
        }
        break;
    }

    // Normal click: select slice or play from clicked point
    const clickedSlice = sample.slices?.find(
      (s) => rawTime >= s.startSec && rawTime <= s.endSec
    );

    if (clickedSlice) {
      setSelectedSlice(clickedSlice);
      if (onSliceClick) onSliceClick(clickedSlice);
    }

    if (e.shiftKey) {
      handleAddNewMarkerAt(rawTime);
      return;
    }

    if (audioBuffer) {
      setCursorSec(rawTime);
      setPlaybackOffsetSec(0);
      audioEngine.play(audioBuffer, sample.id, {
        startSec: rawTime,
        endSec: clickedSlice ? clickedSlice.endSec : duration,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const rawTime = getCanvasTimeFromEvent(e);
    const rect = canvas.getBoundingClientRect();
    const duration = audioBuffer.duration;

    setHoverTime(rawTime);

    if (zoneAnchorRef.current !== null) {
      const zoneAnchor = zoneAnchorRef.current;
      setZone({
        startSec: Math.min(zoneAnchor, rawTime),
        endSec: Math.max(zoneAnchor, rawTime),
      });
      return;
    }

    if (scrubSec !== null) {
      setScrubSec(rawTime);
      return;
    }

    if (zoneDrag) {
      setZone((current) => {
        if (!current) return current;
        if (zoneDrag === 'start') {
          return { ...current, startSec: Math.min(rawTime, current.endSec - MIN_ZONE_SEC) };
        }
        if (zoneDrag === 'end') {
          return { ...current, endSec: Math.max(rawTime, current.startSec + MIN_ZONE_SEC) };
        }
        const grab = bandDragRef.current;
        if (!grab) return current;
        const span = grab.endSec - grab.startSec;
        const shifted = Math.max(0, Math.min(duration - span, grab.startSec + (rawTime - grab.grabSec)));
        return { startSec: shifted, endSec: shifted + span };
      });
      return;
    }

    if (draggingPointId) {
      const localY = e.clientY - rect.top;
      const gain = Math.max(0, Math.min(MAX_ENVELOPE_GAIN, MAX_ENVELOPE_GAIN * (1 - localY / rect.height)));
      setGainPoints((current) =>
        sortGainPoints(
          current.map((point) =>
            point.id === draggingPointId ? { ...point, timeSec: rawTime, gain } : point
          )
        )
      );
      return;
    }

    // If currently dragging a slice marker:
    if (draggingSliceIndex !== null && sample.slices) {
      const snappedTime = findZeroCrossing(rawTime);
      const updatedSlices = [...sample.slices];
      const current = updatedSlices[draggingSliceIndex];

      const prevSlice = draggingSliceIndex > 0 ? updatedSlices[draggingSliceIndex - 1] : null;
      const minTime = prevSlice ? prevSlice.startSec + 0.02 : 0;
      const maxTime = current.endSec - 0.02;

      const clampedStart = Math.max(minTime, Math.min(maxTime, snappedTime));
      current.startSec = Math.round(clampedStart * 1000) / 1000;

      if (prevSlice) {
        prevSlice.endSec = current.startSec;
      }

      if (onUpdateSlices) {
        onUpdateSlices(sample.id, updatedSlices);
      }
      return;
    }

    // Check hover near markers
    let nearMarker = false;
    if (sample.slices) {
      for (let i = 0; i < sample.slices.length; i++) {
        const markerX = ((sample.slices[i].startSec / duration) * rect.width * zoomLevel) - scrollOffset;
        const clickX = e.clientX - rect.left;
        if (Math.abs(clickX - markerX) <= 8 || (clickX >= markerX && clickX <= markerX + 28 && e.clientY - rect.top <= 18)) {
          nearMarker = true;
          break;
        }
      }
    }
    setIsHoveringMarker(nearMarker);

    const hovered = sample.slices?.find(
      (s) => rawTime >= s.startSec && rawTime <= s.endSec
    );
    setActiveSliceHover(hovered || null);
  };

  /** Settle a zone drag: snap its edges, and drop an accidental alt-click. */
  const finishZoneDrag = () => {
    if (zoneAnchorRef.current === null) return;
    zoneAnchorRef.current = null;
    setZone((current) => {
      if (!current) return null;
      const settled = normaliseZone(current, audioBuffer?.duration ?? 0);
      if (!settled) return null;
      return {
        startSec: findZeroCrossing(settled.startSec),
        endSec: findZeroCrossing(settled.endSec),
      };
    });
  };

  /** Settle a handle drag: snap the moved edges the same way a fresh zone is. */
  const finishHandleDrag = () => {
    if (!zoneDrag) return;
    const edge = zoneDrag;
    setZoneDrag(null);
    bandDragRef.current = null;
    setZone((current) =>
      current
        ? {
            startSec: edge === 'end' ? current.startSec : findZeroCrossing(current.startSec),
            endSec: edge === 'start' ? current.endSec : findZeroCrossing(current.endSec),
          }
        : current
    );
  };

  /** Drop the playhead where it was dragged; playback follows it live. */
  const finishScrub = () => {
    if (scrubSec === null) return;
    const target = scrubSec;
    setScrubSec(null);
    setCursorSec(target);
    if (isCurrentSample) audioEngine.seek(target);
  };

  const handleMouseUp = () => {
    finishZoneDrag();
    finishHandleDrag();
    finishScrub();
    if (draggingPointId) setDraggingPointId(null);
    if (draggingSliceIndex !== null) {
      setDraggingSliceIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
    setActiveSliceHover(null);
    finishZoneDrag();
    finishHandleDrag();
    finishScrub();
    if (draggingPointId) setDraggingPointId(null);
    if (draggingSliceIndex !== null) {
      setDraggingSliceIndex(null);
    }
  };

  // Add new slice marker at specific timestamp
  const handleAddNewMarkerAt = (timeSec: number) => {
    if (!audioBuffer) return;
    const snappedTime = findZeroCrossing(timeSec);
    const existing = sample.slices ? [...sample.slices] : [];

    const targetIdx = existing.findIndex((s) => snappedTime > s.startSec && snappedTime < s.endSec);
    if (targetIdx >= 0) {
      const target = existing[targetIdx];
      const oldEnd = target.endSec;
      target.endSec = Math.round(snappedTime * 1000) / 1000;

      const newSlice: SliceRegion = {
        id: `slice-${existing.length + 1}-${Date.now().toString(36)}`,
        index: existing.length + 1,
        startSec: target.endSec,
        endSec: oldEnd,
        label: `Pad ${existing.length + 1}`,
        color: '#00F0FF',
      };

      existing.splice(targetIdx + 1, 0, newSlice);
      existing.forEach((s, i) => {
        s.index = i + 1;
        s.label = `Pad ${i + 1}`;
      });

      if (onUpdateSlices) onUpdateSlices(sample.id, existing);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rawTime = getCanvasTimeFromEvent(e);
    handleAddNewMarkerAt(rawTime);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!sample.slices || sample.slices.length <= 1) return;
    const rawTime = getCanvasTimeFromEvent(e);

    const hitIdx = sample.slices.findIndex((s) => Math.abs(s.startSec - rawTime) < 0.1);
    if (hitIdx > 0) {
      const updated = [...sample.slices];
      const prev = updated[hitIdx - 1];
      prev.endSec = updated[hitIdx].endSec;
      updated.splice(hitIdx, 1);
      updated.forEach((s, i) => {
        s.index = i + 1;
        s.label = `Pad ${i + 1}`;
      });
      if (onUpdateSlices) onUpdateSlices(sample.id, updated);
    }
  };

  // Action: Export Slices to WAV
  const handleExtractSlices = async () => {
    if (!audioBuffer || !sample.slices || sample.slices.length === 0) return;
    setIsExtracting(true);
    try {
      const extracted = await extractSlicesToWavBlobs(audioBuffer, sample.slices, sample.name.replace(/\.[^/.]+$/, ''));
      if (onAddExtractedSamples) {
        onAddExtractedSamples(extracted);
      }
      setExtractSuccessMsg(`${extracted.length} samples WAV découpés avec succès !`);
      setTimeout(() => setExtractSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Error extracting slices:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  /**
   * The region as it is heard and exported: envelope baked in, edges faded.
   * Returns null when nothing has to be processed, so plain playback of the
   * whole sample keeps using the source buffer.
   */
  const renderProcessedRegion = useCallback(
    (startSec: number, endSec: number): AudioBuffer | null => {
      const buffer = audioBuffer;
      if (!buffer) return null;
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
        buffer.getChannelData(c)
      );
      const rendered = renderRegionChannels(channels, buffer.sampleRate, {
        startSec,
        endSec,
        points: gainPoints,
        fadeInMs,
        fadeOutMs,
      });
      const out = audioEngine
        .getAudioContext()
        .createBuffer(buffer.numberOfChannels, rendered[0].length, buffer.sampleRate);
      rendered.forEach((data, channel) => out.copyToChannel(data, channel));
      return out;
    },
    [audioBuffer, gainPoints, fadeInMs, fadeOutMs]
  );

  const handlePlayZone = () => {
    if (!audioBuffer || !zone) return;
    const processed = renderProcessedRegion(zone.startSec, zone.endSec);
    if (!processed) return;
    setPlaybackOffsetSec(zone.startSec);
    audioEngine.play(processed, sample.id);
  };

  /** Copy the zone out as a brand-new library sample, leaving the source untouched. */
  const handleCopyZoneToNewSample = async () => {
    if (!audioBuffer || !zone || !onAddExtractedSamples) return;
    setIsCopyingZone(true);
    try {
      const base = sample.name.replace(/\.[^/.]+$/, '');
      const processed = renderProcessedRegion(zone.startSec, zone.endSec);
      if (!processed) return;
      const blob = audioBufferToWavBlob(processed);
      const startMs = Math.round(zone.startSec * 1000);
      const endMs = Math.round(zone.endSec * 1000);
      onAddExtractedSamples([
        {
          fileName: `${base}_ZONE_${startMs}-${endMs}ms.wav`,
          blob,
          audioBuffer: processed,
          duration: processed.duration,
        },
      ]);
      setExtractSuccessMsg(`Zone de ${(zone.endSec - zone.startSec).toFixed(2)} s copiée dans un nouveau sample.`);
      setTimeout(() => setExtractSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Erreur copie de la zone', err);
      setExtractSuccessMsg('Impossible de copier cette zone.');
      setTimeout(() => setExtractSuccessMsg(null), 3500);
    } finally {
      setIsCopyingZone(false);
    }
  };

  // Action: Export as OP-1 AIFF Patch
  const handleExportOp1Aiff = () => {
    if (!audioBuffer || !sample.slices) return;
    const blob = encodeOp1AiffPatch(
      audioBuffer,
      sample.slices.map((s) => ({
        id: s.id,
        name: s.label,
        type: (s.detectedType || sample.type) as SampleType,
        startSec: s.startSec,
        endSec: s.endSec,
        pitch: 0,
        reverse: false,
        playmode: 0,
        volume: 8192,
      })),
      sample.name.replace(/\.[^/.]+$/, '')
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sample.name.replace(/\.[^/.]+$/, '')}_OP1.aif`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Play/stop the sample. A drawn zone wins over a selected slice: what you see
   * highlighted is what you hear, from the button and from the space bar alike.
   */
  const handlePlayToggle = () => {
    if (!audioBuffer) return;
    if (isPlaying) {
      audioEngine.pause();
      return;
    }
    if (zone) {
      handlePlayZone();
      return;
    }
    // Envelope set but no zone: audition the whole sample through it.
    if (gainPoints.length > 0) {
      const processed = renderProcessedRegion(0, audioBuffer.duration);
      if (processed) {
        setPlaybackOffsetSec(0);
        audioEngine.play(processed, sample.id);
        return;
      }
    }
    setPlaybackOffsetSec(0);
    audioEngine.play(audioBuffer, sample.id, {
      startSec: selectedSlice ? selectedSlice.startSec : cursorSec ?? 0,
      endSec: selectedSlice ? selectedSlice.endSec : audioBuffer.duration,
    });
  };

  // The space bar drives this view's transport while the library is on screen.
  useAudition(zone ? 'Zone sélectionnée' : 'Sample', handlePlayToggle);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => clampZoom(prev + delta));
  };

  // Preset Layer Combinations
  const applyPreset = (preset: 'hd-glow' | 'spectro-combo' | 'multiband-dj' | 'full-lab') => {
    if (preset === 'hd-glow') {
      setShowWaveform(true);
      setShowSpectrogram(false);
      setShowMultiBand(false);
      setShowPitchContour(false);
      setShowRmsEnvelope(true);
      setShowStereoVu(true);
    } else if (preset === 'spectro-combo') {
      setShowWaveform(true);
      setShowSpectrogram(true);
      setShowMultiBand(false);
      setShowPitchContour(false);
      setShowRmsEnvelope(false);
      setShowStereoVu(true);
      setSpectrogramOpacity(0.6);
    } else if (preset === 'multiband-dj') {
      setShowWaveform(true);
      setShowSpectrogram(false);
      setShowMultiBand(true);
      setShowPitchContour(false);
      setShowRmsEnvelope(true);
      setShowStereoVu(true);
    } else if (preset === 'full-lab') {
      setShowWaveform(true);
      setShowSpectrogram(true);
      setShowMultiBand(true);
      setShowPitchContour(true);
      setShowRmsEnvelope(true);
      setShowStereoVu(true);
      setSpectrogramOpacity(0.5);
    }
  };

  return (
    <div
      id={`waveform-container-${sample.id}`}
      className="flex flex-col bg-[#08080C] border border-[#1E1E28] rounded-none p-2.5 select-none shadow-xl"
      ref={containerRef}
    >
      {/* ======================================================== */}
      {/* 1. TOP TRANSPORT & VISUALIZATION LAYER BAR              */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-[#0C0C14] border border-[#202030] mb-2">
        {/* Left: LCD Display & Acoustic Recognition */}
        <div className="flex items-center gap-2.5 min-w-[240px]">
          <div className="px-2.5 py-1 bg-[#050C10] border border-[#00F0FF]/30 flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono text-[#00F0FF] animate-pulse">
                {isPlaying ? '▶ LECTURE' : '■ ARRÊT'}
              </span>
              <span className="text-xs font-mono text-[#00F0FF] font-bold truncate max-w-[170px]">
                {sample.name}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-mono text-[#38BDF8] mt-0.5">
              <span>{formatTimeStr(currentTime)} / {formatTimeStr(sample.duration)}</span>
              {sample.key && <span className="text-[#FFE600]">• {sample.key}</span>}
              {sample.bpm && <span className="text-[#34D399]">• {sample.bpm} BPM</span>}
              <span className="text-[#A855F7]">• {sample.sampleRate} Hz</span>
            </div>
          </div>

          {/* AI/DSP Acoustic Recognition Badge */}
          {acousticAnalysis && (
            <div
              className="hidden lg:flex flex-col justify-center px-2 py-1 bg-[#12121E] border border-[#A855F7]/40 text-[9px] font-mono"
              title="Analyse acoustique en temps réel : classification timbrale, transitoires, sub et envelope"
            >
              <div className="flex items-center gap-1 text-[#A855F7]">
                <Activity className="w-3 h-3" />
                <span className="font-bold uppercase text-[#00F0FF]">
                  {acousticAnalysis.type.toUpperCase()}
                </span>
                <span className="text-[#FFE600]">
                  ({Math.round(acousticAnalysis.acousticConfidence * 100)}%)
                </span>
              </div>
              <span className="text-[8px] text-[#8E8E98] truncate max-w-[190px]">
                {acousticAnalysis.acousticDetails}
              </span>
            </div>
          )}
        </div>

        {/* Center: Transport Controls */}
        <div className="flex items-center gap-1.5">
          {onPrevSample && (
            <button
              onClick={onPrevSample}
              className="p-1.5 bg-[#141420] text-[#8E8E98] hover:text-white border border-[#242436] hover:bg-[#1E1E2E] transition"
              title="Sample précédent"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* PLAY / PAUSE */}
          <button
            id="waveform-play-btn"
            onClick={handlePlayToggle}
            className={`px-3 py-1.5 text-xs font-mono flex items-center gap-1.5 font-bold transition ${
              isPlaying
                ? 'bg-[#FFE600] text-black hover:bg-[#FACC15]'
                : 'bg-[#00F0FF] text-black hover:bg-[#38BDF8]'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>PLAY</span>
              </>
            )}
          </button>

          {/* STOP */}
          <button
            id="waveform-stop-btn"
            onClick={() => audioEngine.stop()}
            className="p-1.5 bg-[#141420] text-[#8E8E98] hover:text-white border border-[#242436] hover:bg-[#1E1E2E] transition"
            title="Arrêter la lecture"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {onNextSample && (
            <button
              onClick={onNextSample}
              className="p-1.5 bg-[#141420] text-[#8E8E98] hover:text-white border border-[#242436] hover:bg-[#1E1E2E] transition"
              title="Sample suivant"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* LOOP Switch */}
          <button
            id="waveform-loop-btn"
            onClick={() => audioEngine.toggleLoop()}
            className={`px-2 py-1 text-[9px] font-mono flex items-center gap-1 border transition ${
              playbackState.isLooping
                ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF] font-bold'
                : 'bg-[#141420] text-[#8E8E98] border-[#242436] hover:text-white'
            }`}
            title="Lecture en boucle"
          >
            <Repeat className="w-3 h-3" />
            <span>LOOP</span>
          </button>

          {/* REVERSE Switch */}
          <button
            id="waveform-reverse-btn"
            onClick={() => audioEngine.toggleReverse()}
            className={`px-2 py-1 text-[9px] font-mono flex items-center gap-1 border transition ${
              playbackState.isReversed
                ? 'bg-[#FF7A00]/20 text-[#FF7A00] border-[#FF7A00] font-bold'
                : 'bg-[#141420] text-[#8E8E98] border-[#242436] hover:text-white'
            }`}
            title="Inversion du son (Reverse)"
          >
            <RotateCcw className="w-3 h-3" />
            <span>REV</span>
          </button>

          {/* Magnetic Zero-Crossing Snap Toggle */}
          <button
            onClick={() => setSnapToZeroCrossing(!snapToZeroCrossing)}
            className={`px-2 py-1 text-[9px] font-mono flex items-center gap-1 border transition ${
              snapToZeroCrossing
                ? 'bg-[#10B981]/20 text-[#34D399] border-[#10B981] font-bold'
                : 'bg-[#141420] text-[#8E8E98] border-[#242436]'
            }`}
            title="Aimantation automatique aux passages à zéro (anti-clics)"
          >
            <Magnet className="w-3 h-3" />
            <span className="hidden sm:inline">SNAP</span>
          </button>

          {/* Volume envelope editing */}
          <button
            onClick={() => {
              setIsVolumeEditing((current) => !current);
              setSelectedPointId(null);
            }}
            className={`px-2 py-1 text-[9px] font-mono flex items-center gap-1 border transition ${
              isVolumeEditing
                ? 'bg-[#FF7A00]/20 text-[#FF7A00] border-[#FF7A00] font-bold'
                : 'bg-[#141420] text-[#8E8E98] border-[#242436] hover:text-white'
            }`}
            title="Ligne de volume : cliquer la ligne crée un point, glisser le règle, Suppr efface le point sélectionné"
          >
            <Volume2 className="w-3 h-3" />
            <span className="hidden sm:inline">VOLUME</span>
          </button>

          {gainPoints.length > 0 && (
            <button
              onClick={() => {
                setGainPoints([]);
                setSelectedPointId(null);
              }}
              className="px-2 py-1 text-[9px] font-mono flex items-center gap-1 border border-[#242436] bg-[#141420] text-[#8E8E98] transition hover:text-white"
              title="Remettre la ligne de volume à plat"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{gainPoints.length} PT</span>
            </button>
          )}
        </div>

        {/* Right: Slicing Actions & Extraction Tools */}
        <div className="flex items-center gap-1.5">
          {/* Free zone (alt-drag): audition it, or copy it to a new sample */}
          {zone && (
            <div className="flex items-center gap-1 border border-[#FFE600]/50 bg-[#FFE600]/10 px-1.5 py-0.5">
              <span className="text-[9px] font-mono font-bold text-[#FFE600]">
                ZONE {(zone.endSec - zone.startSec).toFixed(3)}s
              </span>
              <button
                onClick={handlePlayZone}
                className="p-0.5 text-[#FFE600] hover:bg-[#FFE600]/20 transition"
                title="Écouter uniquement la zone sélectionnée (barre espace)"
              >
                <Play className="w-3 h-3 fill-current" />
              </button>
              <label
                className="flex items-center gap-0.5 text-[9px] font-mono text-[#FFE600]"
                title="Fondu d'ouverture appliqué à la zone (millisecondes)"
              >
                <span>FD IN</span>
                <input
                  type="number"
                  min={0}
                  max={2000}
                  value={fadeInMs}
                  onChange={(e) => setFadeInMs(Math.max(0, Number(e.target.value) || 0))}
                  className="w-10 border border-[#FFE600]/40 bg-[#0F0F14] px-1 py-0.5 text-[9px] text-[#FFE600]"
                />
              </label>
              <label
                className="flex items-center gap-0.5 text-[9px] font-mono text-[#FFE600]"
                title="Fondu de fermeture appliqué à la zone (millisecondes)"
              >
                <span>OUT</span>
                <input
                  type="number"
                  min={0}
                  max={2000}
                  value={fadeOutMs}
                  onChange={(e) => setFadeOutMs(Math.max(0, Number(e.target.value) || 0))}
                  className="w-10 border border-[#FFE600]/40 bg-[#0F0F14] px-1 py-0.5 text-[9px] text-[#FFE600]"
                />
              </label>
              {onAddExtractedSamples && (
                <button
                  onClick={handleCopyZoneToNewSample}
                  disabled={isCopyingZone}
                  className="flex items-center gap-1 bg-[#FFE600] px-1.5 py-0.5 text-[9px] font-mono font-bold text-black transition hover:bg-[#FFF176] disabled:opacity-50"
                  title="Copier la zone dans un nouveau sample, sans toucher au son d'origine"
                >
                  <Copy className="w-3 h-3" />
                  <span>{isCopyingZone ? 'COPIE...' : 'NOUVEAU SAMPLE'}</span>
                </button>
              )}
              <button
                onClick={() => setZone(null)}
                className="p-0.5 text-[#FFE600] hover:bg-[#FFE600]/20 transition"
                title="Effacer la zone"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {sample.slices && sample.slices.length > 1 && (
            <button
              onClick={handleExtractSlices}
              disabled={isExtracting}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#10B981] hover:bg-[#34D399] text-black font-bold border border-[#059669] text-[9px] font-mono transition"
              title="Découper et extraire les tranches P1..Pn en plusieurs petits fichiers WAV distincts"
            >
              <Scissors className="w-3 h-3" />
              <span>{isExtracting ? 'DÉCOUPE...' : `DÉCOUPER WAV (${sample.slices.length})`}</span>
            </button>
          )}

          {sample.slices && sample.slices.length > 1 && (
            <button
              onClick={handleExportOp1Aiff}
              className="hidden sm:flex items-center gap-1 px-2 py-1 bg-[#FF7A00]/20 hover:bg-[#FF7A00]/30 text-[#FF7A00] border border-[#FF7A00]/50 text-[9px] font-mono transition"
              title="Générer et exporter le patch OP-1 AIFF avec les balises temporelles APPL exactes"
            >
              <Layers className="w-3 h-3" />
              <span>PATCH OP-1</span>
            </button>
          )}

          {(
            <button
              id="open-dsp-waveform-btn"
              onClick={() => openSampleModal('dsp', sample)}
              className="flex items-center gap-1 px-2 py-1 bg-[#A855F7]/15 hover:bg-[#A855F7]/25 text-[#A855F7] border border-[#A855F7]/40 text-[9px] font-mono transition"
            >
              <Activity className="w-3 h-3" />
              <span>DSP LAB</span>
            </button>
          )}


          {/* Guide Popup Button */}
          <button
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1 px-2 py-1 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30 text-[9px] font-mono transition"
            title="Lexique et guide explicatif des visualisations audio (Spectrogramme, VU-mètre, etc.)"
          >
            <Info className="w-3 h-3" />
            <span className="hidden sm:inline">GUIDE VISUEL</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. LAYER COMBINER & VISUAL PRESET TOOLBAR                */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 py-1 bg-[#09090F] border-x border-t border-[#1C1C28] text-[9px] font-mono text-[#8E8E98]">
        {/* Left: Quick Presets */}
        <div className="flex items-center gap-1">
          <span className="text-[#00F0FF] font-bold mr-1 flex items-center gap-1">
            <Sliders className="w-3 h-3" />
            MODES :
          </span>
          <button
            onClick={() => applyPreset('hd-glow')}
            className={`px-2 py-0.5 rounded border transition ${
              showWaveform && !showSpectrogram && !showMultiBand
                ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF] font-bold'
                : 'bg-[#14141E] text-[#8E8E98] border-[#222230] hover:text-white'
            }`}
          >
            ✨ Onde HD Lisse
          </button>
          <button
            onClick={() => applyPreset('multiband-dj')}
            className={`px-2 py-0.5 rounded border transition ${
              showMultiBand
                ? 'bg-[#FFE600]/20 text-[#FFE600] border-[#FFE600] font-bold'
                : 'bg-[#14141E] text-[#8E8E98] border-[#222230] hover:text-white'
            }`}
          >
            🌈 Multi-Bandes DJ
          </button>
          <button
            onClick={() => applyPreset('spectro-combo')}
            className={`px-2 py-0.5 rounded border transition ${
              showSpectrogram && !showMultiBand
                ? 'bg-[#A855F7]/20 text-[#A855F7] border-[#A855F7] font-bold'
                : 'bg-[#14141E] text-[#8E8E98] border-[#222230] hover:text-white'
            }`}
          >
            🌌 Onde + Spectrogramme
          </button>
          <button
            onClick={() => applyPreset('full-lab')}
            className={`hidden md:block px-2 py-0.5 rounded border transition ${
              showSpectrogram && showMultiBand && showPitchContour
                ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981] font-bold'
                : 'bg-[#14141E] text-[#8E8E98] border-[#222230] hover:text-white'
            }`}
          >
            🔬 Laboratoire Complet
          </button>
        </div>

        {/* Right: Individual Layer Toggles & Palette Selector */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-[#12121C] p-0.5 border border-[#222232] rounded">
            <button
              onClick={() => setShowWaveform(!showWaveform)}
              className={`px-1.5 py-0.5 rounded text-[8px] transition ${
                showWaveform ? 'bg-[#00F0FF] text-black font-bold' : 'text-[#8E8E98] hover:text-white'
              }`}
              title="Afficher/Masquer la forme d'onde principale"
            >
              ONDE
            </button>
            <button
              onClick={() => setShowSpectrogram(!showSpectrogram)}
              className={`px-1.5 py-0.5 rounded text-[8px] transition ${
                showSpectrogram ? 'bg-[#A855F7] text-black font-bold' : 'text-[#8E8E98] hover:text-white'
              }`}
              title="Afficher/Masquer le spectrogramme FFT (cascade fréquentielle)"
            >
              SPECTRO
            </button>
            <button
              onClick={() => setShowMultiBand(!showMultiBand)}
              className={`px-1.5 py-0.5 rounded text-[8px] transition ${
                showMultiBand ? 'bg-[#FFE600] text-black font-bold' : 'text-[#8E8E98] hover:text-white'
              }`}
              title="Afficher/Masquer la décomposition 3-bandes (basses rouge, médiums cyan, aigus jaune)"
            >
              3-BANDES
            </button>
            <button
              onClick={() => setShowPitchContour(!showPitchContour)}
              className={`px-1.5 py-0.5 rounded text-[8px] transition ${
                showPitchContour ? 'bg-[#10B981] text-black font-bold' : 'text-[#8E8E98] hover:text-white'
              }`}
              title="Afficher/Masquer la trajectoire de pitch F0"
            >
              PITCH
            </button>
            <button
              onClick={() => setShowStereoVu(!showStereoVu)}
              className={`px-1.5 py-0.5 rounded text-[8px] transition ${
                showStereoVu ? 'bg-[#EC4899] text-black font-bold' : 'text-[#8E8E98] hover:text-white'
              }`}
              title="Afficher/Masquer les VU-mètres stéréo"
            >
              VU-MÈTRE
            </button>
          </div>

          {/* Color Palette Switcher */}
          <select
            value={colorTheme}
            onChange={(e) => setColorTheme(e.target.value as WaveformColorTheme)}
            className="bg-[#12121C] text-[#00F0FF] border border-[#222232] px-1.5 py-0.5 text-[8px] font-mono outline-none rounded"
            title="Thème de couleur"
          >
            <option value="cyber-neon">Palette Cyber Neon</option>
            <option value="sunset-amber">Palette Amber Sunset</option>
            <option value="emerald-matrix">Palette Matrix Emerald</option>
            <option value="magma-fire">Palette Magma Fire</option>
            <option value="ice-arctic">Palette Arctic Ice</option>
          </select>
        </div>
      </div>

      {/* Success Notification Banner */}
      {extractSuccessMsg && (
        <div className="mb-2 p-1.5 bg-[#10B981]/20 border border-[#10B981] text-[#34D399] text-[9px] font-mono flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>{extractSuccessMsg}</span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MAIN WAVEFORM CANVAS + INTEGRATED DYNAMIC STEREO VU   */}
      {/* ======================================================== */}
      <div className="relative flex w-full border border-[#1E1E28] bg-[#050508] overflow-hidden">
        {/* Left / Center: Waveform + Spectrogram Canvas */}
        <div
          style={{ height: height ? `${height}px` : undefined }}
          className={`relative flex-1 ${height ? '' : 'h-44'} overflow-hidden ${
            isHoveringMarker || draggingSliceIndex !== null || scrubSec !== null || zoneDrag
              ? 'cursor-ew-resize'
              : 'cursor-crosshair'
          }`}
        >
          <canvas
            id="main-waveform-canvas"
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            className="w-full h-full block"
          />

          {/* Selected Slice Overlay Badge */}
          {selectedSlice && (
            <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-[#000000]/90 px-2.5 py-1 border border-[#00F0FF]/50 text-[9px] font-mono rounded shadow">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedSlice.color }} />
              <span className="text-[#00F0FF] font-bold">{selectedSlice.label}</span>
              <span className="text-[#8E8E93]">
                [{selectedSlice.startSec.toFixed(3)}s → {selectedSlice.endSec.toFixed(3)}s]
              </span>
              <span className="text-[#FFE600]">
                ({((selectedSlice.endSec - selectedSlice.startSec) * 1000).toFixed(0)}ms)
              </span>
            </div>
          )}

          {/* Hint Overlay */}
          <div className="absolute top-1.5 right-2 bg-[#000000]/80 px-2 py-0.5 border border-[#222232] text-[8px] font-mono text-[#8E8E98] pointer-events-none rounded">
            ALT-GLISSER : ZONE • CARRÉS DU HAUT : TÊTE DE LECTURE & ZONE • VOLUME : CLIC = POINT, SUPPR = EFFACER • DOUBLE-CLIC : DÉCOUPER
          </div>
        </div>

        {/* Right: Master Dynamic Stereo VU-Meters & Phase Correlometer */}
        {showStereoVu && (
          <div className="w-20 bg-[#0A0A10] border-l border-[#1E1E28] p-1.5 flex flex-col justify-between select-none">
            <div className="text-[8px] font-mono text-[#8E8E98] text-center border-b border-[#1C1C26] pb-0.5">
              VU-MÈTRE
            </div>

            {/* Dual Peak & RMS Meter Bars (L and R) */}
            <div className="flex-1 flex justify-center gap-2.5 py-1">
              {/* Channel Left */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-mono text-[#38BDF8] font-bold mb-0.5">L</span>
                <div className="flex-1 w-2.5 bg-[#050508] border border-[#1E1E2A] rounded-sm overflow-hidden flex flex-col justify-end p-0.5">
                  <div
                    className="w-full transition-all duration-75"
                    style={{
                      height: `${Math.max(4, Math.min(100, (liveMeterL.peakDb + 60) * 1.66))}%`,
                      backgroundColor:
                        liveMeterL.peakDb > -1
                          ? '#EF4444'
                          : liveMeterL.peakDb > -6
                          ? '#F59E0B'
                          : liveMeterL.peakDb > -18
                          ? '#00F0FF'
                          : '#10B981',
                      boxShadow: isPlaying ? '0 0 6px rgba(0, 240, 255, 0.6)' : 'none',
                    }}
                  />
                </div>
                <span className="text-[6px] font-mono text-[#8E8E98] mt-0.5">
                  {isPlaying ? `${liveMeterL.peakDb.toFixed(0)}` : '-∞'}
                </span>
              </div>

              {/* dB Scale Labels */}
              <div className="flex flex-col justify-between py-1 text-[6px] font-mono text-[#555566] text-center">
                <span className="text-[#EF4444]">0</span>
                <span>-6</span>
                <span>-12</span>
                <span>-24</span>
                <span>-48</span>
              </div>

              {/* Channel Right */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-mono text-[#A855F7] font-bold mb-0.5">R</span>
                <div className="flex-1 w-2.5 bg-[#050508] border border-[#1E1E2A] rounded-sm overflow-hidden flex flex-col justify-end p-0.5">
                  <div
                    className="w-full transition-all duration-75"
                    style={{
                      height: `${Math.max(4, Math.min(100, (liveMeterR.peakDb + 60) * 1.66))}%`,
                      backgroundColor:
                        liveMeterR.peakDb > -1
                          ? '#EF4444'
                          : liveMeterR.peakDb > -6
                          ? '#F59E0B'
                          : liveMeterR.peakDb > -18
                          ? '#A855F7'
                          : '#10B981',
                      boxShadow: isPlaying ? '0 0 6px rgba(168, 85, 247, 0.6)' : 'none',
                    }}
                  />
                </div>
                <span className="text-[6px] font-mono text-[#8E8E98] mt-0.5">
                  {isPlaying ? `${liveMeterR.peakDb.toFixed(0)}` : '-∞'}
                </span>
              </div>
            </div>

            {/* Stereo Phase Correlation */}
            <div className="border-t border-[#1C1C26] pt-1 text-center">
              <div className="text-[7px] font-mono text-[#8E8E98] mb-0.5">PHASE</div>
              <div className="w-full h-1.5 bg-[#050508] border border-[#1E1E2A] rounded-sm relative overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 w-2 bg-[#10B981] transition-all"
                  style={{
                    left: `${Math.max(0, Math.min(85, ((phaseCorrelation + 1) / 2) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[6px] font-mono text-[#555566] px-0.5 mt-0.5">
                <span>-1</span>
                <span className="text-[#10B981]">+1</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 4. SLICES QUICK STRIP & HIT TRIGGER PADS                 */}
      {/* ======================================================== */}
      {sample.slices && sample.slices.length > 0 && (
        <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-0.5">
          <span className="text-[9px] font-mono text-[#8E8E93] uppercase mr-1 shrink-0">
            PADS ({sample.slices.length}) :
          </span>
          {sample.slices.map((slice) => {
            const isSel = selectedSlice?.id === slice.id;
            return (
              <button
                key={slice.id}
                id={`slice-pill-${slice.id}`}
                onClick={() => {
                  setSelectedSlice(slice);
                  if (onSliceClick) onSliceClick(slice);
                  if (audioBuffer) {
                    audioEngine.play(audioBuffer, sample.id, {
                      startSec: slice.startSec,
                      endSec: slice.endSec,
                    });
                  }
                }}
                className={`px-2 py-0.5 text-[9px] font-mono flex items-center gap-1 transition shrink-0 border rounded ${
                  isSel
                    ? 'bg-[#00F0FF] text-black font-bold border-[#00F0FF] shadow'
                    : 'bg-[#121218] text-[#EDEDEE] border-[#22222A] hover:bg-[#1A1A24]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: slice.color }} />
                <span>{slice.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Audio Visualizer Guide Modal */}
      <AudioVisualizationGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
};
