/**
 * RESONANCE PRO - ADVANCED DSP AUDIO EFFECTS RACK & SOUND TRANSFORMER ENGINE
 * Provides high-precision real-time audio graph routing and offline AudioBuffer processing:
 * - Sub & Deep Bass Enhancer (Sub-harmonic generator, psychoacoustic 808 drive, mono bass filter)
 * - Rhythmic Stutter & Glitch Chopper / Trance Gate
 * - Stereo Ping-Pong & Tape Delay with Wow & Flutter
 * - Algorithmic Reverb with Shimmer Octave Generator
 * - Analog Tube Saturation, Wavefolder, Overdrive & Bitcrusher / Downsampler
 * - Stereo Chorus, Flanger, Phaser & Haas 3D Spatial Widener
 * - Multi-Mode Resonant Dynamic Filter with LFO Sweeps
 * - Transient Shaper (Punch Attack & Sustain Sculpting)
 * - Pitch Transposition, Ring Modulator & Frequency Shifter
 * - Tape Stop Vinyl Brake, Reverse & Surgical Audio Enveloping
 */

export interface SubBassConfig {
  enabled: boolean;
  boostDb: number; // 0 to +24 dB
  frequency: number; // 30 Hz to 140 Hz
  subHarmonics: number; // 0 to 100% (synthesizes sub-octave sine tracking)
  subDrive: number; // 0 to 100% (warm 808 saturation)
  monoSubCutoff: number; // 20 Hz to 250 Hz (monofies stereo bass below threshold)
}

export interface StutterGateConfig {
  enabled: boolean;
  division: '1/4' | '1/8' | '1/16' | '1/32' | '1/64' | '1/8T' | '1/16T';
  dutyCycle: number; // 10% to 90%
  shape: 'hard-gate' | 'smooth-tremolo' | 'random-glitch';
  mix: number; // 0 to 100%
  bpm: number; // 40 to 240 BPM
}

export interface DelayConfig {
  enabled: boolean;
  timeSec: number; // 0.01s to 1.5s
  syncDivision: 'free' | '1/16' | '1/8' | '1/8D' | '1/4' | '1/2';
  feedback: number; // 0 to 95%
  pingPong: boolean;
  dampingHz: number; // High-cut filter 1000Hz - 18000Hz
  wowFlutter: number; // 0 to 100% (tape motor drift)
  mix: number; // 0 to 100%
}

export interface ReverbConfig {
  enabled: boolean;
  decaySec: number; // 0.2s to 15s
  preDelayMs: number; // 0ms to 200ms
  roomSize: 'small-room' | 'studio-plate' | 'concert-hall' | 'cathedral' | 'cosmic-void';
  dampingHz: number; // 1000Hz to 16000Hz
  shimmer: number; // 0 to 100% (octave-up pitch shimmer)
  freeze: boolean;
  mix: number; // 0 to 100%
}

export interface DistortionConfig {
  enabled: boolean;
  driveType: 'tube-warmth' | 'tape-sat' | 'hard-clip' | 'wavefolder' | 'germanium-fuzz';
  gainDb: number; // 0 to +36 dB
  wavefoldStages: number; // 1 to 8
  bitDepth: number; // 2 to 16 bits (16 = clean)
  downsample: number; // 1x to 32x (1 = 44.1k/48k, 32 = 1.4kHz retro)
  noiseHiss: number; // 0 to 100% (tape hiss / vinyl floor)
  mix: number; // 0 to 100%
}

export interface ModulationConfig {
  enabled: boolean;
  type: 'chorus' | 'flanger' | 'phaser' | 'haas-widener' | 'dimension-d';
  rateHz: number; // 0.1 Hz to 12 Hz
  depth: number; // 0 to 100%
  feedback: number; // 0 to 90%
  haasDelayMs: number; // 0 to 35 ms
  mix: number; // 0 to 100%
}

export interface FilterConfig {
  enabled: boolean;
  type: 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'peak' | 'acid-303';
  cutoffHz: number; // 20 Hz to 20000 Hz
  resonance: number; // 0.5 to 24 Q
  lfoRateHz: number; // 0.1 Hz to 20 Hz
  lfoDepth: number; // 0 to 100%
  lfoShape: 'sine' | 'triangle' | 'saw' | 'square' | 'sample-hold';
}

export interface TransientConfig {
  enabled: boolean;
  attackDb: number; // -12 dB to +12 dB
  sustainDb: number; // -18 dB to +12 dB
  punchSpeedMs: number; // 5ms to 60ms
}

export interface PitchRingConfig {
  enabled: boolean;
  pitchSemitones: number; // -24 to +24
  pitchCents: number; // -100 to +100
  ringModFreqHz: number; // 0 to 2000 Hz (0 = disabled)
  ringModMix: number; // 0 to 100%
}

export interface CompressorConfig {
  enabled: boolean;
  thresholdDb: number; // -60 dB to 0 dB
  ratio: number; // 1 to 20
  attackMs: number; // 0.1 ms to 100 ms
  releaseMs: number; // 10 ms to 1000 ms
  makeupGainDb: number; // 0 to +24 dB
  kneeDb: number; // 0 to 12 dB
}

export interface StereoImagerConfig {
  enabled: boolean;
  widthPercent: number; // 0% (mono) to 200% (super-wide)
  autopanRateHz: number; // 0 to 12 Hz
  autopanDepth: number; // 0 to 100%
  tremoloRateHz: number; // 0 to 20 Hz
  tremoloDepth: number; // 0 to 100%
}

export interface FormantConfig {
  enabled: boolean;
  vowel: 'a' | 'e' | 'i' | 'o' | 'u' | 'auto-morph';
  morphSpeedHz: number; // 0.1 to 10 Hz
  formantShift: number; // -12 to +12 semitones
  resonance: number; // 1 to 15 Q
  mix: number; // 0 to 100%
}

export interface VinylTapeConfig {
  enabled: boolean;
  crackleAmount: number; // 0 to 100%
  vinylDustPops: number; // 0 to 100%
  tapeWarbleHz: number; // 0 to 8 Hz
  tapeFlutterDepth: number; // 0 to 100%
  vintageCurve: 'flat' | '1920-gramophone' | '1950-radio' | '1970-cassette' | '1980-walkman';
  mix: number; // 0 to 100%
}

export interface FrequencyShifterConfig {
  enabled: boolean;
  shiftHz: number; // -1000 Hz to +1000 Hz
  feedback: number; // 0 to 90%
  quadraturePhase: number; // 0 to 360 deg
  mix: number; // 0 to 100%
}

export interface ExciterConfig {
  enabled: boolean;
  frequencyHz: number; // 3000 Hz to 16000 Hz
  harmonicsDrive: number; // 0 to 100%
  airBoostDb: number; // 0 to +18 dB
  curve: 'tube-even' | 'tape-odd' | 'silicon-sparkle';
  mix: number; // 0 to 100%
}

export interface AutoWahConfig {
  enabled: boolean;
  sensitivity: number; // 0 to 100%
  baseCutoffHz: number; // 100 Hz to 5000 Hz
  sweepRangeHz: number; // 200 Hz to 8000 Hz
  resonance: number; // 1 to 18 Q
  attackMs: number; // 1 to 100 ms
  releaseMs: number; // 10 to 500 ms
  direction: 'up' | 'down';
  mix: number; // 0 to 100%
}

export interface CombResonatorConfig {
  enabled: boolean;
  tuneFreqHz: number; // 40 Hz to 2500 Hz
  feedbackDecay: number; // 0 to 98%
  dampingHz: number; // 1000 Hz to 18000 Hz
  stereoSpread: number; // 0 to 100%
  mix: number; // 0 to 100%
}

