import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from '../stores/toastStore';
import {
  X,
  Play,
  Pause,
  Download,
  Sparkles,
  Sliders,
  FolderOpen,
  RefreshCw,
  Layers,
  Volume2,
  Zap,
  Music,
  Scissors,
  Check,
  RotateCcw,
  ArrowRight,
  HardDrive,
  Info,
  Search,
  GripVertical,
  ArrowLeftRight,
  Trash2,
  Plus,
  CheckCircle2,
  FileCode2,
} from 'lucide-react';
import { SampleItem, NewSample, SampleType } from '../types/sample';
import { audioEngine } from '../services/audioEngine';
import { useAudition } from '../stores/transportStore';
import {
  Op1DrumSlice,
  OP1_KEY_NAMES,
  OP1_KEY_COLORS,
  OP1_DEFAULT_CATEGORIES,
  autoPopulate24Op1Slots,
  buildOp1DrumBuffer,
  encodeOp1AiffPatch,
  batchGenerateOp1Kits,
} from '../services/op1PatchEncoder';
import { triggerFileDownload } from '../services/audioConverter';
import { loadSampleAudio, peekSampleAudio } from '../services/sampleAudio';
import { Modal } from './Modal';
import {
  calculateAudioMetrics,
  classifySample,
  detectAutoSlices,
  detectBpm,
  detectPitchAndKey,
  detectLoopVsOneShot,
  classifyGenre,
} from '../services/audioAnalyzer';
import { MiniWaveform } from './MiniWaveform';
import { Op1FillGauge } from './Op1FillGauge';

interface Op1KitBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSamples: SampleItem[];
  currentSelectedSample?: SampleItem | null;
  onImportNewSamples?: (samples: NewSample[]) => void;
}

// Computer keyboard mappings to 24 OP-1 keys
const KEYBOARD_SHORTCUTS = [
  'z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'j', 'm', // Octave 1: C1 to B1
  'q', '2', 'w', '3', 'e', 'r', '5', 't', '6', 'y', '7', 'u', // Octave 2: C2 to B2
];

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
  'multi-sound': { bg: 'bg-[#00F0FF]/15 border-[#00F0FF]/40', text: 'text-[#00F0FF]', label: 'Multi' },
  other: { bg: 'bg-[#18181D] border-[#26262B]', text: 'text-[#8E8E93]', label: 'Sample' },
};

