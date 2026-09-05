#!/usr/bin/env bash
# Compile one vendored Mutable Instruments engine to WebAssembly.
#
#   tools/build-engine.sh plaits
#   tools/build-engine.sh rings
#
# Only the DSP is taken. The drivers, bootloader, front panel and settings talk
# to an STM32 and would not link; they are excluded by name below.
#
# Three things the sources need before they will build off-target, all of them
# non-obvious and all of them handled here:
#   -DTEST          stmlib keeps portable C beside its Cortex-M4 inline
#                   assembly (ssat, usat, vsqrt.f32) behind this switch.
#   -include cstdio plaits/user_data.h calls printf without including it —
#                   an upstream slip, worked around rather than patched.
#   stmlib present  it is a git submodule of the eurorack repository and ships
#                   empty; clone it or nothing compiles.
set -euo pipefail

ENGINE="${1:-}"
if [ -z "$ENGINE" ]; then
  echo "usage: $0 <plaits|rings|clouds>" >&2
  exit 2
fi

VENDOR="${VENDOR:-C:/Users/azoth/resonance/vendor/mutable-eurorack}"
EMSDK_ROOT="${EMSDK_ROOT:-/c/Users/azoth/AppData/Local/emsdk}"

# emcc is a Python program, and Windows puts a Store stub named `python` on
# PATH that opens the Microsoft Store instead of running anything. emsdk's own
# interpreter has to come first.
EMSDK_PY_DIR=$(dirname "$(find "$EMSDK_ROOT/python" -name 'python.exe' -print -quit)")
export EMSDK_PYTHON="$EMSDK_PY_DIR/python.exe"
export EMSDK="$EMSDK_ROOT"
export EM_CONFIG="$EMSDK_ROOT/.emscripten"
export PATH="$EMSDK_PY_DIR:$EMSDK_ROOT/upstream/emscripten:$EMSDK_ROOT:$PATH"

case "$ENGINE" in
  plaits)
    OUT_ID="mutable-plaits"
    EXTRA_SOURCES="$VENDOR/plaits/resources.cc"
    EXPORTS="['_plaits_init','_plaits_set_patch','_plaits_set_trigger','_plaits_set_level','_plaits_render','_plaits_active_engine','_plaits_sample_rate','_malloc','_free']"
    ;;
  rings)
    OUT_ID="mutable-rings"
    EXTRA_SOURCES="$VENDOR/rings/resources.cc"
    EXPORTS="['_rings_init','_rings_set_model','_rings_set_polyphony','_rings_set_patch','_rings_strum','_rings_render','_rings_sample_rate','_malloc','_free']"
    ;;
  clouds)
    OUT_ID="mutable-clouds"
    EXTRA_SOURCES="$VENDOR/clouds/resources.cc"
    EXPORTS="['_clouds_init','_clouds_set_mode','_clouds_set_params','_clouds_set_freeze','_clouds_process','_clouds_sample_rate','_malloc','_free']"
    ;;
  *)
    echo "moteur inconnu : $ENGINE" >&2
    exit 2
    ;;
esac

if [ ! -d "$VENDOR/$ENGINE" ]; then
  echo "Sources absentes : $VENDOR/$ENGINE" >&2
  exit 1
fi
if [ -z "$(find "$VENDOR/stmlib" -name '*.h' -print -quit 2>/dev/null)" ]; then
  echo "stmlib vide (sous-module non initialisé) : git clone https://github.com/pichenettes/stmlib.git '$VENDOR/stmlib'" >&2
  exit 1
fi

SOURCES=$(find "$VENDOR/$ENGINE/dsp" -name '*.cc' -not -path '*/test/*')
SOURCES="$SOURCES
$EXTRA_SOURCES
$VENDOR/stmlib/dsp/atan.cc
$VENDOR/stmlib/dsp/units.cc
$VENDOR/stmlib/utils/random.cc
tools/engines/${ENGINE}_bridge.cc"

OUT_DIR="public/engines/$OUT_ID"
echo "$ENGINE : $(echo "$SOURCES" | wc -l) fichiers source -> $OUT_DIR"
mkdir -p "$OUT_DIR"

# shellcheck disable=SC2086
emcc -O3 -std=c++11 \
  -DTEST \
  -include cstdio \
  -Wno-macro-redefined \
  -I"$VENDOR" \
  -fno-exceptions -fno-rtti \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s ENVIRONMENT=web \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s SINGLE_FILE=1 \
  -s "EXPORTED_FUNCTIONS=$EXPORTS" \
  -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap']" \
  -o "$OUT_DIR/$ENGINE.js" \
  $SOURCES

ls -la "$OUT_DIR"
