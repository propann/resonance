/**
 * Pro Low-Latency Web Audio Engine
 * Provides instant auditioning, pitch shift, reverse, loop slicing, filter & FFT analyzer
 */

import { audioGraph } from './audioGraph';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  sampleId: string | null;
  volume: number;
  autoLoudnessLeveling: boolean;
  pitchSemitones: number;
  pitchCents: number;
  playbackRate: number;
  isReversed: boolean;
  isLooping: boolean;
  loopStart: number;
  loopEnd: number;
  filterCutoff: number; // 20Hz - 20000Hz
  filterType: 'allpass' | 'lowpass' | 'highpass';
  stereoPan: number; // -1 to +1
}

type PlaybackListener = (state: PlaybackState) => void;
type AnalyserListener = (timeData: Uint8Array, freqData: Uint8Array) => void;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private gainNode: GainNode | null = null;
  private loudnessGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private filterNode: BiquadFilterNode | null = null;

  private startTime: number = 0;
  private pauseOffset: number = 0;
  private animationFrameId: number | null = null;

  private state: PlaybackState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    sampleId: null,
    volume: 0.9,
    autoLoudnessLeveling: true,
    pitchSemitones: 0,
    pitchCents: 0,
    playbackRate: 1.0,
    isReversed: false,
    isLooping: false,
    loopStart: 0,
    loopEnd: 0,
    filterCutoff: 20000,
    filterType: 'allpass',
    stereoPan: 0,
  };

  private stateListeners: Set<PlaybackListener> = new Set();
  private analyserListeners: Set<AnalyserListener> = new Set();

  constructor() {
    // Lazy init audio context on first user interaction
  }

  public getAudioContext(): AudioContext {
    const ctx = audioGraph.getContext();
    if (!this.ctx) {
      this.ctx = ctx;
      this.setupNodes();
    }
    return ctx;
  }

  private setupNodes() {
    if (!this.ctx) return;

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = this.state.volume;

    this.loudnessGainNode = this.ctx.createGain();
    this.loudnessGainNode.gain.value = 1.0;

    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.8;

    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'allpass';
    this.filterNode.frequency.value = this.state.filterCutoff;

    try {
      this.pannerNode = this.ctx.createStereoPanner();
      this.pannerNode.pan.value = this.state.stereoPan;
    } catch {
      this.pannerNode = null;
    }

    // Connect chain: Source -> Filter -> Panner -> LoudnessGain -> MasterGain -> Analyser -> Destination
    if (this.pannerNode) {
      this.filterNode.connect(this.pannerNode);
      this.pannerNode.connect(this.loudnessGainNode);
    } else {
      this.filterNode.connect(this.loudnessGainNode);
    }
    this.loudnessGainNode.connect(this.gainNode);
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(audioGraph.getMasterInput());
  }

  public isAutoLoudnessEnabled(): boolean {
    return this.state.autoLoudnessLeveling;
  }

  public setAutoLoudness(enabled: boolean): void {
    this.state.autoLoudnessLeveling = enabled;
    if (this.loudnessGainNode && this.ctx) {
      if (!enabled) {
        this.loudnessGainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
      }
    }
    this.notify();
  }

  public toggleAutoLoudnessLeveling(): boolean {
    this.setAutoLoudness(!this.state.autoLoudnessLeveling);
    return this.state.autoLoudnessLeveling;
  }

  public subscribe(listener: PlaybackListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  public subscribeAnalyser(listener: AnalyserListener): () => void {
    this.analyserListeners.add(listener);
    return () => this.analyserListeners.delete(listener);
  }

  private notify() {
    this.stateListeners.forEach((l) => l({ ...this.state }));
  }

  public async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.getAudioContext();
    // Use clone if needed to prevent detachment
    const copy = arrayBuffer.slice(0);
    return await ctx.decodeAudioData(copy);
  }

  /**
   * Reverse an audio buffer
   */
  public reverseBuffer(buffer: AudioBuffer): AudioBuffer {
    const ctx = this.getAudioContext();
    const newBuf = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const srcData = buffer.getChannelData(c);
      const destData = newBuf.getChannelData(c);
      for (let i = 0; i < buffer.length; i++) {
        destData[i] = srcData[buffer.length - 1 - i];
      }
    }
    return newBuf;
  }

  /**
   * Play a specific buffer or segment
   */
  public play(
    buffer: AudioBuffer,
    sampleId: string,
    options?:
      | number
      | {
          startSec?: number;
          endSec?: number;
          loop?: boolean;
          reverse?: boolean;
          loudnessGainDb?: number;
        }
  ) {
    const ctx = this.getAudioContext();
    this.stop(false);

    const opts = typeof options === 'number' ? { loudnessGainDb: options } : options;

    let activeBuffer = buffer;
    if (opts?.reverse || this.state.isReversed) {
      activeBuffer = this.reverseBuffer(buffer);
    }
    this.currentBuffer = activeBuffer;

    // Apply auto-gain leveling if enabled
    if (this.loudnessGainNode) {
      if (this.state.autoLoudnessLeveling && opts?.loudnessGainDb !== undefined) {
        const linearGain = Math.pow(10, opts.loudnessGainDb / 20);
        this.loudnessGainNode.gain.setValueAtTime(linearGain, ctx.currentTime);
      } else {
        this.loudnessGainNode.gain.setValueAtTime(1.0, ctx.currentTime);
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = activeBuffer;

    // Pitch & playback rate
    const totalPitchSemitones = this.state.pitchSemitones + this.state.pitchCents / 100;
    const pitchRatio = Math.pow(2, totalPitchSemitones / 12);
    source.playbackRate.value = this.state.playbackRate * pitchRatio;

    // Setup looping
    const startSec = opts?.startSec ?? 0;
    const endSec = opts?.endSec ?? activeBuffer.duration;
    const isLooping = opts?.loop ?? this.state.isLooping;

    if (isLooping) {
      source.loop = true;
      source.loopStart = startSec;
      source.loopEnd = endSec;
    }

    if (this.filterNode) {
      source.connect(this.filterNode);
    } else if (this.gainNode) {
      source.connect(this.gainNode);
    }

    const startOffset = Math.max(0, Math.min(startSec, activeBuffer.duration));
    const playDuration = Math.max(0.01, endSec - startOffset);

    if (isLooping) {
      source.start(0, startOffset);
    } else {
      source.start(0, startOffset, playDuration);
    }

    this.currentSource = source;
    this.startTime = ctx.currentTime - startOffset / source.playbackRate.value;
    this.pauseOffset = startOffset;

    this.state = {
      ...this.state,
      isPlaying: true,
      sampleId,
      duration: activeBuffer.duration,
      currentTime: startOffset,
      isLooping,
      loopStart: startSec,
      loopEnd: endSec,
    };
    this.notify();

    source.onended = () => {
      if (this.currentSource === source) {
        this.stop(false);
      }
    };

    this.startTracking();
  }

  public pause() {
    if (!this.state.isPlaying || !this.ctx) return;
    const elapsed = (this.ctx.currentTime - this.startTime) * this.state.playbackRate;
    this.pauseOffset = elapsed % (this.state.duration || 1);
    this.stop(false);
    this.state.currentTime = this.pauseOffset;
    this.notify();
  }

  public resume() {
    if (this.currentBuffer && this.state.sampleId) {
      this.play(this.currentBuffer, this.state.sampleId, {
        startSec: this.pauseOffset,
        endSec: this.state.loopEnd || this.state.duration,
        loop: this.state.isLooping,
        reverse: this.state.isReversed,
      });
    }
  }

  public stop(notify = true) {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // ignore already stopped
      }
      this.currentSource = null;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (notify) {
      this.state = {
        ...this.state,
        isPlaying: false,
        currentTime: 0,
      };
      this.pauseOffset = 0;
      this.notify();
    } else {
      this.state.isPlaying = false;
    }
  }

  public seek(timeSec: number) {
    this.pauseOffset = timeSec;
    if (this.state.isPlaying && this.currentBuffer && this.state.sampleId) {
      this.play(this.currentBuffer, this.state.sampleId, {
        startSec: timeSec,
        endSec: this.state.loopEnd || this.currentBuffer.duration,
        loop: this.state.isLooping,
        reverse: this.state.isReversed,
      });
    } else {
      this.state.currentTime = timeSec;
      this.notify();
    }
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1.5, vol));
    this.state.volume = clamped;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
    this.notify();
  }

  public setPitch(semitones: number, cents: number = 0) {
    this.state.pitchSemitones = semitones;
    this.state.pitchCents = cents;
    if (this.currentSource && this.ctx) {
      const totalPitchSemitones = semitones + cents / 100;
      const pitchRatio = Math.pow(2, totalPitchSemitones / 12);
      this.currentSource.playbackRate.setValueAtTime(this.state.playbackRate * pitchRatio, this.ctx.currentTime);
    }
    this.notify();
  }

  public setPlaybackRate(rate: number) {
    const clamped = Math.max(0.25, Math.min(4.0, rate));
    this.state.playbackRate = clamped;
    if (this.currentSource && this.ctx) {
      const totalPitchSemitones = this.state.pitchSemitones + this.state.pitchCents / 100;
      const pitchRatio = Math.pow(2, totalPitchSemitones / 12);
      this.currentSource.playbackRate.setValueAtTime(clamped * pitchRatio, this.ctx.currentTime);
    }
    this.notify();
  }

  public setFilter(type: 'allpass' | 'lowpass' | 'highpass', cutoff: number) {
    this.state.filterType = type;
    this.state.filterCutoff = cutoff;
    if (this.filterNode && this.ctx) {
      this.filterNode.type = type;
      this.filterNode.frequency.setValueAtTime(cutoff, this.ctx.currentTime);
    }
    this.notify();
  }

  public setPan(pan: number) {
    this.state.stereoPan = Math.max(-1, Math.min(1, pan));
    if (this.pannerNode && this.ctx) {
      this.pannerNode.pan.setValueAtTime(this.state.stereoPan, this.ctx.currentTime);
    }
    this.notify();
  }

  public toggleLoop(): boolean {
    this.state.isLooping = !this.state.isLooping;
    if (this.currentSource) {
      this.currentSource.loop = this.state.isLooping;
      if (this.state.isLooping) {
        this.currentSource.loopStart = this.state.loopStart;
        this.currentSource.loopEnd = this.state.loopEnd || (this.currentBuffer ? this.currentBuffer.duration : 0);
      }
    }
    this.notify();
    return this.state.isLooping;
  }

  public toggleReverse(): boolean {
    this.state.isReversed = !this.state.isReversed;
    if (this.state.isPlaying && this.currentBuffer && this.state.sampleId) {
      this.play(this.currentBuffer, this.state.sampleId, {
        startSec: this.state.currentTime,
        loop: this.state.isLooping,
        reverse: this.state.isReversed,
      });
    } else {
      this.notify();
    }
    return this.state.isReversed;
  }

  private startTracking() {
    const timeData = new Uint8Array(256);
    const freqData = new Uint8Array(256);

    const update = () => {
      if (!this.state.isPlaying || !this.ctx) return;

      const rate = this.state.playbackRate * Math.pow(2, (this.state.pitchSemitones + this.state.pitchCents / 100) / 12);
      let cur = (this.ctx.currentTime - this.startTime) * rate;

      if (this.state.isLooping && this.state.loopEnd > this.state.loopStart) {
        const loopLen = this.state.loopEnd - this.state.loopStart;
        if (cur > this.state.loopEnd) {
          cur = this.state.loopStart + ((cur - this.state.loopStart) % loopLen);
        }
      } else if (cur > this.state.duration) {
        cur = this.state.duration;
      }

      this.state.currentTime = cur;
      this.notify();

      if (this.analyserNode && this.analyserListeners.size > 0) {
        this.analyserNode.getByteTimeDomainData(timeData);
        this.analyserNode.getByteFrequencyData(freqData);
        this.analyserListeners.forEach((l) => l(timeData, freqData));
      }

      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  public getState(): PlaybackState {
    return { ...this.state };
  }
}

export const audioEngine = new AudioEngine();
