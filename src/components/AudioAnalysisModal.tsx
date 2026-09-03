import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play,
  Pause,
  Activity,
  Zap,
  Sliders,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  Download,
  Sparkles,
  Scissors,
  Layers,
  Wand2,
  RefreshCw,
} from 'lucide-react';
import { Modal } from './Modal';
import { SampleItem } from '../types/sample';
import { audioEngine } from '../services/audioEngine';
import { useAudition } from '../stores/transportStore';
import {
  analyzeFullDspReport,
  DetailedDspReport,
  removeDcOffsetFromBuffer,
  normalizeBufferToLufs,
} from '../services/dspInspector';
import { triggerFileDownload } from '../services/audioConverter';

interface AudioAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  sample: SampleItem | null;
  onUpdateSample?: (updatedSample: SampleItem) => void;
}

export const AudioAnalysisModal: React.FC<AudioAnalysisModalProps> = ({
  isOpen,
  onClose,
  sample,
  onUpdateSample,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [report, setReport] = useState<DetailedDspReport | null>(null);
  const [activeTab, setActiveTab] = useState<'spectrum' | 'loudness' | 'harmonics' | 'phase'>('spectrum');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Subscribe to audio engine for play state
  useEffect(() => {
    const unsub = audioEngine.subscribe((st) => {
      setIsPlaying(st.isPlaying && st.sampleId === sample?.id);
    });
    return () => unsub();
  }, [sample]);

  // Compute full DSP report when sample changes
  useEffect(() => {
    if (isOpen && sample && sample.audioBuffer) {
      const fullReport = analyzeFullDspReport(sample.audioBuffer, sample);
      setReport(fullReport);
    }
  }, [isOpen, sample]);

  // Draw real-time spectrum or frequency curve on canvas
  useEffect(() => {
    if (!canvasRef.current || !report) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#08090E';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Lines (dB markers)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let db = 0; db >= -60; db -= 12) {
      const y = ((0 - db) / 60) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      ctx.fillStyle = '#5A5F72';
      ctx.font = '8px monospace';
      ctx.fillText(`${db}dB`, 4, y - 2);
    }

    // Frequency markers (100Hz, 1kHz, 10kHz)
    const freqMarkers = [60, 250, 1000, 4000, 12000];
    freqMarkers.forEach((f) => {
      // Logarithmic X coordinate
      const logMin = Math.log10(20);
      const logMax = Math.log10(20000);
      const logF = Math.log10(f);
      const x = ((logF - logMin) / (logMax - logMin)) * width;

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      ctx.fillStyle = '#7A7F92';
      ctx.font = '8px monospace';
      ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}Hz`, x + 2, height - 4);
    });

    // Draw Multi-band EQ Curve
    const bands = [
      { name: 'Sub', db: report.energyBands.subBassDb, f1: 20, f2: 60, col: '#8B5CF6' },
      { name: 'Bass', db: report.energyBands.bassDb, f1: 60, f2: 250, col: '#00F0FF' },
      { name: 'Low-Mid', db: report.energyBands.lowMidDb, f1: 250, f2: 500, col: '#10B981' },
      { name: 'Mid', db: report.energyBands.midDb, f1: 500, f2: 2000, col: '#F59E0B' },
      { name: 'Hi-Mid', db: report.energyBands.highMidDb, f1: 2000, f2: 6000, col: '#F97316' },
      { name: 'Air', db: report.energyBands.airDb, f1: 6000, f2: 20000, col: '#EC4899' },
    ];

    const logMin = Math.log10(20);
    const logMax = Math.log10(20000);

    // Fill Spectrum Area
    ctx.beginPath();
    ctx.moveTo(0, height);

    bands.forEach((b, i) => {
      const logF = Math.log10(Math.sqrt(b.f1 * b.f2));
      const x = ((logF - logMin) / (logMax - logMin)) * width;
      const normalizedDb = Math.max(-60, Math.min(0, b.db));
      const y = ((0 - normalizedDb) / 60) * height * 0.85 + height * 0.05;

      if (i === 0) ctx.lineTo(0, y);
      ctx.lineTo(x, y);
    });

    ctx.lineTo(width, height);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
    grad.addColorStop(0.3, 'rgba(0, 240, 255, 0.5)');
    grad.addColorStop(0.7, 'rgba(245, 158, 11, 0.5)');
    grad.addColorStop(1, 'rgba(236, 72, 153, 0.4)');

    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke top contour line
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    bands.forEach((b, i) => {
      const logF = Math.log10(Math.sqrt(b.f1 * b.f2));
      const x = ((logF - logMin) / (logMax - logMin)) * width;
      const normalizedDb = Math.max(-60, Math.min(0, b.db));
      const y = ((0 - normalizedDb) / 60) * height * 0.85 + height * 0.05;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Harmonic Peaks indicators
    if (report.harmonicPeaks && report.harmonicPeaks.length > 0) {
      report.harmonicPeaks.forEach((p, idx) => {
        const logF = Math.log10(Math.max(20, p.freqHz));
        const x = ((logF - logMin) / (logMax - logMin)) * width;
        const normalizedDb = Math.max(-60, Math.min(0, p.magDb));
        const y = ((0 - normalizedDb) / 60) * height * 0.85 + height * 0.05;

        // Peak circle
        ctx.fillStyle = idx === 0 ? '#00F0FF' : '#F59E0B';
        ctx.beginPath();
        ctx.arc(x, y, idx === 0 ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(p.note || `${p.freqHz}Hz`, x - 8, y - 7);
      });
    }
  }, [report]);

  // Space auditions the analysed sample while this window is open. Declared
  // before the early return so the hook order stays stable.
  const playToggle = () => {
    if (!sample?.audioBuffer) return;
    if (isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play(sample.audioBuffer, sample.id);
    }
  };
  useAudition('DSP Lab', playToggle, isOpen && !!sample);

  if (!isOpen || !sample) return null;

  const handlePlayToggle = playToggle;

  // DSP Fix: Remove DC Offset
  const handleFixDcOffset = () => {
    if (!sample.audioBuffer) return;
    const fixedBuffer = removeDcOffsetFromBuffer(sample.audioBuffer);
    const newReport = analyzeFullDspReport(fixedBuffer, { ...sample, audioBuffer: fixedBuffer });
    setReport(newReport);

    if (onUpdateSample) {
      onUpdateSample({
        ...sample,
        audioBuffer: fixedBuffer,
      });
    }
    setActionSuccessMessage('Offset DC éliminé avec succès (0.00%) !');
    setTimeout(() => setActionSuccessMessage(null), 3000);
  };

  // DSP Fix: EBU R128 Normalize
  const handleFixNormalizeLufs = (target = -14.0) => {
    if (!sample.audioBuffer) return;
    const normalizedBuffer = normalizeBufferToLufs(sample.audioBuffer, target);
    const newReport = analyzeFullDspReport(normalizedBuffer, { ...sample, audioBuffer: normalizedBuffer, lufs: target });
    setReport(newReport);

    if (onUpdateSample) {
      onUpdateSample({
        ...sample,
        audioBuffer: normalizedBuffer,
        lufs: target,
      });
    }
    setActionSuccessMessage(`Normalisation EBU R128 (${target} LUFS) appliquée !`);
    setTimeout(() => setActionSuccessMessage(null), 3000);
  };

  // Export full DSP Report as JSON
  const handleExportJsonReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    triggerFileDownload(blob, `${sample.name}_DSP_Report.json`);
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="xl"
      accent="#00F0FF"
      icon={<Activity className="h-5 w-5" />}
      title="Laboratoire d'analyse acoustique & DSP"
      subtitle={`Spectre multi-bande, phase stéréo, harmoniques et dynamique — ${sample.name}`}
      bodyClassName="flex flex-col overflow-hidden"
      headerRight={
        <>
          <button
            onClick={handlePlayToggle}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow ${
              isPlaying ? 'bg-[#EF4444] text-white' : 'bg-[#00F0FF] text-black hover:bg-[#00D8E6]'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            {isPlaying ? 'Arrêter' : 'Écouter'}
          </button>

          <button
            onClick={handleExportJsonReport}
            className="px-3 py-1.5 rounded-lg bg-[#181B28] hover:bg-[#222638] border border-[#272A38] text-xs font-mono text-white flex items-center gap-1.5 transition-all"
            title="Exporter le rapport complet en JSON"
          >
            <Download className="w-3.5 h-3.5 text-[#00F0FF]" />
            Rapport JSON
          </button>
        </>
      }
    >
        {/* Action success alert */}
        {actionSuccessMessage && (
          <div className="bg-[#10B981]/15 border-b border-[#10B981]/30 px-5 py-1.5 text-xs font-mono text-[#10B981] flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {actionSuccessMessage}
          </div>
        )}

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Top Primary Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {/* Integrated LUFS */}
            <div className="bg-[#0C0E15] p-3 rounded-xl border border-[#222533] space-y-1">
              <span className="text-[10px] font-mono text-[#7A7F92] uppercase block">Integrated LUFS</span>
              <div className="text-base font-bold font-mono text-[#00F0FF]">
                {report?.integratedLufs !== undefined ? `${report.integratedLufs.toFixed(1)}` : '—'}
                <span className="text-[10px] font-normal text-[#8A8F9E] ml-1">LUFS</span>
              </div>
              <span className="text-[9px] text-[#5A5F72] block">EBU R128 Standard</span>
            </div>

            {/* True Peak dBFS */}
            <div className="bg-[#0C0E15] p-3 rounded-xl border border-[#222533] space-y-1">
              <span className="text-[10px] font-mono text-[#7A7F92] uppercase block">True Peak</span>
              <div
                className={`text-base font-bold font-mono ${
                  report && report.truePeakDbfs > -0.1 ? 'text-[#EF4444]' : 'text-white'
                }`}
              >
                {report?.truePeakDbfs !== undefined ? `${report.truePeakDbfs.toFixed(1)}` : '—'}
                <span className="text-[10px] font-normal text-[#8A8F9E] ml-1">dBFS</span>
              </div>
              <span className="text-[9px] text-[#5A5F72] block">
                {report && report.truePeakDbfs > -0.2 ? 'Risque de saturation' : 'Headroom OK'}
              </span>
            </div>

            {/* Fundamental Pitch / Key */}
            <div className="bg-[#0C0E15] p-3 rounded-xl border border-[#222533] space-y-1">
              <span className="text-[10px] font-mono text-[#7A7F92] uppercase block">Tonalité & Note</span>
              <div className="text-base font-bold font-mono text-[#8B5CF6]">
                {report?.detectedKey || sample.key || '—'}
              </div>
              <span className="text-[9px] text-[#5A5F72] block">
                {report?.pitchHz ? `${report.pitchHz} Hz` : 'Non harmonique'}
              </span>
            </div>

            {/* Dynamic Range / Crest Factor */}
            <div className="bg-[#0C0E15] p-3 rounded-xl border border-[#222533] space-y-1">
              <span className="text-[10px] font-mono text-[#7A7F92] uppercase block">Facteur de Crête</span>
              <div className="text-base font-bold font-mono text-[#F59E0B]">
                {report?.crestFactorDb !== undefined ? `${report.crestFactorDb.toFixed(1)}` : '—'}
                <span className="text-[10px] font-normal text-[#8A8F9E] ml-1">dB</span>
              </div>
              <span className="text-[9px] text-[#5A5F72] block">Peak - RMS</span>
            </div>

            {/* Spectral Centroid */}
            <div className="bg-[#0C0E15] p-3 rounded-xl border border-[#222533] space-y-1">
              <span className="text-[10px] font-mono text-[#7A7F92] uppercase block">Centroïde Spectral</span>
              <div className="text-base font-bold font-mono text-[#10B981]">
                {report?.spectralCentroidHz || 0}
                <span className="text-[10px] font-normal text-[#8A8F9E] ml-1">Hz</span>
              </div>
              <span className="text-[9px] text-[#5A5F72] block">
                {(report?.spectralCentroidHz || 0) > 3000
                  ? 'Aigu / Brillant'
                  : (report?.spectralCentroidHz || 0) < 500
                  ? 'Sub / Basse'
                  : 'Médium / Corps'}
              </span>
            </div>

            {/* Stereo Phase Correlation */}
            <div className="bg-[#0C0E15] p-3 rounded-xl border border-[#222533] space-y-1">
              <span className="text-[10px] font-mono text-[#7A7F92] uppercase block">Phase Stéréo</span>
              <div
                className={`text-base font-bold font-mono ${
                  report?.isMonoCompatible ? 'text-[#10B981]' : 'text-[#EF4444]'
                }`}
              >
                {report?.stereoPhaseCorrelation !== undefined ? `${report.stereoPhaseCorrelation.toFixed(2)}` : '1.00'}
              </div>
              <span className="text-[9px] text-[#5A5F72] block">
                {report?.isMonoCompatible ? 'Compatible Mono' : 'Attention Déphasage'}
              </span>
            </div>
          </div>

          {/* Center Visualizer: FFT Spectrum & Multi-band Distribution */}
          <div className="bg-[#08090E] p-4 rounded-xl border border-[#222533] space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white font-medium flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#00F0FF]" />
                Spectre Fréquentiel Multi-Bande & Énergie Harmonique (20 Hz - 20 kHz)
              </span>
              <div className="flex items-center gap-2 text-[11px] text-[#8A8F9E]">
                <span>Rolloff: <b className="text-white">{report?.spectralRolloffHz || 0} Hz</b></span>
                <span>•</span>
                <span>Flatness (Wiener): <b className="text-[#F59E0B]">{report?.spectralFlatness || 0}</b></span>
              </div>
            </div>

            {/* Canvas Spectrum Display */}
            <div className="rounded-lg overflow-hidden border border-[#222533] bg-[#08090E]">
              <canvas ref={canvasRef} width={900} height={120} className="w-full h-32 block" />
            </div>

            {/* Multi-Band Energy Bars */}
            {report && (
              <div className="grid grid-cols-6 gap-2 pt-1">
                {[
                  { name: 'Sub-Bass (20-60Hz)', db: report.energyBands.subBassDb, color: '#8B5CF6' },
                  { name: 'Bass (60-250Hz)', db: report.energyBands.bassDb, color: '#00F0FF' },
                  { name: 'Low-Mid (250-500Hz)', db: report.energyBands.lowMidDb, color: '#10B981' },
                  { name: 'Mid (500-2kHz)', db: report.energyBands.midDb, color: '#F59E0B' },
                  { name: 'Hi-Mid (2k-6kHz)', db: report.energyBands.highMidDb, color: '#F97316' },
                  { name: 'Air (6k-20kHz)', db: report.energyBands.airDb, color: '#EC4899' },
                ].map((band) => {
                  const pct = Math.max(0, Math.min(100, ((band.db + 60) / 60) * 100));
                  return (
                    <div key={band.name} className="bg-[#12141F] p-2 rounded-lg border border-[#222533] space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-[#8A8F9E] truncate">{band.name.split(' ')[0]}</span>
                        <span className="text-white font-bold">{band.db} dB</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1C1F2E] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: band.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lower Grid: Harmonics Table + Time Domain + Actionable Fixes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Harmonic Peak Series */}
            <div className="bg-[#0C0E15] p-3.5 rounded-xl border border-[#222533] flex flex-col space-y-2.5">
              <h3 className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
                Pics Harmoniques Détectés
              </h3>
              <div className="flex-1 overflow-y-auto space-y-1.5">
                {report?.harmonicPeaks && report.harmonicPeaks.length > 0 ? (
                  report.harmonicPeaks.map((peak, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-[#141724] border border-[#222533] flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            idx === 0 ? 'bg-[#00F0FF] text-black' : 'bg-[#222533] text-[#8A8F9E]'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-white font-semibold">{peak.note || 'Harmonique'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[#8A8F9E] text-[11px]">
                        <span>{peak.freqHz} Hz</span>
                        <span className="text-[#00F0FF] font-bold">{peak.magDb} dB</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs font-mono text-[#5A5F72]">
                    Aucune fondamentale tonale pure (sample de bruit percussif).
                  </div>
                )}
              </div>
            </div>

            {/* 2. Time-Domain & Transients */}
            <div className="bg-[#0C0E15] p-3.5 rounded-xl border border-[#222533] space-y-2.5">
              <h3 className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#00F0FF]" />
                Dynamique & Domaine Temporel
              </h3>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between p-2 rounded bg-[#141724] border border-[#222533]">
                  <span className="text-[#8A8F9E]">Temps d'Attaque (Transient) :</span>
                  <span className="text-white font-bold">{report?.attackTimeMs || 0} ms</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-[#141724] border border-[#222533]">
                  <span className="text-[#8A8F9E]">Temps de Décroissance (Decay) :</span>
                  <span className="text-white font-bold">{report?.decayTimeMs || 0} ms</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-[#141724] border border-[#222533]">
                  <span className="text-[#8A8F9E]">Taux Zéro-Crossing (ZCR) :</span>
                  <span className="text-white font-bold">{report?.zeroCrossingRate || 0}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-[#141724] border border-[#222533]">
                  <span className="text-[#8A8F9E]">Dérive DC Offset :</span>
                  <span
                    className={`font-bold ${
                      report?.hasDcOffsetWarning ? 'text-[#EF4444]' : 'text-[#10B981]'
                    }`}
                  >
                    {report?.dcOffsetPercent || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Actionable Studio DSP Quick Fixes */}
            <div className="bg-[#0C0E15] p-3.5 rounded-xl border border-[#222533] space-y-2.5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Corrections DSP Immédiates
                </h3>
                <p className="text-[10px] font-mono text-[#7A7F92] mt-1">
                  Appliquez les traitements acoustiques recommandés directement sur le buffer audio.
                </p>
              </div>

              <div className="space-y-1.5 pt-2">
                <button
                  onClick={handleFixDcOffset}
                  className="w-full py-2 px-3 rounded-lg bg-[#181B28] hover:bg-[#222638] border border-[#272A38] text-xs font-mono text-white flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-[#00F0FF]" />
                    Éliminer l'Offset DC
                  </span>
                  <span className="text-[10px] text-[#10B981] font-bold">0.00%</span>
                </button>

                <button
                  onClick={() => handleFixNormalizeLufs(-14.0)}
                  className="w-full py-2 px-3 rounded-lg bg-[#181B28] hover:bg-[#222638] border border-[#272A38] text-xs font-mono text-white flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Normaliser EBU R128
                  </span>
                  <span className="text-[10px] text-[#F59E0B] font-bold">-14.0 LUFS</span>
                </button>

                <button
                  onClick={() => handleFixNormalizeLufs(-1.0)}
                  className="w-full py-2 px-3 rounded-lg bg-[#181B28] hover:bg-[#222638] border border-[#272A38] text-xs font-mono text-white flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-[#EC4899]" />
                    Peak Max One-Shot
                  </span>
                  <span className="text-[10px] text-[#EC4899] font-bold">-0.3 dBFS</span>
                </button>
              </div>
            </div>
          </div>
        </div>
    </Modal>
  );
};
