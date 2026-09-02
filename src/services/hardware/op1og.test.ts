import { describe, expect, it } from 'vitest';
import {
  OP1_MARKER_END,
  OP1_MARKER_SNAP,
  OP1_PLAYMODE,
  OP1_REVERSE,
  OP1_MAX_DRUM_SEC,
  secondsToDrumMarker,
  drumMarkerToSeconds,
  midiNoteToBaseFreq,
  sanitizeOp1Name,
  downmixToMono,
  encodeOp1DrumPatch,
  encodeOp1SamplerPatch,
  type Op1DrumSliceInput,
} from './op1og';

/** Minimal stand-in for AudioBuffer (node test env has no Web Audio). */
function fakeBuffer(channels: Float32Array[], sampleRate = 44100): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    length: channels[0].length,
    sampleRate,
    duration: channels[0].length / sampleRate,
    getChannelData: (c: number) => channels[c],
  } as unknown as AudioBuffer;
}

async function readChunks(blob: Blob): Promise<{ tags: string[]; json: any; bytes: Uint8Array }> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder('latin1').decode(bytes);
  const tags: string[] = [];
  for (const t of ['FORM', 'AIFF', 'COMM', 'APPL', 'SSND', 'op-1']) {
    if (text.includes(t)) tags.push(t);
  }
  let json: any = null;
  const applIdx = text.indexOf('op-1');
  if (applIdx >= 0) {
    const jsonStart = text.indexOf('{', applIdx);
    const jsonEnd = text.lastIndexOf('}', text.indexOf('SSND'));
    json = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  }
  return { tags, json, bytes };
}

describe('op1og — marker math', () => {
  it('maps 0 s to 0 and 12 s to the documented timeline end', () => {
    expect(secondsToDrumMarker(0)).toBe(0);
    expect(secondsToDrumMarker(OP1_MAX_DRUM_SEC)).toBe(OP1_MARKER_END);
  });

  it('snaps interior markers to a multiple of 8192', () => {
    for (const sec of [0.1, 0.37, 1.5, 4.2, 8.9, 11.5]) {
      expect(secondsToDrumMarker(sec) % OP1_MARKER_SNAP).toBe(0);
    }
  });

  it('clamps out-of-range times to [0, MARKER_END]', () => {
    expect(secondsToDrumMarker(-5)).toBe(0);
    expect(secondsToDrumMarker(99)).toBe(OP1_MARKER_END);
  });

  it('round-trips seconds within snap resolution', () => {
    const sec = 3.75;
    const back = drumMarkerToSeconds(secondsToDrumMarker(sec));
    expect(Math.abs(back - sec)).toBeLessThan(0.001);
  });
});

describe('op1og — helpers', () => {
  it('midiNoteToBaseFreq: A4 = 440, C4 ≈ 261.63', () => {
    expect(midiNoteToBaseFreq(69)).toBeCloseTo(440, 6);
    expect(midiNoteToBaseFreq(60)).toBeCloseTo(261.6255653, 4);
  });

  it('sanitizeOp1Name strips exotic chars & slashes, clamps to 24, never empty', () => {
    expect(sanitizeOp1Name('Deep House Kit ✨')).toBe('Deep House Kit');
    expect(sanitizeOp1Name('kit/one\\two')).toBe('kitonetwo');
    expect(sanitizeOp1Name('café ☕ #2')).toBe('cafe #2');
    expect(sanitizeOp1Name('x'.repeat(50)).length).toBe(24);
    expect(sanitizeOp1Name('   ')).toBe('resonance');
  });

  it('downmixToMono averages channels', () => {
    const mono = downmixToMono(
      fakeBuffer([new Float32Array([1, 0, -1]), new Float32Array([1, 1, -1])])
    );
    expect(Array.from(mono)).toEqual([1, 0.5, -1]);
  });
});

