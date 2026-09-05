/**
 * The workshop column: everything that makes or changes sound, laid out the
 * way the library is.
 *
 * Windows used to cover the waveform whenever you wanted to touch a sound — an
 * effects rack, a synth rack, an "extensions" rack — and several buttons led to
 * the same one. This column replaced them, and it now reads like the folder
 * tree facing it: instead of ONE_SHOTS and LOOPS, its folders are MOTEURS,
 * EFFETS, ARPÉGIATEUR and SÉQUENCEUR, each opening onto what it holds.
 *
 * Slicing and the OP-1 kit are tools over a sample rather than instruments, so
 * they live in the application menu.
 *
 * The rack it drives is the live one, mounted for as long as the app runs, so
 * a knob moved here is heard on the next block without leaving the sample you
 * are looking at.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Play,
  Square,
  Repeat,
  Save,
  RotateCcw,
  Trash2,
  Keyboard,
  Piano,
  Eraser,
} from 'lucide-react';
import { SampleItem } from '../types/sample';
import { listModuleDefs } from '../rack/registry';
import { registerBuiltinModules } from '../rack/modules';
import { RackModulePanel } from '../rack/RackModulePanel';
import { RACK_TEMPLATES } from '../rack/templates';
import { useLiveRack } from '../rack/useLiveRack';
import { useRackStore } from '../stores/rackStore';
import { useUiStore } from '../stores/uiStore';
import { useAudition } from '../stores/transportStore';
import { toast } from '../stores/toastStore';
import {
  listRackPatches,
  saveRackPatch,
  deleteRackPatch,
  cleanPatchName,
  type RackPatch,
} from '../services/rackPatches';
import { audioBufferToWavBlob } from '../services/audioConverter';
import { calculateAudioMetrics } from '../services/audioAnalyzer';
import { usePlayableEngine } from '../hooks/usePlayableEngine';
import { testAllModules, type ModuleTestResult } from '../rack/selfTest';
import { useNoteDrivers } from '../hooks/useNoteDrivers';
import { STEP_COUNT, type ArpMode } from '../services/noteDrivers';
import type { NativeEngineId } from '../services/engineBridge';
import { NativeEngineFolder } from './NativeEngineFolder';
import { buildOp1QuickKit } from '../services/op1QuickKit';

registerBuiltinModules();

type CategoryId = 'engines' | 'effects' | 'patches' | 'arp' | 'seq';

interface Category {
  id: CategoryId;
  label: string;
  color: string;
}

/**
 * The column's folders, in the order the library's are: what makes sound
 * first, what changes it next, then what drives it.
 */
const CATEGORIES: Category[] = [
  { id: 'engines', label: 'MOTEURS', color: '#A855F7' },
  { id: 'effects', label: 'EFFETS', color: '#00F0FF' },
  { id: 'patches', label: 'PATCHES', color: '#10B981' },
  { id: 'arp', label: 'ARPÉGIATEUR', color: '#FFE600' },
  { id: 'seq', label: 'SÉQUENCEUR', color: '#FF7A00' },
];

/**
 * Firmware compiled to WebAssembly, fetched on demand. Adding one is a line
 * here plus its bridge under public/engines — see tools/build-engine.sh.
 */
const NATIVE_ENGINES: Array<{ id: NativeEngineId; label: string }> = [
  { id: 'mutable-plaits', label: 'Plaits (Mutable)' },
  { id: 'mutable-rings', label: 'Rings (Mutable)' },
  { id: 'mutable-clouds', label: 'Clouds (Mutable)' },
  { id: 'mutable-elements', label: 'Elements (Mutable)' },
];

const OPEN_KEY = 'resonance-atelier-tree-v2';

