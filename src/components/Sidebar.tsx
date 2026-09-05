import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderPlus,
  Music,
  Scissors,
  Star,
  Sparkles,
  Zap,
  Mic,
  Radio,
  Trash2,
  ChevronRight,
  ChevronDown,
  Layers,
  Sliders,
  FolderTree,
  FileAudio,
  Plus,
  Flame,
  Wand2,
  BookOpen,
} from 'lucide-react';
import { FolderItem, SampleType, FilterState, SampleItem, MusicGenre } from '../types/sample';
import { useUiStore } from '../stores/uiStore';
import { diskPathForFolder } from '../services/libraryFolders';
import { countInFolder, countLibrary, countOfType } from '../services/libraryCounts';

interface SidebarProps {
  width?: number;
  folders: FolderItem[];
  samples: SampleItem[];
  filterState: FilterState;
  onFilterChange: (newFilter: Partial<FilterState>) => void;
  onCreateFolder: (name: string, color: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onAutoOrganizeLibrary?: () => void;
  activeView: 'library' | 'timbre';
  onViewChange: (view: 'library' | 'timbre') => void;
  physicalSampleCount?: number;
  diskFolderCounts?: Record<string, number>;
}

const MUSICAL_KEYS = ['all', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// The visual tree predates the on-disk structure. Map its useful category nodes
// to the canonical folders so their badges always show physical file counts.
const SAMPLE_TYPES: { id: SampleType | 'all'; label: string; color: string }[] = [
  { id: 'all', label: 'TOUS LES SONS', color: '#00F0FF' },
  { id: 'kick', label: 'KICKS (BD)', color: '#00F0FF' },
  { id: '808', label: '808 & BASS', color: '#A855F7' },
  { id: 'snare', label: 'SNARES & CLAPS', color: '#EF4444' },
  { id: 'hihat', label: 'HI-HATS & CYMB', color: '#F59E0B' },
  { id: 'loop', label: 'LOOPS & BREAKS', color: '#10B981' },
  { id: 'lead', label: 'SYNTH & LEADS', color: '#3B82F6' },
  { id: 'vocal', label: 'VOCALS & CHANTS', color: '#EC4899' },
  { id: 'fx', label: 'FX & RISERS', color: '#6366F1' },
  { id: 'multi-sound', label: 'MULTI-SOUNDS', color: '#00F0FF' },
];

const EP133_PAD_GROUPS = [
  { id: 'pad-1', slot: '001-099', label: '01 KICKS', type: 'kick' },
  { id: 'pad-2', slot: '100-199', label: '02 SNARES', type: 'snare' },
  { id: 'pad-3', slot: '200-299', label: '03 HI-HATS', type: 'hihat' },
  { id: 'pad-4', slot: '300-399', label: '04 CLAPS/PERC', type: 'clap' },
  { id: 'pad-5', slot: '400-499', label: '05 808/BASS', type: '808' },
  { id: 'pad-6', slot: '500-599', label: '06 LEADS', type: 'lead' },
  { id: 'pad-7', slot: '600-699', label: '07 PADS/CHORDS', type: 'chord' },
  { id: 'pad-8', slot: '700-799', label: '08 VOCALS/FX', type: 'vocal' },
  { id: 'pad-9', slot: '900-999', label: '00 LOOPS', type: 'loop' },
];

/**
 * Memoised: it takes the whole library as a prop and counts it, so without
 * this it redid the counting on every selection — App re-renders, and nothing
 * about a sidebar changes when a different sample is picked.
 */
export const Sidebar = React.memo(function Sidebar({
  width,
  folders,
  samples,
  filterState,
  onFilterChange,
  onCreateFolder,
  onDeleteFolder,
  onAutoOrganizeLibrary,
  activeView,
  onViewChange,
  physicalSampleCount = 0,
  diskFolderCounts = {},
}: SidebarProps) {
  const openModal = useUiStore((state) => state.openModal);
  const [sidebarTab, setSidebarTab] = useState<'folders' | 'types' | 'hardware' | 'keys'>('folders');
  /**
   * What a folder's badge shows: the samples loaded in memory that the library
   * filter would list for it, or the count read off the disk, whichever is
   * higher (the disk is ahead of the manifest right after an import).
   */
  const counts = useMemo(() => countLibrary(samples), [samples]);
  const countFor = (folder: FolderItem) => {
    const loaded = countInFolder(counts, folder.id, folders);
    return Math.max(loaded, diskFolderCounts[diskPathForFolder(folder)] || 0);
  };
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFolderColor, setNewFolderColor] = useState<string>('#00F0FF');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'f-root-oneshots': true,
    'f-root-loops': true,
    'f-os-drums': true,
    'f-lp-drums': true,
  });

