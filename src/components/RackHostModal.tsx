import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Play, Pause, Save, RotateCcw, Repeat } from 'lucide-react';
import { SampleItem } from '../types/sample';
import { audioGraph } from '../services/audioGraph';
import { audioBufferToWavBlob } from '../services/audioConverter';
import { calculateAudioMetrics } from '../services/audioAnalyzer';
import { Rack, renderRackOffline } from '../rack/Rack';
import { listModuleDefs } from '../rack/registry';
import { registerBuiltinModules } from '../rack/modules';
import { RackModulePanel } from '../rack/RackModulePanel';
import { useRackStore } from '../stores/rackStore';
import type { ParamValues, RackState } from '../rack/types';

registerBuiltinModules();

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
  const reset = useRackStore((s) => s.reset);
  const exportJson = useRackStore((s) => s.exportJson);
  const importJson = useRackStore((s) => s.importJson);

  const rackRef = useRef<Rack | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const lastStructRef = useRef('');
  const lastParamsRef = useRef<Record<string, ParamValues>>({});

  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [jsonText, setJsonText] = useState('');

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
    srcRef.current = src;
    setIsPlaying(true);
  }, [sample, loop, stopAudition]);

  // Build a live Rack on the shared context while the modal is open.
  useEffect(() => {
    if (!isOpen) return;
    const r = new Rack(audioGraph.getContext());
    r.output.connect(audioGraph.getMasterInput());
    rackRef.current = r;
    lastStructRef.current = '';
    lastParamsRef.current = {};

    const state = useRackStore.getState().rack;
    void r.setState(state).then(() => {
      lastStructRef.current = structureKey(state);
      lastParamsRef.current = Object.fromEntries(
        state.modules.map((m) => [m.id, { ...m.params }])
      );
    });

    return () => {
      stopAudition();
      r.dispose();
      rackRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reflect store changes: rebuild on structural change, live-patch params otherwise.
  useEffect(() => {
    const r = rackRef.current;
    if (!r || !isOpen) return;

    const nextStruct = structureKey(rack);
    if (nextStruct !== lastStructRef.current) {
      lastStructRef.current = nextStruct;
      void r.setState(rack).then(() => {
        lastParamsRef.current = Object.fromEntries(
          rack.modules.map((m) => [m.id, { ...m.params }])
        );
      });
      return;
    }

    for (const m of rack.modules) {
      const prev = lastParamsRef.current[m.id];
      if (!prev) continue;
      const changed: ParamValues = {};
      for (const key of Object.keys(m.params)) {
        if (m.params[key] !== prev[key]) changed[key] = m.params[key];
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
      const rendered = await renderRackOffline(rack, sample.audioBuffer, hasDelay ? 2 : 0);
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

  if (!isOpen) return null;

  const palette = listModuleDefs();
  const families = [...new Set(palette.map((d) => d.family))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md">
      <div className="relative flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border-2 border-[#A855F7]/50 bg-[#07070E]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#202034] bg-[#0E0E1A] px-4 py-2.5">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Rack Modulaire <span className="text-[#A855F7]">bêta</span>
            </h2>
            <p className="max-w-md truncate font-mono text-[11px] text-[#8E8E98]">
              {sample ? sample.name : 'Aucun sample sélectionné'}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            <button
              onClick={() => {
                stopAudition();
                onClose();
              }}
              className="rounded border border-[#2C2C40] bg-[#1A1A2A] p-1.5 text-[#8E8E98] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-56 shrink-0 overflow-y-auto border-r border-[#202034] bg-[#0A0A16] p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#A855F7]">
              Modules
            </div>
            {families.map((family) => (
              <div key={family} className="mb-3">
                <div className="mb-1 text-[10px] font-bold text-[#77778A]">{family}</div>
                <div className="flex flex-col gap-1">
                  {palette
                    .filter((d) => d.family === family)
                    .map((d) => (
                      <button
                        key={d.type}
                        onClick={() => addModule(d.type)}
                        className="rounded border border-[#2A2934] bg-[#11121A] px-2 py-1.5 text-left text-[11px] hover:border-[#A855F7]"
                      >
                        + {d.label}
                      </button>
                    ))}
                </div>
              </div>
            ))}
            <button
              onClick={reset}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-[#55451D] px-2 py-1 text-[10px] text-[#FFE08A]"
            >
              <RotateCcw className="h-3 w-3" /> Vider le rack
            </button>
          </aside>

          <main className="flex-1 overflow-y-auto bg-[#06060A] p-4">
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
        </div>
      </div>
    </div>
  );
};
