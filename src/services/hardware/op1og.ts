/**
 * Teenage Engineering OP-1 **original** (OG, not Field) patch encoding.
 *
 * There is no official binary spec — these constants come from community
 * reverse-engineering (op1.fun, operator1/op1 wiki, schollz/teoperator) and
 * are the corrected values that real OG hardware accepts:
 *
 *  - Drum patch: AIFF PCM, 16-bit, 44100 Hz, MONO, total <= 12.0 s.
 *    `APPL` chunk carrying `op-1` + JSON, written BEFORE `SSND`.
 *  - `start[]`/`end[]` are 24 integers on a FIXED 12 s timeline (NOT the real
 *    buffer length). End of 12 s === 2147483646. Markers snap to multiples of
 *    8192 (~13-bit resolution).
 *  - `playmode[]` / `reverse[]` are NOT 0/1 — they use the magic values below.
 *  - Sampler patch: <= 6 s, mono, 44100 Hz. JSON has NO `root`, NO `loop_*`,
 *    NO `start`/`end`. Pitch reference is `base_freq` (float Hz).
 *
 * See memory: resonance-op1-format.
 */

export const OP1_SAMPLE_RATE = 44100;
export const OP1_MAX_DRUM_SEC = 12.0;
export const OP1_MAX_SAMPLER_SEC = 6.0;

/** Integer value of the end of the 12 s drum timeline. */
export const OP1_MARKER_END = 2147483646;
/** Markers are quantised to multiples of this (~13-bit resolution). */
export const OP1_MARKER_SNAP = 8192;
/** samples-on-12s-timeline -> marker units:  2147483646 / (44100 * 12) ≈ 4058.06 */
export const OP1_MARKER_FACTOR = OP1_MARKER_END / (OP1_SAMPLE_RATE * OP1_MAX_DRUM_SEC);

/** `playmode[]` magic values (NOT 0/1). */
export const OP1_PLAYMODE = {
  /** normal one-shot / trigger (default) */
  oneshot: 8192,
  /** gated — plays while key held */
  gate: 4096,
  /** loop */
  loop: 20480,
} as const;

/** `reverse[]` magic values (NOT 0/1). 19968 for reversed still needs a device test. */
export const OP1_REVERSE = {
  forward: 8192,
  reversed: 19968,
} as const;

/** `volume[]` — 8192 is 0 dB unity, hard max is 32767. */
export const OP1_VOLUME_UNITY = 8192;
export const OP1_VOLUME_MAX = 32767;

/** Sensible defaults for the envelope / fx / lfo arrays the OG firmware expects to be present. */
export const OP1_DEFAULT_DYNA_ENV = [0, 8192, 0, 8192, 0, 0, 0, 0];
export const OP1_DEFAULT_FX_PARAMS = [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000];
export const OP1_DEFAULT_LFO_PARAMS = [16000, 16000, 16000, 16000, 0, 0, 0, 0];
export const OP1_DEFAULT_ADSR = [64, 10746, 32767, 10000, 4000, 64, 3276, 0];
export const OP1_DEFAULT_KNOBS = [0, 0, 32767, 0, 12000, 0, 0, 0];

/** Convert a time in seconds to an OP-1 drum-timeline marker (snapped, clamped). */
export function secondsToDrumMarker(sec: number): number {
  const raw = sec * OP1_SAMPLE_RATE * OP1_MARKER_FACTOR;
  const snapped = Math.round(raw / OP1_MARKER_SNAP) * OP1_MARKER_SNAP;
  return Math.max(0, Math.min(OP1_MARKER_END, Math.round(snapped)));
}

/** Inverse of {@link secondsToDrumMarker} — read a marker back into seconds. */
export function drumMarkerToSeconds(marker: number): number {
  return marker / (OP1_SAMPLE_RATE * OP1_MARKER_FACTOR);
}

