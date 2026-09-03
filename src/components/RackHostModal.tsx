import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Save, RotateCcw, Repeat, Sliders } from 'lucide-react';
import { SampleItem } from '../types/sample';
import { Modal } from './Modal';
import { audioGraph } from '../services/audioGraph';
import { audioBufferToWavBlob } from '../services/audioConverter';
import { calculateAudioMetrics } from '../services/audioAnalyzer';
import { Rack, renderRackOffline } from '../rack/Rack';
import { listModuleDefs } from '../rack/registry';
import { registerBuiltinModules } from '../rack/modules';
import { RackModulePanel } from '../rack/RackModulePanel';
import { RACK_TEMPLATES } from '../rack/templates';
import { useRackStore } from '../stores/rackStore';
import type { ParamValues, RackState } from '../rack/types';
import { RackWaveformStrip, type WaveRegion } from './waveform/RackWaveformStrip';

registerBuiltinModules();

/** Keep only [start,end] (0..1 fractions) of a rendered buffer. */
function sliceRegion(buf: AudioBuffer, r: WaveRegion): AudioBuffer {
  if (r.start <= 0.0005 && r.end >= 0.9995) return buf;
  const a = Math.max(0, Math.floor(r.start * buf.length));
  const b = Math.min(buf.length, Math.floor(r.end * buf.length));
  const len = Math.max(1, b - a);
  const out = new AudioBuffer({
    length: len,
    numberOfChannels: buf.numberOfChannels,
    sampleRate: buf.sampleRate,
  });
  for (let c = 0; c < buf.numberOfChannels; c++) {
    out.copyToChannel(buf.getChannelData(c).subarray(a, b), c);
  }
  return out;
}

interface RackHostModalProps {
  isOpen: boolean;
  onClose: () => void;
  sample: SampleItem | null;
  onSaveAsNewSample: (sample: SampleItem) => void;
}

function structureKey(state: RackState): string {
  return state.modules.map((m) => `${m.id}:${m.type}:${m.enabled ? 1 : 0}`).join('|');
}

