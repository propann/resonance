import React, { useEffect, useState } from 'react';
import { Piano, Save, RotateCcw, Circle, Wand2 } from 'lucide-react';
import { Modal } from './Modal';
import { CREATOR_ENGINES, DEFAULT_SYNTH_LAYERS, SynthLayer, synthRackEngine, SynthWave, CreatorEngineType, renderSynthPatch } from '../services/synthRackEngine';
import { readStudioSettings, writeStudioSettings, type DirectoryHandle } from '../services/localLibrary';
import { SampleItem } from '../types/sample';

interface LayerSynthRackModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraryRoot?: DirectoryHandle | null;
  onCreateSample?: (buffer: AudioBuffer, name: string) => void;
  librarySamples?: SampleItem[];
  onSelectLibrarySample?: (sampleId: string) => void;
  onOpenEffects?: (sample: SampleItem) => void;
}

const STORAGE_KEY = 'resonance-layer-synth-v1';
const keyboardNotes = [60, 62, 64, 65, 67, 69, 71, 72];
const engineIds = new Set(CREATOR_ENGINES.map((engine) => engine.id));

const migrateLayers = (value: unknown): SynthLayer[] | null => {
  if (!Array.isArray(value) || value.length !== 10) return null;
  return value.map((raw, index) => {
    const fallback = DEFAULT_SYNTH_LAYERS[index];
    const layer = (raw && typeof raw === 'object' ? raw : {}) as Partial<SynthLayer>;
    return {
      ...fallback,
      ...layer,
      engine: typeof layer.engine === 'string' && engineIds.has(layer.engine) ? layer.engine : fallback.engine,
    } as SynthLayer;
  });
};

