import { SampleItem, SampleType } from '../types/sample';
import { audioEngine } from './audioEngine';
import { audioBufferToWavBlob } from './audioConverter';
import { calculateAudioMetrics } from './audioAnalyzer';
import JSZip from 'jszip';

export interface Op1DrumSlice {
  id: string;
  name: string;
  type: SampleType;
  startSec: number;
  endSec: number;
  pitch: number; // -24 to +24 semitones (0 = normal)
  reverse: boolean;
  playmode: 0 | 1; // 0 = one-shot (trigger), 1 = loop/gate
  volume: number; // 0 to 8192 (8192 = 0dB unity gain)
  sampleItem?: SampleItem;
  audioBuffer?: AudioBuffer;
  color?: string;
}

export interface Op1KitConfig {
  name: string;
  octave?: number;
  slices: Op1DrumSlice[]; // Exactly 24 entries (keys 0 to 23: C1 to B2)
  useMono?: boolean;
  loudnessMatch?: boolean;
  targetLufs?: number;
  trimSilence?: boolean;
}

export const OP1_KEY_NAMES = [
  'C1', 'C#1', 'D1', 'D#1', 'E1', 'F1',
  'F#1', 'G1', 'G#1', 'A1', 'A#1', 'B1',
  'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2',
  'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
];

export const OP1_KEY_COLORS = [
  '#EF4444', '#F87171', '#F97316', '#FB923C', '#F59E0B', '#10B981',
  '#34D399', '#06B6D4', '#22D3EE', '#00F0FF', '#3B82F6', '#60A5FA',
  '#6366F1', '#818CF8', '#8B5CF6', '#A78BFA', '#EC4899', '#F472B6',
  '#10B981', '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6', '#00F0FF',
];

export const OP1_DEFAULT_CATEGORIES: { padIndex: number; suggestedType: SampleType; label: string }[] = [
  { padIndex: 0, suggestedType: 'kick', label: 'Kick 1' },
  { padIndex: 1, suggestedType: 'kick', label: 'Kick 2' },
  { padIndex: 2, suggestedType: 'kick', label: 'Kick 3' },
  { padIndex: 3, suggestedType: 'snare', label: 'Snare 1' },
  { padIndex: 4, suggestedType: 'snare', label: 'Snare 2' },
  { padIndex: 5, suggestedType: 'clap', label: 'Clap 1' },
  { padIndex: 6, suggestedType: 'clap', label: 'Clap 2' },
  { padIndex: 7, suggestedType: 'hihat', label: 'Hi-Hat Closed 1' },
  { padIndex: 8, suggestedType: 'hihat', label: 'Hi-Hat Closed 2' },
  { padIndex: 9, suggestedType: 'hihat', label: 'Hi-Hat Open 1' },
  { padIndex: 10, suggestedType: 'cymbal', label: 'Crash / Cymbal' },
  { padIndex: 11, suggestedType: 'percussion', label: 'Perc 1' },
  { padIndex: 12, suggestedType: 'percussion', label: 'Perc 2' },
  { padIndex: 13, suggestedType: 'percussion', label: 'Perc 3' },
  { padIndex: 14, suggestedType: '808', label: '808 Sub' },
  { padIndex: 15, suggestedType: 'bass', label: 'Bass Hit' },
  { padIndex: 16, suggestedType: 'pad', label: 'Chord Stab 1' },
  { padIndex: 17, suggestedType: 'pad', label: 'Chord Stab 2' },
  { padIndex: 18, suggestedType: 'lead', label: 'Synth Lead 1' },
  { padIndex: 19, suggestedType: 'vocal', label: 'Vocal Chant 1' },
  { padIndex: 20, suggestedType: 'vocal', label: 'Vocal Chop 2' },
  { padIndex: 21, suggestedType: 'fx', label: 'FX Rise / Zap' },
  { padIndex: 22, suggestedType: 'fx', label: 'FX Noise' },
  { padIndex: 23, suggestedType: 'loop', label: 'Break / Mini Loop' },
];

/**
 * Converts a floating point sample rate (e.g. 44100) to 80-bit IEEE 754 Extended Precision Float
 * required by Apple AIFF COMM chunk.
 */