describe('op1og — drum patch', () => {
  const slices: Op1DrumSliceInput[] = Array.from({ length: 24 }, (_, i) => ({
    startSec: i * 0.4,
    endSec: i * 0.4 + 0.35,
    playmode: i === 5 ? 'loop' : 'oneshot',
    reverse: i === 3,
    volume: 8192,
  }));

  it('writes a mono 16-bit AIFF with APPL op-1 before SSND', async () => {
    const buf = fakeBuffer([new Float32Array(44100 * 3)]); // 3 s
    const { tags, json, bytes } = await readChunks(encodeOp1DrumPatch(buf, slices, 'Test Kit'));
    expect(tags).toEqual(['FORM', 'AIFF', 'COMM', 'APPL', 'SSND', 'op-1']);
    // APPL must appear before SSND
    const t = new TextDecoder('latin1').decode(bytes);
    expect(t.indexOf('APPL')).toBeLessThan(t.indexOf('SSND'));
    expect(json.type).toBe('drum');
    expect(json.drum_version).toBe(2);
  });

  it('emits magic playmode / reverse values, never 0/1', async () => {
    const buf = fakeBuffer([new Float32Array(44100 * 3)]);
    const { json } = await readChunks(encodeOp1DrumPatch(buf, slices, 'K'));
    expect(json.playmode[0]).toBe(OP1_PLAYMODE.oneshot);
    expect(json.playmode[5]).toBe(OP1_PLAYMODE.loop);
    expect(json.reverse[0]).toBe(OP1_REVERSE.forward);
    expect(json.reverse[3]).toBe(OP1_REVERSE.reversed);
    expect(json.start).toHaveLength(24);
    expect(json.end.every((m: number) => m % OP1_MARKER_SNAP === 0)).toBe(true);
    expect(json.end.every((m: number) => m <= OP1_MARKER_END)).toBe(true);
  });

  it('carries the envelope / fx / lfo arrays the firmware expects', async () => {
    const buf = fakeBuffer([new Float32Array(1000)]);
    const { json } = await readChunks(encodeOp1DrumPatch(buf, slices, 'K'));
    expect(json.dyna_env).toHaveLength(8);
    expect(json.fx_params).toHaveLength(8);
    expect(json.lfo_params).toHaveLength(8);
    expect(json).toHaveProperty('fx_active', false);
  });

  it('hard-limits the audio to 12 s', async () => {
    const buf = fakeBuffer([new Float32Array(44100 * 20)]); // 20 s
    const { bytes } = await readChunks(encodeOp1DrumPatch(buf, slices, 'K'));
    // SSND payload ≈ 12s * 44100 * 2 bytes + 8 header; file can't be much bigger
    expect(bytes.byteLength).toBeLessThan(12.1 * 44100 * 2 + 4096);
  });

  it('downmixes stereo input to a mono patch', async () => {
    const buf = fakeBuffer([new Float32Array(2000), new Float32Array(2000)]);
    const bytes = new Uint8Array(await encodeOp1DrumPatch(buf, slices, 'K').arrayBuffer());
    // COMM numChannels field is the 2 bytes right after 'COMM' + 4-byte size
    const t = new TextDecoder('latin1').decode(bytes);
    const commAt = t.indexOf('COMM');
    const channels = (bytes[commAt + 8] << 8) | bytes[commAt + 9];
    expect(channels).toBe(1);
  });
});

describe('op1og — sampler patch', () => {
  it('uses base_freq and omits root / loop_* / start / end', async () => {
    const buf = fakeBuffer([new Float32Array(44100 * 2)]);
    const { json, tags } = await readChunks(
      encodeOp1SamplerPatch(buf, { name: 'Pad', rootMidiNote: 60 })
    );
    expect(tags).toContain('op-1');
    expect(json.type).toBe('sampler');
    expect(json.synth_version).toBe(1);
    expect(json.base_freq).toBeCloseTo(261.6255653, 3);
    expect(json).not.toHaveProperty('root');
    expect(json).not.toHaveProperty('loop');
    expect(json).not.toHaveProperty('loop_start');
    expect(json).not.toHaveProperty('start');
    expect(json).not.toHaveProperty('end');
    expect(json.adsr).toHaveLength(8);
    expect(json.knobs).toHaveLength(8);
  });

  it('hard-limits the sampler to 6 s', async () => {
    const buf = fakeBuffer([new Float32Array(44100 * 12)]);
    const bytes = new Uint8Array(
      await encodeOp1SamplerPatch(buf, { name: 'x', rootMidiNote: 60 }).arrayBuffer()
    );
    expect(bytes.byteLength).toBeLessThan(6.1 * 44100 * 2 + 4096);
  });
});
