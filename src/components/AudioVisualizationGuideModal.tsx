import React from 'react';
import { X, Activity, Waves, Layers, BarChart2, Radio, Info, Compass } from 'lucide-react';

interface AudioVisualizationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioVisualizationGuideModal: React.FC<AudioVisualizationGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl bg-[#0C0C14] border-2 border-[#262638] p-5 shadow-2xl pixel-box text-[#EDEDEE]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#1E1E2C] pb-3 mb-4">
          <div className="flex items-center gap-2 text-[#00F0FF]">
            <Info className="w-5 h-5" />
            <h2 className="text-sm font-pixel font-bold uppercase tracking-wider">
              LEXIQUE & GUIDE DES VISUALISATIONS AUDIO
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8E8E98] hover:text-white hover:bg-[#1C1C28] pixel-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Guide Cards */}
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1 text-xs">
          {/* 1. Forme d'onde HD */}
          <div className="p-3 bg-[#07070B] border border-[#00F0FF]/30 space-y-1">
            <div className="flex items-center gap-2 text-[#00F0FF] font-pixel font-bold">
              <Waves className="w-4 h-4" />
              <span>1. FORME D'ONDE HD (WAVEFORM AMPLITUDE)</span>
            </div>
            <p className="text-[#C0C0D0] leading-relaxed text-[11px]">
              La forme d'onde classique représente les vibrations d'air et la <strong>pression acoustique au cours du temps</strong>.
              La hauteur verticale indique l'<strong>amplitude (volume)</strong>. Le cœur dense interne montre l'énergie moyenne (RMS / punch perçu), tandis que les pointes extérieures révèlent les <strong>transitoires</strong> (l'attaque d'une frappe de batterie ou d'un médiator).
            </p>
          </div>

          {/* 2. Spectrogramme FFT */}
          <div className="p-3 bg-[#07070B] border border-[#A855F7]/30 space-y-1">
            <div className="flex items-center gap-2 text-[#A855F7] font-pixel font-bold">
              <Activity className="w-4 h-4" />
              <span>2. SPECTROGRAMME 2D (CASCADE FRÉQUENTIELLE FFT)</span>
            </div>
            <p className="text-[#C0C0D0] leading-relaxed text-[11px]">
              C'est la « radiographie » du son ! Alors que la forme d'onde ne montre que le volume global, le spectrogramme découpe le son en <strong>fréquences (de 20 Hz en bas à 20 000 Hz en haut)</strong>.
            </p>
            <div className="flex items-center gap-2 text-[10px] font-mono pt-1 text-[#8E8E98]">
              <span className="text-[#3B82F6] font-bold">■ Bleu/Violet : Graves</span>
              <span className="text-[#10B981] font-bold">■ Vert/Cyan : Médiums</span>
              <span className="text-[#FFE600] font-bold">■ Jaune/Rouge : Aigus & Énergie max</span>
            </div>
          </div>

          {/* 3. Multi-Bandes Couleurs */}
          <div className="p-3 bg-[#07070B] border border-[#FFE600]/30 space-y-1">
            <div className="flex items-center gap-2 text-[#FFE600] font-pixel font-bold">
              <Layers className="w-4 h-4" />
              <span>3. COLORATION MULTI-BANDES (SPECTRAL WAVEFORM)</span>
            </div>
            <p className="text-[#C0C0D0] leading-relaxed text-[11px]">
              Technologie utilisée par les logiciels DJ et de mixage pro (iZotope, Serato, Rekordbox).
              L'onde elle-même est teintée selon le timbre dominant à chaque milliseconde :
            </p>
            <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] font-mono">
              <div className="p-1 bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444]">
                <strong>🔴 ROUGE :</strong> Sub & Basses (&lt; 250 Hz, 808, kicks)
              </div>
              <div className="p-1 bg-[#06B6D4]/15 border border-[#06B6D4]/40 text-[#06B6D4]">
                <strong>🟢 CYAN :</strong> Médiums (corps de caisse claire, voix, synthé)
              </div>
              <div className="p-1 bg-[#FBBF24]/15 border border-[#FBBF24]/40 text-[#FBBF24]">
                <strong>🟡 JAUNE :</strong> Aigus & Air (&gt; 4 kHz, charlestons, clics)
              </div>
            </div>
          </div>

          {/* 4. Pitch Tracker F0 */}
          <div className="p-3 bg-[#07070B] border border-[#10B981]/30 space-y-1">
            <div className="flex items-center gap-2 text-[#10B981] font-pixel font-bold">
              <Radio className="w-4 h-4" />
              <span>4. PITCH TRACKER (LIGNE DE HAUTEUR F0)</span>
            </div>
            <p className="text-[#C0C0D0] leading-relaxed text-[11px]">
              Trace la trajectoire de la <strong>note musicale fondamentale</strong> en temps réel.
              Idéal pour observer la chute de fréquence d'un kick (qui glisse de 180 Hz à 45 Hz en 50ms) ou la note tenue d'une basse 808.
            </p>
          </div>

          {/* 5. VU-Mètre Stéréo & Goniomètre */}
          <div className="p-3 bg-[#07070B] border border-[#EC4899]/30 space-y-1">
            <div className="flex items-center gap-2 text-[#EC4899] font-pixel font-bold">
              <BarChart2 className="w-4 h-4" />
              <span>5. VU-MÈTRES STÉRÉO & CORRÉLATEUR DE PHASE</span>
            </div>
            <p className="text-[#C0C0D0] leading-relaxed text-[11px]">
              Mesure les niveaux de sortie <strong>Peak (crête)</strong> et <strong>RMS (puissance continue)</strong> sur les canaux Gauche (L) et Droite (R).
              Le corrélomètre de phase vérifie la compatibilité mono (+1 = mono parfait, 0 = stéréo large équilibrée, -1 = problème d'annulation de phase).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-[#1E1E2C] flex items-center justify-between">
          <span className="text-[10px] font-pixel text-[#8E8E98]">
            Astuce : Utilisez les boutons en haut à droite de l'onde pour combiner les calques !
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#00F0FF] text-black font-bold font-pixel text-xs pixel-btn hover:bg-[#38BDF8]"
          >
            COMPRIS !
          </button>
        </div>
      </div>
    </div>
  );
};
