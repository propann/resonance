import { MusicGenre, SampleCategory, SampleType, SliceRegion, SampleItem } from '../types/sample';
import { rule, token, word } from './nameTokens';

// Note names
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Major & Minor profile vectors for Chromagram Key Detection (Krumhansl-Schmuckler profiles)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/**
 * Converts frequency in Hz to closest musical note and cents deviation
 */
export function frequencyToNote(freq: number): { note: string; octave: number; cents: number; fullNote: string } | null {
  if (freq <= 15 || freq > 8000 || isNaN(freq)) return null;
  const midi = 69 + 12 * Math.log2(freq / 440);
  const roundedMidi = Math.round(midi);
  const cents = Math.round((midi - roundedMidi) * 100);
  const noteIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const note = NOTE_NAMES[noteIndex];
  return {
    note,
    octave,
    cents,
    fullNote: `${note}${octave}`,
  };
}

/**
 * Advanced Pitch & Harmonic Key / Scale Detector (Root Note + Major/Minor mode)
 */
export function detectPitchAndKey(buffer: AudioBuffer): { pitchHz?: number; keyString?: string; mode?: 'maj' | 'min'; rootNote?: string; confidence?: number } | null {
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const maxSamples = Math.min(channelData.length, Math.floor(sampleRate * 2.5));
  if (maxSamples < 1024) return null;

  // 1. YIN / Autocorrelation for fundamental frequency (mono melody, bass, 808)
  const windowSize = 2048;
  const step = 1024;
  const pitchCandidates: number[] = [];

  for (let start = 0; start < maxSamples - windowSize; start += step) {
    let bestR = 0;
    let bestLag = -1;
    const minLag = Math.floor(sampleRate / 1600); // ~1600 Hz
    const maxLag = Math.floor(sampleRate / 28);   // ~28 Hz

    for (let lag = minLag; lag < maxLag && lag < windowSize / 2; lag++) {
      let r = 0;
      let energy1 = 0;
      let energy2 = 0;

      for (let i = 0; i < windowSize / 2; i += 2) {
        const s1 = channelData[start + i];
        const s2 = channelData[start + i + lag];
        r += s1 * s2;
        energy1 += s1 * s1;
        energy2 += s2 * s2;
      }

      const norm = Math.sqrt(energy1 * energy2) || 0.0001;
      const normalizedCorrelation = r / norm;

      if (normalizedCorrelation > 0.65 && normalizedCorrelation > bestR) {
        bestR = normalizedCorrelation;
        bestLag = lag;
      }
    }

    if (bestLag > 0 && bestR > 0.68) {
      const candidateFreq = sampleRate / bestLag;
      pitchCandidates.push(candidateFreq);
    }
  }

  // 2. Chromagram 12-bin Pitch Class Profile (PCP) for polyphonic chord key detection
  const chroma = new Float32Array(12);
  const fftSize = 4096;
  const numWindows = Math.min(6, Math.floor(maxSamples / fftSize));

  for (let w = 0; w < numWindows; w++) {
    const offset = w * fftSize;
    for (let i = 0; i < fftSize / 2; i += 4) {
      const freq = (i * sampleRate) / fftSize;
      if (freq >= 60 && freq <= 3500) {
        // Discrete Fourier component magnitude approximation
        let real = 0;
        let imag = 0;
        for (let j = 0; j < 512; j += 4) {
          const sample = channelData[offset + j];
          const angle = (2 * Math.PI * i * j) / fftSize;
          real += sample * Math.cos(angle);
          imag -= sample * Math.sin(angle);
        }
        const mag = Math.sqrt(real * real + imag * imag);
        const midi = Math.round(69 + 12 * Math.log2(freq / 440));
        const pitchClass = ((midi % 12) + 12) % 12;
        chroma[pitchClass] += mag;
      }
    }
  }

  // Correlate Chroma with Major and Minor Key Profiles
  let bestKeyScore = -Infinity;
  let bestKeyName = '';
  let bestRoot = 'C';
  let bestMode: 'maj' | 'min' = 'min';

  for (let root = 0; root < 12; root++) {
    let majScore = 0;
    let minScore = 0;
    for (let i = 0; i < 12; i++) {
      const chromaVal = chroma[(root + i) % 12];
      majScore += chromaVal * MAJOR_PROFILE[i];
      minScore += chromaVal * MINOR_PROFILE[i];
    }

    if (majScore > bestKeyScore) {
      bestKeyScore = majScore;
      bestRoot = NOTE_NAMES[root];
      bestMode = 'maj';
      bestKeyName = `${bestRoot} maj`;
    }
    if (minScore > bestKeyScore) {
      bestKeyScore = minScore;
      bestRoot = NOTE_NAMES[root];
      bestMode = 'min';
      bestKeyName = `${bestRoot} min`;
    }
  }

  // If we have strong monophonic fundamental pitch candidates (e.g. 808, Sub, Lead)
  if (pitchCandidates.length > 0) {
    pitchCandidates.sort((a, b) => a - b);
    const medianPitch = pitchCandidates[Math.floor(pitchCandidates.length / 2)];
    const noteInfo = frequencyToNote(medianPitch);
    if (noteInfo) {
      return {
        pitchHz: Math.round(medianPitch * 10) / 10,
        keyString: `${noteInfo.note} ${bestMode}`,
        mode: bestMode,
        rootNote: noteInfo.note,
        confidence: 0.92,
      };
    }
  }

  return {
    keyString: bestKeyName,
    mode: bestMode,
    rootNote: bestRoot,
    confidence: 0.78,
  };
}

/**
 * Detect BPM / Tempo using energy peaks & autocorrelation of onset intervals
 */
