/** Colour palettes for the waveform / spectral renderer in WaveformCanvas. */

export type WaveformColorTheme =
  | 'cyber-neon'
  | 'sunset-amber'
  | 'emerald-matrix'
  | 'magma-fire'
  | 'ice-arctic';

export interface WaveformPalette {
  primary: string;
  secondary: string;
  accent: string;
  gradientTop: string;
  gradientBottom: string;
  glow: string;
}

export const WAVEFORM_THEMES: Record<WaveformColorTheme, WaveformPalette> = {
  'cyber-neon': {
    primary: '#00F0FF',
    secondary: '#A855F7',
    accent: '#FFE600',
    gradientTop: 'rgba(0, 240, 255, 0.75)',
    gradientBottom: 'rgba(168, 85, 247, 0.05)',
    glow: 'rgba(0, 240, 255, 0.4)',
  },
  'sunset-amber': {
    primary: '#F59E0B',
    secondary: '#EF4444',
    accent: '#FFE600',
    gradientTop: 'rgba(245, 158, 11, 0.75)',
    gradientBottom: 'rgba(239, 68, 68, 0.05)',
    glow: 'rgba(245, 158, 11, 0.4)',
  },
  'emerald-matrix': {
    primary: '#10B981',
    secondary: '#06B6D4',
    accent: '#34D399',
    gradientTop: 'rgba(16, 185, 129, 0.75)',
    gradientBottom: 'rgba(6, 182, 212, 0.05)',
    glow: 'rgba(16, 185, 129, 0.4)',
  },
  'magma-fire': {
    primary: '#EC4899',
    secondary: '#8B5CF6',
    accent: '#F43F5E',
    gradientTop: 'rgba(236, 72, 153, 0.75)',
    gradientBottom: 'rgba(139, 92, 246, 0.05)',
    glow: 'rgba(236, 72, 153, 0.4)',
  },
  'ice-arctic': {
    primary: '#38BDF8',
    secondary: '#818CF8',
    accent: '#E0F2FE',
    gradientTop: 'rgba(56, 189, 248, 0.8)',
    gradientBottom: 'rgba(129, 140, 248, 0.05)',
    glow: 'rgba(56, 189, 248, 0.4)',
  },
};

export function getWaveformPalette(theme: WaveformColorTheme): WaveformPalette {
  return WAVEFORM_THEMES[theme] ?? WAVEFORM_THEMES['cyber-neon'];
}