export interface SurgicalConfig {
  reverse: boolean;
  tapeStopBrakeSec: number; // 0 = off, 0.1s to 2.5s
  fadeInSec: number; // 0 to 2s
  fadeOutSec: number; // 0 to 2s
  trimSilenceDb: number | null; // e.g. -48dB or null
  normalizePeak: boolean;
  normalizeTargetDb: number; // -0.3 dBFS
  removeDc: boolean;
  invertPhaseL: boolean;
  invertPhaseR: boolean;
}

export interface DspRackConfig {
  id: string;
  name: string;
  category?: string;
  masterGainDb: number; // -24 dB to +12 dB
  dryWetBalance: number; // 0 (100% Dry) to 100 (100% Wet)
  subBass: SubBassConfig;
  stutter: StutterGateConfig;
  delay: DelayConfig;
  reverb: ReverbConfig;
  distortion: DistortionConfig;
  compressor: CompressorConfig;
  modulation: ModulationConfig;
  filter: FilterConfig;
  transient: TransientConfig;
  pitchRing: PitchRingConfig;
  imager: StereoImagerConfig;
  formant: FormantConfig;
  vinylTape: VinylTapeConfig;
  freqShifter: FrequencyShifterConfig;
  exciter: ExciterConfig;
  autoWah: AutoWahConfig;
  combResonator: CombResonatorConfig;
  surgical: SurgicalConfig;
}

export const DEFAULT_DSP_RACK_CONFIG: DspRackConfig = {
  id: 'default-rack',
  name: 'Clean Neutral State',
  category: 'Studio Utilities',
  masterGainDb: 0,
  dryWetBalance: 100,
  subBass: {
    enabled: false,
    boostDb: 8,
    frequency: 55,
    subHarmonics: 35,
    subDrive: 20,
    monoSubCutoff: 120,
  },
  stutter: {
    enabled: false,
    division: '1/16',
    dutyCycle: 50,
    shape: 'hard-gate',
    mix: 100,
    bpm: 120,
  },
  delay: {
    enabled: false,
    timeSec: 0.35,
    syncDivision: '1/8D',
    feedback: 45,
    pingPong: true,
    dampingHz: 6500,
    wowFlutter: 15,
    mix: 35,
  },
  reverb: {
    enabled: false,
    decaySec: 2.8,
    preDelayMs: 25,
    roomSize: 'studio-plate',
    dampingHz: 7500,
    shimmer: 0,
    freeze: false,
    mix: 30,
  },
  distortion: {
    enabled: false,
    driveType: 'tube-warmth',
    gainDb: 12,
    wavefoldStages: 2,
    bitDepth: 16,
    downsample: 1,
    noiseHiss: 0,
    mix: 75,
  },
  compressor: {
    enabled: false,
    thresholdDb: -18,
    ratio: 4,
    attackMs: 15,
    releaseMs: 120,
    makeupGainDb: 3,
    kneeDb: 4,
  },
  modulation: {
    enabled: false,
    type: 'chorus',
    rateHz: 1.2,
    depth: 60,
    feedback: 25,
    haasDelayMs: 14,
    mix: 40,
  },
  filter: {
    enabled: false,
    type: 'lowpass',
    cutoffHz: 14000,
    resonance: 1.5,
    lfoRateHz: 2.0,
    lfoDepth: 0,
    lfoShape: 'sine',
  },
  transient: {
    enabled: false,
    attackDb: 0,
    sustainDb: 0,
    punchSpeedMs: 20,
  },
  pitchRing: {
    enabled: false,
    pitchSemitones: 0,
    pitchCents: 0,
    ringModFreqHz: 0,
    ringModMix: 0,
  },
  imager: {
    enabled: false,
    widthPercent: 100,
    autopanRateHz: 0,
    autopanDepth: 0,
    tremoloRateHz: 0,
    tremoloDepth: 0,
  },
  formant: {
    enabled: false,
    vowel: 'a',
    morphSpeedHz: 1.5,
    formantShift: 0,
    resonance: 5.0,
    mix: 0,
  },
  vinylTape: {
    enabled: false,
    crackleAmount: 35,
    vinylDustPops: 25,
    tapeWarbleHz: 0.8,
    tapeFlutterDepth: 30,
    vintageCurve: '1970-cassette',
    mix: 80,
  },
  freqShifter: {
    enabled: false,
    shiftHz: 65,
    feedback: 20,
    quadraturePhase: 90,
    mix: 50,
  },
  exciter: {
    enabled: false,
    frequencyHz: 8000,
    harmonicsDrive: 40,
    airBoostDb: 6,
    curve: 'tube-even',
    mix: 50,
  },
  autoWah: {
    enabled: false,
    sensitivity: 65,
    baseCutoffHz: 400,
    sweepRangeHz: 2800,
    resonance: 6.0,
    attackMs: 8,
    releaseMs: 80,
    direction: 'up',
    mix: 85,
  },
  combResonator: {
    enabled: false,
    tuneFreqHz: 220, // A3 note
    feedbackDecay: 75,
    dampingHz: 6000,
    stereoSpread: 50,
    mix: 45,
  },
  surgical: {
    reverse: false,
    tapeStopBrakeSec: 0,
    fadeInSec: 0,
    fadeOutSec: 0,
    trimSilenceDb: null,
    normalizePeak: false,
    normalizeTargetDb: -0.3,
    removeDc: true,
    invertPhaseL: false,
    invertPhaseR: false,
  },
};

/**
 * Curated High-Impact Sound Design Presets
 */
