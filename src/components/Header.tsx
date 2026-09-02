import React, { useRef, useState, useEffect } from 'react';
import { useUiStore } from '../stores/uiStore';
import {
  Search,
  Upload,
  FolderUp,
  FolderOpen,
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
  onImportFiles?: (files: FileList | File[]) => void;
  onReactivateWorkFolder?: () => void;
  workFolderName?: string | null;
  workFolderStatus?: 'disconnected' | 'connecting' | 'connected' | 'error';
  incomingCount?: number;
  failedIncomingCount?: number;
  onOpenDspAnalyzer?: () => void;
  onOpenFxRack?: () => void;
  onOpenAutoSlicer?: () => void;
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
  onReactivateWorkFolder,
  workFolderName,
  workFolderStatus = 'disconnected',
  incomingCount = 0,
  failedIncomingCount = 0,
  onOpenDspAnalyzer,
  onOpenFxRack,
  onOpenAutoSlicer,
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
  const openModal = useUiStore((state) => state.openModal);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
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
      onImportFiles?.(e.target.files);
    }
  };

  return (
    <header id="app-header" className="min-h-14 bg-[#0E0E14] border-b-2 border-[#1E1E26] px-3 sm:px-4 flex items-center justify-between select-none z-30 pixel-box gap-2">
      {/* Brand & Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 bg-[#060609] flex items-center justify-center border border-[#00C8D6] rounded pixel-btn overflow-hidden" title="Resonance">
          <img src="/resonance-logo.png" alt="Resonance" className="w-full h-full object-cover" />
        </div>
        <div className="hidden sm:block">
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-pixel font-bold tracking-wider text-[#EDEDEE] uppercase">
              RESONANCE
            </h1>
            <span className="px-1.5 py-0.5 text-[9px] font-pixel bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40">
              PRO DSP
            </span>
          </div>
          <p className="text-[10px] font-pixel text-[#A9A9B2]">
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
            placeholder="Rechercher un sample, BPM, tonalité…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#060609] border-2 border-[#242432] pl-7 pr-2 py-1.5 text-xs font-medium text-[#EDEDEE] placeholder-[#9696A2] focus:outline-none focus:border-[#00F0FF] transition"
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
        {onImportFiles && <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,.wav,.mp3,.ogg,.flac,.aiff,.webm,.m4a"
          onChange={handleFileInputChange}
          className="hidden"
        />}
        {onImportFiles && <input
          ref={folderInputRef}
          type="file"
          {...({ webkitdirectory: '', directory: '', multiple: true } as React.InputHTMLAttributes<HTMLInputElement>)}
          onChange={handleFileInputChange}
          className="hidden"
        />}

        {/* Import Files Button */}
        {onImportFiles && <button
          id="import-files-btn"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 bg-[#14141C] hover:bg-[#1E1E28] text-[#EDEDEE] border-2 border-[#242432] text-[9px] font-pixel pixel-btn"
          title="Importer des fichiers audio (Ctrl+O)"
        >
          <Upload className="w-3 h-3 text-[#00F0FF]" />
          <span className="hidden sm:inline">IMPORTER</span>
        </button>}

        {/* Import Folder Button */}
        {onImportFiles && <button
          id="import-folder-btn"
          onClick={() => folderInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 bg-[#14141C] hover:bg-[#1E1E28] text-[#EDEDEE] border-2 border-[#242432] text-[9px] font-pixel pixel-btn"
          title="Importer un dossier entier de samples (Ctrl+Shift+O)"
        >
          <FolderUp className="w-3 h-3 text-[#00F0FF]" />
          <span className="hidden sm:inline">DOSSIER AUDIO</span>
        </button>}

        {onReactivateWorkFolder && (
          <button
            id="reactivate-work-folder-btn"
            onClick={onReactivateWorkFolder}
            className="flex items-center gap-1 px-2 py-1 bg-[#FFE600]/15 hover:bg-[#FFE600] text-[#FFE600] hover:text-black border-2 border-[#FFE600]/50 text-[9px] font-pixel font-bold pixel-btn"
            title={workFolderStatus === 'connected' ? `Dossier actif : ${workFolderName || 'sans nom'}. Cliquer pour vérifier l'autorisation.` : 'Connecter ou réactiver le dossier de travail'}
          >
            <FolderOpen className="w-3 h-3" />
            <span className="hidden sm:inline">{workFolderStatus === 'connecting' ? 'CONNEXION…' : workFolderStatus === 'connected' ? 'DOSSIER ACTIF' : 'CONNECTER DOSSIER'}</span>
            {incomingCount > 0 && <span className="min-w-4 px-1 bg-black/20 text-[8px] text-current">{incomingCount}</span>}
            {failedIncomingCount > 0 && <span className="min-w-4 px-1 bg-[#FF3366] text-[8px] text-white">!{failedIncomingCount}</span>}
          </button>
        )}

        {/* Auto-Organize Library Pro Folders */}
        {(
          <button
            id="open-auto-curator-header-btn"
            onClick={() => openModal('autoCurator')}
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

        {(
          <button onClick={() => openModal('synthRack')} className="hidden lg:flex items-center gap-1 px-2 py-1 bg-[#A855F7]/20 hover:bg-[#A855F7]/35 text-[#E9D5FF] border-2 border-[#A855F7]/50 text-[9px] font-pixel pixel-btn" title="Ouvrir le rack de 10 moteurs synth et MIDI">
            <Wand2 className="w-3 h-3" />
            <span>SYNTH RACK</span>
          </button>
        )}
        {(
          <button onClick={() => openModal('advancedRack')} className="hidden xl:flex items-center gap-1 px-2 py-1 bg-[#FFB000]/15 hover:bg-[#FFB000]/30 text-[#FFE08A] border-2 border-[#FFB000]/50 text-[9px] font-pixel pixel-btn" title="Rack d’extensions Dexed et Mutable, chargé à la demande">
            <Flame className="w-3 h-3" />
            <span>EXTENSIONS</span>
          </button>
        )}

        {/* Smart Ingestion Magic Drop Button */}
        {<button
          id="open-smart-ingest-btn"
          onClick={() => openModal('smartIngest')}
          className="hidden md:flex items-center gap-1 px-2 py-1 bg-[#00F0FF] text-black font-bold text-[9px] font-pixel hover:bg-[#38BDF8] border-2 border-[#00C8D6] pixel-btn"
          title="Smart Ingestion DSP"
        >
          <Sparkles className="w-3 h-3" />
          <span>INGEST</span>
        </button>}

        {/* Convention & Batch Renaming Button */}
        {(
          <button
            id="open-batch-naming-header-btn"
            onClick={() => openModal('batchNaming')}
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
          onClick={() => openModal('batchConverter')}
          className="hidden lg:flex items-center gap-1 px-2 py-1 bg-[#00F0FF]/15 hover:bg-[#00F0FF]/30 text-[#00F0FF] border-2 border-[#00F0FF]/40 text-[9px] font-pixel pixel-btn"
          title="Convertisseur par lot"
        >
          <FileCode2 className="w-3 h-3 text-[#00F0FF]" />
          <span className="hidden xl:inline">CONVERT</span>
        </button>

        {/* Documentation Modal Button */}
        {(
          <button
            id="open-doc-header-btn"
            onClick={() => openModal('doc')}
            className="flex items-center gap-1 px-2 py-1 bg-[#A855F7]/15 hover:bg-[#A855F7]/30 text-[#A855F7] border-2 border-[#A855F7]/40 text-[9px] font-pixel pixel-btn"
            title="Documentation Officielle & Conventions de Nommage (F1)"
          >
            <HelpCircle className="w-3 h-3 text-[#A855F7]" />
            <span className="hidden sm:inline">DOCS</span>
          </button>
        )}

        {/* Shortcuts Help */}
        {(
          <button
            id="shortcuts-help-btn"
            onClick={() => openModal('shortcuts')}
            className="p-1 bg-[#14141C] text-[#8E8E93] hover:text-white border-2 border-[#242432] pixel-btn"
            title="Raccourcis Clavier (?)"
          >
            <HelpCircle className="w-3 h-3" />
          </button>
        )}
      </div>
    </header>
  );
};