/** Fields a chain that made its own sound needs to become a sample. */
const SYNTH_SAMPLE_BASE = {
  format: 'wav' as const,
  type: 'other' as const,
  category: 'one-shot' as const,
  isLoop: false,
  genre: 'Universal / Multi-Genre' as const,
  tags: ['moteur', 'synthese'],
  folderId: 'f-os-fx',
  folderPath: '/01_ONE_SHOTS/05_FX_TEXTURES',
  favorite: false,
  rating: 0,
  bitDepth: 24,
  channels: 2,
  slices: [],
  dateAdded: 0,
  spectralCentroid: 0,
  dynamicRangeDb: 0,
  peakDb: 0,
  rmsDb: 0,
  lufs: 0,
  loudnessGainDb: 0,
  zeroCrossingRate: 0,
};

/** A folder row, drawn like the library tree's. */
const FolderRow: React.FC<{
  label: string;
  color: string;
  open: boolean;
  count?: number;
  onToggle: () => void;
  children?: React.ReactNode;
}> = ({ label, color, open, count, onToggle, children }) => (
  <div
    className={`group flex items-center justify-between border px-2 py-1.5 transition pixel-btn ${
      open
        ? 'border-[#FFE600] bg-[#1A1A26] font-bold text-white'
        : 'border-[#1E1E28] bg-[#101016] text-[#EDEDEE] hover:border-[#333344]'
    }`}
  >
    <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
      {open ? (
        <ChevronDown className="h-3 w-3 shrink-0 text-[#FFE600]" />
      ) : (
        <ChevronRight className="h-3 w-3 shrink-0 text-[#8E8E93]" />
      )}
      <span style={{ color }} className="text-xs">
        📁
      </span>
      <span className="truncate font-pixel text-[9px] tracking-tight">{label}</span>
    </button>
    <div className="flex shrink-0 items-center gap-1.5">
      {children}
      {count !== undefined && (
        <span
          className="border px-1.5 py-0.2 font-pixel text-[9px]"
          style={{ color, borderColor: `${color}44`, backgroundColor: `${color}15` }}
        >
          {count}
        </span>
      )}
    </div>
  </div>
);

/** A leaf inside a folder: one module you can add to the chain. */
const LeafRow: React.FC<{ label: string; title?: string; onClick: () => void }> = ({
  label,
  title,
  onClick,
}) => (
  <button
    onClick={onClick}
    title={title}
    className="flex w-full items-center gap-1.5 border border-[#14141E] bg-[#0A0A0F] px-2 py-0.5 text-left text-[#A5A5B5] transition hover:border-[#222230] hover:text-[#00F0FF] pixel-btn"
  >
    <span className="text-[9px] text-[#8E8E93]">•</span>
    <span className="truncate text-[10px]">{label}</span>
  </button>
);

interface AtelierColumnProps {
  sample: SampleItem | null;
  onSaveAsNewSample: (sample: SampleItem) => void;
  /** Empty the edit window, to build an engine sound on a clean wave. */
  onClearSample: () => void;
  /**
   * Write a finished OP-1 patch into 03_HARDWARE/OP-1_DRUM_PATCHES. The
   * column builds the kit; only App knows how to reach the disk.
   */
  onSaveOp1Kit: (name: string, aiff: Blob) => void;
}