function floatToExtended80(val: number): Uint8Array {
  const bytes = new Uint8Array(10);
  if (val === 0) return bytes;

  let sign = 0;
  if (val < 0) {
    sign = 0x8000;
    val = -val;
  }

  let exp = Math.floor(Math.log2(val));
  let mantissa = val / Math.pow(2, exp);

  // Normalize mantissa
  if (mantissa < 1.0) {
    mantissa *= 2.0;
    exp -= 1;
  }

  const exponentField = exp + 16383; // Bias for 80-bit float
  const signExp = sign | (exponentField & 0x7fff);

  bytes[0] = (signExp >> 8) & 0xff;
  bytes[1] = signExp & 0xff;

  // 64-bit integer mantissa with explicit leading 1
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

/**
 * Creates a combined 12.0s audio buffer containing up to 24 sounds sequentially arranged.
 */
export async function buildOp1DrumBuffer(
  slices: Op1DrumSlice[],
  options?: {
    useMono?: boolean;
    loudnessMatch?: boolean;
    targetLufs?: number;
    maxTotalDurationSec?: number;
  }
): Promise<{
  audioBuffer: AudioBuffer;
  calculatedSlices: Op1DrumSlice[];
}> {
  const sampleRate = 44100;
  const maxSec = options?.maxTotalDurationSec ?? 12.0;
  const numChannels = options?.useMono ? 1 : 2;

  // Filter out active slices
  const activeSlices = slices.filter((s) => s.audioBuffer || (s.sampleItem && s.sampleItem.audioBuffer));

  // Determine duration per slice so total fits within maxSec
  let currentOffsetSec = 0;
  const calculatedSlices: Op1DrumSlice[] = [];

  // Calculate total raw duration
  let totalRawDuration = 0;
  for (const s of slices) {
    const buf = s.audioBuffer || s.sampleItem?.audioBuffer;
    if (buf) {
      totalRawDuration += Math.min(buf.duration, 2.5);
    } else {
      totalRawDuration += 0.2; // placeholder silence
    }
  }

  // If raw duration exceeds 12s, scale or compact slices
  const scale = totalRawDuration > maxSec ? maxSec / totalRawDuration : 1.0;

  for (let i = 0; i < 24; i++) {
    const s = slices[i] || {
      id: `pad-${i}`,
      name: OP1_DEFAULT_CATEGORIES[i].label,
      type: OP1_DEFAULT_CATEGORIES[i].suggestedType,
      startSec: 0,
      endSec: 0,
      pitch: 0,
      reverse: false,
      playmode: 0,
      volume: 8192,
    };

    const buf = s.audioBuffer || s.sampleItem?.audioBuffer;
    let sliceDuration = 0.2; // default short pad

    if (buf) {
      const naturalDur = Math.min(buf.duration, 3.0);
      sliceDuration = Math.max(0.1, naturalDur * scale);
    }

    // Ensure we don't exceed maxSec
    if (currentOffsetSec + sliceDuration > maxSec) {
      sliceDuration = Math.max(0.05, maxSec - currentOffsetSec);
    }

    const startSec = currentOffsetSec;
    const endSec = Math.min(maxSec, currentOffsetSec + sliceDuration);
    currentOffsetSec = endSec;

    calculatedSlices.push({
      ...s,
      startSec,
      endSec,
    });
  }

  // Create composite AudioBuffer (12.0s max at 44.1kHz)
  const totalLength = Math.min(Math.ceil(maxSec * sampleRate), Math.max(sampleRate, Math.ceil(currentOffsetSec * sampleRate)));
  const ctx = audioEngine.getAudioContext();
  const compositeBuffer = ctx.createBuffer(numChannels, totalLength, sampleRate);

  const leftOut = compositeBuffer.getChannelData(0);
  const rightOut = numChannels > 1 ? compositeBuffer.getChannelData(1) : leftOut;

  // Stitch each slice into the composite buffer
  for (let i = 0; i < 24; i++) {
    const s = calculatedSlices[i];
    const srcBuf = s.audioBuffer || s.sampleItem?.audioBuffer;
    if (!srcBuf) continue;

    const startSample = Math.floor(s.startSec * sampleRate);
    const endSample = Math.min(totalLength, Math.floor(s.endSec * sampleRate));
    const sliceLen = endSample - startSample;
    if (sliceLen <= 0) continue;

    // Resample / scale source data into slice window
    const srcLeft = srcBuf.getChannelData(0);
    const srcRight = srcBuf.numberOfChannels > 1 ? srcBuf.getChannelData(1) : srcLeft;
    const srcLen = srcBuf.length;

    // Calculate slice gain (volume + optional loudness matching)
    let gain = (s.volume || 8192) / 8192;
    if (options?.loudnessMatch && s.sampleItem?.loudnessGainDb !== undefined) {
      gain *= Math.pow(10, s.sampleItem.loudnessGainDb / 20);
    }

    // Micro-fade length (5ms) to prevent clicks at slice boundaries
    const fadeLen = Math.min(Math.floor(sampleRate * 0.005), Math.floor(sliceLen / 8));

    for (let smp = 0; smp < sliceLen; smp++) {
      // Linear interpolation from source buffer
      const srcIdxFloat = (smp / sliceLen) * srcLen;
      const idx0 = Math.floor(srcIdxFloat);
      const idx1 = Math.min(srcLen - 1, idx0 + 1);
      const frac = srcIdxFloat - idx0;

      let lVal = (srcLeft[idx0] * (1 - frac) + srcLeft[idx1] * frac) * gain;
      let rVal = (srcRight[idx0] * (1 - frac) + srcRight[idx1] * frac) * gain;

      // Apply boundary micro-fades
      if (smp < fadeLen) {
        const fade = smp / fadeLen;
        lVal *= fade;
        rVal *= fade;
      } else if (smp > sliceLen - fadeLen) {
        const fade = (sliceLen - smp) / fadeLen;
        lVal *= fade;
        rVal *= fade;
      }

      const destIdx = startSample + smp;
      if (destIdx < totalLength) {
        leftOut[destIdx] = Math.max(-1.0, Math.min(1.0, lVal));
        if (numChannels > 1) {
          rightOut[destIdx] = Math.max(-1.0, Math.min(1.0, rVal));
        }
      }
    }
  }

  return {
    audioBuffer: compositeBuffer,
    calculatedSlices,
  };
}

/**
 * Encodes an AudioBuffer + 24 Slices into the official Teenage Engineering OP-1 AIFF Drum Patch (.aif).
 * Embedded with APPL 'op-1' JSON metadata chunk and 16-bit 44.1kHz PCM samples.
 */
export function encodeOp1AiffPatch(
  buffer: AudioBuffer,
  slices: Op1DrumSlice[],
  kitName: string = 'Resonance Drum Kit'
): Blob {
  const sampleRate = buffer.sampleRate || 44100;
  const numChannels = buffer.numberOfChannels;
  const numFrames = buffer.length;

  // Prepare OP-1 Drum JSON Chunk Payload
  const startArr: number[] = [];
  const endArr: number[] = [];
  const pitchArr: number[] = [];
  const playmodeArr: number[] = [];
  const reverseArr: number[] = [];
  const volumeArr: number[] = [];

  for (let i = 0; i < 24; i++) {
    const s = slices[i] || {
      startSec: (i * buffer.duration) / 24,
      endSec: ((i + 1) * buffer.duration) / 24,
      pitch: 0,
      playmode: 0,
      reverse: false,
      volume: 8192,
    };

    // OP-1 timestamp standard: sample frame index * 4096
    const startSample = Math.max(0, Math.floor(s.startSec * sampleRate));
    const endSample = Math.min(numFrames - 1, Math.floor(s.endSec * sampleRate));

    startArr.push(Math.round(startSample * 4096));
    endArr.push(Math.round(endSample * 4096));
    pitchArr.push(Math.round(s.pitch || 0));
    playmodeArr.push(s.playmode || 0);
    reverseArr.push(s.reverse ? 1 : 0);
    volumeArr.push(Math.round(s.volume ?? 8192));
  }

  const op1Meta = {
    drum_version: 1,
    name: kitName.slice(0, 31),
    octave: 0,
    pitch: pitchArr,
    playmode: playmodeArr,
    reverse: reverseArr,
    volume: volumeArr,
    start: startArr,
    end: endArr,
    type: 'drum',
  };

  const jsonStr = JSON.stringify(op1Meta);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  // AIFF Chunks sizing
  // 1. COMM Chunk: 4 (ID) + 4 (size: 18) + 18 bytes = 26 bytes
  const commChunkSize = 18;
  const commTotalSize = 8 + commChunkSize;

  // 2. APPL Chunk: 4 (ID) + 4 (size: 4 + jsonBytes.length) + 4 ('op-1') + jsonBytes.length (+ 1 if odd)
  const applPayloadSize = 4 + jsonBytes.length;
  const applPad = applPayloadSize % 2 !== 0 ? 1 : 0;
  const applTotalSize = 8 + applPayloadSize + applPad;

  // 3. SSND Chunk: 4 (ID) + 4 (size: 8 + pcmBytes) + 8 (offset, blockSize) + pcmBytes
  const bytesPerSample = 2; // 16-bit
  const pcmBytesLength = numFrames * numChannels * bytesPerSample;
  const ssndPayloadSize = 8 + pcmBytesLength;
  const ssndPad = pcmBytesLength % 2 !== 0 ? 1 : 0;
  const ssndTotalSize = 8 + ssndPayloadSize + ssndPad;

  // Total AIFF FORM Size = 4 ('AIFF') + commTotalSize + applTotalSize + ssndTotalSize
  const formPayloadSize = 4 + commTotalSize + applTotalSize + ssndTotalSize;
  const totalFileSize = 8 + formPayloadSize;

  const outBuffer = new ArrayBuffer(totalFileSize);
  const view = new DataView(outBuffer);
  const u8 = new Uint8Array(outBuffer);

  let offset = 0;

  // Helper to write ASCII 4-char string
  function writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      u8[offset++] = str.charCodeAt(i);
    }
  }

  // --- FORM Header ---
  writeString('FORM');
  view.setUint32(offset, formPayloadSize, false); // Big Endian
  offset += 4;
  writeString('AIFF');

  // --- COMM Chunk ---
  writeString('COMM');
  view.setUint32(offset, commChunkSize, false);
  offset += 4;
  view.setInt16(offset, numChannels, false); // Channels (1 or 2)
  offset += 2;
  view.setUint32(offset, numFrames, false); // Sample Frames
  offset += 4;
  view.setInt16(offset, 16, false); // Bit depth (16-bit PCM)
  offset += 2;

  // Sample rate in 80-bit IEEE 754
  const sampleRate80 = floatToExtended80(sampleRate);
  u8.set(sampleRate80, offset);
  offset += 10;

  // --- APPL Chunk ('op-1' application metadata) ---
  writeString('APPL');
  view.setUint32(offset, applPayloadSize, false);
  offset += 4;
  writeString('op-1');
  u8.set(jsonBytes, offset);
  offset += jsonBytes.length;
  if (applPad > 0) {
    u8[offset++] = 0;
  }

  // --- SSND Chunk (Audio PCM Big-Endian 16-bit) ---
  writeString('SSND');
  view.setUint32(offset, ssndPayloadSize, false);
  offset += 4;
  view.setUint32(offset, 0, false); // offset = 0
  offset += 4;
  view.setUint32(offset, 0, false); // blockSize = 0
  offset += 4;

  const left = buffer.getChannelData(0);
  const right = numChannels > 1 ? buffer.getChannelData(1) : left;

  for (let i = 0; i < numFrames; i++) {
    // Left Channel (16-bit Big Endian)
    let sL = Math.max(-1, Math.min(1, left[i]));
    let valL = sL < 0 ? sL * 0x8000 : sL * 0x7fff;
    view.setInt16(offset, Math.floor(valL), false);
    offset += 2;

    if (numChannels > 1) {
      let sR = Math.max(-1, Math.min(1, right[i]));
      let valR = sR < 0 ? sR * 0x8000 : sR * 0x7fff;
      view.setInt16(offset, Math.floor(valR), false);
      offset += 2;
    }
  }

  if (ssndPad > 0) {
    u8[offset++] = 0;
  }

  return new Blob([outBuffer], { type: 'audio/aiff' });
}