export function detectBpm(buffer: AudioBuffer): number | undefined {
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const duration = buffer.duration;

  // Only attempt BPM on samples > 1.0s
  if (duration < 1.0) return undefined;

  // Downsample to 4000 Hz for faster energy envelope calculation
  const targetRate = 4000;
  const ratio = Math.max(1, Math.floor(sampleRate / targetRate));
  const downsampledLength = Math.floor(channelData.length / ratio);
  const envelope = new Float32Array(downsampledLength);

  // Compute energy envelope
  for (let i = 0; i < downsampledLength; i++) {
    let sum = 0;
    for (let j = 0; j < ratio; j++) {
      const val = channelData[i * ratio + j] || 0;
      sum += val * val;
    }
    envelope[i] = Math.sqrt(sum / ratio);
  }

  // Energy difference (onset strength)
  const onsets = new Float32Array(downsampledLength);
  for (let i = 1; i < downsampledLength; i++) {
    const diff = envelope[i] - envelope[i - 1];
    onsets[i] = diff > 0 ? diff : 0;
  }

  // Autocorrelation for BPM in range 65 to 180 BPM
  let maxCorr = 0;
  let bestBpm = 0;

  for (let bpm = 65; bpm <= 180; bpm += 1) {
    const intervalSamples = Math.round((60 / bpm) * targetRate);
    let corr = 0;
    let count = 0;

    for (let i = 0; i < downsampledLength - intervalSamples * 2; i += 4) {
      corr += onsets[i] * onsets[i + intervalSamples];
      count++;
    }

    const avgCorr = count > 0 ? corr / count : 0;
    if (avgCorr > maxCorr) {
      maxCorr = avgCorr;
      bestBpm = bpm;
    }
  }

  if (bestBpm > 0 && maxCorr > 0.00008) {
    return Math.round(bestBpm);
  }

  return undefined;
}

/**
 * Calculates audio statistics: Peak dB, RMS dB, Spectral Centroid, Integrated LUFS, Loudness Target Gain
 */
export function calculateAudioMetrics(buffer: AudioBuffer): {
  peakDb: number;
  rmsDb: number;
  lufs: number;
  loudnessGainDb: number;
  dynamicRangeDb: number;
  spectralCentroid: number;
  zeroCrossingRate: number;
  sustainFactor: number;
} {
  const data = buffer.getChannelData(0);
  const length = data.length;
  let peak = 0;
  let sumSquares = 0;
  let zeroCrossings = 0;

  // Energy in first quarter vs last half (for sustain / decay analysis)
  let energyFirstQuarter = 0;
  let energyLastHalf = 0;
  const q1 = Math.floor(length * 0.25);
  const h2 = Math.floor(length * 0.5);

  // K-Weighting filter simulation state for LUFS (High-pass 100Hz + High-shelf 2kHz boost)
  let kSumSquares = 0;
  let prevSample = 0;

  for (let i = 0; i < length; i++) {
    const s = data[i];
    const absVal = Math.abs(s);
    if (absVal > peak) peak = absVal;
    sumSquares += s * s;

    if (i < q1) energyFirstQuarter += s * s;
    if (i >= h2) energyLastHalf += s * s;

    // Zero crossing
    if (i > 0 && ((s >= 0 && data[i - 1] < 0) || (s < 0 && data[i - 1] >= 0))) {
      zeroCrossings++;
    }

    // High-pass + presence weighting approx
    const diff = s - prevSample * 0.95;
    kSumSquares += diff * diff;
    prevSample = s;
  }

  const rms = Math.sqrt(sumSquares / Math.max(1, length)) || 0.00001;
  const peakDb = peak > 0 ? Math.round(20 * Math.log10(peak) * 10) / 10 : -96;
  const rmsDb = Math.round(20 * Math.log10(rms) * 10) / 10;
  
  // Approximate Integrated LUFS (EBU R128)
  const kRms = Math.sqrt(kSumSquares / Math.max(1, length)) || 0.00001;
  const lufs = Math.round((-0.691 + 10 * Math.log10(kRms * kRms + 1e-12)) * 10) / 10;

  // Target loudness matching gain:
  // Loops target -14 LUFS, One-shots target -1 dBFS peak with -18 LUFS minimum
  const isLikelyOneShot = buffer.duration < 1.2;
  const targetLoudness = isLikelyOneShot ? -18.0 : -14.0;
  const rawGainDb = targetLoudness - lufs;
  // Prevent clipping: do not exceed peak headroom
  const maxSafeGainDb = Math.max(0, -0.3 - peakDb);
  const loudnessGainDb = Math.round(Math.min(rawGainDb, maxSafeGainDb) * 10) / 10;

  const dynamicRangeDb = Math.max(0, Math.round((peakDb - rmsDb) * 10) / 10);
  const zcr = Math.round((zeroCrossings / length) * 1000) / 1000;

  const sustainFactor = energyFirstQuarter > 0 ? (energyLastHalf / (length - h2)) / (energyFirstQuarter / q1) : 0;

  // Spectral centroid approximation
  let centroid = 2000;
  if (zcr > 0.3) {
    centroid = Math.min(10000, Math.round(zcr * 14000));
  } else if (zcr < 0.05) {
    centroid = Math.max(80, Math.round(zcr * 2000));
  } else {
    centroid = Math.round(zcr * 8000);
  }

  return {
    peakDb,
    rmsDb,
    lufs: Math.max(-70, Math.min(0, lufs)),
    loudnessGainDb,
    dynamicRangeDb,
    spectralCentroid: centroid,
    zeroCrossingRate: zcr,
    sustainFactor: Math.min(2.0, Math.max(0, sustainFactor)),
  };
}

/**
 * Detects whether an audio item is a Loop or a One-Shot and estimates musical bar length
 */
