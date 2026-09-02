/**
 * Owns the single realtime AudioContext for the whole app and a shared master
 * bus. Every audible subsystem (sample preview, synth rack, FX audition, Tone)
 * connects to `getMasterInput()` instead of `ctx.destination`, so there is one
 * clock, one metering point and one anti-clip limiter.
 *
 * Offline renders (sample bounce, patch export) still create their own
 * OfflineAudioContext — that is correct and unrelated to this graph.
 */

type AudioContextCtor = typeof AudioContext;

function resolveAudioContextCtor(): AudioContextCtor {
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  const ctor = w.AudioContext || w.webkitAudioContext;
  if (!ctor) throw new Error("Web Audio API indisponible dans cet environnement.");
  return ctor;
}

class AudioGraphService {
  private ctx: AudioContext | null = null;
  private masterInput: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  /** The one realtime AudioContext. Created on first access, resumed if suspended. */
  getContext(): AudioContext {
    if (!this.ctx) {
      const Ctor = resolveAudioContextCtor();
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.buildMasterBus(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** Connect anything audible here rather than to `ctx.destination`. */
  getMasterInput(): AudioNode {
    this.getContext();
    return this.masterInput as GainNode;
  }

  /** Post-limiter analyser, for a master level meter. */
  getMasterAnalyser(): AnalyserNode {
    this.getContext();
    return this.analyser as AnalyserNode;
  }

  getMasterVolume(): number {
    return this.masterInput?.gain.value ?? 1;
  }

  setMasterVolume(value: number): void {
    const ctx = this.getContext();
    const clamped = Math.max(0, Math.min(1.5, value));
    this.masterInput?.gain.setValueAtTime(clamped, ctx.currentTime);
  }

  private buildMasterBus(ctx: AudioContext): void {
    this.masterInput = ctx.createGain();
    this.masterInput.gain.value = 1;

    // Transparent below -1 dBFS, soft brickwall on peaks — protects the ears and
    // the output when layers stack up. Never touches exported/offline buffers.
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.25;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterInput.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }
}

export const audioGraph = new AudioGraphService();