/**
 * Encodes an OP-1 Synth Sampler patch (.aif) with root pitch and loop boundaries.
 */
export function encodeOp1SynthPatch(
  buffer: AudioBuffer,
  options: {
    name: string;
    rootMidiNote: number; // 60 = C4
    loopEnabled: boolean;
    loopStartSec?: number;
    loopEndSec?: number;
  }
): Blob {
  const sampleRate = buffer.sampleRate || 44100;
  const numFrames = buffer.length;

  const loopStart = Math.round((options.loopStartSec ?? 0) * sampleRate * 4096);
  const loopEnd = Math.round((options.loopEndSec ?? buffer.duration) * sampleRate * 4096);

  const synthMeta = {
    synth_version: 1,
    name: options.name.slice(0, 31),
    type: 'sampler',
    root: options.rootMidiNote || 60,
    start: 0,
    end: Math.round(numFrames * 4096),
    loop: options.loopEnabled ? 1 : 0,
    loop_start: loopStart,
    loop_end: loopEnd,
  };

  const jsonStr = JSON.stringify(synthMeta);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  const numChannels = buffer.numberOfChannels;
  const commChunkSize = 18;
  const commTotalSize = 8 + commChunkSize;

  const applPayloadSize = 4 + jsonBytes.length;
  const applPad = applPayloadSize % 2 !== 0 ? 1 : 0;
  const applTotalSize = 8 + applPayloadSize + applPad;

  const bytesPerSample = 2;
  const pcmBytesLength = numFrames * numChannels * bytesPerSample;
  const ssndPayloadSize = 8 + pcmBytesLength;
  const ssndPad = pcmBytesLength % 2 !== 0 ? 1 : 0;
  const ssndTotalSize = 8 + ssndPayloadSize + ssndPad;

  const formPayloadSize = 4 + commTotalSize + applTotalSize + ssndTotalSize;
  const totalFileSize = 8 + formPayloadSize;

  const outBuffer = new ArrayBuffer(totalFileSize);
  const view = new DataView(outBuffer);
  const u8 = new Uint8Array(outBuffer);

  let offset = 0;
  function writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      u8[offset++] = str.charCodeAt(i);
    }
  }

  writeString('FORM');
  view.setUint32(offset, formPayloadSize, false);
  offset += 4;
  writeString('AIFF');

  writeString('COMM');
  view.setUint32(offset, commChunkSize, false);
  offset += 4;
  view.setInt16(offset, numChannels, false);
  offset += 2;
  view.setUint32(offset, numFrames, false);
  offset += 4;
  view.setInt16(offset, 16, false);
  offset += 2;

  const sampleRate80 = floatToExtended80(sampleRate);
  u8.set(sampleRate80, offset);
  offset += 10;

  writeString('APPL');
  view.setUint32(offset, applPayloadSize, false);
  offset += 4;
  writeString('op-1');
  u8.set(jsonBytes, offset);
  offset += jsonBytes.length;
  if (applPad > 0) u8[offset++] = 0;

  writeString('SSND');
  view.setUint32(offset, ssndPayloadSize, false);
  offset += 4;
  view.setUint32(offset, 0, false);
  offset += 4;
  view.setUint32(offset, 0, false);
  offset += 4;

  const left = buffer.getChannelData(0);
  const right = numChannels > 1 ? buffer.getChannelData(1) : left;

  for (let i = 0; i < numFrames; i++) {
    let sL = Math.max(-1, Math.min(1, left[i]));
    let valL = sL < 0 ? sL * 0x8000 : sL * 0x7fff;
    view.setInt16(offset, Math.floor(valL), false);
    offset += 2;

    if (numChannels > 1) {
      let sR = Math.max(-1, Math.min(1, right[i]));
      let valR = sR < 0 ? sR * 0x8000 : sR * 0x7fff;
      view.setInt16(offset, Math.floor(valR), false);
      offset += 2;
    }
  }

  if (ssndPad > 0) u8[offset++] = 0;

  return new Blob([outBuffer], { type: 'audio/aiff' });
}

