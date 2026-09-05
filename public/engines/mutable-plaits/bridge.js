/**
 * Plaits, behind the `EngineBridge` contract in src/services/engineBridge.ts.
 *
 * `plaits.js` beside this file is the compiled firmware — Mutable Instruments'
 * synthesis, built from vendor/mutable-eurorack by tools/build-plaits.sh. This
 * file is the shape the application asks for: notes in, a rendered buffer out.
 *
 * Plaits runs at 48 kHz on the chip and the compiled code keeps that rate.
 * Rendering at any other rate stretches it, so `render` reports what it
 * actually produced and lets the caller resample if it must.
 */
import createPlaitsModule from './plaits.js';

/** Plaits' native rate, fixed in its firmware. */
const NATIVE_SAMPLE_RATE = 48000;

/**
 * The sixteen models, in the order the firmware indexes them. Names follow the
 * manual rather than the source, which is what a musician will recognise.
 */
export const PLAITS_MODELS = [
  'Paire d’oscillateurs',
  'Formes d’onde',
  'FM 2 opérateurs',
  'Grain',
  'Additif',
  'Wavetable',
  'Accords',
  'Voix parlée',
  'Granulaire (nuage)',
  'Bruit filtré',
  'Nuage de particules',
  'Corde pincée',
  'Résonateur modal',
  'Grosse caisse analogique',
  'Caisse claire analogique',
  'Charleston analogique',
];

/**
 * Parameters the application can move, mapped onto Plaits' own controls.
 * `engine` is the model index; the rest are Plaits' 0..1 knobs, save `note`
 * which is in MIDI semitones.
 */
const PARAMS = {
  engine: { min: 0, max: PLAITS_MODELS.length - 1, value: 0 },
  harmonics: { min: 0, max: 1, value: 0.5 },
  timbre: { min: 0, max: 1, value: 0.5 },
  morph: { min: 0, max: 1, value: 0.5 },
  decay: { min: 0, max: 1, value: 0.5 },
  lpgColour: { min: 0, max: 1, value: 0.5 },
};

/**
 * The knobs, as the interface should show them. Picking a model is only half
 * of Plaits: all sixteen run through the same three controls, and without them
 * the engine offers sixteen fixed sounds instead of sixteen instruments.
 */
export const PLAITS_PARAM_SPECS = [
  { key: 'harmonics', label: 'Harmoniques', min: 0, max: 1, step: 0.01, value: 0.5 },
  { key: 'timbre', label: 'Timbre', min: 0, max: 1, step: 0.01, value: 0.5 },
  { key: 'morph', label: 'Morph', min: 0, max: 1, step: 0.01, value: 0.5 },
  { key: 'decay', label: 'Décroissance', min: 0, max: 1, step: 0.01, value: 0.5 },
  { key: 'lpgColour', label: 'Couleur LPG', min: 0, max: 1, step: 0.01, value: 0.5 },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

class PlaitsBridge {
  constructor() {
    this.id = 'mutable-plaits';
    this.version = '1.0.0';
    this.models = PLAITS_MODELS;
    this.paramSpecs = PLAITS_PARAM_SPECS;
    this.module = null;
    this.params = Object.fromEntries(
      Object.entries(PARAMS).map(([key, spec]) => [key, spec.value])
    );
    /** MIDI note currently held; Plaits is monophonic per instance. */
    this.note = 48;
    this.held = false;
  }

  async load() {
    if (this.module) return;
    this.module = await createPlaitsModule();
    this.module._plaits_init();
    this._pushPatch();
  }

  _pushPatch() {
    if (!this.module) return;
    this.module._plaits_set_patch(
      Math.round(this.params.engine),
      this.note,
      this.params.harmonics,
      this.params.timbre,
      this.params.morph,
      this.params.decay,
      this.params.lpgColour
    );
  }

  setParameter(name, value) {
    const spec = PARAMS[name];
    if (!spec) return;
    this.params[name] = clamp(value, spec.min, spec.max);
    this._pushPatch();
  }

  noteOn(note, velocity = 100) {
    this.note = note;
    this.held = true;
    this._pushPatch();
    if (!this.module) return;
    this.module._plaits_set_level(clamp(velocity / 127, 0, 1));
    // Plaits reads the trigger as an edge: raise it, and the next render
    // strikes the voice. `render` lowers it again.
    this.module._plaits_set_trigger(1);
  }

  noteOff() {
    this.held = false;
    if (!this.module) return;
    this.module._plaits_set_level(0);
    this.module._plaits_set_trigger(0);
  }

  /**
   * Render `durationSeconds` into an AudioBuffer.
   *
   * Two channels come back: Plaits' main output and its aux, which on most
   * models is a second voice of the same sound. They are given as left and
   * right, which is how the module is normally patched into a mixer.
   */
  async render(durationSeconds, sampleRate = NATIVE_SAMPLE_RATE) {
    if (!this.module) await this.load();
    const frames = Math.max(1, Math.round(durationSeconds * NATIVE_SAMPLE_RATE));
    const bytes = frames * 4;

    const outPtr = this.module._malloc(bytes);
    const auxPtr = this.module._malloc(bytes);
    try {
      this.module._plaits_render(outPtr, auxPtr, frames);
      // Lower the trigger once the strike has been rendered, so the next
      // render does not re-strike the same note.
      this.module._plaits_set_trigger(0);

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
      // The caller asked for `sampleRate`; say plainly what came out instead
      // of pretending, so it can resample knowingly.
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
        this.module._plaits_set_level(0);
        this.module._plaits_set_trigger(0);
      } catch {
        /* the module may already be gone */
      }
    }
    this.module = null;
    this.held = false;
  }
}

export async function createEngineBridge() {
  const bridge = new PlaitsBridge();
  await bridge.load();
  return bridge;
}
