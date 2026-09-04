// Rings, as a WASM engine for Resonance.
//
// Mutable Instruments' Rings is a resonator: something strikes it and it rings.
// On the module that something is usually a patched audio input, but Rings
// carries its own exciter for when nothing is patched, and that is what this
// bridge uses — a note in, a struck string out, no cable required.
//
// Six resonator models, up to four voices. Same shape as the Plaits bridge
// beside it: only the DSP is taken, the STM32 half is left where it belongs.
//
// Upstream: pichenettes/eurorack @ 08460a69, see vendor/README.md.
#include <emscripten.h>
#include <cstring>

#include "rings/dsp/part.h"
#include "rings/dsp/patch.h"
#include "rings/dsp/performance_state.h"
#include "rings/dsp/string_synth_part.h"

namespace {

// Rings' reverb lives in this buffer. The firmware gives it 32768 uint16 in
// tightly-coupled memory; there is no such distinction here, so it is plain
// static storage of the same size.
uint16_t reverb_buffer[32768];

rings::Part part;
rings::Patch patch;
rings::PerformanceState performance_state;
bool initialised = false;

// Rings renders at most kMaxBlockSize frames per call.
float out_block[rings::kMaxBlockSize];
float aux_block[rings::kMaxBlockSize];
// Silence to hand it when nothing is exciting it from outside.
float in_block[rings::kMaxBlockSize];

}  // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE void rings_init() {
  std::memset(reverb_buffer, 0, sizeof(reverb_buffer));
  std::memset(in_block, 0, sizeof(in_block));
  part.Init(reverb_buffer);
  part.set_polyphony(1);
  part.set_model(rings::RESONATOR_MODEL_MODAL);
  part.set_bypass(false);

  std::memset(&patch, 0, sizeof(patch));
  patch.structure = 0.5f;
  patch.brightness = 0.5f;
  patch.damping = 0.5f;
  patch.position = 0.5f;

  std::memset(&performance_state, 0, sizeof(performance_state));
  // Nothing is patched into the audio input here, so Rings strikes itself and
  // takes its pitch from the note it is given rather than from a CV jack.
  performance_state.internal_exciter = true;
  performance_state.internal_strum = false;
  performance_state.internal_note = false;
  performance_state.tonic = 12.0f;
  performance_state.note = 36.0f;
  performance_state.fm = 0.0f;
  performance_state.chord = 0;
  performance_state.strum = false;
  initialised = true;
}

/** Resonator model, 0..5: modal, sympathetic string, string, FM voice, … */
EMSCRIPTEN_KEEPALIVE void rings_set_model(int model) {
  if (model < 0) model = 0;
  if (model >= rings::RESONATOR_MODEL_LAST) model = rings::RESONATOR_MODEL_LAST - 1;
  part.set_model(static_cast<rings::ResonatorModel>(model));
}

/** How many strings ring at once, 1 to 4. */
EMSCRIPTEN_KEEPALIVE void rings_set_polyphony(int voices) {
  if (voices < 1) voices = 1;
  if (voices > rings::kMaxPolyphony) voices = rings::kMaxPolyphony;
  part.set_polyphony(voices);
}

/** The four knobs, all 0..1, plus the note in semitones. */
EMSCRIPTEN_KEEPALIVE void rings_set_patch(
    float structure,
    float brightness,
    float damping,
    float position,
    float note,
    int chord) {
  patch.structure = structure;
  patch.brightness = brightness;
  patch.damping = damping;
  patch.position = position;
  performance_state.note = note;
  performance_state.chord = chord;
}

/**
 * Strike the resonator. Rings reads `strum` as an edge, so this is raised for
 * one render and lowered after — the same shape as Plaits' trigger.
 */
EMSCRIPTEN_KEEPALIVE void rings_strum(int on) {
  performance_state.strum = on != 0;
}

/**
 * Render `size` frames into two float buffers. `out` is the odd harmonics
 * output and `aux` the even one; together they are the module's two jacks.
 */
EMSCRIPTEN_KEEPALIVE void rings_render(float* out, float* aux, int size) {
  if (!initialised) rings_init();
  int done = 0;
  while (done < size) {
    const int block = (size - done) < static_cast<int>(rings::kMaxBlockSize)
                          ? (size - done)
                          : static_cast<int>(rings::kMaxBlockSize);
    part.Process(performance_state, patch, in_block, out_block, aux_block,
                 static_cast<size_t>(block));
    // The strum is an edge: one block after the strike, it is spent.
    performance_state.strum = false;
    for (int i = 0; i < block; ++i) {
      out[done + i] = out_block[i];
      aux[done + i] = aux_block[i];
    }
    done += block;
  }
}

EMSCRIPTEN_KEEPALIVE float rings_sample_rate() { return rings::kSampleRate; }

}  // extern "C"