/**
 * Parses an OP-1 Drum Kit AIFF patch (.aif) and extracts embedded 24-pad APPL JSON timestamps & metadata
 */
export async function parseOp1AiffPatch(
  data: ArrayBuffer | Blob | File
): Promise<{
  name: string;
  slices: Op1DrumSlice[];
  audioBuffer: AudioBuffer;
  rawJson?: any;
}> {
  let arrayBuffer: ArrayBuffer;
  if (data instanceof Blob || (typeof File !== 'undefined' && data instanceof File)) {
    arrayBuffer = await data.arrayBuffer();
  } else {
    arrayBuffer = data;
  }

  // 1. Decode Audio Buffer via Web Audio
  const audioBuffer = await audioEngine.getAudioContext().decodeAudioData(arrayBuffer.slice(0));

  // 2. Parse AIFF Chunks manually to find 'APPL' op-1 metadata chunk
  const u8 = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  let offset = 0;

  function readString(len: number): string {
    let str = '';
    for (let i = 0; i < len; i++) {
      str += String.fromCharCode(u8[offset++]);
    }
    return str;
  }

  let op1Json: any = null;

  try {
    const magic = readString(4);
    if (magic === 'FORM') {
      const formSize = view.getUint32(offset, false);
      offset += 4;
      const formType = readString(4); // AIFF or AIFC

      while (offset < arrayBuffer.byteLength - 8) {
        const chunkId = readString(4);
        const chunkSize = view.getUint32(offset, false);
        offset += 4;

        if (chunkId === 'APPL') {
          const appType = readString(4); // 'op-1'
          if (appType === 'op-1') {
            const jsonBytes = u8.subarray(offset, offset + chunkSize - 4);
            const jsonText = new TextDecoder('utf-8').decode(jsonBytes);
            try {
              op1Json = JSON.parse(jsonText);
            } catch (e) {
              console.warn('Could not parse OP-1 JSON in APPL chunk:', e);
            }
          }
          offset += (chunkSize - 4);
        } else {
          offset += chunkSize;
        }

        // Align to word boundary
        if (chunkSize % 2 !== 0) {
          offset++;
        }
      }
    }
  } catch (e) {
    console.warn('Error parsing AIFF chunks:', e);
  }

  const duration = audioBuffer.duration;
  const sampleRate = audioBuffer.sampleRate;
  const slices: Op1DrumSlice[] = [];

  if (op1Json && Array.isArray(op1Json.start) && Array.isArray(op1Json.end)) {
    const totalSlots = Math.min(24, op1Json.start.length);
    for (let i = 0; i < totalSlots; i++) {
      const startSample = (op1Json.start[i] || 0) / 4096;
      const endSample = (op1Json.end[i] || 0) / 4096;
      const startSec = Math.max(0, Math.min(duration, startSample / sampleRate));
      const endSec = Math.max(startSec + 0.01, Math.min(duration, endSample / sampleRate));

      const def = OP1_DEFAULT_CATEGORIES[i] || { suggestedType: 'other', label: `Pad ${i + 1}` };
      slices.push({
        id: `op1-parsed-pad-${i}`,
        name: `${op1Json.name || 'OP-1 Patch'} - ${OP1_KEY_NAMES[i]} (${def.label})`,
        type: def.suggestedType,
        startSec,
        endSec,
        pitch: op1Json.pitch ? op1Json.pitch[i] : 0,
        reverse: op1Json.reverse ? op1Json.reverse[i] === 1 : false,
        playmode: op1Json.playmode ? op1Json.playmode[i] : 0,
        volume: op1Json.volume ? op1Json.volume[i] : 8192,
        color: OP1_KEY_COLORS[i],
      });
    }
  } else {
    // Fallback: 24 even slices across duration
    for (let i = 0; i < 24; i++) {
      const startSec = (i * duration) / 24;
      const endSec = ((i + 1) * duration) / 24;
      const def = OP1_DEFAULT_CATEGORIES[i] || { suggestedType: 'other', label: `Pad ${i + 1}` };
      slices.push({
        id: `op1-fallback-pad-${i}`,
        name: `${OP1_KEY_NAMES[i]} - ${def.label}`,
        type: def.suggestedType,
        startSec,
        endSec,
        pitch: 0,
        reverse: false,
        playmode: 0,
        volume: 8192,
        color: OP1_KEY_COLORS[i],
      });
    }
  }

  return {
    name: op1Json?.name || 'OP-1 Drum Patch',
    slices,
    audioBuffer,
    rawJson: op1Json,
  };
}