export function detectLoopVsOneShot(
  buffer: AudioBuffer,
  fileName: string = '',
  bpm?: number,
  sustainFactor: number = 0.5
): { isLoop: boolean; loopBars?: number; estimatedBars?: number; bpm?: number; category: SampleCategory } {
  const duration = buffer.duration;
  const lower = (fileName || '').toLowerCase();

  // Explicit name indicators
  if (lower.includes('loop') || lower.includes('break') || lower.includes('toploop') || lower.includes('melody') || lower.includes('groove') || lower.includes('stem')) {
    const bars = estimateBarCount(duration, bpm);
    return { isLoop: true, loopBars: bars, estimatedBars: bars, bpm, category: 'loop' };
  }
  if (lower.includes('oneshot') || lower.includes('one-shot') || lower.includes('hit') || lower.includes('kick') || lower.includes('snare') || lower.includes('clap') || lower.includes('hat') || lower.includes('stab')) {
    if (duration < 3.0) {
      return { isLoop: false, category: 'one-shot' };
    }
  }

  // Acoustic Duration & Sustain Analysis
  if (duration < 1.4) {
    return { isLoop: false, category: 'one-shot' };
  }

  // If duration matches exact bars at the detected BPM (within 5% tolerance)
  if (bpm && bpm >= 60 && bpm <= 180) {
    const beatSec = 60 / bpm;
    const barSec = beatSec * 4;

    const possibleBars = [1, 2, 4, 8, 16];
    for (const b of possibleBars) {
      const expectedDuration = barSec * b;
      const errorRatio = Math.abs(duration - expectedDuration) / expectedDuration;
      if (errorRatio < 0.06) {
        return { isLoop: true, loopBars: b, estimatedBars: b, bpm, category: 'loop' };
      }
    }
  }

  // If long audio (>3.2s) with high sustain ratio -> Loop
  if (duration >= 2.8 && sustainFactor > 0.15) {
    const bars = estimateBarCount(duration, bpm);
    return { isLoop: true, loopBars: bars, estimatedBars: bars, bpm, category: 'loop' };
  }

  return { isLoop: false, category: 'one-shot' };
}

function estimateBarCount(duration: number, bpm?: number): number {
  if (bpm && bpm > 0) {
    const barSec = (60 / bpm) * 4;
    const bars = Math.round(duration / barSec);
    if (bars === 1 || bars === 2 || bars === 4 || bars === 8 || bars === 16) {
      return bars;
    }
  }
  if (duration < 2.5) return 1;
  if (duration < 4.8) return 2;
  if (duration < 9.5) return 4;
  if (duration < 18) return 8;
  return 16;
}

/**
 * Intelligent Music Genre & Style Classifier
 */
export function classifyGenre(
  param1: SampleType | string,
  param2?: number | boolean | { spectralCentroid?: number; zeroCrossingRate?: number; dynamicRangeDb?: number; peakDb?: number; rmsDb?: number },
  param3?: any,
  param4?: string
): MusicGenre {
  let fileName = '';
  let bpm: number | undefined = undefined;
  let type: SampleType = 'other';
  let metrics = { spectralCentroid: 2000, zeroCrossingRate: 0.1, dynamicRangeDb: 12, peakDb: 0, rmsDb: -14 };

  if (typeof param1 === 'string' && (typeof param2 === 'number' || param2 === undefined) && typeof param3 === 'boolean') {
    // Called as classifyGenre(fileName, bpm, isLoop, type)
    fileName = param1;
    bpm = param2 as number | undefined;
    type = (param4 as SampleType) || 'other';
  } else {
    type = param1 as SampleType;
    bpm = typeof param2 === 'number' ? param2 : undefined;
    if (param3 && typeof param3 === 'object') metrics = { ...metrics, ...param3 };
    fileName = param4 || '';
  }

  const lower = fileName.toLowerCase();

  // 1. Keyword Overrides
  if (lower.includes('boombap') || lower.includes('boom bap') || lower.includes('hiphop') || lower.includes('hip hop') || lower.includes('90s')) {
    return 'Hip-Hop / BoomBap';
  }
  if (lower.includes('trap') || lower.includes('drill') || lower.includes('808') || lower.includes('sliding')) {
    return 'Trap / Drill';
  }
  if (lower.includes('house') || lower.includes('techhouse') || lower.includes('deep house') || lower.includes('club')) {
    return 'House / EDM';
  }
  if (lower.includes('techno') || lower.includes('acid') || lower.includes('industrial') || lower.includes('berlin')) {
    return 'Techno / Industrial';
  }
  if (lower.includes('lofi') || lower.includes('lo-fi') || lower.includes('chill') || lower.includes('tape') || lower.includes('vintage')) {
    return 'Lo-Fi / Chillhop';
  }
  if (lower.includes('synthwave') || lower.includes('retro') || lower.includes('80s') || lower.includes('outrun')) {
    return 'Synthwave / Retro';
  }
  if (lower.includes('dnb') || lower.includes('drum and bass') || lower.includes('jungle') || lower.includes('breakbeat')) {
    return 'Drum & Bass / Jungle';
  }
  if (lower.includes('afro') || lower.includes('dancehall') || lower.includes('reggae') || lower.includes('amapiano')) {
    return 'Afrobeat / Dancehall';
  }
  if (lower.includes('ambient') || lower.includes('cinematic') || lower.includes('drone') || lower.includes('space') || lower.includes('lush')) {
    return 'Ambient / Cinematic';
  }
  if (lower.includes('pop') || lower.includes('rnb') || lower.includes('r&b') || lower.includes('soul')) {
    return 'Pop / R&B';
  }
  if (lower.includes('rock') || lower.includes('acoustic') || lower.includes('guitar') || lower.includes('folk')) {
    return 'Acoustic / Rock';
  }

  // 2. Tempo & Acoustic Spectral Profiling
  if (bpm) {
    if (bpm >= 160 && bpm <= 185) return 'Drum & Bass / Jungle';
    if (bpm >= 135 && bpm <= 155 && (type === '808' || type === 'hihat' || metrics.spectralCentroid > 3000)) return 'Trap / Drill';
    if (bpm >= 120 && bpm <= 130) {
      if (metrics.spectralCentroid < 1200 && metrics.dynamicRangeDb > 10) return 'Techno / Industrial';
      return 'House / EDM';
    }
    if (bpm >= 130 && bpm <= 145 && metrics.dynamicRangeDb > 8) return 'Techno / Industrial';
    if (bpm >= 105 && bpm <= 125) return 'Synthwave / Retro';
    if (bpm >= 95 && bpm <= 115) return 'Afrobeat / Dancehall';
    if (bpm >= 80 && bpm <= 95) {
      if (metrics.spectralCentroid < 2200) return 'Lo-Fi / Chillhop';
      return 'Hip-Hop / BoomBap';
    }
    if (bpm >= 65 && bpm < 80) return 'Lo-Fi / Chillhop';
  }

  // 3. Acoustic Timbre Defaults
  if (type === '808') return 'Trap / Drill';
  if (type === 'pad') return 'Ambient / Cinematic';
  if (type === 'kick' && metrics.spectralCentroid > 2000) return 'House / EDM';
  if (type === 'kick' && metrics.spectralCentroid < 800) return 'Hip-Hop / BoomBap';

  return 'Universal / Multi-Genre';
}

