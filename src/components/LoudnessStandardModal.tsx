import React, { useState, useEffect } from 'react';
import { Volume2, CheckCircle2, AlertTriangle, Zap, Sliders, ShieldCheck, Layers, FileCheck } from 'lucide-react';
import { Modal } from './Modal';
import { SampleItem, NewSample } from '../types/sample';
import { peekSampleAudio } from '../services/sampleAudio';
import {
  LoudnessStandardKey,
  LOUDNESS_STANDARDS,
  auditLoudness,
  normalizeAudioBufferToStandard,
  LoudnessAuditReport,
} from '../services/audioLoudnessStandard';

interface LoudnessStandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  sample: SampleItem | null;
  allSelectedSamples?: SampleItem[];
  onApplyNormalization: (updatedSample: NewSample, auditReport: LoudnessAuditReport) => void;
  onBatchApplyNormalization?: (updatedSamples: NewSample[], standardKey: LoudnessStandardKey) => void;
}

export const LoudnessStandardModal: React.FC<LoudnessStandardModalProps> = ({
  isOpen,
  onClose,
  sample,
  allSelectedSamples = [],
  onApplyNormalization,
  onBatchApplyNormalization,
}) => {
  const audioBuffer = peekSampleAudio(sample);
  const [selectedStandard, setSelectedStandard] = useState<LoudnessStandardKey>('streaming');
  const [auditReport, setAuditReport] = useState<LoudnessAuditReport | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);

  // Auditer le sample sélectionné
  useEffect(() => {
    if (isOpen && audioBuffer) {
      try {
        const report = auditLoudness(audioBuffer, selectedStandard);
        setAuditReport(report);
      } catch (err) {
        console.error('Erreur audit loudness:', err);
      }
    }
  }, [isOpen, sample, selectedStandard]);

  const currentStandard = LOUDNESS_STANDARDS[selectedStandard];

  const handleNormalizeSingle = () => {
    if (!audioBuffer) return;
    setIsProcessing(true);
    try {
      const { audioBuffer: normalizedBuffer, report } = normalizeAudioBufferToStandard(
        audioBuffer,
        selectedStandard
      );

      const updatedSample: NewSample = {
        ...sample,
        audioBuffer: normalizedBuffer,
        lufs: report.integratedLufs,
        peakDb: report.peakDbFS,
        rmsDb: report.rmsDb,
        loudnessGainDb: report.standardMatch.gainAdjustmentDb,
      };

      onApplyNormalization(updatedSample, report);
      setAuditReport(report);
    } catch (e) {
      console.error('Erreur normalisation:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNormalizeBatch = () => {
    if (!allSelectedSamples.length || !onBatchApplyNormalization) return;
    setIsProcessing(true);
    try {
      const updatedList: NewSample[] = allSelectedSamples.map((s) => {
        // Only what is already decoded: levelling a whole selection must not
        // turn into hundreds of file reads on a button press.
        const source = peekSampleAudio(s);
        if (!source) return s;
        const { audioBuffer: normBuf, report } = normalizeAudioBufferToStandard(source, selectedStandard);
        return {
          ...s,
          audioBuffer: normBuf,
          lufs: report.integratedLufs,
          peakDb: report.peakDbFS,
          rmsDb: report.rmsDb,
          loudnessGainDb: report.standardMatch.gainAdjustmentDb,
        };
      });
      onBatchApplyNormalization(updatedList, selectedStandard);
      onClose();
    } catch (e) {
      console.error('Erreur batch normalisation:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      accent="#00F0FF"
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Étalon international de normalisation du son"
      subtitle="Calibrage certifié K-Weighting & True-Peak 4x — ITU-R BS.1770-4 / EBU R128"
      bodyClassName="flex flex-col overflow-hidden"
    >
        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          {/* Explication Scientifique de l'Étalon */}
          <div className="p-3.5 bg-[#121226] border border-[#00F0FF]/20 rounded-md flex items-start gap-3 text-xs font-mono">
            <div className="text-xl">📏</div>
            <div className="space-y-1">
              <strong className="text-[#00F0FF] block">
                Existe-t-il un étalon universel comme le mètre pour le son ?
              </strong>
              <p className="text-[#C0C0D0] leading-relaxed">
                <strong>OUI.</strong> L&apos;étalon scientifique officiel pour le son est la norme{' '}
                <strong className="text-white">ITU-R BS.1770-4</strong> et les recommandations{' '}
                <strong className="text-white">EBU R128 / AES TD1004</strong>. L&apos;unité légale de mesure est le{' '}
                <strong className="text-[#FFE600]">LUFS</strong> (<em>Loudness Units Full Scale</em>). Elle applique une
                courbe de pondération <strong>K-Weighting</strong> reproduisant fidèlement la sensibilité de l&apos;oreille
                humaine.
              </p>
            </div>
          </div>

          {/* Sélecteur des 5 Étalons Internationaux */}
          <div className="space-y-2">
            <label className="text-xs font-pixel font-bold text-[#A5B4FC] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#00F0FF]" />
              SÉLECTIONNEZ L&apos;ÉTALON DE RÉFÉRENCE :
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {Object.values(LOUDNESS_STANDARDS).map((std) => {
                const isSelected = selectedStandard === std.key;
                return (
                  <button
                    key={std.key}
                    type="button"
                    onClick={() => setSelectedStandard(std.key)}
                    className={`p-3 text-left rounded border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#00F0FF]/15 border-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                        : 'bg-[#141428] border-[#22223C] hover:border-[#38BDF8]/40 hover:bg-[#181832]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold font-mono ${isSelected ? 'text-[#00F0FF]' : 'text-white'}`}>
                          {std.shortLabel}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 text-[#8E8E98] border border-white/10">
                          {std.targetTruePeakDb} dBTP
                        </span>
                      </div>
                      <h4 className="text-[11px] font-semibold text-white/90 line-clamp-1">{std.name}</h4>
                      <p className="text-[10px] font-mono text-[#8E8E98] mt-1 line-clamp-2">{std.description}</p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-[#A5B4FC]">
                      <span>{std.organization}</span>
                      {isSelected && <span className="text-[#00F0FF] font-bold">● ACTIF</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audit du Sample Courant vs Étalon */}
          {auditReport && sample && (
            <div className="p-4 bg-[#101022] border border-[#303050] rounded-md space-y-3">
              <div className="flex items-center justify-between border-b border-[#202040] pb-2">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#FFE600]" />
                  <span className="text-xs font-pixel font-bold text-white">
                    AUDIT ACOUSTIQUE DU SAMPLE : <span className="text-[#00F0FF]">{sample.name}</span>
                  </span>
                </div>
                {auditReport.standardMatch.isCompliant ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded border border-[#10B981]/30">
                    <CheckCircle2 className="w-3.5 h-3.5" /> ÉTALON CONFORME
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-[#F59E0B] bg-[#F59E0B]/15 px-2 py-0.5 rounded border border-[#F59E0B]/30">
                    <AlertTriangle className="w-3.5 h-3.5" /> CALIBRAGE REQUIS (
                    {auditReport.standardMatch.gainAdjustmentDb > 0
                      ? `+${auditReport.standardMatch.gainAdjustmentDb}`
                      : auditReport.standardMatch.gainAdjustmentDb}{' '}
                    dB)
                  </span>
                )}
              </div>

              {/* Métriques comparatives */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2.5 bg-[#16162E] rounded border border-[#242444]">
                  <span className="text-[10px] text-[#8E8E98] block">Loudness Actuelle (LUFS)</span>
                  <span className="text-sm font-bold text-[#FFE600]">{auditReport.integratedLufs} LUFS</span>
                  <span className="text-[10px] text-[#8E8E98] block mt-0.5">Cible: {currentStandard.targetLufs} LUFS</span>
                </div>

                <div className="p-2.5 bg-[#16162E] rounded border border-[#242444]">
                  <span className="text-[10px] text-[#8E8E98] block">True-Peak 4x (dBTP)</span>
                  <span
                    className={`text-sm font-bold ${
                      auditReport.truePeakDb > currentStandard.targetTruePeakDb ? 'text-[#EF4444]' : 'text-[#00F0FF]'
                    }`}
                  >
                    {auditReport.truePeakDb} dBTP
                  </span>
                  <span className="text-[10px] text-[#8E8E98] block mt-0.5">
                    Plafond: {currentStandard.targetTruePeakDb} dBTP
                  </span>
                </div>

                <div className="p-2.5 bg-[#16162E] rounded border border-[#242444]">
                  <span className="text-[10px] text-[#8E8E98] block">Dynamic Range (LRA)</span>
                  <span className="text-sm font-bold text-[#A855F7]">{auditReport.loudnessRangeLu} LU</span>
                  <span className="text-[10px] text-[#8E8E98] block mt-0.5">
                    Crête / RMS: {auditReport.peakDbFS} / {auditReport.rmsDb} dB
                  </span>
                </div>

                <div className="p-2.5 bg-[#16162E] rounded border border-[#242444]">
                  <span className="text-[10px] text-[#8E8E98] block">Ajustement Recommandé</span>
                  <span
                    className={`text-sm font-bold ${
                      auditReport.standardMatch.gainAdjustmentDb > 0
                        ? 'text-[#10B981]'
                        : auditReport.standardMatch.gainAdjustmentDb < 0
                        ? 'text-[#EF4444]'
                        : 'text-white'
                    }`}
                  >
                    {auditReport.standardMatch.gainAdjustmentDb > 0
                      ? `+${auditReport.standardMatch.gainAdjustmentDb}`
                      : auditReport.standardMatch.gainAdjustmentDb}{' '}
                    dB
                  </span>
                  <span className="text-[10px] text-[#8E8E98] block mt-0.5">
                    {auditReport.standardMatch.requiresLimiter ? '🛡️ Limiter anti-clip actif' : 'Gain linéaire pur'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Mode Batch (si plusieurs samples sélectionnés) */}
          {allSelectedSamples.length > 1 && (
            <div className="p-3 bg-[#181830] border border-[#818CF8]/30 rounded-md flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#818CF8]" />
                <span className="text-white">
                  <strong>{allSelectedSamples.length} samples sélectionnés</strong> dans votre session.
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-[#A5B4FC]">
                <input
                  type="checkbox"
                  checked={isBatchMode}
                  onChange={(e) => setIsBatchMode(e.target.checked)}
                  className="accent-[#00F0FF]"
                />
                Normaliser tous les {allSelectedSamples.length} samples au même étalon
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#121224] border-t border-[#00F0FF]/30">
          <div className="text-[11px] font-mono text-[#8E8E98] flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#00F0FF]" />
            <span>Étalon sélectionné : <strong className="text-white">{currentStandard.name}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-mono text-[#8E8E98] hover:text-white bg-[#1A1A2E] hover:bg-[#252540] rounded border border-[#303050] transition-colors"
            >
              Fermer
            </button>

            {isBatchMode && allSelectedSamples.length > 1 ? (
              <button
                onClick={handleNormalizeBatch}
                disabled={isProcessing}
                className="px-4 py-1.5 text-xs font-pixel font-bold bg-[#818CF8] hover:bg-[#6366F1] text-black rounded shadow-[0_0_15px_rgba(129,140,248,0.4)] transition-all flex items-center gap-2"
              >
                <Layers className="w-4 h-4" />
                {isProcessing ? 'NORMALISATION BATCH...' : `CALIBRER LES ${allSelectedSamples.length} SAMPLES`}
              </button>
            ) : (
              <button
                onClick={handleNormalizeSingle}
                disabled={isProcessing || !sample}
                className="px-4 py-1.5 text-xs font-pixel font-bold bg-[#00F0FF] hover:bg-[#38BDF8] text-black rounded shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                {isProcessing ? 'CALIBRAGE EN COURS...' : `CALIBRER SELON L'ÉTALON (${currentStandard.shortLabel})`}
              </button>
            )}
          </div>
        </div>
    </Modal>
  );
};
