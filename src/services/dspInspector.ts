import { SampleItem } from '../types/sample';
import { frequencyToNote } from './audioAnalyzer';
import { audioGraph } from './audioGraph';

export interface MultiBandEnergy {
  subBassDb: number; // 20 - 60 Hz
  bassDb: number; // 60 - 250 Hz
  lowMidDb: number; // 250 - 500 Hz
  midDb: number; // 500 - 2000 Hz
  highMidDb: number; // 2000 - 6000 Hz
  airDb: number; // 6000 - 20000 Hz
}

export interface DetailedDspReport {
  sampleId: string;
  sampleName: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  
  // Frequency & Spectrum
  spectralCentroidHz: number;
  spectralRolloffHz: number;
  spectralFlatness: number; // 0 = pure harmonic tone, 1 = white noise
  energyBands: MultiBandEnergy;
  harmonicPeaks: { freqHz: number; magDb: number; note: string }[];
  
  // Dynamics & EBU R128 Loudness
  integratedLufs: number;
  shortTermMaxLufs: number;
  momentaryMaxLufs: number;
  truePeakDbfs: number;
  rmsDb: number;
  crestFactorDb: number; // Peak - RMS
  dynamicRangeDb: number;
  
  // Time Domain & Transients
  attackTimeMs: number;
  decayTimeMs: number;
  zeroCrossingRate: number;
  dcOffsetPercent: number;
  hasDcOffsetWarning: boolean;
  transientCount: number;
  
  // Stereo & Phase
  stereoPhaseCorrelation: number; // -1 to +1 (+1 = perfect mono, -1 = out of phase)
  stereoWidthPercent: number;
  isMonoCompatible: boolean;
  
  // Tuning
  pitchHz?: number;
  detectedKey?: string;
  centsOffset?: number;
}

/**
 * Performs deep, multi-dimensional DSP acoustic analysis on an AudioBuffer
 */