/**
 * Assigns Teenage Engineering EP-133 K.O. II sound slot (001 - 999)
 */
export function assignEp133Slot(
  type: SampleType,
  isLoopOrIndex?: boolean | number,
  indexInType?: number
): number {
  // EP-133 Pad Groups:
  // 1 (Kicks): 001 - 099
  // 2 (Snares/Claps): 100 - 199
  // 3 (Hi-Hats/Cymbals): 200 - 299
  // 4 (Percussion): 300 - 399
  // 5 (Bass & 808): 400 - 499
  // 6 (Leads & Keys): 500 - 599
  // 7 (Pads & Chords): 600 - 699
  // 8 (Vocals): 700 - 799
  // 9 (FX): 800 - 899
  // 0 (Loops/Stems): 900 - 999
  const idx = typeof isLoopOrIndex === 'number' ? isLoopOrIndex : (indexInType ?? 1);
  const isLoop = typeof isLoopOrIndex === 'boolean' ? isLoopOrIndex : type === 'loop';

  if (isLoop) {
    return Math.min(999, 900 + (idx % 99));
  }

  let baseSlot = 1;
  switch (type) {
    case 'kick':
      baseSlot = 1;
      break;
    case 'snare':
    case 'clap':
      baseSlot = 100;
      break;
    case 'hihat':
    case 'cymbal':
      baseSlot = 200;
      break;
    case 'percussion':
      baseSlot = 300;
      break;
    case 'bass':
    case '808':
      baseSlot = 400;
      break;
    case 'lead':
      baseSlot = 500;
      break;
    case 'pad':
      baseSlot = 600;
      break;
    case 'vocal':
      baseSlot = 700;
      break;
    case 'fx':
      baseSlot = 800;
      break;
    case 'loop':
    case 'multi-sound':
    default:
      baseSlot = 900;
      break;
  }

  return Math.min(999, baseSlot + (idx % 99));
}

/**
 * Advanced Spectral & Acoustic Feature Extractor for Precision Sound Classification
 */
export function extractAcousticFeatures(buffer: AudioBuffer): {
  lowEnergyRatio: number; // 20 - 150 Hz
  midEnergyRatio: number; // 150 - 2500 Hz
  highEnergyRatio: number; // > 2500 Hz
  attackTimeMs: number; // time to reach peak
  pitchDropHz: number; // frequency drop in first 40ms (kick signature)
  preTransientBurstCount: number; // clap pre-burst micro-peaks
  subDominantFreq: number; // strongest peak in 30-120Hz
  decayTimeMs: number;
} {
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const length = Math.min(channelData.length, Math.floor(sampleRate * 2.0)); // analyze first 2s

  // 1. Peak & Attack Time Detection
  let peakVal = 0;
  let peakIndex = 0;
  for (let i = 0; i < length; i++) {
    const absVal = Math.abs(channelData[i]);
    if (absVal > peakVal) {
      peakVal = absVal;
      peakIndex = i;
    }
  }
  const attackTimeMs = (peakIndex / sampleRate) * 1000;

  // 2. Pre-transient bursts (Clap detection: multiple micro-peaks before main body)
  let preBursts = 0;
  const preWindow = Math.min(peakIndex, Math.floor(sampleRate * 0.04));
  let inBurst = false;
  const clapThreshold = peakVal * 0.25;
  for (let i = 0; i < preWindow; i++) {
    const v = Math.abs(channelData[i]);
    if (v > clapThreshold && !inBurst) {
      preBursts++;
      inBurst = true;
    } else if (v < clapThreshold * 0.5) {
      inBurst = false;
    }
  }

  // 3. Decay Time Detection (time from peak to -20dB)
  const decayThreshold = peakVal * 0.1;
  let decayIndex = peakIndex;
  for (let i = peakIndex; i < length; i++) {
    if (Math.abs(channelData[i]) < decayThreshold) {
      decayIndex = i;
      break;
    }
  }
  const decayTimeMs = ((decayIndex - peakIndex) / sampleRate) * 1000;

  // 4. Band Energy Ratios using mini-FFT / frequency filters
  const fftSize = 1024;
  const numWindows = Math.min(8, Math.floor(length / fftSize));
  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;
  let totalEnergy = 0;

  for (let w = 0; w < numWindows; w++) {
    const offset = w * fftSize;
    for (let k = 1; k < fftSize / 2; k += 2) {
      const freq = (k * sampleRate) / fftSize;
      let real = 0;
      let imag = 0;
      const step = 2;
      for (let n = 0; n < fftSize; n += step) {
        const s = channelData[offset + n] || 0;
        const angle = (2 * Math.PI * k * n) / fftSize;
        real += s * Math.cos(angle);
        imag -= s * Math.sin(angle);
      }
      const power = real * real + imag * imag;
      totalEnergy += power;
      if (freq <= 150) {
        lowEnergy += power;
      } else if (freq <= 2500) {
        midEnergy += power;
      } else {
        highEnergy += power;
      }
    }
  }

  const safeTotal = totalEnergy || 1;
  const lowRatio = lowEnergy / safeTotal;
  const midRatio = midEnergy / safeTotal;
  const highRatio = highEnergy / safeTotal;

  // 5. Kick pitch down-chirp estimation (zero crossings in first 15ms vs 15-40ms)
  const win1 = Math.floor(sampleRate * 0.015);
  const win2 = Math.floor(sampleRate * 0.045);
  let zc1 = 0;
  let zc2 = 0;
  for (let i = 1; i < win1; i++) {
    if ((channelData[i] >= 0 && channelData[i - 1] < 0) || (channelData[i] < 0 && channelData[i - 1] >= 0)) {
      zc1++;
    }
  }
  for (let i = win1 + 1; i < Math.min(length, win2); i++) {
    if ((channelData[i] >= 0 && channelData[i - 1] < 0) || (channelData[i] < 0 && channelData[i - 1] >= 0)) {
      zc2++;
    }
  }
  const freq1 = (zc1 * sampleRate) / (2 * win1);
  const freq2 = (zc2 * sampleRate) / (2 * Math.max(1, win2 - win1));
  const pitchDropHz = Math.max(0, freq1 - freq2);

  // Sub dominant frequency approximation
  const subDominantFreq = freq2 >= 20 && freq2 <= 140 ? freq2 : 55;

  return {
    lowEnergyRatio: lowRatio,
    midEnergyRatio: midRatio,
    highEnergyRatio: highRatio,
    attackTimeMs,
    pitchDropHz,
    preTransientBurstCount: preBursts,
    subDominantFreq,
    decayTimeMs,
  };
}

