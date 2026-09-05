/**
 * Elements, behind the `EngineBridge` contract in src/services/engineBridge.ts.
 *
 * A physical-modelling voice: an exciter — bow, breath or mallet — set against
 * a resonator. Three resonators, plus the alternate synthesis the firmware
 * keeps behind an easter egg, which is a fourth character worth offering
 * rather than hiding.
 *
 * Elements runs at 32 kHz, so what it renders is resampled up to whatever the
 * caller asked for. Without that every note would come back a fifth low.
 */
import createElementsModule from './elements.js';

/** Fixed in the firmware. */
const NATIVE_SAMPLE_RATE = 32000;

/** The four characters, in the order this bridge indexes them. */
export const ELEMENTS_MODELS = [
  'Modal',
  'Corde',
  'Cordes',
  'Voix ominous',
];

/**
 * How a note is struck, and what it strikes. The three exciters blend rather
 * than switch — a bowed string can also be breathed on.
 */
const PARAMS = {
  model: { min: 0, max: ELEMENTS_MODELS.length - 1, value: 0 },
  bow: { min: 0, max: 1, value: 0 },
  blow: { min: 0, max: 1, value: 0 },
  strike: { min: 0, max: 1, value: 0.8 },
  geometry: { min: 0, max: 1, value: 0.3 },
  brightness: { min: 0, max: 1, value: 0.5 },
  damping: { min: 0, max: 1, value: 0.7 },
  position: { min: 0, max: 1, value: 0.3 },
  space: { min: 0, max: 1, value: 0.3 },
  strength: { min: 0, max: 1, value: 0.7 },
};

/**
 * The knobs, as the interface should show them. The three exciters blend
 * rather than switch: a bowed string can be breathed on at the same time.
 *
 * Seven of the eight change the sound on every model. `position` is the
 * exception: measured across the full range it moves nothing on Modal, Corde
 * or Cordes, and only bites on the ominous voice (0.114 to 0.139 RMS). It is
 * kept rather than hidden — a control that matters on one model out of four is
 * how the hardware behaves too — but it is not a control to reach for first.
 */
export const ELEMENTS_PARAM_SPECS = [
  { key: 'strike', label: 'Frappe', min: 0, max: 1, step: 0.01, value: 0.8 },
  { key: 'bow', label: 'Archet', min: 0, max: 1, step: 0.01, value: 0 },
  { key: 'blow', label: 'Souffle', min: 0, max: 1, step: 0.01, value: 0 },
  { key: 'geometry', label: 'Géométrie', min: 0, max: 1, step: 0.01, value: 0.3 },
  { key: 'brightness', label: 'Brillance', min: 0, max: 1, step: 0.01, value: 0.5 },
  { key: 'damping', label: 'Amortissement', min: 0, max: 1, step: 0.01, value: 0.7 },
  { key: 'position', label: 'Position', min: 0, max: 1, step: 0.01, value: 0.3 },
  { key: 'space', label: 'Espace', min: 0, max: 1, step: 0.01, value: 0.3 },
];

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

class ElementsBridge {
  constructor() {
    this.id = 'mutable-elements';
    this.version = '1.0.0';
    this.models = ELEMENTS_MODELS;
    this.paramSpecs = ELEMENTS_PARAM_SPECS;
    this.module = null;
    this.params = Object.fromEntries(
      Object.entries(PARAMS).map(([key, spec]) => [key, spec.value])
    );
    this.note = 48;
  }

  async load() {
    if (this.module) return;
    this.module = await createElementsModule();
    this.module._elements_init();
    this._push();
  }

  _push() {
    if (!this.module) return;
    this.module._elements_set_model(Math.round(this.params.model));
    this.module._elements_set_exciter(this.params.bow, this.params.blow, this.params.strike);
    this.module._elements_set_resonator(
      this.params.geometry,
      this.params.brightness,
      this.params.damping,
      this.params.position,
      this.params.space
    );
    this.module._elements_set_note(this.note, this.params.strength);
  }

  setParameter(name, value) {
    const spec = PARAMS[name];
    if (!spec) return;
    this.params[name] = clamp(value, spec.min, spec.max);
    this._push();
  }

  noteOn(note, velocity = 100) {
    this.note = note;
    this.params.strength = clamp(velocity / 127, 0, 1);
    this._push();
    // Elements sustains while the gate is held, like a bow on a string.
    if (this.module) this.module._elements_set_gate(1);
  }

  noteOff() {
    if (this.module) this.module._elements_set_gate(0);
  }

  /**
   * Render `durationSeconds`. `main` and `aux` are the module's two outputs,
   * given as left and right.
   *
   * The gate is dropped a third of the way in so the note is struck and then
   * allowed to ring, rather than being held for the whole take — which on a
   * bowed model would be one long unbroken tone.
   */
  async render(durationSeconds, sampleRate = 48000) {
    if (!this.module) await this.load();
    const frames = Math.max(1, Math.round(durationSeconds * NATIVE_SAMPLE_RATE));
    const gateFrames = Math.floor(frames / 3);
    const bytes = frames * 4;

    const outPtr = this.module._malloc(bytes);
    const auxPtr = this.module._malloc(bytes);
    try {
      this.module._elements_set_gate(1);
      this.module._elements_render(outPtr, auxPtr, gateFrames);
      this.module._elements_set_gate(0);
      // Continue into the same buffers, past where the first part stopped.
      this.module._elements_render(outPtr + gateFrames * 4, auxPtr + gateFrames * 4, frames - gateFrames);

      const heap = this.module.HEAPF32;
      const out = heap.slice(outPtr >> 2, (outPtr >> 2) + frames);
      const aux = heap.slice(auxPtr >> 2, (auxPtr >> 2) + frames);

      const ctx = new OfflineCtx(2, frames, NATIVE_SAMPLE_RATE);
      const buffer = ctx.createBuffer(2, frames, NATIVE_SAMPLE_RATE);
      buffer.copyToChannel(out, 0);
      buffer.copyToChannel(aux, 1);
      return resample(buffer, sampleRate);
    } finally {
      this.module._free(outPtr);
      this.module._free(auxPtr);
    }
  }

  dispose() {
    if (this.module) {
      try {
        this.module._elements_set_gate(0);
      } catch {
        /* the module may already be gone */
      }
    }
    this.module = null;
  }
}

export async function createEngineBridge() {
  const bridge = new ElementsBridge();
  await bridge.load();
  return bridge;
}
