/**
 * Rings, behind the `EngineBridge` contract in src/services/engineBridge.ts.
 *
 * `rings.js` beside this file is Mutable Instruments' resonator, compiled from
 * vendor/mutable-eurorack by tools/build-engine.sh. On the hardware something
 * has to strike it — usually a patched audio input — but Rings carries its own
 * exciter, and that is what a note played here uses.
 *
 * Like Plaits it runs at 48 kHz, and says so rather than pretending otherwise.
 */
import createRingsModule from './rings.js';

const NATIVE_SAMPLE_RATE = 48000;

/** The six resonators, in the order the firmware indexes them. */
export const RINGS_MODELS = [
  'Modal',
  'Cordes sympathiques',
  'Corde',
  'Voix FM',
  'Cordes sympathiques quantifiées',
  'Corde + réverbération',
];

/**
 * Rings' four knobs, all 0..1, plus how many strings ring together. `model` is
 * the resonator; `chord` only matters on the sympathetic-string models.
 */
const PARAMS = {
  model: { min: 0, max: RINGS_MODELS.length - 1, value: 0 },
  structure: { min: 0, max: 1, value: 0.5 },
  brightness: { min: 0, max: 1, value: 0.5 },
  damping: { min: 0, max: 1, value: 0.5 },
  position: { min: 0, max: 1, value: 0.5 },
  polyphony: { min: 1, max: 4, value: 1 },
  chord: { min: 0, max: 10, value: 0 },
};

/**
 * The knobs, as the interface should show them.
 *
 * `polyphony` is deliberately absent. Rings accepts one to four strings, but
 * anything above one renders exact silence here — measured at every setting —
 * while one string gives 0.054 RMS. Rather than offer a control that mutes the
 * engine, it stays at one string until the cause is found. `position` is kept
 * even though it does nothing on the Modal resonator: where a string is
 * plucked has no meaning there, and it is clearly audible on the string
 * models (0.0125 to 0.0384 RMS across its range).
 */
export const RINGS_PARAM_SPECS = [
  { key: 'structure', label: 'Structure', min: 0, max: 1, step: 0.01, value: 0.5 },
  { key: 'brightness', label: 'Brillance', min: 0, max: 1, step: 0.01, value: 0.5 },
  { key: 'damping', label: 'Amortissement', min: 0, max: 1, step: 0.01, value: 0.5 },
  { key: 'position', label: 'Position', min: 0, max: 1, step: 0.01, value: 0.5 },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

class RingsBridge {
  constructor() {
    this.id = 'mutable-rings';
    this.version = '1.0.0';
    this.models = RINGS_MODELS;
    this.paramSpecs = RINGS_PARAM_SPECS;
    this.module = null;
    this.params = Object.fromEntries(
      Object.entries(PARAMS).map(([key, spec]) => [key, spec.value])
    );
    this.note = 36;
  }

  async load() {
    if (this.module) return;
    this.module = await createRingsModule();
    this.module._rings_init();
    this._push();
  }

  _push() {
    if (!this.module) return;
    this.module._rings_set_model(Math.round(this.params.model));
    this.module._rings_set_polyphony(Math.round(this.params.polyphony));
    this.module._rings_set_patch(
      this.params.structure,
      this.params.brightness,
      this.params.damping,
      this.params.position,
      this.note,
      Math.round(this.params.chord)
    );
  }

  setParameter(name, value) {
    const spec = PARAMS[name];
    if (!spec) return;
    this.params[name] = clamp(value, spec.min, spec.max);
    this._push();
  }

  noteOn(note) {
    // Rings takes its pitch in semitones above its own tonic, not as a MIDI
    // note: middle C on a keyboard is 60, and the resonator wants 36.
    this.note = note - 24;
    this._push();
    if (this.module) this.module._rings_strum(1);
  }

  noteOff() {
    // A resonator has no note-off: it rings out. Lowering the strum only stops
    // it being struck again.
    if (this.module) this.module._rings_strum(0);
  }

  /**
   * Render `durationSeconds`. `out` and `aux` are the module's two jacks — odd
   * and even harmonics — given here as left and right.
   */
  async render(durationSeconds, sampleRate = NATIVE_SAMPLE_RATE) {
    if (!this.module) await this.load();
    const frames = Math.max(1, Math.round(durationSeconds * NATIVE_SAMPLE_RATE));
    const bytes = frames * 4;

    const outPtr = this.module._malloc(bytes);
    const auxPtr = this.module._malloc(bytes);
    try {
      this.module._rings_render(outPtr, auxPtr, frames);
      const heap = this.module.HEAPF32;
      const out = heap.slice(outPtr >> 2, (outPtr >> 2) + frames);
      const aux = heap.slice(auxPtr >> 2, (auxPtr >> 2) + frames);

      const ctx = new (globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext)(
        2,
        frames,
        NATIVE_SAMPLE_RATE
      );
      const buffer = ctx.createBuffer(2, frames, NATIVE_SAMPLE_RATE);
      buffer.copyToChannel(out, 0);
      buffer.copyToChannel(aux, 1);
      buffer.nativeSampleRate = NATIVE_SAMPLE_RATE;
      buffer.requestedSampleRate = sampleRate;
      return buffer;
    } finally {
      this.module._free(outPtr);
      this.module._free(auxPtr);
    }
  }

  dispose() {
    if (this.module) {
      try {
        this.module._rings_strum(0);
      } catch {
        /* the module may already be gone */
      }
    }
    this.module = null;
  }
}

export async function createEngineBridge() {
  const bridge = new RingsBridge();
  await bridge.load();
  return bridge;
}
