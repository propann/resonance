<#
.SYNOPSIS
  Compiles the vendored engine firmware to WebAssembly.

.DESCRIPTION
  Mutable Instruments' Plaits is firmware for an STM32. Only its synthesis is
  taken — `plaits::Voice` and the engines behind it — and compiled to a WASM
  module exposing the C surface in tools/engines/plaits_bridge.cc. The
  hardware halves (drivers, bootloader, front panel, settings) are left out;
  they would not link and are not wanted.

  The result lands in public/engines/<id>/, which Vite copies into the build,
  and which src/services/engineBridge.ts loads on demand. The wasm is embedded
  in the JS (SINGLE_FILE) so the engine is one file to serve — Electron loads
  the app from disk, where a second fetch beside the module is awkward.

  vendor/ is gitignored, so the sources are expected under the repository root
  even when this runs from a worktree; pass -VendorRoot to point elsewhere.

.NOTES
  Needs emcc (Emscripten). stmlib is a git submodule of the eurorack
  repository: if vendor/mutable-eurorack/stmlib is empty, clone
  https://github.com/pichenettes/stmlib.git into it first — Plaits does not
  build without it.
#>
param(
  [string]$VendorRoot = 'C:\Users\azoth\resonance\vendor',
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'

Write-Host 'Resonance — compilation des moteurs natifs' -ForegroundColor Cyan

if (-not (Get-Command emcc -ErrorAction SilentlyContinue)) {
  Write-Error "emcc introuvable. Installez Emscripten (choco install emscripten) et rouvrez la console."
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$eurorack = Join-Path $VendorRoot 'mutable-eurorack'
$plaits = Join-Path $eurorack 'plaits'
$stmlib = Join-Path $eurorack 'stmlib'

if (-not (Test-Path $plaits)) { Write-Error "Sources Plaits absentes : $plaits" }
if ((Get-ChildItem $stmlib -Recurse -Filter *.h -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0) {
  Write-Error "stmlib est vide (sous-module non initialisé) : git clone https://github.com/pichenettes/stmlib.git `"$stmlib`""
}

# The synthesis only. plaits.cc, settings.cc, ui.cc and user_data_receiver.cc
# talk to the STM32 and are deliberately excluded.
$sources = @()
$sources += (Join-Path $PSScriptRoot 'engines/plaits_bridge.cc')
$sources += (Join-Path $plaits 'resources.cc')
$sources += Get-ChildItem (Join-Path $plaits 'dsp') -Recurse -Filter *.cc |
  Where-Object { $_.FullName -notmatch '\\test\\' } |
  Select-Object -ExpandProperty FullName
$sources += @(
  (Join-Path $stmlib 'dsp/atan.cc'),
  (Join-Path $stmlib 'dsp/units.cc'),
  (Join-Path $stmlib 'utils/random.cc')
) | Where-Object { Test-Path $_ }

Write-Host "  $($sources.Count) fichiers source"

$outDir = Join-Path $root 'public/engines/mutable-plaits'
$outFile = Join-Path $outDir 'plaits.js'

$exported = @(
  '_plaits_init', '_plaits_set_patch', '_plaits_set_trigger', '_plaits_set_level',
  '_plaits_render', '_plaits_active_engine', '_plaits_sample_rate', '_malloc', '_free'
) -join "','"

$emccArgs = @(
  '-O3'
  '-std=c++11'
  "-I$eurorack"
  '-s', 'MODULARIZE=1'
  '-s', 'EXPORT_ES6=1'
  '-s', 'ENVIRONMENT=web'
  '-s', 'ALLOW_MEMORY_GROWTH=1'
  '-s', 'SINGLE_FILE=1'
  '-s', "EXPORTED_FUNCTIONS=['$exported']"
  '-s', "EXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPF32']"
  # The firmware is written for a chip with no exceptions and no RTTI.
  '-fno-exceptions'
  '-fno-rtti'
  '-o', $outFile
) + $sources

if ($DryRun) {
  Write-Host "emcc $($emccArgs -join ' ')"
  return
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Write-Host '  compilation…' -ForegroundColor Yellow
& emcc @emccArgs
if ($LASTEXITCODE -ne 0) { Write-Error "emcc a échoué (code $LASTEXITCODE)" }

$size = [math]::Round((Get-Item $outFile).Length / 1MB, 2)
Write-Host "  OK : $outFile ($size Mo)" -ForegroundColor Green
