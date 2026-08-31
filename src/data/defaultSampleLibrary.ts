import { SampleItem, FolderItem } from '../types/sample';
import { audioEngine } from '../services/audioEngine';
import { audioBufferToWavBlob } from '../services/audioConverter';
import { calculateAudioMetrics, detectAutoSlices } from '../services/audioAnalyzer';
import { PRO_STUDIO_FOLDER_DEFINITIONS, generateProFolderHierarchy, classifySampleToProFolder } from '../services/proFolderOrganizer';

export const DEFAULT_FOLDERS: FolderItem[] = PRO_STUDIO_FOLDER_DEFINITIONS.map((def) => ({
  id: def.id,
  name: def.name,
  path: def.path,
  color: def.color,
  icon: def.icon,
  count: 0,
  parentId: def.parentId,
}));

/**
 * Procedurally synthesizes high-quality audio buffers for the starter library
 */
export async function generateDefaultLibrary(): Promise<SampleItem[]> {
  const ctx = audioEngine.getAudioContext();
  const sampleRate = ctx.sampleRate || 44100;

  const samples: SampleItem[] = [];

  // 1. Multi-Sound Drum Kit Stem (8 consecutive distinct percussion hits in one file)
  {
    const duration = 4.0;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(2, numSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    // 8 distinct hits positioned at 0.0s, 0.5s, 1.0s, 1.5s, 2.0s, 2.5s, 3.0s, 3.5s
    const hitTimings = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];
    
    hitTimings.forEach((tSec, idx) => {
      const startIdx = Math.floor(tSec * sampleRate);
      const hitDuration = 0.35;
      const hitSamples = Math.floor(hitDuration * sampleRate);

      for (let i = 0; i < hitSamples; i++) {
        const globalIdx = startIdx + i;
        if (globalIdx >= numSamples) break;
        const progress = i / hitSamples;
        const env = Math.exp(-progress * 9);

        let valL = 0;
        let valR = 0;

        if (idx === 0) {
          // Kick 1
          const f = 150 * Math.exp(-progress * 25) + 45;
          valL = Math.sin(2 * Math.PI * f * (i / sampleRate)) * env * 0.9;
          valR = valL;
        } else if (idx === 1) {
          // Snare Crack
          const tone = Math.sin(2 * Math.PI * 220 * (i / sampleRate)) * Math.exp(-progress * 15);
          const noise = (Math.random() * 2 - 1) * Math.exp(-progress * 10);
          valL = (tone * 0.4 + noise * 0.6) * env * 0.85;
          valR = (tone * 0.4 + (Math.random() * 2 - 1) * Math.exp(-progress * 10) * 0.6) * env * 0.85;
        } else if (idx === 2) {
          // Hi-Hat
          const noise = (Math.random() * 2 - 1) * Math.exp(-progress * 25);
          const metal = Math.sin(2 * Math.PI * 8400 * (i / sampleRate)) * 0.3;
          valL = (noise + metal) * 0.6;
          valR = (noise * 0.9 + metal) * 0.6;
        } else if (idx === 3) {
          // Clap
          const clapEnv = (Math.random() * 2 - 1) * (i < 800 ? Math.sin(i * 0.1) : Math.exp(-progress * 12));
          valL = clapEnv * 0.8;
          valR = clapEnv * 0.75;
        } else if (idx === 4) {
          // Low Tom
          const f = 180 * Math.exp(-progress * 12) + 70;
          valL = Math.sin(2 * Math.PI * f * (i / sampleRate)) * env * 0.8;
          valR = valL;
        } else if (idx === 5) {
          // High Tom
          const f = 320 * Math.exp(-progress * 14) + 120;
          valL = Math.sin(2 * Math.PI * f * (i / sampleRate)) * env * 0.8;
          valR = valL;
        } else if (idx === 6) {
          // Rimshot
          const ring = Math.sin(2 * Math.PI * 1650 * (i / sampleRate)) * Math.exp(-progress * 28);
          valL = ring * 0.85;
          valR = ring * 0.85;
        } else {
          // Splash / Cymbal
          const noise = (Math.random() * 2 - 1) * Math.exp(-progress * 4);
          valL = noise * 0.5;
          valR = (Math.random() * 2 - 1) * Math.exp(-progress * 4) * 0.5;
        }

        left[globalIdx] = valL;
        right[globalIdx] = valR;
      }
    });

    const metrics = calculateAudioMetrics(buffer);
    const slices = detectAutoSlices(buffer, { sensitivity: 0.6, minSliceDurationMs: 150 });
    const wavBlob = audioBufferToWavBlob(buffer, { bitDepth: 24, normalize: true });
    const blobUrl = URL.createObjectURL(wavBlob);

    samples.push({
      id: 's-multi-stem-01',
      name: 'Cyber_Perc_8Hits_Stem',
      originalFileName: 'Cyber_Perc_8Hits_Stem.wav',
      format: 'wav',
      size: wavBlob.size,
      duration,
      sampleRate,
      bitDepth: 24,
      channels: 2,
      bpm: 120,
      key: 'F min',
      type: 'multi-sound',
      category: 'multi-sound',
      isLoop: false,
      genre: 'Universal / Multi-Genre',
      tags: ['multi-hit', 'stem', 'sliceable', 'drum-kit', 'cyber'],
      folderId: 'f-stems',
      folderPath: '/Multi-Sound Stems',
      favorite: true,
      rating: 5,
      spectralCentroid: metrics.spectralCentroid,
      dynamicRangeDb: metrics.dynamicRangeDb,
      peakDb: metrics.peakDb,
      rmsDb: metrics.rmsDb,
      lufs: metrics.lufs,
      loudnessGainDb: metrics.loudnessGainDb,
      zeroCrossingRate: metrics.zeroCrossingRate,
      slices,
      blobUrl,
      audioBuffer: buffer,
      dateAdded: Date.now() - 1000 * 60 * 30,
      isMultiSound: true,
      ep133Slot: 901,
    });
  }

  // 2. 808 Dark Matter (Sub Bass in F minor)
  {
    const duration = 2.2;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, numSamples, sampleRate);
    const ch = buffer.getChannelData(0);
    const baseFreq = 43.65; // F1

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const pitchEnv = baseFreq * (1 + 2.5 * Math.exp(-t * 18));
      const ampEnv = Math.exp(-progress * 2.8);
      // Fundamental + 2nd harmonic + gentle saturation
      const raw = Math.sin(2 * Math.PI * pitchEnv * t) + 0.35 * Math.sin(4 * Math.PI * pitchEnv * t);
      // Tube saturation curve
      ch[i] = Math.tanh(raw * 1.8) * ampEnv * 0.9;
    }

    const metrics = calculateAudioMetrics(buffer);
    const wavBlob = audioBufferToWavBlob(buffer, { bitDepth: 24, normalize: true });
    const blobUrl = URL.createObjectURL(wavBlob);

    samples.push({
      id: 's-808-darkmatter',
      name: '808_Sub_DarkMatter_F1',
      originalFileName: '808_Sub_DarkMatter_F1.wav',
      format: 'wav',
      size: wavBlob.size,
      duration,
      sampleRate,
      bitDepth: 24,
      channels: 1,
      key: 'F min',
      pitchHz: 43.7,
      type: '808',
      category: 'one-shot',
      isLoop: false,
      genre: 'Trap / Drill',
      tags: ['sub', '808', 'trap', 'heavy', 'saturated'],
      folderId: 'f-bass',
      folderPath: '/808 & Sub Bass',
      favorite: true,
      rating: 5,
      spectralCentroid: 240,
      dynamicRangeDb: metrics.dynamicRangeDb,
      peakDb: metrics.peakDb,
      rmsDb: metrics.rmsDb,
      lufs: metrics.lufs,
      loudnessGainDb: metrics.loudnessGainDb,
      zeroCrossingRate: metrics.zeroCrossingRate,
      slices: [{ id: 'sl-1', index: 1, startSec: 0, endSec: duration, label: 'Hit 1', color: '#8b5cf6' }],
      blobUrl,
      audioBuffer: buffer,
      dateAdded: Date.now() - 1000 * 60 * 20,
      ep133Slot: 401,
    });
  }

  // 3. Punchy Kick Apex 909
  {
    const duration = 0.45;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, numSamples, sampleRate);
    const ch = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const pitch = 170 * Math.exp(-t * 40) + 52;
      const amp = Math.exp(-progress * 8.5);
      const click = i < 80 ? (1 - i / 80) * 0.4 : 0;
      ch[i] = (Math.sin(2 * Math.PI * pitch * t) * 0.85 + click) * amp;
    }

    const metrics = calculateAudioMetrics(buffer);
    const wavBlob = audioBufferToWavBlob(buffer, { bitDepth: 24, normalize: true });
    const blobUrl = URL.createObjectURL(wavBlob);

    samples.push({
      id: 's-kick-apex',
      name: 'Kick_Apex_Punch_G1',
      originalFileName: 'Kick_Apex_Punch_G1.wav',
      format: 'wav',
      size: wavBlob.size,
      duration,
      sampleRate,
      bitDepth: 24,
      channels: 1,
      key: 'G',
      pitchHz: 49.0,
      type: 'kick',
      category: 'one-shot',
      isLoop: false,
      genre: 'House / EDM',
      tags: ['kick', 'punchy', '909', 'club'],
      folderId: 'f-drums',
      folderPath: '/Drum Kit 2026',
      favorite: false,
      rating: 4,
      spectralCentroid: 380,
      dynamicRangeDb: metrics.dynamicRangeDb,
      peakDb: metrics.peakDb,
      rmsDb: metrics.rmsDb,
      lufs: metrics.lufs,
      loudnessGainDb: metrics.loudnessGainDb,
      zeroCrossingRate: metrics.zeroCrossingRate,
      slices: [{ id: 'sl-1', index: 1, startSec: 0, endSec: duration, label: 'Kick', color: '#00F0FF' }],
      blobUrl,
      audioBuffer: buffer,
      dateAdded: Date.now() - 1000 * 60 * 15,
      ep133Slot: 1,
    });
  }

  // 4. Snare Laser Trap
  {
    const duration = 0.55;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(2, numSamples, sampleRate);
    const l = buffer.getChannelData(0);
    const r = buffer.getChannelData(1);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const tone = Math.sin(2 * Math.PI * 215 * t) * Math.exp(-t * 22);
      const noise = (Math.random() * 2 - 1) * Math.exp(-progress * 9);
      l[i] = (tone * 0.45 + noise * 0.65) * Math.exp(-progress * 4);
      r[i] = (tone * 0.45 + (Math.random() * 2 - 1) * Math.exp(-progress * 9) * 0.65) * Math.exp(-progress * 4);
    }

    const metrics = calculateAudioMetrics(buffer);
    const wavBlob = audioBufferToWavBlob(buffer, { bitDepth: 24, normalize: true });
    const blobUrl = URL.createObjectURL(wavBlob);

    samples.push({
      id: 's-snare-lasertrap',
      name: 'Snare_Laser_Trap_A',
      originalFileName: 'Snare_Laser_Trap_A.wav',
      format: 'wav',
      size: wavBlob.size,
      duration,
      sampleRate,
      bitDepth: 24,
      channels: 2,
      key: 'A',
      type: 'snare',
      category: 'one-shot',
      isLoop: false,
      genre: 'Trap / Drill',
      tags: ['snare', 'trap', 'crack', 'crisp'],
      folderId: 'f-drums',
      folderPath: '/Drum Kit 2026',
      favorite: true,
      rating: 4,
      spectralCentroid: 2600,
      dynamicRangeDb: metrics.dynamicRangeDb,
      peakDb: metrics.peakDb,
      rmsDb: metrics.rmsDb,
      lufs: metrics.lufs,
      loudnessGainDb: metrics.loudnessGainDb,
      zeroCrossingRate: metrics.zeroCrossingRate,
      slices: [{ id: 'sl-1', index: 1, startSec: 0, endSec: duration, label: 'Snare', color: '#f43f5e' }],
      blobUrl,
      audioBuffer: buffer,
      dateAdded: Date.now() - 1000 * 60 * 12,
      ep133Slot: 101,
    });
  }

  // 5. Hi-Hat Velvet
  {
    const duration = 0.22;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, numSamples, sampleRate);
    const ch = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const noise = (Math.random() * 2 - 1) * Math.exp(-progress * 28);
      const ring = Math.sin(2 * Math.PI * 9200 * t) * 0.25 * Math.exp(-progress * 24);
      ch[i] = (noise + ring) * 0.8;
    }

    const metrics = calculateAudioMetrics(buffer);
    const wavBlob = audioBufferToWavBlob(buffer, { bitDepth: 16, normalize: true });
    const blobUrl = URL.createObjectURL(wavBlob);

    samples.push({
      id: 's-hihat-velvet',
      name: 'HiHat_Closed_Velvet',
      originalFileName: 'HiHat_Closed_Velvet.wav',
      format: 'wav',
      size: wavBlob.size,
      duration,
      sampleRate,
      bitDepth: 16,
      channels: 1,
      type: 'hihat',
      category: 'one-shot',
      isLoop: false,
      genre: 'Hip-Hop / BoomBap',
      tags: ['hihat', 'closed', 'tight', 'acoustic'],
      folderId: 'f-drums',
      folderPath: '/Drum Kit 2026',
      favorite: false,
      rating: 3,
      spectralCentroid: 7800,
      dynamicRangeDb: metrics.dynamicRangeDb,
      peakDb: metrics.peakDb,
      rmsDb: metrics.rmsDb,
      lufs: metrics.lufs,
      loudnessGainDb: metrics.loudnessGainDb,
      zeroCrossingRate: metrics.zeroCrossingRate,
      slices: [{ id: 'sl-1', index: 1, startSec: 0, endSec: duration, label: 'HiHat', color: '#eab308' }],
      blobUrl,
      audioBuffer: buffer,
      dateAdded: Date.now() - 1000 * 60 * 10,
      ep133Slot: 201,
    });
  }

  // 6. Melodic Neo-Soul Rhodes Chord Loop (120 BPM, Ab Maj, 2 Bars)
  {
    const duration = 4.0;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(2, numSamples, sampleRate);
    const l = buffer.getChannelData(0);
    const r = buffer.getChannelData(1);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const isSecondChord = t >= 2.0;
      const chordTime = isSecondChord ? t - 2.0 : t;
      const chordEnv = Math.exp(-chordTime * 0.95);

      const f1 = isSecondChord ? 277.18 : 207.65;
      const f2 = isSecondChord ? 349.23 : 261.63;
      const f3 = isSecondChord ? 415.30 : 311.13;
      const f4 = isSecondChord ? 523.25 : 392.00;

      const tremL = 1.0 + 0.15 * Math.sin(2 * Math.PI * 4.5 * t);
      const tremR = 1.0 + 0.15 * Math.cos(2 * Math.PI * 4.5 * t);

      const s = (Math.sin(2 * Math.PI * f1 * t) * 0.4 +
        Math.sin(2 * Math.PI * f2 * t) * 0.3 +
        Math.sin(2 * Math.PI * f3 * t) * 0.25 +
        Math.sin(2 * Math.PI * f4 * t) * 0.2) * chordEnv * 0.65;

      l[i] = s * tremL;
      r[i] = s * tremR;
    }

    const metrics = calculateAudioMetrics(buffer);
    const wavBlob = audioBufferToWavBlob(buffer, { bitDepth: 24, normalize: true });
    const blobUrl = URL.createObjectURL(wavBlob);

    samples.push({
      id: 's-rhodes-abmaj',
      name: 'Neo_Soul_Rhodes_AbMaj_120BPM_2Bars',
      originalFileName: 'Neo_Soul_Rhodes_AbMaj_120BPM_2Bars.wav',
      format: 'wav',
      size: wavBlob.size,
      duration,
      sampleRate,
      bitDepth: 24,
      channels: 2,
      bpm: 120,
      key: 'G# maj',
      type: 'loop',
      category: 'loop',
      isLoop: true,
      loopBars: 2,
      genre: 'Lo-Fi / Chillhop',
      tags: ['loop', 'rhodes', 'neo-soul', 'chords', 'melodic'],
      folderId: 'f-melodic',
      folderPath: '/Melodic & Loops',
      favorite: true,
      rating: 5,
      spectralCentroid: 1450,
      dynamicRangeDb: metrics.dynamicRangeDb,
      peakDb: metrics.peakDb,
      rmsDb: metrics.rmsDb,
      lufs: metrics.lufs,
      loudnessGainDb: metrics.loudnessGainDb,
      zeroCrossingRate: metrics.zeroCrossingRate,
      slices: [
        { id: 'sl-1', index: 1, startSec: 0, endSec: 2.0, label: 'Chord 1 (AbMaj7)', color: '#ec4899' },
        { id: 'sl-2', index: 2, startSec: 2.0, endSec: 4.0, label: 'Chord 2 (DbMaj7)', color: '#8b5cf6' },
      ],
      blobUrl,
      audioBuffer: buffer,
      dateAdded: Date.now() - 1000 * 60 * 8,
      ep133Slot: 902,
    });
  }

  // 7. Cyberpunk Transition Riser FX
  {
    const duration = 3.5;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(2, numSamples, sampleRate);
    const l = buffer.getChannelData(0);
    const r = buffer.getChannelData(1);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const freq = 120 * Math.exp(progress * 3.8);
      const amp = Math.pow(progress, 1.8) * 0.75;
      const pan = Math.sin(2 * Math.PI * 3.0 * progress);

      const tone = Math.sin(2 * Math.PI * freq * t);
      const whiteNoise = (Math.random() * 2 - 1) * 0.4 * progress;

      const sig = (tone * 0.7 + whiteNoise) * amp;
      l[i] = sig * (0.5 - pan * 0.4);
      r[i] = sig * (0.5 + pan * 0.4);
    }

    const metrics = calculateAudioMetrics(buffer);
    const wavBlob = audioBufferToWavBlob(buffer, { bitDepth: 24, normalize: true });
    const blobUrl = URL.createObjectURL(wavBlob);

    samples.push({
      id: 's-fx-riser-cyber',
      name: 'Cyber_Riser_Sweep_FX',
      originalFileName: 'Cyber_Riser_Sweep_FX.wav',
      format: 'wav',
      size: wavBlob.size,
      duration,
      sampleRate,
      bitDepth: 24,
      channels: 2,
      type: 'fx',
      category: 'one-shot',
      isLoop: false,
      genre: 'Synthwave / Retro',
      tags: ['fx', 'riser', 'transition', 'build-up', 'cyber'],
      folderId: 'f-os-fx',
      folderPath: '/01_ONE_SHOTS/05_FX_Transitions',
      favorite: false,
      rating: 4,
      spectralCentroid: 4200,
      dynamicRangeDb: metrics.dynamicRangeDb,
      peakDb: metrics.peakDb,
      rmsDb: metrics.rmsDb,
      lufs: metrics.lufs,
      loudnessGainDb: metrics.loudnessGainDb,
      zeroCrossingRate: metrics.zeroCrossingRate,
      slices: [{ id: 'sl-1', index: 1, startSec: 0, endSec: duration, label: 'Sweep Riser', color: '#eab308' }],
      blobUrl,
      audioBuffer: buffer,
      dateAdded: Date.now() - 1000 * 60 * 5,
      ep133Slot: 801,
    });
  }

  // Ensure all starter samples are perfectly organized in the Pro Folders
  return samples.map((s) => {
    const { folderPath, folderId, category } = classifySampleToProFolder(s);
    return {
      ...s,
      folderPath,
      folderId,
      category,
      isLoop: category === 'loop',
    };
  });
}