/**
 * Comprehensive Sample Classification (Acoustic + Harmonic + Temporal + Genre)
 */
/** What a keyword match settles: the type, its tags and how the call is explained. */
type KeywordVerdict = { type: SampleType; tags: string[]; acousticConfidence: number; acousticDetails: string };

/**
 * Names that state the sound outright. `word(...)` is for terms long enough to
 * be safe inside a run-together name (`TrapKick`); `token(...)` is for short
 * codes that must stand alone, separated by `_`, `-`, `.`, a space, a digit or
 * the end of the name.
 */
const KEYWORD_RULES: Array<[RegExp, KeywordVerdict]> = [
  [
    rule(word('kick', 'bassdrum', 'bass.?drum'), token('bd', 'kik', 'kck')),
    { type: 'kick', tags: ['punch', 'low-end', 'drum', 'one-shot'], acousticConfidence: 0.98, acousticDetails: 'Keyword: Kick Drum' },
  ],
  [
    rule(word('808', 'subbass', 'sub.?bass')),
    { type: '808', tags: ['sub', 'trap', 'bass', 'saturated'], acousticConfidence: 0.98, acousticDetails: 'Keyword: 808 Sub' },
  ],
  [
    rule(word('snare', 'rimshot', 'rim.?shot', 'sidestick', 'side.?stick'), token('sd', 'snr', 'rim')),
    { type: 'snare', tags: ['drum', 'crack', 'one-shot'], acousticConfidence: 0.98, acousticDetails: 'Keyword: Snare Drum' },
  ],
  [
    rule(word('hihat', 'hi.?hat', 'shaker', 'tambourine', 'tambour'), token('hh', 'hat')),
    { type: 'hihat', tags: ['high', 'top', 'metallic', 'crisp'], acousticConfidence: 0.98, acousticDetails: 'Keyword: Hi-Hat / Shaker' },
  ],
  [
    rule(word('handclap', 'hand.?clap', 'fingersnap', 'finger.?snap'), token('clap', 'clp', 'snap')),
    { type: 'clap', tags: ['layered', 'percussion', 'stereo'], acousticConfidence: 0.98, acousticDetails: 'Keyword: Handclap' },
  ],
  [
    rule(word('cymbal', 'crash', 'splash', 'china'), token('ride', 'cym')),
    { type: 'cymbal', tags: ['bright', 'splash', 'acoustic'], acousticConfidence: 0.98, acousticDetails: 'Keyword: Cymbal / Crash' },
  ],
  [
    rule(word('vocal', 'acapella', 'choir', 'chant'), token('vox', 'vcl')),
    { type: 'vocal', tags: ['voice', 'melodic', 'fx'], acousticConfidence: 0.95, acousticDetails: 'Keyword: Vocal' },
  ],
  [
    rule(word('loop', 'breakbeat', 'groove', 'toploop', 'top.?loop'), token('break', 'bpm')),
    { type: 'loop', tags: ['groove', 'rhythm', 'tempo-synced'], acousticConfidence: 0.96, acousticDetails: 'Keyword: Loop / Break' },
  ],
  [
    rule(word('lead', 'synth', 'pluck', 'arpeggio', 'keyboard'), token('arp', 'key')),
    { type: 'lead', tags: ['melodic', 'tonal', 'synth'], acousticConfidence: 0.95, acousticDetails: 'Keyword: Synth Lead' },
  ],
  [
    rule(word('drone', 'ambient', 'atmos', 'texture'), token('pad')),
    { type: 'pad', tags: ['atmospheric', 'sustained', 'lush'], acousticConfidence: 0.95, acousticDetails: 'Keyword: Pad / Drone' },
  ],
  [
    rule(word('riser', 'sweep', 'downlifter', 'transition', 'impact'), token('fx', 'sfx')),
    { type: 'fx', tags: ['transition', 'texture', 'cinema'], acousticConfidence: 0.95, acousticDetails: 'Keyword: Sound FX' },
  ],
];

