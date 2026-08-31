import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  CheckCircle2,
  X,
  Layers,
  Volume2,
  Radio,
  Music,
  Sliders,
  Cpu,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Disc,
  FolderSync
} from 'lucide-react';

interface MarketBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MarketBenchmarkModal: React.FC<MarketBenchmarkModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'comparison' | 'ep133' | 'dsp'>('comparison');

  if (!isOpen) return null;

  const competitors = [
    {
      name: 'XLN Audio XO',
      type: 'Commercial VST ($179)',
      features: ['Space map visualization', 'Pattern sequencer', 'Sample hot-swapping'],
      limitations: ['Desktop VST only (heavy install)', 'Pas d’export direct EP-133 slot-numbered', 'Pas de détection automatique complète One-Shot vs Loop'],
      ourAdvantage: 'Ingestion dossier magique, calcul LUFS intégré, export direct EP-133 K.O. II sans installation',
    },
    {
      name: 'Algonaut Atlas 2',
      type: 'Commercial Plugin ($99)',
      features: ['Drum maps IA', 'MIDI generation', 'Kit randomizer'],
      limitations: ['Spécifique aux drum hits uniquement', 'Pas de support de découpe automatique multi-sound', 'Pas de normalisation de volume multi-styles'],
      ourAdvantage: 'Gère loops, one-shots, multi-sons, égalisation intelligente de volume et formats hardware',
    },
    {
      name: 'Sononym',
      type: 'Desktop App ($99)',
      features: ['Recherche par similarité spectrale', 'Extraction de métadonnées', 'Analyse du pitch'],
      limitations: ['Interface complexe et austère', 'Pas de lecteur Web instantané', 'Processus de batch conversion lourd'],
      ourAdvantage: 'Lecteur ultra-rapide 0-latence, découpage automatique de stems, design épuré Geometric Balance',
    },
    {
      name: 'Mixed In Key 11',
      type: 'Desktop App ($58)',
      features: ['Détection de tonalité Camelot Wheel', 'Détection BPM & Energy Level', 'Cue points'],
      limitations: ['Focalisé uniquement sur les tracks DJ', 'Inadapté aux banques de samples & sound designers', 'Pas de conversion de formats d’échantillonneurs'],
      ourAdvantage: 'Algorithme Chromagram PCP adapté aux one-shots courts (808, kicks, stabs) et boucles',
    },
    {
      name: 'Soundly / Soundminer',
      type: 'Pro SFX Manager (Sub / $199+)',
      features: ['Glisser-déposer vers DAW', 'Cloud library', 'Pitch & reverse preview'],
      limitations: ['Abonnement coûteux', 'Centré sur le bruitage cinéma / TV, pas la production musicale électronique'],
      ourAdvantage: '100% gratuit dans le navigateur, optimisé pour beatmakers et sampleurs hardware',
    },
    {
      name: 'Teenage Engineering Sample Tool',
      type: 'Web Utility (Official)',
      features: ['Transfert USB vers EP-133', 'Glisser-déposer dans les slots 001-999'],
      limitations: ['Aucune analyse automatique de tempo/clé', 'Pas d’égalisation de volume', 'Pas de détection loop/one-shot'],
      ourAdvantage: 'Le compagnon parfait : pré-analyse, normalise, découpe et génère le pack de dossiers pré-numérotés prêt à glisser !',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0D0D11] border border-[#222228] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#222228] flex items-center justify-between bg-[#121218]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#E0E0E6] flex items-center gap-2">
                Étude Comparative & Benchmark Outils Pro
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30">
                  Resonance Studio Engine
                </span>
              </h2>
              <p className="text-xs text-[#8E8E9A]">
                Analyse des meilleurs logiciels du marché (XO, Atlas, Sononym, Mixed In Key) et innovations apportées
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E8E9A] hover:text-[#E0E0E6] hover:bg-[#1C1C24] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#222228] bg-[#0F0F14]">
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'comparison'
                ? 'border-[#00F0FF] text-[#00F0FF] bg-[#16161F]'
                : 'border-transparent text-[#8E8E9A] hover:text-[#E0E0E6]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Comparatif Marché vs Resonance
          </button>
          <button
            onClick={() => setActiveTab('ep133')}
            className={`px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'ep133'
                ? 'border-[#00F0FF] text-[#00F0FF] bg-[#16161F]'
                : 'border-transparent text-[#8E8E9A] hover:text-[#E0E0E6]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Spécifications EP-133 K.O. II
          </button>
          <button
            onClick={() => setActiveTab('dsp')}
            className={`px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-2 border-b-2 ${
              activeTab === 'dsp'
                ? 'border-[#00F0FF] text-[#00F0FF] bg-[#16161F]'
                : 'border-transparent text-[#8E8E9A] hover:text-[#E0E0E6]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Algorithmes DSP & Égaliseur LUFS
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'comparison' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#00F0FF]/5 border border-[#00F0FF]/20 text-xs text-[#E0E0E6] flex items-start gap-3">
                <Zap className="w-4 h-4 text-[#00F0FF] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#00F0FF] font-semibold">Notre engagement &laquo; On Fait Mieux &raquo; :</strong>
                  <p className="text-[#8E8E9A] mt-1 leading-relaxed">
                    Au lieu d'obliger l'utilisateur à installer 3 logiciels différents (un pour le pitch/BPM, un pour la découpe, un pour convertir vers son sampleur), Resonance Studio combine l'analyse acoustique complète, l'égalisation automatique du volume pour éviter les écarts d'intensité sonore, la distinction One-Shot / Loop et l'export direct formaté pour l'EP-133.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {competitors.map((tool, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-[#14141B] border border-[#222228] hover:border-[#33333F] transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-[#E0E0E6] flex items-center gap-2">
                          {tool.name}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#1E1E28] text-[#8E8E9A] border border-[#2C2C38]">
                          {tool.type}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="text-[11px] text-[#8E8E9A] font-medium">Ce qu'il fait :</div>
                        <ul className="text-[11px] text-[#A0A0B0] list-disc list-inside space-y-0.5">
                          {tool.features.map((f, idx) => (
                            <li key={idx}>{f}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-2 text-[11px] text-[#EF4444]/90 bg-[#EF4444]/10 p-2 rounded border border-[#EF4444]/20">
                        <span className="font-semibold">Limite :</span> {tool.limitations.join(' • ')}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[11px] text-[#E0E0E6]">
                      <div className="text-[#00F0FF] font-semibold flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Comment Resonance Studio fait mieux :
                      </div>
                      <p className="text-[#A0E9EF] leading-snug">{tool.ourAdvantage}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ep133' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#14141B] border border-[#222228] space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#00F0FF]">
                  <Disc className="w-4 h-4" /> Spécifications Hardware Teenage Engineering EP-133 K.O. II
                </div>
                <p className="text-xs text-[#8E8E9A] leading-relaxed">
                  L'EP-133 K.O. II dispose d'une mémoire interne de 64 Mo partagée entre 999 slots d'échantillons et 9 groupes de pads. Pour tirer le maximum de dynamisme et de clarté de son convertisseur DAC :
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-[#0D0D11] border border-[#222228]">
                    <div className="text-[11px] text-[#8E8E9A]">Fréquence d'Échantillonnage</div>
                    <div className="text-sm font-bold text-[#E0E0E6] mt-0.5">46.875 kHz / 44.1 kHz</div>
                    <div className="text-[10px] text-[#00F0FF] mt-1">Fréquence native DAC K.O. II</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0D0D11] border border-[#222228]">
                    <div className="text-[11px] text-[#8E8E9A]">Format & Résolution</div>
                    <div className="text-sm font-bold text-[#E0E0E6] mt-0.5">16-bit PCM Linear WAV</div>
                    <div className="text-[10px] text-[#10B981] mt-1">Option Mono (-50% RAM)</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0D0D11] border border-[#222228]">
                    <div className="text-[11px] text-[#8E8E9A]">Attribution des Pads</div>
                    <div className="text-sm font-bold text-[#E0E0E6] mt-0.5">Slots 001 à 999</div>
                    <div className="text-[10px] text-[#F59E0B] mt-1">Numérotation pré-indexée</div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#14141B] border border-[#222228] space-y-3">
                <h4 className="text-xs font-semibold text-[#E0E0E6] uppercase tracking-wider">
                  Structure de Dossiers Générée pour le Sample Tool
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-[#0D0D11] border border-[#222228] text-[#E0E0E6]">
                    <span className="text-[#00F0FF] font-mono font-bold">01_KICKS</span> (Slots 001-099)
                  </div>
                  <div className="p-2.5 rounded bg-[#0D0D11] border border-[#222228] text-[#E0E0E6]">
                    <span className="text-[#00F0FF] font-mono font-bold">02_SNARES</span> (Slots 100-199)
                  </div>
                  <div className="p-2.5 rounded bg-[#0D0D11] border border-[#222228] text-[#E0E0E6]">
                    <span className="text-[#00F0FF] font-mono font-bold">03_HATS</span> (Slots 200-299)
                  </div>
                  <div className="p-2.5 rounded bg-[#0D0D11] border border-[#222228] text-[#E0E0E6]">
                    <span className="text-[#00F0FF] font-mono font-bold">04_PERCS</span> (Slots 300-399)
                  </div>
                  <div className="p-2.5 rounded bg-[#0D0D11] border border-[#222228] text-[#E0E0E6]">
                    <span className="text-[#00F0FF] font-mono font-bold">05_BASS_808</span> (Slots 400-499)
                  </div>
                  <div className="p-2.5 rounded bg-[#0D0D11] border border-[#222228] text-[#E0E0E6]">
                    <span className="text-[#00F0FF] font-mono font-bold">06_LEADS</span> (Slots 500-599)
                  </div>
                  <div className="p-2.5 rounded bg-[#0D0D11] border border-[#222228] text-[#E0E0E6]">
                    <span className="text-[#00F0FF] font-mono font-bold">07_PADS</span> (Slots 600-699)
                  </div>
                  <div className="p-2.5 rounded bg-[#0D0D11] border border-[#222228] text-[#E0E0E6]">
                    <span className="text-[#00F0FF] font-mono font-bold">08_VOCALS</span> (Slots 700-799)
                  </div>
                  <div className="p-2.5 rounded bg-[#0D0D11] border border-[#222228] text-[#E0E0E6]">
                    <span className="text-[#00F0FF] font-mono font-bold">00_LOOPS</span> (Slots 900-999)
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dsp' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#14141B] border border-[#222228] space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#00F0FF]">
                  <Volume2 className="w-4 h-4" /> Égaliseur de Volume Intelligent (Loudness Matching & Auto-Gain)
                </div>
                <p className="text-xs text-[#8E8E9A] leading-relaxed">
                  Le plus grand défi des producteurs est la disparité de volume : un sample provient d'un vieux vinyl enregistré à -18 dB, un autre d'un pack moderne saturé à 0 dBFS avec de la distorsion.
                </p>
                <div className="p-3 rounded-lg bg-[#0D0D11] border border-[#222228] space-y-2 text-xs">
                  <div className="text-[#E0E0E6] font-semibold">Comment Resonance Studio résout ce problème :</div>
                  <ul className="list-disc list-inside text-[#8E8E9A] space-y-1">
                    <li><strong className="text-[#E0E0E6]">Filtre K-Weighting (EBU R128) :</strong> Mesure la sonie perçue par l'oreille humaine (LUFS) et non juste le simple pic numérique.</li>
                    <li><strong className="text-[#E0E0E6]">Cible adaptative par type :</strong> -14 LUFS pour les boucles mélodiques/drum loops, -0.2 dB True-Peak pour les One-Shots de kicks et snares.</li>
                    <li><strong className="text-[#E0E0E6]">Soft-Knee Saturation Limiter :</strong> Évite toute distorsion ou écrêtage numérique lors des augmentations de gain.</li>
                    <li><strong className="text-[#E0E0E6]">Pré-écoute instantanée égalisée :</strong> Les sons sont pré-écoutés à niveau uniforme en direct dans l'application.</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#14141B] border border-[#222228] space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#10B981]">
                  <Music className="w-4 h-4" /> Détection de Clé Harmonique (Chromagram PCP) & Tempo / Mesures
                </div>
                <p className="text-xs text-[#8E8E9A] leading-relaxed">
                  L'analyseur utilise le profil chromatique de Krumhansl-Schmuckler avec transformée de Fourier discrète pour déterminer la note fondamentale et le mode (Majeur / Mineur). Pour les boucles, il calcule automatiquement le nombre de mesures (1 bar, 2 bars, 4 bars, 8 bars) en fonction du tempo détecté.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#222228] bg-[#121218] flex items-center justify-between">
          <span className="text-xs text-[#8E8E9A] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#00F0FF]" /> DSP WebAudio & Wasm haute fidélité
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#00F0FF] text-[#0A0A0B] font-semibold text-xs hover:bg-[#33F3FF] transition-colors"
          >
            Fermer le Benchmark
          </button>
        </div>
      </div>
    </div>
  );
};
