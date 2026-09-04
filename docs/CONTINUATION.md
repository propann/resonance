# Reprise du travail — Resonance

Dernière mise à jour : **2026-09-03** (session nuit)

Ce fichier est le point de reprise versionné : lu depuis le dépôt, il survit à
tout redémarrage de console (et à un changement de modèle). Historique
détaillé : `git log`. Mémoire longue durée : `resonance-refonte.md` +
`resonance-op1-format.md` (chargées automatiquement chaque session).

## Reprise immédiate

```bash
cd C:\Users\azoth\resonance
git pull                       # dernier état sur origin/main
npm ci                         # si node_modules absent
npx tsc --noEmit && npx eslint . && npx vitest run && npx vite build   # doit tout passer (0 erreur, 67 tests)
```

- `main` @ `3a38c2f` (2026-09-03 nuit), poussé. Build installé depuis
  `C:\Users\azoth\resonance-release\Resonance-1.0.0-x64.exe`
  (electron-builder avec `-c.directories.output` hors du dépôt : dans le dépôt,
  le rename de `release\win-unpacked.tmp` échoue en EPERM).
- App installée : `%LOCALAPPDATA%\Programs\Resonance\`, connectée à `D:\Son`
  (442 samples). Config : `%APPDATA%\Resonance\resonance-config.json`.
- Rebuild + réinstall :
  `npm run build && npx electron-builder --win -c.directories.output=C:/Users/azoth/resonance-release`
  puis lancer le `.exe` avec `/S`. (En sandbox il faut rediriger l'output
  hors du dépôt ; sur la vraie machine `npm run dist:win` suffit.)
- Test headless : lancer `Resonance.exe --remote-debugging-port=9222` et
  piloter via CDP (voir les scripts `/tmp/*.mjs` des sessions précédentes).

## État actuel

Application desktop **Electron** (React 19 / Vite 6 / Tailwind 4 / Tone.js).
Portes de vérification à chaque commit : `tsc --noEmit` · `eslint .` (0 erreur) ·
`vitest run` (67 tests) · `vite build`.

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

## Corrections / audit — session 2026-09-03 soir

- **Config qui se perdait** (`05e1dc7`) : l'écriture atomique `.tmp`→`rename`
  échouait sur Windows (EPERM si le fichier est ouvert par une lecture) →
  `.tmp` orphelin, valeur perdue. Symptôme : `libraryRoot` puis `lastSampleId`
  qui ne persistaient pas. Corrigé : `rename` retenté 5× puis repli
  `writeFile` en place. **Cycle fermeture→relance vérifié : le dernier son
  travaillé revient bien.**
- **Éditeur d'onde** qui ne s'affichait pas pour les samples du disque
  (`131db30`) : `App.liveSample()` ré-résout la cible contre la biblio vivante.
- Code mort retiré (~1,3 kl) : `AudioPlayerBottomBar.tsx` (composant entier),
  `detectPitch`, `extractSliceBuffer`, `generateDefaultLibrary`,
  `STREAMLINED_PRO_FOLDERS`/`mapTypeToStreamlinedFolder`.
- `eslint .` : 0 erreur (≈170 warnings, réduits phase par phase).
- Perf : enveloppes d'onde en cache ; effet de décodage du sample sélectionné
  ne dépend plus de `samples` (se relançait à chaque mutation de la biblio).

## Session 2026-09-03 nuit

| Commit | Ce qui change |
|---|---|
| `8c620da` | **Scan de réception paresseux.** `listWorkFolderAudioEntries()` ne lit plus que les métadonnées (`readDir` porte déjà taille + mtime) ; `readWorkFolderAudioFiles()` ne lit les octets que des fichiers réellement mis en curation, et ne les marque « vus » qu'une fois lus (une lecture ratée est retentée). `listWorkFolderAudioFiles` / `listReceptionAudioFiles` supprimées. Tests : `src/services/localLibrary.test.ts`. |
| `849f827` | **Table virtualisée.** Seules les lignes visibles (+6 d'overscan) sont montées, entre deux cales ; `sampleTableColumns.ts` (géométrie, badges, `ROW_HEIGHT` = 36, `visibleRowRange()` testée) + `SampleRow.tsx` mémoïsé. Sélection via `Set`. Une sélection faite ailleurs (dernier sample restauré, modale) défile jusqu'à sa ligne. `SampleTable` 664 → 435 l. Vérifié : 442 samples, `scrollHeight` 15912 = 442 × 36, 17-23 lignes montées. |
| `300aefd` | **Bundle 595 → 419 kB** (gzip 171 → 126). Onze modales passent en `React.lazy` derrière `LazyModal`, montées seulement quand elles sont ouvertes. Restent chargées d'office : `AutoCuratorModal` (transfert de fond `autoTransfer && !isOpen`) et `AudioRecorderModal` (coupure du micro sur `isOpen` → false). |
| `6e23e57` | **Zone libre** dans l'éditeur d'onde : ALT-glisser dessine une sous-région, la puce jaune l'écoute ou la copie en nouveau sample (`<base>_ZONE_<début>-<fin>ms`), source intacte. |
| `c4b4ef2` | **Poignées + fondus + ligne de volume + barre espace unique** (voir ci-dessous). |
| `3a38c2f` | **Poignée sur la tête de lecture** : carré à saisir en haut du playhead ; le glisser la pose où on veut (seek live si ça joue), et la lecture / barre espace repart de là. Dans une zone, la poignée passe avant le glissement de bande. |

### Éditeur d'onde v2 (`c4b4ef2`)

- **Poignées carrées** en haut : les deux bords de zone (glisser un bord
  redimensionne, la barre centrale déplace toute la zone, ré-aimantation aux
  passages à zéro au relâchement) et la **tête de lecture** (`3a38c2f`).
- **Fondus automatiques** FD IN / OUT (5 ms par défaut, réglables dans la puce)
  appliqués à l'écoute **et** à la copie — plus de clic en début/fin de coupe.
- **Ligne de volume** : bouton `VOLUME` → cliquer la ligne crée un point, le
  glisser règle le niveau (±6 dB, affiché en dB), `Suppr` efface le point
  sélectionné, le bouton `n PT` remet à plat.
- Maths pures et testées dans `src/components/waveform/gainEnvelope.ts`
  (interpolation, rendu de région, fondus qui ne se chevauchent jamais).
- L'écoute d'une zone joue le rendu traité ; le playhead reste sur la timeline
  du son source (décalage `playbackOffsetSec`).

### Transport unique (`c4b4ef2`)

`src/stores/transportStore.ts` : chaque page/modale enregistre son écoute tant
qu'elle est ouverte (`useAudition`), et **le seul** raccourci Espace de l'app
pilote la plus haute de la pile — sinon il retombe sur la sélection de la
bibliothèque. Fin des doubles lectures (le slicer et le studio OP-1 avaient
chacun leur écouteur Espace en plus de celui de l'app). Enregistrés : onde
(zone ou sample entier), rack, découpe, DSP Lab, kit OP-1, enregistreur (au
repos seulement). Le rack **ne démarre plus en boucle**. Le bouton PLAY de
l'en-tête indique en infobulle ce que la barre espace jouerait.

## Session 2026-09-04 — la trieuse

Quatre défauts trouvés en surveillant le tri, du plus grave au plus discret.

### 1. Les règles de tri ne voyaient pas l'underscore

`` compte `_` comme un caractère de mot en JS, donc `hat` ne matchait
**jamais** `Hat_Loose.wav` — et `_` est justement le séparateur par défaut de
la convention de nommage de l'app. Sondé sur 38 noms réalistes : la moitié
tombait dans `06_PERCS`. `Clap_Wide.wav`, `Snap_Finger.wav`, `HH_Pedal.wav`,
`Ride_Bell.wav`, `Rim_Click.wav`, `BD_909.wav`, `KCK_Sub.wav`, `SD_Rim_02.wav`
— tous mal rangés. Les fichiers dont le 2ᵉ jeton donnait le type (`AZ_Clap_…`)
étaient sauvés par le repli sur le type, ce qui masquait la panne.

`fe16406` avait bien remplacé les backspaces littéraux par de vrais ``,
mais `` est le mauvais outil quand le séparateur est `_`. Remplacé par une
frontière qui ne compte que les lettres (`token()`), plus une liste de mots
longs reconnus même collés (`TrapKick`). Le pluriel fait partie du jeton
(`Claps`, `Hats`). 38/38 corrects, table de non-régression dans
`proFolderOrganizer.test.ts`.

### 2. Le tri écrasait des sons

`sortDrumFolder` déplaçait par `fs.rename` nu. Un `Kick_01.wav` en vrac qui
tombe sur un `Kick_01.wav` déjà rangé dans `01_KICKS` **détruisait** ce
dernier, sans un mot. Le tri passe maintenant par `moveLibraryFileInto()`, qui
réutilise le `uniqueFileName()` de l'ingestion (`Kick_01_2.wav`) et reporte le
nom final dans le manifeste. La règle produit est tenue : rien n'est perdu.

### 3. Le badge d'un dossier et sa liste ne parlaient pas de la même chose

La sidebar comptait par chemin, récursivement ; le filtre comparait
`folderId` en égalité stricte. Comme `classifySampleForLibrary` ne renvoie
jamais `f-os-drums` pour une batterie (toujours une famille), cliquer sur
**01_DRUMS affichait une liste vide sous un badge à plusieurs centaines**.
Et `hydrateManifestSamples` re-devinait le `folderId` depuis le *nom* au lieu
de le lire depuis le chemin disque : un fichier rangé dans `06_PERCS` mais
nommé « …kick… » était compté dans PERCS et affiché dans KICKS.

`src/services/libraryFolders.ts` porte désormais l'unique lecture de
l'arborescence : `folderIdForPath()` (le disque fait foi) et `folderMatcher()`
(un parent inclut ses enfants), utilisés par le filtre **et** par le badge.
`DISK_PATH_BY_FOLDER_ID` (copie n°2, dans `Sidebar.tsx`) supprimée, et
`PRO_STUDIO_FOLDER_DEFINITIONS` + `generateProFolderHierarchy` (copie n°3,
~290 l, morte, et qui décrivait un *autre* plan : `01_Drums_Percussion/01_Kicks`)
avec elle.

### 4. Reprise des sons déjà mal rangés

Corriger les règles ne déplace pas ce qui est déjà coincé dans `06_PERCS`.
`sortDrumFolder` examine maintenant aussi les fichiers **déjà** dans une
famille, et n'en déplace un que si son nom nomme explicitement une autre
famille (`drumFamilyFromName`). Un nom qui ne dit rien reste où il est : le
rangement fait à la main survit. Un dossier de `01_DRUMS` qui n'est pas une
famille (`_ARCHIVE`) est ignoré.

Tests : 109 → 137 (`drumSorter.test.ts` 9, `libraryFolders.test.ts` 16, +3 sur
les règles). `tsc` propre, `eslint` 0 erreur, build OK.

### 5. La détection du type lisait les mots-clés en sous-chaîne

L'étage au-dessus du rangement — celui qui décide *quel type* est un son, donc
vers quel dossier il part — testait les mots-clés avec des `includes()` nus.
Même classe de bug, un cran plus haut, et plus visible :

| Fichier | Type détecté |
|---|---|
| `Whatever_Vox.wav`, `That_Sound.wav`, `Chat_Ambience.wav` | `hihat` (« hat ») |
| `Override_Lead.wav`, `Bride_Choir.wav` | `cymbal` (« ride ») |
| `Sharp_Stab.wav`, `Harp_Gliss.wav`, `Warped_Texture.wav` | `lead` (« arp ») |
| `Monkey_Scream.wav`, `Keyboard_Take.wav` | `lead` (« key ») |
| `Launchpad_Rec.wav` | `pad` |

Et l'inverse : `BD-909.wav`, `SD-02.wav`, `HH-01.wav` n'étaient pas reconnus du
tout, les règles exigeant `bd_`, `sd_`, `hh_` — un tiret ou un chiffre ne
comptait pas comme séparateur. Ces fichiers partaient en analyse DSP à
l'aveugle. Cet étage court-circuitait aussi le correctif n°1 : `Hatchback`
typé `hihat` ici atterrissait dans HATS quoi qu'en dise la règle de famille.

Les deux étages partagent maintenant `src/services/nameTokens.ts`
(`token()` / `word()` / `rule()`), et l'étage mots-clés est une table ordonnée
au lieu d'une cascade de `if`. Un nom qui ne nomme rien tombe en analyse
acoustique — c'est la bonne réponse, meilleure qu'une certitude fausse.
Table de non-régression : `audioAnalyzer.test.ts`.

Tests : 137 → 143.

### 6. Re-rangement de toute la bibliotheque, sans toucher a l'audio

Demande : vider les dossiers ranges, tout remettre dans `00_RECEPTION` et
refaire une passe. **Ne pas faire.** Deux raisons, verifiees :

1. `AutoCuratorModal.tsx:717` : un fichier dont le hash de contenu est deja
   connu du manifeste est compte doublon **et sa source est poussee dans
   `transferredSourceFiles`, donc effacee**. Le manifeste (93,6 Mo) porte les
   hashes des 220 000 fichiers : les remettre en reception et relancer
   l'ingestion les aurait tous supprimes.
2. Meme manifeste purge, l'ingestion tourne a ~127 fichiers/min : ~29 h, et
   chaque son serait re-decode, re-normalise, re-encode.

A la place, `src/services/librarySorter.ts` : `sortLibrary()` deplace les
fichiers sur place, sans decoder un octet. Il remplace `drumSorter` (supprime,
c'en etait un sous-ensemble) et le bouton RANGER l'appelle.

Regle de deplacement, volontairement etroite : on ne bouge un fichier que si
quelque chose le nomme — le nom, sinon le type stocke dans le manifeste. Sans
avis, le fichier ne bouge pas, donc le rangement manuel survit. `03_HARDWARE`
est exclu : un patch OP-1 appartient a sa machine.

Outils : `tools/audit-library.mts` (lecture seule) et
`tools/sort-library.mts` (`--apply` pour la passe hors ligne, app fermee ;
sauvegarde le manifeste et ecrit `_MANIFEST/sort-log-<date>.json` pour
pouvoir revenir en arriere).

**Etat mesure sur `D:\Son` (224 362 fichiers) :** 74,1 % deja au bon endroit,
**55 345 a deplacer**, 2 717 laisses en place. Dont 50 817 encore en vrac
directement dans `01_DRUMS` et 3 771 coinces dans `06_PERCS` par le bug de
l'underscore. Simulation : 0 collision, 0 echec.

### 7. Le label ecrit par l'app prime sur un mot de passage

L'audit a montre `AZ_Clap_Electro_Rim_03.wav` partant vers SNARES parce que
`Rim` apparait plus loin dans le nom, et 1 340 `AZ_Cymbal_..._CH_...` vers
HATS. Le deuxieme jeton d'un nom que l'app a ecrit est son propre verdict :
`declaredTypeFromName()` le lit et il gagne. Exception : `percussion` est le
bac generique, pas un verdict — il cede devant plus precis, donc
`AZ_Percussion_Rimshot` reste bien un snare.

Tests : 143 -> 151.

## Pistes ouvertes

- Réutiliser la vue riche de `WaveformCanvas` (zoom, slices, spectro, zone, ligne de volume) dans le rack, avec le calque couleur des effets.
- Enveloppe de volume : la garder par sample (elle est remise à plat au changement de sample) et l'appliquer aussi à `DÉCOUPER WAV`.
- **Perf restante** : bundle principal 429 kB — `AutoCuratorModal` (~1,2 kl) reste chargé d'office parce que le transfert de fond vit dedans ; extraire ce pipeline en service le sortirait du chunk de démarrage.
- `WaveformCanvas` (~1,8 kl), `Op1KitBuilderModal` / `AutoCuratorModal` (>1 kLOC) à découper.
- Test réel OP-1 : figer `reverse: 19968`, `playmode 20480`, `drum_version: 2`.

## Règle produit

Le dossier de travail est la source de vérité. Une source n'est supprimée
qu'après écriture du fichier de destination **et** du manifeste confirmées.
