/**
 * Clouds, behind the `EngineBridge` contract in src/services/engineBridge.ts.
 *
 * Clouds is the odd one among the engines here: it makes no sound of its own,
 * it grains whatever it is fed. So it implements `process` rather than
 * `render`, and takes the sound already on the wave.
 *
 * It runs at 32 kHz on the hardware and the compiled DSP keeps that rate, so
 * this file resamples around it — in at whatever rate arrives, out at the
 * same. Skipping that would return a sample a fifth too slow, which sounds
 * like a feature until you try to use it.
 */
import createCloudsModule from './clouds.js';

/** Fixed in the firmware. Everything here works around it. */
const NATIVE_SAMPLE_RATE = 32000;

/**
 * What Clouds can do with a buffer, and what the firmware calls each one.
 *
 * The module has a fourth mode, time-stretch (firmware index 1). It is left
 * out because it returns silence here — measured at RMS 0.003 against 0.18 for
 * granular, and going to exactly zero on a second pass. Running extra `Prepare`
 * cycles after the mode change, which is where Clouds re-carves its buffers,
 * did not help. Better absent than present and mute; see docs/CONTINUATION.md.
 */
export const CLOUDS_MODES = ['Granulaire', 'Délai bouclé', 'Spectral'];

/** Our index -> the firmware's PlaybackMode. */
const MODE_INDEX = [0, 2, 3];

/**
 * Clouds' knobs. All 0..1 save `pitch`, which is in semitones the way the
 * module's V/oct input is.
 */
const PARAMS = {
  mode: { min: 0, max: CLOUDS_MODES.length - 1, value: 0 },
  position: { min: 0, max: 1, value: 0.5 },
  size: { min: 0, max: 1, value: 0.5 },
  pitch: { min: -48, max: 48, value: 0 },
  density: { min: 0, max: 1, value: 0.5 },
  texture: { min: 0, max: 1, value: 0.5 },
  dryWet: { min: 0, max: 1, value: 0.75 },
  stereoSpread: { min: 0, max: 1, value: 0.5 },
  feedback: { min: 0, max: 1, value: 0 },
  reverb: { min: 0, max: 1, value: 0 },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const OfflineCtx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;

/** Render a buffer through an offline context at another rate. */
async function resample(buffer, targetRate) {
  if (Math.abs(buffer.sampleRate - targetRate) < 1) return buffer;
  const frames = Math.max(1, Math.round(buffer.duration * targetRate));
  const ctx = new OfflineCtx(buffer.numberOfChannels, frames, targetRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  return ctx.startRendering();
}

class CloudsBridge {
  constructor() {
    this.id = 'mutable-clouds';
    this.version = '1.0.0';
    this.models = CLOUDS_MODES;
    this.module = null;
    this.params = Object.fromEntries(
      Object.entries(PARAMS).map(([key, spec]) => [key, spec.value])
    );
  }

  async load() {
    if (this.module) return;
    this.module = await createCloudsModule();
    this.module._clouds_init();
    this._push();
  }

  _push() {
    if (!this.module) return;
    this.module._clouds_set_mode(MODE_INDEX[Math.round(this.params.mode)] ?? 0);
    this.module._clouds_set_params(
      this.params.position,
      this.params.size,
      this.params.pitch,
      this.params.density,
      this.params.texture,
      this.params.dryWet,
      this.params.stereoSpread,
      this.params.feedback,
      this.params.reverb
    );
  }

  setParameter(name, value) {
    const spec = PARAMS[name];
    if (!spec) return;
    this.params[name] = clamp(value, spec.min, spec.max);
    this._push();
  }

  /** Clouds has no notes: it is fed audio, not played. */
  noteOn() {}
  noteOff() {}

  /**
   * Grain a buffer. What comes back is the same length and the same rate as
   * what went in, whatever Clouds runs at internally.
   */
  async process(input) {
    if (!this.module) await this.load();
    const originalRate = input.sampleRate;
    const work = await resample(input, NATIVE_SAMPLE_RATE);
    const frames = work.length;
    const bytes = frames * 4;

    const left = work.getChannelData(0);
    const right = work.numberOfChannels > 1 ? work.getChannelData(1) : left;

    const inL = this.module._malloc(bytes);
    const inR = this.module._malloc(bytes);
    const outL = this.module._malloc(bytes);
    const outR = this.module._malloc(bytes);
    try {
      const heap = this.module.HEAPF32;
      heap.set(left, inL >> 2);
      heap.set(right, inR >> 2);
      this.module._clouds_process(inL, inR, outL, outR, frames);

      const processed = new OfflineCtx(2, frames, NATIVE_SAMPLE_RATE).createBuffer(
        2,
        frames,
        NATIVE_SAMPLE_RATE
      );
      // Re-read the heap after the call: growing memory can detach the view.
      const after = this.module.HEAPF32;
      processed.copyToChannel(after.slice(outL >> 2, (outL >> 2) + frames), 0);
      processed.copyToChannel(after.slice(outR >> 2, (outR >> 2) + frames), 1);

      return resample(processed, originalRate);
    } finally {
      this.module._free(inL);
      this.module._free(inR);
      this.module._free(outL);
      this.module._free(outR);
    }
  }

  /**
   * Clouds has nothing to render on its own; it grains silence, which is
   * silence. `process` is the way in.
   */
  async render(durationSeconds, sampleRate = 48000) {
    const frames = Math.max(1, Math.round(durationSeconds * sampleRate));
    const ctx = new OfflineCtx(2, frames, sampleRate);
    return this.process(ctx.createBuffer(2, frames, sampleRate));
  }

  dispose() {
    this.module = null;
  }
}

export async function createEngineBridge() {
  const bridge = new CloudsBridge();
  await bridge.load();
  return bridge;
}
