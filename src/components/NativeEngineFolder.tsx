/**
 * One compiled engine in the workshop column: a folder that loads its firmware
 * the first time it is opened, then lists the models it holds.
 *
 * These are not part of the bundle. Plaits and Rings are Mutable Instruments'
 * own code compiled to WebAssembly (see tools/build-engine.sh), a few hundred
 * kilobytes each, fetched only when someone asks for them — which is why the
 * folder shows an arrow until it has been opened once.
 *
 * Picking a model renders it onto the wave, which is where the rest of the app
 * already knows how to work on a sound.
 */
import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { loadEngineBridge, type EngineBridge, type NativeEngineId } from '../services/engineBridge';
import { toast } from '../stores/toastStore';

export interface NativeEngineFolderProps {
  id: NativeEngineId;
  label: string;
  /** MIDI note to render at — the keyboard's current octave. */
  note: number;
  /**
   * The sound currently on the wave. Engines that transform rather than make
   * sound work on this; without one they have nothing to do.
   */
  sampleBuffer?: AudioBuffer;
  /** How long a model is rendered for, in seconds. */
  seconds?: number;
  /** Hand the rendered buffer over; the column turns it into a sample. */
  onRendered: (engineId: NativeEngineId, modelName: string, buffer: AudioBuffer) => void;
}

export const NativeEngineFolder: React.FC<NativeEngineFolderProps> = ({
  id,
  label,
  note,
  sampleBuffer,
  seconds = 2,
  onRendered,
}) => {
  const [bridge, setBridge] = useState<EngineBridge | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    setOpen((was) => !was);
    if (bridge) return;
    setBusy(true);
    try {
      setBridge(await loadEngineBridge(id));
    } catch (error) {
      console.error(`Moteur ${id} indisponible`, error);
      toast.error(`${label} n'est pas compilé pour cette version (tools/build-engine.sh).`);
    } finally {
      setBusy(false);
    }
  }, [bridge, id, label]);

  /** Engines that transform a sound need one on the wave to work from. */
  const isProcessor = Boolean(bridge?.process);

  /** Each engine names its model parameter differently; the list is the same. */
  const modelParam = id === 'mutable-plaits' ? 'engine' : 'model';

  const runModel = useCallback(
    async (index: number) => {
      if (!bridge) return;
      const name = bridge.models?.[index] ?? `modele-${index}`;
      if (bridge.process && !sampleBuffer) {
        toast.info(`${label} transforme un son : choisis d'abord un sample.`);
        return;
      }
      setBusy(true);
      try {
        bridge.setParameter(modelParam, index);
        const buffer = bridge.process
          ? await bridge.process(sampleBuffer!)
          : await (async () => {
              bridge.noteOn(note, 110);
              const rendered = await bridge.render(seconds, 48000);
              bridge.noteOff(note);
              return rendered;
            })();
        onRendered(id, name, buffer);
      } catch (error) {
        console.error(`Moteur ${id} : traitement impossible`, error);
        toast.error('Le rendu du moteur a échoué.');
      } finally {
        setBusy(false);
      }
    },
    [bridge, id, label, modelParam, note, sampleBuffer, seconds, onRendered]
  );

  return (
    <>
      <button
        onClick={() => void toggle()}
        title={`${label} — chargé à la demande`}
        className="flex w-full items-center gap-1.5 border border-[#A855F7]/30 bg-[#12101A] px-2 py-0.5 text-left text-[#E9D5FF] transition hover:border-[#A855F7] pixel-btn"
      >
        {open ? (
          <ChevronDown className="h-2.5 w-2.5 shrink-0 text-[#A855F7]" />
        ) : (
          <ChevronRight className="h-2.5 w-2.5 shrink-0 text-[#8E8E93]" />
        )}
        <span className="truncate text-[10px]">{label}</span>
        <span className="ml-auto font-pixel text-[8px] text-[#77778A]">
          {busy ? '…' : bridge ? String(bridge.models?.length ?? 0) : '↓'}
        </span>
      </button>
      {open && bridge && (
        <div className="ml-2 space-y-0.5 border-l border-[#2A2438] pl-2">
          {(bridge.models ?? []).map((name, index) => (
            <button
              key={name}
              onClick={() => void runModel(index)}
              disabled={busy}
              title={
                isProcessor
                  ? 'Passer le sample chargé dans ce mode'
                  : `Rendre ${seconds} s de ce modèle sur l'onde`
              }
              className="flex w-full items-center gap-1.5 border border-[#14141E] bg-[#0A0A0F] px-2 py-0.5 text-left text-[#A5A5B5] transition hover:border-[#222230] hover:text-[#00F0FF] disabled:opacity-40 pixel-btn"
            >
              <span className="text-[9px] text-[#8E8E93]">•</span>
              <span className="truncate text-[10px]">{name}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
};