/**
 * Extracts slice regions from an AudioBuffer into individual WAV blobs.
 */
export async function extractSlicesToWavBlobs(
  buffer: AudioBuffer,
  slices: Array<{ startSec: number; endSec: number; label?: string; index?: number }>,
  baseName: string = 'Sample'
): Promise<Array<{ fileName: string; blob: Blob; audioBuffer: AudioBuffer; duration: number }>> {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const ctx = audioEngine.getAudioContext();
  const results: Array<{ fileName: string; blob: Blob; audioBuffer: AudioBuffer; duration: number }> = [];

  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    const startSample = Math.max(0, Math.floor(s.startSec * sampleRate));
    const endSample = Math.min(buffer.length, Math.floor(s.endSec * sampleRate));
    const sliceLen = Math.max(1, endSample - startSample);

    const sliceBuf = ctx.createBuffer(numChannels, sliceLen, sampleRate);
    for (let c = 0; c < numChannels; c++) {
      const srcData = buffer.getChannelData(c);
      const dstData = sliceBuf.getChannelData(c);
      for (let j = 0; j < sliceLen; j++) {
        dstData[j] = srcData[startSample + j] || 0;
      }
    }

    const wavBlob = audioBufferToWavBlob(sliceBuf);
    const padNum = String(s.index || i + 1).padStart(2, '0');
    const cleanLabel = (s.label || `Slice_${padNum}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${baseName}_P${padNum}_${cleanLabel}.wav`;

    results.push({
      fileName,
      blob: wavBlob,
      audioBuffer: sliceBuf,
      duration: sliceBuf.duration,
    });
  }

  return results;
}