export const RackHostModal: React.FC<RackHostModalProps> = ({
  isOpen,
  onClose,
  sample,
  onSaveAsNewSample,
}) => {
  const rack = useRackStore((s) => s.rack);
  const addModule = useRackStore((s) => s.addModule);
  const removeModule = useRackStore((s) => s.removeModule);
  const toggleModule = useRackStore((s) => s.toggleModule);
  const moveModule = useRackStore((s) => s.moveModule);
  const setParams = useRackStore((s) => s.setParams);
  const applyTemplate = useRackStore((s) => s.applyTemplate);
  const reset = useRackStore((s) => s.reset);
  const exportJson = useRackStore((s) => s.exportJson);
  const importJson = useRackStore((s) => s.importJson);

  const rackRef = useRef<Rack | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const lastStructRef = useRef<string | null>(null);
  const lastParamsRef = useRef<Record<string, ParamValues>>({});
  // Serialises rack rebuilds so overlapping setState() calls can't race.
  const syncChainRef = useRef<Promise<void>>(Promise.resolve());

  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [jsonText, setJsonText] = useState('');

  // Waveform-editor state
  const [region, setRegion] = useState<WaveRegion>({ start: 0, end: 1 });
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const previewTokenRef = useRef(0);
  const playStartRef = useRef(0);

  const activeFamilies = useMemo(() => {
    const defs = listModuleDefs();
    return rack.modules
      .filter((m) => m.enabled)
      .map((m) => defs.find((d) => d.type === m.type)?.family)
      .filter((f): f is string => !!f);
  }, [rack.modules]);

  const stopAudition = useCallback(() => {
    if (srcRef.current) {
      try {
        srcRef.current.onended = null;
        srcRef.current.stop();
        srcRef.current.disconnect();
      } catch {
        /* already stopped */
      }
      srcRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startAudition = useCallback(() => {
    const r = rackRef.current;
    if (!r || !sample?.audioBuffer) return;
    stopAudition();
    const ctx = audioGraph.getContext();
    const src = ctx.createBufferSource();
    src.buffer = sample.audioBuffer;
    src.loop = loop;
    src.connect(r.input);
    src.onended = () => {
      if (srcRef.current === src) {
        srcRef.current = null;
        setIsPlaying(false);
      }
    };
    src.start();
    playStartRef.current = ctx.currentTime;
    srcRef.current = src;
    setIsPlaying(true);
  }, [sample, loop, stopAudition]);

  // Create / dispose the live Rack while the modal is open. It is left empty
  // here — the sync effect below does the initial build.
  useEffect(() => {
    if (!isOpen) return;
    const r = new Rack(audioGraph.getContext());
    r.output.connect(audioGraph.getMasterInput());
    rackRef.current = r;
    lastStructRef.current = null;
    lastParamsRef.current = {};
    syncChainRef.current = Promise.resolve();
    setRegion({ start: 0, end: 1 });
    setProcessedBuffer(null);

    return () => {
      stopAudition();
      r.dispose();
      rackRef.current = null;
    };
  }, [isOpen, stopAudition]);

  // Offline-render the rack output so the strip can show the processed wave.
  // Debounced — a slider drag shouldn't fire a bounce per frame.
  useEffect(() => {
    if (!isOpen || !sample?.audioBuffer) {
      setProcessedBuffer(null);
      setPreviewPending(false);
      return;
    }
    if (rack.modules.filter((m) => m.enabled).length === 0) {
      setProcessedBuffer(null);
      setPreviewPending(false);
      return;
    }
    const token = ++previewTokenRef.current;
    setPreviewPending(true);
    const timer = setTimeout(() => {
      const hasTail = rack.modules.some(
        (m) => m.enabled && (m.type === 'fx.delay' || m.type === 'fx.reverb')
      );
      renderRackOffline(rack, sample.audioBuffer!, hasTail ? 1.5 : 0)
        .then((out) => {
          if (token === previewTokenRef.current) setProcessedBuffer(out);
        })
        .catch((error) => console.error('[rack] preview render failed', error))
        .finally(() => {
          if (token === previewTokenRef.current) setPreviewPending(false);
        });
    }, 450);
    return () => clearTimeout(timer);
  }, [rack, isOpen, sample]);

  // Advance the strip playhead while auditioning.
  useEffect(() => {
    if (!isPlaying || !sample?.audioBuffer) {
      setPlayhead(null);
      return;
    }
    const dur = sample.audioBuffer.duration || 1;
    let raf = 0;
    const tick = () => {
      const elapsed = (audioGraph.getContext().currentTime - playStartRef.current) % dur;
      setPlayhead(elapsed / dur);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, sample]);

  // Keep the live Rack in sync with the store: rebuild the chain on a
  // structural change (add / remove / reorder / enable), otherwise patch the
  // changed parameters in place — no rebuild, no audio gap.
  useEffect(() => {
    const r = rackRef.current;
    if (!r || !isOpen) return;

    const nextStruct = structureKey(rack);
    if (nextStruct !== lastStructRef.current) {
      lastStructRef.current = nextStruct;
      const snapshot = rack;
      syncChainRef.current = syncChainRef.current
        .then(() => r.setState(snapshot))
        .then(() => {
          // Re-apply whatever the store holds *now* — params may have been
          // dragged while the async rebuild was in flight.
          const current = useRackStore.getState().rack;
          const next: Record<string, ParamValues> = {};
          for (const m of current.modules) {
            r.updateModuleParams(m.id, m.params);
            next[m.id] = { ...m.params };
          }
          lastParamsRef.current = next;
        })
        .catch((error) => console.error('[rack] sync failed', error));
      return;
    }

    for (const m of rack.modules) {
      const prev = lastParamsRef.current[m.id];
      const changed: ParamValues = {};
      for (const key of Object.keys(m.params)) {
        if (!prev || m.params[key] !== prev[key]) changed[key] = m.params[key];
      }
      if (Object.keys(changed).length > 0) r.updateModuleParams(m.id, changed);
      lastParamsRef.current[m.id] = { ...m.params };
    }
  }, [rack, isOpen]);

  const togglePlay = () => (isPlaying ? stopAudition() : startAudition());

  const handleSaveAsNew = async () => {
    if (!sample?.audioBuffer) return;
    setIsRendering(true);
    try {
      const hasDelay = rack.modules.some((m) => m.enabled && m.type === 'fx.delay');
      const full = await renderRackOffline(rack, sample.audioBuffer, hasDelay ? 2 : 0);
      const rendered = sliceRegion(full, region);
      const blob = audioBufferToWavBlob(rendered, { bitDepth: 24, normalize: false });
      const metrics = calculateAudioMetrics(rendered);
      onSaveAsNewSample({
        ...sample,
        id: `rack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${sample.name.replace(/\.[^/.]+$/, '')}_RACK`,
        originalFileName: sample.originalFileName || sample.name,
        audioBuffer: rendered,
        blobUrl: URL.createObjectURL(blob),
        size: blob.size,
        duration: rendered.duration,
        sampleRate: rendered.sampleRate,
        channels: rendered.numberOfChannels,
        format: 'wav',
        tags: Array.from(new Set([...(sample.tags || []), 'rack', 'processed'])),
        spectralCentroid: metrics.spectralCentroid,
        dynamicRangeDb: metrics.dynamicRangeDb,
        peakDb: metrics.peakDb,
        rmsDb: metrics.rmsDb,
        lufs: metrics.lufs,
        loudnessGainDb: 0,
        zeroCrossingRate: metrics.zeroCrossingRate,
        dateAdded: Date.now(),
      });
      stopAudition();
      onClose();
    } catch (error) {
      console.error('Rendu du rack impossible', error);
    } finally {
      setIsRendering(false);
    }
  };

  const palette = listModuleDefs();
  const families = [...new Set(palette.map((d) => d.family))];

  return (
    <Modal
      open={isOpen}
      onClose={() => {
        stopAudition();
        onClose();
      }}
      size="full"
      accent="#A855F7"
      icon={<Sliders className="h-5 w-5" />}
      title="Rack Modulaire"
      subtitle={sample ? sample.name : 'Aucun sample sélectionné'}
      bodyClassName="flex overflow-hidden"
      headerRight={
        <>
          <button
            onClick={togglePlay}
            disabled={!sample?.audioBuffer}
            className={`flex items-center gap-1.5 rounded px-4 py-1.5 font-mono text-xs font-bold disabled:opacity-40 ${
              isPlaying ? 'bg-[#EF4444] text-white' : 'bg-[#00F0FF] text-black'
            }`}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
            {isPlaying ? 'STOP' : 'ÉCOUTER'}
          </button>
          <button
            onClick={() => setLoop((v) => !v)}
            className={`rounded border px-2 py-1.5 text-xs ${
              loop ? 'border-[#00F0FF] text-[#00F0FF]' : 'border-[#303046] text-[#8E8E98]'
            }`}
            title="Boucle"
          >
            <Repeat className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => void handleSaveAsNew()}
            disabled={!sample?.audioBuffer || isRendering}
            className="flex items-center gap-1.5 rounded bg-[#10B981] px-3 py-1.5 font-mono text-xs font-bold text-black disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            {isRendering ? 'RENDU…' : 'ENREGISTRER SAMPLE'}
          </button>
        </>
      }
    >
      <>
        <aside className="flex w-52 min-h-0 shrink-0 flex-col border-r border-[#202034] bg-[#0A0A16]">
          <div className="shrink-0 space-y-2 border-b border-[#1A1A28] p-2.5">
            <select
              defaultValue=""
              onChange={(e) => {
                const tpl = RACK_TEMPLATES.find((t) => t.id === e.target.value);
                if (tpl) applyTemplate(tpl.modules);
                e.currentTarget.value = '';
              }}
              className="w-full rounded border border-[#303046] bg-[#161724] px-1 py-1 text-[11px]"
            >
              <option value="">Charger un template…</option>
              {RACK_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              onClick={reset}
              className="flex w-full items-center justify-center gap-1 rounded border border-[#55451D] px-2 py-1 text-[10px] text-[#FFE08A]"
            >
              <RotateCcw className="h-3 w-3" /> Vider le rack
            </button>
          </div>
          {/* the module palette — scrolls independently, compact 2-up grid */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {families.map((family) => (
              <div key={family} className="mb-2">
                <div className="mb-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#77778A]">
                  {family}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {palette
                    .filter((d) => d.family === family)
                    .map((d) => (
                      <button
                        key={d.type}
                        onClick={() => addModule(d.type)}
                        title={`Ajouter ${d.label}`}
                        className="truncate rounded border border-[#2A2934] bg-[#11121A] px-1.5 py-1 text-left text-[10px] leading-tight hover:border-[#A855F7] hover:bg-[#17131F]"
                      >
                        {d.label}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#06060A] p-4">
            {sample?.audioBuffer && (
              <div className="mb-3">
                <RackWaveformStrip
                  source={sample.audioBuffer}
                  processed={processedBuffer}
                  activeFamilies={activeFamilies}
                  region={region}
                  onRegionChange={setRegion}
                  playhead={playhead}
                  isRendering={previewPending}
                />
              </div>
            )}
            {rack.modules.length === 0 ? (
              <div className="mx-auto mt-16 max-w-md rounded-lg border-2 border-dashed border-[#202036] p-6 text-center text-xs text-[#8E8E98]">
                Ajoute des modules depuis la colonne de gauche. Ils se chaînent de haut en bas,
                de l'entrée vers la sortie.
              </div>
            ) : (
              <div className="space-y-2">
                {rack.modules.map((m) => {
                  const def = listModuleDefs().find((d) => d.type === m.type);
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

            <details className="mt-4 rounded border border-[#202034] bg-[#0A0A16] p-3 text-[11px]">
              <summary className="cursor-pointer text-[#8E8E98]">Template JSON</summary>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{"version":1,"modules":[…]}'
                className="mt-2 h-28 w-full rounded border border-[#303046] bg-[#111119] p-2 font-mono text-[10px]"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setJsonText(exportJson())}
                  className="rounded border border-[#303046] px-2 py-1"
                >
                  Exporter le rack actuel
                </button>
                <button
                  onClick={() => {
                    if (!importJson(jsonText)) console.warn('JSON de rack invalide');
                  }}
                  className="rounded bg-[#A855F7] px-2 py-1 font-bold text-black"
                >
                  Charger
                </button>
              </div>
            </details>
        </main>
      </>
    </Modal>
  );
};
