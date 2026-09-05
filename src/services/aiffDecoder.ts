/**
 * Decoding AIFF, because the browser will not.
 *
 * Chrome — and so Electron — refuses AIFF outright on this platform:
 * `decodeAudioData` answers "Unable to decode audio data" for a plain
 * `FORM…AIFF` as readily as for a `FORM…AIFC`. Measured on this library, that
 * silently stranded 78 443 files, over 22 GB, in the drop folder: every one of
 * them failed to decode, so none ever reached the state where it could be
 * filed, and nothing said why.
 *
 * AIFF is uncompressed PCM in a chunked container, so decoding it is reading
 * two chunks and converting integers. What the files here actually contain,
 * sampled across the tree:
 *
 *     247  AIFF 16-bit NONE      ← nearly everything
 *       2  AIFF 24-bit NONE
 *       1  AIFC 16-bit sowt      ← the OP-1's own patches
 *
 * So: big-endian PCM at 8, 16, 24 and 32 bits, the little-endian `sowt` twist
 * AIFC allows, and 32-bit float. Anything genuinely compressed is refused
 * rather than guessed at.
 */

export interface DecodedAudio {
  /** One Float32Array per channel, in -1..1. */
  channels: Float32Array[];
  sampleRate: number;
  frames: number;
}

/** Compression types that are still plain PCM under the name. */
const UNCOMPRESSED = new Set(['NONE', 'none', 'sowt', 'twos', 'in24', 'in32', 'fl32', 'FL32']);

/** AIFF writes its sample rate as an 80-bit IEEE extended float. */
function readExtended(view: DataView, at: number): number {
  const exponent = view.getUint16(at, false);
  const hi = view.getUint32(at + 2, false);
  const lo = view.getUint32(at + 6, false);
  if (exponent === 0 && hi === 0 && lo === 0) return 0;
  const sign = exponent & 0x8000 ? -1 : 1;
  const e = (exponent & 0x7fff) - 16383;
  return sign * (hi * Math.pow(2, e - 31) + lo * Math.pow(2, e - 63));
}

/**
 * The samples inside an AIFF or AIFC, or `null` if this is not one — or is one
 * whose audio is genuinely compressed, which is not something to guess at.
 */
export function decodeAiff(data: ArrayBuffer): DecodedAudio | null {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  const tag = (at: number) =>
    String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);

  if (data.byteLength < 12 || tag(0) !== 'FORM') return null;
  const form = tag(8);
  if (form !== 'AIFF' && form !== 'AIFC') return null;

  let channels = 0;
  let frames = 0;
  let bitDepth = 0;
  let sampleRate = 0;
  let compression = 'NONE';
  let soundStart = -1;
  let soundEnd = -1;

  let offset = 12;
  while (offset + 8 <= data.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, false);
    const start = offset + 8;

    if (id === 'COMM' && start + 18 <= data.byteLength) {
      channels = view.getUint16(start, false);
      frames = view.getUint32(start + 2, false);
      bitDepth = view.getUint16(start + 6, false);
      sampleRate = Math.round(readExtended(view, start + 8));
      // AIFC follows the rate with a four-character compression type.
      if (form === 'AIFC' && size >= 22 && start + 22 <= data.byteLength) {
        compression = tag(start + 18);
      }
    }

    if (id === 'SSND' && start + 8 <= data.byteLength) {
      // The chunk opens with an offset and a block size; the samples follow.
      const dataOffset = view.getUint32(start, false);
      soundStart = start + 8 + dataOffset;
      soundEnd = Math.min(start + size, data.byteLength);
    }

    const next = offset + 8 + size + (size % 2);
    if (next <= offset) break;
    offset = next;
  }

  if (channels <= 0 || frames <= 0 || sampleRate <= 0 || soundStart < 0) return null;
  if (!UNCOMPRESSED.has(compression)) return null;

  // `sowt` is the same PCM the other way round — the one twist AIFC plays that
  // still leaves the audio readable.
  const littleEndian = compression === 'sowt';
  const isFloat = compression === 'fl32' || compression === 'FL32';
  const bytesPerSample = isFloat ? 4 : Math.ceil(bitDepth / 8);
  if (bytesPerSample < 1 || bytesPerSample > 4) return null;

  const available = Math.floor((soundEnd - soundStart) / (bytesPerSample * channels));
  const count = Math.max(0, Math.min(frames, available));
  const out = Array.from({ length: channels }, () => new Float32Array(count));

  for (let frame = 0; frame < count; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const at = soundStart + (frame * channels + channel) * bytesPerSample;
      out[channel][frame] = isFloat
        ? view.getFloat32(at, littleEndian)
        : readPcm(view, at, bytesPerSample, littleEndian);
    }
  }

  return { channels: out, sampleRate, frames: count };
}

/** One signed PCM sample, scaled to -1..1. */
function readPcm(view: DataView, at: number, width: number, littleEndian: boolean): number {
  if (width === 1) {
    // 8-bit AIFF is signed, unlike 8-bit WAV.
    return view.getInt8(at) / 128;
  }
  if (width === 2) {
    return view.getInt16(at, littleEndian) / 32768;
  }
  if (width === 4) {
    return view.getInt32(at, littleEndian) / 2147483648;
  }

  // 24-bit: three bytes, sign-extended by hand.
  const b0 = view.getUint8(at);
  const b1 = view.getUint8(at + 1);
  const b2 = view.getUint8(at + 2);
  const raw = littleEndian ? (b2 << 16) | (b1 << 8) | b0 : (b0 << 16) | (b1 << 8) | b2;
  const signed = raw & 0x800000 ? raw - 0x1000000 : raw;
  return signed / 8388608;
}

/** True when these bytes open like an AIFF, without decoding them. */
export function looksLikeAiff(data: ArrayBuffer): boolean {
  if (data.byteLength < 12) return false;
  const b = new Uint8Array(data);
  const at = (i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
  return at(0) === 'FORM' && (at(8) === 'AIFF' || at(8) === 'AIFC');
}
