/**
 * High-Performance Audio Spectrogram & Multi-Band Frequency Generator
 * Computes Short-Time Fourier Transform (STFT) matrices, 3-band spectral waveforms,
 * pitch trajectory (F0 autocorrelation), and RMS envelopes.
 */

export interface SpectrogramData {
  timeSlices: number; // Number of columns
  freqBins: number; // Number of frequency rows (e.g. 64 or 128)
  magnitudes: Float32Array; // Flattened 2D array [timeIndex * freqBins + binIndex]
  maxMagnitude: number;
  sampleRate: number;
  duration: number;
}

export interface MultiBandSampleData {
  lowBand: Float32Array; // < 250 Hz (Red / Magenta)
  midBand: Float32Array; // 250 Hz - 4000 Hz (Cyan / Green)
  highBand: Float32Array; // > 4000 Hz (Yellow / White)
  peakEnvelope: Float32Array; // Overall smooth peak
  rmsEnvelope: Float32Array; // Overall smooth RMS
  pitchContour: Float32Array; // Detected F0 pitch in Hz (0 if unvoiced)
  pointsCount: number;
}

// In-memory cache to avoid recomputing heavy STFT / multi-band filters
const spectrogramCache = new WeakMap<AudioBuffer, SpectrogramData>();
const multiBandCache = new WeakMap<AudioBuffer, MultiBandSampleData>();

/**
 * Generates or retrieves cached Spectrogram data using Fast STFT
 */
export function generateSpectrogram(buffer: AudioBuffer, targetColumns = 400, freqBins = 80): SpectrogramData {
  const cached = spectrogramCache.get(buffer);
  if (cached) return cached;

  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const duration = buffer.duration;
  const length = channelData.length;

  const fftSize = 512;
  const halfFft = fftSize / 2;
  const magnitudes = new Float32Array(targetColumns * freqBins);
  let globalMax = 1e-6;

  // Windowing function: Hann window
  const hannWindow = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  const stepSamples = Math.max(1, Math.floor(length / targetColumns));

  for (let col = 0; col < targetColumns; col++) {
    const centerSample = col * stepSamples;
    const startSample = Math.max(0, centerSample - halfFft);

    // Apply Hann window and copy samples
    const windowed = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      const idx = startSample + i;
      if (idx < length) {
        windowed[i] = channelData[idx] * hannWindow[i];
      }
    }

    // Simplified DFT on logarithmically spaced frequency bins (20 Hz to 20 kHz)
    for (let b = 0; b < freqBins; b++) {
      // Logarithmic frequency mapping
      const minFreq = 25;
      const maxFreq = Math.min(20000, sampleRate / 2);
      const freq = minFreq * Math.pow(maxFreq / minFreq, b / (freqBins - 1));
      
      const k = (freq / sampleRate) * fftSize;
      
      // Goertzel-like or direct discrete Fourier correlation at target freq
      let real = 0;
      let imag = 0;
      const angleStep = (2 * Math.PI * k) / fftSize;

      // Sample a subset of points for fast computation
      const stride = 2;
      for (let n = 0; n < fftSize; n += stride) {
        const val = windowed[n];
        const angle = n * angleStep;
        real += val * Math.cos(angle);
        imag -= val * Math.sin(angle);
      }

      const mag = Math.sqrt(real * real + imag * imag);
      magnitudes[col * freqBins + b] = mag;
      if (mag > globalMax) globalMax = mag;
    }
  }

  const result: SpectrogramData = {
    timeSlices: targetColumns,
    freqBins,
    magnitudes,
    maxMagnitude: globalMax,
    sampleRate,
    duration,
  };

  spectrogramCache.set(buffer, result);
  return result;
}

/**
 * Generates 3-band frequency decomposition (Bass / Mid / High) and pitch trajectory
 */
