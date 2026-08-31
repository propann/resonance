import { MusicGenre, SampleCategory, SampleType, SliceRegion } from '../types/sample';

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
 * Backward compatibility alias for detectPitch
 */
export function detectPitch(buffer: AudioBuffer) {
  return detectPitchAndKey(buffer);
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
 * Comprehensive Sample Classification (Acoustic + Harmonic + Temporal + Genre)
 */
export function classifySample(
  buffer: AudioBuffer,
  fileName: string,
  metrics: { peakDb: number; rmsDb: number; spectralCentroid: number; zeroCrossingRate: number; dynamicRangeDb: number; sustainFactor: number },
  slicesCount: number
): { type: SampleType; tags: string[]; isMultiSound: boolean } {
  const lowerName = fileName.toLowerCase();
  const duration = buffer.duration;
  const centroid = metrics.spectralCentroid;
  const zcr = metrics.zeroCrossingRate;

  // Name keyword heuristics
  if (lowerName.includes('kick') || lowerName.includes('bd') || lowerName.includes('bassdrum')) {
    return { type: 'kick', tags: ['punch', 'low-end', 'drum', 'one-shot'], isMultiSound: false };
  }
  if (lowerName.includes('808')) {
    return { type: '808', tags: ['sub', 'trap', 'bass', 'saturated'], isMultiSound: false };
  }
  if (lowerName.includes('snare') || lowerName.includes('sd')) {
    return { type: 'snare', tags: ['drum', 'crack', 'one-shot'], isMultiSound: false };
  }
  if (lowerName.includes('hihat') || lowerName.includes('hh') || lowerName.includes('hat') || lowerName.includes('shaker')) {
    return { type: 'hihat', tags: ['high', 'top', 'metallic', 'crisp'], isMultiSound: false };
  }
  if (lowerName.includes('clap')) {
    return { type: 'clap', tags: ['layered', 'percussion', 'stereo'], isMultiSound: false };
  }
  if (lowerName.includes('cymbal') || lowerName.includes('crash') || lowerName.includes('ride')) {
    return { type: 'cymbal', tags: ['bright', 'splash', 'acoustic'], isMultiSound: false };
  }
  if (lowerName.includes('vocal') || lowerName.includes('vox') || lowerName.includes('acapella') || lowerName.includes('chant')) {
    return { type: 'vocal', tags: ['voice', 'melodic', 'fx'], isMultiSound: false };
  }
  if (lowerName.includes('loop') || lowerName.includes('break') || lowerName.includes('bpm')) {
    return { type: 'loop', tags: ['groove', 'rhythm', 'tempo-synced'], isMultiSound: false };
  }
  if (lowerName.includes('lead') || lowerName.includes('synth') || lowerName.includes('pluck')) {
    return { type: 'lead', tags: ['melodic', 'tonal', 'synth'], isMultiSound: false };
  }
  if (lowerName.includes('pad') || lowerName.includes('drone') || lowerName.includes('ambient')) {
    return { type: 'pad', tags: ['atmospheric', 'sustained', 'lush'], isMultiSound: false };
  }
  if (lowerName.includes('fx') || lowerName.includes('riser') || lowerName.includes('sweep') || lowerName.includes('impact')) {
    return { type: 'fx', tags: ['transition', 'texture', 'cinema'], isMultiSound: false };
  }

  // Multi-sound detection check
  if (slicesCount >= 3 && duration > 1.5) {
    return { type: 'multi-sound', tags: ['multi-hit', 'stem', 'pack', 'sliceable'], isMultiSound: true };
  }

  // Acoustic Duration & DSP Classification
  if (duration > 3.0) {
    if (metrics.dynamicRangeDb < 10 && metrics.sustainFactor > 0.3) {
      return { type: 'pad', tags: ['sustained', 'ambient'], isMultiSound: false };
    }
    return { type: 'loop', tags: ['loop', 'extended', 'groove'], isMultiSound: false };
  }

  // Short one shots (< 0.6s)
  if (duration < 0.6) {
    if (centroid < 450) {
      return { type: 'kick', tags: ['sub', 'drum', 'one-shot'], isMultiSound: false };
    }
    if (centroid > 5000 || zcr > 0.25) {
      return { type: 'hihat', tags: ['bright', 'high-frequency', 'crisp'], isMultiSound: false };
    }
    if (centroid > 1800 && metrics.dynamicRangeDb > 12) {
      return { type: 'snare', tags: ['percussive', 'punchy', 'crack'], isMultiSound: false };
    }
    return { type: 'percussion', tags: ['perc', 'acoustic'], isMultiSound: false };
  }

  // Mid duration (0.6 - 3.0s)
  if (centroid < 500) {
    return { type: '808', tags: ['bass', 'sub', 'low-end'], isMultiSound: false };
  }
  if (centroid > 3500) {
    return { type: 'fx', tags: ['texture', 'bright'], isMultiSound: false };
  }

  return { type: 'other', tags: ['sample', 'audio'], isMultiSound: false };
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

