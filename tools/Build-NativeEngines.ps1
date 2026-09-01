param([switch]$DryRun)
$ErrorActionPreference = 'Stop'

Write-Host 'Resonance native engine build'
if (-not (Get-Command emcc -ErrorAction SilentlyContinue)) {
  Write-Error 'Emscripten (emcc) est requis. Installez l emsdk puis relancez ce script.'
}
if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
  Write-Error 'CMake est requis pour Dexed.'
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$out = Join-Path $root 'public/engines'
if (-not $DryRun) { New-Item -ItemType Directory -Force -Path $out | Out-Null }
Write-Host 'Sources attendues : vendor/dexed et vendor/mutable-eurorack'
Write-Host 'Etape suivante : compiler chaque bridge vers public/engines/<id>/bridge.js.'
