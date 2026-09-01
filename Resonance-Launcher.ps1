$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Write-Host 'Resonance Studio - demarrage' -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 18+ est requis.' }
if (-not (Test-Path 'node_modules')) { npm install }
if (-not (Test-Path 'dist/index.html')) { npm run build }
if (-not (Test-Path 'node_modules/electron/dist/electron.exe')) { npm rebuild electron }
Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','desktop:start' -WorkingDirectory $PSScriptRoot
Write-Host 'Resonance est lance.' -ForegroundColor Green
