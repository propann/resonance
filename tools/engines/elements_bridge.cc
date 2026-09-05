// Elements, as a WASM engine for Resonance.
//
// Mutable Instruments' Elements is a physical-modelling voice: an exciter —
// a bow, a breath, a mallet — set against a resonator. On the module the
// exciters can also come from patched audio; here they are the internal ones,
// so a note is enough to make it sound.
//
// Three resonators, plus the "ominous voice" the firmware hides behind an
// easter egg, which is a fourth character rather than a joke.
//
// Elements runs at 32 kHz. The JS bridge resamples on the way out.
//
// Upstream: pichenettes/eurorack @ 08460a69, see vendor/README.md.
#include <emscripten.h>
#include <cstring>

#include "elements/dsp/part.h"

namespace {

// The firmware's own reverb buffer.
uint16_t reverb_buffer[32768];

elements::Part part;
elements::PerformanceState performance_state;
bool initialised = false;

float main_block[elements::kMaxBlockSize];
float aux_block[elements::kMaxBlockSize];
// Nothing is patched into the excitation inputs: Elements uses its own.
float silence_block[elements::kMaxBlockSize];

}  // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE void elements_init() {
  std::memset(reverb_buffer, 0, sizeof(reverb_buffer));
  std::memset(silence_block, 0, sizeof(silence_block));
  part.Init(reverb_buffer);
  part.set_resonator_model(elements::RESONATOR_MODEL_MODAL);
  part.set_easter_egg(false);

  elements::Patch* p = part.mutable_patch();
  std::memset(p, 0, sizeof(*p));
  p->exciter_envelope_shape = 0.5f;
  // A mallet by default: the most immediately recognisable of the three.
  p->exciter_bow_level = 0.0f;
  p->exciter_bow_timbre = 0.5f;
  p->exciter_blow_level = 0.0f;
  p->exciter_blow_meta = 0.5f;
  p->exciter_blow_timbre = 0.5f;
  p->exciter_strike_level = 0.8f;
  p->exciter_strike_meta = 0.5f;
  p->exciter_strike_timbre = 0.5f;
  p->exciter_signature = 0.0f;
  p->resonator_geometry = 0.3f;
  p->resonator_brightness = 0.5f;
  p->resonator_damping = 0.7f;
  p->resonator_position = 0.3f;
  p->resonator_modulation_frequency = 0.5f;
  p->resonator_modulation_offset = 0.1f;
  p->reverb_diffusion = 0.7f;
  p->reverb_lp = 0.7f;
  p->space = 0.3f;
  p->modulation_frequency = 0.5f;

  std::memset(&performance_state, 0, sizeof(performance_state));
  performance_state.gate = false;
  performance_state.note = 48.0f;
  performance_state.modulation = 0.0f;
  performance_state.strength = 0.7f;
  initialised = true;
}

/**
 * 0 modal, 1 string, 2 strings, 3 the ominous voice.
 *
 * The fourth is not a resonator but the firmware's alternate synthesis, which
 * it keeps behind `set_easter_egg`. It is a genuinely different sound, so it
 * is offered as a fourth model rather than hidden.
 */
EMSCRIPTEN_KEEPALIVE void elements_set_model(int model) {
  if (model >= 3) {
    part.set_easter_egg(true);
    return;
  }
  part.set_easter_egg(false);
  if (model < 0) model = 0;
  part.set_resonator_model(static_cast<elements::ResonatorModel>(model));
}

/** The three exciters, blended. All 0..1. */
EMSCRIPTEN_KEEPALIVE void elements_set_exciter(float bow, float blow, float strike) {
  elements::Patch* p = part.mutable_patch();
  p->exciter_bow_level = bow;
  p->exciter_blow_level = blow;
  p->exciter_strike_level = strike;
}

/** The resonator's shape. All 0..1. */
EMSCRIPTEN_KEEPALIVE void elements_set_resonator(
    float geometry,
    float brightness,
    float damping,
    float position,
    float space) {
  elements::Patch* p = part.mutable_patch();
  p->resonator_geometry = geometry;
  p->resonator_brightness = brightness;
  p->resonator_damping = damping;
  p->resonator_position = position;
  p->space = space;
}

/** Note in MIDI semitones, strength 0..1 (how hard it is played). */
EMSCRIPTEN_KEEPALIVE void elements_set_note(float note, float strength) {
  performance_state.note = note;
  performance_state.strength = strength;
}

/** Elements sustains while the gate is held, like a bowed string. */
EMSCRIPTEN_KEEPALIVE void elements_set_gate(int on) {
  performance_state.gate = on != 0;
}

/** Render `size` frames. `main` and `aux` are the module's two outputs. */
EMSCRIPTEN_KEEPALIVE void elements_render(float* out, float* aux, int size) {
  if (!initialised) elements_init();
  int done = 0;
  while (done < size) {
    const int block = (size - done) < static_cast<int>(elements::kMaxBlockSize)
                          ? (size - done)
                          : static_cast<int>(elements::kMaxBlockSize);
    part.Process(performance_state, silence_block, silence_block, main_block, aux_block,
                 static_cast<size_t>(block));
    for (int i = 0; i < block; ++i) {
      out[done + i] = main_block[i];
      aux[done + i] = aux_block[i];
    }
    done += block;
  }
}

EMSCRIPTEN_KEEPALIVE float elements_sample_rate() { return elements::kSampleRate; }

}  // extern "C"
