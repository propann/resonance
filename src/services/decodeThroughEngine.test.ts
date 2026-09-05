import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every decode goes through the engine.
 *
 * `audioEngine.decodeAudioData` is the one place that knows what the browser
 * will and will not accept — Chrome refuses AIFF here, so it falls back to our
 * own reader. Anything calling the raw `AudioContext` skips that.
 *
 * This is not hypothetical. `parseOp1AiffPatch` called the raw context, and it
 * is the function every `.aif` in the drop folder passes through: 400 files
 * failed to decode, batch after batch, for hours, while the AIFF fallback sat
 * one call away doing nothing.
 */

const SRC = join(process.cwd(), 'src');
/** The engine is where the raw call belongs; that one is the implementation. */
const ALLOWED = ['services\\audioEngine.ts', 'services/audioEngine.ts'];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('decoding goes through the engine', () => {
  it('has no raw decodeAudioData call outside audioEngine', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      if (ALLOWED.some((allowed) => file.endsWith(allowed))) continue;
      const text = readFileSync(file, 'utf8');
      text.split('\n').forEach((line, index) => {
        // `audioEngine.decodeAudioData(...)` is the good one; anything else
        // reaching a context directly is what this guards against.
        if (!/\.decodeAudioData\s*\(/.test(line)) return;
        if (/audioEngine\.decodeAudioData\s*\(/.test(line)) return;
        offenders.push(`${file.slice(SRC.length + 1)}:${index + 1} — ${line.trim()}`);
      });
    }

    expect(offenders, `décodage hors moteur :\n${offenders.join('\n')}`).toEqual([]);
  });
});
