import { describe, expect, it } from 'vitest';
import {
  OP1_BUDGET_SEC,
  op1Fill,
  op1FolderPathFor,
  padIsUsed,
  readOp1PatchInfo,
  writeOp1PatchMetadata,
} from './op1PatchFile';
import { secondsToDrumMarker } from './hardware/op1og';

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

/**
 * A minimal but real AIFF: FORM/COMM/(APPL)/SSND, big-endian, chunks padded to
 * even lengths — the same shape the OP-1 writes.
 */
function aiff(options: {
  frames: number;
  sampleRate: number;
  channels?: number;
  meta?: Record<string, unknown> | null;
  signature?: string;
}): ArrayBuffer {
  const { frames, sampleRate, channels = 1, meta = null, signature = 'op-1' } = options;
  const chunks: number[][] = [];

  // COMM: channels, frames, bit depth, then an 80-bit extended sample rate.
  const comm = [0, channels, ...be32(frames), 0, 16, ...extended(sampleRate)];
  chunks.push([...ascii('COMM'), ...be32(comm.length), ...comm]);

  if (meta) {
    const json = ascii(JSON.stringify(meta));
    const body = [...ascii(signature), ...json];
    if (body.length % 2) body.push(0);
    chunks.push([...ascii('APPL'), ...be32(body.length), ...body]);
  }

  const ssnd = [...be32(0), ...be32(0), ...new Array(frames * 2 * channels).fill(0)];
  chunks.push([...ascii('SSND'), ...be32(ssnd.length), ...ssnd]);

  const payload = chunks.flat();
  const all = [...ascii('FORM'), ...be32(payload.length + 4), ...ascii('AIFF'), ...payload];
  return new Uint8Array(all).buffer;
}

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** 80-bit IEEE extended, as AIFF writes a sample rate. */
function extended(rate: number): number[] {
  const exponent = Math.floor(Math.log2(rate));
  const mantissa = Math.round((rate / Math.pow(2, exponent)) * Math.pow(2, 31));
  const biased = exponent + 16383;
  return [(biased >> 8) & 255, biased & 255, ...be32(mantissa), 0, 0, 0, 0];
}

const drumMeta = (over: Partial<Record<string, unknown>> = {}) => ({
  drum_version: 2,
  type: 'drum',
  name: 'my kit',
  octave: 0,
  fx_type: 'delay',
  fx_active: false,
  fx_params: [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000],
  lfo_type: 'tremolo',
  lfo_active: false,
  lfo_params: [0, 0, 0, 0, 0, 0, 0, 0],
  start: new Array(24).fill(0),
  end: new Array(24).fill(0),
  pitch: new Array(24).fill(0),
  playmode: new Array(24).fill(8192),
  reverse: new Array(24).fill(8192),
  volume: new Array(24).fill(8192),
  ...over,
});

describe('readOp1PatchInfo — telling the three kinds apart', () => {
  it('reads a drum kit', () => {
    const info = readOp1PatchInfo(aiff({ frames: 44100 * 12, sampleRate: 44100, meta: drumMeta() }))!;
    expect(info.kind).toBe('drum');
    expect(info.name).toBe('my kit');
    expect(info.pads).toHaveLength(24);
    expect(info.budgetSec).toBe(12);
    expect(info.durationSec).toBeCloseTo(12, 3);
  });

  it('reads a sampler patch, which holds half as much', () => {
    const info = readOp1PatchInfo(
      aiff({
        frames: 44100 * 6,
        sampleRate: 44100,
        meta: { synth_version: 2, type: 'sampler', name: 'a piano', octave: 1 },
      })
    )!;
    expect(info.kind).toBe('sampler');
    expect(info.engine).toBe('sampler');
    expect(info.budgetSec).toBe(6);
    expect(info.pads).toBeUndefined();
  });

  // These configure one of the machine's synthesis engines; the 1.31 s of
  // audio they carry is a token, not content.
  it('reads an engine patch and keeps the engine name', () => {
    const info = readOp1PatchInfo(
      aiff({
        frames: 28800,
        sampleRate: 22050,
        meta: {
          synth_version: 2,
          type: 'drwave',
          name: '8bit water',
          knobs: [16409, 204, 8167, 0, 32767, 0, 0, 0],
          adsr: [2112, 4544, 0, 15296, 2048, 4544, 4000, 4000],
        },
      })
    )!;
    expect(info.kind).toBe('engine');
    expect(info.engine).toBe('drwave');
    expect(info.knobs?.[0]).toBe(16409);
    expect(info.adsr).toHaveLength(8);
    // Asking how much room is left in one of these is meaningless.
    expect(info.budgetSec).toBe(0);
  });

  // 36 of the 768 files in a real pack are these: samples sitting beside the
  // patches, which belong in the library rather than the patch folders.
  it('calls an AIFF with no OP-1 chunk plain audio', () => {
    const info = readOp1PatchInfo(aiff({ frames: 1000, sampleRate: 44100 }))!;
    expect(info.kind).toBe('audio');
    expect(info.raw).toBeUndefined();
  });

  it('ignores an APPL chunk signed by some other application', () => {
    const info = readOp1PatchInfo(
      aiff({ frames: 1000, sampleRate: 44100, meta: drumMeta(), signature: 'TRKR' })
    )!;
    expect(info.kind).toBe('audio');
  });

  it('refuses something that is not an AIFF at all', () => {
    expect(readOp1PatchInfo(new Uint8Array(ascii('RIFF....WAVE')).buffer)).toBeNull();
    expect(readOp1PatchInfo(new ArrayBuffer(4))).toBeNull();
  });

  it('survives metadata that will not parse rather than losing the file', () => {
    const broken = aiff({ frames: 1000, sampleRate: 44100 });
    const info = readOp1PatchInfo(broken)!;
    expect(info.kind).toBe('audio');
    expect(info.sampleRate).toBe(44100);
  });

  it('reads the audio shape without decoding a sample', () => {
    const info = readOp1PatchInfo(aiff({ frames: 22050, sampleRate: 22050, channels: 1 }))!;
    expect(info.sampleRate).toBe(22050);
    expect(info.frames).toBe(22050);
    expect(info.channels).toBe(1);
    expect(info.durationSec).toBeCloseTo(1, 5);
  });
});