/**
 * Automatically sorts an arbitrary pool of samples into 24 optimal OP-1 drum slots based on acoustic profiling & drum taxonomy.
 */
export function autoPopulate24Op1Slots(samples: SampleItem[]): Op1DrumSlice[] {
  const slots: Op1DrumSlice[] = [];

  // Categorize available samples
  const kicks = samples.filter((s) => s.type === 'kick');
  const snares = samples.filter((s) => s.type === 'snare');
  const claps = samples.filter((s) => s.type === 'clap');
  const hihats = samples.filter((s) => s.type === 'hihat' || s.type === 'cymbal');
  const percs = samples.filter((s) => s.type === 'percussion' || s.type === 'other');
  const basses = samples.filter((s) => s.type === '808' || s.type === 'bass');
  const pads = samples.filter((s) => s.type === 'pad');
  const leads = samples.filter((s) => s.type === 'lead');
  const vocals = samples.filter((s) => s.type === 'vocal');
  const fx = samples.filter((s) => s.type === 'fx');
  const loops = samples.filter((s) => s.isLoop || s.category === 'loop');

  const pool = [...samples];

  function pickBest(candidates: SampleItem[], fallbackPool: SampleItem[]): SampleItem | undefined {
    if (candidates.length > 0) {
      const item = candidates.shift();
      if (item) {
        const pIdx = pool.findIndex((x) => x.id === item.id);
        if (pIdx >= 0) pool.splice(pIdx, 1);
        return item;
      }
    }
    if (fallbackPool.length > 0) {
      return fallbackPool.shift();
    }
    return undefined;
  }

  for (let i = 0; i < 24; i++) {
    const def = OP1_DEFAULT_CATEGORIES[i];
    let matchedItem: SampleItem | undefined;

    if (def.suggestedType === 'kick') matchedItem = pickBest(kicks, pool);
    else if (def.suggestedType === 'snare') matchedItem = pickBest(snares, pool);
    else if (def.suggestedType === 'clap') matchedItem = pickBest(claps, pool);
    else if (def.suggestedType === 'hihat') matchedItem = pickBest(hihats, pool);
    else if (def.suggestedType === 'percussion') matchedItem = pickBest(percs, pool);
    else if (def.suggestedType === '808' || def.suggestedType === 'bass') matchedItem = pickBest(basses, pool);
    else if (def.suggestedType === 'pad') matchedItem = pickBest(pads, pool);
    else if (def.suggestedType === 'lead') matchedItem = pickBest(leads, pool);
    else if (def.suggestedType === 'vocal') matchedItem = pickBest(vocals, pool);
    else if (def.suggestedType === 'fx') matchedItem = pickBest(fx, pool);
    else if (def.suggestedType === 'loop') matchedItem = pickBest(loops, pool);

    if (!matchedItem && pool.length > 0) {
      matchedItem = pool.shift();
    }

    slots.push({
      id: `op1-pad-${i}`,
      name: matchedItem ? matchedItem.name : def.label,
      type: matchedItem ? matchedItem.type : def.suggestedType,
      startSec: 0,
      endSec: 0,
      pitch: 0,
      reverse: false,
      playmode: def.suggestedType === 'loop' ? 1 : 0,
      volume: 8192,
      sampleItem: matchedItem,
      audioBuffer: matchedItem?.audioBuffer,
      color: OP1_KEY_COLORS[i],
    });
  }

  return slots;
}

