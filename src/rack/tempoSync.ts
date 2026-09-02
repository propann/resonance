/** Note division -> seconds at a given BPM. For tempo-synced rack modules. */
export function syncDivisionToSeconds(div: string, bpm: number): number {
  const beatSec = 60 / Math.max(20, bpm);
  switch (div) {
    case '1/2':
      return beatSec * 2;
    case '1/4':
      return beatSec;
    case '1/8':
      return beatSec / 2;
    case '1/8D':
      return (beatSec / 2) * 1.5;
    case '1/8T':
      return (beatSec / 2) * (2 / 3);
    case '1/16':
      return beatSec / 4;
    case '1/16T':
      return (beatSec / 4) * (2 / 3);
    case '1/32':
      return beatSec / 8;
    case '1/64':
      return beatSec / 16;
    default:
      return 0.25;
  }
}