describe('pad markers', () => {
  it('reads a marker back as the second it was written from', () => {
    const meta = drumMeta({
      start: [secondsToDrumMarker(1), ...new Array(23).fill(0)],
      end: [secondsToDrumMarker(2.5), ...new Array(23).fill(0)],
    });
    const info = readOp1PatchInfo(aiff({ frames: 44100 * 12, sampleRate: 44100, meta }))!;

    expect(info.pads![0].startSec).toBeCloseTo(1, 2);
    expect(info.pads![0].endSec).toBeCloseTo(2.5, 2);
  });

  // 19 of 153 version-1 kits in a real pack do exactly this.
  it('clamps a marker that runs past the end of the audio', () => {
    const meta = drumMeta({
      drum_version: 1,
      start: [0, ...new Array(23).fill(0)],
      end: [secondsToDrumMarker(12), ...new Array(23).fill(0)],
    });
    // Only 4 seconds of sound behind a marker that says 12.
    const info = readOp1PatchInfo(aiff({ frames: 44100 * 4, sampleRate: 44100, meta }))!;
    expect(info.pads![0].endSec).toBeCloseTo(4, 3);
  });

  it('reads reverse and playmode as the values the firmware writes, not flags', () => {
    const meta = drumMeta({
      reverse: [19968, 8192, ...new Array(22).fill(8192)],
      playmode: [20480, 8192, ...new Array(22).fill(8192)],
    });
    const info = readOp1PatchInfo(aiff({ frames: 44100, sampleRate: 44100, meta }))!;

    expect(info.pads![0].reverse).toBe(true);
    expect(info.pads![1].reverse).toBe(false);
    expect(info.pads![0].playmode).toBe(20480);
  });

  it('counts a pad as used only when it has length', () => {
    const meta = drumMeta({
      start: [0, 0, ...new Array(22).fill(0)],
      end: [secondsToDrumMarker(1), 0, ...new Array(22).fill(0)],
    });
    const info = readOp1PatchInfo(aiff({ frames: 44100 * 2, sampleRate: 44100, meta }))!;
    expect(info.pads!.filter(padIsUsed)).toHaveLength(1);
  });
});

describe('op1Fill — the gauge', () => {
  it('reports how much of a kit is used and how many pads are left', () => {
    const fill = op1Fill('drum', 9, 18);
    expect(fill.budgetSec).toBe(12);
    expect(fill.remainingSec).toBe(3);
    expect(fill.ratio).toBeCloseTo(0.75, 5);
    expect(fill.padsFree).toBe(6);
  });

  it('goes negative rather than pretending an overfilled kit fits', () => {
    expect(op1Fill('drum', 14).remainingSec).toBe(-2);
    expect(op1Fill('drum', 14).ratio).toBeGreaterThan(1);
  });

  it('holds a sampler patch to half a kit', () => {
    expect(op1Fill('sampler', 3).budgetSec).toBe(6);
    expect(op1Fill('sampler', 3).ratio).toBeCloseTo(0.5, 5);
    // Pads are a drum idea; a sampler patch has none.
    expect(op1Fill('sampler', 3).padsFree).toBe(0);
  });

  it('says nothing about an engine patch, which holds no sound', () => {
    const fill = op1Fill('engine', 1.31);
    expect(fill.budgetSec).toBe(0);
    expect(fill.ratio).toBe(0);
  });

  it('never claims more than 24 pads are free', () => {
    expect(op1Fill('drum', 0, 0).padsFree).toBe(24);
    expect(op1Fill('drum', 0, 30).padsFree).toBe(0);
  });
});