  const toggleFolderExpand = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), newFolderColor);
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  // Group folders by root vs children
  const rootFolders = useMemo(() => {
    return folders.filter((f) => !f.parentId);
  }, [folders]);

  const getChildFolders = (parentId: string) => {
    return folders.filter((f) => f.parentId === parentId);
  };

  const getCountForType = (type: SampleType | 'all') => countOfType(counts, type);

  return (
    <aside
      id="app-sidebar"
      style={{
        width: width ? `${width}px` : undefined,
        minWidth: width ? `${width}px` : undefined,
        maxWidth: width ? `${width}px` : undefined,
      }}
      className={`${width ? '' : 'w-72 sm:w-80'} bg-[#0A0A0E] border-r-2 border-[#1E1E26] flex flex-col h-full select-none overflow-hidden z-20 font-mono text-xs flex-shrink-0`}
    >
      {/* Top Header Mode Banner - Retro Hardware Switch */}
      <div className="p-2.5 bg-[#0F0F14] border-b-2 border-[#1E1E26] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-pixel text-[#00F0FF]">
            <FolderTree className="w-4 h-4 text-[#00F0FF]" />
            <span>EXPLORATEUR</span>
          </div>
          <span className="text-[10px] font-pixel bg-[#00F0FF]/15 text-[#00F0FF] px-1.5 py-0.5 border border-[#00F0FF]/40">
            {samples.length} SAMPLES
          </span>
        </div>

        {/* View Switcher Tabs: Library vs 2D Timbre */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            id="view-library-tab"
            onClick={() => onViewChange('library')}
            className={`py-1 px-2 text-[10px] font-pixel tracking-wider flex items-center justify-center gap-1.5 transition pixel-btn ${
              activeView === 'library'
                ? 'bg-[#00F0FF] text-black font-bold border-[#00C8D6]'
                : 'bg-[#14141A] text-[#8E8E93] hover:text-white border-[#22222C]'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>LISTE</span>
          </button>
          <button
            id="view-timbre-tab"
            onClick={() => onViewChange('timbre')}
            className={`py-1 px-2 text-[10px] font-pixel tracking-wider flex items-center justify-center gap-1.5 transition pixel-btn ${
              activeView === 'timbre'
                ? 'bg-[#A855F7] text-white font-bold border-[#9333EA]'
                : 'bg-[#14141A] text-[#8E8E93] hover:text-white border-[#22222C]'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>2D MAP</span>
          </button>
        </div>

        {/* Navigation Selector Tabs: Big Priority for FOLDERS */}
        <div className="grid grid-cols-4 gap-1 pt-1">
          <button
            onClick={() => setSidebarTab('folders')}
            className={`py-1 text-[9px] font-pixel tracking-tighter uppercase text-center border transition ${
              sidebarTab === 'folders'
                ? 'bg-[#FFE600] text-black font-bold border-[#FFE600]'
                : 'bg-[#121217] text-[#8E8E93] hover:text-white border-[#22222A]'
            }`}
            title="Dossiers & Arborescence Fichiers"
          >
            📁 Dossiers
          </button>
          <button
            onClick={() => setSidebarTab('types')}
            className={`py-1 text-[9px] font-pixel tracking-tighter uppercase text-center border transition ${
              sidebarTab === 'types'
                ? 'bg-[#00F0FF] text-black font-bold border-[#00F0FF]'
                : 'bg-[#121217] text-[#8E8E93] hover:text-white border-[#22222A]'
            }`}
            title="Types de son"
          >
            ⚡ Types
          </button>
          <button
            onClick={() => setSidebarTab('hardware')}
            className={`py-1 text-[9px] font-pixel tracking-tighter uppercase text-center border transition ${
              sidebarTab === 'hardware'
                ? 'bg-[#FF7A00] text-black font-bold border-[#FF7A00]'
                : 'bg-[#121217] text-[#8E8E93] hover:text-white border-[#22222A]'
            }`}
            title="Pads EP-133 / OP-1"
          >
            🎛️ Pads
          </button>
          <button
            onClick={() => setSidebarTab('keys')}
            className={`py-1 text-[9px] font-pixel tracking-tighter uppercase text-center border transition ${
              sidebarTab === 'keys'
                ? 'bg-[#A855F7] text-white font-bold border-[#A855F7]'
                : 'bg-[#121217] text-[#8E8E93] hover:text-white border-[#22222A]'
            }`}
            title="Tonalités Musicales & BPM"
          >
            🎹 Clés
          </button>
        </div>
      </div>

      {/* Quick Filters Pill Bar (Always accessible, compact) */}
      <div className="px-2.5 py-1.5 bg-[#0C0C10] border-b-2 border-[#1E1E26] flex items-center justify-between gap-1 text-[10px]">
        <button
          onClick={() =>
            onFilterChange({
              selectedCategory:
                filterState.selectedCategory === 'one-shot' ? 'all' : 'one-shot',
            })
          }
          className={`flex-1 py-0.5 text-center font-pixel text-[8px] border transition ${
            filterState.selectedCategory === 'one-shot'
              ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]'
              : 'bg-[#121218] text-[#8E8E93] border-[#222228] hover:text-white'
          }`}
        >
          ONE-SHOT
        </button>
        <button
          onClick={() =>
            onFilterChange({
              selectedCategory:
                filterState.selectedCategory === 'loop' ? 'all' : 'loop',
            })
          }
          className={`flex-1 py-0.5 text-center font-pixel text-[8px] border transition ${
            filterState.selectedCategory === 'loop'
              ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]'
              : 'bg-[#121218] text-[#8E8E93] border-[#222228] hover:text-white'
          }`}
        >
          LOOPS
        </button>
        <button
          onClick={() => onFilterChange({ favoritesOnly: !filterState.favoritesOnly })}
          className={`px-2 py-0.5 font-pixel text-[8px] border flex items-center gap-1 transition ${
            filterState.favoritesOnly
              ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]'
              : 'bg-[#121218] text-[#8E8E93] border-[#222228] hover:text-white'
          }`}
        >
          <Star className={`w-2.5 h-2.5 ${filterState.favoritesOnly ? 'fill-current' : ''}`} />
          FAV
        </button>
      </div>

      {/* MAIN CONTENT AREA ACCORDING TO SELECTED TAB */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        {/* ======================================================== */}
        {/* TAB 1: FULL DEDICATED FOLDER EXPLORER (MAX SPACE)         */}
        {/* ======================================================== */}
        {sidebarTab === 'folders' && (
          <div className="space-y-2">
            {/* Header with Auto-Organize & New Folder Buttons */}
            <div className="flex items-center justify-between pb-1 border-b border-[#1E1E26]">
              <span className="text-[10px] font-pixel text-[#FFE600] tracking-wider uppercase flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-[#FFE600]" />
                Arborescence Pro
              </span>
              <div className="flex items-center gap-1">
                {(
                  <button
                    onClick={() => openModal('autoCurator')}
                    className="px-1.5 py-0.5 bg-gradient-to-r from-[#00F0FF]/20 to-[#A855F7]/20 hover:from-[#00F0FF]/30 hover:to-[#A855F7]/30 text-[#00F0FF] border border-[#00F0FF]/40 text-[8px] font-pixel flex items-center gap-1 transition pixel-btn font-bold"
                    title="Curateur Automatique : puiser, étudier, mettre au format, renommer et ranger"
                  >
                    <Wand2 className="w-2.5 h-2.5 text-[#00F0FF]" />
                    <span>CURATEUR</span>
                  </button>
                )}
                {onAutoOrganizeLibrary && (
                  <button
                    onClick={onAutoOrganizeLibrary}
                    className="px-1.5 py-0.5 bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-[#00F0FF] border border-[#00F0FF]/40 text-[8px] font-pixel flex items-center gap-1 transition pixel-btn"
                    title="Auto-classer les sons selon l'arborescence d'or (Splice / Ableton / NI)"
                  >
                    <Wand2 className="w-2.5 h-2.5" />
                    <span>AUTO-TRI</span>
                  </button>
                )}
                <button
                  id="add-folder-btn"
                  onClick={() => setIsCreatingFolder(true)}
                  className="px-1.5 py-0.5 bg-[#FFE600]/10 hover:bg-[#FFE600]/20 text-[#FFE600] border border-[#FFE600]/40 text-[8px] font-pixel flex items-center gap-1 transition pixel-btn"
                  title="Créer un nouveau dossier personnalisé"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>+ DOSSIER</span>
                </button>
              </div>
            </div>

            {/* Folder Creation Form */}
            {isCreatingFolder && (
              <form
                onSubmit={handleCreateFolderSubmit}
                className="p-2.5 bg-[#121218] border-2 border-[#FFE600] space-y-2 pixel-box"
              >
                <div className="text-[9px] font-pixel text-[#FFE600]">NOUVEAU DOSSIER :</div>
                <input
                  type="text"
                  placeholder="ex: Kicks_Analog_Pack"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  className="w-full bg-[#08080C] border-2 border-[#2B2B38] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FFE600] font-mono"
                />
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1">
                    {['#00F0FF', '#FFE600', '#FF7A00', '#A855F7', '#10B981', '#EC4899'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewFolderColor(c)}
                        className={`w-4 h-4 border ${newFolderColor === c ? 'border-white scale-110' : 'border-black'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsCreatingFolder(false)}
                      className="px-2 py-0.5 text-[9px] text-[#8E8E93] hover:text-white"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-0.5 bg-[#FFE600] text-black font-pixel text-[9px] font-bold"
                    >
                      CRÉER
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Folder Tree List */}
            <div className="space-y-1">
              {/* Root / All Samples Folder */}
              <button
                id="folder-all-btn"
                onClick={() => onFilterChange({ selectedFolderId: null })}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 border transition pixel-btn ${
                  filterState.selectedFolderId === null
                    ? 'bg-[#181822] text-[#00F0FF] border-[#00F0FF] font-bold shadow-xs'
                    : 'bg-[#101015] text-[#EDEDEE] border-[#1C1C24] hover:border-[#2C2C38]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-[#00F0FF] text-sm">📂</span>
                  <span className="font-mono text-xs font-semibold">TOUS LES FICHIERS</span>
                </div>
                <span className="text-[10px] font-pixel px-1.5 py-0.2 bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30">
                  {Math.max(samples.length, physicalSampleCount)}
                </span>
              </button>

              {/* Hierarchical Folder Rendering */}
              {rootFolders.map((rootFolder) => {
                const isRootSel = filterState.selectedFolderId === rootFolder.id;
                const isExpanded = !!expandedFolders[rootFolder.id];
                const childFolders = getChildFolders(rootFolder.id);
                const hasChildren = childFolders.length > 0;

                const totalCount = countFor(rootFolder);

                return (
                  <div key={rootFolder.id} className="space-y-0.5">
                    {/* Root Folder Row */}
                    <div
                      className={`group flex items-center justify-between px-2 py-1.5 border transition pixel-btn ${
                        isRootSel
                          ? 'bg-[#1A1A26] text-white border-[#FFE600] font-bold'
                          : 'bg-[#101016] text-[#EDEDEE] border-[#1E1E28] hover:border-[#333344]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={(e) => toggleFolderExpand(rootFolder.id, e)}
                            className="p-0.5 hover:bg-[#2A2A3A] rounded text-[#8E8E93] hover:text-white"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-[#FFE600]" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-[#8E8E93]" />
                            )}
                          </button>
                        ) : (
                          <span className="w-3" />
                        )}

                        <button
                          onClick={() => onFilterChange({ selectedFolderId: rootFolder.id })}
                          className="flex items-center gap-1.5 flex-1 text-left truncate"
                        >
                          <span style={{ color: rootFolder.color || '#FFE600' }} className="text-xs">
                            📁
                          </span>
                          <span className="text-xs font-semibold truncate tracking-tight">
                            {rootFolder.name}
                          </span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className="text-[9px] font-pixel px-1.5 py-0.2 border"
                          style={{
                            color: rootFolder.color || '#FFE600',
                            borderColor: `${rootFolder.color || '#FFE600'}44`,
                            backgroundColor: `${rootFolder.color || '#FFE600'}15`,
                          }}
                        >
                          {totalCount}
                        </span>
                        {!rootFolder.id.startsWith('f-') && (
                          <button
                            onClick={() => onDeleteFolder(rootFolder.id)}
                            className="opacity-0 group-hover:opacity-100 text-[#8E8E93] hover:text-[#EF4444] p-0.5 transition"
                            title="Supprimer ce dossier"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sub-Folders (Level 1) */}
                    {hasChildren && isExpanded && (
                      <div className="pl-3 space-y-0.5 border-l border-[#22222E] ml-2">
                        {childFolders.map((subFolder) => {
                          const isSubSel = filterState.selectedFolderId === subFolder.id;
                          const isSubExpanded = !!expandedFolders[subFolder.id];
                          const subChildren = getChildFolders(subFolder.id);
                          const hasSubChildren = subChildren.length > 0;

                          const subCount = countFor(subFolder);

                          return (
                            <div key={subFolder.id} className="space-y-0.5">
                              {/* Sub Folder Row */}
                              <div
                                className={`group flex items-center justify-between px-2 py-1 border transition pixel-btn ${
                                  isSubSel
                                    ? 'bg-[#1C1C2C] text-white border-[#00F0FF] font-bold'
                                    : 'bg-[#0E0E14] text-[#C5C5D2] border-[#181822] hover:border-[#2A2A3A]'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  {hasSubChildren ? (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleFolderExpand(subFolder.id, e)}
                                      className="p-0.5 hover:bg-[#2A2A3A] rounded text-[#8E8E93] hover:text-white"
                                    >
                                      {isSubExpanded ? (
                                        <ChevronDown className="w-2.5 h-2.5 text-[#00F0FF]" />
                                      ) : (
                                        <ChevronRight className="w-2.5 h-2.5 text-[#8E8E93]" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="w-2.5" />
                                  )}

                                  <button
                                    onClick={() => onFilterChange({ selectedFolderId: subFolder.id })}
                                    className="flex items-center gap-1.5 flex-1 text-left truncate"
                                  >
                                    <span style={{ color: subFolder.color || '#00F0FF' }} className="text-[10px]">
                                      ↳
                                    </span>
                                    <span className="text-[11px] truncate">{subFolder.name}</span>
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className="text-[8px] font-pixel px-1 py-0.2 border"
                                    style={{
                                      color: subFolder.color || '#00F0FF',
                                      borderColor: `${subFolder.color || '#00F0FF'}44`,
                                      backgroundColor: `${subFolder.color || '#00F0FF'}15`,
                                    }}
                                  >
                                  {subCount}
                                  </span>
                                  {!subFolder.id.startsWith('f-') && (
                                    <button
                                      onClick={() => onDeleteFolder(subFolder.id)}
                                      className="opacity-0 group-hover:opacity-100 text-[#8E8E93] hover:text-[#EF4444] p-0.5 transition"
                                      title="Supprimer ce dossier"
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Sub-Folders Level 2 */}
                              {hasSubChildren && isSubExpanded && (
                                <div className="pl-3 space-y-0.5 border-l border-[#282838] ml-2">
                                  {subChildren.map((leafFolder) => {
                                    const isLeafSel = filterState.selectedFolderId === leafFolder.id;
                                    const leafCount = countFor(leafFolder);

                                    return (
                                      <div
                                        key={leafFolder.id}
                                        className={`group flex items-center justify-between px-2 py-0.5 border transition pixel-btn ${
                                          isLeafSel
                                            ? 'bg-[#1E1E34] text-[#00F0FF] border-[#00F0FF] font-bold'
                                            : 'bg-[#0A0A0F] text-[#A5A5B5] border-[#14141E] hover:border-[#222230]'
                                        }`}
                                      >
                                        <button
                                          onClick={() => onFilterChange({ selectedFolderId: leafFolder.id })}
                                          className="flex items-center gap-1.5 flex-1 text-left truncate"
                                        >
                                          <span className="text-[9px] text-[#8E8E93]">•</span>
                                          <span className="text-[10px] truncate">{leafFolder.name}</span>
                                        </button>
                                        <span className="text-[8px] font-pixel text-[#8E8E93] bg-[#14141E] px-1 py-0.2 border border-[#222230]">
                                          {leafCount}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Micro / Rec Shortcut */}
            <div className="pt-3 border-t border-[#1E1E26] space-y-1.5">
              <button
                id="open-mic-recorder-sidebar-btn"
                onClick={() => openModal('recorder')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border-2 border-[#EF4444]/30 pixel-btn"
              >
                <div className="flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 text-[#EF4444]" />
                  <span className="font-pixel text-[10px]">REC AUDIO LIVE</span>
                </div>
                <span className="text-[9px] font-pixel text-[#EF4444] font-bold">● MIC</span>
              </button>

              {(
                <button
                  id="open-op1-studio-sidebar-btn"
                  onClick={() => openModal('op1Studio')}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-[#FF7A00] bg-[#FF7A00]/10 hover:bg-[#FF7A00]/20 border-2 border-[#FF7A00]/30 pixel-btn"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-[#FF7A00]" />
                    <span className="font-pixel text-[10px]">STUDIO OP-1 (24 PADS)</span>
                  </div>
                  <span className="text-[8px] font-pixel bg-[#FF7A00]/20 px-1 text-[#FF7A00]">AIFF</span>
                </button>
              )}

            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: SAMPLE TYPES (KICKS, SNARES, 808, LOOPS, ETC.)     */}
        {/* ======================================================== */}
        {sidebarTab === 'types' && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-pixel text-[#00F0FF] pb-1 border-b border-[#1E1E26] uppercase">
              ⚡ Catégories Sonores
            </div>
            {SAMPLE_TYPES.map((t) => {
              const isSel = filterState.selectedType === t.id;
              const count = getCountForType(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => onFilterChange({ selectedType: t.id })}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 border text-xs transition pixel-btn ${
                    isSel
                      ? 'bg-[#181824] text-[#00F0FF] border-[#00F0FF] font-bold'
                      : 'bg-[#101016] text-[#EDEDEE] border-[#1C1C24] hover:border-[#2C2C38]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2" style={{ backgroundColor: t.color }} />
                    <span className="font-pixel text-[10px]">{t.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8E8E93]">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: HARDWARE SAMPLER BANKS (EP-133 SLOTS)             */}
        {/* ======================================================== */}
        {sidebarTab === 'hardware' && (
          <div className="space-y-2">
            <div className="text-[10px] font-pixel text-[#FF7A00] pb-1 border-b border-[#1E1E26] flex items-center justify-between">
              <span>🎛️ SLOTS EP-133 K.O. II</span>
              <Radio className="w-3 h-3 text-[#FF7A00]" />
            </div>
            <div className="space-y-1">
              {EP133_PAD_GROUPS.map((pg) => {
                const isSel = filterState.selectedType === pg.type;
                const count =
                  pg.type === 'loop' ? counts.loops : (counts.byType.get(pg.type) ?? 0);
                return (
                  <button
                    key={pg.id}
                    onClick={() =>
                      onFilterChange({
                        selectedType: isSel ? 'all' : (pg.type as SampleType),
                      })
                    }
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 border text-xs transition pixel-btn ${
                      isSel
                        ? 'bg-[#FF7A00]/20 text-[#FF7A00] border-[#FF7A00] font-bold'
                        : 'bg-[#101016] text-[#EDEDEE] border-[#1C1C24] hover:border-[#2C2C38]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-pixel text-[#FF7A00] bg-[#FF7A00]/15 px-1 border border-[#FF7A00]/30">
                        {pg.slot}
                      </span>
                      <span className="font-mono text-xs font-semibold">{pg.label}</span>
                    </div>
                    <span className="text-[10px] font-pixel text-[#8E8E93]">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: MUSICAL KEYS & BPM FILTER                         */}
        {/* ======================================================== */}
        {sidebarTab === 'keys' && (
          <div className="space-y-3">
            <div>
              <div className="text-[10px] font-pixel text-[#A855F7] pb-1 border-b border-[#1E1E26] mb-2 uppercase">
                🎹 Tonalité Détectée (Root Key)
              </div>
              <div className="grid grid-cols-4 gap-1">
                {MUSICAL_KEYS.map((k) => {
                  const isSel = filterState.selectedKey === k;
                  return (
                    <button
                      key={k}
                      onClick={() => onFilterChange({ selectedKey: k })}
                      className={`py-1 text-[10px] font-pixel font-bold border transition ${
                        isSel
                          ? 'bg-[#A855F7] text-white border-white'
                          : 'bg-[#121218] text-[#8E8E93] border-[#22222C] hover:text-white'
                      }`}
                    >
                      {k}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-[#1E1E26]">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="font-pixel text-[10px] text-[#A855F7]">
                  BPM MAX : {filterState.maxBpm}
                </span>
                <button
                  onClick={() => onFilterChange({ minBpm: 60, maxBpm: 180 })}
                  className="text-[9px] font-pixel text-[#00F0FF] hover:underline"
                >
                  RESET
                </button>
              </div>
              <input
                type="range"
                min="60"
                max="180"
                value={filterState.maxBpm}
                onChange={(e) => onFilterChange({ maxBpm: parseInt(e.target.value) })}
                className="w-full h-2 bg-[#1C1C24] border border-[#2B2B38] accent-[#A855F7] cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Footer Documentation & Standards Card */}
      {(
        <div className="p-2 border-t border-[#1C1C24] bg-[#0A0A0F]">
          <button
            id="sidebar-open-doc-btn"
            onClick={() => openModal('doc')}
            className="w-full flex items-center justify-between p-2 bg-[#12121A] hover:bg-[#1A1A26] border border-[#2A2A38] hover:border-[#00F0FF]/40 rounded text-left transition group"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-[#00F0FF] group-hover:scale-110 transition" />
              <div>
                <div className="text-[9px] font-pixel text-white">GUIDE & CONVENTIONS</div>
                <div className="text-[8px] font-mono text-gray-400">Convention de nommage</div>
              </div>
            </div>
            <span className="text-[8px] font-pixel text-[#00F0FF] px-1.5 py-0.5 bg-[#00F0FF]/15 border border-[#00F0FF]/30 rounded">
              DOCS
            </span>
          </button>
        </div>
      )}
    </aside>
  );
});

