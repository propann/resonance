// Clouds, as a WASM effect for Resonance.
//
// Unlike Plaits and Rings, Clouds makes no sound of its own: it is a texture
// synthesiser that takes audio in and gives audio back — granular clouds,
// time-stretching, a looping delay, spectral smear. That is what makes it the
// interesting one for a sample library: any sound already on the wave can be
// fed through it.
//
// Clouds runs at 32 kHz on the hardware and the compiled DSP keeps that rate.
// The JS bridge resamples around it, so a 48 kHz sample comes back at 48 kHz
// rather than a fifth too slow.
//
// Upstream: pichenettes/eurorack @ 08460a69, see vendor/README.md.
#include <emscripten.h>
#include <cstring>

#include "clouds/dsp/granular_processor.h"

namespace {

// The firmware's own two buffers: the large one holds the audio Clouds grains
// from, the small one its working state.
/**
 * How many `Prepare` cycles run per audio block, matching what the module's
 * main loop manages between interrupts. Stretch mode needs them; the others
 * are indifferent, and the cost offline is nothing.
 */
constexpr int kPreparePerBlock = 16;

constexpr size_t kLargeBufferSize = 118784;
constexpr size_t kSmallBufferSize = 65536 - 128;
uint8_t large_buffer[kLargeBufferSize];
uint8_t small_buffer[kSmallBufferSize];

clouds::GranularProcessor processor;
bool initialised = false;

clouds::ShortFrame in_block[clouds::kMaxBlockSize];
clouds::ShortFrame out_block[clouds::kMaxBlockSize];

/** Clouds speaks signed 16-bit; the app speaks floats. */
inline short toShort(float x) {
  const float clamped = x < -1.0f ? -1.0f : (x > 1.0f ? 1.0f : x);
  return static_cast<short>(clamped * 32767.0f);
}

}  // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE void clouds_init() {
  std::memset(large_buffer, 0, kLargeBufferSize);
  std::memset(small_buffer, 0, kSmallBufferSize);
  processor.Init(large_buffer, kLargeBufferSize, small_buffer, kSmallBufferSize);
  processor.set_playback_mode(clouds::PLAYBACK_MODE_GRANULAR);
  processor.set_quality(0);

  clouds::Parameters* p = processor.mutable_parameters();
  p->position = 0.5f;
  p->size = 0.5f;
  p->pitch = 0.0f;
  p->density = 0.5f;
  p->texture = 0.5f;
  p->dry_wet = 0.75f;
  p->stereo_spread = 0.5f;
  p->feedback = 0.0f;
  p->reverb = 0.0f;
  p->freeze = false;
  p->trigger = false;
  p->gate = false;
  initialised = true;
}

/**
 * 0 granular, 1 stretch, 2 looping delay, 3 spectral.
 *
 * Changing mode makes Clouds re-carve its buffers, and it does that work
 * inside `Prepare` — spread over several calls, because on the module Prepare
 * runs in the main loop between audio interrupts. Called once and then asked
 * to process, the stretch and spectral modes hand back silence. So the mode
 * change is followed by enough Prepare cycles for the reallocation to finish.
 */
EMSCRIPTEN_KEEPALIVE void clouds_set_mode(int mode) {
  if (mode < 0) mode = 0;
  if (mode >= clouds::PLAYBACK_MODE_LAST) mode = clouds::PLAYBACK_MODE_LAST - 1;
  processor.set_playback_mode(static_cast<clouds::PlaybackMode>(mode));
  for (int i = 0; i < 64; ++i) processor.Prepare();
}

/**
 * The eight knobs. All 0..1 except `pitch`, which is in semitones and runs
 * roughly -48..48 the way the module's V/oct input does.
 */
EMSCRIPTEN_KEEPALIVE void clouds_set_params(
    float position,
    float size,
    float pitch,
    float density,
    float texture,
    float dry_wet,
    float stereo_spread,
    float feedback,
    float reverb) {
  clouds::Parameters* p = processor.mutable_parameters();
  p->position = position;
  p->size = size;
  p->pitch = pitch;
  p->density = density;
  p->texture = texture;
  p->dry_wet = dry_wet;
  p->stereo_spread = stereo_spread;
  p->feedback = feedback;
  p->reverb = reverb;
}

/** Freeze holds the buffer: Clouds keeps grainng what it already has. */
EMSCRIPTEN_KEEPALIVE void clouds_set_freeze(int on) {
  processor.mutable_parameters()->freeze = on != 0;
}

/**
 * Run `size` frames of stereo audio through Clouds.
 *
 * On the module `Prepare` runs in the main loop while `Process` runs from the
 * audio interrupt — the heavy work is deliberately outside the callback. There
 * is no interrupt here, so the two are simply interleaved, one Prepare per
 * block, which is the same order of work.
 */
EMSCRIPTEN_KEEPALIVE void clouds_process(
    const float* in_left,
    const float* in_right,
    float* out_left,
    float* out_right,
    int size) {
  if (!initialised) clouds_init();
  int done = 0;
  while (done < size) {
    const int block = (size - done) < static_cast<int>(clouds::kMaxBlockSize)
                          ? (size - done)
                          : static_cast<int>(clouds::kMaxBlockSize);
    for (int i = 0; i < block; ++i) {
      in_block[i].l = toShort(in_left[done + i]);
      in_block[i].r = toShort(in_right[done + i]);
    }
    // On the module `Prepare` runs in a tight main loop while `Process` is
    // driven by the audio interrupt — so it runs many times per block, not
    // once. That ratio matters: in stretch mode Prepare calls
    // `correlator_.EvaluateSomeCandidates()`, which walks the WSOLA splice
    // candidates a few at a time. Called once per block it never finds enough,
    // the player has nowhere to splice, and the mode returns silence. Here the
    // interrupt does not exist, so the ratio is restored by hand.
    for (int p = 0; p < kPreparePerBlock; ++p) processor.Prepare();
    processor.Process(in_block, out_block, static_cast<size_t>(block));
    for (int i = 0; i < block; ++i) {
      out_left[done + i] = static_cast<float>(out_block[i].l) / 32768.0f;
      out_right[done + i] = static_cast<float>(out_block[i].r) / 32768.0f;
    }
    done += block;
  }
}

/** Clouds' native rate. The caller resamples around it. */
EMSCRIPTEN_KEEPALIVE float clouds_sample_rate() { return 32000.0f; }

}  // extern "C"