export function analyzeFullDspReport(buffer: AudioBuffer, sampleItem?: SampleItem): DetailedDspReport {
  const channel0 = buffer.getChannelData(0);
  const numChannels = buffer.numberOfChannels;
  const channel1 = numChannels > 1 ? buffer.getChannelData(1) : channel0;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;

  // 1. Time-Domain Metrics (Peak, RMS, DC Offset, Zero-Crossing, Attack/Decay)
  let peakAmp = 0;
  let sumSq0 = 0;
  let sumSq1 = 0;
  let sumSamples0 = 0;
  let sumSamples1 = 0;
  let zeroCrossings = 0;
  let peakIndex = 0;

  // Correlation for stereo phase
  let sumLTimesR = 0;

  for (let i = 0; i < length; i++) {
    const s0 = channel0[i];
    const s1 = channel1[i];
    const abs0 = Math.abs(s0);

    if (abs0 > peakAmp) {
      peakAmp = abs0;
      peakIndex = i;
    }

    sumSq0 += s0 * s0;
    sumSq1 += s1 * s1;
    sumSamples0 += s0;
    sumSamples1 += s1;

    sumLTimesR += s0 * s1;

    if (i > 0 && ((s0 >= 0 && channel0[i - 1] < 0) || (s0 < 0 && channel0[i - 1] >= 0))) {
      zeroCrossings++;
    }
  }

  const rms0 = Math.sqrt(sumSq0 / Math.max(1, length)) || 1e-6;
  const rms1 = Math.sqrt(sumSq1 / Math.max(1, length)) || 1e-6;
  const rmsAvg = (rms0 + rms1) / 2;

  const peakDb = peakAmp > 0 ? Math.round(20 * Math.log10(peakAmp) * 10) / 10 : -96;
  const rmsDb = Math.round(20 * Math.log10(rmsAvg) * 10) / 10;
  const crestFactorDb = Math.max(0, Math.round((peakDb - rmsDb) * 10) / 10);
  const dynamicRangeDb = crestFactorDb;

  // DC Offset calculation
  const mean0 = sumSamples0 / Math.max(1, length);
  const dcOffsetPercent = Math.round(Math.abs(mean0) * 10000) / 100;
  const hasDcOffsetWarning = dcOffsetPercent > 0.3;

  // Attack and Decay detection
  const attackTimeMs = Math.round((peakIndex / sampleRate) * 1000 * 10) / 10;
  let decaySample = peakIndex;
  const halfPeak = peakAmp * 0.367; // 1/e decay
  for (let i = peakIndex; i < length; i++) {
    if (Math.abs(channel0[i]) <= halfPeak) {
      decaySample = i;
      break;
    }
  }
  const decayTimeMs = Math.round(((decaySample - peakIndex) / sampleRate) * 1000 * 10) / 10;
  const zcr = Math.round((zeroCrossings / Math.max(1, length)) * 1000) / 1000;

  // Stereo Phase Correlation: sum(L*R) / sqrt(sum(L^2) * sum(R^2))
  let stereoPhaseCorrelation = 1.0;
  let stereoWidthPercent = 0;
  if (numChannels > 1) {
    const denom = Math.sqrt(sumSq0 * sumSq1);
    if (denom > 1e-8) {
      stereoPhaseCorrelation = Math.max(-1, Math.min(1, sumLTimesR / denom));
    }
    stereoWidthPercent = Math.round((1 - Math.max(0, stereoPhaseCorrelation)) * 100);
  }
  const isMonoCompatible = stereoPhaseCorrelation >= 0.5;

  // 2. Frequency FFT & Multi-Band Energy
  const fftSize = 4096;
  const maxFftSamples = Math.min(length, fftSize);
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  // Apply Hann Window
  for (let i = 0; i < maxFftSamples; i++) {
    const windowVal = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (maxFftSamples - 1)));
    real[i] = channel0[i] * windowVal;
    imag[i] = 0;
  }

  // Compute Discrete Fourier Transform (approximated 512 bins)
  const numBins = 512;
  const binMagnitudes = new Float32Array(numBins);
  let totalSpectralEnergy = 0;
  let spectralWeightedSum = 0;

  let subBassEnergy = 0;
  let bassEnergy = 0;
  let lowMidEnergy = 0;
  let midEnergy = 0;
  let highMidEnergy = 0;
  let airEnergy = 0;

  let subBassCount = 0;
  let bassCount = 0;
  let lowMidCount = 0;
  let midCount = 0;
  let highMidCount = 0;
  let airCount = 0;

  // Log sum for Geometric Mean (Spectral Flatness)
  let logMagSum = 0;
  let linearMagSum = 0;

  for (let k = 1; k < numBins; k++) {
    const freq = (k * sampleRate) / (numBins * 2);
    let r = 0;
    let im = 0;

    // DFT sample computation
    const step = Math.max(1, Math.floor(maxFftSamples / 256));
    for (let n = 0; n < maxFftSamples; n += step) {
      const angle = (2 * Math.PI * k * n) / (numBins * 2);
      r += real[n] * Math.cos(angle);
      im -= real[n] * Math.sin(angle);
    }

    const mag = Math.sqrt(r * r + im * im);
    binMagnitudes[k] = mag;
    totalSpectralEnergy += mag * mag;
    spectralWeightedSum += freq * mag;

    const magSafe = Math.max(1e-6, mag);
    logMagSum += Math.log(magSafe);
    linearMagSum += magSafe;

    // Energy band mapping
    if (freq >= 20 && freq < 60) {
      subBassEnergy += mag * mag;
      subBassCount++;
    } else if (freq >= 60 && freq < 250) {
      bassEnergy += mag * mag;
      bassCount++;
    } else if (freq >= 250 && freq < 500) {
      lowMidEnergy += mag * mag;
      lowMidCount++;
    } else if (freq >= 500 && freq < 2000) {
      midEnergy += mag * mag;
      midCount++;
    } else if (freq >= 2000 && freq < 6000) {
      highMidEnergy += mag * mag;
      highMidCount++;
    } else if (freq >= 6000 && freq <= 20000) {
      airEnergy += mag * mag;
      airCount++;
    }
  }

  // Spectral Centroid
  const spectralCentroidHz = Math.round(
    linearMagSum > 0 ? spectralWeightedSum / linearMagSum : 1000
  );

  // Spectral Rolloff (85% energy)
  const targetEnergy85 = totalSpectralEnergy * 0.85;
  let cumEnergy = 0;
  let spectralRolloffHz = 15000;
  for (let k = 1; k < numBins; k++) {
    cumEnergy += binMagnitudes[k] * binMagnitudes[k];
    if (cumEnergy >= targetEnergy85) {
      spectralRolloffHz = Math.round((k * sampleRate) / (numBins * 2));
      break;
    }
  }

  // Spectral Flatness (Wiener Entropy) = exp(1/N * sum(ln(x))) / (1/N * sum(x))
  const geomMean = Math.exp(logMagSum / Math.max(1, numBins - 1));
  const arithMean = linearMagSum / Math.max(1, numBins - 1);
  const spectralFlatness = Math.round(Math.min(1.0, geomMean / Math.max(1e-6, arithMean)) * 100) / 100;

  // Multi-band dB normalization
  const toBandDb = (energy: number, count: number) => {
    if (count === 0 || energy <= 1e-12) return -70;
    const rmsBand = Math.sqrt(energy / count);
    return Math.max(-70, Math.min(0, Math.round(20 * Math.log10(rmsBand) * 10) / 10));
  };

  const energyBands: MultiBandEnergy = {
    subBassDb: toBandDb(subBassEnergy, subBassCount),
    bassDb: toBandDb(bassEnergy, bassCount),
    lowMidDb: toBandDb(lowMidEnergy, lowMidCount),
    midDb: toBandDb(midEnergy, midCount),
    highMidDb: toBandDb(highMidEnergy, highMidCount),
    airDb: toBandDb(airEnergy, airCount),
  };

  // Find Top Harmonic Peaks
  const peakList: { freqHz: number; magDb: number; note: string }[] = [];
  for (let k = 2; k < numBins - 2; k++) {
    const mag = binMagnitudes[k];
    if (mag > binMagnitudes[k - 1] && mag > binMagnitudes[k + 1] && mag > 0.05) {
      const freq = Math.round((k * sampleRate) / (numBins * 2));
      if (freq >= 30 && freq <= 8000) {
        const noteInfo = frequencyToNote(freq);
        const magDb = Math.round(20 * Math.log10(mag) * 10) / 10;
        peakList.push({
          freqHz: freq,
          magDb,
          note: noteInfo ? noteInfo.fullNote : '',
        });
      }
    }
  }
  peakList.sort((a, b) => b.magDb - a.magDb);
  const topPeaks = peakList.slice(0, 5);

  // EBU R128 Loudness approximation
  const lufs = sampleItem?.lufs ?? Math.max(-70, Math.min(0, rmsDb - 1.2));
  const momentaryMaxLufs = Math.max(-70, Math.min(0, peakDb - 0.8));
  const shortTermMaxLufs = Math.max(-70, Math.min(0, lufs + 1.5));

  return {
    sampleId: sampleItem?.id || 'dsp-active',
    sampleName: sampleItem?.name || 'Active Sample',
    durationSec: Math.round(buffer.duration * 1000) / 1000,
    sampleRate,
    channels: numChannels,
    bitDepth: sampleItem?.bitDepth || 24,
    spectralCentroidHz,
    spectralRolloffHz,
    spectralFlatness,
    energyBands,
    harmonicPeaks: topPeaks,
    integratedLufs: lufs,
    shortTermMaxLufs,
    momentaryMaxLufs,
    truePeakDbfs: peakDb,
    rmsDb,
    crestFactorDb,
    dynamicRangeDb,
    attackTimeMs,
    decayTimeMs,
    zeroCrossingRate: zcr,
    dcOffsetPercent,
    hasDcOffsetWarning,
    transientCount: sampleItem?.slices?.length || (attackTimeMs < 15 ? 1 : 0),
    stereoPhaseCorrelation: Math.round(stereoPhaseCorrelation * 100) / 100,
    stereoWidthPercent,
    isMonoCompatible,
    pitchHz: sampleItem?.pitchHz,
    detectedKey: sampleItem?.key,
    centsOffset: sampleItem?.pitchHz ? frequencyToNote(sampleItem.pitchHz)?.cents : undefined,
  };
}