/** MIDI note number -> `base_freq` in Hz (A4 = note 69 = 440 Hz). C4 (60) ≈ 261.6256. */
export function midiNoteToBaseFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** OP-1 patch names: ASCII, a small charset, max 24 chars, never empty. */
export function sanitizeOp1Name(name: string): string {
  const cleaned = (name || '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^A-Za-z0-9 #_-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
    .trim();
  return cleaned || 'resonance';
}

/**
 * Apple AIFF COMM chunk stores the sample rate as an 80-bit IEEE 754 extended float.
 */
export function floatToExtended80(val: number): Uint8Array {
  const bytes = new Uint8Array(10);
  if (val === 0) return bytes;

  let sign = 0;
  if (val < 0) {
    sign = 0x8000;
    val = -val;
  }

  let exp = Math.floor(Math.log2(val));
  let mantissa = val / Math.pow(2, exp);
  if (mantissa < 1.0) {
    mantissa *= 2.0;
    exp -= 1;
  }

  const exponentField = exp + 16383;
  const signExp = sign | (exponentField & 0x7fff);
  bytes[0] = (signExp >> 8) & 0xff;
  bytes[1] = signExp & 0xff;

  const mantissaFrac = mantissa * Math.pow(2, 63);
  const high32 = Math.floor(mantissaFrac / 4294967296);
  const low32 = Math.floor(mantissaFrac % 4294967296);
  bytes[2] = (high32 >> 24) & 0xff;
  bytes[3] = (high32 >> 16) & 0xff;
  bytes[4] = (high32 >> 8) & 0xff;
  bytes[5] = high32 & 0xff;
  bytes[6] = (low32 >> 24) & 0xff;
  bytes[7] = (low32 >> 16) & 0xff;
  bytes[8] = (low32 >> 8) & 0xff;
  bytes[9] = low32 & 0xff;
  return bytes;
}

/** Downmix any AudioBuffer to a mono Float32Array (average of channels). */
export function downmixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice();
  const len = buffer.length;
  const out = new Float32Array(len);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += data[i];
  }
  const inv = 1 / buffer.numberOfChannels;
  for (let i = 0; i < len; i++) out[i] *= inv;
  return out;
}

/**
 * Write a mono 16-bit 44.1 kHz AIFF with an `APPL`/`op-1` JSON chunk placed
 * before `SSND`. `mono` is the sample data; `meta` is the OP-1 patch object.
 */
export function writeOp1Aiff(mono: Float32Array, meta: Record<string, unknown>): Blob {
  const numFrames = mono.length;
  const jsonBytes = new TextEncoder().encode(JSON.stringify(meta));

  const commChunkSize = 18;
  const commTotalSize = 8 + commChunkSize;

  const applPayloadSize = 4 + jsonBytes.length; // 'op-1' + json
  const applPad = applPayloadSize % 2;
  const applTotalSize = 8 + applPayloadSize + applPad;

  const pcmBytesLength = numFrames * 2; // mono, 16-bit
  const ssndPayloadSize = 8 + pcmBytesLength; // offset + blockSize + data
  const ssndPad = pcmBytesLength % 2;
  const ssndTotalSize = 8 + ssndPayloadSize + ssndPad;

  const formPayloadSize = 4 + commTotalSize + applTotalSize + ssndTotalSize;
  const out = new ArrayBuffer(8 + formPayloadSize);
  const view = new DataView(out);
  const u8 = new Uint8Array(out);
  let offset = 0;
  const tag = (s: string) => {
    for (let i = 0; i < s.length; i++) u8[offset++] = s.charCodeAt(i);
  };

  tag('FORM');
  view.setUint32(offset, formPayloadSize, false);
  offset += 4;
  tag('AIFF');

  tag('COMM');
  view.setUint32(offset, commChunkSize, false);
  offset += 4;
  view.setInt16(offset, 1, false); // mono
  offset += 2;
  view.setUint32(offset, numFrames, false);
  offset += 4;
  view.setInt16(offset, 16, false);
  offset += 2;
  u8.set(floatToExtended80(OP1_SAMPLE_RATE), offset);
  offset += 10;

  tag('APPL');
  view.setUint32(offset, applPayloadSize, false);
  offset += 4;
  tag('op-1');
  u8.set(jsonBytes, offset);
  offset += jsonBytes.length;
  if (applPad) u8[offset++] = 0;

  tag('SSND');
  view.setUint32(offset, ssndPayloadSize, false);
  offset += 4;
  view.setUint32(offset, 0, false); // offset
  offset += 4;
  view.setUint32(offset, 0, false); // blockSize
  offset += 4;
  for (let i = 0; i < numFrames; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, false);
    offset += 2;
  }
  if (ssndPad) u8[offset++] = 0;

  return new Blob([out], { type: 'audio/aiff' });
}

