$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host 'Resonance Studio - demarrage...' -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js 18+ est requis (https://nodejs.org).'
}

if (-not (Test-Path 'node_modules')) {
  Write-Host 'Installation des dependances (premiere fois)...' -ForegroundColor Yellow
  npm install
}

if (-not (Test-Path 'node_modules/electron/dist/electron.exe')) {
  Write-Host 'Preparation d''Electron...' -ForegroundColor Yellow
  npm rebuild electron
}

# Always rebuild so the launched app reflects the current code.
Write-Host 'Compilation de l''interface...' -ForegroundColor Yellow
npm run build

Write-Host 'Lancement de Resonance.' -ForegroundColor Green
& npm run desktop:start
