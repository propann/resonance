import React, { useEffect, useState } from 'react';
import { Cpu, Download, X } from 'lucide-react';
import { readStudioSettings, writeStudioSettings, type DirectoryHandle } from '../services/localLibrary';

type OptionalEngine = 'dexed' | 'mutable-plaits' | 'mutable-braids' | 'mutable-clouds' | 'mutable-rings' | 'mutable-marbles' | 'surge' | 'chiptune' | 'granular' | 'sampler';

const ENGINES: Array<{ id: OptionalEngine; name: string; family: string; description: string }> = [
  { id: 'dexed', name: 'Dexed FM', family: 'DX7 / 6 opérateurs', description: 'Moteur FM dédié, chargé uniquement à la demande.' },
  { id: 'mutable-plaits', name: 'Mutable · Plaits', family: 'Macro-oscillateur', description: 'Modèles Plaits pour basses, leads et textures.' },
  { id: 'mutable-braids', name: 'Mutable · Braids', family: 'Synthèse numérique', description: 'Modèles Braids orientés sound design.' },
  { id: 'mutable-clouds', name: 'Mutable · Clouds', family: 'Granulaire / FX', description: 'Traitement granulaire pour boucles et textures.' },
  { id: 'mutable-rings', name: 'Mutable · Rings', family: 'Résonateur / cordes', description: 'Résonateurs physiques pour plucks, cordes et percussions.' },
  { id: 'mutable-marbles', name: 'Mutable · Marbles', family: 'Séquence / aléatoire', description: 'Générateur de variations et séquences organiques.' },
  { id: 'surge', name: 'Surge XT', family: 'Hybride / wavetable', description: 'Synthèse hybride, wavetable et modulations avancées.' },
  { id: 'chiptune', name: 'Chiptune Core', family: '8-bit / consoles', description: 'Oscillateurs rétro pour drums, basses et effets numériques.' },
  { id: 'granular', name: 'Granular Lab', family: 'Texture / time stretch', description: 'Découpe et étirement granulaire de samples.' },
  { id: 'sampler', name: 'Sampler Extended', family: 'Sample / multisample', description: 'Lecture multisample avec enveloppe et vélocité.' },
];

const STORAGE_KEY = 'resonance-optional-engines-v2';
const PARAM_KEY = 'resonance-optional-engine-params-v1';
type EngineParams = { mix: number; tone: number; morph: number };
const defaultParams = (): EngineParams => ({ mix: 0.7, tone: 0.5, morph: 0.35 });

interface Props { isOpen: boolean; onClose: () => void; libraryRoot?: DirectoryHandle | null; }

export const AdvancedEngineRackModal: React.FC<Props> = ({ isOpen, onClose, libraryRoot }) => {
  const [active, setActive] = useState<Record<OptionalEngine, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  });
  const [params, setParams] = useState<Record<string, EngineParams>>(() => {
    try { return JSON.parse(localStorage.getItem(PARAM_KEY) || '{}'); } catch { return {}; }
  });
  const [loading, setLoading] = useState<OptionalEngine | null>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(active)); }, [active]);
  useEffect(() => { localStorage.setItem(PARAM_KEY, JSON.stringify(params)); }, [params]);
  useEffect(() => {
    if (!isOpen || !libraryRoot) return;
    void readStudioSettings(libraryRoot).then((settings) => {
      if (settings.optionalEngines && typeof settings.optionalEngines === 'object') {
        const saved = settings.optionalEngines as { active?: Record<OptionalEngine, boolean>; params?: Record<string, EngineParams> };
        if (saved.active) setActive(saved.active);
        if (saved.params) setParams(saved.params);
      }
    });
  }, [isOpen, libraryRoot]);
  useEffect(() => {
    if (libraryRoot) void writeStudioSettings(libraryRoot, { optionalEngines: { active, params } });
  }, [active, params, libraryRoot]);
  if (!isOpen) return null;

  const toggle = async (id: OptionalEngine) => {
    if (active[id]) { setActive((current) => ({ ...current, [id]: false })); return; }
    setLoading(id);
    // Extension point: the heavy WASM/native bridge will be imported here when bundled.
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    setActive((current) => ({ ...current, [id]: true }));
    setLoading(null);
  };
  const resetAll = () => { setActive({}); setParams({}); };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur p-4">
    <div className="w-full max-w-3xl bg-[#0B0C12] border-2 border-[#FFB000] rounded-xl text-[#EDEDEE] overflow-hidden">
      <header className="px-5 py-4 flex items-center justify-between border-b border-[#332A16] bg-[#15130D]"><div><h2 className="flex items-center gap-2 text-[#FFE08A] font-bold"><Cpu className="w-5 h-5" /> RACK EXTENSIONS AUDIO · 10 MOTEURS</h2><p className="text-[11px] text-[#A9A9B8] mt-1">Dix moteurs différents séparés du rack principal · activation individuelle à la demande</p></div><button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded"><X className="w-4 h-4" /></button></header>
      <div className="p-5 grid gap-3 sm:grid-cols-2">{ENGINES.map((engine) => { const isActive = !!active[engine.id]; const values = params[engine.id] || defaultParams(); const updateParam = (key: keyof EngineParams, value: number) => setParams((current) => ({ ...current, [engine.id]: { ...values, [key]: value } })); return <article key={engine.id} className={`p-4 rounded-lg border ${isActive ? 'border-[#00F0FF] bg-[#00F0FF]/5' : 'border-[#2A2934] bg-[#11121A]'}`}><div className="flex justify-between gap-2"><div><h3 className="text-sm font-bold">{engine.name}</h3><div className="text-[10px] text-[#00F0FF] mt-1">{engine.family}</div></div><span className={`text-[9px] font-bold ${isActive ? 'text-[#00F0FF]' : 'text-[#77778A]'}`}>{isActive ? 'ACTIF' : 'INACTIF'}</span></div><p className="text-[10px] text-[#A9A9B8] mt-3 min-h-8">{engine.description}</p><div className="space-y-1.5 mt-3">{([['mix', 'Mix'], ['tone', 'Tone'], ['morph', 'Morph']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-[10px] text-[#A9A9B8]"><span className="w-9">{label}</span><input type="range" min="0" max="1" step="0.01" value={values[key]} onChange={(event) => updateParam(key, Number(event.target.value))} className="flex-1 accent-[#FFB000]" /><span className="w-7 text-right">{Math.round(values[key] * 100)}</span></label>)}</div><button onClick={() => void toggle(engine.id)} disabled={loading !== null} className={`mt-4 w-full py-2 text-[10px] font-bold rounded ${isActive ? 'bg-[#252737] text-[#EDEDEE]' : 'bg-[#FFB000] text-black'} disabled:opacity-50`}>{loading === engine.id ? <><Download className="w-3 h-3 inline mr-1 animate-bounce" />Chargement…</> : isActive ? 'DÉSACTIVER' : 'ACTIVER À LA DEMANDE'}</button></article>; })}</div>
      <footer className="px-5 py-3 border-t border-[#242432] text-[10px] text-[#77778A] flex items-center justify-between gap-3"><span>Les extensions sont mémorisées dans la bibliothèque de préférences. Leur pont WASM/audio natif sera branché sans alourdir le démarrage principal.</span><button onClick={resetAll} className="shrink-0 px-2 py-1 border border-[#55451D] rounded text-[#FFE08A]">RESET</button></footer>
    </div>
  </div>;
};