export function generateMultiBandData(buffer: AudioBuffer, targetPoints = 800): MultiBandSampleData {
  const cached = multiBandCache.get(buffer);
  if (cached) return cached;

  const data0 = buffer.getChannelData(0);
  const length = data0.length;
  const sampleRate = buffer.sampleRate;

  const lowBand = new Float32Array(targetPoints);
  const midBand = new Float32Array(targetPoints);
  const highBand = new Float32Array(targetPoints);
  const peakEnvelope = new Float32Array(targetPoints);
  const rmsEnvelope = new Float32Array(targetPoints);
  const pitchContour = new Float32Array(targetPoints);

  const samplesPerPoint = Math.max(1, Math.floor(length / targetPoints));

  // Quick 3-Band FIR/IIR approximations
  // Filter 1: Low-pass ~250 Hz (RC filter approximation)
  // Filter 2: High-pass ~4000 Hz
  const dt = 1 / sampleRate;
  const rcLow = 1 / (2 * Math.PI * 250);
  const alphaLow = dt / (rcLow + dt);

  const rcHigh = 1 / (2 * Math.PI * 4000);
  const alphaHigh = rcHigh / (rcHigh + dt);

  for (let p = 0; p < targetPoints; p++) {
    const startIdx = p * samplesPerPoint;
    const endIdx = Math.min(length, startIdx + samplesPerPoint);

    let maxPeak = 0;
    let sumSquares = 0;
    let lowEnergy = 0;
    const midEnergy = 0;
    let highEnergy = 0;

    let lpPrev = 0;
    let hpPrev = 0;
    let hpInputPrev = 0;

    for (let i = startIdx; i < endIdx; i++) {
      const s = data0[i];
      const absS = Math.abs(s);
      if (absS > maxPeak) maxPeak = absS;
      sumSquares += s * s;

      // Low pass
      const lp = lpPrev + alphaLow * (s - lpPrev);
      lpPrev = lp;
      lowEnergy += lp * lp;

      // High pass
      const hp = alphaHigh * (hpPrev + s - hpInputPrev);
      hpInputPrev = s;
      hpPrev = hp;
      highEnergy += hp * hp;
    }

    const count = Math.max(1, endIdx - startIdx);
    const rms = Math.sqrt(sumSquares / count);
    const lowRms = Math.sqrt(lowEnergy / count);
    const highRms = Math.sqrt(highEnergy / count);
    // Mid energy is residual
    const midRms = Math.max(0, Math.sqrt(Math.max(0, sumSquares - lowEnergy - highEnergy) / count));

    peakEnvelope[p] = maxPeak;
    rmsEnvelope[p] = rms;
    lowBand[p] = lowRms;
    midBand[p] = midRms;
    highBand[p] = highRms;

    // Pitch F0 estimation via Autocorrelation for this slice
    if (rms > 0.02 && endIdx - startIdx >= 256) {
      pitchContour[p] = estimateLocalPitch(data0, startIdx, Math.min(length - startIdx, 512), sampleRate);
    } else {
      pitchContour[p] = 0;
    }
  }

  const result: MultiBandSampleData = {
    lowBand,
    midBand,
    highBand,
    peakEnvelope,
    rmsEnvelope,
    pitchContour,
    pointsCount: targetPoints,
  };

  multiBandCache.set(buffer, result);
  return result;
}

/**
 * Fast Autocorrelation Pitch Detector (50 Hz to 1200 Hz)
 */
function estimateLocalPitch(data: Float32Array, offset: number, windowLen: number, sampleRate: number): number {
  const minLag = Math.floor(sampleRate / 1200); // ~1200Hz
  const maxLag = Math.floor(sampleRate / 50);   // ~50Hz

  if (windowLen <= maxLag) return 0;

  let bestLag = -1;
  let maxCorr = 0;

  for (let lag = minLag; lag < Math.min(maxLag, windowLen / 2); lag++) {
    let corr = 0;
    for (let i = 0; i < windowLen - lag; i += 2) {
      corr += data[offset + i] * data[offset + i + lag];
    }
    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag > 0 && maxCorr > 0.005) {
    return sampleRate / bestLag;
  }
  return 0;
}
