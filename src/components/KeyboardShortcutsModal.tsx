import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

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
  { key: 'E', description: 'Ouvrir le Studio Rack d\'Effets DSP & Sound Design', category: 'ÉDITION' },
  { key: 'CLIC-GLISSER', description: 'Déplacer les balises temporelles P1..Pn sur l\'onde', category: 'FORME D\'ONDE' },
  { key: 'DOUBLE-CLIC', description: 'Ajouter une balise et découper le sample', category: 'FORME D\'ONDE' },
  { key: 'CLIC DROIT', description: 'Supprimer une balise et fusionner les tranches', category: 'FORME D\'ONDE' },
  { key: 'F1', description: 'Basculer sur la Vue Bibliothèque & Onde', category: 'AFFICHAGE' },
  { key: 'F2', description: 'Basculer sur la Carte Timbrale 2D (Atlas/XO)', category: 'AFFICHAGE' },
  { key: 'F4', description: 'Ouvrir le Laboratoire Acoustique DSP', category: 'AUDIO' },
  { key: 'CTRL + O', description: 'Importer des fichiers audio', category: 'FICHIER' },
  { key: 'CTRL + ⇧ + O', description: 'Importer un dossier complet', category: 'FICHIER' },
  { key: 'CTRL + ⇧ + E', description: 'Exporter la sélection en ZIP', category: 'FICHIER' },
  { key: '?', description: 'Afficher cette aide des raccourcis', category: 'GÉNÉRAL' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-[#0C0C12] border-2 border-[#242436] p-4 shadow-2xl pixel-box">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#1E1E2C] pb-2 mb-3">
          <div className="flex items-center gap-2 text-[#00F0FF]">
            <Keyboard className="w-4 h-4" />
            <h2 className="text-xs font-pixel font-bold uppercase tracking-wider">
              RACCOURCIS CLAVIER & COMMANDES RAPIDES
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8E8E98] hover:text-white hover:bg-[#1C1C28] pixel-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List by category */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {categories.map((cat) => (
            <div key={cat} className="space-y-1">
              <div className="text-[9px] font-pixel text-[#A855F7] font-bold uppercase tracking-wider px-1">
                {cat}
              </div>
              <div className="bg-[#060609] border border-[#1E1E28] p-1.5 space-y-1">
                {SHORTCUTS.filter((s) => s.category === cat).map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1 px-1.5 hover:bg-[#12121A] text-[9px] font-pixel"
                  >
                    <span className="text-[#EDEDEE]">{s.description}</span>
                    <kbd className="px-1.5 py-0.5 bg-[#181824] border border-[#2E2E42] text-[#00F0FF] font-bold rounded-none">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-2 border-t border-[#1E1E2C] flex items-center justify-between text-[9px] font-pixel text-[#8E8E98]">
          <span>Appuyez sur <kbd className="text-[#00F0FF]">ÉCHAP</kbd> pour fermer</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#00F0FF] text-black font-bold pixel-btn hover:bg-[#38BDF8]"
          >
            FERMER
          </button>
        </div>
      </div>
    </div>
  );
};