export const Op1KitBuilderModal: React.FC<Op1KitBuilderModalProps> = ({
  isOpen,
  onClose,
  availableSamples,
  currentSelectedSample,
  onImportNewSamples,
}) => {
  const [kitName, setKitName] = useState<string>('Resonance_OP1_Kit');
  const [slices, setSlices] = useState<Op1DrumSlice[]>([]);
  const [selectedPadIndex, setSelectedPadIndex] = useState<number>(0);
  const [compositeBuffer, setCompositeBuffer] = useState<AudioBuffer | null>(null);
  /**
   * What the chosen sounds add up to before the builder squeezes them onto the
   * 12-second tape. The composite is always ≤ 12 s, so reading its duration
   * would show a full gauge and never an overfilled one.
   */
  const [rawKitSec, setRawKitSec] = useState<number>(0);
  const [isPlayingFullKit, setIsPlayingFullKit] = useState<boolean>(false);
  const [activePlayingPad, setActivePlayingPad] = useState<number | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [loudnessMatch, setLoudnessMatch] = useState<boolean>(true);
  const [useMono, setUseMono] = useState<boolean>(false);
  const [isBatchExporting, setIsBatchExporting] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'batch' | 'help'>('editor');

  // Left sidebar search & filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [draggedSampleId, setDraggedSampleId] = useState<string | null>(null);
  const [draggedPadSourceIndex, setDraggedPadSourceIndex] = useState<number | null>(null);
  const [hoveredDropTargetPad, setHoveredDropTargetPad] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /** Read at open time only — see the effect below. */
  const availableSamplesRef = useRef(availableSamples);
  availableSamplesRef.current = availableSamples;

  /**
   * Fill the 24 pads when the window opens, and only then.
   *
   * This used to run whenever `availableSamples` changed identity, which is
   * every few seconds while an import is running. Each run re-picked all 24
   * pads, read their 24 files and rebuilt the composite — so the kit kept
   * rebuilding itself under the user and the window would not respond. It was
   * wrong twice over: an arrangement being edited must not be thrown away
   * because the library grew by sixty-four files.
   */
  useEffect(() => {
    if (!isOpen) return;
    const initialSlots = autoPopulate24Op1Slots(availableSamplesRef.current);
    setSlices(initialSlots);
    void rebuildCompositeBuffer(initialSlots);
  }, [isOpen]);

  // Rebuild the stitched 12.0s buffer whenever slices or audio settings change
  const rebuildCompositeBuffer = async (currentSlices: Op1DrumSlice[]) => {
    setIsCompiling(true);
    try {
      const { audioBuffer, calculatedSlices, rawDurationSec } = await buildOp1DrumBuffer(
        currentSlices,
        { useMono, loudnessMatch, maxTotalDurationSec: 12.0 }
      );
      setCompositeBuffer(audioBuffer);
      setSlices(calculatedSlices);
      setRawKitSec(rawDurationSec);
    } catch (err) {
      console.error('Failed to compile OP-1 audio buffer', err);
    } finally {
      setIsCompiling(false);
    }
  };

  // Filter available samples in left drawer
  const filteredLibrarySamples = useMemo(() => {
    return availableSamples.filter((sample) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        sample.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sample.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        sample.genre?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = selectedTypeFilter === 'all' || sample.type === selectedTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [availableSamples, searchQuery, selectedTypeFilter]);

  // Draw 12-second visual waveform with 24 colored slice zones (Compact & crisp)
  useEffect(() => {
    if (!canvasRef.current || !compositeBuffer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const bufferLength = compositeBuffer.length;
    const channelData = compositeBuffer.getChannelData(0);

    // Clear background
    ctx.fillStyle = '#08090E';
    ctx.fillRect(0, 0, width, height);

    // Grid lines (seconds)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let s = 1; s <= 12; s++) {
      const x = (s / 12) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw slice regions
    slices.forEach((slice, idx) => {
      const startX = (slice.startSec / 12.0) * width;
      const endX = (slice.endSec / 12.0) * width;
      const sliceWidth = Math.max(2, endX - startX);

      // Slice background highlight
      const isSelected = selectedPadIndex === idx;
      const isPlaying = activePlayingPad === idx;
      const isHovered = hoveredDropTargetPad === idx;
      const baseColor = slice.color || OP1_KEY_COLORS[idx % OP1_KEY_COLORS.length];

      ctx.fillStyle = isPlaying
        ? 'rgba(0, 240, 255, 0.35)'
        : isHovered
        ? 'rgba(255, 122, 0, 0.25)'
        : isSelected
        ? 'rgba(255, 255, 255, 0.12)'
        : idx % 2 === 0
        ? 'rgba(255, 255, 255, 0.02)'
        : 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(startX, 0, sliceWidth, height);

      // Top colored indicator
      ctx.fillStyle = isHovered ? '#FF7A00' : baseColor;
      ctx.fillRect(startX, 0, sliceWidth, isSelected || isHovered ? 3 : 2);

      // Slice divider line
      ctx.strokeStyle = isSelected ? '#FFFFFF' : isHovered ? '#FF7A00' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = isSelected || isHovered ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.stroke();

      // Key label on canvas
      if (sliceWidth > 16) {
        ctx.fillStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.65)';
        ctx.font = '8px JetBrains Mono, monospace';
        ctx.fillText(OP1_KEY_NAMES[idx], startX + 2, 11);
      }
    });

    // Draw Waveform (Crisp, compact)
    ctx.strokeStyle = '#EDEDEE';
    ctx.lineWidth = 1.2;
    ctx.beginPath();

    const step = Math.ceil(bufferLength / width);
    const midY = height / 2;

    for (let x = 0; x < width; x++) {
      const sampleIdx = Math.floor(x * step);
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step && sampleIdx + j < bufferLength; j++) {
        const val = channelData[sampleIdx + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      if (min > max) {
        min = 0;
        max = 0;
      }

      const y1 = midY + min * (height * 0.40);
      const y2 = midY + max * (height * 0.40);

      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();

    // End 12s line
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width - 1, 0);
    ctx.lineTo(width - 1, height);
    ctx.stroke();
  }, [compositeBuffer, slices, selectedPadIndex, activePlayingPad, hoveredDropTargetPad]);

  // Keyboard shortcut listener for live finger-drumming (Space goes through
  // the shared transport, registered below next to the kit playback toggle)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      const padIdx = KEYBOARD_SHORTCUTS.indexOf(key);

      if (padIdx >= 0 && padIdx < 24) {
        e.preventDefault();
        triggerPad(padIdx);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, slices, compositeBuffer]);

  // Trigger individual pad playback
  const triggerPad = (padIdx: number) => {
    setSelectedPadIndex(padIdx);
    setActivePlayingPad(padIdx);

    const slice = slices[padIdx];
    if (!slice) return;

    const buf = slice.audioBuffer || slice.sampleItem?.audioBuffer;
    if (buf) {
      audioEngine.play(buf, `op1-pad-${padIdx}`, {
        reverse: slice.reverse,
        loudnessGainDb: loudnessMatch ? slice.sampleItem?.loudnessGainDb : 0,
      });
    }

    setTimeout(() => {
      setActivePlayingPad((current) => (current === padIdx ? null : current));
    }, 250);
  };

  // Play full 12.0s composite kit
  const togglePlayFullKit = () => {
    if (isPlayingFullKit) {
      audioEngine.stop();
      setIsPlayingFullKit(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    } else if (compositeBuffer) {
      audioEngine.play(compositeBuffer, 'op1-full-kit', {
        loop: false,
      });
      setIsPlayingFullKit(true);

      const startTime = Date.now();
      const durationMs = compositeBuffer.duration * 1000;

      const updatePlayhead = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= durationMs) {
          setIsPlayingFullKit(false);
        } else {
          animationFrameRef.current = requestAnimationFrame(updatePlayhead);
        }
      };
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    }
  };

  // Space plays / stops the full kit while this window is open.
  useAudition('Studio OP-1', togglePlayFullKit, isOpen);

  // Assign a sample directly into a target pad slot
  const assignSampleToPad = (sample: SampleItem, targetPadIndex: number) => {
    const updated = [...slices];
    const dur = Math.min(2.5, sample.duration || 0.5);

    updated[targetPadIndex] = {
      id: `op1-slice-${targetPadIndex}`,
      name: sample.name,
      type: sample.type,
      startSec: 0,
      endSec: dur,
      pitch: 0,
      reverse: false,
      playmode: 0,
      volume: 8192,
      // Whatever the cache happens to hold, so the pad can be auditioned right
      // away; the kit build reads the file for anything still missing.
      sampleItem: sample,
      audioBuffer: peekSampleAudio(sample),
      color: OP1_KEY_COLORS[targetPadIndex],
    };

    setSelectedPadIndex(targetPadIndex);
    rebuildCompositeBuffer(updated);
    setStatusMessage(`"${sample.name}" assigné à la touche ${OP1_KEY_NAMES[targetPadIndex]} !`);
    setTimeout(() => setStatusMessage(null), 2500);
  };

  // Swap or move between two pads
  const swapPadSlots = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return;
    const updated = [...slices];
    const temp = { ...updated[sourceIndex] };

    updated[sourceIndex] = {
      ...updated[targetIndex],
      id: `op1-slice-${sourceIndex}`,
      color: OP1_KEY_COLORS[sourceIndex],
    };

    updated[targetIndex] = {
      ...temp,
      id: `op1-slice-${targetIndex}`,
      color: OP1_KEY_COLORS[targetIndex],
    };

    setSelectedPadIndex(targetIndex);
    rebuildCompositeBuffer(updated);
    setStatusMessage(`Pads ${OP1_KEY_NAMES[sourceIndex]} et ${OP1_KEY_NAMES[targetIndex]} échangés !`);
    setTimeout(() => setStatusMessage(null), 2500);
  };

  // Drag & Drop Handlers
  const handleDragStartFromLibrary = (e: React.DragEvent, sample: SampleItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'library-sample', sampleId: sample.id }));
    setDraggedSampleId(sample.id);
    setDraggedPadSourceIndex(null);
  };

  const handleDragStartFromPad = (e: React.DragEvent, padIndex: number) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'pad-slot', padIndex }));
    setDraggedPadSourceIndex(padIndex);
    setDraggedSampleId(null);
  };

  const handleDragOverPad = (e: React.DragEvent, padIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (hoveredDropTargetPad !== padIndex) {
      setHoveredDropTargetPad(padIndex);
    }
  };

  const handleDragLeavePad = (e: React.DragEvent, padIndex: number) => {
    if (hoveredDropTargetPad === padIndex) {
      setHoveredDropTargetPad(null);
    }
  };

  const handleDropOnPad = (e: React.DragEvent, targetPadIndex: number) => {
    e.preventDefault();
    setHoveredDropTargetPad(null);

    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (rawData) {
        const payload = JSON.parse(rawData);
        if (payload.type === 'library-sample') {
          const sample = availableSamples.find((s) => s.id === payload.sampleId);
          if (sample) {
            assignSampleToPad(sample, targetPadIndex);
          }
        } else if (payload.type === 'pad-slot') {
          swapPadSlots(payload.padIndex, targetPadIndex);
        }
      } else if (draggedSampleId) {
        const sample = availableSamples.find((s) => s.id === draggedSampleId);
        if (sample) assignSampleToPad(sample, targetPadIndex);
      } else if (draggedPadSourceIndex !== null) {
        swapPadSlots(draggedPadSourceIndex, targetPadIndex);
      }
    } catch (err) {
      console.error('Drop handling error', err);
    } finally {
      setDraggedSampleId(null);
      setDraggedPadSourceIndex(null);
    }
  };

  // Clear single pad
  const handleClearPad = (padIdx: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = [...slices];
    const defaultMeta = OP1_DEFAULT_CATEGORIES[padIdx] || { suggestedType: 'other', label: `Pad ${padIdx + 1}` };

    updated[padIdx] = {
      id: `op1-slice-${padIdx}`,
      name: `Slot ${padIdx + 1} (${defaultMeta.label})`,
      type: defaultMeta.suggestedType,
      startSec: 0,
      endSec: 0.1,
      pitch: 0,
      reverse: false,
      playmode: 0,
      volume: 8192,
      color: OP1_KEY_COLORS[padIdx],
    };

    rebuildCompositeBuffer(updated);
    setStatusMessage(`Touche ${OP1_KEY_NAMES[padIdx]} réinitialisée.`);
    setTimeout(() => setStatusMessage(null), 2000);
  };

  // Auto-arrange all 24 slots using DSP taxonomic profiling
  const handleAutoArrange = async () => {
    const arranged = autoPopulate24Op1Slots(availableSamples);
    setSlices(arranged);
    await rebuildCompositeBuffer(arranged);
    setStatusMessage('Rangement automatique I.A. par profilage acoustique terminé !');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Slice a long sample (Drum break / loop) into 24 even slices
  const handleAutoSliceSelectedSample = async () => {
    const targetSample = currentSelectedSample || availableSamples[0];
    if (!targetSample) {
      toast.info('Veuillez sélectionner un sample ou une boucle à découper en 24 tranches.');
      return;
    }

    const buf = await loadSampleAudio(targetSample);
    if (!buf) {
      toast.error("Le son de ce sample n'a pas pu être lu depuis le dossier de travail.");
      return;
    }
    const dur = buf.duration;
    const sliceDur = dur / 24;

    const newSlices: Op1DrumSlice[] = [];
    for (let i = 0; i < 24; i++) {
      const startSec = i * sliceDur;
      const endSec = (i + 1) * sliceDur;
      newSlices.push({
        id: `op1-slice-${i}`,
        name: `${targetSample.name}_Slice_${String(i + 1).padStart(2, '0')}`,
        type: 'percussion',
        startSec,
        endSec,
        pitch: 0,
        reverse: false,
        playmode: 0,
        volume: 8192,
        audioBuffer: buf,
        color: OP1_KEY_COLORS[i],
      });
    }

    setSlices(newSlices);
    await rebuildCompositeBuffer(newSlices);
    setStatusMessage(`Découpe en 24 tranches régulières de "${targetSample.name}" terminée !`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Folder drop / selection handler with automatic DSP analysis & slot assignment
  const handleFolderUpload = async (fileList: FileList | File[]) => {
    const audioFiles = Array.from(fileList).filter((f) =>
      f.name.match(/\.(wav|aif|aiff|mp3|flac|ogg|m4a)$/i)
    );

    if (audioFiles.length === 0) {
      toast.info('Aucun fichier audio valide trouvé dans le dossier.');
      return;
    }

    setIsCompiling(true);
    setStatusMessage(`Ingestion & analyse DSP de ${audioFiles.length} samples...`);

    const importedSampleItems: NewSample[] = [];

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      try {
        const arrayBuf = await file.arrayBuffer();
        const buffer = await audioEngine.decodeAudioData(arrayBuf);
        const cleanName = file.name.replace(/\.[^/.]+$/, '');

        const metrics = calculateAudioMetrics(buffer);
        const pitchKey = detectPitchAndKey(buffer);
        const loopAnalysis = detectLoopVsOneShot(buffer);
        const bpm = loopAnalysis.bpm || detectBpm(buffer);
        const slices = detectAutoSlices(buffer, { sensitivity: 0.5 });
        const classification = classifySample(buffer, cleanName, metrics, slices.length);
        const genre = classifyGenre(cleanName, bpm, loopAnalysis.isLoop, classification.type);

        const loudnessGainDb = Math.max(-12, Math.min(12, -14.0 - metrics.lufs));

        importedSampleItems.push({
          id: `imp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          name: cleanName,
          originalFileName: file.name,
          format: 'wav',
          size: file.size,
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
          bitDepth: 24,
          channels: buffer.numberOfChannels,
          bpm,
          key: pitchKey?.keyString,
          pitchHz: pitchKey?.pitchHz,
          type: classification.type,
          category: loopAnalysis.isLoop ? 'loop' : 'one-shot',
          genre,
          isLoop: loopAnalysis.isLoop,
          lufs: metrics.lufs,
          loudnessGainDb,
          ep133Slot: i + 1,
          tags: [...classification.tags, 'op1-imported'],
          folderId: 'f-op1',
          folderPath: '/OP1_Import',
          favorite: false,
          rating: 0,
          spectralCentroid: metrics.spectralCentroid,
          dynamicRangeDb: metrics.dynamicRangeDb,
          peakDb: metrics.peakDb,
          rmsDb: metrics.rmsDb,
          zeroCrossingRate: metrics.zeroCrossingRate,
          slices: [],
          blobUrl: URL.createObjectURL(file),
          audioBuffer: buffer,
          dateAdded: Date.now(),
        });
      } catch (err) {
        console.warn(`Erreur lors du décodage de ${file.name}`, err);
      }
    }

    if (onImportNewSamples && importedSampleItems.length > 0) {
      onImportNewSamples(importedSampleItems);
    }

    // Auto arrange the 24 slots with newly imported samples
    const arranged = autoPopulate24Op1Slots(
      importedSampleItems.length > 0 ? importedSampleItems : availableSamples
    );
    setSlices(arranged);
    await rebuildCompositeBuffer(arranged);

    setIsCompiling(false);
    setStatusMessage(`${importedSampleItems.length} samples analysés et rangés sur les 24 touches OP-1 !`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Export current kit as official OP-1 AIFF patch
  const handleExportAiff = () => {
    if (!compositeBuffer) return;
    const blob = encodeOp1AiffPatch(compositeBuffer, slices, kitName);
    const safeName = kitName.replace(/[^a-zA-Z0-9_-]/g, '_');
    triggerFileDownload(blob, `${safeName}.aif`);
  };

  // Batch Export multiple OP-1 Kits into a ZIP
  const handleBatchExportZip = async () => {
    setIsBatchExporting(true);
    setBatchProgress(10);
    try {
      const zipBlob = await batchGenerateOp1Kits(
        availableSamples,
        {
          packName: kitName,
          loudnessMatch,
          useMono,
        },
        (progress, currentKit) => {
          setBatchProgress(progress);
          setStatusMessage(`Génération de ${currentKit} (${progress}%)...`);
        }
      );
      triggerFileDownload(zipBlob, `${kitName}_OP1_Drum_Kits_Pack.zip`);
      setStatusMessage('Pack complet OP-1 exporté avec succès !');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error('Erreur export pack OP-1', err);
      toast.error('Erreur lors de la génération du pack OP-1.');
    } finally {
      setIsBatchExporting(false);
      setBatchProgress(0);
    }
  };

  // Selected slice parameters update
  const handleUpdateSelectedSlice = (updates: Partial<Op1DrumSlice>) => {
    const updated = slices.map((s, idx) => (idx === selectedPadIndex ? { ...s, ...updates } : s));
    setSlices(updated);
    rebuildCompositeBuffer(updated);
  };

  const selectedSlice = slices[selectedPadIndex];
  const totalAllocatedSec = compositeBuffer ? compositeBuffer.duration.toFixed(2) : '0.00';
  /** Pads that actually hold a sound — an empty pad costs the kit nothing. */
  const padsUsed = slices.filter((slice) => slice.audioBuffer).length;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="full"
      accent="#FF5E00"
      icon={<Music className="h-5 w-5" />}
      title="Studio Drum Kit OP-1"
      subtitle="Balisage temporel APPL JSON, glisser-déposer modulaire et export patch .AIF 12.0s"
      bodyClassName="flex flex-col overflow-hidden"
      headerRight={
        <>
            <div className="flex bg-[#08090E] p-0.5 rounded-lg border border-[#272A38] text-xs font-mono">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'editor'
                    ? 'bg-[#00F0FF] text-black font-bold shadow'
                    : 'text-[#8A8F9E] hover:text-white'
                }`}
              >
                Éditeur 24 Pads
              </button>
              <button
                onClick={() => setActiveTab('batch')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'batch'
                    ? 'bg-[#FF5E00] text-white font-bold shadow'
                    : 'text-[#8A8F9E] hover:text-white'
                }`}
              >
                Générateur Multi-Kits ZIP
              </button>
              <button
                onClick={() => setActiveTab('help')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'help'
                    ? 'bg-[#272A38] text-white font-bold'
                    : 'text-[#8A8F9E] hover:text-white'
                }`}
              >
                Guide OP-1
              </button>
            </div>

        </>
      }
    >
        {/* Status banner */}
        {statusMessage && (
          <div className="bg-[#00F0FF]/15 border-b border-[#00F0FF]/30 px-5 py-1.5 text-xs font-mono text-[#00F0FF] flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              {statusMessage}
            </span>
          </div>
        )}

        {/* Content Tabs */}
        {activeTab === 'editor' && (
          <div className="flex-1 flex overflow-hidden">
            {/* LEFT COLUMN: Clean Somber Sample Library Drawer (Drag Source) */}
            <div className="w-80 border-r border-[#272A38] bg-[#0C0E15] flex flex-col shrink-0">
              {/* Drawer Header */}
              <div className="p-3.5 border-b border-[#272A38] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-[#00F0FF]" />
                    Base de Samples ({filteredLibrarySamples.length})
                  </span>
                  <span className="text-[10px] font-mono text-[#8A8F9E] px-1.5 py-0.5 rounded bg-[#161824]">
                    Glisser vers les pads
                  </span>
                </div>

                {/* Search Field */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5F72]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Chercher un sample, kick, snare..."
                    className="w-full bg-[#141724] border border-[#272A38] rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-[#5A5F72] focus:outline-none focus:border-[#00F0FF]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5F72] hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Type Filter Pills */}
                <div className="flex flex-wrap gap-1">
                  {['all', 'kick', 'snare', 'hihat', 'clap', '808', 'percussion', 'bass', 'lead'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTypeFilter(t)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-all ${
                        selectedTypeFilter === t
                          ? 'bg-[#00F0FF] text-black font-bold'
                          : 'bg-[#161824] text-[#8A8F9E] hover:text-white hover:bg-[#1E2232]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sample List (Draggable Items) */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {filteredLibrarySamples.length === 0 ? (
                  <div className="p-6 text-center text-xs font-mono text-[#5A5F72]">
                    Aucun sample correspondant.
                  </div>
                ) : (
                  filteredLibrarySamples.map((sample) => {
                    const badge = TYPE_BADGES[sample.type] || TYPE_BADGES.other;
                    const isCurrent = currentSelectedSample?.id === sample.id;

                    return (
                      <div
                        key={sample.id}
                        draggable
                        onDragStart={(e) => handleDragStartFromLibrary(e, sample)}
                        onClick={() => {
                          void loadSampleAudio(sample).then((buffer) => {
                            if (!buffer) return;
                            audioEngine.play(buffer, sample.id, {
                              loudnessGainDb: loudnessMatch ? sample.loudnessGainDb : 0,
                            });
                          });
                        }}
                        className={`group p-2 rounded-lg border flex items-center justify-between cursor-grab active:cursor-grabbing select-none transition-all ${
                          isCurrent
                            ? 'bg-[#181B28] border-[#00F0FF]/40'
                            : 'bg-[#12141F] border-[#222533] hover:bg-[#1A1D2C] hover:border-[#323648]'
                        }`}
                        title="Cliquez pour écouter, glissez sur une touche pour l'assigner"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <GripVertical className="w-3 h-3 text-[#4A4F62] group-hover:text-[#00F0FF] shrink-0" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void loadSampleAudio(sample).then((buffer) => {
                                if (!buffer) return;
                                audioEngine.play(buffer, sample.id, {
                                  loudnessGainDb: loudnessMatch ? sample.loudnessGainDb : 0,
                                });
                              });
                            }}
                            className="w-5 h-5 rounded bg-[#1D2132] hover:bg-[#00F0FF] hover:text-black text-[#8A8F9E] flex items-center justify-center shrink-0 transition-colors"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-white truncate group-hover:text-[#00F0FF]">
                              {sample.name}
                            </p>
                            <div className="flex items-center gap-1 text-[9px] font-mono text-[#7A7F92]">
                              <span>{sample.duration.toFixed(2)}s</span>
                              <span>•</span>
                              <span>{sample.lufs ? `${sample.lufs.toFixed(0)} LUFS` : 'WAV'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <MiniWaveform
                            audioBuffer={peekSampleAudio(sample)}
                            sampleId={sample.id}
                            type={sample.type}
                            width={55}
                            height={18}
                          />
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase shrink-0 ${badge.bg} ${badge.text}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Quick Ingest button */}
              <div className="p-3 border-t border-[#272A38] bg-[#0C0E15]">
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="w-full py-2 rounded-lg bg-[#181B28] hover:bg-[#222638] border border-[#272A38] text-xs font-mono text-white flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-[#00F0FF]" />
                  Importer d'autres fichiers
                </button>
              </div>
            </div>

            {/* RIGHT MAIN AREA: Waveform + 24 Pad Matrix + Pad Controls */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col bg-[#10121A]">
              {/* Top Toolbar: Kit Name & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#08090E] p-3 rounded-xl border border-[#272A38]">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono text-[#8A8F9E] uppercase tracking-wider">Kit :</span>
                  <input
                    type="text"
                    value={kitName}
                    onChange={(e) => setKitName(e.target.value)}
                    className="bg-[#141724] border border-[#272A38] rounded-lg px-3 py-1 text-xs font-mono text-[#EDEDEE] focus:outline-none focus:border-[#00F0FF] w-52"
                    placeholder="Mon_Kit_OP1"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={folderInputRef}
                    type="file"
                    {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFolderUpload(e.target.files)}
                  />

                  <button
                    onClick={handleAutoArrange}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#00F0FF]/20 to-[#00F0FF]/10 hover:from-[#00F0FF]/30 hover:to-[#00F0FF]/20 border border-[#00F0FF]/40 text-xs font-mono text-[#00F0FF] flex items-center gap-1.5 transition-all"
                    title="Range automatiquement 24 samples selon leur profil acoustique (Kicks en bas, Snares, Hats, Leads)"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Rangement Auto I.A.
                  </button>

                  <button
                    onClick={handleAutoSliceSelectedSample}
                    className="px-3 py-1.5 rounded-lg bg-[#181B28] hover:bg-[#222638] border border-[#272A38] text-xs font-mono text-[#F59E0B] flex items-center gap-1.5 transition-all"
                    title="Découpe le sample sélectionné en 24 tranches régulières sur tout le clavier"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    Découpe 24 Tranches
                  </button>

                  <label className="flex items-center gap-1.5 text-xs font-mono text-[#8A8F9E] cursor-pointer ml-1">
                    <input
                      type="checkbox"
                      checked={loudnessMatch}
                      onChange={(e) => {
                        setLoudnessMatch(e.target.checked);
                        rebuildCompositeBuffer(slices);
                      }}
                      className="rounded bg-[#141724] border-[#272A38] text-[#00F0FF] focus:ring-0"
                    />
                    Égalisation LUFS (-14dB)
                  </label>
                </div>
              </div>

              {/* Compact Visual Tape & Waveform Strip (Reduced Height) */}
              <div className="bg-[#08090E] p-3 rounded-xl border border-[#272A38] space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="text-[#8A8F9E] flex items-center gap-1.5 text-xs shrink-0">
                      <Sliders className="w-3 h-3 text-[#00F0FF]" />
                      Bande Master OP-1 (44.1 kHz / 16-bit)
                    </span>
                    <Op1FillGauge
                      kind="drum"
                      usedSec={rawKitSec || Number(totalAllocatedSec)}
                      padsUsed={padsUsed}
                      className="flex-1 min-w-[220px] max-w-md"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlayFullKit}
                      className="px-2.5 py-1 rounded bg-[#00F0FF] hover:bg-[#00D8E6] text-black font-mono font-bold text-xs flex items-center gap-1.5 transition-all shadow"
                    >
                      {isPlayingFullKit ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                      {isPlayingFullKit ? 'Pause' : 'Écouter Master'}
                    </button>
                  </div>
                </div>

                {/* Compact Waveform Canvas (Reduced to 60px height) */}
                <div className="relative rounded-lg overflow-hidden border border-[#272A38]">
                  <canvas
                    ref={canvasRef}
                    width={1000}
                    height={64}
                    className="w-full h-16 cursor-pointer block"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const ratio = clickX / rect.width;
                      const clickedSec = ratio * 12.0;

                      // Find clicked slice
                      const foundIdx = slices.findIndex(
                        (s) => clickedSec >= s.startSec && clickedSec <= s.endSec
                      );
                      if (foundIdx >= 0) {
                        triggerPad(foundIdx);
                      }
                    }}
                  />
                </div>
              </div>

              {/* 24-Pad Hardware Keyboard Visualizer (C1 to B2) with Drag & Drop */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-[#8A8F9E]">
                  <span className="flex items-center gap-1.5 text-white font-medium">
                    <Music className="w-3.5 h-3.5 text-[#00F0FF]" />
                    CLAVIER OP-1 (2 OCTAVES : 24 TOUCHES PHYSIQUES)
                  </span>
                  <span className="text-[11px] text-[#7A7F92]">
                    Glisser un sample de la colonne de gauche ou réorganiser entre touches
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
                  {slices.map((slice, idx) => {
                    const isSelected = selectedPadIndex === idx;
                    const isPlaying = activePlayingPad === idx;
                    const isDropTarget = hoveredDropTargetPad === idx;
                    const keyName = OP1_KEY_NAMES[idx];
                    const shortcut = KEYBOARD_SHORTCUTS[idx]?.toUpperCase();
                    const sliceDuration = (slice.endSec - slice.startSec).toFixed(2);
                    const baseColor = slice.color || OP1_KEY_COLORS[idx];
                    const hasSample = !!(slice.audioBuffer || slice.sampleItem);

                    return (
                      <div
                        key={slice.id || idx}
                        draggable
                        onDragStart={(e) => handleDragStartFromPad(e, idx)}
                        onDragOver={(e) => handleDragOverPad(e, idx)}
                        onDragLeave={(e) => handleDragLeavePad(e, idx)}
                        onDrop={(e) => handleDropOnPad(e, idx)}
                        onClick={() => triggerPad(idx)}
                        style={{
                          borderColor: isDropTarget
                            ? '#FF7A00'
                            : isPlaying
                            ? '#00F0FF'
                            : isSelected
                            ? '#FFFFFF'
                            : '#272A38',
                          boxShadow: isPlaying
                            ? `0 0 12px ${baseColor}`
                            : isDropTarget
                            ? '0 0 12px #FF7A00'
                            : 'none',
                        }}
                        className={`group relative p-2 rounded-xl border flex flex-col justify-between cursor-pointer transition-all min-h-[96px] select-none ${
                          isPlaying
                            ? 'bg-[#00F0FF]/25 scale-95'
                            : isDropTarget
                            ? 'bg-[#FF7A00]/20 border-[#FF7A00]'
                            : isSelected
                            ? 'bg-[#1C1F2E]'
                            : 'bg-[#12141F] hover:bg-[#181B2A]'
                        }`}
                      >
                        {/* Top Bar with Key Note & Color Pill & Clear Button */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-white flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ backgroundColor: baseColor }}
                            />
                            {keyName}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#272A38] text-[#8A8F9E]">
                              {shortcut}
                            </span>
                            {hasSample && (
                              <button
                                onClick={(e) => handleClearPad(idx, e)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[#8A8F9E] hover:text-red-400 transition-opacity"
                                title="Réinitialiser ce pad"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Sound Name & Type */}
                        <div className="my-1">
                          <p className="text-[11px] font-semibold text-[#EDEDEE] truncate" title={slice.name}>
                            {slice.name}
                          </p>
                          <span className="text-[8px] font-mono uppercase text-[#00F0FF] tracking-wider block">
                            {slice.type}
                          </span>
                        </div>

                        {/* Footer: Duration & Pitch */}
                        <div className="flex items-center justify-between text-[9px] font-mono text-[#8A8F9E] border-t border-[#272A38]/50 pt-1">
                          <span>{sliceDuration}s</span>
                          <span>{slice.pitch !== 0 ? `${slice.pitch > 0 ? '+' : ''}${slice.pitch}st` : '0st'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Individual Pad Fine-Tuning Deck */}
              {selectedSlice && (
                <div className="bg-[#08090E] p-4 rounded-xl border border-[#272A38] space-y-3 mt-auto">
                  <div className="flex items-center justify-between border-b border-[#272A38] pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: selectedSlice.color || OP1_KEY_COLORS[selectedPadIndex] }}
                      />
                      <h3 className="text-xs font-bold font-mono text-white">
                        Paramètres Touche {OP1_KEY_NAMES[selectedPadIndex]} : {selectedSlice.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerPad(selectedPadIndex)}
                        className="px-2.5 py-1 rounded bg-[#181B28] hover:bg-[#222638] text-xs font-mono text-white flex items-center gap-1 border border-[#272A38]"
                      >
                        <Play className="w-3 h-3 text-[#00F0FF] fill-current" /> Tester
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Pitch Semi-tones */}
                    <div className="bg-[#12141F] p-2.5 rounded-lg border border-[#272A38] space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#8A8F9E]">Hauteur (Pitch) :</span>
                        <span className="text-[#00F0FF] font-bold">
                          {selectedSlice.pitch > 0 ? `+${selectedSlice.pitch}` : selectedSlice.pitch} st
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-24"
                        max="24"
                        step="1"
                        value={selectedSlice.pitch}
                        onChange={(e) => handleUpdateSelectedSlice({ pitch: Number(e.target.value) })}
                        className="w-full accent-[#00F0FF] h-1.5 bg-[#272A38] rounded-lg"
                      />
                    </div>

                    {/* Volume (OP-1 Scale: 0 to 8192) */}
                    <div className="bg-[#12141F] p-2.5 rounded-lg border border-[#272A38] space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#8A8F9E]">Volume OP-1 :</span>
                        <span className="text-[#F59E0B] font-bold">{selectedSlice.volume}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="8192"
                        step="64"
                        value={selectedSlice.volume}
                        onChange={(e) => handleUpdateSelectedSlice({ volume: Number(e.target.value) })}
                        className="w-full accent-[#F59E0B] h-1.5 bg-[#272A38] rounded-lg"
                      />
                    </div>

                    {/* Reverse Toggle */}
                    <div className="bg-[#12141F] p-2.5 rounded-lg border border-[#272A38] flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-[#8A8F9E] block">Mode Reverse :</span>
                        <span className="text-[10px] text-[#5A5F72]">Lecture Inversée</span>
                      </div>
                      <button
                        onClick={() => handleUpdateSelectedSlice({ reverse: !selectedSlice.reverse })}
                        className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                          selectedSlice.reverse
                            ? 'bg-[#FF5E00] text-white'
                            : 'bg-[#272A38] text-[#8A8F9E] hover:text-white'
                        }`}
                      >
                        {selectedSlice.reverse ? 'ACTIF' : 'NORMAL'}
                      </button>
                    </div>

                    {/* Play Mode (One-Shot vs Loop) */}
                    <div className="bg-[#12141F] p-2.5 rounded-lg border border-[#272A38] flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-[#8A8F9E] block">Mode Lecture :</span>
                        <span className="text-[10px] text-[#5A5F72]">Trigger vs Gate/Loop</span>
                      </div>
                      <button
                        onClick={() =>
                          handleUpdateSelectedSlice({
                            playmode: selectedSlice.playmode === 0 ? 1 : 0,
                          })
                        }
                        className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                          selectedSlice.playmode === 1
                            ? 'bg-[#00F0FF] text-black'
                            : 'bg-[#272A38] text-white'
                        }`}
                      >
                        {selectedSlice.playmode === 1 ? 'LOOP / GATE' : 'ONE-SHOT'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Batch Pack Generator Tab */}
        {activeTab === 'batch' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-[#08090E] p-6 rounded-2xl border border-[#272A38] space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#FF5E00]/15 rounded-xl border border-[#FF5E00]/30 text-[#FF5E00]">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Générateur Automatique de Banques OP-1 (Multi-Kits)</h3>
                  <p className="text-xs text-[#8A8F9E] font-mono">
                    Transforme automatiquement l'intégralité de vos {availableSamples.length} samples en kits OP-1 prêts à l'emploi.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#272A38]">
                <div className="bg-[#12141F] p-4 rounded-xl border border-[#272A38]">
                  <span className="text-xs font-mono text-[#8A8F9E] block">Samples Détectés :</span>
                  <span className="text-2xl font-bold font-mono text-white mt-1 block">
                    {availableSamples.length}
                  </span>
                </div>

                <div className="bg-[#12141F] p-4 rounded-xl border border-[#272A38]">
                  <span className="text-xs font-mono text-[#8A8F9E] block">Kits OP-1 Générés (24 pads/kit) :</span>
                  <span className="text-2xl font-bold font-mono text-[#00F0FF] mt-1 block">
                    {Math.max(1, Math.ceil(availableSamples.length / 24))} Kits
                  </span>
                </div>

                <div className="bg-[#12141F] p-4 rounded-xl border border-[#272A38]">
                  <span className="text-xs font-mono text-[#8A8F9E] block">Format de Sortie :</span>
                  <span className="text-xs font-mono text-emerald-400 mt-2 block">
                    AIFF 16-bit 44.1kHz + APPL Chunk
                  </span>
                </div>
              </div>

              {isBatchExporting && (
                <div className="space-y-2 py-4">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#8A8F9E]">Progression de l'export :</span>
                    <span className="text-[#00F0FF]">{batchProgress}%</span>
                  </div>
                  <div className="w-full bg-[#12141F] h-2 rounded-full overflow-hidden border border-[#272A38]">
                    <div
                      className="bg-gradient-to-r from-[#FF5E00] to-[#00F0FF] h-full transition-all duration-300"
                      style={{ width: `${batchProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button
                  disabled={isBatchExporting || availableSamples.length === 0}
                  onClick={handleBatchExportZip}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#FF5E00] to-[#E05200] hover:from-[#FF6E1A] hover:to-[#EB5907] text-white font-mono font-bold text-sm flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {isBatchExporting ? 'Génération en cours...' : 'Générer & Télécharger le Pack OP-1 (.ZIP)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Guide OP-1 Installation Tab */}
        {activeTab === 'help' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-[#8A8F9E]">
            <div className="bg-[#08090E] p-6 rounded-2xl border border-[#272A38] space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-[#00F0FF]" />
                Comment transférer vos patchs sur le Teenage Engineering OP-1 ?
              </h3>

              <ol className="space-y-3 font-mono text-xs text-[#EDEDEE] list-decimal list-inside">
                <li>
                  Allumez votre <strong>OP-1</strong> et connectez-le à votre ordinateur avec le câble USB.
                </li>
                <li>
                  Sur l'OP-1, appuyez sur <kbd className="px-2 py-0.5 bg-[#272A38] rounded">Shift + COM</kbd>, puis appuyez sur la touche <kbd className="px-2 py-0.5 bg-[#272A38] rounded">3</kbd> pour passer en <strong>Disk Mode</strong>.
                </li>
                <li>
                  Le disque de stockage <strong>OP-1</strong> apparaît sur votre ordinateur.
                </li>
                <li>
                  Ouvrez le dossier <code className="text-[#00F0FF]">/drum/user/</code> et déposez simplement vos fichiers <code className="text-[#00F0FF]">.aif</code> créés ici.
                </li>
                <li>
                  Éjectez le disque OP-1 en toute sécurité, puis appuyez sur la touche <kbd className="px-2 py-0.5 bg-[#272A38] rounded">DRUM</kbd> de la machine.
                </li>
                <li>
                  Sélectionnez votre kit dans le sous-dossier <em>user</em> : toutes les 24 touches sont instantanément calées et balisées sans découpe manuelle nécessaire !
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#272A38] bg-[#141722]">
          <div className="flex items-center gap-3 text-xs font-mono text-[#8A8F9E]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Moteur Audio OP-1 Prêt
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-mono text-[#8A8F9E] hover:text-white hover:bg-[#272A38] transition-colors"
            >
              Fermer
            </button>

            <button
              disabled={isCompiling || !compositeBuffer}
              onClick={handleExportAiff}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#00F0FF] to-[#00D0DF] hover:from-[#1AF2FF] hover:to-[#00E5F5] text-black font-mono font-bold text-xs flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Exporter Patch OP-1 (.AIF)
            </button>
          </div>
        </div>
    </Modal>
  );
};
