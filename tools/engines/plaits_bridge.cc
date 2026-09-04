// Plaits, as a WASM engine for Resonance.
//
// Mutable Instruments' Plaits is firmware for an STM32: it renders into a
// 16-bit frame pair, in blocks of at most 24 samples, at 48 kHz. Everything
// around that — the drivers, the bootloader, the front panel — belongs to the
// hardware and is left out. What is kept is `plaits::Voice`, which is the
// synthesis itself: sixteen engines behind one set of parameters.
//
// This file is the thin C surface `bridge.js` calls. It owns one Voice, one
// allocator of the same 16 kB the firmware gives it, and converts the 16-bit
// output to the floats Web Audio wants.
//
// Upstream: pichenettes/eurorack @ 08460a69, see vendor/README.md for the
// licence that travels with it.
#include <emscripten.h>
#include <cstring>

#include "plaits/dsp/voice.h"
#include "stmlib/utils/buffer_allocator.h"

namespace {

// The firmware's own figure: Voice::Init carves its engines out of this.
constexpr size_t kSharedBufferSize = 16384;
char shared_buffer[kSharedBufferSize];

plaits::Voice voice;
plaits::Patch patch;
plaits::Modulations modulations;
bool initialised = false;

// Plaits renders at most kMaxBlockSize frames per call.
plaits::Voice::Frame frames[plaits::kMaxBlockSize];

}  // namespace

extern "C" {

/** Build the voice. Safe to call again; it simply starts over. */
EMSCRIPTEN_KEEPALIVE void plaits_init() {
  std::memset(shared_buffer, 0, kSharedBufferSize);
  stmlib::BufferAllocator allocator(shared_buffer, kSharedBufferSize);
  voice.Init(&allocator);

  std::memset(&patch, 0, sizeof(patch));
  std::memset(&modulations, 0, sizeof(modulations));
  patch.engine = 0;
  patch.note = 48.0f;
  patch.harmonics = 0.5f;
  patch.timbre = 0.5f;
  patch.morph = 0.5f;
  patch.decay = 0.5f;
  patch.lpg_colour = 0.5f;
  // Without a patched level input Plaits sustains rather than plucking, which
  // is what a keyboard wants: the envelope comes from the note being held.
  modulations.level = 1.0f;
  modulations.level_patched = false;
  modulations.trigger_patched = false;
  initialised = true;
}

/**
 * The whole patch in one call. Ranges are Plaits' own: `note` in MIDI
 * semitones, the three timbre controls in 0..1, `engine` selecting one of the
 * sixteen models.
 */
EMSCRIPTEN_KEEPALIVE void plaits_set_patch(
    int engine,
    float note,
    float harmonics,
    float timbre,
    float morph,
    float decay,
    float lpg_colour) {
  patch.engine = engine;
  patch.note = note;
  patch.harmonics = harmonics;
  patch.timbre = timbre;
  patch.morph = morph;
  patch.decay = decay;
  patch.lpg_colour = lpg_colour;
}

/**
 * Strike the voice. Plaits reads `trigger` as an edge, so the caller raises it
 * for one block and lowers it after — `bridge.js` does that around a note-on.
 */
EMSCRIPTEN_KEEPALIVE void plaits_set_trigger(int on) {
  modulations.trigger = on ? 1.0f : 0.0f;
  modulations.trigger_patched = true;
}

/** Level, 0..1. Dropping it to zero is how a note is released. */
EMSCRIPTEN_KEEPALIVE void plaits_set_level(float level) {
  modulations.level = level;
  modulations.level_patched = true;
}

/**
 * Render `size` frames into two float buffers, -1..1. `aux` is Plaits' second
 * output, which is a different voice of the same model on most engines.
 *
 * The voice only renders 24 frames at a time, so this walks the request in
 * blocks — the caller can ask for a whole audio quantum, or a whole second.
 */
EMSCRIPTEN_KEEPALIVE void plaits_render(float* out, float* aux, int size) {
  if (!initialised) plaits_init();
  int done = 0;
  while (done < size) {
    const int block = (size - done) < static_cast<int>(plaits::kMaxBlockSize)
                          ? (size - done)
                          : static_cast<int>(plaits::kMaxBlockSize);
    voice.Render(patch, modulations, frames, static_cast<size_t>(block));
    for (int i = 0; i < block; ++i) {
      // Plaits speaks signed 16-bit; Web Audio speaks floats.
      out[done + i] = static_cast<float>(frames[i].out) / 32768.0f;
      aux[done + i] = static_cast<float>(frames[i].aux) / 32768.0f;
    }
    done += block;
  }
}

/** The engine Plaits actually settled on, after its own smoothing. */
EMSCRIPTEN_KEEPALIVE int plaits_active_engine() { return voice.active_engine(); }

/** Plaits' native rate. Rendering at any other rate transposes it. */
EMSCRIPTEN_KEEPALIVE float plaits_sample_rate() { return plaits::kSampleRate; }

}  // extern "C"
