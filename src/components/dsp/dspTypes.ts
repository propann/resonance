import React from 'react';
import {
  Flame,
  Binary,
  Compass,
  Sparkles,
  Scissors,
  Activity,
  Sliders,
  Waves,
  Zap,
  Radio,
  SlidersHorizontal,
  Disc,
  RotateCcw,
  Volume2,
  Wind,
  Layers,
} from 'lucide-react';

export type EffectModuleKey =
  | 'subBass'
  | 'distortion'
  | 'delay'
  | 'reverb'
  | 'stutter'
  | 'filter'
  | 'compressor'
  | 'modulation'
  | 'transient'
  | 'pitchRing'
  | 'imager'
  | 'formant'
  | 'vinylTape'
  | 'freqShifter'
  | 'exciter'
  | 'autoWah'
  | 'combResonator'
  | 'surgical';

export type EffectCategory =
  | 'all'
  | 'bass_dynamics'
  | 'space_echo'
  | 'modulation_pitch'
  | 'vintage_lofi'
  | 'surgical_tools';

export interface EffectModuleMeta {
  key: EffectModuleKey;
  label: string;
  shortName: string;
  category: EffectCategory;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  borderColor: string;
  bgColor: string;
  description: string;
}

export const EFFECT_MODULES: EffectModuleMeta[] = [
  {
    key: 'subBass',
    label: 'Basses 808 & Sub-Harmoniques',
    shortName: '⚡ 808 SUB',
    category: 'bass_dynamics',
    icon: Flame,
    color: '#00F0FF',
    borderColor: 'border-[#00F0FF]/40',
    bgColor: 'bg-[#00F0FF]/15',
    description: 'Octave inférieure (-12st), saturation 808 et recentrage mono sub',
  },
  {
    key: 'distortion',
    label: 'Saturation, Wavefolder & 12-Bit Lo-Fi',
    shortName: '📻 SAT & LO-FI',
    category: 'vintage_lofi',
    icon: Binary,
    color: '#EF4444',
    borderColor: 'border-[#EF4444]/40',
    bgColor: 'bg-[#EF4444]/15',
    description: 'Lampes chaudes, bande magnétique, bitcrusher SP-1200 et wavefolder',
  },
  {
    key: 'delay',
    label: 'Stereo Ping-Pong & Tape Delay',
    shortName: '⏱️ DELAY ÉCHO',
    category: 'space_echo',
    icon: Compass,
    color: '#38BDF8',
    borderColor: 'border-[#38BDF8]/40',
    bgColor: 'bg-[#38BDF8]/15',
    description: 'Écho ping-pong synchronisé au tempo, wow & flutter et damping',
  },
  {
    key: 'reverb',
    label: 'Shimmer Reverb & Espace Céleste',
    shortName: '🌌 SHIMMER REVERB',
    category: 'space_echo',
    icon: Sparkles,
    color: '#A855F7',
    borderColor: 'border-[#A855F7]/40',
    bgColor: 'bg-[#A855F7]/15',
    description: 'Algorithme à plaques, cathédrale, octave shimmer et freeze infini',
  },
  {
    key: 'stutter',
    label: 'Saccades Rythmiques & Trance Gate',
    shortName: '🔪 STUTTER GATE',
    category: 'bass_dynamics',
    icon: Scissors,
    color: '#FFE600',
    borderColor: 'border-[#FFE600]/40',
    bgColor: 'bg-[#FFE600]/15',
    description: 'Hachoir synchronisé au tempo (1/4 à 1/64, triolets, glitch aléatoire)',
  },
  {
    key: 'filter',
    label: 'Filtre Resonant Acid 303 & LFO',
    shortName: '🧪 FILTRE ACID',
    category: 'modulation_pitch',
    icon: Activity,
    color: '#10B981',
    borderColor: 'border-[#10B981]/40',
    bgColor: 'bg-[#10B981]/15',
    description: 'Passe-bas/haut résonant, auto-oscillation 303 et balayage LFO',
  },
  {
    key: 'compressor',
    label: 'Compresseur Studio & Peak Limiter',
    shortName: '🎛️ COMPRESSEUR',
    category: 'bass_dynamics',
    icon: Sliders,
    color: '#F59E0B',
    borderColor: 'border-[#F59E0B]/40',
    bgColor: 'bg-[#F59E0B]/15',
    description: 'Contrôle de dynamique, seuil, ratio, attaque rapide et make-up gain',
  },
  {
    key: 'modulation',
    label: 'Chorus, Flanger & Haas 3D Spatial',
    shortName: '🔊 CHORUS / HAAS',
    category: 'modulation_pitch',
    icon: Waves,
    color: '#EC4899',
    borderColor: 'border-[#EC4899]/40',
    bgColor: 'bg-[#EC4899]/15',
    description: 'Épaississement Dimension-D, flanger à réaction et effet Haas 3D',
  },
  {
    key: 'transient',
    label: 'Transient Shaper (Punch & Sustain)',
    shortName: '🥊 TRANSIENT PUNCH',
    category: 'bass_dynamics',
    icon: Zap,
    color: '#14B8A6',
    borderColor: 'border-[#14B8A6]/40',
    bgColor: 'bg-[#14B8A6]/15',
    description: 'Sculpture d\'impact d\'attaque et contrôle de la résonance du sustain',
  },
  {
    key: 'pitchRing',
    label: 'Pitch Shift & Modulateur en Anneau',
    shortName: '🤖 PITCH & RING',
    category: 'modulation_pitch',
    icon: Radio,
    color: '#818CF8',
    borderColor: 'border-[#818CF8]/40',
    bgColor: 'bg-[#818CF8]/15',
    description: 'Transposition +/-24 demi-tons, accord fin cents et robotique ring mod',
  },
  {
    key: 'imager',
    label: 'Panoramique, Tremolo & Stereo Imager',
    shortName: '↔️ AUTOPAN & WIDE',
    category: 'space_echo',
    icon: SlidersHorizontal,
    color: '#6366F1',
    borderColor: 'border-[#6366F1]/40',
    bgColor: 'bg-[#6366F1]/15',
    description: 'Élargissement stéréo Mid/Side (0-200%), autopan et trémolo dynamique',
  },
  {
    key: 'formant',
    label: 'Filtre Vocal & Formants Robot',
    shortName: '🗣️ FORMANT VOCAL',
    category: 'modulation_pitch',
    icon: Disc,
    color: '#D946EF',
    borderColor: 'border-[#D946EF]/40',
    bgColor: 'bg-[#D946EF]/15',
    description: 'Résonateurs de voyelles (A-E-I-O-U), morphing continu et talkbox',
  },
  {
    key: 'vinylTape',
    label: 'Bruit Vinyle & Dérive Cassette',
    shortName: '📼 VINYLE & BANDE',
    category: 'vintage_lofi',
    icon: Disc,
    color: '#EAB308',
    borderColor: 'border-[#EAB308]/40',
    bgColor: 'bg-[#EAB308]/15',
    description: 'Craquements vinyle, poussières, pleurage cassette et filtres d\'époque',
  },
  {
    key: 'freqShifter',
    label: 'Bode Frequency Shifter & Cloches',
    shortName: '🛸 FREQ SHIFTER',
    category: 'modulation_pitch',
    icon: Radio,
    color: '#06B6D4',
    borderColor: 'border-[#06B6D4]/40',
    bgColor: 'bg-[#06B6D4]/15',
    description: 'Décalage fréquentiel linéaire non-harmonique (sci-fi, gong, textures)',
  },
  {
    key: 'exciter',
    label: 'Harmonic Exciter & Air Presence',
    shortName: '✨ EXCITER AURA',
    category: 'vintage_lofi',
    icon: Sparkles,
    color: '#F43F5E',
    borderColor: 'border-[#F43F5E]/40',
    bgColor: 'bg-[#F43F5E]/15',
    description: 'Brillance psychoacoustique type Aphex, harmoniques pairs/impairs et air 12k',
  },
  {
    key: 'autoWah',
    label: 'Dynamic Auto-Wah & Envelope',
    shortName: '🎸 AUTO-WAH FUNK',
    category: 'modulation_pitch',
    icon: Activity,
    color: '#84CC16',
    borderColor: 'border-[#84CC16]/40',
    bgColor: 'bg-[#84CC16]/15',
    description: 'Filtre dynamique modulé par l\'enveloppe du signal d\'entrée',
  },
  {
    key: 'combResonator',
    label: 'Comb Filter & Résonateur Métallique',
    shortName: '🪕 COMB RESONATOR',
    category: 'space_echo',
    icon: Wind,
    color: '#3B82F6',
    borderColor: 'border-[#3B82F6]/40',
    bgColor: 'bg-[#3B82F6]/15',
    description: 'Ligne à retard accordée en peigne créant une résonance physique de corde/tube',
  },
  {
    key: 'surgical',
    label: 'Tape Stop Vinyl Brake & Chirurgie',
    shortName: '🎚️ TAPE STOP & FIX',
    category: 'surgical_tools',
    icon: RotateCcw,
    color: '#F97316',
    borderColor: 'border-[#F97316]/40',
    bgColor: 'bg-[#F97316]/15',
    description: 'Frein vinyle à inertie, reverse, fondus croisés et normalisation crête',
  },
];
