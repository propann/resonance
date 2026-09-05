/**
 * Reading what an OP-1 patch says about itself.
 *
 * A patch is an ordinary AIFF carrying an `APPL` chunk signed `op-1`, whose
 * payload is JSON. That JSON is the whole story, and it says which of three
 * quite different things the file is:
 *
 * - a **drum kit** (`drum_version`): 24 pads laid end to end in one buffer;
 * - a **sampler patch** (`synth_version`, `type: "sampler"`): one sound played
 *   across the keyboard;
 * - an **engine patch** (`synth_version`, any other `type`): no sound at all,
 *   just the settings for one of the OP-1's synthesis engines.
 *
 * Measured over 768 patches, the three are cleanly separated:
 *
 * | kind    |   n | duration      | rate      |
 * |---------|-----|---------------|-----------|
 * | drum    | 173 | 1.57 – 12.00s | 44 100 Hz |
 * | sampler | 458 | 2.00 –  6.00s | 44 100 Hz |
 * | engine  | 100 | 1.31s exactly | 22 050 Hz |
 *
 * The engine patches all being the same length is the tell: that 1.31 s is a
 * token waveform, not content. Asking how much room is left in one is
 * meaningless — what it carries is `knobs`, `adsr`, `lfo_params`, `fx_params`.
 *
 * A file in a patch pack with no `APPL` chunk at all is not a patch: it is a
 * plain sample someone dropped in beside them (37 of the 768).
 */

import {
  drumMarkerToSeconds,
  OP1_PLAYMODE,
  OP1_REVERSE,
  OP1_VOLUME_UNITY,
} from './hardware/op1og';

/** What kind of thing an .aif in an OP-1 pack turns out to be. */
export type Op1PatchKind = 'drum' | 'sampler' | 'engine' | 'audio';

/** How much audio each kind of patch can hold. `0` where the question is moot. */
export const OP1_BUDGET_SEC: Record<Op1PatchKind, number> = {
  drum: 12,
  sampler: 6,
  engine: 0,
  audio: 0,
};

/** The OP-1's synthesis engines, as they name themselves in a patch. */
export const OP1_ENGINES = [
  'cluster', 'digital', 'dna', 'drwave', 'dsynth', 'fm',
  'iter', 'phase', 'pulse', 'string', 'voltage',
] as const;

export interface Op1Pad {
  index: number;
  /** Seconds. The file stores these on a fixed 12 s timeline — see `readPads`. */
  startSec: number;
  endSec: number;
  pitch: number;
  reverse: boolean;
  playmode: number;
  volume: number;
}

export interface Op1PatchInfo {
  kind: Op1PatchKind;
  /** Which engine an `engine` or `sampler` patch drives. */
  engine?: string;
  name?: string;
  octave?: number;
  fxType?: string;
  fxActive?: boolean;
  fxParams?: number[];
  lfoType?: string;
  lfoActive?: boolean;
  lfoParams?: number[];
  /** Envelope, sampler and engine patches only. */
  adsr?: number[];
  /** The four front-panel knobs, engine patches only. */
  knobs?: number[];
  /** Drum kits only, always 24 long. */
  pads?: Op1Pad[];
  sampleRate: number;
  frames: number;
  channels: number;
  bitDepth: number;
  durationSec: number;
  /** Seconds this kind of patch can hold; `0` when the notion does not apply. */
  budgetSec: number;
  /** Everything the file said, for fields this interface does not name. */
  raw?: Record<string, unknown>;
}

const asNumbers = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every((v) => typeof v === 'number') ? (value as number[]) : undefined;

/** An 80-bit IEEE extended float, which is how AIFF writes its sample rate. */
function readExtendedFloat(view: DataView, at: number): number {
  const exponent = view.getUint16(at, false) - 16383;
  const mantissa = view.getUint32(at + 2, false);
  return Math.round(mantissa * Math.pow(2, exponent - 31));
}

/**
 * What an OP-1 patch file is, without decoding a single sample of its audio.
 *
 * Returns `null` for anything that is not an AIFF at all. A well-formed AIFF
 * with no OP-1 chunk comes back as `kind: 'audio'` — it is a sample, not a
 * patch, and belongs in the library rather than in the patch folders.
 */
