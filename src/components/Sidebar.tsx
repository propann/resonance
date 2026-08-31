import React, { useState } from 'react';
import {
  Folder,
  FolderPlus,
  Music,
  Scissors,
  Star,
  Clock,
  Sparkles,
  Sliders,
  Tag,
  Plus,
  Trash2,
  ChevronRight,
  Layers,
  Zap,
  Mic,
  Disc,
  Radio,
  Volume2,
  Github,
} from 'lucide-react';
import { FolderItem, SampleType, FilterState, SampleItem, MusicGenre } from '../types/sample';

interface SidebarProps {
  folders: FolderItem[];
  samples: SampleItem[];
  filterState: FilterState;
  onFilterChange: (newFilter: Partial<FilterState>) => void;
  onCreateFolder: (name: string, color: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onOpenRecorder: () => void;
  onOpenOp1Studio?: () => void;
  onOpenGitHubSync?: () => void;
  activeView: 'library' | 'timbre';
  onViewChange: (view: 'library' | 'timbre') => void;
}

const MUSICAL_KEYS = ['all', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const GENRES: MusicGenre[] = [
  'Hip-Hop / BoomBap',
  'Trap / Drill',
  'House / EDM',
  'Techno / Industrial',
  'Lo-Fi / Chillhop',
  'Synthwave / Retro',
  'Drum & Bass / Jungle',
  'Afrobeat / Dancehall',
  'Ambient / Cinematic',
  'Pop / R&B',
  'Universal / Multi-Genre',
];

const EP133_PAD_GROUPS = [
  { id: 'pad-1', label: '01 Kicks (001-099)', type: 'kick' },
  { id: 'pad-2', label: '02 Snares (100-199)', type: 'snare' },
  { id: 'pad-3', label: '03 Hi-Hats (200-299)', type: 'hihat' },
  { id: 'pad-4', label: '04 Percs (300-399)', type: 'clap' },
  { id: 'pad-5', label: '05 Bass & 808 (400-499)', type: '808' },
  { id: 'pad-6', label: '06 Leads & Stabs (500-599)', type: 'lead' },
  { id: 'pad-7', label: '07 Pads & Chords (600-699)', type: 'chord' },
  { id: 'pad-8', label: '08 Vocals & FX (700-799)', type: 'vocal' },
  { id: 'pad-9', label: '00 Loops (900-999)', type: 'loop' },
];

const SAMPLE_TYPES: { id: SampleType | 'all'; label: string; icon: string; color: string }[] = [
  { id: 'all', label: 'Tous les Samples', icon: 'Disc', color: '#38bdf8' },
  { id: 'multi-sound', label: 'Multi-Sons (Découpe)', icon: 'Scissors', color: '#06b6d4' },
  { id: 'kick', label: 'Kicks', icon: 'Drum', color: '#06b6d4' },
  { id: '808', label: '808 & Sub', icon: 'Zap', color: '#8b5cf6' },
  { id: 'snare', label: 'Snares & Claps', icon: 'Drum', color: '#f43f5e' },
  { id: 'hihat', label: 'Hi-Hats & Cymbals', icon: 'Sparkles', color: '#eab308' },
  { id: 'loop', label: 'Boucles / Loops', icon: 'Music', color: '#10b981' },
  { id: 'lead', label: 'Mélodies & Leads', icon: 'Music', color: '#3b82f6' },
  { id: 'vocal', label: 'Vocals & Chants', icon: 'Mic', color: '#d946ef' },
  { id: 'fx', label: 'FX & Risers', icon: 'Sparkles', color: '#6366f1' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  folders,
  samples,
  filterState,
  onFilterChange,
  onCreateFolder,
  onDeleteFolder,
  onOpenRecorder,
  onOpenOp1Studio,
  onOpenGitHubSync,
  activeView,
  onViewChange,
}) => {
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFolderColor, setNewFolderColor] = useState<string>('#06b6d4');

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), newFolderColor);
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const getCountForType = (type: SampleType | 'all') => {
    if (type === 'all') return samples.length;
    if (type === 'snare') {
      return samples.filter((s) => s.type === 'snare' || s.type === 'clap').length;
    }
    if (type === 'hihat') {
      return samples.filter((s) => s.type === 'hihat' || s.type === 'cymbal').length;
    }
    return samples.filter((s) => s.type === type).length;
  };

  return (
    <aside id="app-sidebar" className="w-60 bg-[#0D0D10] border-r border-[#222226] flex flex-col h-full select-none overflow-y-auto z-20 font-sans">
      {/* Top View Selector: Library vs 2D Timbre Galaxy */}
      <div className="p-3 border-b border-[#222226]">
        <div className="grid grid-cols-2 gap-1 bg-[#141417] p-1 rounded-lg border border-[#26262B]">
          <button
            id="view-library-tab"
            onClick={() => onViewChange('library')}
            className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              activeView === 'library'
                ? 'bg-[#00F0FF] text-[#0A0A0B] font-bold shadow-xs'
                : 'text-[#8E8E93] hover:text-[#EDEDEE]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Bibliothèque</span>
          </button>
          <button
            id="view-timbre-tab"
            onClick={() => onViewChange('timbre')}
            className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              activeView === 'timbre'
                ? 'bg-[#8B5CF6] text-white font-bold shadow-xs'
                : 'text-[#8E8E93] hover:text-[#EDEDEE]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Espace Timbre</span>
          </button>
        </div>
      </div>

      {/* Quick Nav Presets: One-Shot / Loop / Multi-Sound / Favorites */}
      <div className="p-3 border-b border-[#222226] space-y-1">
        {/* Category Switcher Pills */}
        <div className="grid grid-cols-3 gap-1 mb-2 bg-[#141417] p-1 rounded-lg border border-[#26262B]">
          <button
            onClick={() => onFilterChange({ selectedCategory: 'all' })}
            className={`py-1 rounded text-[10px] font-bold transition text-center ${
              !filterState.selectedCategory || filterState.selectedCategory === 'all'
                ? 'bg-[#00F0FF] text-[#0A0A0B]'
                : 'text-[#8E8E93] hover:text-[#EDEDEE]'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => onFilterChange({ selectedCategory: 'one-shot' })}
            className={`py-1 rounded text-[10px] font-bold transition text-center ${
              filterState.selectedCategory === 'one-shot'
                ? 'bg-[#00F0FF] text-[#0A0A0B]'
                : 'text-[#8E8E93] hover:text-[#EDEDEE]'
            }`}
          >
            One-Shots
          </button>
          <button
            onClick={() => onFilterChange({ selectedCategory: 'loop' })}
            className={`py-1 rounded text-[10px] font-bold transition text-center ${
              filterState.selectedCategory === 'loop'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8E8E93] hover:text-[#EDEDEE]'
            }`}
          >
            Loops
          </button>
        </div>

        <button
          id="filter-favorites-btn"
          onClick={() => onFilterChange({ favoritesOnly: !filterState.favoritesOnly })}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
            filterState.favoritesOnly
              ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 font-bold'
              : 'text-[#EDEDEE] hover:bg-[#141417]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Star className={`w-3.5 h-3.5 ${filterState.favoritesOnly ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#F59E0B]'}`} />
            <span>Favoris Épinglés</span>
          </div>
          <span className="text-[10px] font-mono text-[#8E8E93]">
            {samples.filter((s) => s.favorite).length}
          </span>
        </button>

        <button
          id="filter-multi-sound-btn"
          onClick={() =>
            onFilterChange({
              selectedType: filterState.selectedType === 'multi-sound' ? 'all' : 'multi-sound',
            })
          }
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
            filterState.selectedType === 'multi-sound'
              ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 font-bold'
              : 'text-[#EDEDEE] hover:bg-[#141417]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span>Multi-Sons (Découpe)</span>
          </div>
          <span className="text-[10px] font-mono text-[#8E8E93]">
            {samples.filter((s) => s.isMultiSound || s.type === 'multi-sound').length}
          </span>
        </button>

        <button
          id="open-mic-recorder-sidebar-btn"
          onClick={onOpenRecorder}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/20 transition"
        >
          <div className="flex items-center gap-2">
            <Mic className="w-3.5 h-3.5 text-[#EF4444]" />
            <span>Enregistrer Micro / Line</span>
          </div>
          <span className="text-[9px] font-mono text-[#EF4444] font-bold">REC</span>
        </button>

        {onOpenOp1Studio && (
          <button
            id="open-op1-studio-sidebar-btn"
            onClick={onOpenOp1Studio}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#FF7A00] bg-[#FF7A00]/10 hover:bg-[#FF7A00]/20 border border-[#FF7A00]/30 transition"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span className="font-bold">Studio OP-1 (24 Pads)</span>
            </div>
            <span className="text-[9px] font-mono bg-[#FF7A00]/20 px-1 py-0.5 rounded text-[#FF7A00]">AIFF</span>
          </button>
        )}

        {onOpenGitHubSync && (
          <button
            id="open-github-sync-sidebar-btn"
            onClick={onOpenGitHubSync}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-[#24292e] hover:bg-[#2f363d] border border-[#444d56] transition"
          >
            <div className="flex items-center gap-2">
              <Github className="w-3.5 h-3.5 text-white" />
              <span className="font-medium">GitHub Hub (az-sample)</span>
            </div>
            <span className="text-[9px] font-mono bg-[#00F0FF]/20 text-[#00F0FF] px-1 py-0.5 rounded">GIT</span>
          </button>
        )}
      </div>

      {/* EP-133 Pad Bank Navigation */}
      <div className="p-3 border-b border-[#222226]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#00F0FF] font-mono flex items-center gap-1.5">
            <Radio className="w-3 h-3" /> Pads EP-133 (Slots)
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
          {EP133_PAD_GROUPS.map((pg) => {
            const isSel = filterState.selectedType === pg.type;
            const count = samples.filter((s) => {
              if (pg.type === 'loop') return s.isLoop || s.category === 'loop' || s.type === 'loop';
              return s.type === pg.type;
            }).length;

            return (
              <button
                key={pg.id}
                onClick={() => onFilterChange({ selectedType: isSel ? 'all' : (pg.type as SampleType) })}
                className={`px-2 py-1 rounded text-left truncate transition ${
                  isSel
                    ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40 font-bold'
                    : 'bg-[#141417] text-[#8E8E93] hover:text-[#EDEDEE] border border-[#222226]'
                }`}
              >
                <span className="truncate block">{pg.label.split(' ')[0]} {pg.label.split(' ')[1]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Genre Filter */}
      <div className="p-3 border-b border-[#222226]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] font-mono mb-2 block">
          Genres & Styles Détectés
        </span>
        <div className="space-y-0.5 max-h-32 overflow-y-auto pr-1">
          <button
            onClick={() => onFilterChange({ selectedGenre: 'all' })}
            className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition ${
              !filterState.selectedGenre || filterState.selectedGenre === 'all'
                ? 'bg-[#18181D] text-[#00F0FF] font-bold border border-[#26262B]'
                : 'text-[#8E8E93] hover:text-[#EDEDEE]'
            }`}
          >
            <span>Tous les Genres</span>
            <span className="text-[10px] font-mono text-[#8E8E93]">{samples.length}</span>
          </button>
          {GENRES.map((g) => {
            const isSel = filterState.selectedGenre === g;
            const count = samples.filter((s) => s.genre === g).length;
            if (count === 0 && !isSel) return null;
            return (
              <button
                key={g}
                onClick={() => onFilterChange({ selectedGenre: isSel ? 'all' : g })}
                className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition ${
                  isSel
                    ? 'bg-[#18181D] text-[#00F0FF] font-bold border border-[#26262B]'
                    : 'text-[#8E8E93] hover:text-[#EDEDEE]'
                }`}
              >
                <span className="truncate pr-1">{g}</span>
                <span className="text-[10px] font-mono text-[#8E8E93]">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Folders Management */}
      <div className="p-3 border-b border-[#222226]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] font-mono">
            Dossiers & Packs
          </span>
          <button
            id="add-folder-btn"
            onClick={() => setIsCreatingFolder(true)}
            className="p-1 rounded text-[#8E8E93] hover:text-[#EDEDEE] hover:bg-[#1A1A1E] transition"
            title="Nouveau Dossier"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {isCreatingFolder && (
          <form onSubmit={handleCreateFolderSubmit} className="mb-2 space-y-2 bg-[#141417] p-2 rounded-lg border border-[#26262B]">
            <input
              type="text"
              placeholder="Nom du dossier..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
              className="w-full bg-[#0A0A0B] border border-[#26262B] rounded px-2 py-1 text-xs text-[#EDEDEE] focus:outline-none focus:border-[#00F0FF] font-mono"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {['#00F0FF', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewFolderColor(c)}
                    className={`w-3.5 h-3.5 rounded-full ${newFolderColor === c ? 'ring-2 ring-white' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-2 py-0.5 rounded text-[10px] text-[#8E8E93] hover:text-[#EDEDEE]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-2 py-0.5 rounded text-[10px] bg-[#00F0FF] text-[#0A0A0B] font-bold"
                >
                  Créer
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="space-y-0.5">
          <button
            id="folder-all-btn"
            onClick={() => onFilterChange({ selectedFolderId: null })}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              filterState.selectedFolderId === null
                ? 'bg-[#18181D] text-[#00F0FF] font-bold border border-[#26262B]'
                : 'text-[#EDEDEE] hover:bg-[#141417]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Folder className="w-3.5 h-3.5 text-[#8E8E93]" />
              <span>Tous les Dossiers</span>
            </div>
            <span className="text-[10px] font-mono text-[#8E8E93]">{samples.length}</span>
          </button>

          {folders.map((folder) => {
            const isSel = filterState.selectedFolderId === folder.id;
            const count = samples.filter((s) => s.folderId === folder.id).length;
            return (
              <div
                key={folder.id}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  isSel
                    ? 'bg-[#18181D] text-[#00F0FF] font-bold border border-[#26262B]'
                    : 'text-[#EDEDEE] hover:bg-[#141417]'
                }`}
              >
                <button
                  onClick={() => onFilterChange({ selectedFolderId: folder.id })}
                  className="flex items-center gap-2 flex-1 text-left truncate"
                >
                  <Folder
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: folder.color || '#00F0FF' }}
                  />
                  <span className="truncate">{folder.name}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-[#8E8E93]">{count}</span>
                  <button
                    onClick={() => onDeleteFolder(folder.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#8E8E93] hover:text-[#EF4444] transition"
                    title="Supprimer ce dossier"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-Triage Sample Types */}
      <div className="p-3 border-b border-[#222226]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] font-mono mb-2 block">
          Catégories Auto-Triées
        </span>

        <div className="space-y-0.5">
          {SAMPLE_TYPES.map((t) => {
            const isSel = filterState.selectedType === t.id;
            const count = getCountForType(t.id);
            return (
              <button
                key={t.id}
                id={`filter-type-${t.id}`}
                onClick={() => onFilterChange({ selectedType: t.id })}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  isSel
                    ? 'bg-[#18181D] text-[#00F0FF] font-bold border border-[#26262B]'
                    : 'text-[#EDEDEE] hover:bg-[#141417]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                  <span>{t.label}</span>
                </div>
                <span className="text-[10px] font-mono text-[#8E8E93]">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Musical Key Filter */}
      <div className="p-3 border-b border-[#222226]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] font-mono mb-2 block">
          Tonalité Détectée (Key)
        </span>
        <div className="grid grid-cols-4 gap-1">
          {MUSICAL_KEYS.map((k) => {
            const isSel = filterState.selectedKey === k;
            return (
              <button
                key={k}
                id={`filter-key-${k}`}
                onClick={() => onFilterChange({ selectedKey: k })}
                className={`py-1 rounded text-[10px] font-mono font-semibold transition ${
                  isSel
                    ? 'bg-[#8B5CF6] text-white font-bold'
                    : 'bg-[#141417] text-[#8E8E93] hover:text-[#EDEDEE] border border-[#222226]'
                }`}
              >
                {k === 'all' ? 'All' : k}
              </button>
            );
          })}
        </div>
      </div>

      {/* BPM Filter Slider */}
      <div className="p-3">
        <div className="flex items-center justify-between text-xs font-mono mb-1.5">
          <span className="font-bold text-[#8E8E93] uppercase tracking-wider text-[10px]">
            BPM ({filterState.minBpm} - {filterState.maxBpm})
          </span>
          <button
            onClick={() => onFilterChange({ minBpm: 60, maxBpm: 180 })}
            className="text-[10px] text-[#00F0FF] hover:underline"
          >
            Reset
          </button>
        </div>
        <div className="space-y-2">
          <input
            type="range"
            min="60"
            max="180"
            value={filterState.maxBpm}
            onChange={(e) => onFilterChange({ maxBpm: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-[#1C1C21] rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </aside>
  );
};
