/**
 * The workshop column: everything that used to be a window over the app, now
 * a column beside it.
 *
 * Three separate windows — the effects rack, the synth rack and an "extensions"
 * rack — covered the waveform and the library whenever you wanted to touch a
 * sound, and two of them could be reached from more than one button. They are
 * one column now: effects, engines, patches, slicing and the OP-1 kit, each a
 * section you fold away. The rack it drives is the live one, so a knob moved
 * here is heard on the next block, without leaving the sample you are looking
 * at.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Play, Square, Repeat, Save, RotateCcw, Trash2 } from 'lucide-react';
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

registerBuiltinModules();

type SectionId = 'effects' | 'engines' | 'patches' | 'slicer' | 'op1';

const SECTION_LABELS: Record<SectionId, string> = {
  effects: 'EFFETS',
  engines: 'MOTEURS',
  patches: 'PATCHES',
  slicer: 'DÉCOUPE',
  op1: 'KIT OP-1',
};

const OPEN_KEY = 'resonance-atelier-open-v1';

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

interface SectionProps {
  id: SectionId;
  open: boolean;
  onToggle: (id: SectionId) => void;
  /** Shown next to the title: a count, a state, whatever the section wants. */
  badge?: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ id, open, onToggle, badge, children }) => (
  <div className="border-b border-[#1A1A26]">
    <button
      onClick={() => onToggle(id)}
      className="flex w-full items-center justify-between px-2 py-1.5 text-left hover:bg-[#12121C]"
    >
      <span className="flex items-center gap-1.5">
        {open ? (
          <ChevronDown className="h-3 w-3 text-[#00F0FF]" />
        ) : (
          <ChevronRight className="h-3 w-3 text-[#8E8E93]" />
        )}
        <span className="font-pixel text-[9px] tracking-wider text-[#EDEDEE]">
          {SECTION_LABELS[id]}
        </span>
      </span>
      {badge && (
        <span className="font-pixel text-[8px] text-[#77778A]">{badge}</span>
      )}
    </button>
    {open && <div className="px-2 pb-2">{children}</div>}
  </div>
);

interface AtelierColumnProps {
  sample: SampleItem | null;
  onSaveAsNewSample: (sample: SampleItem) => void;
  onOpenSlicer: (sample: SampleItem) => void;
}