export function readOp1PatchInfo(data: ArrayBuffer): Op1PatchInfo | null {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  const tag = (at: number) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);

  if (data.byteLength < 12 || tag(0) !== 'FORM') return null;

  let offset = 12;
  let meta: Record<string, unknown> | null = null;
  let sampleRate = 0;
  let frames = 0;
  let channels = 0;
  let bitDepth = 0;

  while (offset + 8 <= data.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, false);

    if (id === 'COMM' && offset + 26 <= data.byteLength) {
      channels = view.getUint16(offset + 8, false);
      frames = view.getUint32(offset + 10, false);
      bitDepth = view.getUint16(offset + 14, false);
      sampleRate = readExtendedFloat(view, offset + 16);
    }

    if (id === 'APPL' && offset + 12 <= data.byteLength && tag(offset + 8) === 'op-1') {
      let json = '';
      const end = Math.min(offset + 8 + size, data.byteLength);
      for (let i = offset + 12; i < end; i++) json += String.fromCharCode(bytes[i]);
      const open = json.indexOf('{');
      const close = json.lastIndexOf('}');
      if (open >= 0 && close > open) {
        try {
          meta = JSON.parse(json.slice(open, close + 1)) as Record<string, unknown>;
        } catch {
          // A patch whose metadata will not parse is still a readable AIFF;
          // treat it as plain audio rather than losing the file.
        }
      }
    }

    // Chunks are word-aligned: an odd size is followed by a pad byte.
    const next = offset + 8 + size + (size % 2);
    if (next <= offset) break;
    offset = next;
  }

  const durationSec = sampleRate > 0 ? frames / sampleRate : 0;
  const shape = { sampleRate, frames, channels, bitDepth, durationSec };

  if (!meta) return { kind: 'audio', budgetSec: 0, ...shape };

  const engine = typeof meta.type === 'string' ? meta.type : undefined;
  const kind: Op1PatchKind =
    meta.drum_version !== undefined ? 'drum' : engine === 'sampler' ? 'sampler' : 'engine';

  return {
    kind,
    engine,
    name: typeof meta.name === 'string' ? meta.name.trim() : undefined,
    octave: typeof meta.octave === 'number' ? meta.octave : undefined,
    fxType: typeof meta.fx_type === 'string' ? meta.fx_type : undefined,
    fxActive: typeof meta.fx_active === 'boolean' ? meta.fx_active : undefined,
    fxParams: asNumbers(meta.fx_params),
    lfoType: typeof meta.lfo_type === 'string' ? meta.lfo_type : undefined,
    lfoActive: typeof meta.lfo_active === 'boolean' ? meta.lfo_active : undefined,
    lfoParams: asNumbers(meta.lfo_params),
    adsr: asNumbers(meta.adsr),
    knobs: asNumbers(meta.knobs),
    pads: kind === 'drum' ? readPads(meta, durationSec) : undefined,
    budgetSec: OP1_BUDGET_SEC[kind],
    raw: meta,
    ...shape,
  };
}

/**
 * Pad markers are not sample positions.
 *
 * They sit on a **fixed 12-second timeline** — the end of 12 s is 2147483646
 * whatever the audio actually lasts — so reading them as sample ticks puts the
 * last pad of a 10.8 s kit at 84 seconds. `drumMarkerToSeconds` is the
 * conversion the encoder already uses; sharing it is what keeps a patch that
 * this app writes readable by the same code that reads one from the device.
 *
 * Ends are clamped to the audio. Of 173 kits measured, every `drum_version` 2
 * and 3 lands inside its buffer, but 19 of the 153 version-1 kits carry
 * markers past the end of their own audio — one at 22.6 s for 11.3 s of sound.
 * The device just stops at the end; so does this.
 */
function readPads(meta: Record<string, unknown>, durationSec: number): Op1Pad[] {
  const limit = durationSec > 0 ? durationSec : Infinity;
  const start = asNumbers(meta.start) ?? [];
  const end = asNumbers(meta.end) ?? [];
  const pitch = asNumbers(meta.pitch) ?? [];
  const playmode = asNumbers(meta.playmode) ?? [];
  const volume = asNumbers(meta.volume) ?? [];
  const reverse = asNumbers(meta.reverse) ?? [];

  return Array.from({ length: 24 }, (_, index) => ({
    index,
    startSec: Math.min(drumMarkerToSeconds(start[index] ?? 0), limit),
    endSec: Math.min(drumMarkerToSeconds(end[index] ?? 0), limit),
    pitch: pitch[index] ?? 0,
    // Not a flag: the firmware writes 8192 for forward and 19968 for reversed,
    // and older patches sometimes carry a plain 1.
    reverse: (reverse[index] ?? OP1_REVERSE.forward) > OP1_REVERSE.forward,
    playmode: playmode[index] ?? OP1_PLAYMODE.oneshot,
    volume: volume[index] ?? OP1_VOLUME_UNITY,
  }));
}

/** A pad holds a sound when its end lies past its start. */
export const padIsUsed = (pad: Op1Pad): boolean => pad.endSec > pad.startSec;

/**
 * How full a patch is, for the gauge shown while one is being put together.
 *
 * `remainingSec` goes negative when a kit has been overfilled — the caller
 * should say so rather than clamp, since the OP-1 will simply truncate.
 */
export function op1Fill(
  kind: Op1PatchKind,
  usedSec: number,
  padsUsed = 0
): { usedSec: number; budgetSec: number; remainingSec: number; ratio: number; padsFree: number } {
  const budgetSec = OP1_BUDGET_SEC[kind];
  return {
    usedSec,
    budgetSec,
    remainingSec: budgetSec - usedSec,
    ratio: budgetSec > 0 ? usedSec / budgetSec : 0,
    padsFree: kind === 'drum' ? Math.max(0, 24 - padsUsed) : 0,
  };
}

/**
 * Where a patch belongs in the library. Kits and synth patches are kept apart:
 * they load into different parts of the machine and are never interchangeable.
 */
export function op1FolderPathFor(kind: Op1PatchKind): string {
  if (kind === 'drum') return '/03_OP-1/drum';
  if (kind === 'sampler' || kind === 'engine') return '/03_OP-1/synth';
  return '/01_ONE_SHOTS/05_FX_TEXTURES';
}
