#!/usr/bin/env bash
# Compile Plaits to WebAssembly. See tools/Build-NativeEngines.ps1 for what is
# taken from the firmware and why; this is the same build, callable from a
# POSIX shell where emcc's stderr is not mangled into a PowerShell error.
set -euo pipefail

VENDOR="${VENDOR:-C:/Users/azoth/resonance/vendor/mutable-eurorack}"
OUT_DIR="public/engines/mutable-plaits"
EMSDK_ROOT="${EMSDK_ROOT:-/c/Users/azoth/AppData/Local/emsdk}"

# emcc is a Python program. Windows puts a Store stub called `python` on PATH
# that opens the Microsoft Store instead of running anything, so emsdk's own
# interpreter has to come first and be named explicitly.
EMSDK_PY_DIR=$(dirname "$(find "$EMSDK_ROOT/python" -name 'python.exe' -print -quit)")
export EMSDK_PYTHON="$EMSDK_PY_DIR/python.exe"
export EMSDK="$EMSDK_ROOT"
export EM_CONFIG="$EMSDK_ROOT/.emscripten"
export PATH="$EMSDK_PY_DIR:$EMSDK_ROOT/upstream/emscripten:$EMSDK_ROOT:$PATH"

if [ ! -d "$VENDOR/plaits" ]; then
  echo "Sources Plaits absentes : $VENDOR/plaits" >&2
  exit 1
fi
if [ -z "$(find "$VENDOR/stmlib" -name '*.h' -print -quit 2>/dev/null)" ]; then
  echo "stmlib vide (sous-module non initialisé) : git clone https://github.com/pichenettes/stmlib.git '$VENDOR/stmlib'" >&2
  exit 1
fi

# The synthesis only: plaits.cc, settings.cc, ui.cc and user_data_receiver.cc
# drive the STM32 and would not link.
SOURCES=$(find "$VENDOR/plaits/dsp" -name '*.cc' -not -path '*/test/*')
SOURCES="$SOURCES
$VENDOR/plaits/resources.cc
$VENDOR/stmlib/dsp/atan.cc
$VENDOR/stmlib/dsp/units.cc
$VENDOR/stmlib/utils/random.cc
tools/engines/plaits_bridge.cc"

echo "$(echo "$SOURCES" | wc -l) fichiers source"
mkdir -p "$OUT_DIR"

EXPORTS="['_plaits_init','_plaits_set_patch','_plaits_set_trigger','_plaits_set_level','_plaits_render','_plaits_active_engine','_plaits_sample_rate','_malloc','_free']"

# -DTEST is stmlib's own switch away from the Cortex-M4 inline assembly it
# uses on the chip (ssat, usat, vsqrt.f32) to the portable C kept beside it.
# Without it those ARM intrinsics reach clang and nothing compiles.
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
  -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPF32']" \
  -o "$OUT_DIR/plaits.js" \
  $SOURCES

ls -la "$OUT_DIR"
