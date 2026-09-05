import { describe, expect, it } from 'vitest';
import { decodeAiff, looksLikeAiff } from './aiffDecoder';

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** 80-bit IEEE extended, as AIFF writes a sample rate. */
function extended(rate: number): number[] {
  const exponent = Math.floor(Math.log2(rate));
  const mantissa = Math.round((rate / Math.pow(2, exponent)) * Math.pow(2, 31));
  const biased = exponent + 16383;
  return [(biased >> 8) & 255, biased & 255, ...be32(mantissa), 0, 0, 0, 0];
}

/** A real AIFF or AIFC around the sample bytes it is given. */
function aiff(options: {
  samples: number[][];
  sampleRate?: number;
  bitDepth?: number;
  compression?: string;
  form?: 'AIFF' | 'AIFC';
}): ArrayBuffer {
  const { samples, sampleRate = 44100, bitDepth = 16, compression, form = 'AIFF' } = options;
  const channels = samples.length;
  const frames = samples[0].length;

  const comm = [0, channels, ...be32(frames), 0, bitDepth, ...extended(sampleRate)];
  if (form === 'AIFC') comm.push(...ascii(compression ?? 'NONE'), 0, 0);

  const sound: number[] = [...be32(0), ...be32(0)];
  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < channels; c++) sound.push(...bytesOf(samples[c][f], bitDepth, compression));
  }

  const chunk = (id: string, body: number[]) => {
    const out = [...ascii(id), ...be32(body.length), ...body];
    if (body.length % 2) out.push(0);
    return out;
  };

  const payload = [...chunk('COMM', comm), ...chunk('SSND', sound)];
  return new Uint8Array([...ascii('FORM'), ...be32(payload.length + 4), ...ascii(form), ...payload])
    .buffer;
}

/** One integer sample, written the way the header says it is. */
function bytesOf(value: number, bitDepth: number, compression?: string): number[] {
  const little = compression === 'sowt';
  if (bitDepth === 8) return [value & 255];
  if (bitDepth === 24) {
    const v = value & 0xffffff;
    const be = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    return little ? be.reverse() : be;
  }
  const be = [(value >> 8) & 255, value & 255];
  return little ? be.reverse() : be;
}

describe('decodeAiff', () => {
  it('reads a 16-bit mono AIFF, which is nearly every file in the library', () => {
    const out = decodeAiff(aiff({ samples: [[0, 16384, -16384, 32767]] }))!;

    expect(out.channels).toHaveLength(1);
    expect(out.frames).toBe(4);
    expect(out.sampleRate).toBe(44100);
    expect(out.channels[0][0]).toBeCloseTo(0, 5);
    expect(out.channels[0][1]).toBeCloseTo(0.5, 3);
    expect(out.channels[0][2]).toBeCloseTo(-0.5, 3);
    expect(out.channels[0][3]).toBeCloseTo(1, 3);
  });

  it('keeps the two channels apart, in the order they were interleaved', () => {
    const out = decodeAiff(aiff({ samples: [[32767, 0], [0, -32768]] }))!;

    expect(out.channels).toHaveLength(2);
    expect(out.channels[0][0]).toBeCloseTo(1, 3);
    expect(out.channels[1][1]).toBeCloseTo(-1, 3);
  });

  // AIFC's one twist that still leaves the audio readable: the same PCM the
  // other way round. It is what the OP-1 writes its patches as.
  it('reads a little-endian AIFC (sowt) the same way as the big-endian one', () => {
    const big = decodeAiff(aiff({ samples: [[16384, -16384]] }))!;
    const little = decodeAiff(
      aiff({ samples: [[16384, -16384]], form: 'AIFC', compression: 'sowt' })
    )!;

    expect(little.channels[0][0]).toBeCloseTo(big.channels[0][0], 5);
    expect(little.channels[0][1]).toBeCloseTo(big.channels[0][1], 5);
  });

  it('reads 24-bit, which a couple of files in the library are', () => {
    const out = decodeAiff(aiff({ samples: [[0x400000, -0x400000]], bitDepth: 24 }))!;
    expect(out.channels[0][0]).toBeCloseTo(0.5, 3);
    expect(out.channels[0][1]).toBeCloseTo(-0.5, 3);
  });

  // 8-bit AIFF is signed, where 8-bit WAV is not.
  it('reads 8-bit as signed', () => {
    const out = decodeAiff(aiff({ samples: [[64, -64]], bitDepth: 8 }))!;
    expect(out.channels[0][0]).toBeCloseTo(0.5, 2);
    expect(out.channels[0][1]).toBeCloseTo(-0.5, 2);
  });

  it('keeps the sample rate the file declares', () => {
    expect(decodeAiff(aiff({ samples: [[0]], sampleRate: 22050 }))!.sampleRate).toBe(22050);
    expect(decodeAiff(aiff({ samples: [[0]], sampleRate: 48000 }))!.sampleRate).toBe(48000);
  });

  // Better to hand it back to whatever else might read it than to invent
  // samples out of bytes we do not understand.
  it('refuses audio that is genuinely compressed', () => {
    expect(decodeAiff(aiff({ samples: [[1]], form: 'AIFC', compression: 'ima4' }))).toBeNull();
  });

  it('refuses anything that is not an AIFF', () => {
    expect(decodeAiff(new Uint8Array(ascii('RIFFxxxxWAVEfmt ')).buffer)).toBeNull();
    expect(decodeAiff(new ArrayBuffer(4))).toBeNull();
  });

  it('refuses a header with no sound chunk behind it', () => {
    const headerOnly = new Uint8Array([
      ...ascii('FORM'),
      ...be32(4),
      ...ascii('AIFF'),
    ]).buffer;
    expect(decodeAiff(headerOnly)).toBeNull();
  });

  // A file cut short mid-transfer should give back what it does have.
  it('stops at the end of the bytes rather than reading past them', () => {
    const full = aiff({ samples: [[1000, 2000, 3000, 4000]] });
    const truncated = full.slice(0, full.byteLength - 4);
    const out = decodeAiff(truncated)!;

    expect(out.frames).toBeLessThan(4);
    expect(out.frames).toBeGreaterThan(0);
  });
});

describe('looksLikeAiff', () => {
  it('recognises both container forms', () => {
    expect(looksLikeAiff(aiff({ samples: [[0]] }))).toBe(true);
    expect(looksLikeAiff(aiff({ samples: [[0]], form: 'AIFC', compression: 'sowt' }))).toBe(true);
  });

  it('says no to a WAV and to nothing at all', () => {
    expect(looksLikeAiff(new Uint8Array(ascii('RIFFxxxxWAVE')).buffer)).toBe(false);
    expect(looksLikeAiff(new ArrayBuffer(0))).toBe(false);
  });
});
