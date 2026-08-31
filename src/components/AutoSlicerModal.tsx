import React, { useState, useEffect } from 'react';
import {
  X,
  Scissors,
  Download,
  Play,
  Pause,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  Layers,
  FolderPlus,
  Check,
} from 'lucide-react';
import { SampleItem, SliceRegion, SampleType } from '../types/sample';
import { detectAutoSlices } from '../services/audioAnalyzer';
import { audioEngine } from '../services/audioEngine';
import { exportSlicesZip, triggerFileDownload, audioBufferToWavBlob } from '../services/audioConverter';

interface AutoSlicerModalProps {
  sample: SampleItem;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSampleSlices: (sampleId: string, slices: SliceRegion[]) => void;
  onExtractSlicesToLibrary: (newSamples: SampleItem[]) => void;
}

const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I'];

export const AutoSlicerModal: React.FC<AutoSlicerModalProps> = ({
  sample,
  isOpen,
  onClose,
  onUpdateSampleSlices,
  onExtractSlicesToLibrary,
}) => {
  const [sensitivity, setSensitivity] = useState<number>(0.6);
  const [minDurationMs, setMinDurationMs] = useState<number>(100);
  const [silenceThresholdDb, setSilenceThresholdDb] = useState<number>(-38);
  const [slices, setSlices] = useState<SliceRegion[]>(sample.slices || []);
  const [activePlayingSliceId, setActivePlayingSliceId] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [extractedSuccess, setExtractedSuccess] = useState<boolean>(false);

  // Sync slices when sample changes
  useEffect(() => {
    if (sample.slices && sample.slices.length > 0) {
      setSlices(sample.slices);
    } else if (sample.audioBuffer) {
      const auto = detectAutoSlices(sample.audioBuffer, {
        sensitivity,
        minSliceDurationMs: minDurationMs,
        silenceThresholdDb,
      });
      setSlices(auto);
    }
  }, [sample]);

  // Recalculate auto slices on parameter change
  const handleRecalculateSlices = () => {
    if (!sample.audioBuffer) return;
    const detected = detectAutoSlices(sample.audioBuffer, {
      sensitivity,
      minSliceDurationMs: minDurationMs,
      silenceThresholdDb,
    });
    setSlices(detected);
  };

  // Play specific slice
  const handlePlaySlice = (slice: SliceRegion) => {
    if (!sample.audioBuffer) return;
    setActivePlayingSliceId(slice.id);
    audioEngine.play(sample.audioBuffer, sample.id, {
      startSec: slice.startSec,
      endSec: slice.endSec,
    });

    const durationMs = (slice.endSec - slice.startSec) * 1000;
    setTimeout(() => {
      setActivePlayingSliceId((curr) => (curr === slice.id ? null : curr));
    }, durationMs);
  };

  // Play/pause entire sample
  const handleTogglePlayFull = () => {
    if (!sample.audioBuffer) return;
    if (audioEngine.getState().isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play(sample.audioBuffer, sample.id, sample.loudnessGainDb);
    }
  };

  // Keyboard trigger MPC pads (1-8, Q-I) and Spacebar for full playback
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTextInput =
        (target instanceof HTMLInputElement &&
          target.type !== 'range' &&
          target.type !== 'checkbox' &&
          target.type !== 'radio') ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (isTextInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (target && typeof target.blur === 'function') {
          target.blur();
        }
        handleTogglePlayFull();
        return;
      }

      const keyUpper = e.key.toUpperCase();
      const padIdx = PAD_KEYS.indexOf(keyUpper);
      if (padIdx !== -1 && padIdx < slices.length) {
        e.preventDefault();
        handlePlaySlice(slices[padIdx]);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, slices, sample]);

  // Save Slices to Sample
  const handleSaveSlices = () => {
    onUpdateSampleSlices(sample.id, slices);
    onClose();
  };

  // 1-Click Extract Slices to New Library Samples
  const handleExtractToLibrary = () => {
    if (!sample.audioBuffer) return;
    const newItems: SampleItem[] = [];

    slices.forEach((slice, idx) => {
      const sliceDuration = slice.endSec - slice.startSec;
      const wavBlob = audioBufferToWavBlob(sample.audioBuffer!, {
        startSec: slice.startSec,
        endSec: slice.endSec,
        bitDepth: 24,
        normalize: true,
        targetPeakDb: -0.2,
      });

      const blobUrl = URL.createObjectURL(wavBlob);
      const padIdx = String(idx + 1).padStart(2, '0');
      const cleanName = `${sample.name}_Hit_${padIdx}`;

      const sliceType = slice.detectedType || (sample.type === 'multi-sound' ? 'percussion' : sample.type);
      newItems.push({
        id: `extracted-${sample.id}-${idx + 1}-${Date.now().toString(36)}`,
        name: cleanName,
        originalFileName: `${cleanName}.wav`,
        format: 'wav',
        size: wavBlob.size,
        duration: sliceDuration,
        sampleRate: sample.sampleRate,
        bitDepth: 24,
        channels: sample.channels,
        bpm: sample.bpm,
        key: sample.key,
        type: sliceType,
        category: 'one-shot',
        isLoop: false,
        genre: sample.genre || 'Universal / Multi-Genre',
        lufs: sample.lufs || -14.0,
        loudnessGainDb: sample.loudnessGainDb || 0,
        ep133Slot: Math.min(999, (sample.ep133Slot || 1) + idx),
        tags: [...sample.tags.filter((t) => t !== 'multi-sound'), 'sliced-one-shot'],
        folderId: sample.folderId,
        folderPath: sample.folderPath,
        favorite: false,
        rating: 4,
        spectralCentroid: sample.spectralCentroid,
        dynamicRangeDb: sample.dynamicRangeDb,
        peakDb: -0.2,
        rmsDb: sample.rmsDb,
        zeroCrossingRate: sample.zeroCrossingRate,
        slices: [{ id: 's1', index: 1, startSec: 0, endSec: sliceDuration, label: 'Hit', color: slice.color }],
        blobUrl,
        dateAdded: Date.now(),
      });
    });

    onExtractSlicesToLibrary(newItems);
    setExtractedSuccess(true);
    setTimeout(() => {
      setExtractedSuccess(false);
      onClose();
    }, 1200);
  };

  // 1-Click Export Slices to ZIP Archive
  const handleExportZip = async () => {
    if (!sample.audioBuffer) return;
    try {
      setIsExportingZip(true);
      const zipBlob = await exportSlicesZip(sample, slices);
      triggerFileDownload(zipBlob, `${sample.name}_Slices_Pack.zip`);
    } catch (err) {
      console.error('Error generating slices zip:', err);
    } finally {
      setIsExportingZip(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="auto-slicer-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#0D0D10] border border-[#26262B] rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#EDEDEE]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#222226] bg-[#141417]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/15 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF]">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#EDEDEE] flex items-center gap-2">
                <span>Découpe Automatique de Multi-Sons</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30">
                  {slices.length} Slices Détectées
                </span>
              </h2>
              <p className="text-xs text-[#8E8E93] font-mono mt-0.5">
                {sample.name} • {sample.duration.toFixed(2)}s • {sample.channels === 2 ? 'Stereo' : 'Mono'}
              </p>
            </div>
          </div>

          <button
            id="close-slicer-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E8E93] hover:text-[#EDEDEE] hover:bg-[#1E1E24] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Slicer Settings Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#111114] p-4 rounded-xl border border-[#222226]">
            {/* Sensitivity */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-[#EDEDEE] mb-1.5 font-mono">
                <span>Sensibilité d'Attaque (Transient)</span>
                <span className="text-[#00F0FF]">{(sensitivity * 100).toFixed(0)}%</span>
              </div>
              <input
                id="slicer-sensitivity-range"
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                onMouseUp={handleRecalculateSlices}
                className="w-full h-1 bg-[#1E1E24] rounded-lg cursor-pointer"
              />
            </div>

            {/* Min Duration */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-[#EDEDEE] mb-1.5 font-mono">
                <span>Durée Minimale par Son</span>
                <span className="text-[#00F0FF]">{minDurationMs} ms</span>
              </div>
              <input
                id="slicer-min-duration-range"
                type="range"
                min="30"
                max="500"
                step="10"
                value={minDurationMs}
                onChange={(e) => setMinDurationMs(parseInt(e.target.value))}
                onMouseUp={handleRecalculateSlices}
                className="w-full h-1 bg-[#1E1E24] rounded-lg cursor-pointer"
              />
            </div>

            {/* Silence Gate */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-[#EDEDEE] mb-1.5 font-mono">
                <span>Seuil de Silence (Gate)</span>
                <span className="text-[#00F0FF]">{silenceThresholdDb} dB</span>
              </div>
              <input
                id="slicer-silence-range"
                type="range"
                min="-60"
                max="-18"
                step="2"
                value={silenceThresholdDb}
                onChange={(e) => setSilenceThresholdDb(parseInt(e.target.value))}
                onMouseUp={handleRecalculateSlices}
                className="w-full h-1 bg-[#1E1E24] rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* 16-Pad MPC Drum Grid Visual Trigger */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8E8E93] font-mono flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>Pad Sampler / Clavier Virtuel (Touches 1-8 / Q-I)</span>
              </span>
              <span className="text-[11px] text-[#8E8E93] font-mono">
                Cliquez ou tapez au clavier pour jouer chaque son en direct
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
              {slices.slice(0, 16).map((slice, idx) => {
                const isPlaying = activePlayingSliceId === slice.id;
                const shortcut = PAD_KEYS[idx] || '';

                return (
                  <button
                    key={slice.id}
                    id={`mpc-pad-${slice.id}`}
                    onClick={() => handlePlaySlice(slice)}
                    className={`h-20 rounded-xl p-2.5 flex flex-col justify-between items-start border transition-all text-left relative overflow-hidden ${
                      isPlaying
                        ? 'bg-[#00F0FF] text-[#0A0A0B] border-[#00F0FF] font-bold shadow-md'
                        : 'bg-[#141418] hover:bg-[#1C1C22] text-[#EDEDEE] border-[#26262B]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#0A0A0B] text-[#8E8E93] border border-[#26262B]">
                        {shortcut}
                      </span>
                    </div>

                    <div className="w-full">
                      <div className="text-xs font-bold font-mono truncate">{slice.label}</div>
                      <div className="text-[10px] opacity-75 font-mono">
                        {((slice.endSec - slice.startSec) * 1000).toFixed(0)}ms
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slices List Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8E8E93] font-mono">
                Liste Détaillée des Morceaux Découpés
              </span>
              <button
                id="recalc-slices-btn"
                onClick={handleRecalculateSlices}
                className="flex items-center gap-1 text-xs text-[#00F0FF] hover:text-[#38BDF8] font-semibold transition font-mono"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Recalculer la Découpe</span>
              </button>
            </div>

            <div className="bg-[#111114] rounded-xl border border-[#222226] overflow-hidden divide-y divide-[#1A1A20] max-h-56 overflow-y-auto">
              {slices.map((slice) => (
                <div
                  key={slice.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-[#18181D] transition"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePlaySlice(slice)}
                      className="w-7 h-7 rounded-lg bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-[#00F0FF] border border-[#00F0FF]/30 flex items-center justify-center transition"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    <input
                      type="text"
                      value={slice.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSlices((prev) =>
                          prev.map((s) => (s.id === slice.id ? { ...s, label: val } : s))
                        );
                      }}
                      className="bg-[#18181D] text-xs font-bold text-[#EDEDEE] px-2 py-1 rounded border border-[#26262B] focus:outline-none focus:border-[#00F0FF] font-mono w-32"
                    />
                    <span className="text-xs font-mono text-[#8E8E93]">
                      {slice.startSec.toFixed(3)}s → {slice.endSec.toFixed(3)}s (
                      {((slice.endSec - slice.startSec) * 1000).toFixed(0)}ms)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={slice.detectedType || 'percussion'}
                      onChange={(e) => {
                        const t = e.target.value as SampleType;
                        setSlices((prev) =>
                          prev.map((s) => (s.id === slice.id ? { ...s, detectedType: t } : s))
                        );
                      }}
                      className="bg-[#18181D] text-[11px] text-[#EDEDEE] px-2 py-1 rounded border border-[#26262B] focus:outline-none font-mono"
                    >
                      <option value="kick">Kick</option>
                      <option value="snare">Snare</option>
                      <option value="hihat">HiHat</option>
                      <option value="clap">Clap</option>
                      <option value="percussion">Percussion</option>
                      <option value="808">808 / Sub</option>
                      <option value="vocal">Vocal</option>
                      <option value="fx">FX</option>
                    </select>

                    <button
                      onClick={() => {
                        setSlices((prev) => prev.filter((s) => s.id !== slice.id));
                      }}
                      className="p-1 rounded text-[#5A5A62] hover:text-[#EF4444] hover:bg-[#1E1E24] transition"
                      title="Supprimer cette découpe"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#222226] bg-[#141417]">
          <div className="flex items-center gap-2">
            <button
              id="export-zip-btn"
              onClick={handleExportZip}
              disabled={isExportingZip}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#18181D] hover:bg-[#222228] text-[#EDEDEE] border border-[#26262B] text-xs font-bold transition disabled:opacity-50 font-mono"
            >
              <Download className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span>{isExportingZip ? 'Génération ZIP...' : 'Télécharger ZIP (WAV)'}</span>
            </button>

            <button
              id="extract-library-btn"
              onClick={handleExtractToLibrary}
              disabled={extractedSuccess}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/30 text-xs font-bold transition font-mono"
            >
              {extractedSuccess ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <FolderPlus className="w-3.5 h-3.5 text-[#10B981]" />}
              <span>{extractedSuccess ? 'Échantillons Ajoutés !' : 'Extraire dans la Bibliothèque'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="cancel-slicer-btn"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#8E8E93] hover:text-[#EDEDEE] transition font-mono"
            >
              Annuler
            </button>
            <button
              id="apply-slices-btn"
              onClick={handleSaveSlices}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#38BDF8] text-[#0A0A0B] font-bold text-xs shadow-md transition font-mono"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Appliquer les Découpes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