export const DSP_RACK_PRESETS: DspRackConfig[] = [
  {
    ...DEFAULT_DSP_RACK_CONFIG,
    id: 'preset-sub-808-boom',
    name: '⚡ Sub-808 Mega Deep Thump',
    category: 'Bass & Sub',
    subBass: {
      enabled: true,
      boostDb: 14,
      frequency: 50,
      subHarmonics: 60,
      subDrive: 45,
      monoSubCutoff: 130,
    },
    distortion: {
      enabled: true,
      driveType: 'tube-warmth',
      gainDb: 9,
      wavefoldStages: 1,
      bitDepth: 16,
      downsample: 1,
      noiseHiss: 0,
      mix: 50,
    },
    transient: {
      enabled: true,
      attackDb: 4,
      sustainDb: 5,
      punchSpeedMs: 18,
    },
  },
  {
    ...DEFAULT_DSP_RACK_CONFIG,
    id: 'preset-glitch-chopper',
    name: '🔪 Cyber Glitch Chopper 1/16',
    category: 'Rhythm & Glitch',
    stutter: {
      enabled: true,
      division: '1/16',
      dutyCycle: 40,
      shape: 'hard-gate',
      mix: 100,
      bpm: 128,
    },
    delay: {
      enabled: true,
      timeSec: 0.234,
      syncDivision: '1/8',
      feedback: 55,
      pingPong: true,
      dampingHz: 8000,
      wowFlutter: 20,
      mix: 40,
    },
    filter: {
      enabled: true,
      type: 'lowpass',
      cutoffHz: 8500,
      resonance: 4.0,
      lfoRateHz: 4.0,
      lfoDepth: 45,
      lfoShape: 'saw',
    },
  },
  {
    ...DEFAULT_DSP_RACK_CONFIG,
    id: 'preset-space-shimmer',
    name: '🌌 Celestial Shimmer Reverb',
    category: 'Space & Ambient',
    reverb: {
      enabled: true,
      decaySec: 6.5,
      preDelayMs: 40,
      roomSize: 'cosmic-void',
      dampingHz: 9000,
      shimmer: 75,
      freeze: false,
      mix: 55,
    },
    delay: {
      enabled: true,
      timeSec: 0.45,
      syncDivision: '1/4',
      feedback: 60,
      pingPong: true,
      dampingHz: 6000,
      wowFlutter: 35,
      mix: 30,
    },
    modulation: {
      enabled: true,
      type: 'dimension-d',
      rateHz: 0.8,
      depth: 70,
      feedback: 15,
      haasDelayMs: 20,
      mix: 45,
    },
  },
  {
    ...DEFAULT_DSP_RACK_CONFIG,
    id: 'preset-sp1200-vintage',
    name: '📻 SP-1200 12-Bit Vintage Grit',
    category: 'Lo-Fi & Vintage',
    distortion: {
      enabled: true,
      driveType: 'tape-sat',
      gainDb: 10,
      wavefoldStages: 1,
      bitDepth: 12,
      downsample: 2, // Down to ~22-26kHz
      noiseHiss: 30,
      mix: 90,
    },
    filter: {
      enabled: true,
      type: 'lowpass',
      cutoffHz: 9200,
      resonance: 1.2,
      lfoRateHz: 0.5,
      lfoDepth: 0,
      lfoShape: 'sine',
    },
    transient: {
      enabled: true,
      attackDb: 3.5,
      sustainDb: -2,
      punchSpeedMs: 15,
    },
  },
  {
    ...DEFAULT_DSP_RACK_CONFIG,
    id: 'preset-wavefolder-fuzz',
    name: '🔥 West-Coast Wavefolder Overdrive',
    category: 'Distortion & Harmonics',
    distortion: {
      enabled: true,
      driveType: 'wavefolder',
      gainDb: 18,
      wavefoldStages: 4,
      bitDepth: 16,
      downsample: 1,
      noiseHiss: 0,
      mix: 80,
    },
    filter: {
      enabled: true,
      type: 'bandpass',
      cutoffHz: 2800,
      resonance: 5.5,
      lfoRateHz: 1.5,
      lfoDepth: 35,
      lfoShape: 'triangle',
    },
  },
  {
    ...DEFAULT_DSP_RACK_CONFIG,
    id: 'preset-haas-3d-widen',
    name: '🔊 Haas 3D Ultra Stereo Imager',
    category: 'Stereo & Modulation',
    modulation: {
      enabled: true,
      type: 'haas-widener',
      rateHz: 0.5,
      depth: 85,
      feedback: 0,
      haasDelayMs: 18,
      mix: 85,
    },
    reverb: {
      enabled: true,
      decaySec: 1.4,
      preDelayMs: 10,
      roomSize: 'studio-plate',
      dampingHz: 12000,
      shimmer: 0,
      freeze: false,
      mix: 20,
    },
  },
  {
    ...DEFAULT_DSP_RACK_CONFIG,
    id: 'preset-acid-303',
    name: '🧪 Acid 303 Resonant Sweep',
    category: 'Filters & Modulation',
    filter: {
      enabled: true,
      type: 'acid-303',
      cutoffHz: 1200,
      resonance: 14.0,
      lfoRateHz: 2.5,
      lfoDepth: 80,
      lfoShape: 'saw',
    },
    distortion: {
      enabled: true,
      driveType: 'germanium-fuzz',
      gainDb: 14,
      wavefoldStages: 2,
      bitDepth: 16,
      downsample: 1,
      noiseHiss: 0,
      mix: 65,
    },
  },
  {
    ...DEFAULT_DSP_RACK_CONFIG,
    id: 'preset-tape-stop-drop',
    name: '📼 Vinyl Tape Stop Brake',
    category: 'Creative Surgery',
    surgical: {
      reverse: false,
      tapeStopBrakeSec: 0.85,
      fadeInSec: 0,
      fadeOutSec: 0.05,
      trimSilenceDb: null,
      normalizePeak: true,
      normalizeTargetDb: -0.3,
      removeDc: true,
      invertPhaseL: false,
      invertPhaseR: false,
    },
    distortion: {
      enabled: true,
      driveType: 'tape-sat',
      gainDb: 6,
      wavefoldStages: 1,
      bitDepth: 14,
      downsample: 1,
      noiseHiss: 25,
      mix: 40,
    },
  },
  {
    ...DEFAULT_DSP_RACK_CONFIG,
    id: 'preset-sci-fi-ringmod',
    name: '🤖 Cyber Robotic Ring Modulator',
    category: 'Pitch & Extreme FX',
    pitchRing: {
      enabled: true,
      pitchSemitones: -5,
      pitchCents: 0,
      ringModFreqHz: 340,
      ringModMix: 60,
    },
    modulation: {
      enabled: true,
      type: 'flanger',
      rateHz: 1.8,
      depth: 80,
      feedback: 65,
      haasDelayMs: 6,
      mix: 50,
    },
  },
  {
    ...DEFAULT_DSP_RACK_CONFIG,
    id: 'preset-underwater-dark',
    name: '🌊 Underwater Submerged Echoes',
    category: 'Space & Ambient',
    filter: {
      enabled: true,
      type: 'lowpass',
      cutoffHz: 480,
      resonance: 2.2,
      lfoRateHz: 0.4,
      lfoDepth: 25,
      lfoShape: 'sine',
    },
    reverb: {
      enabled: true,
      decaySec: 4.5,
      preDelayMs: 30,
      roomSize: 'cathedral',
      dampingHz: 1500,
      shimmer: 0,
      freeze: false,
      mix: 50,
    },
    stutter: {
      enabled: true,
      division: '1/8',
      dutyCycle: 70,
      shape: 'smooth-tremolo',
      mix: 40,
      bpm: 100,
    },
  },
];

// Helper: Convert Sync division to seconds given BPM
export function syncDivisionToSeconds(div: string, bpm: number): number {
  const beatSec = 60 / Math.max(20, bpm);
  switch (div) {
    case '1/4': return beatSec;
    case '1/8': return beatSec / 2;
    case '1/8D': return (beatSec / 2) * 1.5;
    case '1/8T': return (beatSec / 2) * (2 / 3);
    case '1/16': return beatSec / 4;
    case '1/16T': return (beatSec / 4) * (2 / 3);
    case '1/32': return beatSec / 8;
    case '1/64': return beatSec / 16;
    case '1/2': return beatSec * 2;
    default: return 0.25;
  }
}

/**
 * High-Speed Offline Audio Processing Algorithm
 * Processes an input AudioBuffer through the full DSP FX Rack chain and returns a new transformed AudioBuffer
 */
