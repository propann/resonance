# Reprise du travail Resonance

Derniere mise a jour : 01/09/2026

## Etat du projet

- Application React/Vite fonctionnelle.
- Bibliotheque locale : dossier de travail, scan recursif, classement, manifeste, reprise et nettoyage.
- Creator principal : 10 couches, Tone.js, MIDI, sauvegarde et creation de samples.
- Rack Extensions : 10 familles, activation a la demande, Mix/Tone/Morph et persistance.
- Sources externes presentes : `vendor/dexed` et `vendor/mutable-eurorack`.
- Shell Electron present : `desktop/main.cjs`, `desktop/preload.cjs`.
- Lanceur Windows present : `Resonance-Launcher.cmd` et `Resonance-Launcher.ps1`.
- Logo present : `public/resonance-logo.png`.

## Validations deja faites

```powershell
npm run lint        # OK
npm run build       # OK
npx electron --version  # v37.10.3
```

## Blocage restant

CMake est installe (4.4.3) dans `C:\Program Files\CMake\bin`, mais le PATH doit etre rafraichi dans une nouvelle console. Emscripten (`emcc`) n'est pas encore installe ; il est necessaire avec CMake pour compiler les vrais bridges Dexed/Mutable en WASM/AudioWorklet.

## A reprendre dans une console administrateur

```powershell
cd C:\Users\azoth\resonance
choco install cmake --installargs 'ADD_CMAKE_TO_PATH=System' -y
choco install emscripten -y
```

Puis fermer et rouvrir PowerShell, verifier :

```powershell
cmake --version
emcc --version
```

Enfin lancer :

```powershell
.\tools\Build-NativeEngines.ps1
```

Le script indique la prochaine etape de compilation vers `public/engines/<id>/bridge.js`. Ne pas supprimer les dossiers `vendor/` : ils contiennent les sources upstream et leurs licences.
