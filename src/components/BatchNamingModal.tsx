import React, { useState, useMemo } from 'react';
import { toast } from '../stores/toastStore';
import {
  X,
  Sparkles,
  Sliders,
  FolderTree,
  CheckCircle2,
  FileCode2,
  Download,
  Github,
  ArrowRight,
  RefreshCw,
  Layers,
  HelpCircle,
  FolderOpen,
} from 'lucide-react';
import { SampleItem } from '../types/sample';
import {
  NamingConventionConfig,
  NamingConventionPreset,
  DEFAULT_NAMING_CONFIG,
  batchRenameSamples,
  generateStandardSampleName,
  getStandardFolderPath,
} from '../services/sampleNamingConvention';
import { exportMultipleWavsAsZip, triggerFileDownload } from '../services/audioConverter';

interface BatchNamingModalProps {
  isOpen: boolean;
  onClose: () => void;
  samples: SampleItem[];
  selectedSampleIds?: string[];
  onApplyRename: (updatedSamples: SampleItem[]) => void;
  onOpenGitHubSync?: () => void;
}

export const BatchNamingModal: React.FC<BatchNamingModalProps> = ({
  isOpen,
  onClose,
  samples,
  selectedSampleIds,
  onApplyRename,
  onOpenGitHubSync,
}) => {
  const [config, setConfig] = useState<NamingConventionConfig>({
    ...DEFAULT_NAMING_CONFIG,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);

  // Initialize all selected by default
  React.useEffect(() => {
    if (isOpen) {
      setSelectedIds(samples.map((s) => s.id));
    }
  }, [isOpen, samples]);

  // Compute live diff list
  const { updatedSamples, diffList } = useMemo(() => {
    return batchRenameSamples(samples, config);
  }, [samples, config]);

  const changedCount = diffList.filter((d) => d.changed).length;

  if (!isOpen) return null;

  const handleApplyChanges = () => {
    onApplyRename(updatedSamples);
    setStatusMessage(`${samples.length} samples renommés et réorganisés selon la convention !`);
    setTimeout(() => {
      setStatusMessage(null);
      onClose();
    }, 1500);
  };

  const handleExportZip = async () => {
    setIsExportingZip(true);
    setStatusMessage('Génération du pack ZIP structuré et renommé...');
    try {
      const itemsToExport = updatedSamples.map((s) => ({
        sample: s,
        destinationPath: s.path || `${s.folderId || 'samples'}/${s.name}`,
      }));

      const zipBlob = await exportMultipleWavsAsZip(itemsToExport, {
        onProgress: (current, total) => {
          setStatusMessage(`Export ZIP en cours (${current}/${total})...`);
        },
      });

      triggerFileDownload(zipBlob, `Resonance_Studio_Pack_${new Date().toISOString().slice(0, 10)}.zip`);
      setStatusMessage('Pack ZIP téléchargé avec succès !');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Erreur export ZIP', err);
      toast.error('Erreur lors de la génération du ZIP.');
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-[#10121A] border border-[#272A38] rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#EDEDEE]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#272A38] bg-[#141722]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00F0FF] via-[#3B82F6] to-[#8B5CF6] p-[2px] shadow-md">
              <div className="w-full h-full bg-[#10121A] rounded-[9px] flex items-center justify-center">
                <FolderTree className="w-4 h-4 text-[#00F0FF]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  Convention de Nommage & Rangement Standard Studio
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 font-semibold">
                    Pro Pack Format
                  </span>
                </h2>
              </div>
              <p className="text-[11px] text-[#8A8F9E] font-mono">
                Standardisation universelle des tags, tonalités, BPM, catégories et arborescence de dossiers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyChanges}
              className="px-3.5 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#00D8E6] text-black font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Appliquer ({changedCount} modifications)
            </button>

            <button
              onClick={handleExportZip}
              disabled={isExportingZip}
              className="px-3 py-1.5 rounded-lg bg-[#181B28] hover:bg-[#222638] border border-[#272A38] text-xs font-mono text-white flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
              Exporter ZIP
            </button>

            {onOpenGitHubSync && (
              <button
                onClick={onOpenGitHubSync}
                className="px-3 py-1.5 rounded-lg bg-[#24292e] hover:bg-[#2f363d] border border-[#444d56] text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-all shadow-sm"
                title="Pousser les samples normalisés vers le dépôt Git propann/az-sample"
              >
                <Github className="w-3.5 h-3.5 text-white" />
                <span className="hidden sm:inline">Pousser sur Git</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8A8F9E] hover:text-white hover:bg-[#272A38] transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status banner */}
        {statusMessage && (
          <div className="bg-[#00F0FF]/15 border-b border-[#00F0FF]/30 px-5 py-1.5 text-xs font-mono text-[#00F0FF] flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-3.5 h-3.5" />
            {statusMessage}
          </div>
        )}

        {/* Configuration Controls Bar */}
        <div className="p-4 bg-[#08090E] border-b border-[#272A38] space-y-3">
          {/* Preset Buttons */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-mono text-[#8A8F9E] uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#00F0FF]" />
              Modèle de Convention :
            </span>

            <div className="flex flex-wrap gap-1.5 text-xs font-mono">
              {[
                { id: 'industry_pro', label: 'Industry Pro (Master)', example: 'DRUM_KICK_F#m_140BPM_Punchy_24b44ks' },
                { id: 'splice_pro', label: 'Splice / Commercial Pro', example: 'AZ_Kick_Punchy_F#m_140' },
                { id: 'teenage_eng', label: 'Teenage Eng. (Hardware)', example: '001_KCK_Punchy' },
                { id: 'daw_clean', label: 'DAW Clean', example: 'Kick Punchy F#m 140bpm' },
                { id: 'minimal_type', label: 'Minimaliste (KCK_Nom)', example: 'KCK_Punchy' },
                { id: 'custom', label: 'Motif Personnalisé', example: '{category}_{name}_{key}' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setConfig((prev) => ({ ...prev, preset: preset.id as NamingConventionPreset }))}
                  className={`px-3 py-1 rounded-lg border transition-all ${
                    config.preset === preset.id
                      ? 'bg-[#00F0FF]/15 border-[#00F0FF] text-[#00F0FF] font-bold shadow'
                      : 'bg-[#141724] border-[#272A38] text-[#8A8F9E] hover:text-white hover:bg-[#1E2232]'
                  }`}
                  title={preset.example}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Options Toggles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1 text-xs font-mono">
            {/* Prefix */}
            <div className="bg-[#12141F] p-2 rounded-lg border border-[#272A38] space-y-1">
              <span className="text-[10px] text-[#8A8F9E] block">Préfixe :</span>
              <input
                type="text"
                value={config.prefix}
                onChange={(e) => setConfig((prev) => ({ ...prev, prefix: e.target.value }))}
                className="w-full bg-[#181B28] border border-[#272A38] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#00F0FF]"
                placeholder="AZ"
              />
            </div>

            {/* Separator */}
            <div className="bg-[#12141F] p-2 rounded-lg border border-[#272A38] space-y-1">
              <span className="text-[10px] text-[#8A8F9E] block">Séparateur :</span>
              <select
                value={config.separator}
                onChange={(e) => setConfig((prev) => ({ ...prev, separator: e.target.value as any }))}
                className="w-full bg-[#181B28] border border-[#272A38] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#00F0FF]"
              >
                <option value="_">Tiret bas ( _ )</option>
                <option value="-">Tiret ( - )</option>
                <option value=" ">Espace (   )</option>
                <option value=".">Point ( . )</option>
              </select>
            </div>

            {/* Include Key */}
            <label className="bg-[#12141F] p-2 rounded-lg border border-[#272A38] flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-[#EDEDEE]">Inclure Tonalité</span>
              <input
                type="checkbox"
                checked={config.includeKey}
                onChange={(e) => setConfig((prev) => ({ ...prev, includeKey: e.target.checked }))}
                className="rounded bg-[#181B28] border-[#272A38] text-[#00F0FF] focus:ring-0"
              />
            </label>

            {/* Include BPM */}
            <label className="bg-[#12141F] p-2 rounded-lg border border-[#272A38] flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-[#EDEDEE]">Inclure BPM</span>
              <input
                type="checkbox"
                checked={config.includeBpm}
                onChange={(e) => setConfig((prev) => ({ ...prev, includeBpm: e.target.checked }))}
                className="rounded bg-[#181B28] border-[#272A38] text-[#00F0FF] focus:ring-0"
              />
            </label>

            {/* Include Audio Specs */}
            <label className="bg-[#12141F] p-2 rounded-lg border border-[#272A38] flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-[#EDEDEE]">Specs (24b44k)</span>
              <input
                type="checkbox"
                checked={config.includeSpecs}
                onChange={(e) => setConfig((prev) => ({ ...prev, includeSpecs: e.target.checked }))}
                className="rounded bg-[#181B28] border-[#272A38] text-[#00F0FF] focus:ring-0"
              />
            </label>

            {/* Auto Organize Folders */}
            <label className="bg-[#12141F] p-2 rounded-lg border border-[#272A38] flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-[#00F0FF] font-semibold">Dossiers Auto</span>
              <input
                type="checkbox"
                checked={config.autoOrganizeFolders}
                onChange={(e) => setConfig((prev) => ({ ...prev, autoOrganizeFolders: e.target.checked }))}
                className="rounded bg-[#181B28] border-[#272A38] text-[#00F0FF] focus:ring-0"
              />
            </label>
          </div>

          {/* Custom Pattern string input if preset is custom */}
          {config.preset === 'custom' && (
            <div className="bg-[#12141F] p-2.5 rounded-lg border border-[#00F0FF]/30 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between items-center text-[#8A8F9E]">
                <span>Motif personnalisable (Tokens disponibles : {'{category}'}, {'{type}'}, {'{type_code}'}, {'{name}'}, {'{key}'}, {'{bpm}'}, {'{specs}'}, {'{slot}'}, {'{genre}'})</span>
              </div>
              <input
                type="text"
                value={config.customPattern}
                onChange={(e) => setConfig((prev) => ({ ...prev, customPattern: e.target.value }))}
                className="w-full bg-[#181B28] border border-[#272A38] rounded-lg px-3 py-1 text-xs font-mono text-[#00F0FF] focus:outline-none focus:border-[#00F0FF]"
              />
            </div>
          )}
        </div>

        {/* Live Diff Table */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#18181D]">
          <div className="bg-[#141724] border-b border-[#272A38] text-[#8A8F9E] text-[10px] font-mono uppercase tracking-wider grid grid-cols-12 px-4 py-2 sticky top-0 z-10">
            <div className="col-span-1">Statut</div>
            <div className="col-span-4">Nom Original</div>
            <div className="col-span-1 text-center">→</div>
            <div className="col-span-4">Nouveau Nom Standardisé</div>
            <div className="col-span-2">Dossier Cible</div>
          </div>

          {diffList.map((item) => (
            <div
              key={item.id}
              className={`grid grid-cols-12 px-4 py-2 items-center text-xs font-mono transition select-none ${
                item.changed ? 'bg-[#00F0FF]/5 hover:bg-[#00F0FF]/10' : 'hover:bg-[#141724]'
              }`}
            >
              <div className="col-span-1 flex items-center gap-1.5">
                {item.changed ? (
                  <span className="w-2 h-2 rounded-full bg-[#00F0FF]" title="Modifié" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-[#4A4F62]" title="Identique" />
                )}
                <span className="text-[10px] text-[#7A7F92]">{item.changed ? 'DIFF' : 'OK'}</span>
              </div>

              <div className="col-span-4 truncate text-[#8A8F9E]" title={item.oldName}>
                {item.oldName}
              </div>

              <div className="col-span-1 text-center text-[#00F0FF]">
                <ArrowRight className="w-3.5 h-3.5 inline" />
              </div>

              <div className="col-span-4 truncate text-white font-semibold" title={item.newName}>
                {item.newName}
              </div>

              <div className="col-span-2 truncate text-[11px] text-[#00F0FF]" title={item.newPath}>
                {item.newPath}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#272A38] bg-[#0C0E15] flex items-center justify-between text-xs font-mono">
          <span className="text-[#8A8F9E]">
            {samples.length} samples dans la base • <b className="text-white">{changedCount}</b> à standardiser
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-[#181B28] hover:bg-[#222638] text-white transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleApplyChanges}
              className="px-4 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#00D8E6] text-black font-bold flex items-center gap-1.5 transition-all shadow"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Appliquer la Convention
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
