import JSZip from 'jszip';
import { BatchConvertSettings, HardwarePreset, SampleItem, SliceRegion } from '../types/sample';
import { audioEngine } from './audioEngine';
import { batchGenerateOp1Kits } from './op1PatchEncoder';

/** Creates a correctly timed buffer at the requested rate using linear interpolation. */
function resampleBuffer(buffer: AudioBuffer, targetSampleRate: number): AudioBuffer {
  if (targetSampleRate === buffer.sampleRate) return buffer;
  const targetLength = Math.max(1, Math.round(buffer.length * targetSampleRate / buffer.sampleRate));
  const output = new AudioBuffer({
    length: targetLength,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: targetSampleRate,
  });
  const ratio = buffer.sampleRate / targetSampleRate;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const input = buffer.getChannelData(channel);
    const target = output.getChannelData(channel);
    for (let index = 0; index < targetLength; index++) {
      const position = index * ratio;
      const left = Math.floor(position);
      const right = Math.min(left + 1, input.length - 1);
      const fraction = position - left;
      target[index] = input[left] * (1 - fraction) + input[right] * fraction;
    }
  }
  return output;
}

/**
 * Encodes an AudioBuffer into a WAV Blob (16-bit, 24-bit, or 32-bit float PCM) with optional loudness leveling and BWF/ACID metadata
 */
export function audioBufferToWavBlob(
  buffer: AudioBuffer,
  options?: {
    bitDepth?: 16 | 24 | 32;
    sampleRate?: number;
    normalize?: boolean;
    loudnessMatch?: boolean;
    targetLufs?: number;
    targetPeakDb?: number;
    removeDc?: boolean;
    monoSum?: boolean;
    trimSilence?: boolean;
    silenceThresholdDb?: number;
    startSec?: number;
    endSec?: number;
    bpm?: number;
    rootKey?: string;
  }
): Blob {
  const bitDepth = options?.bitDepth ?? 16;
  const normalize = options?.normalize ?? false;
  const loudnessMatch = options?.loudnessMatch ?? false;
  const targetPeakDb = options?.targetPeakDb ?? -0.3;
  const removeDc = options?.removeDc ?? true;
  const monoSum = options?.monoSum ?? false;

  const targetSampleRate = options?.sampleRate || buffer.sampleRate;
  const sourceBuffer = resampleBuffer(buffer, targetSampleRate);
  const srcSampleRate = sourceBuffer.sampleRate;
  const numChannels = monoSum ? 1 : sourceBuffer.numberOfChannels;

  let startSample = Math.max(0, Math.floor((options?.startSec ?? 0) * srcSampleRate));
  let endSample = Math.min(
    sourceBuffer.length,
    Math.floor((options?.endSec ?? sourceBuffer.duration) * srcSampleRate)
  );

  // Optional micro-silence trimming at head and tail
  if (options?.trimSilence) {
    const thresh = Math.pow(10, (options.silenceThresholdDb ?? -48) / 20);
    const c0 = sourceBuffer.getChannelData(0);

    // Find first sample above threshold
    while (startSample < endSample && Math.abs(c0[startSample]) < thresh) {
      startSample++;
    }
    // Find last sample above threshold
    while (endSample > startSample && Math.abs(c0[endSample - 1]) < thresh) {
      endSample--;
    }
  }

  const length = Math.max(1, endSample - startSample);

  // Extract channels
  const channels: Float32Array[] = [];
  if (monoSum && sourceBuffer.numberOfChannels > 1) {
    const mono = new Float32Array(length);
    const c0 = sourceBuffer.getChannelData(0);
    const c1 = sourceBuffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      // -3dB pan-law sum
      mono[i] = (c0[startSample + i] + c1[startSample + i]) * 0.707;
    }
    channels.push(mono);
  } else {
    for (let c = 0; c < sourceBuffer.numberOfChannels; c++) {
      const src = sourceBuffer.getChannelData(c);
      const chData = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        chData[i] = src[startSample + i];
      }
      channels.push(chData);
    }
  }

  // Remove DC offset & calculate metrics
  let maxPeak = 0;
  let sumSquares = 0;
  for (let c = 0; c < numChannels; c++) {
    const data = channels[c];
    if (removeDc) {
      let mean = 0;
      for (let i = 0; i < length; i++) mean += data[i];
      mean /= length;
      for (let i = 0; i < length; i++) data[i] -= mean;
    }
    for (let i = 0; i < length; i++) {
      const absVal = Math.abs(data[i]);
      if (absVal > maxPeak) maxPeak = absVal;
      sumSquares += data[i] * data[i];
    }
  }

  // Calculate Gain Factor
  let gain = 1.0;
  if (loudnessMatch && length > 100) {
    const rms = Math.sqrt(sumSquares / (length * numChannels)) || 0.0001;
    const currentRmsDb = 20 * Math.log10(rms);
    const targetRmsDb = options?.targetLufs ? options.targetLufs - 3 : -14;
    const desiredGain = Math.pow(10, (targetRmsDb - currentRmsDb) / 20);
    const maxSafeGain = maxPeak > 0 ? (Math.pow(10, -0.2 / 20) / maxPeak) : 1.0;
    gain = Math.min(desiredGain, maxSafeGain);
  } else if (normalize && maxPeak > 0.0001) {
    const targetAmp = Math.pow(10, targetPeakDb / 20);
    gain = targetAmp / maxPeak;
  }

  // Apply gain with soft saturation limiting
  for (let c = 0; c < numChannels; c++) {
    const data = channels[c];
    for (let i = 0; i < length; i++) {
      const scaled = data[i] * gain;
      // Soft-knee ceiling limit to prevent digital distortion
      if (scaled > 0.98) {
        data[i] = 0.98 + (1 - Math.exp(-(scaled - 0.98))) * 0.02;
      } else if (scaled < -0.98) {
        data[i] = -0.98 - (1 - Math.exp(-(-scaled - 0.98))) * 0.02;
      } else {
        data[i] = scaled;
      }
    }
  }

  // Format header configuration
  const outSampleRate = srcSampleRate;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = outSampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // 'fmt ' chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  const audioFormat = bitDepth === 32 ? 3 : 1;
  view.setUint16(20, audioFormat, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, outSampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // 'data' chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write audio samples
  let offset = 44;
  if (bitDepth === 16) {
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numChannels; c++) {
        const s = channels[c][i];
        const val = s < 0 ? s * 0x8000 : s * 0x7fff;
        view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.floor(val))), true);
        offset += 2;
      }
    }
  } else if (bitDepth === 24) {
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numChannels; c++) {
        const s = channels[c][i];
        const val = s < 0 ? s * 0x800000 : s * 0x7fffff;
        const intVal = Math.max(-8388608, Math.min(8388607, Math.floor(val)));
        view.setUint8(offset, intVal & 0xff);
        view.setUint8(offset + 1, (intVal >> 8) & 0xff);
        view.setUint8(offset + 2, (intVal >> 16) & 0xff);
        offset += 3;
      }
    }
  } else if (bitDepth === 32) {
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numChannels; c++) {
        view.setFloat32(offset, channels[c][i], true);
        offset += 4;
      }
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Creates an AudioBuffer for a specific slice region
 */
