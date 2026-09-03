/**
 * One colour per rack-module family, used by the sample-creation waveform
 * strip to show — at a glance — which kinds of processing are on the signal.
 */

export const FAMILY_COLORS: Record<string, string> = {
  Drive: '#F97316', // orange — saturation / bitcrush
  Dynamics: '#22C55E', // green — compressor / transient / limiter
  Filter: '#00F0FF', // cyan — filters / EQ / wah
  'Lo-Fi': '#EAB308', // amber — vinyl / tape / noise
  Modulation: '#A855F7', // violet — chorus / phaser / ring mod
  Pitch: '#EC4899', // pink — pitch / freq shift
  Space: '#3B82F6', // blue — delay / reverb / stutter
  Stereo: '#14B8A6', // teal — imager / auto-pan
  Utility: '#94A3B8', // slate — gain / dc-remove
};

export const FAMILY_FALLBACK = '#A855F7';

export function familyColor(family: string): string {
  return FAMILY_COLORS[family] ?? FAMILY_FALLBACK;
}

/** Blend a set of hex colours by simple RGB average. Empty → fallback. */
export function blendColors(hexes: string[]): string {
  if (hexes.length === 0) return FAMILY_FALLBACK;
  if (hexes.length === 1) return hexes[0];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const hex of hexes) {
    const n = parseInt(hex.slice(1), 16);
    r += (n >> 16) & 0xff;
    g += (n >> 8) & 0xff;
    b += n & 0xff;
  }
  const k = hexes.length;
  const to2 = (v: number) => Math.round(v / k).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