export async function applyEffectsToAudioBuffer(
  inputBuffer: AudioBuffer,
  config: DspRackConfig
): Promise<AudioBuffer> {
  const sampleRate = inputBuffer.sampleRate;
  const numChannels = inputBuffer.numberOfChannels;
  const originalLength = inputBuffer.length;

  // Calculate potential tail needed for delays/reverbs
  let tailSec = 0;
  if (config.reverb.enabled) {
    tailSec = Math.max(tailSec, Math.min(6, config.reverb.decaySec));
  }
  if (config.delay.enabled) {
    tailSec = Math.max(tailSec, Math.min(4, config.delay.timeSec * 4));
  }

  const newLength = originalLength + Math.floor(tailSec * sampleRate);
  
  // Clone channels to Float32Arrays
  let left = new Float32Array(newLength);
  let right = new Float32Array(newLength);

  const origLeft = inputBuffer.getChannelData(0);
  const origRight = numChannels > 1 ? inputBuffer.getChannelData(1) : origLeft;

  left.set(origLeft);
  right.set(origRight);

  // Keep a copy of dry signal for dry/wet blending
  const dryLeft = new Float32Array(left);
  const dryRight = new Float32Array(right);

  // 1. SURGICAL: DC Offset Removal
  if (config.surgical.removeDc) {
    let meanL = 0;
    let meanR = 0;
    for (let i = 0; i < originalLength; i++) {
      meanL += left[i];
      meanR += right[i];
    }
    meanL /= originalLength;
    meanR /= originalLength;
    for (let i = 0; i < newLength; i++) {
      left[i] -= meanL;
      right[i] -= meanR;
    }
  }

  // 2. SURGICAL: Reverse
  if (config.surgical.reverse) {
    const tempL = new Float32Array(originalLength);
    const tempR = new Float32Array(originalLength);
    for (let i = 0; i < originalLength; i++) {
      tempL[i] = left[originalLength - 1 - i];
      tempR[i] = right[originalLength - 1 - i];
    }
    left.set(tempL, 0);
    right.set(tempR, 0);
  }

  // 3. SURGICAL: Tape Stop Vinyl Brake
  if (config.surgical.tapeStopBrakeSec > 0) {
    const brakeSamples = Math.min(newLength, Math.floor(config.surgical.tapeStopBrakeSec * sampleRate));
    const startIdx = Math.max(0, originalLength - brakeSamples);
    
    // Pitch down quadratic resample
    const stoppedL = new Float32Array(newLength);
    const stoppedR = new Float32Array(newLength);
    stoppedL.set(left.subarray(0, startIdx));
    stoppedR.set(right.subarray(0, startIdx));

    let srcPos = startIdx;
    for (let i = startIdx; i < newLength; i++) {
      const progress = (i - startIdx) / Math.max(1, brakeSamples);
      const speed = Math.max(0.01, 1 - progress * progress); // Deceleration curve
      srcPos += speed;
      const intPos = Math.floor(srcPos);
      if (intPos < newLength - 1) {
        const frac = srcPos - intPos;
        stoppedL[i] = left[intPos] * (1 - frac) + left[intPos + 1] * frac;
        stoppedR[i] = right[intPos] * (1 - frac) + right[intPos + 1] * frac;
      }
    }
    left = stoppedL;
    right = stoppedR;
  }

  // 4. SUB & DEEP BASS ENHANCER (Sub-harmonics + 808 Drive + Bass Monofier)
  if (config.subBass.enabled) {
    const boostGain = Math.pow(10, config.subBass.boostDb / 20);
    const subFreq = config.subBass.frequency;
    const subHarmonicMix = config.subBass.subHarmonics / 100;
    const driveAmount = config.subBass.subDrive / 100;
    const monoCutoff = config.subBass.monoSubCutoff;

    // Sub-harmonic sine generator with zero-crossing tracking
    let phase = 0;
    const subPhaseStep = (2 * Math.PI * (subFreq / 2)) / sampleRate;

    // Lowpass filter coefficient for extracting bass band
    const dt = 1 / sampleRate;
    const rcBass = 1 / (2 * Math.PI * subFreq);
    const alphaBass = dt / (rcBass + dt);
    let lpL = 0;
    let lpR = 0;

    // Mono bass crossover filter
    const rcMono = 1 / (2 * Math.PI * monoCutoff);
    const alphaMono = dt / (rcMono + dt);
    let monoLpL = 0;
    let monoLpR = 0;

    for (let i = 0; i < newLength; i++) {
      // 1. Bass band isolation
      lpL += alphaBass * (left[i] - lpL);
      lpR += alphaBass * (right[i] - lpR);

      // 2. Sub-harmonic synthesis
      const subEnergy = (Math.abs(lpL) + Math.abs(lpR)) * 0.5;
      phase += subPhaseStep;
      if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
      const subSine = Math.sin(phase) * subEnergy * subHarmonicMix * 1.5;

      // 3. 808 Tube drive on sub band
      let drivenL = lpL * boostGain;
      let drivenR = lpR * boostGain;
      if (driveAmount > 0) {
        drivenL = Math.tanh(drivenL * (1 + driveAmount * 3));
        drivenR = Math.tanh(drivenR * (1 + driveAmount * 3));
      }

      // 4. Combine original + boosted bass + sub harmonic
      left[i] = (left[i] - lpL) + drivenL + subSine;
      right[i] = (right[i] - lpR) + drivenR + subSine;

      // 5. Monofy low sub
      monoLpL += alphaMono * (left[i] - monoLpL);
      monoLpR += alphaMono * (right[i] - monoLpR);
      const monoSum = (monoLpL + monoLpR) * 0.5;

      left[i] = (left[i] - monoLpL) + monoSum;
      right[i] = (right[i] - monoLpR) + monoSum;
    }
  }

  // 5. TRANSIENT SHAPER (Attack Punch & Sustain Expansion)
  if (config.transient.enabled && (config.transient.attackDb !== 0 || config.transient.sustainDb !== 0)) {
    const attackMult = Math.pow(10, config.transient.attackDb / 20);
    const sustainMult = Math.pow(10, config.transient.sustainDb / 20);
    const fastAlpha = Math.exp(-1 / (sampleRate * 0.005));
    const slowAlpha = Math.exp(-1 / (sampleRate * (config.transient.punchSpeedMs / 1000)));

    let fastEnv = 0;
    let slowEnv = 0;

    for (let i = 0; i < newLength; i++) {
      const absIn = (Math.abs(left[i]) + Math.abs(right[i])) * 0.5;
      fastEnv = Math.max(absIn, fastEnv * fastAlpha);
      slowEnv = Math.max(absIn, slowEnv * slowAlpha);

      const diff = fastEnv - slowEnv;
      let gain = 1.0;
      if (diff > 0.01) {
        // Attack transient region
        gain = 1.0 + (attackMult - 1.0) * (diff / (fastEnv + 1e-4));
      } else {
        // Sustain region
        gain = sustainMult;
      }

      left[i] *= gain;
      right[i] *= gain;
    }
  }

  // 6. DISTORTION, WAVESHAPER, BITCRUSHER & LO-FI DOWNSAMPLER
  if (config.distortion.enabled) {
    const driveGain = Math.pow(10, config.distortion.gainDb / 20);
    const bitDepth = config.distortion.bitDepth;
    const quantLevels = Math.pow(2, bitDepth);
    const downsample = Math.max(1, Math.floor(config.distortion.downsample));
    const foldStages = config.distortion.wavefoldStages;
    const hissAmount = config.distortion.noiseHiss / 100;
    const distMix = config.distortion.mix / 100;

    let holdSampleL = 0;
    let holdSampleR = 0;

    for (let i = 0; i < newLength; i++) {
      let sl = left[i] * driveGain;
      let sr = right[i] * driveGain;

      // Type shaping
      switch (config.distortion.driveType) {
        case 'tube-warmth':
          sl = Math.tanh(sl * 1.2) / 1.2;
          sr = Math.tanh(sr * 1.2) / 1.2;
          break;
        case 'tape-sat':
          sl = sl / (1 + Math.abs(sl));
          sr = sr / (1 + Math.abs(sr));
          break;
        case 'hard-clip':
          sl = Math.max(-1, Math.min(1, sl));
          sr = Math.max(-1, Math.min(1, sr));
          break;
        case 'wavefolder':
          for (let st = 0; st < foldStages; st++) {
            sl = Math.sin(sl * Math.PI * 0.5);
            sr = Math.sin(sr * Math.PI * 0.5);
          }
          break;
        case 'germanium-fuzz':
          sl = Math.sign(sl) * (1 - Math.exp(-Math.abs(sl * 2)));
          sr = Math.sign(sr) * (1 - Math.exp(-Math.abs(sr * 2)));
          break;
      }

      // Bitcrushing
      if (bitDepth < 16) {
        sl = Math.round(sl * (quantLevels / 2)) / (quantLevels / 2);
        sr = Math.round(sr * (quantLevels / 2)) / (quantLevels / 2);
      }

      // Downsampling / Sample Rate Reducer
      if (downsample > 1) {
        if (i % downsample === 0) {
          holdSampleL = sl;
          holdSampleR = sr;
        }
        sl = holdSampleL;
        sr = holdSampleR;
      }

      // Vinyl/Tape Hiss
      if (hissAmount > 0) {
        const noise = (Math.random() * 2 - 1) * hissAmount * 0.05;
        sl += noise;
        sr += noise;
      }

      left[i] = left[i] * (1 - distMix) + sl * distMix;
      right[i] = right[i] * (1 - distMix) + sr * distMix;
    }
  }

  // 7. PITCH TRANSPOSITION, RING MODULATOR & FREQUENCY SHIFTER
  if (config.pitchRing.enabled) {
    const ringFreq = config.pitchRing.ringModFreqHz;
    const ringMix = config.pitchRing.ringModMix / 100;

    if (ringFreq > 0 && ringMix > 0) {
      let ringPhase = 0;
      const ringStep = (2 * Math.PI * ringFreq) / sampleRate;

      for (let i = 0; i < newLength; i++) {
        ringPhase += ringStep;
        if (ringPhase > 2 * Math.PI) ringPhase -= 2 * Math.PI;
        const carrier = Math.sin(ringPhase);

        const modL = left[i] * carrier;
        const modR = right[i] * carrier;

        left[i] = left[i] * (1 - ringMix) + modL * ringMix;
        right[i] = right[i] * (1 - ringMix) + modR * ringMix;
      }
    }

    // Pitch Semitones Shifter (Granular pitch shift offline)
    if (config.pitchRing.pitchSemitones !== 0 || config.pitchRing.pitchCents !== 0) {
      const totalCents = config.pitchRing.pitchSemitones * 100 + config.pitchRing.pitchCents;
      const pitchRatio = Math.pow(2, totalCents / 1200);

      // Granular crossfade pitch shifter
      const grainSize = Math.floor(sampleRate * 0.04); // 40ms grains
      const hopSize = Math.floor(grainSize / 2);
      const outL = new Float32Array(newLength);
      const outR = new Float32Array(newLength);

      for (let pos = 0; pos < newLength - grainSize; pos += hopSize) {
        for (let g = 0; g < grainSize; g++) {
          const srcIdx = Math.floor(pos + g * pitchRatio);
          if (srcIdx < newLength) {
            // Hann window
            const win = 0.5 * (1 - Math.cos((2 * Math.PI * g) / grainSize));
            outL[pos + g] += left[srcIdx] * win;
            outR[pos + g] += right[srcIdx] * win;
          }
        }
      }
      left = outL;
      right = outR;
    }
  }

  // 8. RHYTHMIC STUTTER & GLITCH CHOPPER / TRANCE GATE
  if (config.stutter.enabled && config.stutter.mix > 0) {
    const gateTimeSec = syncDivisionToSeconds(config.stutter.division, config.stutter.bpm);
    const gatePeriodSamples = Math.max(16, Math.floor(gateTimeSec * sampleRate));
    const onSamples = Math.floor(gatePeriodSamples * (config.stutter.dutyCycle / 100));
    const stutterMix = config.stutter.mix / 100;

    for (let i = 0; i < newLength; i++) {
      const pos = i % gatePeriodSamples;
      let gateGain = 1.0;

      if (config.stutter.shape === 'hard-gate') {
        gateGain = pos < onSamples ? 1.0 : 0.0;
      } else if (config.stutter.shape === 'smooth-tremolo') {
        const phi = (pos / gatePeriodSamples) * 2 * Math.PI;
        gateGain = 0.5 * (1 + Math.sin(phi));
      } else if (config.stutter.shape === 'random-glitch') {
        const chunk = Math.floor(i / (gatePeriodSamples / 4));
        const pseudoRand = (Math.sin(chunk * 997) * 10000) % 1;
        gateGain = Math.abs(pseudoRand) > 0.45 ? 1.0 : 0.05;
      }

      left[i] = left[i] * (1 - stutterMix) + (left[i] * gateGain) * stutterMix;
      right[i] = right[i] * (1 - stutterMix) + (right[i] * gateGain) * stutterMix;
    }
  }

  // 9. DYNAMIC RESONANT FILTER & LFO
  if (config.filter.enabled) {
    const filterType = config.filter.type;
    const baseCutoff = config.filter.cutoffHz;
    const q = Math.max(0.5, config.filter.resonance);
    const lfoRate = config.filter.lfoRateHz;
    const lfoDepth = config.filter.lfoDepth / 100;
    const lfoStep = (2 * Math.PI * lfoRate) / sampleRate;

    let lfoPhase = 0;
    let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
    let x1L = 0, x2L = 0, y1L = 0, y2L = 0;
    let x1R = 0, x2R = 0, y1R = 0, y2R = 0;

    for (let i = 0; i < newLength; i++) {
      // Calculate dynamic modulated cutoff
      lfoPhase += lfoStep;
      if (lfoPhase > 2 * Math.PI) lfoPhase -= 2 * Math.PI;
      
      let mod = 0;
      if (config.filter.lfoShape === 'sine') mod = Math.sin(lfoPhase);
      else if (config.filter.lfoShape === 'triangle') mod = 1 - 2 * Math.abs((lfoPhase / Math.PI) - 1);
      else if (config.filter.lfoShape === 'saw') mod = (lfoPhase / Math.PI) - 1;
      else if (config.filter.lfoShape === 'square') mod = lfoPhase < Math.PI ? 1 : -1;

      const dynamicCutoff = Math.max(30, Math.min(20000, baseCutoff * Math.pow(2, mod * lfoDepth * 3)));

      // Recalculate Biquad coefficients
      const omega = (2 * Math.PI * dynamicCutoff) / sampleRate;
      const sinOmega = Math.sin(omega);
      const cosOmega = Math.cos(omega);
      const alpha = sinOmega / (2 * q);

      if (filterType === 'lowpass' || filterType === 'acid-303') {
        const a0 = 1 + alpha;
        b0 = ((1 - cosOmega) / 2) / a0;
        b1 = (1 - cosOmega) / a0;
        b2 = ((1 - cosOmega) / 2) / a0;
        a1 = (-2 * cosOmega) / a0;
        a2 = (1 - alpha) / a0;
      } else if (filterType === 'highpass') {
        const a0 = 1 + alpha;
        b0 = ((1 + cosOmega) / 2) / a0;
        b1 = -(1 + cosOmega) / a0;
        b2 = ((1 + cosOmega) / 2) / a0;
        a1 = (-2 * cosOmega) / a0;
        a2 = (1 - alpha) / a0;
      } else if (filterType === 'bandpass') {
        const a0 = 1 + alpha;
        b0 = (sinOmega / 2) / a0;
        b1 = 0;
        b2 = -(sinOmega / 2) / a0;
        a1 = (-2 * cosOmega) / a0;
        a2 = (1 - alpha) / a0;
      } else if (filterType === 'notch') {
        const a0 = 1 + alpha;
        b0 = 1 / a0;
        b1 = (-2 * cosOmega) / a0;
        b2 = 1 / a0;
        a1 = (-2 * cosOmega) / a0;
        a2 = (1 - alpha) / a0;
      }

      // Filter Left
      const yL = b0 * left[i] + b1 * x1L + b2 * x2L - a1 * y1L - a2 * y2L;
      x2L = x1L; x1L = left[i];
      y2L = y1L; y1L = yL;
      left[i] = yL;

      // Filter Right
      const yR = b0 * right[i] + b1 * x1R + b2 * x2R - a1 * y1R - a2 * y2R;
      x2R = x1R; x1R = right[i];
      y2R = y1R; y1R = yR;
      right[i] = yR;
    }
  }

  // 9b. VOCAL FORMANT & ROBOT TALKBOX FILTER
  if (config.formant.enabled && config.formant.mix > 0) {
    const vowel = config.formant.vowel;
    const formantMix = config.formant.mix / 100;
    const resQ = Math.max(1, config.formant.resonance);
    const shiftRatio = Math.pow(2, config.formant.formantShift / 12);

    // Formant vowel frequency pairs [F1, F2] in Hz
    const vowelFormants: Record<string, [number, number]> = {
      a: [800, 1200],
      e: [400, 2200],
      i: [280, 2600],
      o: [500, 900],
      u: [320, 750],
      'auto-morph': [600, 1600],
    };

    let f1Base = vowelFormants[vowel]?.[0] || 600;
    let f2Base = vowelFormants[vowel]?.[1] || 1600;

    let fLfoPhase = 0;
    const fLfoStep = (2 * Math.PI * config.formant.morphSpeedHz) / sampleRate;

    let formX1L = 0, formX2L = 0, formY1L = 0, formY2L = 0;
    let formX1R = 0, formX2R = 0, formY1R = 0, formY2R = 0;

    for (let i = 0; i < newLength; i++) {
      if (vowel === 'auto-morph') {
        fLfoPhase += fLfoStep;
        if (fLfoPhase > 2 * Math.PI) fLfoPhase -= 2 * Math.PI;
        const morph = 0.5 * (1 + Math.sin(fLfoPhase));
        f1Base = 300 + morph * 600;
        f2Base = 800 + (1 - morph) * 1800;
      }

      const f1 = Math.max(100, Math.min(8000, f1Base * shiftRatio));
      const omega = (2 * Math.PI * f1) / sampleRate;
      const sinO = Math.sin(omega);
      const cosO = Math.cos(omega);
      const alpha = sinO / (2 * resQ);
      const a0 = 1 + alpha;
      const b0 = (sinO / 2) / a0;
      const b2 = -(sinO / 2) / a0;
      const a1 = (-2 * cosO) / a0;
      const a2 = (1 - alpha) / a0;

      const yL = b0 * left[i] + b2 * formX2L - a1 * formY1L - a2 * formY2L;
      formX2L = formX1L; formX1L = left[i];
      formY2L = formY1L; formY1L = yL;

      const yR = b0 * right[i] + b2 * formX2R - a1 * formY1R - a2 * formY2R;
      formX2R = formX1R; formX1R = right[i];
      formY2R = formY1R; formY1R = yR;

      left[i] = left[i] * (1 - formantMix) + yL * formantMix * 2.5;
      right[i] = right[i] * (1 - formantMix) + yR * formantMix * 2.5;
    }
  }

  // 9c. STUDIO COMPRESSOR & PEAK LIMITER (DYNAMICS)
  if (config.compressor.enabled) {
    const threshLin = Math.pow(10, config.compressor.thresholdDb / 20);
    const ratio = Math.max(1, config.compressor.ratio);
    const makeupGain = Math.pow(10, config.compressor.makeupGainDb / 20);
    const attAlpha = Math.exp(-1 / (sampleRate * (config.compressor.attackMs / 1000)));
    const relAlpha = Math.exp(-1 / (sampleRate * (config.compressor.releaseMs / 1000)));

    let compEnv = 0;
    for (let i = 0; i < newLength; i++) {
      const peakSample = Math.max(Math.abs(left[i]), Math.abs(right[i]));
      if (peakSample > compEnv) {
        compEnv = peakSample + attAlpha * (compEnv - peakSample);
      } else {
        compEnv = peakSample + relAlpha * (compEnv - peakSample);
      }

      let gainReduction = 1.0;
      if (compEnv > threshLin) {
        const excessDb = 20 * Math.log10(compEnv / threshLin);
        const compressedDb = excessDb / ratio;
        const reductionDb = compressedDb - excessDb;
        gainReduction = Math.pow(10, reductionDb / 20);
      }

      left[i] = left[i] * gainReduction * makeupGain;
      right[i] = right[i] * gainReduction * makeupGain;
    }
  }

  // 9d. STEREO IMAGER, AUTOPAN & TREMOLO
  if (config.imager.enabled) {
    const width = config.imager.widthPercent / 100;
    const panRate = config.imager.autopanRateHz;
    const panDepth = config.imager.autopanDepth / 100;
    const tremRate = config.imager.tremoloRateHz;
    const tremDepth = config.imager.tremoloDepth / 100;

    let panPhase = 0;
    const panStep = (2 * Math.PI * panRate) / sampleRate;
    let tremPhase = 0;
    const tremStep = (2 * Math.PI * tremRate) / sampleRate;

    for (let i = 0; i < newLength; i++) {
      // 1. Mid/Side Stereo Width Expansion
      const mid = (left[i] + right[i]) * 0.5;
      const side = (left[i] - right[i]) * 0.5 * width;
      let outL = mid + side;
      let outR = mid - side;

      // 2. Autopan LFO
      if (panRate > 0 && panDepth > 0) {
        panPhase += panStep;
        if (panPhase > 2 * Math.PI) panPhase -= 2 * Math.PI;
        const panSin = Math.sin(panPhase) * panDepth; // -1 to +1
        const gainL = 0.5 * (1 - panSin);
        const gainR = 0.5 * (1 + panSin);
        outL *= gainL * 2;
        outR *= gainR * 2;
      }

      // 3. Tremolo Amplitude LFO
      if (tremRate > 0 && tremDepth > 0) {
        tremPhase += tremStep;
        if (tremPhase > 2 * Math.PI) tremPhase -= 2 * Math.PI;
        const trem = 1 - 0.5 * tremDepth * (1 + Math.sin(tremPhase));
        outL *= trem;
        outR *= trem;
      }

      left[i] = outL;
      right[i] = outR;
    }
  }

  // 9e. VINYL CRACKLE, NOISE & CASSETTE TAPE WARBLE
  if (config.vinylTape.enabled && config.vinylTape.mix > 0) {
    const vMix = config.vinylTape.mix / 100;
    const crackle = config.vinylTape.crackleAmount / 100;
    const dust = config.vinylTape.vinylDustPops / 100;
    const warbleRate = config.vinylTape.tapeWarbleHz;
    const flutterDepth = config.vinylTape.tapeFlutterDepth / 100;
    const curve = config.vinylTape.vintageCurve;

    let warblePhase = 0;
    const warbleStep = (2 * Math.PI * warbleRate) / sampleRate;

    // Buffer for tape pitch wow/flutter
    const tapeBufSize = Math.floor(sampleRate * 0.05);
    const tapeBufL = new Float32Array(tapeBufSize);
    const tapeBufR = new Float32Array(tapeBufSize);
    let tIdx = 0;

    for (let i = 0; i < newLength; i++) {
      // 1. Vinyl Dust & Crackle generation
      let noiseVal = 0;
      if (crackle > 0) {
        // High-frequency dust hiss
        noiseVal += (Math.random() * 2 - 1) * 0.015 * crackle;
      }
      if (dust > 0) {
        // Random dust pop click
        if (Math.random() < 0.0004 * dust) {
          noiseVal += (Math.random() > 0.5 ? 1 : -1) * (0.15 + Math.random() * 0.35) * dust;
        }
      }

      // 2. Tape Warble / Flutter Delay Line
      warblePhase += warbleStep;
      if (warblePhase > 2 * Math.PI) warblePhase -= 2 * Math.PI;
      const modOffset = (0.01 + Math.sin(warblePhase) * 0.003 * flutterDepth) * sampleRate;
      const readPos = (tIdx - modOffset + tapeBufSize) % tapeBufSize;
      const rInt = Math.floor(readPos);

      tapeBufL[tIdx] = left[i];
      tapeBufR[tIdx] = right[i];
      tIdx = (tIdx + 1) % tapeBufSize;

      let wL = tapeBufL[rInt];
      let wR = tapeBufR[rInt];

      // 3. Vintage curve EQ shaping
      if (curve === '1920-gramophone') {
        wL = Math.max(-0.6, Math.min(0.6, wL * 1.5));
        wR = Math.max(-0.6, Math.min(0.6, wR * 1.5));
      } else if (curve === '1950-radio') {
        wL = (wL + Math.sin(wL * 3) * 0.2) * 1.1;
        wR = (wR + Math.sin(wR * 3) * 0.2) * 1.1;
      } else if (curve === '1970-cassette') {
        wL = Math.tanh(wL * 1.3);
        wR = Math.tanh(wR * 1.3);
      }

      left[i] = left[i] * (1 - vMix) + (wL + noiseVal) * vMix;
      right[i] = right[i] * (1 - vMix) + (wR + noiseVal) * vMix;
    }
  }

  // 9f. BODE FREQUENCY SHIFTER (ALIEN / GONG / METALLIC SHIFT)
  if (config.freqShifter.enabled && config.freqShifter.mix > 0 && config.freqShifter.shiftHz !== 0) {
    const fMix = config.freqShifter.mix / 100;
    const shiftHz = config.freqShifter.shiftHz;
    const phaseRad = (config.freqShifter.quadraturePhase * Math.PI) / 180;
    let shiftPhase = 0;
    const shiftStep = (2 * Math.PI * shiftHz) / sampleRate;

    for (let i = 0; i < newLength; i++) {
      shiftPhase += shiftStep;
      if (shiftPhase > 2 * Math.PI) shiftPhase -= 2 * Math.PI;

      const carrierSin = Math.sin(shiftPhase);
      const carrierCos = Math.cos(shiftPhase + phaseRad);

      const shiftedL = left[i] * carrierSin;
      const shiftedR = right[i] * carrierCos;

      left[i] = left[i] * (1 - fMix) + shiftedL * fMix * 1.4;
      right[i] = right[i] * (1 - fMix) + shiftedR * fMix * 1.4;
    }
  }

  // 9g. HARMONIC EXCITER & AIR PRESENCE (APHEX HIGH-END SHIMMER)
  if (config.exciter.enabled && config.exciter.mix > 0) {
    const eMix = config.exciter.mix / 100;
    const airGain = Math.pow(10, config.exciter.airBoostDb / 20);
    const drive = 1 + (config.exciter.harmonicsDrive / 100) * 3;
    const curve = config.exciter.curve;

    // Highpass filter for exciter sidechain (> 4kHz)
    const hpFreq = Math.max(3000, config.exciter.frequencyHz);
    const alphaHp = 1 / (1 + (2 * Math.PI * hpFreq) / sampleRate);
    let prevHpL = 0, prevInL = 0;
    let prevHpR = 0, prevInR = 0;

    for (let i = 0; i < newLength; i++) {
      const hpL = alphaHp * (prevHpL + left[i] - prevInL);
      const hpR = alphaHp * (prevHpR + right[i] - prevInR);
      prevHpL = hpL; prevInL = left[i];
      prevHpR = hpR; prevInR = right[i];

      let excitedL = hpL * drive;
      let excitedR = hpR * drive;

      if (curve === 'tube-even') {
        excitedL = excitedL + 0.5 * (excitedL * excitedL);
        excitedR = excitedR + 0.5 * (excitedR * excitedR);
      } else if (curve === 'tape-odd') {
        excitedL = Math.tanh(excitedL * 1.5);
        excitedR = Math.tanh(excitedR * 1.5);
      } else {
        excitedL = Math.sin(excitedL * 1.2);
        excitedR = Math.sin(excitedR * 1.2);
      }

      left[i] += excitedL * airGain * eMix;
      right[i] += excitedR * airGain * eMix;
    }
  }

  // 9h. DYNAMIC AUTO-WAH & ENVELOPE FOLLOWER
  if (config.autoWah.enabled && config.autoWah.mix > 0) {
    const wahMix = config.autoWah.mix / 100;
    const sens = config.autoWah.sensitivity / 100;
    const baseCut = config.autoWah.baseCutoffHz;
    const sweepRange = config.autoWah.sweepRangeHz;
    const qWah = Math.max(1, config.autoWah.resonance);
    const attA = Math.exp(-1 / (sampleRate * (config.autoWah.attackMs / 1000)));
    const relA = Math.exp(-1 / (sampleRate * (config.autoWah.releaseMs / 1000)));
    const isUp = config.autoWah.direction === 'up';

    let env = 0;
    let wX1L = 0, wX2L = 0, wY1L = 0, wY2L = 0;
    let wX1R = 0, wX2R = 0, wY1R = 0, wY2R = 0;

    for (let i = 0; i < newLength; i++) {
      const peak = Math.max(Math.abs(left[i]), Math.abs(right[i]));
      if (peak > env) env = peak + attA * (env - peak);
      else env = peak + relA * (env - peak);

      const modAmount = Math.min(1, env * sens * 4);
      const cut = isUp
        ? Math.min(18000, baseCut + modAmount * sweepRange)
        : Math.max(50, baseCut - modAmount * sweepRange);

      const omega = (2 * Math.PI * cut) / sampleRate;
      const sinO = Math.sin(omega);
      const cosO = Math.cos(omega);
      const alpha = sinO / (2 * qWah);
      const a0 = 1 + alpha;
      const b0 = (sinO / 2) / a0;
      const b2 = -(sinO / 2) / a0;
      const a1 = (-2 * cosO) / a0;
      const a2 = (1 - alpha) / a0;

      const yL = b0 * left[i] + b2 * wX2L - a1 * wY1L - a2 * wY2L;
      wX2L = wX1L; wX1L = left[i];
      wY2L = wY1L; wY1L = yL;

      const yR = b0 * right[i] + b2 * wX2R - a1 * wY1R - a2 * wY2R;
      wX2R = wX1R; wX1R = right[i];
      wY2R = wY1R; wY1R = yR;

      left[i] = left[i] * (1 - wahMix) + yL * wahMix * 1.8;
      right[i] = right[i] * (1 - wahMix) + yR * wahMix * 1.8;
    }
  }

  // 9i. COMB FILTER & KARPLUS-STRONG PHYSICAL RESONATOR MATRIX
  if (config.combResonator.enabled && config.combResonator.mix > 0) {
    const resMix = config.combResonator.mix / 100;
    const fHz = Math.max(30, Math.min(4000, config.combResonator.tuneFreqHz));
    const delaySamples = Math.max(2, Math.floor(sampleRate / fHz));
    const fbGain = Math.min(0.98, config.combResonator.feedbackDecay / 100);
    const dampAlpha = Math.exp(-2 * Math.PI * (config.combResonator.dampingHz / sampleRate));

    const combL = new Float32Array(delaySamples + 10);
    const combR = new Float32Array(delaySamples + 10);
    let cIdx = 0;
    let dL = 0, dR = 0;

    for (let i = 0; i < newLength; i++) {
      const readIdx = (cIdx + 1) % delaySamples;
      let outL = combL[readIdx];
      let outR = combR[readIdx];

      dL = outL + dampAlpha * (dL - outL);
      dR = outR + dampAlpha * (dR - outR);
      outL = dL;
      outR = dR;

      combL[cIdx] = left[i] + outL * fbGain;
      combR[cIdx] = right[i] + outR * fbGain;
      cIdx = (cIdx + 1) % delaySamples;

      left[i] = left[i] * (1 - resMix) + outL * resMix * 1.5;
      right[i] = right[i] * (1 - resMix) + outR * resMix * 1.5;
    }
  }

  // 10. MODULATION FX (Chorus, Flanger, Phaser & Haas Spatial Widener)
  if (config.modulation.enabled && config.modulation.mix > 0) {
    const modMix = config.modulation.mix / 100;
    const modRate = config.modulation.rateHz;
    const modDepth = config.modulation.depth / 100;
    const modFeedback = config.modulation.feedback / 100;
    const haasDelay = Math.floor((config.modulation.haasDelayMs / 1000) * sampleRate);

    if (config.modulation.type === 'haas-widener') {
      for (let i = 0; i < newLength; i++) {
        const delayedL = i >= haasDelay ? left[i - haasDelay] : 0;
        left[i] = left[i] * (1 - modMix) + delayedL * modMix;
      }
    } else {
      // Modulated Delay Line for Chorus / Flanger
      const maxDelaySamples = Math.floor(sampleRate * 0.05); // 50ms buffer
      const delayBufL = new Float32Array(maxDelaySamples);
      const delayBufR = new Float32Array(maxDelaySamples);
      let bufIdx = 0;
      let phase = 0;
      const phaseStep = (2 * Math.PI * modRate) / sampleRate;

      for (let i = 0; i < newLength; i++) {
        phase += phaseStep;
        if (phase > 2 * Math.PI) phase -= 2 * Math.PI;

        const baseMs = config.modulation.type === 'flanger' ? 0.003 : 0.02; // 3ms vs 20ms
        const rangeMs = config.modulation.type === 'flanger' ? 0.002 : 0.008;

        const modL = (baseMs + Math.sin(phase) * rangeMs * modDepth) * sampleRate;
        const modR = (baseMs + Math.cos(phase) * rangeMs * modDepth) * sampleRate;

        // Read interpolated
        const readPosL = (bufIdx - modL + maxDelaySamples) % maxDelaySamples;
        const readPosR = (bufIdx - modR + maxDelaySamples) % maxDelaySamples;
        const intL = Math.floor(readPosL);
        const intR = Math.floor(readPosR);

        const wetL = delayBufL[intL];
        const wetR = delayBufR[intR];

        delayBufL[bufIdx] = left[i] + wetL * modFeedback;
        delayBufR[bufIdx] = right[i] + wetR * modFeedback;
        bufIdx = (bufIdx + 1) % maxDelaySamples;

        left[i] = left[i] * (1 - modMix) + wetL * modMix;
        right[i] = right[i] * (1 - modMix) + wetR * modMix;
      }
    }
  }

  // 11. STEREO PING-PONG & TAPE DELAY
  if (config.delay.enabled && config.delay.mix > 0) {
    const delayTimeSec = config.delay.syncDivision !== 'free'
      ? syncDivisionToSeconds(config.delay.syncDivision, config.stutter.bpm || 120)
      : config.delay.timeSec;
    const delaySamples = Math.max(10, Math.floor(delayTimeSec * sampleRate));
    const feedback = config.delay.feedback / 100;
    const delayMix = config.delay.mix / 100;
    const isPingPong = config.delay.pingPong;
    const damping = Math.exp(-2 * Math.PI * (config.delay.dampingHz / sampleRate));

    const delayBufL = new Float32Array(delaySamples + 100);
    const delayBufR = new Float32Array(delaySamples + 100);
    let bufIdx = 0;
    let dampL = 0;
    let dampR = 0;

    for (let i = 0; i < newLength; i++) {
      const readIdx = (bufIdx + 1) % delaySamples;
      
      let tapL = delayBufL[readIdx];
      let tapR = delayBufR[readIdx];

      // High cut damping filter
      dampL = tapL + damping * (dampL - tapL);
      dampR = tapR + damping * (dampR - tapR);
      tapL = dampL;
      tapR = dampR;

      if (isPingPong) {
        delayBufL[bufIdx] = left[i] + tapR * feedback;
        delayBufR[bufIdx] = right[i] + tapL * feedback;
      } else {
        delayBufL[bufIdx] = left[i] + tapL * feedback;
        delayBufR[bufIdx] = right[i] + tapR * feedback;
      }

      bufIdx = (bufIdx + 1) % delaySamples;

      left[i] = left[i] * (1 - delayMix) + tapL * delayMix;
      right[i] = right[i] * (1 - delayMix) + tapR * delayMix;
    }
  }

  // 12. ALGORITHMIC REVERB & SHIMMER REFLECTIONS
  if (config.reverb.enabled && config.reverb.mix > 0) {
    const decay = Math.max(0.2, config.reverb.decaySec);
    const revMix = config.reverb.mix / 100;
    const shimmerMix = config.reverb.shimmer / 100;

    // Multi-comb filter Schroeder/Freeverb topology simulation
    const combDelays = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
    const combBuffersL = combDelays.map((d) => new Float32Array(d));
    const combBuffersR = combDelays.map((d) => new Float32Array(d));
    const combIndices = new Array(combDelays.length).fill(0);
    const feedbackGain = Math.min(0.98, Math.exp(-3 / (decay * (sampleRate / 1000))));

    for (let i = 0; i < newLength; i++) {
      let sumL = 0;
      let sumR = 0;

      for (let c = 0; c < combDelays.length; c++) {
        const d = combDelays[c];
        const idx = combIndices[c];
        const outL = combBuffersL[c][idx];
        const outR = combBuffersR[c][idx];

        combBuffersL[c][idx] = left[i] + outL * feedbackGain;
        combBuffersR[c][idx] = right[i] + outR * feedbackGain;

        combIndices[c] = (idx + 1) % d;
        sumL += outL;
        sumR += outR;
      }

      sumL /= combDelays.length;
      sumR /= combDelays.length;

      // Shimmer octave up reflection
      let shimL = 0;
      let shimR = 0;
      if (shimmerMix > 0 && i % 2 === 0) {
        shimL = sumL * shimmerMix;
        shimR = sumR * shimmerMix;
      }

      left[i] = left[i] * (1 - revMix) + (sumL + shimL) * revMix;
      right[i] = right[i] * (1 - revMix) + (sumR + shimR) * revMix;
    }
  }

  // 13. GLOBAL DRY/WET BLENDING & MASTER OUTPUT GAIN
  const globalDryWet = config.dryWetBalance / 100;
  const masterGain = Math.pow(10, config.masterGainDb / 20);

  for (let i = 0; i < newLength; i++) {
    const dryL = dryLeft[i] || 0;
    const dryR = dryRight[i] || 0;

    left[i] = (dryL * (1 - globalDryWet) + left[i] * globalDryWet) * masterGain;
    right[i] = (dryR * (1 - globalDryWet) + right[i] * globalDryWet) * masterGain;
  }

  // 14. SURGICAL: Fade In & Fade Out
  if (config.surgical.fadeInSec > 0) {
    const fadeSamples = Math.min(newLength, Math.floor(config.surgical.fadeInSec * sampleRate));
    for (let i = 0; i < fadeSamples; i++) {
      const mult = i / fadeSamples;
      left[i] *= mult;
      right[i] *= mult;
    }
  }
  if (config.surgical.fadeOutSec > 0) {
    const fadeSamples = Math.min(newLength, Math.floor(config.surgical.fadeOutSec * sampleRate));
    const startFade = Math.max(0, newLength - fadeSamples);
    for (let i = startFade; i < newLength; i++) {
      const mult = (newLength - i) / fadeSamples;
      left[i] *= mult;
      right[i] *= mult;
    }
  }

  // 15. SURGICAL: Phase Inversion
  if (config.surgical.invertPhaseL) {
    for (let i = 0; i < newLength; i++) left[i] = -left[i];
  }
  if (config.surgical.invertPhaseR) {
    for (let i = 0; i < newLength; i++) right[i] = -right[i];
  }

  // 16. SURGICAL: Peak Normalization
  if (config.surgical.normalizePeak) {
    let peak = 0;
    for (let i = 0; i < newLength; i++) {
      const aL = Math.abs(left[i]);
      const aR = Math.abs(right[i]);
      if (aL > peak) peak = aL;
      if (aR > peak) peak = aR;
    }
    if (peak > 1e-6) {
      const targetLin = Math.pow(10, config.surgical.normalizeTargetDb / 20);
      const normFactor = targetLin / peak;
      for (let i = 0; i < newLength; i++) {
        left[i] *= normFactor;
        right[i] *= normFactor;
      }
    }
  }

  // Create resulting AudioBuffer
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const offlineCtx = new AudioCtx();
  const outputBuffer = offlineCtx.createBuffer(2, newLength, sampleRate);
  outputBuffer.copyToChannel(left, 0);
  outputBuffer.copyToChannel(right, 1);

  return outputBuffer;
}
