/**
 * Shared column geometry and badges for the sample table. Kept out of
 * `SampleTable` so the virtualized row component can use them without
 * importing the table back.
 */
import { SampleType } from '../types/sample';

export interface ColumnWidths {
  select: number;
  wave: number;
  name: number;
  type: number;
  key: number;
  genre: number;
  lufs: number;
  tools: number;
}

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  select: 55,
  wave: 125,
  name: 240,
  type: 130,
  key: 95,
  genre: 110,
  lufs: 90,
  tools: 155,
};

export const MIN_COLUMN_WIDTHS: ColumnWidths = {
  select: 45,
  wave: 70,
  name: 120,
  type: 80,
  key: 60,
  genre: 70,
  lufs: 65,
  tools: 110,
};

/**
 * Height of one row in pixels: 22 px waveform + 6 px padding top and bottom
 * + the 2 px separator. The virtualizer positions rows from this, so a row's
 * content must stay this tall.
 */
export const ROW_HEIGHT = 36;

export const TYPE_BADGES: Record<SampleType, { bg: string; text: string; label: string }> = {
  kick: { bg: 'bg-[#00F0FF]/10 border-[#00F0FF]/30', text: 'text-[#00F0FF]', label: 'Kick' },
  '808': { bg: 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30', text: 'text-[#8B5CF6]', label: '808' },
  snare: { bg: 'bg-[#EF4444]/10 border-[#EF4444]/30', text: 'text-[#EF4444]', label: 'Snare' },
  hihat: { bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/30', text: 'text-[#F59E0B]', label: 'Hi-Hat' },
  clap: { bg: 'bg-[#F97316]/10 border-[#F97316]/30', text: 'text-[#F97316]', label: 'Clap' },
  cymbal: { bg: 'bg-[#EAB308]/10 border-[#EAB308]/30', text: 'text-[#EAB308]', label: 'Cymbal' },
  percussion: { bg: 'bg-[#14B8A6]/10 border-[#14B8A6]/30', text: 'text-[#14B8A6]', label: 'Perc' },
  bass: { bg: 'bg-[#7C3AED]/10 border-[#7C3AED]/30', text: 'text-[#A78BFA]', label: 'Bass' },
  lead: { bg: 'bg-[#3B82F6]/10 border-[#3B82F6]/30', text: 'text-[#60A5FA]', label: 'Lead' },
  pad: { bg: 'bg-[#EC4899]/10 border-[#EC4899]/30', text: 'text-[#F472B6]', label: 'Pad' },
  vocal: { bg: 'bg-[#D946EF]/10 border-[#D946EF]/30', text: 'text-[#E879F9]', label: 'Vocal' },
  fx: { bg: 'bg-[#6366F1]/10 border-[#6366F1]/30', text: 'text-[#818CF8]', label: 'FX' },
  loop: { bg: 'bg-[#10B981]/10 border-[#10B981]/30', text: 'text-[#34D399]', label: 'Loop' },
  'multi-sound': { bg: 'bg-[#00F0FF]/15 border-[#00F0FF]/40', text: 'text-[#00F0FF]', label: 'Multi-Stem' },
  other: { bg: 'bg-[#18181D] border-[#26262B]', text: 'text-[#8E8E93]', label: 'Sample' },
};

/** Rows rendered above and below the viewport, to cover fast scrolling. */
export const ROW_OVERSCAN = 6;

/**
 * Half-open range of rows to mount for a given scroll position. Clamped to
 * the list, and never empty while there are rows: a viewport height of 0
 * (first paint, before the container is measured) falls back to a screenful.
 */
export function visibleRowRange(
  scrollTop: number,
  viewportHeight: number,
  rowCount: number
): { first: number; last: number } {
  const height = viewportHeight > 0 ? viewportHeight : 600;
  const first = Math.max(0, Math.floor(Math.max(0, scrollTop) / ROW_HEIGHT) - ROW_OVERSCAN);
  const last = Math.min(
    rowCount,
    first + Math.ceil(height / ROW_HEIGHT) + ROW_OVERSCAN * 2
  );
  return { first: Math.min(first, last), last };
}