/**
 * Batch Generates OP-1 Drum Kit Packs from a large directory of samples.
 */
export async function batchGenerateOp1Kits(
  samples: SampleItem[],
  options: {
    packName: string;
    kitsCount?: number;
    loudnessMatch?: boolean;
    useMono?: boolean;
  },
  onProgress?: (progress: number, currentKit: string) => void
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder('OP-1_Drum_Kits') || zip;

  const kitCount = options.kitsCount || Math.max(1, Math.ceil(samples.length / 24));
  const samplesPerKit = 24;

  const manifest: Array<{ kitNumber: number; fileName: string; sounds: string[] }> = [];

  for (let k = 0; k < kitCount; k++) {
    const kitSliceSamples = samples.slice(k * samplesPerKit, (k + 1) * samplesPerKit);
    if (kitSliceSamples.length === 0 && k > 0) break;

    const kitName = `${options.packName}_Kit_${String(k + 1).padStart(2, '0')}`;
    const slots = autoPopulate24Op1Slots(kitSliceSamples.length > 0 ? kitSliceSamples : samples);

    if (onProgress) {
      onProgress(Math.round(((k + 0.5) / kitCount) * 100), kitName);
    }

    const { audioBuffer, calculatedSlices } = await buildOp1DrumBuffer(slots, {
      useMono: options.useMono,
      loudnessMatch: options.loudnessMatch ?? true,
      maxTotalDurationSec: 12.0,
    });

    const aiffBlob = encodeOp1AiffPatch(audioBuffer, calculatedSlices, kitName);
    folder.file(`${kitName}.aif`, aiffBlob);

    manifest.push({
      kitNumber: k + 1,
      fileName: `${kitName}.aif`,
      sounds: calculatedSlices.map((s, idx) => `${OP1_KEY_NAMES[idx]}: ${s.name} (${s.type})`),
    });

    if (onProgress) {
      onProgress(Math.round(((k + 1) / kitCount) * 100), kitName);
    }
  }

  // Add OP-1 USB Readme and mapping manifest
  const readmeContent = `# Resonance Studio - Teenage Engineering OP-1 Drum Kit Pack
Généré le: ${new Date().toLocaleString()}
Kits inclus: ${manifest.length} patchs (.aif 16-bit / 44.1kHz avec balises temporelles APPL)

## Instructions d'installation sur Teenage Engineering OP-1 :
1. Connectez votre OP-1 via câble USB à votre ordinateur.
2. Démarrez l'OP-1 en mode 'COM' (Shift + COM) et appuyez sur '3' (Disk Mode).
3. Ouvrez le disque 'OP-1' apparu sur votre machine.
4. Glissez les fichiers .aif du dossier dans :
   -> /drum/user/
5. Éjectez proprement le disque OP-1.
6. Sur l'OP-1, appuyez sur 'DRUM', choisissez 'user' et vos kits sont immédiatement jouables sur les 24 touches du clavier physique !

## Détail des 24 touches par Kit :
${manifest
  .map(
    (m) => `### ${m.fileName}
${m.sounds.map((s) => `- ${s}`).join('\n')}
`
  )
  .join('\n')}
`;

  folder.file('README_OP1_INSTALLATION.txt', readmeContent);
  folder.file('op1_drum_manifest.json', JSON.stringify(manifest, null, 2));

  return await zip.generateAsync({ type: 'blob' });
}
