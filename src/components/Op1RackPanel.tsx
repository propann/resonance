import React, { useMemo, useState } from 'react';
import { Play, Square, Repeat, Wand2, Trash2 } from 'lucide-react';
import { listModuleDefs } from '../rack/registry';
import { RackModulePanel } from '../rack/RackModulePanel';
import { RACK_TEMPLATES } from '../rack/templates';
import { useLiveRack } from '../rack/useLiveRack';
import { useRackStore } from '../stores/rackStore';
import { FolderRow, LeafRow, GroupLabel } from './ToolTree';

interface Op1RackPanelProps {
  /** The sound on the pad being worked on, if it has one. */
  padBuffer?: AudioBuffer;
  /** What the pad is called, for the header. */
  padLabel: string;
  /** Hand the processed sound back to the pad. */
  onApplyToPad: (processed: AudioBuffer) => void;
  /** The window is in front — only then does this rack make sound. */
  active: boolean;
}

/**
 * The effects rack, inside the window where kits are built.
 *
 * It is the same rack as the workshop column's — one chain, one store — so a
 * chain built in either place is the chain the other sees. Only one of them
 * may sound at a time, which is what `active` settles: the column goes quiet
 * while this window is in front.
 *
 * The tree is drawn with the same folder rows as everywhere else, so knowing
 * the workshop column means knowing this.
 */
export const Op1RackPanel: React.FC<Op1RackPanelProps> = ({
  padBuffer,
  padLabel,
  onApplyToPad,
  active,
}) => {
  const rack = useRackStore((s) => s.rack);
  const addModule = useRackStore((s) => s.addModule);
  const removeModule = useRackStore((s) => s.removeModule);
  const applyTemplate = useRackStore((s) => s.applyTemplate);
  const resetRack = useRackStore((s) => s.reset);
  const live = useLiveRack(padBuffer, active);

  const [openEffects, setOpenEffects] = useState(true);
  const [isApplying, setIsApplying] = useState(false);

  const effectDefs = useMemo(() => listModuleDefs().filter((d) => d.kind !== 'source'), []);
  const families = useMemo(
    () => [...new Set(effectDefs.map((d) => d.family))],
    [effectDefs]
  );

  const applyToPad = async () => {
    if (!padBuffer || rack.modules.length === 0) return;
    setIsApplying(true);
    try {
      const processed = await live.render();
      if (processed) onApplyToPad(processed);
    } finally {
      setIsApplying(false);
    }
  };

  const canApply = Boolean(padBuffer) && rack.modules.length > 0 && !isApplying;

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="font-pixel text-[9px] tracking-tight text-[#8A8F9E]">
          RACK · {padLabel}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={live.toggle}
            disabled={live.isSilent}
            title={live.isSilent ? 'Choisis un pad qui a un son' : 'Écouter la chaîne'}
            className="border border-[#2A2A38] bg-[#12121A] px-1.5 py-0.5 text-[#00F0FF] disabled:opacity-30"
          >
            {live.isPlaying ? <Square className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
          </button>
          <button
            onClick={() => live.setLoop(!live.loop)}
            title="Boucler l'écoute"
            className={`border px-1.5 py-0.5 ${
              live.loop
                ? 'border-[#FFE600] bg-[#FFE600]/15 text-[#FFE600]'
                : 'border-[#2A2A38] bg-[#12121A] text-[#8A8F9E]'
            }`}
          >
            <Repeat className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      <FolderRow
        label="EFFETS"
        color="#00F0FF"
        open={openEffects}
        count={effectDefs.length}
        onToggle={() => setOpenEffects((v) => !v)}
      />

      {openEffects && (
        <div className="ml-2 max-h-48 space-y-0.5 overflow-y-auto border-l border-[#22222E] pl-2 custom-scrollbar">
          {families.map((family) => (
            <div key={family}>
              <GroupLabel>{family}</GroupLabel>
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
          <GroupLabel>Chaînes toutes faites</GroupLabel>
          {RACK_TEMPLATES.map((template) => (
            <LeafRow
              key={template.id}
              label={template.label}
              title={`${template.modules.length} modules`}
              onClick={() => applyTemplate(template.modules)}
            />
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto custom-scrollbar">
        {rack.modules.length === 0 ? (
          <p className="px-1 py-2 font-mono text-[9px] leading-relaxed text-[#55556A]">
            Chaîne vide. Ouvre EFFETS et clique ce que tu veux ajouter — le résultat
            se pose sur le pad choisi.
          </p>
        ) : (
          rack.modules.map((module) => (
            <RackModulePanel key={module.id} module={module} onRemove={() => removeModule(module.id)} />
          ))
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => void applyToPad()}
          disabled={!canApply}
          title={
            !padBuffer
              ? 'Ce pad n’a pas de son'
              : rack.modules.length === 0
                ? 'Ajoute au moins un effet'
                : 'Rendre la chaîne et la poser sur le pad'
          }
          className="flex flex-1 items-center justify-center gap-1.5 border border-[#FF5E00] bg-[#FF5E00]/15 px-2 py-1 font-pixel text-[9px] text-[#FF5E00] transition hover:bg-[#FF5E00]/30 disabled:opacity-30"
        >
          <Wand2 className="h-2.5 w-2.5" />
          {isApplying ? 'RENDU…' : 'APPLIQUER AU PAD'}
        </button>
        <button
          onClick={resetRack}
          disabled={rack.modules.length === 0}
          title="Vider la chaîne"
          className="border border-[#2A2A38] bg-[#12121A] px-1.5 py-1 text-[#8A8F9E] disabled:opacity-30"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
};
