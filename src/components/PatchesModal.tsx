import React, { useEffect, useState } from 'react';
import { Bookmark, Check, Pencil, Save, Trash2, Wand2, X } from 'lucide-react';
import { Modal } from './Modal';
import { usePatchStore } from '../stores/patchStore';
import { useRackStore } from '../stores/rackStore';
import { getModuleDef } from '../rack/registry';

interface PatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Open the rack window on the current sample, after loading a patch. */
  onOpenRack?: () => void;
}

const formatDate = (ms: number) =>
  new Date(ms).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/** Human summary of a chain: "Filter · Reverb · Gain". */
const describe = (types: string[]): string =>
  types
    .map((type) => getModuleDef(type)?.label ?? type)
    .join(' · ') || 'Chaîne vide';

/**
 * Save, name and recall rack patches. The menu bar lists the patches for a
 * one-click load; this window is where they are named, renamed and deleted.
 */
export const PatchesModal: React.FC<PatchesModalProps> = ({ isOpen, onClose, onOpenRack }) => {
  const patches = usePatchStore((s) => s.patches);
  const refresh = usePatchStore((s) => s.refresh);
  const saveCurrent = usePatchStore((s) => s.saveCurrent);
  const renamePatch = usePatchStore((s) => s.rename);
  const removePatch = usePatchStore((s) => s.remove);
  const applyPatch = usePatchStore((s) => s.apply);
  const rack = useRackStore((s) => s.rack);

  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen, refresh]);

  const handleSave = async () => {
    await saveCurrent(name);
    setName('');
  };

  const handleLoad = async (id: string) => {
    if (await applyPatch(id)) onOpenRack?.();
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      accent="#A855F7"
      icon={<Bookmark className="h-4 w-4" />}
      title="Patchs du rack"
      subtitle="Enregistrer la chaîne d'effets en cours, la nommer et la rappeler"
    >
      <div className="space-y-4 font-mono text-xs">
        {/* Save the chain that is currently in the rack */}
        <div className="border border-[#A855F7]/40 bg-[#A855F7]/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] text-[#C084FC]">
            <Wand2 className="h-3.5 w-3.5" />
            <span>
              Rack en cours : {rack.modules.length} module(s) —{' '}
              {describe(rack.modules.map((m) => m.type))}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave();
              }}
              placeholder="Nom du patch (ex. Basse chaude 808)"
              className="flex-1 border border-[#3A3A52] bg-[#0B0C12] px-2 py-1.5 text-[#EDEDEE] placeholder:text-[#5A5A68] focus:border-[#A855F7] focus:outline-none"
            />
            <button
              onClick={() => void handleSave()}
              disabled={rack.modules.length === 0}
              className="flex items-center gap-1.5 border border-[#A855F7] bg-[#A855F7] px-3 py-1.5 font-bold text-white transition hover:bg-[#C084FC] disabled:opacity-40"
              title="Enregistrer le rack en cours sous ce nom (un même nom remplace le patch)"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Enregistrer</span>
            </button>
          </div>
        </div>

        {/* Saved patches */}
        {patches.length === 0 ? (
          <p className="py-6 text-center text-[#8E8E98]">
            Aucun patch enregistré. Construisez une chaîne dans le rack, puis donnez-lui un nom
            ci-dessus — elle apparaîtra ensuite dans le menu PATCHS.
          </p>
        ) : (
          <ul className="space-y-1">
            {patches.map((patch) => (
              <li
                key={patch.id}
                className="flex items-center gap-2 border border-[#242436] bg-[#0F0F16] px-2 py-1.5"
              >
                {editingId === patch.id ? (
                  <>
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void renamePatch(patch.id, editingName);
                          setEditingId(null);
                        }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 border border-[#A855F7] bg-[#0B0C12] px-2 py-1 text-[#EDEDEE] focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        void renamePatch(patch.id, editingName);
                        setEditingId(null);
                      }}
                      className="p-1 text-[#34D399] hover:bg-[#10B981]/20"
                      title="Valider le nom"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 text-[#8E8E98] hover:bg-[#242436]"
                      title="Annuler"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-[#EDEDEE]">{patch.name}</div>
                      <div className="truncate text-[9px] text-[#8E8E98]">
                        {describe(patch.state.modules.map((m) => m.type))} · {formatDate(patch.savedAt)}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleLoad(patch.id)}
                      className="border border-[#00F0FF]/50 bg-[#00F0FF]/15 px-2 py-1 font-bold text-[#00F0FF] transition hover:bg-[#00F0FF] hover:text-black"
                      title="Charger ce patch dans le rack"
                    >
                      Charger
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(patch.id);
                        setEditingName(patch.name);
                      }}
                      className="p-1 text-[#8E8E98] transition hover:text-white"
                      title="Renommer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void removePatch(patch.id)}
                      className="p-1 text-[#8E8E98] transition hover:text-[#EF4444]"
                      title="Supprimer ce patch"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
};
