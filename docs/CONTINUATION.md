# Reprise du travail — Resonance

Dernière mise à jour : **2026-09-03** (session soir)

Ce fichier est le point de reprise versionné : lu depuis le dépôt, il survit à
tout redémarrage de console. Historique détaillé : `git log`.

## État actuel

Application desktop **Electron** (React 19 / Vite 6 / Tailwind 4 / Tone.js).
Portes de vérification à chaque commit : `tsc --noEmit` · `eslint .` (0 erreur) ·
`vitest run` (49 tests) · `vite build`.

### Fait — phases 0 à 5 de la refonte

| Domaine | État |
|---|---|
| Stores zustand | `uiStore`, `libraryStore`, `rackStore`, `sampleTargetStore`, `toastStore`. `App.tsx` 1540 → ~1100 l. Prop-drilling supprimé (Sidebar/Header/AppMenuBar/SampleTable/WaveformCanvas lisent les stores). |
| Graphe audio | `services/audioGraph.ts` : un seul `AudioContext` + master bus (gain → limiteur → analyser). Tone via `setContext`. |
| Electron / fs | `desktop/main.cjs` : IPC `fs` jailé sous la racine, dialog picker, config JSON `userData`, PAT via `safeStorage`, watch `chokidar`. `localLibrary.ts` sur chemins absolus (fin File System Access API + IndexedDB). |
| Rack modulaire | `src/rack/` : kernel `RackModule` (`createNode(ctx: BaseAudioContext)` live **et** offline), 24 modules (8 worklets `public/worklets/`), 10 templates, `RackHostModal` (audition live, bounce offline). Ancien `dspEffectsEngine` supprimé. |
| Conventions hardware | `src/services/hardware/op1og.ts` (encodeurs OG OP-1 drum+sampler corrigés — voir `resonance-op1-format` en mémoire) + `ep133.ts` (44,1 kHz / 16-bit / mono ; **46 875 Hz retiré partout**). |
| Coquille modale | `<Modal>` commun pour les 17 modals. `size="full"` = plein écran sous la barre de menus. |
| Packaging | `electron-builder` : installeur NSIS + AppImage/deb + dmg. `app.asar` 2,5 Mo (seul `chokidar` en dépendance runtime). `npm run dist:win` / `dist:linux` / `dist:mac`. |
| Éditeur d'onde | `RackWaveformStrip` dans `RackHostModal` : onde source (gris) + sortie traitée teintée par un mélange des couleurs de familles des modules actifs, 2 poignées de zone déplaçables (bouton-poignée en haut), bande centrale déplaçable, playhead, légende des familles ; « Enregistrer sample » découpe à la zone gardée (`sliceRegion`). Enveloppes min/max mises en cache (`useMemo` sur `[buffer, buckets]`) → le drag ne re-scanne pas le buffer. |
| Fenêtre modale | `Modal size="full"` = plein écran **sous la barre de menus** (top:36 px) — la barre FICHIER/ÉDITION reste visible/utilisable ; clic-fond désactivé. RackHost `xl`→`full`. |
| Sample restauré | `getLastSampleId`/`setLastSampleId` (clé config `lastSampleId`) : au lancement l'app se replace sur le dernier sample travaillé une fois la bibliothèque chargée. |
| Modals scopées sample | `App.liveSample()` : rack/dsp/loudness/slicer ré-résolvent leur cible contre `samples` vivant → l'`audioBuffer` décodé en différé atteint bien la modale. |

### Procédure réception → base (vérifiée end-to-end)

Fichiers déposés dans `D:\Son\00_RECEPTION` → scan de fond + auto-transfert →
analyse (type, BPM, clé, LUFS) → **renommage** (convention Splice-Pro
`AZ_<Type>_<Nom>_<Clé>[_<BPM>]`) → **rangement** dans le bon sous-dossier →
ajout au `_MANIFEST` → **suppression de la source** dans `00_RECEPTION`.
`sourceFingerprint` empêche la ré-ingestion.

## Blocage restant — Phase 6 (moteurs natifs)

Compiler Plaits / Rings / Clouds / Dexed en `AudioWorklet` + WASM.
- **CMake 4.4.3 déjà installé** (`C:\Program Files\CMake\bin`).
- Sources upstream présentes : `vendor/dexed`, `vendor/mutable-eurorack`.
- Contrat `EngineBridge` + chargeur : `src/services/engineBridge.ts` ; binaires attendus dans `public/engines/<id>/`.
- **Manque `emcc` (Emscripten)** — console admin :
  ```powershell
  choco install emscripten -y
  # rouvrir la console, puis :
  cmake --version ; emcc --version
  .\tools\Build-NativeEngines.ps1
  ```
- `LayerSynthRackModal` / `AdvancedEngineRackModal` restent des modals séparés tant que les binaires n'existent pas.

## Audit / perf — fait cette session

- Code mort retiré (~1,3 kl) : `AudioPlayerBottomBar.tsx` (composant entier),
  `detectPitch`, `extractSliceBuffer`, `generateDefaultLibrary`,
  `STREAMLINED_PRO_FOLDERS`/`mapTypeToStreamlinedFolder`.
- `eslint .` : 0 erreur (172 warnings, réduits phase par phase).
- Perf : enveloppes d'onde en cache ; effet de décodage du sample sélectionné
  ne dépend plus de `samples` (se relançait à chaque mutation de la bibliothèque).

## Pistes ouvertes

- **Éditeur d'onde v2** : copie d'une sous-région vers un nouveau sample (indépendant du rack) ; réutiliser la vue riche de `WaveformCanvas` (zoom, slices, spectro) dans le rack avec le calque couleur des effets.
- **Perf à creuser** : bundle principal 595 kB (splitter davantage) ; table de 442+ samples non virtualisée ; `listWorkFolderAudioFiles` lit tous les octets d'un coup — lourd si `00_RECEPTION` a des centaines de fichiers (scan paresseux + n'utiliser `listReceptionAudioFiles` que pour l'action "Analyser la réception").
- `WaveformCanvas` (~1400 l), `Op1KitBuilderModal` / `AutoCuratorModal` (>1 kLOC) à découper.
- Test réel OP-1 : figer `reverse: 19968`, `playmode 20480`, `drum_version: 2`.

## Règle produit

Le dossier de travail est la source de vérité. Une source n'est supprimée
qu'après écriture du fichier de destination **et** du manifeste confirmées.
