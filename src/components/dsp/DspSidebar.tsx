import React, { useState } from 'react';
import {
  Check,
  Layers,
  Sparkles,
  Search,
  CheckSquare,
  Square,
  Flame,
  Zap,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import { EffectModuleKey, EffectCategory, EFFECT_MODULES } from './dspTypes';
import { DspRackConfig } from '../../services/dspEffectsEngine';

interface DspSidebarProps {
  config: DspRackConfig;
  onToggleModule: (key: EffectModuleKey) => void;
  onToggleAll: (enable: boolean) => void;
  onApplyCombo: (comboName: string) => void;
  activeFocus: EffectModuleKey | 'all';
  onSelectFocus: (key: EffectModuleKey | 'all') => void;
  isModuleActive: (key: EffectModuleKey) => boolean;
  enabledCount: number;
}

export const DspSidebar: React.FC<DspSidebarProps> = ({
  config,
  onToggleModule,
  onToggleAll,
  onApplyCombo,
  activeFocus,
  onSelectFocus,
  isModuleActive,
  enabledCount,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<EffectCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModules = EFFECT_MODULES.filter((mod) => {
    const matchesCategory =
      selectedCategory === 'all' || mod.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      mod.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mod.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mod.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-72 sm:w-80 bg-[#0A0A12] border-r border-[#1E1E2C] flex flex-col shrink-0 select-none overflow-hidden">
      {/* Sidebar Header */}
      <div className="p-3 bg-[#0D0D18] border-b border-[#1E1E2C] shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#00F0FF]" />
            <span className="text-xs font-pixel font-bold text-white uppercase tracking-wider">
              EFFETS & MODULES
            </span>
          </div>
          <span className="px-2 py-0.5 bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[10px] font-mono font-bold text-[#00F0FF] rounded">
            {enabledCount} / {EFFECT_MODULES.length} ACTIFS
          </span>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-2 text-[#8E8E98]" />
          <input
            type="text"
            placeholder="Filtrer (ex: 808, reverb, tape)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141422] border border-[#242436] rounded pl-7 pr-2 py-1 text-[11px] font-mono text-white placeholder-[#5A5A68] outline-none focus:border-[#00F0FF]/60"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-[9px] font-mono">
          {[
            { id: 'all', label: 'TOUS' },
            { id: 'bass_dynamics', label: 'BASSES & DYN' },
            { id: 'space_echo', label: 'ESPACE' },
            { id: 'modulation_pitch', label: 'MODULATION' },
            { id: 'vintage_lofi', label: 'LO-FI' },
            { id: 'surgical_tools', label: 'OUTILS' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as EffectCategory)}
              className={`px-1.5 py-0.5 rounded whitespace-nowrap transition border ${
                selectedCategory === cat.id
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/50 font-bold'
                  : 'bg-[#10101C] text-[#8E8E98] border-[#202030] hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Combos Strip */}
      <div className="px-2.5 py-2 bg-[#08080E] border-b border-[#1A1A26] shrink-0">
        <div className="text-[9px] font-mono text-[#8E8E98] mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[#FFE600] font-bold">
            <Sparkles className="w-3 h-3" /> RECETTES 1-CLIC :
          </span>
          <div className="flex gap-1.5 text-[9px]">
            <button
              onClick={() => onToggleAll(true)}
              className="text-[#10B981] hover:underline"
              title="Activer tous les modules"
            >
              Tout on
            </button>
            <span className="text-[#303046]">|</span>
            <button
              onClick={() => onToggleAll(false)}
              className="text-[#8E8E98] hover:text-white hover:underline"
              title="Désactiver tous les modules"
            >
              Clean
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[9px] font-mono">
          <button
            onClick={() => onApplyCombo('drill-808')}
            className="px-1.5 py-1 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30 rounded text-left truncate transition"
          >
            ⚡ Drill 808
          </button>
          <button
            onClick={() => onApplyCombo('cosmic-echo')}
            className="px-1.5 py-1 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/30 rounded text-left truncate transition"
          >
            🌌 Ambient Void
          </button>
          <button
            onClick={() => onApplyCombo('lofi-sampler')}
            className="px-1.5 py-1 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 rounded text-left truncate transition"
          >
            📻 SP-1200 Lo-Fi
          </button>
          <button
            onClick={() => onApplyCombo('vinyl-cassette')}
            className="px-1.5 py-1 bg-[#EAB308]/10 hover:bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/30 rounded text-left truncate transition"
          >
            📼 Vinyle 1970
          </button>
          <button
            onClick={() => onApplyCombo('glitch-acid')}
            className="px-1.5 py-1 bg-[#FFE600]/10 hover:bg-[#FFE600]/20 text-[#FFE600] border border-[#FFE600]/30 rounded text-left truncate transition"
          >
            🔪 Glitch Acid
          </button>
          <button
            onClick={() => onApplyCombo('funk-wah')}
            className="px-1.5 py-1 bg-[#84CC16]/10 hover:bg-[#84CC16]/20 text-[#84CC16] border border-[#84CC16]/30 rounded text-left truncate transition"
          >
            🎸 Funky Auto-Wah
          </button>
        </div>
      </div>

      {/* Modules List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-[#08080E]/60">
        {filteredModules.map((mod, idx) => {
          const active = isModuleActive(mod.key);
          const isFocused = activeFocus === mod.key;
          const IconComp = mod.icon;

          return (
            <div
              key={mod.key}
              className={`p-2 rounded border transition flex flex-col gap-1.5 ${
                active
                  ? `${mod.bgColor} ${mod.borderColor} shadow-sm ring-1 ring-white/10`
                  : 'bg-[#0E0E18] border-[#1C1C28] hover:border-[#303046]'
              }`}
            >
              <div className="flex items-center justify-between">
                {/* Main Toggle Switch / Checkbox */}
                <button
                  type="button"
                  onClick={() => onToggleModule(mod.key)}
                  className="flex items-center gap-2 flex-1 text-left select-none overflow-hidden"
                >
                  <div
                    className={`w-4 h-4 rounded-sm flex items-center justify-center border transition shrink-0 ${
                      active
                        ? 'bg-white text-black border-white'
                        : 'border-[#404052] bg-[#141420]'
                    }`}
                  >
                    {active && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>

                  <div className="flex items-center gap-1.5 truncate">
                    <IconComp className="w-3.5 h-3.5 shrink-0" />
                    <span
                      className={`text-xs font-mono truncate ${
                        active ? 'text-white font-bold' : 'text-[#8E8E98]'
                      }`}
                    >
                      {idx + 1}. {mod.shortName}
                    </span>
                  </div>
                </button>

                {/* Focus Button */}
                <button
                  type="button"
                  onClick={() => onSelectFocus(isFocused ? 'all' : mod.key)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition shrink-0 ${
                    isFocused
                      ? 'bg-white text-black font-bold border-white'
                      : 'bg-[#141422] text-[#8E8E98] border-[#242436] hover:text-white'
                  }`}
                  title="Focaliser les commandes sur ce module"
                >
                  {isFocused ? 'FOCUS' : 'Régler'}
                </button>
              </div>

              <p className="text-[9px] font-mono text-[#71717A] leading-tight line-clamp-1 pl-6">
                {mod.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer: Mode Toggle */}
      <div className="p-2.5 bg-[#0D0D18] border-t border-[#1E1E2C] shrink-0 flex items-center justify-between text-[10px] font-mono">
        <span className="text-[#8E8E98]">Vue centrale :</span>
        <button
          onClick={() => onSelectFocus('all')}
          className={`px-2 py-1 rounded border transition ${
            activeFocus === 'all'
              ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/40 font-bold'
              : 'border-[#242436] text-[#8E8E98] hover:text-white'
          }`}
        >
          {activeFocus === 'all' ? '● Tous les modules' : 'Voir tout le rack'}
        </button>
      </div>
    </div>
  );
};