export function classifySample(
  buffer: AudioBuffer,
  fileName: string,
  metrics: { peakDb: number; rmsDb: number; spectralCentroid: number; zeroCrossingRate: number; dynamicRangeDb: number; sustainFactor: number },
  slicesCount: number
): { type: SampleType; tags: string[]; isMultiSound: boolean; acousticConfidence: number; acousticDetails: string } {
  const lowerName = fileName.toLowerCase();
  const duration = buffer.duration;
  const centroid = metrics.spectralCentroid;
  const zcr = metrics.zeroCrossingRate;

  // 1. Explicit keyword override, when the name states what the sound is.
  //
  // Read in order, first match wins. Short codes go through `token` so they
  // have to stand on their own: a bare `includes('hat')` used to read a hi-hat
  // out of `Whatever_Vox.wav`, a ride out of `Override_Lead.wav` and an arp
  // out of `Sharp_Stab.wav`. A name that names nothing falls through to the
  // acoustic analysis below, which is the right answer — better than a
  // confident wrong one.
  for (const [pattern, verdict] of KEYWORD_RULES) {
    if (pattern.test(lowerName)) return { ...verdict, isMultiSound: false };
  }

  // 2. Multi-Sound Hit Strip Check (e.g. OP-1 Drum kits or multi-transient recording)
  if (slicesCount >= 3 && duration >= 1.2) {
    return {
      type: 'multi-sound',
      tags: ['multi-hit', 'kit-strip', 'sliceable', 'op1-ready'],
      isMultiSound: true,
      acousticConfidence: 0.94,
      acousticDetails: `Multi-Hit Strip (${slicesCount} onsets détectés, ${duration.toFixed(1)}s)`,
    };
  }

  // 3. Acoustic DSP Deep Extraction
  const features = extractAcousticFeatures(buffer);

  // KICK DETECTION: Low frequency dominance (>50%), fast pitch down-chirp or punchy attack < 8ms, duration 0.08 - 0.75s
  if (
    duration <= 0.85 &&
    (features.lowEnergyRatio > 0.45 || centroid < 480) &&
    features.attackTimeMs < 15
  ) {
    return {
      type: 'kick',
      tags: ['punch', 'sub-bass', 'drum', 'one-shot'],
      isMultiSound: false,
      acousticConfidence: 0.92,
      acousticDetails: `Acoustique: Kick (Sub ${Math.round(features.subDominantFreq)}Hz, Attaque ${features.attackTimeMs.toFixed(1)}ms)`,
    };
  }

  // 808 / SUB BASS DETECTION: Sustained low-frequency energy (>0.45s), low centroid < 400Hz
  if (
    (duration >= 0.45 || features.decayTimeMs > 400) &&
    (features.lowEnergyRatio > 0.5 || centroid < 420) &&
    centroid < 850
  ) {
    return {
      type: '808',
      tags: ['808', 'sub', 'trap', 'bass'],
      isMultiSound: false,
      acousticConfidence: 0.91,
      acousticDetails: `Acoustique: 808 Sub (Basses ${(features.lowEnergyRatio * 100).toFixed(0)}%, Decay ${Math.round(features.decayTimeMs)}ms)`,
    };
  }

  // CLAP DETECTION: Pre-transient micro-bursts (>= 2) with mid-high snappy body
  if (duration < 0.9 && features.preTransientBurstCount >= 2 && centroid > 1400) {
    return {
      type: 'clap',
      tags: ['handclap', 'layered-burst', 'stereo-snap'],
      isMultiSound: false,
      acousticConfidence: 0.89,
      acousticDetails: `Acoustique: Handclap (${features.preTransientBurstCount} micro-transitoires)`,
    };
  }

  // HI-HAT / SHAKER / CYMBAL DETECTION: High centroid (> 4200Hz) or ultra-high Zero-Crossing-Rate (> 0.22)
  if (centroid > 4200 || (zcr > 0.22 && features.highEnergyRatio > 0.45)) {
    if (duration > 1.3) {
      return {
        type: 'cymbal',
        tags: ['cymbal', 'crash', 'bright', 'metallic'],
        isMultiSound: false,
        acousticConfidence: 0.90,
        acousticDetails: `Acoustique: Cymbale / Crash (${Math.round(centroid)}Hz, ${duration.toFixed(1)}s)`,
      };
    }
    return {
      type: 'hihat',
      tags: ['hi-hat', 'crisp', 'metallic', 'top'],
      isMultiSound: false,
      acousticConfidence: 0.93,
      acousticDetails: `Acoustique: Hi-Hat (${Math.round(centroid)}Hz, ZCR ${(zcr * 100).toFixed(0)}%)`,
    };
  }

  // SNARE DRUM DETECTION: Balanced mid-body punch (180-350Hz) + noisy top crack (2k-6kHz)
  if (
    duration < 0.9 &&
    features.midEnergyRatio > 0.35 &&
    centroid > 1400 &&
    centroid < 4200 &&
    metrics.dynamicRangeDb > 8
  ) {
    return {
      type: 'snare',
      tags: ['snare', 'crack', 'punch', 'percussion'],
      isMultiSound: false,
      acousticConfidence: 0.90,
      acousticDetails: `Acoustique: Snare Drum (Corps ${Math.round(centroid)}Hz, Snap ${metrics.dynamicRangeDb.toFixed(0)}dB)`,
    };
  }

  // PERCUSSION (Toms, Rims, Bongos, Shakers)
  if (duration < 0.9 && metrics.dynamicRangeDb > 9) {
    return {
      type: 'percussion',
      tags: ['perc', 'acoustic', 'short'],
      isMultiSound: false,
      acousticConfidence: 0.82,
      acousticDetails: `Acoustique: Percussion (${Math.round(centroid)}Hz)`,
    };
  }

  // LONG ATMOSPHERE / PAD DETECTION: duration > 2.5s and low RMS dynamic variation
  if (duration >= 2.5 && metrics.sustainFactor > 0.25 && metrics.dynamicRangeDb < 14) {
    return {
      type: 'pad',
      tags: ['pad', 'drone', 'ambient', 'lush'],
      isMultiSound: false,
      acousticConfidence: 0.88,
      acousticDetails: `Acoustique: Pad / Drone (${duration.toFixed(1)}s, Sustain ${(metrics.sustainFactor * 100).toFixed(0)}%)`,
    };
  }

  // LONG RHYTHMIC LOOP DETECTION: duration >= 1.5s with multiple energy bursts
  if (duration >= 1.5) {
    return {
      type: 'loop',
      tags: ['loop', 'rhythm', 'groove'],
      isMultiSound: false,
      acousticConfidence: 0.85,
      acousticDetails: `Acoustique: Rhythmic Loop (${duration.toFixed(1)}s)`,
    };
  }

  // TONAL SYNTH LEAD / BASS
  if (centroid < 1000 && features.lowEnergyRatio > 0.35) {
    return {
      type: 'bass',
      tags: ['bass', 'tonal', 'melodic'],
      isMultiSound: false,
      acousticConfidence: 0.80,
      acousticDetails: `Acoustique: Synth Bass (Centroid ${Math.round(centroid)}Hz)`,
    };
  }

  return {
    type: 'other',
    tags: ['sample', 'audio'],
    isMultiSound: false,
    acousticConfidence: 0.70,
    acousticDetails: 'Générique / Autre',
  };
}