export const LayerSynthRackModal: React.FC<LayerSynthRackModalProps> = ({ isOpen, onClose, libraryRoot, onCreateSample, librarySamples = [], onSelectLibrarySample, onOpenEffects }) => {
  const [layers, setLayers] = useState<SynthLayer[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return migrateLayers(saved) || DEFAULT_SYNTH_LAYERS.map((layer) => ({ ...layer }));
    } catch {
      return DEFAULT_SYNTH_LAYERS.map((layer) => ({ ...layer }));
    }
  });
  const [midiStatus, setMidiStatus] = useState('MIDI non connecté');
  const [isRendering, setIsRendering] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [sourceSampleId, setSourceSampleId] = useState<string | null>(null);

  useEffect(() => {
    synthRackEngine.setLayers(layers);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layers));
  }, [layers]);

  useEffect(() => {
    if (!isOpen || !libraryRoot) return;
    readStudioSettings(libraryRoot).then((settings) => {
      const migrated = migrateLayers(settings.synthLayers);
      if (migrated) setLayers(migrated);
    });
  }, [isOpen, libraryRoot]);

  useEffect(() => {
    if (!isOpen || !('requestMIDIAccess' in navigator)) return;
    let access: any;
    const connect = async () => {
      try {
        access = await navigator.requestMIDIAccess();
        const inputs = [...access.inputs.values()];
        setMidiStatus(inputs.length ? `MIDI : ${inputs.map((input) => input.name || 'entrée').join(', ')}` : 'MIDI connecté — aucune entrée');
        inputs.forEach((input) => {
          input.onmidimessage = (event) => {
            const [status, note, velocity = 0] = event.data;
            const command = status & 0xf0;
            if (command === 0x90 && velocity > 0) synthRackEngine.noteOn(note, velocity);
            if (command === 0x80 || (command === 0x90 && velocity === 0)) synthRackEngine.noteOff(note);
          };
        });
      } catch {
        setMidiStatus('MIDI refusé ou indisponible');
      }
    };
    void connect();
    return () => {
      synthRackEngine.allNotesOff();
      if (access) [...access.inputs.values()].forEach((input) => { input.onmidimessage = null; });
    };
  }, [isOpen]);

  const sourceSample = librarySamples.find((sample) => sample.id === sourceSampleId) || null;
  const updateLayer = (id: string, patch: Partial<SynthLayer>) => setLayers((previous) => previous.map((layer) => layer.id === id ? { ...layer, ...patch } : layer));
  const handleCreateSample = async () => {
    if (!onCreateSample) return;
    setIsRendering(true);
    try {
      const buffer = await renderSynthPatch(layers);
      onCreateSample(buffer, `SYNTH_LAYER_${Date.now().toString(36).toUpperCase()}`);
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="full"
      accent="#A855F7"
      icon={<Piano className="h-5 w-5" />}
      title="Rack Synth Layer — 10 moteurs"
      subtitle={`${midiStatus} · Les couches actives jouent ensemble et conservent leurs réglages.`}
      bodyClassName="relative flex flex-col overflow-hidden"
      headerRight={
        <>
          <button onClick={() => void handleCreateSample()} disabled={isRendering} className="px-3 py-1.5 text-xs bg-[#00F0FF] text-black font-bold rounded disabled:opacity-50"><Wand2 className="w-3 h-3 inline mr-1" />{isRendering ? 'Rendu…' : 'CRÉER SAMPLE'}</button>
          <button onClick={() => setLayers(DEFAULT_SYNTH_LAYERS.map((layer) => ({ ...layer })))} className="px-3 py-1.5 text-xs border border-[#3A3650] rounded"><RotateCcw className="w-3 h-3 inline mr-1" />Reset</button>
          <button onClick={() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(layers)); if (libraryRoot) void writeStudioSettings(libraryRoot, { synthLayers: layers }); }} className="px-3 py-1.5 text-xs bg-[#A855F7] text-black font-bold rounded"><Save className="w-3 h-3 inline mr-1" />Sauver</button>
        </>
      }
    >
      <button onClick={() => setIsLibraryOpen((open) => !open)} className="absolute left-0 top-16 z-20 px-1.5 py-4 bg-[#00F0FF] text-black text-[9px] font-bold [writing-mode:vertical-rl]">BANQUE</button>
      <aside className={`absolute left-0 top-2 bottom-16 z-10 w-60 overflow-y-auto bg-[#10121B] border-r border-[#00F0FF]/50 transition-transform duration-500 ease-out ${isLibraryOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-3 text-xs font-bold text-[#00F0FF]">BANQUE DE SONS</div>
        <div className="px-2 pb-3 text-[10px] text-[#A9A9B8]">Glisse un son dans la zone centrale pour en faire la source du patch.</div>
        {librarySamples.map((sample) => <div key={sample.id} draggable onDragStart={(event) => event.dataTransfer.setData('application/x-resonance-sample', sample.id)} className="mx-2 mb-1 p-2 rounded bg-[#181A26] hover:bg-[#252943] cursor-grab text-xs truncate">{sample.name}</div>)}
      </aside>
      <main onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData('application/x-resonance-sample'); if (librarySamples.some((item) => item.id === id)) { setSourceSampleId(id); onSelectLibrarySample?.(id); } }} className="flex-1 overflow-y-auto p-4 space-y-3">
        <section className="grid grid-cols-1 xl:grid-cols-[1fr_250px] gap-3">
          <div className="p-3 bg-[#0E101A] border border-[#2B2540] rounded-lg min-h-28"><div className="flex items-center justify-between mb-2"><span className="text-[10px] font-bold tracking-widest text-[#00F0FF]">PRÉVISUALISATION DU PATCH</span><span className="text-[10px] text-[#77778A]">10 couches · polyphonique</span></div><div className="h-14 flex items-center gap-0.5 opacity-90">{Array.from({ length: 64 }, (_, index) => <i key={index} className="flex-1 bg-[#A855F7] rounded-full" style={{ height: `${18 + ((index * 37) % 68)}%` }} />)}</div><div className="text-[10px] text-[#77778A]">Déposez un sample depuis BANQUE pour l’utiliser comme référence du patch.</div></div>
          <aside className="p-3 bg-[#0E101A] border border-[#2B2540] rounded-lg"><div className="text-[10px] font-bold tracking-widest text-[#FFB000] mb-2">RACK EFFETS</div><div className="space-y-1.5 text-[10px] text-[#A9A9B8]"><div className="flex justify-between"><span>Réverbération</span><span className="text-[#66667A]">Prête</span></div><div className="flex justify-between"><span>Delay / filtre</span><span className="text-[#66667A]">Prêt</span></div><div className="flex justify-between"><span>Routage live</span><span className="text-[#00F0FF]">DSP bibliothèque</span></div></div><button disabled={!sourceSample?.audioBuffer} onClick={() => sourceSample && onOpenEffects?.(sourceSample)} className="mt-3 w-full px-2 py-1.5 text-[10px] font-bold rounded bg-[#FFB000] text-black disabled:opacity-40">OUVRIR LE RACK DSP</button><div className="mt-2 text-[9px] text-[#66667A]">Déposez d’abord un sample audio depuis BANQUE.</div></aside>
        </section>
        {sourceSample && <div className="p-2 bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-xs text-[#00F0FF] rounded">Source de patch déposée : {sourceSample.name}{sourceSample.audioBuffer ? ' — prête pour le rack DSP.' : ' — sélectionnez-la dans la bibliothèque pour charger son audio.'}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {layers.map((layer) => <section key={layer.id} className={`p-3 border rounded-lg ${layer.enabled ? 'border-[#A855F7]/70 bg-[#A855F7]/5' : 'border-[#242432] bg-[#0D0E14]'}`}>
          <div className="flex justify-between items-center mb-3 gap-1"><button onClick={() => updateLayer(layer.id, { enabled: !layer.enabled })} className="text-xs font-bold flex items-center gap-2"><Circle className={`w-3 h-3 ${layer.enabled ? 'fill-[#A855F7] text-[#A855F7]' : 'text-[#666]'}`} />{layer.name}</button><select value={layer.engine} onChange={(event) => updateLayer(layer.id, { engine: event.target.value as CreatorEngineType })} className="max-w-28 bg-[#161724] text-[10px] border border-[#343449] rounded px-1 py-1">{CREATOR_ENGINES.map((engine) => <option key={engine.id} value={engine.id}>{engine.label}</option>)}</select><select value={layer.wave} onChange={(event) => updateLayer(layer.id, { wave: event.target.value as SynthWave })} className="bg-[#161724] text-xs border border-[#343449] rounded px-1 py-1"><option value="sine">Sine</option><option value="sawtooth">Saw</option><option value="square">Square</option><option value="triangle">Triangle</option></select></div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">{([['gain', 'Gain', 0, 0.5, 0.01], ['pan', 'Pan', -1, 1, 0.01], ['detune', 'Detune', -1200, 1200, 1], ['octave', 'Octave', -2, 2, 1], ['attack', 'Attack', 0.005, 1, 0.005], ['release', 'Release', 0.02, 2, 0.01]] as const).map(([key, label, min, max, step]) => <label key={key} className="flex items-center gap-2"><span className="w-14 text-[#A9A9B8]">{label}</span><input className="flex-1 accent-[#A855F7]" type="range" min={min} max={max} step={step} value={layer[key] as number} onChange={(event) => updateLayer(layer.id, { [key]: Number(event.target.value) })} /><span className="w-8 text-right">{Number(layer[key]).toFixed(key === 'gain' || key === 'attack' || key === 'release' ? 2 : 0)}</span></label>)}</div>
        </section>)}
        </div>
      </main>
      <footer className="p-4 border-t border-[#242432] flex gap-1 justify-center">{keyboardNotes.map((note) => <button key={note} onMouseDown={() => synthRackEngine.noteOn(note)} onMouseUp={() => synthRackEngine.noteOff(note)} onMouseLeave={() => synthRackEngine.noteOff(note)} className="w-12 h-16 bg-[#F4F4F5] text-black border border-black rounded-b">{note}</button>)}</footer>
    </Modal>
  );
};