export interface Op1DrumSliceInput {
  startSec: number;
  endSec: number;
  pitch?: number; // semitones, -24..+24
  reverse?: boolean;
  /** 'oneshot' (default) | 'gate' | 'loop' */
  playmode?: keyof typeof OP1_PLAYMODE;
  volume?: number; // 0..32767, 8192 = unity
}

/**
 * Encode a 12 s mono composite + 24 slice definitions into an OG OP-1 drum patch.
 * `buffer` is downmixed to mono and hard-limited to 12 s.
 */
export function encodeOp1DrumPatch(
  buffer: AudioBuffer,
  slices: Op1DrumSliceInput[],
  name: string
): Blob {
  const maxFrames = Math.floor(OP1_MAX_DRUM_SEC * OP1_SAMPLE_RATE);
  let mono = downmixToMono(buffer);
  if (mono.length > maxFrames) mono = mono.slice(0, maxFrames);

  const start: number[] = [];
  const end: number[] = [];
  const pitch: number[] = [];
  const playmode: number[] = [];
  const reverse: number[] = [];
  const volume: number[] = [];

  for (let i = 0; i < 24; i++) {
    const s = slices[i];
    const startSec = s ? s.startSec : 0;
    const endSec = s ? Math.max(s.startSec, s.endSec) : 0;
    start.push(secondsToDrumMarker(startSec));
    end.push(secondsToDrumMarker(endSec));
    pitch.push(s ? Math.round(Math.max(-24, Math.min(24, s.pitch ?? 0))) : 0);
    playmode.push(OP1_PLAYMODE[s?.playmode ?? 'oneshot'] ?? OP1_PLAYMODE.oneshot);
    reverse.push(s?.reverse ? OP1_REVERSE.reversed : OP1_REVERSE.forward);
    volume.push(Math.max(0, Math.min(OP1_VOLUME_MAX, Math.round(s?.volume ?? OP1_VOLUME_UNITY))));
  }

  const meta = {
    drum_version: 2,
    type: 'drum',
    name: sanitizeOp1Name(name),
    octave: 0,
    pitch,
    playmode,
    reverse,
    volume,
    start,
    end,
    dyna_env: [...OP1_DEFAULT_DYNA_ENV],
    fx_active: false,
    fx_type: 'delay',
    fx_params: [...OP1_DEFAULT_FX_PARAMS],
    lfo_active: false,
    lfo_type: 'tremolo',
    lfo_params: [...OP1_DEFAULT_LFO_PARAMS],
  };

  return writeOp1Aiff(mono, meta);
}

export interface Op1SamplerInput {
  name: string;
  /** MIDI note the sample plays back at unshifted (60 = C4). */
  rootMidiNote?: number;
  octave?: number;
}

/**
 * Encode a mono sample (<= 6 s) into an OG OP-1 sampler patch. Pitch reference
 * is `base_freq` — there is deliberately no `root` / `loop_*` / `start` / `end`.
 */
export function encodeOp1SamplerPatch(buffer: AudioBuffer, opts: Op1SamplerInput): Blob {
  const maxFrames = Math.floor(OP1_MAX_SAMPLER_SEC * OP1_SAMPLE_RATE);
  let mono = downmixToMono(buffer);
  if (mono.length > maxFrames) mono = mono.slice(0, maxFrames);

  const meta = {
    synth_version: 1,
    type: 'sampler',
    name: sanitizeOp1Name(opts.name),
    octave: Math.max(-2, Math.min(2, opts.octave ?? 0)),
    base_freq: midiNoteToBaseFreq(opts.rootMidiNote ?? 60),
    adsr: [...OP1_DEFAULT_ADSR],
    knobs: [...OP1_DEFAULT_KNOBS],
    fx_active: false,
    fx_type: 'delay',
    fx_params: [...OP1_DEFAULT_FX_PARAMS],
    lfo_active: false,
    lfo_type: 'tremolo',
    lfo_params: [...OP1_DEFAULT_LFO_PARAMS],
  };

  return writeOp1Aiff(mono, meta);
}