/**
 * PRO Multi-sound & Transient Auto-Slicer
 */
export function detectAutoSlices(
  buffer: AudioBuffer,
  options?: {
    sensitivity?: number; // 0.1 to 1.0 (default 0.5)
    minSliceDurationMs?: number; // default 80ms
    silenceThresholdDb?: number; // default -38dB
    maxSlices?: number; // default 32
  }
): SliceRegion[] {
  const sensitivity = options?.sensitivity ?? 0.5;
  const minDurationSec = (options?.minSliceDurationMs ?? 80) / 1000;
  const silenceThresholdDb = options?.silenceThresholdDb ?? -38;
  const maxSlices = options?.maxSlices ?? 32;

  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const totalDuration = buffer.duration;

  const windowSize = Math.floor(sampleRate * 0.01);
  const numWindows = Math.floor(channelData.length / windowSize);

  if (numWindows < 5) {
    return [
      {
        id: 'slice-1',
        index: 1,
        startSec: 0,
        endSec: totalDuration,
        label: 'Slice 1',
        color: '#00F0FF',
      },
    ];
  }

  const rmsEnvelope = new Float32Array(numWindows);
  const silenceAmp = Math.pow(10, silenceThresholdDb / 20);

  for (let w = 0; w < numWindows; w++) {
    let sum = 0;
    const offset = w * windowSize;
    for (let i = 0; i < windowSize; i++) {
      const val = channelData[offset + i];
      sum += val * val;
    }
    rmsEnvelope[w] = Math.sqrt(sum / windowSize);
  }

  const minIntervalWindows = Math.max(2, Math.floor((minDurationSec * sampleRate) / windowSize));
  const rawOnsets: number[] = [0];
  const dynamicThreshold = 0.015 * (1.1 - sensitivity * 0.8);
  let lastOnsetWindow = 0;

  for (let w = 2; w < numWindows - 2; w++) {
    if (w - lastOnsetWindow < minIntervalWindows) continue;

    const currentRms = rmsEnvelope[w];
    const prevRms = rmsEnvelope[w - 1];
    const diff = currentRms - prevRms;

    const isAboveSilence = currentRms > silenceAmp;
    const isSuddenRise = diff > dynamicThreshold && currentRms > rmsEnvelope[w - 2] * 1.5;

    if (isAboveSilence && isSuddenRise) {
      const approxSample = w * windowSize;
      const scanStart = Math.max(0, approxSample - windowSize * 2);
      let localMinSample = scanStart;
      let minVal = Infinity;

      for (let s = scanStart; s < approxSample; s++) {
        if (Math.abs(channelData[s]) < minVal) {
          minVal = Math.abs(channelData[s]);
          localMinSample = s;
        }
      }

      const onsetTime = localMinSample / sampleRate;
      if (onsetTime - (lastOnsetWindow * windowSize) / sampleRate >= minDurationSec) {
        rawOnsets.push(onsetTime);
        lastOnsetWindow = w;
      }
    }
  }

  const slicePoints = rawOnsets.slice(0, maxSlices);
  slicePoints.sort((a, b) => a - b);

  const SLICE_COLORS = [
    '#00F0FF', // cyan
    '#3B82F6', // blue
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#EF4444', // red
    '#F59E0B', // amber
    '#10B981', // emerald
    '#06B6D4', // teal
    '#6366F1', // indigo
  ];

  const slices: SliceRegion[] = [];

  for (let i = 0; i < slicePoints.length; i++) {
    const start = slicePoints[i];
    const end = i < slicePoints.length - 1 ? slicePoints[i + 1] : totalDuration;
    
    if (end - start < 0.02) continue;

    slices.push({
      id: `slice-${i + 1}-${Date.now().toString(36)}`,
      index: i + 1,
      startSec: Math.round(start * 1000) / 1000,
      endSec: Math.round(end * 1000) / 1000,
      label: `Hit ${i + 1}`,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
    });
  }

  if (slices.length === 0) {
    slices.push({
      id: `slice-1-${Date.now().toString(36)}`,
      index: 1,
      startSec: 0,
      endSec: totalDuration,
      label: 'Full Hit',
      color: '#00F0FF',
    });
  }

  return slices;
}

