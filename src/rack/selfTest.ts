/**
 * Bench for the rack modules: every effect is rendered offline over one
 * reference signal and compared with the dry signal. It answers a question
 * that is otherwise a matter of opinion — "does this effect actually do
 * anything?" — with a number.
 *
 * A module is reported broken when it fails to build, outputs silence or
 * produces non-finite samples. A module that builds and passes the signal
 * through unchanged is reported as transparent at its default settings, which
 * is expected for a few (a gain at 0 dB) and suspicious for the rest.
 */
import { Rack } from './Rack';
import { defaultParams } from './params';
import { listModuleDefs } from './registry';
import type { RackModuleDef } from './types';

export interface ModuleTestResult {
  type: string;
  label: string;
  family: string;
  /** The module built and produced usable audio. */
  ok: boolean;
  /** How much the signal changed, in dB. 0 means untouched. */
  changeDb: number;
  /** Output level relative to the input, in dB. */
  levelDb: number;
  status: 'ok' | 'transparent' | 'silent' | 'broken';
  note: string;
}

const SAMPLE_RATE = 48000;
const DURATION_SEC = 1.5;

/** Sweep + noise + clicks: something for every kind of effect to bite on. */
export function buildTestSignal(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.floor(DURATION_SEC * SAMPLE_RATE);
  const buffer = ctx.createBuffer(2, length, SAMPLE_RATE);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let phase = 0;
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE;
      // 80 Hz -> 8 kHz sweep, so filters and pitch effects have material
      const freq = 80 * Math.pow(100, t / DURATION_SEC);
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;
      const sweep = Math.sin(phase) * 0.4;
      const noise = (Math.random() * 2 - 1) * 0.05;
      // a click every 250 ms, for transient and dynamics modules
      const click = i % Math.floor(SAMPLE_RATE / 4) < 24 ? 0.5 : 0;
      data[i] = Math.max(-1, Math.min(1, sweep + noise + click));
    }
  }
  return buffer;
}

const rms = (data: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / Math.max(1, data.length));
};

const hasNonFinite = (data: Float32Array): boolean => {
  for (let i = 0; i < data.length; i++) {
    if (!Number.isFinite(data[i])) return true;
  }
  return false;
};

/** RMS of (a - b): how much the effect moved the signal. */
const differenceRms = (a: Float32Array, b: Float32Array): number => {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum / Math.max(1, length));
};

const toDb = (ratio: number): number => (ratio > 0 ? 20 * Math.log10(ratio) : -Infinity);

/** Modules that legitimately leave a clean signal alone at their defaults. */
const TRANSPARENT_BY_DESIGN = new Set(['fx.gain', 'fx.dcremove', 'fx.compressor', 'fx.imager']);

async function testModule(def: RackModuleDef, dry: AudioBuffer): Promise<ModuleTestResult> {
  const base: Omit<ModuleTestResult, 'ok' | 'changeDb' | 'levelDb' | 'status' | 'note'> = {
    type: def.type,
    label: def.label,
    family: def.family,
  };
  try {
    const ctx = new OfflineAudioContext(2, dry.length, SAMPLE_RATE);
    const rack = new Rack(ctx);
    await rack.setState({
      version: 1,
      modules: [{ id: 'test', type: def.type, enabled: true, params: defaultParams(def) }],
    });
    if (rack.moduleCount === 0) {
      return { ...base, ok: false, changeDb: 0, levelDb: -Infinity, status: 'broken', note: 'Le module n’a pas pu être construit.' };
    }

    const source = ctx.createBufferSource();
    source.buffer = dry;
    source.connect(rack.input);
    rack.output.connect(ctx.destination);
    source.start();

    const rendered = await ctx.startRendering();
    rack.dispose();

    const out = rendered.getChannelData(0);
    const dryData = dry.getChannelData(0);
    if (hasNonFinite(out)) {
      return { ...base, ok: false, changeDb: 0, levelDb: -Infinity, status: 'broken', note: 'Sortie non finie (NaN / Infinity).' };
    }

    const levelDb = toDb(rms(out) / Math.max(1e-9, rms(dryData)));
    const changeDb = toDb(differenceRms(out, dryData) / Math.max(1e-9, rms(dryData)));

    if (levelDb < -60) {
      return { ...base, ok: false, changeDb, levelDb, status: 'silent', note: 'Sortie silencieuse.' };
    }
    if (changeDb < -60) {
      const expected = TRANSPARENT_BY_DESIGN.has(def.type);
      return {
        ...base,
        ok: expected,
        changeDb,
        levelDb,
        status: 'transparent',
        note: expected
          ? 'Transparent au réglage par défaut, comme prévu.'
          : 'Aucun effet audible au réglage par défaut.',
      };
    }
    return { ...base, ok: true, changeDb, levelDb, status: 'ok', note: 'Effet mesuré sur le signal.' };
  } catch (error) {
    return {
      ...base,
      ok: false,
      changeDb: 0,
      levelDb: -Infinity,
      status: 'broken',
      note: error instanceof Error ? error.message : 'Erreur inconnue.',
    };
  }
}

/** Run every registered module through the bench, in registration order. */
export async function testAllModules(
  onProgress?: (done: number, total: number, label: string) => void
): Promise<ModuleTestResult[]> {
  const defs = listModuleDefs();
  const scratch = new OfflineAudioContext(2, Math.floor(DURATION_SEC * SAMPLE_RATE), SAMPLE_RATE);
  const dry = buildTestSignal(scratch);

  const results: ModuleTestResult[] = [];
  for (const def of defs) {
    onProgress?.(results.length, defs.length, def.label);
    results.push(await testModule(def, dry));
  }
  onProgress?.(defs.length, defs.length, '');
  return results;
}