export const AtelierColumn: React.FC<AtelierColumnProps> = ({
  sample,
  onSaveAsNewSample,
  onOpenSlicer,
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

  const [open, setOpen] = useState<Record<SectionId, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null');
      if (saved && typeof saved === 'object') return saved as Record<SectionId, boolean>;
    } catch {
      /* first run */
    }
    return { effects: true, engines: false, patches: false, slicer: false, op1: false };
  });
  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(open));
    } catch {
      /* private mode: the column just forgets which sections were folded */
    }
  }, [open]);
  const toggleSection = useCallback(
    (id: SectionId) => setOpen((prev) => ({ ...prev, [id]: !prev[id] })),
    []
  );

  // The chain lives as long as the column does, which is as long as the app.
  const live = useLiveRack(sample?.audioBuffer, true);
  const [isRendering, setIsRendering] = useState(false);

  // The space bar drives the rack while its section is open; folded away, it
  // goes back to auditioning the library selection.
  useAudition('Rack (atelier)', live.toggle, open.effects && !live.isSilent);

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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0A0A0F] border-l-2 border-[#1E1E28]">
      <div className="flex items-center justify-between border-b-2 border-[#1E1E28] bg-[#101016] px-2 py-1.5">
        <span className="font-pixel text-[10px] tracking-wider text-[#00F0FF]">ATELIER</span>
        <span className="font-pixel text-[8px] text-[#77778A]">
          {sample ? sample.name.slice(0, 18) : 'aucun sample'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* ---------------------------------------------------------- EFFETS */}
        <Section
          id="effects"
          open={open.effects}
          onToggle={toggleSection}
          badge={enabledCount > 0 ? `${enabledCount} actif${enabledCount > 1 ? 's' : ''}` : undefined}
        >
          <div className="mb-2 flex items-center gap-1">
            <button
              onClick={live.toggle}
              disabled={live.isSilent}
              title={live.isSilent ? 'Choisis un sample ou ajoute un moteur' : 'Écouter la chaîne'}
              className="flex items-center gap-1 rounded border border-[#00F0FF]/50 bg-[#00F0FF]/10 px-2 py-1 font-mono text-[10px] font-bold text-[#00F0FF] hover:bg-[#00F0FF]/25 disabled:opacity-30"
            >
              {live.isPlaying ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {live.isPlaying ? 'STOP' : 'PLAY'}
            </button>
            <button
              onClick={() => live.setLoop(!live.loop)}
              title="Boucler l'écoute"
              className={`rounded border px-1.5 py-1 ${
                live.loop
                  ? 'border-[#FFE600] bg-[#FFE600]/20 text-[#FFE600]'
                  : 'border-[#2A2934] text-[#77778A] hover:border-[#3A3A4A]'
              }`}
            >
              <Repeat className="h-3 w-3" />
            </button>
            <button
              onClick={() => void handleSaveAsNew()}
              disabled={isRendering || live.isSilent}
              title="Rendre la chaîne dans un nouveau sample"
              className="ml-auto rounded border border-[#10B981]/50 bg-[#10B981]/10 px-1.5 py-1 text-[#10B981] hover:bg-[#10B981]/25 disabled:opacity-30"
            >
              <Save className="h-3 w-3" />
            </button>
            <button
              onClick={resetRack}
              title="Vider la chaîne"
              className="rounded border border-[#2A2934] px-1.5 py-1 text-[#77778A] hover:border-[#EF4444] hover:text-[#EF4444]"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          {/* The chain, one card per row: the column is narrow on purpose. */}
          {rack.modules.length === 0 ? (
            <p className="rounded border border-dashed border-[#202036] p-2 text-[10px] leading-snug text-[#77778A]">
              Chaîne vide. Ajoute un effet ci-dessous ; ils se chaînent de haut en bas.
            </p>
          ) : (
            <div className="mb-2 space-y-1">
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

          <details className="mt-2">
            <summary className="cursor-pointer font-pixel text-[8px] uppercase tracking-widest text-[#77778A]">
              Ajouter un effet
            </summary>
            <div className="mt-1">
              {effectFamilies.map((family) => (
                <div key={family} className="mb-1.5">
                  <div className="mb-1 font-mono text-[8px] font-bold uppercase tracking-widest text-[#55556A]">
                    {family}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {effectDefs
                      .filter((d) => d.family === family)
                      .map((d) => (
                        <button
                          key={d.type}
                          onClick={() => addModule(d.type)}
                          title={`Ajouter ${d.label}`}
                          className="truncate rounded border border-[#2A2934] bg-[#11121A] px-1.5 py-1 text-left text-[9px] leading-tight hover:border-[#A855F7] hover:bg-[#17131F]"
                        >
                          {d.label}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </details>

          <details className="mt-1">
            <summary className="cursor-pointer font-pixel text-[8px] uppercase tracking-widest text-[#77778A]">
              Chaînes toutes faites
            </summary>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {RACK_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template.modules)}
                  title={`${template.modules.length} modules`}
                  className="truncate rounded border border-[#2A2934] bg-[#11121A] px-1.5 py-1 text-left text-[9px] hover:border-[#00F0FF]"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </details>
        </Section>

        {/* --------------------------------------------------------- MOTEURS */}
        <Section
          id="engines"
          open={open.engines}
          onToggle={toggleSection}
          badge={live.hasSourceModule ? 'actif' : undefined}
        >
          <p className="mb-1.5 text-[9px] leading-snug text-[#77778A]">
            Un moteur fabrique son propre son : il s’écoute sans charger de sample, et se
            superpose à celui qui est chargé.
          </p>
          <div className="grid grid-cols-2 gap-1">
            {sourceDefs.map((d) => (
              <button
                key={d.type}
                onClick={() => addModule(d.type)}
                title={`Ajouter ${d.label}`}
                className="truncate rounded border border-[#A855F7]/40 bg-[#17131F] px-1.5 py-1 text-left text-[9px] leading-tight text-[#E9D5FF] hover:border-[#A855F7]"
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => openModal('synthRack')}
            className="mt-2 w-full rounded border border-[#A855F7]/50 bg-[#A855F7]/15 px-2 py-1.5 font-pixel text-[9px] text-[#E9D5FF] hover:bg-[#A855F7]/30"
            title="Le Creator : 10 couches, ADSR, clavier et MIDI"
          >
            CREATOR — 10 COUCHES + MIDI
          </button>
        </Section>

        {/* --------------------------------------------------------- PATCHES */}
        <Section
          id="patches"
          open={open.patches}
          onToggle={toggleSection}
          badge={patches.length > 0 ? String(patches.length) : undefined}
        >
          <div className="mb-1.5 flex gap-1">
            <input
              value={patchName}
              onChange={(e) => setPatchName(e.target.value)}
              placeholder="Nom du patch"
              className="min-w-0 flex-1 rounded border border-[#2A2934] bg-[#11121A] px-1.5 py-1 text-[10px] text-[#EDEDEE] placeholder:text-[#55556A]"
            />
            <button
              onClick={() => void handleSavePatch()}
              className="rounded border border-[#10B981]/50 bg-[#10B981]/10 px-2 py-1 text-[10px] font-bold text-[#10B981] hover:bg-[#10B981]/25"
            >
              OK
            </button>
          </div>
          {patches.length === 0 ? (
            <p className="text-[9px] text-[#77778A]">Aucun patch enregistré.</p>
          ) : (
            <div className="space-y-0.5">
              {patches.map((patch) => (
                <div
                  key={patch.id}
                  className="flex items-center gap-1 rounded border border-[#1E1E28] bg-[#0E0E14] px-1.5 py-1"
                >
                  <button
                    onClick={() => {
                      importJson(JSON.stringify(patch.state));
                      toast.success(`Patch « ${patch.name} » chargé.`);
                    }}
                    className="min-w-0 flex-1 truncate text-left text-[10px] text-[#EDEDEE] hover:text-[#00F0FF]"
                    title="Charger ce patch dans la chaîne"
                  >
                    {patch.name}
                  </button>
                  <button
                    onClick={() => void deleteRackPatch(patch.id).then(setPatches)}
                    title="Supprimer"
                    className="text-[#55556A] hover:text-[#EF4444]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* --------------------------------------------------------- DÉCOUPE */}
        <Section id="slicer" open={open.slicer} onToggle={toggleSection}>
          <p className="mb-1.5 text-[9px] leading-snug text-[#77778A]">
            Détection des transitoires, calage sur les passages à zéro, export des tranches.
          </p>
          <button
            onClick={() => sample && onOpenSlicer(sample)}
            disabled={!sample}
            className="w-full rounded border border-[#FF7A00]/50 bg-[#FF7A00]/15 px-2 py-1.5 font-pixel text-[9px] text-[#FFD0A0] hover:bg-[#FF7A00]/30 disabled:opacity-30"
            title={sample ? 'Découper ce sample' : 'Choisis un sample'}
          >
            DÉCOUPER CE SAMPLE
          </button>
        </Section>

        {/* --------------------------------------------------------- KIT OP-1 */}
        <Section id="op1" open={open.op1} onToggle={toggleSection}>
          <p className="mb-1.5 text-[9px] leading-snug text-[#77778A]">
            Assembler plusieurs sons en un patch de batterie OP-1, 24 emplacements.
          </p>
          <button
            onClick={() => openModal('op1Studio')}
            className="w-full rounded border border-[#FF7A00]/50 bg-[#FF7A00]/15 px-2 py-1.5 font-pixel text-[9px] text-[#FFD0A0] hover:bg-[#FF7A00]/30"
          >
            OUVRIR LE STUDIO OP-1
          </button>
        </Section>
      </div>
    </div>
  );
};