/**
 * Extracts acoustic and timbral semantic tags from DSP audio features
 */
export function extractTimbralDescriptors(
  metrics: {
    peakDb: number;
    rmsDb: number;
    spectralCentroid: number;
    zeroCrossingRate: number;
    dynamicRangeDb: number;
    sustainFactor: number;
  },
  features: {
    lowEnergyRatio: number;
    midEnergyRatio: number;
    highEnergyRatio: number;
    attackTimeMs: number;
    decayTimeMs: number;
    subDominantFreq: number;
  }
): string[] {
  const tags: string[] = [];

  // Low-end / Sub profiling
  if (features.lowEnergyRatio > 0.45 || features.subDominantFreq < 75) {
    tags.push('sub-heavy');
  }
  if (metrics.spectralCentroid < 1200) {
    tags.push('warm');
  } else if (metrics.spectralCentroid > 3600) {
    tags.push('bright');
  }

  // Transient & Dynamics
  if (features.attackTimeMs <= 10 && metrics.dynamicRangeDb >= 7) {
    tags.push('punchy');
  }
  if (features.attackTimeMs <= 6) {
    tags.push('snappy');
  }

  // Timbre Texture
  if (metrics.zeroCrossingRate > 0.18 || features.highEnergyRatio > 0.4) {
    tags.push('crisp');
  }
  if (features.highEnergyRatio > 0.45 && metrics.zeroCrossingRate > 0.22) {
    tags.push('metallic');
  }

  // Compression & Distortion
  if (metrics.dynamicRangeDb < 6.5 && metrics.rmsDb > -13) {
    tags.push('saturated');
  }

  // Decay profile
  if (features.decayTimeMs < 180) {
    tags.push('tight');
  } else if (features.decayTimeMs > 550 || metrics.sustainFactor > 0.25) {
    tags.push('sustained');
  }

  return tags;
}

/**
 * Generates rich, deduplicated, standardized semantic tags for searchable sound database
 */
export function generateEnrichedTags(
  sample: Partial<SampleItem>,
  buffer?: AudioBuffer
): string[] {
  const tagSet = new Set<string>();

  // 1. Sound Type & Category
  if (sample.type) {
    tagSet.add(sample.type.toLowerCase());
  }
  if (sample.category) {
    tagSet.add(sample.category.toLowerCase());
  } else if (sample.isLoop) {
    tagSet.add('loop');
  } else {
    tagSet.add('one-shot');
  }

  // 2. Musical Key / Tonal Root
  if (sample.key) {
    const cleanKey = sample.key
      .replace(/\s+min(or)?/i, 'm')
      .replace(/\s+maj(or)?/i, 'maj')
      .replace(/\s+/g, '');
    tagSet.add(`key-${cleanKey.toLowerCase()}`);
    tagSet.add(cleanKey);
  }

  // 3. Tempo / BPM
  if (sample.bpm && sample.bpm > 0) {
    tagSet.add(`${sample.bpm}bpm`);
    if (sample.bpm >= 135) tagSet.add('fast-tempo');
    else if (sample.bpm >= 95) tagSet.add('mid-tempo');
    else tagSet.add('slow-tempo');
  }

  // 4. Bars (for loops)
  if (sample.loopBars && sample.loopBars > 0) {
    tagSet.add(`${sample.loopBars}-bars`);
  }

  // 5. Genre Style
  if (sample.genre) {
    const cleanGenre = sample.genre
      .split('/')[0]
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    if (cleanGenre && cleanGenre !== 'universal') {
      tagSet.add(cleanGenre);
    }
  }

  // 6. DSP Timbre Analysis (if buffer or metrics available)
  if (buffer) {
    try {
      const metrics = calculateAudioMetrics(buffer);
      const features = extractAcousticFeatures(buffer);
      const timbralTags = extractTimbralDescriptors(metrics, features);
      timbralTags.forEach((t) => tagSet.add(t));

      // Channels
      if (buffer.numberOfChannels === 1) tagSet.add('mono');
      else if (buffer.numberOfChannels >= 2) tagSet.add('stereo');

      // Loudness tag
      if (metrics.lufs > -70) {
        tagSet.add(`${Math.round(metrics.lufs)}lufs`);
      }
    } catch {
      // fallback
    }
  } else if (sample.spectralCentroid !== undefined) {
    if (sample.spectralCentroid < 1200) tagSet.add('warm');
    if (sample.spectralCentroid > 3600) tagSet.add('bright');
    if (sample.dynamicRangeDb && sample.dynamicRangeDb > 10) tagSet.add('punchy');
    if (sample.lufs) tagSet.add(`${Math.round(sample.lufs)}lufs`);
  }

  // 7. Format specs
  if (sample.bitDepth && sample.sampleRate) {
    const rateK = Math.round(sample.sampleRate / 1000);
    tagSet.add(`${sample.bitDepth}bit-${rateK}k`);
  }

  // 8. EP-133 Slot
  if (sample.ep133Slot) {
    tagSet.add(`slot-${String(sample.ep133Slot).padStart(3, '0')}`);
  }

  // 9. Existing user tags (preserve)
  if (sample.tags && Array.isArray(sample.tags)) {
    sample.tags.forEach((t) => {
      if (t && typeof t === 'string' && t.length > 1) {
        tagSet.add(t.toLowerCase().trim());
      }
    });
  }

  return Array.from(tagSet).filter((t) => t && t.length > 0);
}

