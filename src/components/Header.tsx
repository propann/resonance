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
  Flame,
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
  onOpenFxRack?: () => void;
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
  onOpenFxRack,
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
    <header id="app-header" className="h-12 bg-[#0E0E14] border-b-2 border-[#1E1E26] px-4 flex items-center justify-between select-none z-30 pixel-box">
      {/* Brand & Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-[#00F0FF] text-black font-extrabold flex items-center justify-center border border-[#00C8D6] pixel-btn">
          <Waves className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xs font-pixel font-bold tracking-wider text-[#EDEDEE] uppercase">
              RESONANCE
            </h1>
            <span className="px-1 py-0.2 text-[8px] font-pixel bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40">
              PRO DSP
            </span>
          </div>
          <p className="text-[8px] font-pixel text-[#8E8E93]">
            {samplesCount} SAMPLES • 48kHz DSP
          </p>
        </div>
      </div>

      {/* Center Live Search Bar */}
      <div className="flex-1 max-w-sm mx-4">
        <div className="relative">
          <Search className="w-3 h-3 text-[#8E8E93] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            id="global-search-input"
            type="text"
            placeholder="RECHERCHER SAMPLE, BPM, CLÉ..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#060609] border-2 border-[#242432] pl-7 pr-2 py-1 text-[10px] font-pixel text-[#00F0FF] placeholder-[#5A5A62] focus:outline-none focus:border-[#00F0FF] transition"
          />
        </div>
      </div>

      {/* Right Controls & Import Actions */}
      <div className="flex items-center gap-1.5">
        {/* Real-time LED Segment VU Meter */}
        <div className="hidden lg:flex items-center gap-1.5 bg-[#060609] px-2 py-1 border border-[#242432]">
          <Activity className="w-3 h-3 text-[#00F0FF]" />
          <div className="flex items-center gap-0.5 w-12 h-2.5 bg-[#121218] p-0.5">
            <div
              className={`h-full transition-all duration-75 ${
                peakMeterLevel > 0.85
                  ? 'bg-[#FF3366]'
                  : peakMeterLevel > 0.6
                  ? 'bg-[#FFE600]'
                  : 'bg-[#00F0FF]'
              }`}
              style={{ width: `${Math.min(100, peakMeterLevel * 100)}%` }}
            />
          </div>
          <span className="text-[8px] font-pixel text-[#8E8E93] w-7 text-right">
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
          className="flex items-center gap-1 px-2 py-1 bg-[#14141C] hover:bg-[#1E1E28] text-[#EDEDEE] border-2 border-[#242432] text-[9px] font-pixel pixel-btn"
          title="Importer des fichiers audio"
        >
          <Upload className="w-3 h-3 text-[#00F0FF]" />
          <span>FICHIERS</span>
        </button>

        {/* Import Folder Button */}
        <button
          id="import-folder-btn"
          onClick={() => folderInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 bg-[#14141C] hover:bg-[#1E1E28] text-[#EDEDEE] border-2 border-[#242432] text-[9px] font-pixel pixel-btn"
          title="Importer un dossier"
        >
          <FolderUp className="w-3 h-3 text-[#00F0FF]" />
          <span>DOSSIER</span>
        </button>

        {/* Convention & Batch Renaming Button */}
        {onOpenBatchNaming && (
          <button
            id="open-batch-naming-header-btn"
            onClick={onOpenBatchNaming}
            className="flex items-center gap-1 px-2 py-1 bg-[#A855F7]/15 hover:bg-[#A855F7]/30 text-[#A855F7] border-2 border-[#A855F7]/40 text-[9px] font-pixel pixel-btn"
            title="Convention de Nommage Pro"
          >
            <FolderTree className="w-3 h-3 text-[#A855F7]" />
            <span className="hidden sm:inline">CONVENTION</span>
          </button>
        )}

        {/* DSP Analyzer Lab Button */}
        {onOpenDspAnalyzer && (
          <button
            id="open-dsp-analyzer-header-btn"
            onClick={onOpenDspAnalyzer}
            className="hidden sm:flex items-center gap-1 px-2 py-1 bg-[#00F0FF]/15 hover:bg-[#00F0FF]/30 text-[#00F0FF] border-2 border-[#00F0FF]/40 text-[9px] font-pixel pixel-btn"
            title="Laboratoire DSP"
          >
            <Activity className="w-3 h-3 text-[#00F0FF]" />
            <span className="hidden xl:inline">DSP LAB</span>
          </button>
        )}

        {/* Auto-Loudness Leveling Toggle */}
        <button
          id="toggle-loudness-leveling-btn"
          onClick={onToggleAutoLoudness}
          className={`flex items-center gap-1 px-2 py-1 border-2 text-[9px] font-pixel pixel-btn ${
            autoLoudnessLeveling
              ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]'
              : 'bg-[#14141C] text-[#8E8E93] border-[#242432]'
          }`}
          title="Égalisation -14 LUFS"
        >
          <Volume2 className="w-3 h-3" />
          <span className="hidden xl:inline">-14LUFS</span>
        </button>

        {/* Smart Ingestion Magic Drop Button */}
        <button
          id="open-smart-ingest-btn"
          onClick={onOpenSmartIngest}
          className="flex items-center gap-1 px-2.5 py-1 bg-[#00F0FF] text-black font-bold text-[9px] font-pixel hover:bg-[#38BDF8] border-2 border-[#00C8D6] pixel-btn"
          title="Smart Ingestion DSP"
        >
          <Sparkles className="w-3 h-3" />
          <span>SMART INGEST</span>
        </button>

        {/* OP-1 Studio */}
        {onOpenOp1Studio && (
          <button
            id="open-op1-studio-header-btn"
            onClick={onOpenOp1Studio}
            className="hidden sm:flex items-center gap-1 px-2 py-1 bg-[#FF7A00]/15 hover:bg-[#FF7A00]/30 text-[#FF7A00] border-2 border-[#FF7A00]/40 text-[9px] font-pixel pixel-btn"
            title="OP-1 Studio"
          >
            <span>OP-1</span>
          </button>
        )}

        {/* Studio DSP Effects Rack Button */}
        {onOpenFxRack && (
          <button
            id="open-fx-rack-header-btn"
            onClick={onOpenFxRack}
            className="flex items-center gap-1 px-2 py-1 bg-[#00F0FF]/15 hover:bg-[#00F0FF]/30 text-[#00F0FF] border-2 border-[#00F0FF]/40 text-[9px] font-pixel pixel-btn"
            title="Rack d'Effets DSP & Sound Design (Ctrl+E)"
          >
            <Flame className="w-3 h-3 text-[#00F0FF]" />
            <span className="hidden lg:inline font-bold">RACK FX</span>
          </button>
        )}

        {/* GitHub Hub Sync */}
        {onOpenGitHubSync && (
          <button
            id="open-github-sync-header-btn"
            onClick={onOpenGitHubSync}
            className="flex items-center gap-1 px-2 py-1 bg-[#242432] hover:bg-[#323244] text-white border-2 border-[#44445A] text-[9px] font-pixel pixel-btn"
            title="GitHub: propann/az-sample"
          >
            <Github className="w-3 h-3 text-white" />
            <span className="hidden md:inline text-[#00F0FF]">az-sample</span>
          </button>
        )}

        {/* EP-133 Export */}
        <button
          id="open-ep133-export-btn"
          onClick={onExportEp133Pack}
          className="hidden md:flex items-center gap-1 px-2 py-1 bg-[#14141C] text-[#FFE600] border-2 border-[#FFE600]/40 text-[9px] font-pixel pixel-btn"
          title="Pack EP-133 KO II"
        >
          <span>EP-133</span>
        </button>

        {/* Batch Converter Button */}
        <button
          id="open-batch-converter-header-btn"
          onClick={onOpenBatchConverter}
          className="flex items-center gap-1 px-2 py-1 bg-[#00F0FF]/15 hover:bg-[#00F0FF]/30 text-[#00F0FF] border-2 border-[#00F0FF]/40 text-[9px] font-pixel pixel-btn"
          title="Convertisseur par lot"
        >
          <FileCode2 className="w-3 h-3 text-[#00F0FF]" />
          <span className="hidden sm:inline">CONVERT</span>
        </button>

        {/* Shortcuts Help */}
        <button
          id="shortcuts-help-btn"
          onClick={() => setShowShortcuts(!showShortcuts)}
          className="p-1 bg-[#14141C] text-[#8E8E93] hover:text-white border-2 border-[#242432] pixel-btn"
          title="Raccourcis Clavier"
        >
          <HelpCircle className="w-3 h-3" />
        </button>
      </div>

      {/* Keyboard Shortcuts Popover */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0E0E14] border-2 border-[#2A2A38] w-full max-w-md p-4 space-y-3 pixel-box">
            <div className="flex items-center justify-between border-b-2 border-[#22222E] pb-2">
              <h3 className="text-[11px] font-pixel text-[#00F0FF] font-bold uppercase">RACCOURCIS CLAVIER</h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-[#8E8E93] hover:text-white text-[10px] font-pixel"
              >
                [X]
              </button>
            </div>

            <div className="space-y-2 text-[10px] font-pixel">
              <div className="flex justify-between items-center py-1 border-b border-[#1E1E28]">
                <span className="text-[#8E8E93]">ESPACE</span>
                <span className="text-[#00F0FF]">PLAY / PAUSE</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1E1E28]">
                <span className="text-[#8E8E93]">FLÈCHES HAUT / BAS</span>
                <span className="text-[#00F0FF]">NAVIGUER & AUDITION</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1E1E28]">
                <span className="text-[#8E8E93]">TOUCHE L</span>
                <span className="text-[#00F0FF]">LOOP ON / OFF</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1E1E28]">
                <span className="text-[#8E8E93]">TOUCHE R</span>
                <span className="text-[#00F0FF]">REVERSE AUDIO</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#1E1E28]">
                <span className="text-[#8E8E93]">TOUCHE S</span>
                <span className="text-[#00F0FF]">DÉCOUPE AUTO SLICER</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
