import React, { useState, useRef, useEffect } from 'react';
import {
  FileAudio,
  FolderOpen,
  Upload,
  FolderUp,
  Download,
  Github,
  Scissors,
  Sparkles,
  Sliders,
  Activity,
  Mic,
  FileCode2,
  FolderTree,
  Repeat,
  Volume2,
  CheckSquare,
  Square,
  HelpCircle,
  Cpu,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Trash2,
  Bookmark,
  Flame,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import { useUiStore } from '../stores/uiStore';

export interface AppMenuBarProps {
  onImportFiles?: () => void;
  onImportFolder?: () => void;
  onChooseLibrary?: () => void;
  onProcessReception?: () => void;
  onRefreshLibrary?: () => void;
  onCleanEmptyFolders?: () => void;
  isBackgroundProcessing?: boolean;
  libraryName?: string | null;
  onImportOp1Patch?: () => void;
  onOpenDspAnalyzer: () => void;
  onOpenFxRack?: () => void;
  onOpenLoudnessStandard?: () => void;
  onOpenEp133Export: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onDeleteSelected?: () => void;
  onExportZip?: () => void;
  autoLoudnessLeveling: boolean;
  onToggleAutoLoudness: () => void;
  activeView: 'library' | 'timbre';
  onViewChange: (view: 'library' | 'timbre') => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  samplesCount: number;
}

export const AppMenuBar: React.FC<AppMenuBarProps> = ({
  onImportFiles,
  onImportFolder,
  onChooseLibrary,
  onProcessReception,
  onRefreshLibrary,
  onCleanEmptyFolders,
  isBackgroundProcessing = false,
  libraryName,
  onImportOp1Patch,
  onOpenDspAnalyzer,
  onOpenFxRack,
  onOpenLoudnessStandard,
  onOpenEp133Export,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  onExportZip,
  autoLoudnessLeveling,
  onToggleAutoLoudness,
  activeView,
  onViewChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  samplesCount,
}) => {
  const openModal = useUiStore((state) => state.openModal);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuTrigger = (menuKey: string) => {
    setActiveMenu((prev) => (prev === menuKey ? null : menuKey));
  };

  const handleMenuHover = (menuKey: string) => {
    if (activeMenu !== null && activeMenu !== menuKey) {
      setActiveMenu(menuKey);
    }
  };

  const closeMenus = () => {
    setActiveMenu(null);
  };

  return (
    <div
      ref={menuBarRef}
      id="app-menu-bar"
      className="relative z-50 bg-[#08080C] border-b border-[#1A1A24] px-2 py-0.5 flex items-center justify-between text-[10px] font-pixel select-none"
    >
      {/* Top Level Menu Items */}
      <div className="flex items-center gap-1">
        {/* Brand Chip */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#00F0FF]/15 border border-[#00F0FF]/30 text-[#00F0FF] mr-2">
          <span className="w-1.5 h-1.5 bg-[#00F0FF] animate-pulse" />
          <span className="font-bold tracking-wider">RESONANCE DSP</span>
        </div>
        {isBackgroundProcessing && (
          <button
            onClick={() => openModal('autoCurator')}
            className="flex items-center gap-1 px-2 py-1 bg-[#EF4444] text-white font-bold animate-pulse hover:bg-[#F87171] transition"
            title="Tri en cours : ouvrir le détail"
          >
            <Activity className="w-3 h-3" />
            <span>TRI EN COURS</span>
          </button>
        )}

        {/* 1. FICHIER */}
        <div className="relative">
          <button
            id="menu-file-btn"
            onClick={() => handleMenuTrigger('file')}
            onMouseEnter={() => handleMenuHover('file')}
            className={`px-2 py-1 transition ${
              activeMenu === 'file'
                ? 'bg-[#00F0FF] text-black font-bold'
                : 'text-[#C5C5D2] hover:bg-[#14141E] hover:text-white'
            }`}
          >
            FICHIER
          </button>
          {activeMenu === 'file' && (
            <div className="absolute left-0 top-full mt-0.5 w-64 bg-[#0D0D14] border-2 border-[#242436] shadow-2xl p-1 space-y-0.5 pixel-box">
              {onChooseLibrary && (
                <button
                  onClick={() => {
                    onChooseLibrary();
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-2 text-left bg-[#A855F7]/15 text-[#E9D5FF] hover:bg-[#A855F7] hover:text-white transition font-bold"
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{libraryName ? 'Changer le dossier de travail...' : 'Choisir le dossier de travail...'}</span>
                  </div>
                </button>
              )}
              {libraryName && (
                <div className="px-2 py-1 text-[9px] text-[#C084FC] truncate" title={libraryName}>
                  Bibliothèque active : {libraryName}
                </div>
              )}
              {onProcessReception && (
                <button
                  onClick={() => {
                    onProcessReception();
                    closeMenus();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[#00F0FF] hover:bg-[#00F0FF] hover:text-black transition font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Analyser les nouveaux sons de réception</span>
                </button>
              )}
              {onRefreshLibrary && (
                <button
                  onClick={() => {
                    onRefreshLibrary();
                    closeMenus();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Rafraîchir la bibliothèque</span>
                </button>
              )}
              {onCleanEmptyFolders && (
                <button
                  onClick={() => {
                    onCleanEmptyFolders();
                    closeMenus();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer les dossiers vides</span>
                </button>
              )}
              <div className="h-px bg-[#1E1E2C] my-1" />
              {onImportFiles && <button
                onClick={() => {
                  onImportFiles();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importer Fichiers Audio...</span>
                </div>
                <span className="text-[8px] opacity-60">Ctrl+O</span>
              </button>}
              {onImportFolder && <button
                onClick={() => {
                  onImportFolder();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <FolderUp className="w-3.5 h-3.5" />
                  <span>Choisir le dossier source à analyser...</span>
                </div>
                <span className="text-[8px] opacity-60">Ctrl+Shift+O</span>
              </button>}
              {(
                <button
                  onClick={() => {
                    openModal('autoCurator');
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#00F0FF] hover:bg-[#00F0FF] hover:text-black transition font-bold"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
                    <span>Studio Auto-Curateur & Rangement...</span>
                  </div>
                  <span className="text-[8px] bg-[#00F0FF]/20 px-1 text-[#00F0FF]">DSP TRI</span>
                </button>
              )}
              {onImportOp1Patch && (
                <button
                  onClick={() => {
                    onImportOp1Patch();
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <div className="flex items-center gap-2">
                    <FileAudio className="w-3.5 h-3.5 text-[#FF7A00]" />
                    <span>Importer Patch OP-1 (.aif)...</span>
                  </div>
                  <span className="text-[8px] text-[#FF7A00]">24 PADS</span>
                </button>
              )}
              <div className="h-px bg-[#1E1E2C] my-1" />
              {onExportZip && (
                <button
                  onClick={() => {
                    onExportZip();
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5" />
                    <span>Exporter la Sélection en ZIP...</span>
                  </div>
                  <span className="text-[8px] opacity-60">Ctrl+E</span>
                </button>
              )}
              <button
                onClick={() => {
                  onOpenEp133Export();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-[#FFE600]" />
                  <span>Exporter Pack EP-133 K.O. II...</span>
                </div>
                <span className="text-[8px] text-[#FFE600]">EP-133</span>
              </button>
              {(
                <button
                  onClick={() => {
                    openModal('op1Studio');
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#FF7A00]" />
                    <span>Studio Kit OP-1 (.aif APPL)...</span>
                  </div>
                  <span className="text-[8px] text-[#FF7A00]">OP-1</span>
                </button>
              )}
              {(
                <>
                  <div className="h-px bg-[#1E1E2C] my-1" />
                  <button
                    onClick={() => {
                      openModal('gitHubSync');
                      closeMenus();
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                  >
                    <div className="flex items-center gap-2">
                      <Github className="w-3.5 h-3.5" />
                      <span>Synchronisation GitHub...</span>
                    </div>
                    <span className="text-[8px] text-[#00F0FF]">az-sample</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 2. ÉDITION */}
        <div className="relative">
          <button
            id="menu-edit-btn"
            onClick={() => handleMenuTrigger('edit')}
            onMouseEnter={() => handleMenuHover('edit')}
            className={`px-2 py-1 transition ${
              activeMenu === 'edit'
                ? 'bg-[#00F0FF] text-black font-bold'
                : 'text-[#C5C5D2] hover:bg-[#14141E] hover:text-white'
            }`}
          >
            ÉDITION
          </button>
          {activeMenu === 'edit' && (
            <div className="absolute left-0 top-full mt-0.5 w-60 bg-[#0D0D14] border-2 border-[#242436] shadow-2xl p-1 space-y-0.5 pixel-box">
              {onSelectAll && (
                <button
                  onClick={() => {
                    onSelectAll();
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Tout Sélectionner</span>
                  </div>
                  <span className="text-[8px] opacity-60">Ctrl+A</span>
                </button>
              )}
              {onDeselectAll && (
                <button
                  onClick={() => {
                    onDeselectAll();
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <div className="flex items-center gap-2">
                    <Square className="w-3.5 h-3.5" />
                    <span>Désélectionner Tout</span>
                  </div>
                  <span className="text-[8px] opacity-60">Échap</span>
                </button>
              )}
              <div className="h-px bg-[#1E1E2C] my-1" />
              {<button
                onClick={() => {
                  openModal('batchNaming');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <FolderTree className="w-3.5 h-3.5 text-[#A855F7]" />
                  <span>Convention de Nommage Pro...</span>
                </div>
                <span className="text-[8px] opacity-60">Ctrl+R</span>
              </button>}
              {onDeleteSelected && (
                <>
                  <div className="h-px bg-[#1E1E2C] my-1" />
                  <button
                    onClick={() => {
                      onDeleteSelected();
                      closeMenus();
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#FF3366] hover:bg-[#FF3366] hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer la sélection</span>
                    </div>
                    <span className="text-[8px] opacity-60">Suppr</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 3. AFFICHAGE */}
        <div className="relative">
          <button
            id="menu-view-btn"
            onClick={() => handleMenuTrigger('view')}
            onMouseEnter={() => handleMenuHover('view')}
            className={`px-2 py-1 transition ${
              activeMenu === 'view'
                ? 'bg-[#00F0FF] text-black font-bold'
                : 'text-[#C5C5D2] hover:bg-[#14141E] hover:text-white'
            }`}
          >
            AFFICHAGE
          </button>
          {activeMenu === 'view' && (
            <div className="absolute left-0 top-full mt-0.5 w-60 bg-[#0D0D14] border-2 border-[#242436] shadow-2xl p-1 space-y-0.5 pixel-box">
              <button
                onClick={() => {
                  onViewChange('library');
                  closeMenus();
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 text-left transition ${
                  activeView === 'library'
                    ? 'bg-[#00F0FF]/20 text-[#00F0FF] font-bold'
                    : 'text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black'
                }`}
              >
                <span>Vue Bibliothèque & Onde</span>
                <span className="text-[8px]">F1</span>
              </button>
              <button
                onClick={() => {
                  onViewChange('timbre');
                  closeMenus();
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 text-left transition ${
                  activeView === 'timbre'
                    ? 'bg-[#00F0FF]/20 text-[#00F0FF] font-bold'
                    : 'text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black'
                }`}
              >
                <span>Carte Timbrale 2D (Atlas/XO)</span>
                <span className="text-[8px]">F2</span>
              </button>
              <div className="h-px bg-[#1E1E2C] my-1" />
              {onZoomIn && (
                <button
                  onClick={() => {
                    onZoomIn();
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <div className="flex items-center gap-2">
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Zoomer Forme d'Onde</span>
                  </div>
                  <span className="text-[8px] opacity-60">Ctrl +</span>
                </button>
              )}
              {onZoomOut && (
                <button
                  onClick={() => {
                    onZoomOut();
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <div className="flex items-center gap-2">
                    <ZoomOut className="w-3.5 h-3.5" />
                    <span>Dézoomer</span>
                  </div>
                  <span className="text-[8px] opacity-60">Ctrl -</span>
                </button>
              )}
              {onResetZoom && (
                <button
                  onClick={() => {
                    onResetZoom();
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <div className="flex items-center gap-2">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Réinitialiser Zoom (1x)</span>
                  </div>
                  <span className="text-[8px] opacity-60">Ctrl 0</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 4. AUDIO / DSP */}
        <div className="relative">
          <button
            id="menu-audio-btn"
            onClick={() => handleMenuTrigger('audio')}
            onMouseEnter={() => handleMenuHover('audio')}
            className={`px-2 py-1 transition ${
              activeMenu === 'audio'
                ? 'bg-[#00F0FF] text-black font-bold'
                : 'text-[#C5C5D2] hover:bg-[#14141E] hover:text-white'
            }`}
          >
            AUDIO / DSP
          </button>
          {activeMenu === 'audio' && (
            <div className="absolute left-0 top-full mt-0.5 w-64 bg-[#0D0D14] border-2 border-[#242436] shadow-2xl p-1 space-y-0.5 pixel-box">
              <button
                onClick={() => {
                  onToggleAutoLoudness();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Auto-Gain EBU R128 (-14 LUFS)</span>
                </div>
                <span className={`text-[8px] font-bold ${autoLoudnessLeveling ? 'text-[#00F0FF]' : 'text-[#6E6E80]'}`}>
                  {autoLoudnessLeveling ? 'ACTIF' : 'OFF'}
                </span>
              </button>
              {onOpenLoudnessStandard && (
                <button
                  onClick={() => {
                    onOpenLoudnessStandard();
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Étalon Officiel (ITU-R BS.1770 / EBU R128)...</span>
                  </div>
                  <span className="text-[8px] text-[#10B981] font-bold">LUFS</span>
                </button>
              )}
              {<button
                onClick={() => {
                  openModal('smartIngest');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
                  <span>Ingestion Intelligente (Auto-Triage)...</span>
                </div>
                <span className="text-[8px] opacity-60">Ctrl+I</span>
              </button>}
              {onOpenFxRack && (
                <button
                  onClick={() => {
                    onOpenFxRack();
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <div className="flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5 text-[#00F0FF]" />
                    <span>Rack Modulaire (Effets & Sound Design)...</span>
                  </div>
                  <span className="text-[8px] text-[#00F0FF] font-bold">Ctrl+E</span>
                </button>
              )}
              <button
                onClick={() => {
                  onOpenDspAnalyzer();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[#00F0FF]" />
                  <span>Laboratoire Acoustique DSP...</span>
                </div>
                <span className="text-[8px]">F4</span>
              </button>
              <button
                onClick={() => {
                  openModal('batchConverter');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Convertisseur de Formats par Lot...</span>
                </div>
              </button>
              <div className="h-px bg-[#1E1E2C] my-1" />
              <button
                onClick={() => {
                  openModal('recorder');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 text-[#EF4444]" />
                  <span>Enregistreur Audio Studio...</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* 5. HARDWARE */}
        <div className="relative">
          <button
            id="menu-hardware-btn"
            onClick={() => handleMenuTrigger('hardware')}
            onMouseEnter={() => handleMenuHover('hardware')}
            className={`px-2 py-1 transition ${
              activeMenu === 'hardware'
                ? 'bg-[#00F0FF] text-black font-bold'
                : 'text-[#C5C5D2] hover:bg-[#14141E] hover:text-white'
            }`}
          >
            HARDWARE
          </button>
          {activeMenu === 'hardware' && (
            <div className="absolute left-0 top-full mt-0.5 w-64 bg-[#0D0D14] border-2 border-[#242436] shadow-2xl p-1 space-y-0.5 pixel-box">
              {(
                <button
                  onClick={() => {
                    openModal('op1Studio');
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#FF7A00]" />
                    <span>Teenage Engineering OP-1 (24 Pads)</span>
                  </div>
                  <span className="text-[8px] text-[#FF7A00]">.AIF</span>
                </button>
              )}
              <button
                onClick={() => {
                  onOpenEp133Export();
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-[#FFE600]" />
                  <span>Teenage Engineering EP-133 K.O. II</span>
                </div>
                <span className="text-[8px] text-[#FFE600]">001-999</span>
              </button>
              <div className="h-px bg-[#1E1E2C] my-1" />
              <div className="px-2 py-1 text-[8px] text-[#6E6E80] uppercase">
                Égalisation de Fréquence & Mapping :
              </div>
              <div className="px-2 py-1 text-[9px] text-[#8E8E98]">
                ✓ AIFF Extended 80-Bit Float COMM
                <br />
                ✓ Balises temporelles JSON APPL 'op-1'
                <br />
                ✓ Micro-fades 5ms anti-clics
              </div>
            </div>
          )}
        </div>

        {/* 6. AIDE */}
        <div className="relative">
          <button
            id="menu-help-btn"
            onClick={() => handleMenuTrigger('help')}
            onMouseEnter={() => handleMenuHover('help')}
            className={`px-2 py-1 transition ${
              activeMenu === 'help'
                ? 'bg-[#00F0FF] text-black font-bold'
                : 'text-[#C5C5D2] hover:bg-[#14141E] hover:text-white'
            }`}
          >
            AIDE
          </button>
          {activeMenu === 'help' && (
            <div className="absolute left-0 top-full mt-0.5 w-64 bg-[#0D0D14] border-2 border-[#242436] shadow-2xl p-1 space-y-0.5 pixel-box">
              {(
                <button
                  onClick={() => {
                    openModal('doc');
                    closeMenus();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#00F0FF] hover:bg-[#00F0FF] hover:text-black transition font-bold"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#00F0FF]" />
                    <span>Documentation & Conventions...</span>
                  </div>
                  <span className="text-[8px] bg-[#00F0FF]/20 px-1 text-[#00F0FF]">F1</span>
                </button>
              )}
              <button
                onClick={() => {
                  openModal('shortcuts');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-[#00F0FF]" />
                  <span>Raccourcis Clavier Pro...</span>
                </div>
                <span className="text-[8px]">?</span>
              </button>
              <button
                onClick={() => {
                  openModal('benchmark');
                  closeMenus();
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left text-[#EDEDEE] hover:bg-[#00F0FF] hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Étude Comparative Outils Pro...</span>
                </div>
              </button>
              <div className="h-px bg-[#1E1E2C] my-1" />
              <div className="px-2 py-1 text-[8px] text-[#8E8E98]">
                Resonance Pro Studio v2.4 Master
                <br />
                Norme officielle : propann/az-sample
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right status ticker */}
      <div className="flex items-center gap-3 text-[9px] text-[#6E6E80]">
        <span>{samplesCount} SAMPLES</span>
        <span className="text-[#00F0FF]">48kHz / 24-BIT READY</span>
      </div>
    </div>
  );
};