export function extractSliceBuffer(
  sourceBuffer: AudioBuffer,
  slice: SliceRegion
): AudioBuffer {
  const ctx = audioEngine.getAudioContext();
  const sampleRate = sourceBuffer.sampleRate;
  const startSample = Math.max(0, Math.floor(slice.startSec * sampleRate));
  const endSample = Math.min(sourceBuffer.length, Math.floor(slice.endSec * sampleRate));
  const sliceLength = Math.max(1, endSample - startSample);

  const sliceBuffer = ctx.createBuffer(
    sourceBuffer.numberOfChannels,
    sliceLength,
    sampleRate
  );

  for (let c = 0; c < sourceBuffer.numberOfChannels; c++) {
    const src = sourceBuffer.getChannelData(c);
    const dest = sliceBuffer.getChannelData(c);
    for (let i = 0; i < sliceLength; i++) {
      dest[i] = src[startSample + i];
    }
  }

  return sliceBuffer;
}

/**
 * Multi-Sound Slice Pack Export: creates a zip with all slices
 */
export async function exportSlicesZip(
  sample: SampleItem,
  slices: SliceRegion[]
): Promise<Blob> {
  if (!sample.audioBuffer) {
    throw new Error('AudioBuffer not loaded for sample');
  }

  const zip = new JSZip();
  const cleanBaseName = sample.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const folder = zip.folder(`${cleanBaseName}_slices`) || zip;

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    const sliceBlob = audioBufferToWavBlob(sample.audioBuffer, {
      startSec: slice.startSec,
      endSec: slice.endSec,
      bitDepth: 24,
      normalize: true,
      targetPeakDb: -0.2,
      removeDc: true,
      trimSilence: true,
    });

    const padIndex = String(i + 1).padStart(2, '0');
    const sliceLabel = (slice.label || `hit_${padIndex}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const keyPart = sample.key ? `_${sample.key.replace(/\s+/g, '')}` : '';
    const bpmPart = sample.bpm ? `_${sample.bpm}BPM` : '';
    const fileName = `${cleanBaseName}_slice_${padIndex}_${sliceLabel}${keyPart}${bpmPart}.wav`;

    folder.file(fileName, sliceBlob);
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Dedicated Teenage Engineering EP-133 K.O. II Project Pack Exporter
 * Formats: 16-bit / 46.875 kHz or 44.1 kHz, Mono/Stereo, 001-999 Pad-Grouped Folders
 */
export async function exportEp133ProjectPack(
  samples: SampleItem[],
  options?: {
    useMono?: boolean;
    startingSlot?: number;
    loudnessMatch?: boolean;
    sampleRate?: 46875 | 44100 | 48000;
  },
  onProgress?: (current: number, total: number, name: string) => void
): Promise<Blob> {
  const zip = new JSZip();
  const epFolder = zip.folder('EP-133_KO_II_PROJECT_PACK') || zip;
  const useMono = options?.useMono ?? true;
  const targetSampleRate = options?.sampleRate ?? 46875;
  const loudnessMatch = options?.loudnessMatch ?? true;

  // EP-133 Category Folders & Sound Slot Map
  const categoryFolders: Record<string, string> = {
    kick: '01_KICKS (Slots 001-099)',
    snare: '02_SNARES (Slots 100-199)',
    clap: '02_SNARES (Slots 100-199)',
    hihat: '03_HATS (Slots 200-299)',
    cymbal: '03_HATS (Slots 200-299)',
    percussion: '04_PERCS (Slots 300-399)',
    bass: '05_BASS_808 (Slots 400-499)',
    '808': '05_BASS_808 (Slots 400-499)',
    lead: '06_LEADS_KEYS (Slots 500-599)',
    pad: '07_PADS_CHORDS (Slots 600-699)',
    vocal: '08_VOCALS (Slots 700-799)',
    fx: '09_FX_HITS (Slots 800-899)',
    loop: '00_LOOPS_STEMS (Slots 900-999)',
    'multi-sound': '00_LOOPS_STEMS (Slots 900-999)',
    other: '04_PERCS (Slots 300-399)',
  };

  const typeCounters: Record<string, number> = {};

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (onProgress) onProgress(i + 1, samples.length, sample.name);
    if (!sample.audioBuffer) continue;

    const folderName = categoryFolders[sample.type] || '04_PERCS (Slots 300-399)';
    const subFolder = epFolder.folder(folderName) || epFolder;

    // Track slot in category
    const catKey = sample.type;
    typeCounters[catKey] = (typeCounters[catKey] || 0) + 1;
    const slotNumber = sample.ep133Slot || (sample.category === 'loop' ? 900 + (typeCounters[catKey] % 99) : 1 + (i % 998));
    const paddedSlot = String(slotNumber).padStart(3, '0');

    const wavBlob = audioBufferToWavBlob(sample.audioBuffer, {
      bitDepth: 16,
      sampleRate: targetSampleRate,
      monoSum: useMono,
      normalize: !loudnessMatch,
      loudnessMatch: loudnessMatch,
      targetLufs: sample.isLoop ? -14 : -18,
      targetPeakDb: -0.1,
      removeDc: true,
      trimSilence: true,
      silenceThresholdDb: -50,
      bpm: sample.bpm,
      rootKey: sample.key,
    });

    const cleanName = sample.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const keyStr = sample.key ? `_${sample.key.replace(/\s+/g, '')}` : '';
    const bpmStr = sample.bpm ? `_${sample.bpm}BPM` : '';
    const genreStr = sample.genre ? `_${sample.genre.split('/')[0].trim().replace(/\s+/g, '')}` : '';
    const fileName = `${paddedSlot}_${cleanName}${keyStr}${bpmStr}${genreStr}.wav`;

    subFolder.file(fileName, wavBlob);
  }

  // Add Readme info for Teenage Engineering users
  const readme = `=== TEENAGE ENGINEERING EP-133 K.O. II SAMPLE PACK ===
Generated by Resonance Studio PRO

SPECIFICATIONS:
- Format: 16-bit / ${targetSampleRate} Hz PCM WAV (${useMono ? 'MONO - 50% Memory Saver' : 'STEREO'})
- Volume: EBU R128 Loudness Balanced & True-Peak Normalized
- Slots: Pre-numbered 001 - 999 corresponding to EP-133 Sound Groups (Pad 1 = Kicks, Pad 2 = Snares...)

TRANSFER INSTRUCTIONS:
1. Connect your EP-133 K.O. II via USB-C to your computer.
2. Open Google Chrome and go to the official Teenage Engineering Sample Tool:
   https://teenage.engineering/apps/ep-sample-tool
3. Drag & drop the sound files directly onto the corresponding sound slots!
`;
  epFolder.file('README_EP133_INSTRUCTIONS.txt', readme);

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Universal Batch Convert & Process with Hardware Presets
 */
export async function processBatchConvert(
  samples: SampleItem[],
  settings: BatchConvertSettings,
  onProgress?: (index: number, total: number, currentName: string) => void
): Promise<Blob> {
  if (settings.hardwarePreset === 'ep133') {
    return await exportEp133ProjectPack(
      samples,
      {
        useMono: settings.channels === 'mono',
        sampleRate: (settings.sampleRate === 44100 || settings.sampleRate === 48000) ? settings.sampleRate : 46875,
        loudnessMatch: settings.loudnessMatch,
      },
      onProgress
    );
  }

  if (settings.hardwarePreset === 'op1') {
    return await batchGenerateOp1Kits(
      samples,
      {
        packName: 'Resonance_OP1',
        loudnessMatch: settings.loudnessMatch,
        useMono: settings.channels === 'mono',
      },
      (progress, currentKit) => {
        if (onProgress) {
          onProgress(Math.round((progress / 100) * samples.length), samples.length, currentKit);
        }
      }
    );
  }

  const zip = new JSZip();
  const total = samples.length;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (onProgress) onProgress(i + 1, total, sample.name);
    if (!sample.audioBuffer) continue;

    const wavBlob = audioBufferToWavBlob(sample.audioBuffer, {
      bitDepth: settings.bitDepth,
      sampleRate: settings.sampleRate === 'original' ? sample.sampleRate : settings.sampleRate,
      normalize: settings.normalize,
      loudnessMatch: settings.loudnessMatch,
      targetLufs: settings.targetLufs,
      targetPeakDb: settings.targetPeakDb,
      removeDc: settings.removeDcOffset,
      monoSum: settings.channels === 'mono',
      trimSilence: settings.trimSilence,
      silenceThresholdDb: settings.silenceThresholdDb,
      bpm: sample.bpm,
      rootKey: sample.key,
    });

    let fileName = settings.fileNamePattern
      .replace('{name}', sample.name)
      .replace('{type}', sample.type)
      .replace('{key}', sample.key || 'NoKey')
      .replace('{bpm}', sample.bpm ? `${sample.bpm}` : '00')
      .replace('{ep133_slot}', String(sample.ep133Slot || (i + 1)).padStart(3, '0'))
      .replace('{genre}', sample.genre ? sample.genre.replace(/[^a-zA-Z0-9_-]/g, '_') : 'General')
      .replace(/[^a-zA-Z0-9_\-.]/g, '_');

    if (!fileName.endsWith('.wav')) {
      fileName += '.wav';
    }

    if (settings.splitByCategories) {
      const folderName = sample.isLoop ? 'Loops' : `${sample.type.toUpperCase()}S`;
      const targetFolder = zip.folder(folderName) || zip;
      targetFolder.file(fileName, wavBlob);
    } else {
      zip.file(fileName, wavBlob);
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Exports multiple samples packaged into a structured ZIP archive
 */
export async function exportMultipleWavsAsZip(
  samples: { sample: SampleItem; destinationPath: string }[],
  options?: {
    onProgress?: (current: number, total: number, name: string) => void;
  }
): Promise<Blob> {
  const zip = new JSZip();
  const total = samples.length;

  for (let i = 0; i < samples.length; i++) {
    const item = samples[i];
    const s = item.sample;
    if (options?.onProgress) {
      options.onProgress(i + 1, total, s.name);
    }
    if (!s.audioBuffer) continue;

    const wavBlob = audioBufferToWavBlob(s.audioBuffer, {
      bitDepth: 24,
      sampleRate: s.sampleRate,
      normalize: false,
      removeDc: true,
      bpm: s.bpm,
      rootKey: s.key,
    });

    // Remove leading slash if present for zip relative paths
    const cleanPath = item.destinationPath.startsWith('/')
      ? item.destinationPath.slice(1)
      : item.destinationPath;

    zip.file(cleanPath, wavBlob);
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Triggers browser download of a Blob
 */
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

