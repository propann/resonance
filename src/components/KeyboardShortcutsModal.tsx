import React from 'react';
import { Keyboard } from 'lucide-react';
import { Modal } from './Modal';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  description: string;
  category: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { key: 'ESPACE', description: 'Lecture / Pause du sample actif', category: 'TRANSPORT' },
  { key: '↑ / ↓', description: 'Naviguer et pré-écouter le sample précédent / suivant', category: 'TRANSPORT' },
  { key: 'L', description: 'Activer / Désactiver la lecture en boucle (Loop)', category: 'TRANSPORT' },
  { key: 'R', description: 'Inverser le sens de lecture (Reverse audio)', category: 'TRANSPORT' },
  { key: 'S', description: 'Ouvrir le Découpeur Multi-Tranches (Slicer)', category: 'ÉDITION' },
  { key: 'E', description: "Ouvrir le Rack Modulaire (Effets & Sound Design)", category: 'ÉDITION' },
  { key: 'CLIC-GLISSER', description: "Déplacer les balises temporelles P1..Pn sur l'onde", category: "FORME D'ONDE" },
  { key: 'DOUBLE-CLIC', description: 'Ajouter une balise et découper le sample', category: "FORME D'ONDE" },
  { key: 'CLIC DROIT', description: 'Supprimer une balise et fusionner les tranches', category: "FORME D'ONDE" },
  { key: 'F1', description: 'Ouvrir la documentation', category: 'AFFICHAGE' },
  { key: 'F2', description: 'Basculer Bibliothèque / Carte Timbrale 2D', category: 'AFFICHAGE' },
  { key: 'F4', description: 'Ouvrir le Laboratoire Acoustique DSP', category: 'AUDIO' },
  { key: 'ÉCHAP', description: 'Fermer la fenêtre active', category: 'GÉNÉRAL' },
  { key: 'CTRL + N', description: 'Renommage en masse', category: 'FICHIER' },
  { key: 'CTRL + I', description: 'Reconnecter le dossier de travail', category: 'FICHIER' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <Modal open={isOpen} onClose={onClose} size="md" icon={<Keyboard className="h-4 w-4" />} title="Raccourcis clavier">
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat} className="space-y-1">
            <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[#A855F7]">{cat}</div>
            <div className="space-y-1 rounded border border-[#1E1E28] bg-[#060609] p-1.5">
              {SHORTCUTS.filter((s) => s.category === cat).map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded px-1.5 py-1 text-[11px] hover:bg-[#12121A]"
                >
                  <span className="text-[#EDEDEE]">{s.description}</span>
                  <kbd className="shrink-0 rounded border border-[#2E2E42] bg-[#181824] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#00F0FF]">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};
