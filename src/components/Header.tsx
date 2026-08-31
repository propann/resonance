import React, { useRef, useState, useEffect } from 'react';
import {
  Waves,
  Search,
  Upload,
  FolderUp,
  Mic,
  FileCode2,
  Sparkles,
  HelpCircle,
  Volume2,
  Activity,
  Sliders,
  Github,
  FolderTree,
} from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onImportFiles: (files: FileList | File[]) => void;
  onOpenSmartIngest: () => void;
  onOpenBenchmark: () => void;
  onExportEp133Pack: () => void;
  onOpenOp1Studio?: () => void;
  onOpenGitHubSync?: () => void;
  onOpenRecorder: () => void;
  onOpenBatchConverter: () => void;
  onOpenBatchNaming?: () => void;
  onOpenDspAnalyzer?: () => void;
  autoLoudnessLeveling: boolean;
  onToggleAutoLoudness: () => void;
  samplesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onImportFiles,
  onOpenSmartIngest,
  onOpenBenchmark,
  onExportEp133Pack,
  onOpenOp1Studio,
  onOpenGitHubSync,
  onOpenRecorder,
  onOpenBatchConverter,
  onOpenBatchNaming,
  onOpenDspAnalyzer,
  autoLoudnessLeveling,
  onToggleAutoLoudness,
  samplesCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [peakMeterLevel, setPeakMeterLevel] = useState<number>(0);

  // Subscribe to analyser for master VU meter
  useEffect(() => {
    const unsub = audioEngine.subscribeAnalyser((timeData) => {
      let max = 0;
      for (let i = 0; i < timeData.length; i++) {
        const val = Math.abs(timeData[i] - 128) / 128;
        if (val > max) max = val;
      }
      setPeakMeterLevel(max);
    });
    return () => unsub();
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportFiles(e.target.files);
    }
  };

  return (
    <header id="app-header" className="h-14 bg-[#0D0D10] border-b border-[#222226] px-5 flex items-center justify-between select-none z-30">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/40 flex items-center justify-center text-[#00F0FF] font-extrabold shadow-sm shadow-[#00F0FF]/20">
          <Waves className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-extrabold tracking-widest text-[#EDEDEE] uppercase">
              RESONANCE
            </h1>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30">
              PRO DSP
            </span>
          </div>
          <p className="text-[10px] font-mono text-[#8E8E93]">
            {samplesCount} Samples Chargés • Auto-Triage & Slicer
          </p>
        </div>
      </div>

      {/* Center Live Search Bar */}
      <div className="flex-1 max-w-md mx-6">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#8E8E93] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Rechercher par nom, note (F# min), BPM (120), type (kick)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#141417] border border-[#26262B] rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-[#EDEDEE] placeholder-[#6E6E73] focus:outline-none focus:border-[#00F0FF] transition"
          />
        </div>
      </div>

      {/* Right Controls & Import Actions */}
      <div className="flex items-center gap-2.5">
        {/* Real-time VU Master Peak Meter */}
        <div className="hidden lg:flex items-center gap-2 bg-[#141417] px-2.5 py-1 rounded-lg border border-[#26262B]">
          <Activity className="w-3.5 h-3.5 text-[#00F0FF]" />
          <div className="flex items-center gap-0.5 w-14 h-2.5 bg-[#0A0A0B] rounded-sm p-0.5">
            <div
              className={`h-full rounded-xs transition-all duration-75 ${
                peakMeterLevel > 0.9
                  ? 'bg-[#EF4444]'
                  : peakMeterLevel > 0.7
                  ? 'bg-[#F59E0B]'
                  : 'bg-[#00F0FF]'
              }`}
              style={{ width: `${Math.min(100, peakMeterLevel * 100)}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-[#8E8E93] w-9 text-right">
            {peakMeterLevel > 0 ? `${(20 * Math.log10(Math.max(0.001, peakMeterLevel))).toFixed(0)}dB` : '-inf'}
          </span>
        </div>

        {/* Hidden File / Folder Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,.wav,.mp3,.ogg,.flac,.aiff,.webm,.m4a"
          onChange={handleFileInputChange}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          {...({ webkitdirectory: '', directory: '', multiple: true } as React.InputHTMLAttributes<HTMLInputElement>)}
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Import Files Button */}
        <button
          id="import-files-btn"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141417] hover:bg-[#1E1E23] text-[#EDEDEE] border border-[#26262B] text-xs font-semibold transition"
          title="Importer des fichiers audio (WAV, MP3, FLAC, OGG)"
        >
          <Upload className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span>Importer</span>
        </button>

        {/* Import Folder Button */}
        <button
          id="import-folder-btn"
          onClick={() => folderInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141417] hover:bg-[#1E1E23] text-[#EDEDEE] border border-[#26262B] text-xs font-semibold transition"
          title="Importer un dossier entier de samples"
        >
          <FolderUp className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span>Dossier</span>
        </button>

        {/* Convention & Batch Renaming Button */}
        {onOpenBatchNaming && (
          <button
            id="open-batch-naming-header-btn"
            onClick={onOpenBatchNaming}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 text-[#A78BFA] border border-[#8B5CF6]/30 text-xs font-semibold transition"
            title="Convention de Nommage Pro & Rangement Automatique des Samples"
          >
            <FolderTree className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span className="hidden sm:inline">Convention Pro</span>
          </button>
        )}

        {/* DSP Analyzer Lab Button */}
        {onOpenDspAnalyzer && (
          <button
            id="open-dsp-analyzer-header-btn"
            onClick={onOpenDspAnalyzer}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30 text-xs font-semibold transition"
            title="Laboratoire d'Analyse Acoustique DSP & Fréquentielle"
          >
            <Activity className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span className="hidden xl:inline">Analyse DSP</span>
          </button>
        )}

        {/* Auto-Loudness Leveling Toggle */}
        <button
          id="toggle-loudness-leveling-btn"
          onClick={onToggleAutoLoudness}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
            autoLoudnessLeveling
              ? 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30 hover:bg-[#10B981]/25'
              : 'bg-[#141417] text-[#8E8E93] border-[#26262B] hover:bg-[#1E1E23]'
          }`}
          title={autoLoudnessLeveling ? 'Égalisation automatique active (EBU R128 -14 LUFS)' : 'Égalisation désactivée'}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Auto-Gain LUFS</span>
          <span className={`w-1.5 h-1.5 rounded-full ${autoLoudnessLeveling ? 'bg-[#10B981]' : 'bg-[#666]'}`} />
        </button>

        {/* Smart Ingestion Magic Drop Button */}
        <button
          id="open-smart-ingest-btn"
          onClick={onOpenSmartIngest}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00F0FF] text-[#0A0A0B] font-bold text-xs hover:bg-[#33F3FF] transition shadow-md shadow-[#00F0FF]/20"
          title="Pipeline d'ingestion intelligente : auto-triage BPM, Clé, One-Shot/Loop, Égalisation"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ingestion Intelligente</span>
        </button>

        {/* OP-1 OG Drum Studio */}
        {onOpenOp1Studio && (
          <button
            id="open-op1-studio-header-btn"
            onClick={onOpenOp1Studio}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FF7A00]/10 hover:bg-[#FF7A00]/20 text-[#FF7A00] border border-[#FF7A00]/30 text-xs font-semibold transition"
            title="Studio de création de kits OP-1 OG (24 pads, balises temporelles APPL, buffer 12s, AIFF)"
          >
            <span className="w-2 h-2 rounded-full bg-[#FF7A00]" />
            <span>Studio OP-1</span>
          </button>
        )}

        {/* GitHub Hub Sync (propann/az-sample) */}
        {onOpenGitHubSync && (
          <button
            id="open-github-sync-header-btn"
            onClick={onOpenGitHubSync}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#24292e] hover:bg-[#2f363d] text-white border border-[#444d56] text-xs font-semibold transition shadow-sm"
            title="Synchronisation GitHub : propann/az-sample.git"
          >
            <Github className="w-3.5 h-3.5 text-white" />
            <span className="hidden md:inline font-mono text-[11px] text-[#00F0FF]">az-sample</span>
          </button>
        )}

        {/* EP-133 Quick Export */}
        <button
          id="open-ep133-export-btn"
          onClick={onExportEp133Pack}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141417] hover:bg-[#1E1E23] text-[#E0E0E6] border border-[#26262B] text-xs font-semibold transition"
          title="Exporter le pack complet pour Teenage Engineering EP-133 K.O. II"
        >
          <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
          <span>Pack EP-133</span>
        </button>

        {/* Benchmark Study */}
        <button
          id="open-benchmark-btn"
          onClick={onOpenBenchmark}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141417] hover:bg-[#1E1E23] text-[#8E8E9A] hover:text-[#EDEDEE] border border-[#26262B] text-xs font-medium transition"
          title="Étude comparative : XO, Atlas 2, Sononym vs Resonance Studio"
        >
          <span>Étude Outils Pro</span>
        </button>

        {/* Batch Converter Button */}
        <button
          id="open-batch-converter-header-btn"
          onClick={onOpenBatchConverter}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30 text-xs font-semibold transition"
          title="Convertisseur de formats par lot"
        >
          <FileCode2 className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span className="hidden sm:inline">Batch Convert</span>
        </button>

        {/* Shortcuts Help Modal Toggle */}
        <button
          id="shortcuts-help-btn"
          onClick={() => setShowShortcuts(!showShortcuts)}
          className="p-1.5 rounded-lg bg-[#141417] text-[#8E8E93] hover:text-[#EDEDEE] hover:bg-[#1E1E23] border border-[#26262B] transition"
          title="Raccourcis Clavier Pro"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Keyboard Shortcuts Popover */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#111114] border border-[#2A2A2E] rounded-xl w-full max-w-md p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#222226] pb-2.5">
              <h3 className="text-xs font-bold text-[#EDEDEE] tracking-wide uppercase font-mono">Raccourcis Clavier Station Pro</h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-[#8E8E93] hover:text-[#EDEDEE] text-xs font-mono"
              >
                Fermer [✕]
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center py-1 border-b border-[#1E1E22]">
                <span className="text-[#8E8E93]">Espace</span>
                <span className="text-[#00F0FF] font-bold">Play / Pause l'audition</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1E1E22]">
                <span className="text-[#8E8E93]">Flèches Haut / Bas</span>
                <span className="text-[#00F0FF] font-bold">Naviguer & écouter le sample</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1E1E22]">
                <span className="text-[#8E8E93]">Touche L</span>
                <span className="text-[#00F0FF] font-bold">Activer / Désactiver la Boucle</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1E1E22]">
                <span className="text-[#8E8E93]">Touche R</span>
                <span className="text-[#00F0FF] font-bold">Inverser le sens (Reverse)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1E1E22]">
                <span className="text-[#8E8E93]">Touches 1-8 / Q-I</span>
                <span className="text-[#00F0FF] font-bold">Déclencher les Pads de Découpe MPC</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