/** The bytes of one chunk, for checking the audio survived untouched. */
function chunkBytes(data: ArrayBuffer, wanted: string): Uint8Array | null {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  const tag = (at: number) =>
    String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  let offset = 12;
  while (offset + 8 <= data.byteLength) {
    const size = view.getUint32(offset + 4, false);
    if (tag(offset) === wanted) return bytes.slice(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  return null;
}

/** The chunk ids in the order they appear, which is what the firmware cares about. */
function chunkOrder(data: ArrayBuffer): string[] {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  const ids: string[] = [];
  let offset = 12;
  while (offset + 8 <= data.byteLength) {
    const size = view.getUint32(offset + 4, false);
    ids.push(String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]));
    offset += 8 + size + (size % 2);
  }
  return ids;
}

describe('writeOp1PatchMetadata', () => {
  it('reads back the settings it was given', () => {
    const before = aiff({ frames: 44100, sampleRate: 44100, meta: drumMeta() });
    const after = writeOp1PatchMetadata(before, drumMeta({ name: 'renamed', octave: 2 }))!;

    const info = readOp1PatchInfo(after)!;
    expect(info.kind).toBe('drum');
    expect(info.name).toBe('renamed');
    expect(info.octave).toBe(2);
  });

  // The whole point: renaming a patch must not re-encode what it plays.
  it('leaves the audio byte for byte as it was', () => {
    const before = aiff({ frames: 4000, sampleRate: 44100, meta: drumMeta() });
    const after = writeOp1PatchMetadata(before, drumMeta({ name: 'x' }))!;

    expect(chunkBytes(after, 'SSND')).toEqual(chunkBytes(before, 'SSND'));
    expect(chunkBytes(after, 'COMM')).toEqual(chunkBytes(before, 'COMM'));
  });

  it('keeps the audio shape the file declared', () => {
    const before = aiff({ frames: 22050, sampleRate: 22050, meta: drumMeta() });
    const info = readOp1PatchInfo(writeOp1PatchMetadata(before, drumMeta())!)!;

    expect(info.sampleRate).toBe(22050);
    expect(info.frames).toBe(22050);
    expect(info.durationSec).toBeCloseTo(1, 5);
  });

  it('declares a FORM size that matches what it wrote', () => {
    const after = writeOp1PatchMetadata(
      aiff({ frames: 1000, sampleRate: 44100, meta: drumMeta() }),
      drumMeta({ name: 'a much longer name than the one before' })
    )!;
    expect(new DataView(after).getUint32(4, false)).toBe(after.byteLength - 8);
  });

  // The firmware will not read a patch whose settings come after its audio.
  it('puts the settings before the audio when the file had none', () => {
    const plain = aiff({ frames: 1000, sampleRate: 44100 });
    const after = writeOp1PatchMetadata(plain, drumMeta())!;

    const order = chunkOrder(after);
    expect(order).toContain('APPL');
    expect(order.indexOf('APPL')).toBeLessThan(order.indexOf('SSND'));
    expect(readOp1PatchInfo(after)!.kind).toBe('drum');
  });

  it('survives settings much longer or shorter than what was there', () => {
    const before = aiff({ frames: 1000, sampleRate: 44100, meta: drumMeta() });
    const long = writeOp1PatchMetadata(before, drumMeta({ name: 'z'.repeat(500) }))!;
    const short = writeOp1PatchMetadata(long, { drum_version: 2, type: 'drum', name: 'a' })!;

    expect(readOp1PatchInfo(long)!.name).toHaveLength(500);
    expect(readOp1PatchInfo(short)!.name).toBe('a');
    expect(chunkBytes(short, 'SSND')).toEqual(chunkBytes(before, 'SSND'));
  });

  it('refuses something that is not an AIFF', () => {
    expect(writeOp1PatchMetadata(new Uint8Array(ascii('RIFFxxxxWAVE')).buffer, {})).toBeNull();
  });
});

describe('op1FolderPathFor', () => {
  it('keeps kits and synth patches apart', () => {
    expect(op1FolderPathFor('drum')).toBe('/03_OP-1/drum');
    expect(op1FolderPathFor('sampler')).toBe('/03_OP-1/synth');
    expect(op1FolderPathFor('engine')).toBe('/03_OP-1/synth');
  });

  it('sends a plain sample to the library, not to the patch folders', () => {
    expect(op1FolderPathFor('audio')).not.toContain('OP-1');
  });
});

describe('OP1_BUDGET_SEC', () => {
  it('matches what the machine accepts', () => {
    expect(OP1_BUDGET_SEC.drum).toBe(12);
    expect(OP1_BUDGET_SEC.sampler).toBe(6);
  });
});
