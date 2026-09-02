import React, { useState } from 'react';
import { FileCode2, CheckCircle2, RefreshCw, FolderArchive } from 'lucide-react';
import { SampleItem, BatchConvertSettings } from '../types/sample';
import { processBatchConvert, triggerFileDownload } from '../services/audioConverter';
import { Modal } from './Modal';

interface BatchConverterModalProps {
  samples: SampleItem[];
  isOpen: boolean;
  onClose: () => void;
}

export const BatchConverterModal: React.FC<BatchConverterModalProps> = ({
  samples,
  isOpen,
  onClose,
}) => {
  const [settings, setSettings] = useState<BatchConvertSettings>({
    targetFormat: 'wav',
    sampleRate: 44100,
    bitDepth: 24,
    channels: 'original',
    normalize: true,
    targetPeakDb: -0.2,
    removeDcOffset: true,
    trimSilence: true,
    silenceThresholdDb: -42,
    fileNamePattern: '{name}_{key}_{bpm}bpm',
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string }>({
    current: 0,
    total: samples.length,
    name: '',
  });
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const handleStartConversion = async () => {
    try {
      setIsProcessing(true);
      setIsCompleted(false);
      setProgress({ current: 0, total: samples.length, name: '' });

      const zipBlob = await processBatchConvert(
        samples,
        settings,
        (current, total, name) => {
          setProgress({ current, total, name });
        }
      );

      triggerFileDownload(zipBlob, `Resonance_Converted_Batch_${Date.now().toString(36)}.zip`);
      setIsCompleted(true);
    } catch (err) {
      console.error('Batch convert error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      icon={<FileCode2 className="h-5 w-5" />}
      title="Convertisseur & traitement audio par lot"
      subtitle="Conversion haute-fidélité, normalisation True Peak et export ZIP"
      headerRight={
        <span className="rounded border border-[#00F0FF]/30 bg-[#00F0FF]/15 px-2 py-0.5 font-mono text-[10px] text-[#00F0FF]">
          {samples.length} fichiers
        </span>
      }
    >
      {/* Form Body */}
      <div className="space-y-5">
          {/* Output Format & Bit Depth */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#EDEDEE] mb-1.5 font-mono">
                Format Cible
              </label>
              <select
                value={settings.targetFormat}
                onChange={(e) =>
                  setSettings({ ...settings, targetFormat: e.target.value as 'wav' | 'mp3' })
                }
                className="w-full bg-[#111114] border border-[#222226] rounded-lg px-3 py-2 text-xs font-mono text-[#EDEDEE] focus:outline-none focus:border-[#00F0FF]"
              >
                <option value="wav">WAV (Lossless PCM)</option>
                <option value="mp3">MP3 / WebM Audio</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#EDEDEE] mb-1.5 font-mono">
                Résolution (Bit Depth)
              </label>
              <select
                value={settings.bitDepth}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bitDepth: parseInt(e.target.value) as 16 | 24 | 32,
                  })
                }
                className="w-full bg-[#111114] border border-[#222226] rounded-lg px-3 py-2 text-xs font-mono text-[#EDEDEE] focus:outline-none focus:border-[#00F0FF]"
              >
                <option value="24">24-bit Studio PCM (Recommandé)</option>
                <option value="16">16-bit Standard CD Audio</option>
                <option value="32">32-bit Float High Headroom</option>
              </select>
            </div>
          </div>

          {/* Sample Rate & Channels */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#EDEDEE] mb-1.5 font-mono">
                Fréquence d'Échantillonnage
              </label>
              <select
                value={settings.sampleRate}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    sampleRate: parseInt(e.target.value) as 44100 | 48000 | 96000,
                  })
                }
                className="w-full bg-[#111114] border border-[#222226] rounded-lg px-3 py-2 text-xs font-mono text-[#EDEDEE] focus:outline-none focus:border-[#00F0FF]"
              >
                <option value="44100">44.1 kHz (Standard Musique)</option>
                <option value="48000">48.0 kHz (Vidéo & Broadcast)</option>
                <option value="96000">96.0 kHz (Audiophile / Sound Design)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#EDEDEE] mb-1.5 font-mono">
                Canaux Stéréo / Mono
              </label>
              <select
                value={settings.channels}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    channels: e.target.value as 'original' | 'stereo' | 'mono',
                  })
                }
                className="w-full bg-[#111114] border border-[#222226] rounded-lg px-3 py-2 text-xs font-mono text-[#EDEDEE] focus:outline-none focus:border-[#00F0FF]"
              >
                <option value="original">Conserver les canaux originaux</option>
                <option value="mono">Convertir en Mono (Somme L+R)</option>
                <option value="stereo">Stéréo</option>
              </select>
            </div>
          </div>

          {/* DSP Enhancement Toggles */}
          <div className="space-y-3 bg-[#111114] p-4 rounded-xl border border-[#222226]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8E8E93] font-mono block">
              Traitements DSP Automatiques
            </span>

            {/* Normalization */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.normalize}
                  onChange={(e) => setSettings({ ...settings, normalize: e.target.checked })}
                  className="rounded border-[#26262B] text-[#00F0FF] focus:ring-0 w-4 h-4 bg-[#0A0A0B] accent-[#00F0FF] cursor-pointer"
                />
                <span className="text-xs font-medium text-[#EDEDEE]">
                  Normalisation True Peak
                </span>
              </div>
              <span className="text-xs font-mono text-[#00F0FF] font-bold">
                {settings.targetPeakDb} dB
              </span>
            </label>

            {/* DC Offset */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeDcOffset}
                onChange={(e) => setSettings({ ...settings, removeDcOffset: e.target.checked })}
                className="rounded border-[#26262B] text-[#00F0FF] focus:ring-0 w-4 h-4 bg-[#0A0A0B] accent-[#00F0FF] cursor-pointer"
              />
              <span className="text-xs font-medium text-[#EDEDEE]">
                Suppression du DC Offset (Centrage du signal à 0)
              </span>
            </label>

            {/* Trim Silence */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.trimSilence}
                onChange={(e) => setSettings({ ...settings, trimSilence: e.target.checked })}
                className="rounded border-[#26262B] text-[#00F0FF] focus:ring-0 w-4 h-4 bg-[#0A0A0B] accent-[#00F0FF] cursor-pointer"
              />
              <span className="text-xs font-medium text-[#EDEDEE]">
                Nettoyage automatique du silence au début et à la fin
              </span>
            </label>
          </div>

          {/* Smart File Naming Pattern */}
          <div>
            <label className="block text-xs font-semibold text-[#EDEDEE] mb-1.5 font-mono">
              Modèle de Nommage Intelligent
            </label>
            <input
              type="text"
              value={settings.fileNamePattern}
              onChange={(e) => setSettings({ ...settings, fileNamePattern: e.target.value })}
              placeholder="{name}_{key}_{bpm}bpm_{type}"
              className="w-full bg-[#111114] border border-[#222226] rounded-lg px-3 py-2 text-xs font-mono text-[#00F0FF] focus:outline-none focus:border-[#00F0FF]"
            />
            <p className="text-[11px] text-[#8E8E93] font-mono mt-1">
              Variables disponibles : <span className="text-[#00F0FF]">{'{name}'}</span>,{' '}
              <span className="text-[#00F0FF]">{'{key}'}</span>,{' '}
              <span className="text-[#00F0FF]">{'{bpm}'}</span>,{' '}
              <span className="text-[#00F0FF]">{'{type}'}</span>
            </p>
          </div>

          {/* Progress Bar (when running) */}
          {isProcessing && (
            <div className="bg-[#111114] p-4 rounded-xl border border-[#00F0FF]/40 space-y-2 animate-in fade-in">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#00F0FF] flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Conversion : {progress.name}
                </span>
                <span className="text-[#8E8E93]">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-[#1A1A20] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#00F0FF] h-full transition-all duration-150"
                  style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="bg-[#10B981]/15 border border-[#10B981]/30 p-3 rounded-lg flex items-center gap-3 text-xs font-mono text-[#10B981] animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
              <span>Conversion terminée avec succès ! Le fichier ZIP a été téléchargé.</span>
            </div>
          )}
        </div>

        {/* Footer action */}
        <div className="mt-6 flex items-center justify-end border-t border-[#222226] pt-4">
          <button
            id="start-batch-convert-btn"
            onClick={handleStartConversion}
            disabled={isProcessing || samples.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#38BDF8] text-[#0A0A0B] font-bold text-xs shadow-md transition disabled:opacity-50 font-mono"
          >
            <FolderArchive className="w-4 h-4" />
            <span>{isProcessing ? 'Traitement en cours...' : 'Lancer la Conversion & Exporter ZIP'}</span>
          </button>
        </div>
    </Modal>
  );
};