export const AtelierColumn: React.FC<AtelierColumnProps> = ({
  sample,
  onSaveAsNewSample,
  onClearSample,
  onSaveOp1Kit,
}) => {
  const rack = useRackStore((s) => s.rack);
  const addModule = useRackStore((s) => s.addModule);
  const removeModule = useRackStore((s) => s.removeModule);
  const toggleModule = useRackStore((s) => s.toggleModule);
  const moveModule = useRackStore((s) => s.moveModule);
  const setParams = useRackStore((s) => s.setParams);
  const applyTemplate = useRackStore((s) => s.applyTemplate);
  const resetRack = useRackStore((s) => s.reset);
  const importJson = useRackStore((s) => s.importJson);

  const openModal = useUiStore((s) => s.openModal);

  const [open, setOpen] = useState<Record<CategoryId, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null');
      if (saved && typeof saved === 'object') return saved as Record<CategoryId, boolean>;
    } catch {
      /* first run */
    }
    return { engines: true, effects: false, patches: false, arp: false, seq: false };
  });
  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(open));
    } catch {
      /* private mode: the column just forgets which folders were open */
    }
  }, [open]);
  const toggle = useCallback(
    (id: CategoryId) => setOpen((prev) => ({ ...prev, [id]: !prev[id] })),
    []
  );

  // The chain lives as long as the column does, which is as long as the app.
  const live = useLiveRack(sample?.audioBuffer, true);
  const [isRendering, setIsRendering] = useState(false);

  // The engines are playable while their folder is open. Closed, they release
  // the keyboard, so typing a sample name stays typing.
  const player = usePlayableEngine(open.engines);

  // What plays the engines when your hands are elsewhere.
  const drivers = useNoteDrivers(player.heldNotes, (player.octave + 1) * 12);

  /**
   * A model rendered by one of the compiled engines becomes a sample on the
   * wave, named after the engine and the model so it can be found again.
   */
  const handleEngineRendered = useCallback(
    (engineId: NativeEngineId, modelName: string, rendered: AudioBuffer) => {
      const blob = audioBufferToWavBlob(rendered, { bitDepth: 24, normalize: false });
      const metrics = calculateAudioMetrics(rendered);
      const prefix = engineId.replace('mutable-', '').toUpperCase();
      const label = modelName.replace(/[^\p{L}\p{N}]+/gu, '_');
      onSaveAsNewSample({
        ...SYNTH_SAMPLE_BASE,
        id: `${engineId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${prefix}_${label}`,
        originalFileName: `${prefix}_${label}.wav`,
        audioBuffer: rendered,
        blobUrl: URL.createObjectURL(blob),
        size: blob.size,
        duration: rendered.duration,
        sampleRate: rendered.sampleRate,
        channels: rendered.numberOfChannels,
        ...metrics,
      } as SampleItem);
    },
    [onSaveAsNewSample]
  );

  /**
   * Every model of an engine, laid across the OP-1's twenty-four pads: the
   * composite lands on the wave with its markers showing, and the patch is
   * written beside it.
   */
  const handleEngineKit = useCallback(
    async (
      engineId: NativeEngineId,
      label: string,
      sounds: Array<{ label: string; buffer: AudioBuffer }>
    ) => {
      try {
        const kit = await buildOp1QuickKit(sounds, label);
        const blob = audioBufferToWavBlob(kit.buffer, { bitDepth: 24, normalize: false });
        const metrics = calculateAudioMetrics(kit.buffer);
        onSaveAsNewSample({
          ...SYNTH_SAMPLE_BASE,
          id: `op1kit-${engineId}-${Date.now().toString(36)}`,
          name: `${kit.name}_KIT`,
          originalFileName: `${kit.name}_KIT.wav`,
          type: 'multi-sound',
          category: 'multi-sound',
          isMultiSound: true,
          tags: ['op-1', 'kit', 'moteur'],
          audioBuffer: kit.buffer,
          blobUrl: URL.createObjectURL(blob),
          size: blob.size,
          duration: kit.buffer.duration,
          sampleRate: kit.buffer.sampleRate,
          channels: kit.buffer.numberOfChannels,
          // The markers travel with the sound, so the editor can draw and move
          // them instead of the kit arriving as a finished, opaque file.
          slices: kit.slices,
          ...metrics,
        } as SampleItem);
        onSaveOp1Kit(kit.name, kit.aiff);
        toast.success(`Kit OP-1 « ${kit.name} » : ${kit.slices.length} pads sur l'onde.`);
      } catch (error) {
        console.error('Kit OP-1 impossible', error);
        toast.error("Le kit OP-1 n'a pas pu être construit.");
      }
    },
    [onSaveAsNewSample, onSaveOp1Kit]
  );

  const [selfTest, setSelfTest] = useState<ModuleTestResult[] | null>(null);
  const [testProgress, setTestProgress] = useState<string | null>(null);

  // The space bar drives the rack; with nothing to play it falls back to the
  // library selection.
  useAudition('Rack (atelier)', live.toggle, !live.isSilent);

  const palette = useMemo(() => listModuleDefs(), []);
  const effectDefs = useMemo(() => palette.filter((d) => d.kind !== 'source'), [palette]);
  const sourceDefs = useMemo(() => palette.filter((d) => d.kind === 'source'), [palette]);
  const effectFamilies = useMemo(
    () => [...new Set(effectDefs.map((d) => d.family))],
    [effectDefs]
  );

  const [patches, setPatches] = useState<RackPatch[]>([]);
  const [patchName, setPatchName] = useState('');
  useEffect(() => {
    if (!open.patches) return;
    void listRackPatches().then(setPatches).catch(() => setPatches([]));
  }, [open.patches]);

  const handleSavePatch = async () => {
    const name = cleanPatchName(patchName);
    if (!name) {
      toast.info('Donne un nom au patch avant de l’enregistrer.');
      return;
    }
    try {
      setPatches(await saveRackPatch(name, rack));
      setPatchName('');
      toast.success(`Patch « ${name} » enregistré.`);
    } catch (error) {
      console.error('Enregistrement du patch impossible', error);
      toast.error("Impossible d'enregistrer le patch.");
    }
  };

  /** Render every effect over a reference signal and report what it changes. */
  const handleSelfTest = async () => {
    setSelfTest(null);
    setTestProgress('…');
    try {
      const results = await testAllModules((done, total, label) =>
        setTestProgress(`${done}/${total} ${label}`)
      );
      setSelfTest(results);
      const broken = results.filter((r) => !r.ok);
      if (broken.length === 0) toast.success(`${results.length} effets testés : tous répondent.`);
      else toast.error(`${broken.length} effet(s) à revoir sur ${results.length}.`);
    } catch (error) {
      console.error('Test des effets impossible', error);
      toast.error('Le banc de test des effets a échoué.');
    } finally {
      setTestProgress(null);
    }
  };

  const handleSaveAsNew = async () => {
    setIsRendering(true);
    try {
      const rendered = await live.render();
      if (!rendered) {
        toast.info('Rien à rendre : choisis un sample ou ajoute un moteur.');
        return;
      }
      const blob = audioBufferToWavBlob(rendered, { bitDepth: 24, normalize: false });
      const metrics = calculateAudioMetrics(rendered);
      const baseName = sample ? sample.name.replace(/\.[^/.]+$/, '') : 'Moteur';
      onSaveAsNewSample({
        ...(sample ?? SYNTH_SAMPLE_BASE),
        id: `rack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${baseName}_RACK`,
        originalFileName: sample?.originalFileName || `${baseName}.wav`,
        audioBuffer: rendered,
        blobUrl: URL.createObjectURL(blob),
        size: blob.size,
        duration: rendered.duration,
        sampleRate: rendered.sampleRate,
        channels: rendered.numberOfChannels,
        format: 'wav',
        ...metrics,
      } as SampleItem);
      toast.success('Rendu ajouté à la bibliothèque.');
    } catch (error) {
      console.error('Rendu du rack impossible', error);
      toast.error('Le rendu du rack a échoué.');
    } finally {
      setIsRendering(false);
    }
  };

  const enabledCount = rack.modules.filter((m) => m.enabled).length;
  const colorOf = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!.color;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-l-2 border-[#1E1E28] bg-[#0A0A0F]">
      <div className="flex items-center justify-between border-b-2 border-[#1E1E28] bg-[#101016] px-2 py-1.5">
        <span className="font-pixel text-[10px] tracking-wider text-[#00F0FF]">ATELIER</span>
        <span className="flex items-center gap-1">
          <span className="font-pixel text-[8px] text-[#77778A]">
            {sample ? sample.name.slice(0, 14) : 'onde vide'}
          </span>
          <button
            onClick={onClearSample}
            disabled={!sample}
            title="Vider l'onde pour y poser un son de moteur"
            className="border border-[#2A2934] px-1 py-0.5 text-[#77778A] transition hover:border-[#EF4444] hover:text-[#EF4444] disabled:opacity-25"
          >
            <Eraser className="h-2.5 w-2.5" />
          </button>
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-1">
        {/* ---------------------------------------------------------- MOTEURS */}
        <FolderRow
          label="MOTEURS"
          color={colorOf('engines')}
          open={open.engines}
          count={sourceDefs.length}
          onToggle={() => toggle('engines')}
        >
          {/* One button, no keyboard drawn: the column has no room for one. */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              player.setInput(player.input === 'pc' ? 'midi' : 'pc');
            }}
            title={
              player.input === 'pc'
                ? 'Joué au clavier du PC — cliquer pour passer au MIDI'
                : `Joué au MIDI — ${player.midiStatus}. Cliquer pour revenir au clavier du PC`
            }
            className={`flex items-center gap-1 border px-1.5 py-0.5 font-pixel text-[8px] transition ${
              player.input === 'pc'
                ? 'border-[#A855F7]/50 bg-[#A855F7]/20 text-[#E9D5FF]'
                : 'border-[#00F0FF]/50 bg-[#00F0FF]/20 text-[#00F0FF]'
            }`}
          >
            {player.input === 'pc' ? (
              <Keyboard className="h-2.5 w-2.5" />
            ) : (
              <Piano className="h-2.5 w-2.5" />
            )}
            {player.input === 'pc' ? 'PC' : 'MIDI'}
          </button>
        </FolderRow>
        {open.engines && (
          <div className="ml-2 space-y-0.5 border-l border-[#22222E] pl-2">
            {sourceDefs.map((d) => (
              <LeafRow
                key={d.type}
                label={d.label}
                title={`Ajouter ${d.label} à la chaîne`}
                onClick={() => addModule(d.type)}
              />
            ))}
            <LeafRow
              label="Creator — 10 couches"
              title="Régler les couches, ADSR et enveloppes"
              onClick={() => openModal('synthRack')}
            />

            {/*
              Compiled firmware, not part of the bundle: Mutable Instruments'
              own code built by tools/build-engine.sh and fetched the first
              time its folder is opened.
            */}
            {NATIVE_ENGINES.map((engine) => (
              <NativeEngineFolder
                key={engine.id}
                id={engine.id}
                label={engine.label}
                note={(player.octave + 1) * 12}
                sampleBuffer={sample?.audioBuffer}
                onRendered={handleEngineRendered}
                onKit={(id, label, sounds) => void handleEngineKit(id, label, sounds)}
              />
            ))}
          </div>
        )}

        {/* ----------------------------------------------------------- EFFETS */}
        <FolderRow
          label="EFFETS"
          color={colorOf('effects')}
          open={open.effects}
          count={effectDefs.length}
          onToggle={() => toggle('effects')}
        />
        {open.effects && (
          <div className="ml-2 space-y-0.5 border-l border-[#22222E] pl-2">
            {effectFamilies.map((family) => (
              <div key={family}>
                <div className="px-1 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-[#55556A]">
                  {family}
                </div>
                <div className="space-y-0.5">
                  {effectDefs
                    .filter((d) => d.family === family)
                    .map((d) => (
                      <LeafRow
                        key={d.type}
                        label={d.label}
                        title={`Ajouter ${d.label} à la chaîne`}
                        onClick={() => addModule(d.type)}
                      />
                    ))}
                </div>
              </div>
            ))}
            <div className="px-1 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-[#55556A]">
              Chaînes toutes faites
            </div>
            {RACK_TEMPLATES.map((template) => (
              <LeafRow
                key={template.id}
                label={template.label}
                title={`${template.modules.length} modules`}
                onClick={() => applyTemplate(template.modules)}
              />
            ))}
            <button
              onClick={() => void handleSelfTest()}
              disabled={testProgress !== null}
              title="Rend un signal étalon à travers chaque effet et mesure ce qu'il change"
              className="mt-1 w-full border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-2 py-0.5 font-mono text-[9px] text-[#00F0FF] hover:bg-[#00F0FF]/25 disabled:opacity-40"
            >
              {testProgress ??
                (selfTest
                  ? `Banc : ${selfTest.filter((r) => r.ok).length}/${selfTest.length} OK`
                  : 'Tester tous les effets')}
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------- PATCHES */}
        <FolderRow
          label="PATCHES"
          color={colorOf('patches')}
          open={open.patches}
          count={patches.length}
          onToggle={() => toggle('patches')}
        />
        {open.patches && (
          <div className="ml-2 space-y-0.5 border-l border-[#22222E] pl-2">
            <div className="flex gap-1 py-0.5">
              <input
                value={patchName}
                onChange={(e) => setPatchName(e.target.value)}
                placeholder="Nom du patch"
                className="min-w-0 flex-1 border border-[#2A2934] bg-[#11121A] px-1.5 py-0.5 text-[10px] text-[#EDEDEE] placeholder:text-[#55556A]"
              />
              <button
                onClick={() => void handleSavePatch()}
                className="border border-[#10B981]/50 bg-[#10B981]/10 px-2 text-[10px] font-bold text-[#10B981] hover:bg-[#10B981]/25"
              >
                OK
              </button>
            </div>
            {patches.length === 0 ? (
              <p className="px-1 text-[9px] text-[#77778A]">Aucun patch enregistré.</p>
            ) : (
              patches.map((patch) => (
                <div key={patch.id} className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <LeafRow
                      label={patch.name}
                      title="Charger ce patch dans la chaîne"
                      onClick={() => {
                        importJson(JSON.stringify(patch.state));
                        toast.success(`Patch « ${patch.name} » chargé.`);
                      }}
                    />
                  </div>
                  <button
                    onClick={() => void deleteRackPatch(patch.id).then(setPatches)}
                    title="Supprimer"
                    className="shrink-0 text-[#55556A] hover:text-[#EF4444]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ------------------------------------------------------ ARPÉGIATEUR */}
        <FolderRow
          label="ARPÉGIATEUR"
          color={colorOf('arp')}
          open={open.arp}
          onToggle={() => toggle('arp')}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              drivers.setArpOn(!drivers.arpOn);
            }}
            title="L'arpégiateur joue les notes tenues au clavier"
            className={`border px-1.5 py-0.5 font-pixel text-[8px] ${
              drivers.arpOn
                ? 'border-[#FFE600] bg-[#FFE600]/20 text-[#FFE600]'
                : 'border-[#2A2934] text-[#77778A] hover:border-[#3A3A4A]'
            }`}
          >
            {drivers.arpOn ? 'ON' : 'OFF'}
          </button>
        </FolderRow>
        {open.arp && (
          <div className="ml-2 space-y-1 border-l border-[#22222E] p-1 pl-2">
            <p className="text-[9px] leading-snug text-[#77778A]">
              Tiens des notes au clavier : elles sont jouées l'une après l'autre.
            </p>
            <div className="flex flex-wrap gap-0.5">
              {(['up', 'down', 'updown', 'random', 'chord'] as ArpMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => drivers.setArpMode(mode)}
                  className={`border px-1.5 py-0.5 text-[9px] ${
                    drivers.arpMode === mode
                      ? 'border-[#FFE600] bg-[#FFE600]/20 text-[#FFE600]'
                      : 'border-[#2A2934] text-[#A5A5B5] hover:border-[#3A3A4A]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1 text-[9px] text-[#A5A5B5]">
              Octaves
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                value={drivers.arpOctaves}
                onChange={(e) => drivers.setArpOctaves(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-3 text-right font-mono">{drivers.arpOctaves}</span>
            </label>
          </div>
        )}

        {/* ------------------------------------------------------- SÉQUENCEUR */}
        <FolderRow
          label="SÉQUENCEUR"
          color={colorOf('seq')}
          open={open.seq}
          count={drivers.pattern.filter((s) => s.on).length}
          onToggle={() => toggle('seq')}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              drivers.setSeqOn(!drivers.seqOn);
            }}
            title="Joue le motif en boucle"
            className={`border px-1.5 py-0.5 font-pixel text-[8px] ${
              drivers.seqOn
                ? 'border-[#FF7A00] bg-[#FF7A00]/20 text-[#FF7A00]'
                : 'border-[#2A2934] text-[#77778A] hover:border-[#3A3A4A]'
            }`}
          >
            {drivers.seqOn ? 'ON' : 'OFF'}
          </button>
        </FolderRow>
        {open.seq && (
          <div className="ml-2 space-y-1 border-l border-[#22222E] p-1 pl-2">
            <div className="grid grid-cols-8 gap-0.5">
              {drivers.pattern.slice(0, STEP_COUNT).map((step, i) => (
                <button
                  key={i}
                  onClick={() => drivers.toggleStep(i)}
                  title={`Pas ${i + 1}`}
                  className={`h-5 border text-[8px] ${
                    drivers.currentStep === i
                      ? 'border-[#FFE600] bg-[#FFE600] text-black'
                      : step.on
                        ? 'border-[#FF7A00] bg-[#FF7A00]/40 text-[#FFD0A0]'
                        : 'border-[#22222E] bg-[#0E0E14] text-[#44444F]'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1 text-[9px] text-[#A5A5B5]">
              Tempo
              <input
                type="range"
                min={40}
                max={220}
                step={1}
                value={drivers.bpm}
                onChange={(e) => drivers.setBpm(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-7 text-right font-mono">{drivers.bpm}</span>
            </label>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ CHAÎNE */}
      <div className="max-h-[45%] shrink-0 overflow-y-auto border-t-2 border-[#1E1E28] bg-[#08080C]">
        <div className="sticky top-0 flex items-center gap-1 border-b border-[#1A1A26] bg-[#101016] px-2 py-1">
          <span className="font-pixel text-[9px] tracking-wider text-[#EDEDEE]">CHAÎNE</span>
          {enabledCount > 0 && (
            <span className="font-pixel text-[8px] text-[#77778A]">{enabledCount} actif(s)</span>
          )}
          <button
            onClick={live.toggle}
            disabled={live.isSilent}
            title={live.isSilent ? 'Choisis un sample ou ajoute un moteur' : 'Écouter la chaîne'}
            className="ml-auto flex items-center gap-1 border border-[#00F0FF]/50 bg-[#00F0FF]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#00F0FF] hover:bg-[#00F0FF]/25 disabled:opacity-30"
          >
            {live.isPlaying ? <Square className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
          </button>
          <button
            onClick={() => live.setLoop(!live.loop)}
            title="Boucler l'écoute"
            className={`border px-1 py-0.5 ${
              live.loop
                ? 'border-[#FFE600] bg-[#FFE600]/20 text-[#FFE600]'
                : 'border-[#2A2934] text-[#77778A] hover:border-[#3A3A4A]'
            }`}
          >
            <Repeat className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={() => void handleSaveAsNew()}
            disabled={isRendering || live.isSilent}
            title="Rendre la chaîne dans un nouveau sample"
            className="border border-[#10B981]/50 bg-[#10B981]/10 px-1 py-0.5 text-[#10B981] hover:bg-[#10B981]/25 disabled:opacity-30"
          >
            <Save className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={resetRack}
            title="Vider la chaîne"
            className="border border-[#2A2934] px-1 py-0.5 text-[#77778A] hover:border-[#EF4444] hover:text-[#EF4444]"
          >
            <RotateCcw className="h-2.5 w-2.5" />
          </button>
        </div>

        {rack.modules.length === 0 ? (
          <p className="p-2 text-[10px] leading-snug text-[#77778A]">
            Chaîne vide. Ouvre MOTEURS ou EFFETS et clique ce que tu veux ajouter.
          </p>
        ) : (
          <div className="space-y-1 p-1">
            {rack.modules.map((m) => {
              const def = palette.find((d) => d.type === m.type);
              if (!def) return null;
              return (
                <RackModulePanel
                  key={m.id}
                  def={def}
                  params={m.params}
                  enabled={m.enabled}
                  onParam={(key, value) => setParams(m.id, { [key]: value })}
                  onToggle={() => toggleModule(m.id)}
                  onRemove={() => removeModule(m.id)}
                  onMove={(dir) => moveModule(m.id, dir)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
