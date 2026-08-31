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
  Play,
  Pause,
  Scissors,
  SkipBack,
  SkipForward,
  Wand2,
  Repeat,
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
  onOpenAutoSlicer?: () => void;
  onOpenAutoCurator?: () => void;
  onOpenDocumentation?: () => void;
  onAutoOrganizeLibrary?: () => void;
  isPlaying?: boolean;
  onTogglePlayPause?: () => void;
  onPlayNext?: () => void;
  onPlayPrev?: () => void;
  currentSampleName?: string;
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
  onOpenAutoSlicer,
  onOpenAutoCurator,
  onOpenDocumentation,
  onAutoOrganizeLibrary,
  isPlaying = false,
  onTogglePlayPause,
  onPlayNext,
  onPlayPrev,
  currentSampleName,
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
    <header id="app-header" className="h-12 bg-[#0E0E14] border-b-2 border-[#1E1E26] px-3 sm:px-4 flex items-center justify-between select-none z-30 pixel-box gap-2">
      {/* Brand & Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 bg-[#00F0FF] text-black font-extrabold flex items-center justify-center border border-[#00C8D6] pixel-btn">
          <Waves className="w-4 h-4" />
        </div>
        <div className="hidden sm:block">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xs font-pixel font-bold tracking-wider text-[#EDEDEE] uppercase">
              RESONANCE
            </h1>
            <span className="px-1 py-0.2 text-[8px] font-pixel bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40">
              PRO DSP
            </span>
          </div>
          <p className="text-[8px] font-pixel text-[#8E8E93]">
            {samplesCount} SAMPLES • 48kHz
          </p>
        </div>
      </div>

      {/* MASTER PLAYBACK TRANSPORT CONTROLS (Always Accessible Anywhere) */}
      <div className="flex items-center gap-1 bg-[#08080C] px-2 py-1 border-2 border-[#242432] shrink-0">
        {onPlayPrev && (
          <button
            id="global-prev-sample-btn"
            onClick={onPlayPrev}
            className="p-1 text-[#8E8E93] hover:text-white hover:bg-[#181824] transition rounded"
            title="Sample Précédent (Flèche Haut)"
          >
            <SkipBack className="w-3 h-3" />
          </button>
        )}

        {onTogglePlayPause && (
          <button
            id="global-play-pause-btn"
            onClick={onTogglePlayPause}
            className={`flex items-center gap-1 px-2.5 py-0.5 font-pixel text-[9px] font-bold transition pixel-btn ${
              isPlaying
                ? 'bg-[#FF3366] text-white border border-[#FF6688] shadow-sm animate-pulse'
                : 'bg-[#00F0FF] text-black border border-[#00C8D6] hover:bg-[#38BDF8]'
            }`}
            title="Lecture / Pause (Barre d'espace)"
          >
            {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            <span className="hidden md:inline">{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            <span className="text-[7px] opacity-70 hidden lg:inline">[ESPACE]</span>
          </button>
        )}

        {onPlayNext && (
          <button
            id="global-next-sample-btn"
            onClick={onPlayNext}
            className="p-1 text-[#8E8E93] hover:text-white hover:bg-[#181824] transition rounded"
            title="Sample Suivant (Flèche Bas)"
          >
            <SkipForward className="w-3 h-3" />
          </button>
        )}

        {/* Current sample label preview */}
        {currentSampleName && (
          <div className="hidden xl:flex items-center gap-1 max-w-[130px] truncate pl-1 text-[9px] font-mono text-[#00F0FF] border-l border-[#222230]">
            <span className="truncate">{currentSampleName}</span>
          </div>
        )}
      </div>

      {/* Center Live Search Bar */}
      <div className="flex-1 max-w-xs min-w-[120px]">
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
      <div className="flex items-center gap-1 shrink-0">
        {/* Real-time LED Segment VU Meter */}
        <div className="hidden 2xl:flex items-center gap-1.5 bg-[#060609] px-2 py-1 border border-[#242432]">
          <Activity className="w-3 h-3 text-[#00F0FF]" />
          <div className="flex items-center gap-0.5 w-10 h-2 bg-[#121218] p-0.5">
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
          title="Importer des fichiers audio (Ctrl+O)"
        >
          <Upload className="w-3 h-3 text-[#00F0FF]" />
          <span className="hidden sm:inline">FICHIERS</span>
        </button>

        {/* Import Folder Button */}
        <button
          id="import-folder-btn"
          onClick={() => folderInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 bg-[#14141C] hover:bg-[#1E1E28] text-[#EDEDEE] border-2 border-[#242432] text-[9px] font-pixel pixel-btn"
          title="Importer un dossier entier de samples (Ctrl+Shift+O)"
        >
          <FolderUp className="w-3 h-3 text-[#00F0FF]" />
          <span className="hidden sm:inline">DOSSIER</span>
        </button>

        {/* Auto-Organize Library Pro Folders */}
        {onOpenAutoCurator && (
          <button
            id="open-auto-curator-header-btn"
            onClick={onOpenAutoCurator}
            className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-[#00F0FF] to-[#A855F7] text-black font-extrabold text-[9px] font-pixel hover:opacity-90 border-2 border-[#00C8D6] pixel-btn shadow-md"
            title="Curateur Automatique & Rangement Intelligent (DSP Pipeline)"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CURATEUR PRO</span>
          </button>
        )}

        {onAutoOrganizeLibrary && (
          <button
            id="auto-organize-header-btn"
            onClick={onAutoOrganizeLibrary}
            className="hidden lg:flex items-center gap-1 px-2 py-1 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] border-2 border-[#00F0FF]/30 text-[9px] font-pixel pixel-btn"
            title="Auto-classer tous les sons en dossiers standards (01_ONE_SHOTS, 02_LOOPS, etc.)"
          >
            <Wand2 className="w-3 h-3 text-[#00F0FF]" />
            <span className="hidden xl:inline">AUTO-TRI</span>
          </button>
        )}

        {/* Auto-Slicer Direct Button */}
        {onOpenAutoSlicer && (
          <button
            id="open-slicer-header-btn"
            onClick={onOpenAutoSlicer}
            className="flex items-center gap-1 px-2 py-1 bg-[#10B981]/15 hover:bg-[#10B981]/30 text-[#10B981] border-2 border-[#10B981]/40 text-[9px] font-pixel pixel-btn"
            title="Découpe Automatique & Transitoires (Touche S)"
          >
            <Scissors className="w-3 h-3 text-[#10B981]" />
            <span className="hidden md:inline font-bold">SLICER [S]</span>
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
            <span className="hidden md:inline font-bold">RACK FX [E]</span>
          </button>
        )}

        {/* Smart Ingestion Magic Drop Button */}
        <button
          id="open-smart-ingest-btn"
          onClick={onOpenSmartIngest}
          className="hidden md:flex items-center gap-1 px-2 py-1 bg-[#00F0FF] text-black font-bold text-[9px] font-pixel hover:bg-[#38BDF8] border-2 border-[#00C8D6] pixel-btn"
          title="Smart Ingestion DSP"
        >
          <Sparkles className="w-3 h-3" />
          <span>INGEST</span>
        </button>

        {/* Convention & Batch Renaming Button */}
        {onOpenBatchNaming && (
          <button
            id="open-batch-naming-header-btn"
            onClick={onOpenBatchNaming}
            className="hidden xl:flex items-center gap-1 px-2 py-1 bg-[#A855F7]/15 hover:bg-[#A855F7]/30 text-[#A855F7] border-2 border-[#A855F7]/40 text-[9px] font-pixel pixel-btn"
            title="Convention de Nommage Pro"
          >
            <FolderTree className="w-3 h-3 text-[#A855F7]" />
            <span className="hidden 2xl:inline">CONVENTION</span>
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
          title="Égalisation -14 LUFS (EBU R128)"
        >
          <Volume2 className="w-3 h-3" />
          <span className="hidden 2xl:inline">-14LUFS</span>
        </button>

        {/* Batch Converter Button */}
        <button
          id="open-batch-converter-header-btn"
          onClick={onOpenBatchConverter}
          className="hidden lg:flex items-center gap-1 px-2 py-1 bg-[#00F0FF]/15 hover:bg-[#00F0FF]/30 text-[#00F0FF] border-2 border-[#00F0FF]/40 text-[9px] font-pixel pixel-btn"
          title="Convertisseur par lot"
        >
          <FileCode2 className="w-3 h-3 text-[#00F0FF]" />
          <span className="hidden xl:inline">CONVERT</span>
        </button>

        {/* Documentation Modal Button */}
        {onOpenDocumentation && (
          <button
            id="open-doc-header-btn"
            onClick={onOpenDocumentation}
            className="flex items-center gap-1 px-2 py-1 bg-[#A855F7]/15 hover:bg-[#A855F7]/30 text-[#A855F7] border-2 border-[#A855F7]/40 text-[9px] font-pixel pixel-btn"
            title="Documentation Officielle & Conventions de Nommage (F1)"
          >
            <HelpCircle className="w-3 h-3 text-[#A855F7]" />
            <span className="hidden sm:inline">DOCS</span>
          </button>
        )}

        {/* Shortcuts Help */}
        <button
          id="shortcuts-help-btn"
          onClick={() => setShowShortcuts(!showShortcuts)}
          className="p-1 bg-[#14141C] text-[#8E8E93] hover:text-white border-2 border-[#242432] pixel-btn"
          title="Raccourcis Clavier (?)"
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