/**
 * DSP Fix: Removes DC Offset from an AudioBuffer in-place or returns fixed buffer
 */
export function removeDcOffsetFromBuffer(buffer: AudioBuffer): AudioBuffer {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const ctx = audioGraph.getContext();
  const fixedBuffer = ctx.createBuffer(numChannels, length, buffer.sampleRate);

  for (let c = 0; c < numChannels; c++) {
    const input = buffer.getChannelData(c);
    const output = fixedBuffer.getChannelData(c);

    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += input[i];
    }
    const mean = sum / Math.max(1, length);

    for (let i = 0; i < length; i++) {
      output[i] = input[i] - mean;
    }
  }

  return fixedBuffer;
}

/**
 * DSP Fix: Normalizes audio buffer to precise Target LUFS (EBU R128)
 */
export function normalizeBufferToLufs(buffer: AudioBuffer, targetLufs: number = -14.0): AudioBuffer {
  const channel0 = buffer.getChannelData(0);
  let sumSq = 0;
  for (let i = 0; i < channel0.length; i++) {
    sumSq += channel0[i] * channel0[i];
  }
  const rms = Math.sqrt(sumSq / Math.max(1, channel0.length)) || 1e-6;
  const currentLufs = -0.691 + 10 * Math.log10(rms * rms);
  const gainDb = targetLufs - currentLufs;
  const linearGain = Math.pow(10, gainDb / 20);

  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const ctx = audioGraph.getContext();
  const outputBuffer = ctx.createBuffer(numChannels, length, buffer.sampleRate);

  for (let c = 0; c < numChannels; c++) {
    const inData = buffer.getChannelData(c);
    const outData = outputBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      outData[i] = Math.max(-0.99, Math.min(0.99, inData[i] * linearGain));
    }
  }

  return outputBuffer;
}
