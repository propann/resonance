# Reprise du travail — Resonance

Dernière mise à jour : **2026-09-05**

Ce fichier est le point de reprise versionné : lu depuis le dépôt, il survit à
tout redémarrage de console (et à un changement de modèle). Vue d'ensemble et
urgences : `docs/ROADMAP.md`. Historique détaillé : `git log`. Mémoire longue
durée : `resonance-refonte.md` + `resonance-op1-format.md` (chargées
automatiquement chaque session).

## Reprise immédiate

```bash
cd C:\Users\azoth\resonance
git pull                       # dernier état sur origin/main
npm ci                         # si node_modules absent
npx tsc --noEmit && npx eslint . && npx vitest run && npx vite build
# doit tout passer : 0 erreur, 371 tests
```

- `main` @ `0317b52` (2026-09-05), poussé. Build installé depuis
  `C:\Users\azoth\resonance-release\Resonance-1.0.0-x64.exe`
  (electron-builder avec `-c.directories.output` hors du dépôt : dans le dépôt,
  le rename de `release\win-unpacked.tmp` échoue en EPERM).
- App installée : `%LOCALAPPDATA%\Programs\Resonance\`, connectée à `D:\Son`
  (**271 000+ fichiers rangés**, ingestion en cours). Config :
  `%APPDATA%\Resonance\resonance-config.json`.
- Rebuild + réinstall :
  `npx vite build && npx electron-builder --win -c.electronVersion=37.10.3 -c.directories.output=C:/Users/azoth/resonance-release`
  puis lancer le `.exe` avec `/S`. **Depuis un worktree**, `-c.electronVersion`
  est obligatoire : sans `node_modules` local, electron-builder ne sait pas
  résoudre la plage `^37.10.3`.
- **Moteurs natifs** : `bash tools/build-engine.sh <plaits|rings|clouds|elements>`.
  Nécessite emsdk (`%LOCALAPPDATA%\emsdk`) — à lancer depuis bash, pas
  PowerShell, qui transforme le stderr d'emcc en erreur.
- Test headless : lancer `Resonance.exe --remote-debugging-port=9222` et
  piloter via CDP.

## 2026-09-05 — L'application était bloquée 97 % du temps

Branche `worktree-trieuse-coherence`, vingt-six commits, non fusionnée.

Symptômes signalés : chargement long, « la lecture démarre quand elle veut »,
la barre de lecture **saute**. C'étaient deux problèmes distincts, et aucun des
deux n'était celui qu'on croyait.

### Mesuré, pas supposé

`tools/profile-app.mjs` (nouveau) profile le CPU de l'app en fonctionnement ;
`tools/eval-in-app.mjs` chronomètre. Lancer `Resonance.exe
--remote-debugging-port=9222` d'abord.

Sur 282 000 samples, **sans aucun clic**, le thread principal enchaînait des
tâches longues de **4,4 s** — occupé ~97 % du temps. Les clics n'étaient pas
lents : ils attendaient leur tour. C'est ça qui faisait sauter la tête de
lecture (peinte en `requestAnimationFrame`).

| Suspect | Coût | Verdict |
|---|---|---|
| Réallocation des 282 k objets par rafraîchissement | 930 ms | **la cause** |
| Compteurs sidebar (21 dossiers + 15 types) | 443 ms | réel, secondaire |
| Tri par date | 128 ms | mineur |
| Filtre complet | 37 ms | négligeable |
| Décodage audio | 0 | **hors de cause** (un clic sur une ligne déjà en cache coûtait pareil) |

Deux hypothèses tombées sur les chiffres : la latence de sortie (10 ms) et le
`map` sur 282 k (9 ms).

### Corrigé

1. **Le bouton play des lignes ne faisait rien** (`6f73a2f`). `SampleTable`
   lisait `sample.audioBuffer` et sortait en silence quand il manquait — donc
   pour tout sample venu du manifeste, c'est-à-dire tous sauf ceux fraîchement
   enregistrés. Nouveau `services/sampleAudio.ts` : `loadSampleAudio` répond
   depuis le sample, puis le cache, puis le fichier, et fusionne les demandes
   concurrentes. `peekSampleAudio` pour les mini-ondes (jamais de décodage au
   défilement).
2. **Hydratation du manifeste** (`b683186`). Le manifeste entier est relu à
   chaque rafraîchissement ; on construisait les 282 126 items puis on jetait
   ceux déjà connus — 64 nouveaux fichiers coûtaient 282 126 allocations.
   `services/manifestHydration.ts` calcule l'id d'abord et ne construit que le
   neuf ; un manifeste inchangé rend le tableau intact, donc rien ne re-trie.
3. **Compteurs sidebar** (`8b5514c`). `services/libraryCounts.ts` : une passe
   pour tous les badges, mémoïsée, et `Sidebar` passe sous `React.memo`.
   Attention : `folderMatcher` accepte aussi par **chemin**, pas seulement par
   `folderId` — les samples sans id sont gardés à part et passés au vrai
   matcher, sinon le badge cesse d'accorder avec la liste qu'il étiquette.

### Après, sur la même bibliothèque

| Mesure | Avant | Après |
|---|---|---|
| Tâches longues, 20 s au repos | 2 × 4,4 s | **aucune** |
| Clic sur une ligne | bloqué derrière 4,4 s | **3 ms** |
| Bouton play d'une ligne | ne faisait rien | joue |

### Puis, dans la foulée — la même cause, trois fois de plus

Le bouton play était la pointe d'un motif : partout où le code lisait
`sample.audioBuffer` sur un sample venu de la bibliothèque, il trouvait
`undefined` et abandonnait en silence.

4. **Les exports par lot n'exportaient presque rien** (`de89f03`).
   `exportEp133ProjectPack`, `processBatchConvert`, `exportMultipleWavsAsZip`,
   `exportSlicesZip` et les kits OP-1 faisaient tous
   `if (!sample.audioBuffer) continue`. Ils passent par `loadSampleAudio` ; le
   chemin OP-1 résout ses 24 pads en un seul endroit, `withLoadedSlices`.
   `loadSampleAudio` **perd son argument dossier de travail** : il ne servait à
   rien (`readLibraryAudioFile` ignore la racine qu'on lui passe — le processus
   principal résout contre le dossier adopté) et l'aurait fallu faire traverser
   cinq composants pour atteindre les exports.
5. **Les modales DSP et calibrage ouvraient le vide** (`de89f03`). Câblées aux
   boutons de chaque ligne, montées nulle part. Montées, avec un effet qui lit
   l'audio de leur cible à l'ouverture — le bouton DSP d'une ligne ne pointe pas
   forcément sur le sample sélectionné. Au passage, câblage mort de
   `LayerSynthRackModal` retiré (fenêtre volontairement fondue dans la colonne
   d'atelier ; le fichier du composant reste, le supprimer est une décision
   produit).
6. **0,0 LUFS partout** (`208b8f7`), trouvé en ouvrant la modale enfin
   accessible. `sampleItem?.lufs ?? estimation` — or un sample hydraté porte
   `lufs: 0` (le manifeste ne stocke pas la loudness, seulement dans les tags),
   et `??` ne s'efface que devant `null`. Rien de réel ne mesure 0 LUFS : le
   silence numérique donne −70. Vérifié dans l'app : **−22,2 LUFS**.

### OP-1 : lire les patches, les distinguer, les ranger

Lu sur les 768 patches du pack de l'utilisateur (`~/Downloads/OP-1`) :

| genre | n | durée | format | ce que c'est |
|---|---|---|---|---|
| drum | 173 | 1,57–12,00 s | 44,1 kHz | kit 24 pads |
| sampler | 458 | 2,00–6,00 s | 44,1 kHz | un son au clavier |
| moteur | 100 | **1,31 s pile** | 22,05 kHz | réglages, **aucun son** |
| audio brut | 36 | — | — | pas de bloc `APPL` |

`services/op1PatchFile.ts` (`readOp1PatchInfo`) lit tout ça **sans décoder
l'audio** : `drum_version` → kit, `synth_version` + `type` → patch synthé et
son moteur. Validé sur les 768 fichiers, zéro désaccord avec les dossiers du
pack. Les patches synthé ont leur dossier :
`03_HARDWARE/OP-1/synth` (avant, tout allait dans le dossier drum).

**Piège des marqueurs de pads** : ce ne sont pas des positions d'échantillon.
Ils sont sur une **timeline fixe de 12 s** (fin = 2147483646) quelle que soit
la durée réelle — lus comme des ticks, le dernier pad d'un kit de 10,8 s
tombait à 84 s. `drumMarkerToSeconds` (dans `hardware/op1og.ts`) est la bonne
conversion. Ensuite, 19 des 153 kits `drum_version: 1` portent des marqueurs
**au-delà de leur propre audio** (un à 22,6 s pour 11,3 s de son) ; les v2 et
v3 jamais. Les fins sont bornées à l'audio, comme le fait la machine.

`Op1FillGauge` lit la durée **brute** du kit, pas celle du composite : le
constructeur compresse ses sons pour tenir dans 12 s, donc le composite est
toujours ≤ 12 s et une jauge qui le lirait n'afficherait jamais de
dépassement. Vérifié dans l'app : `29.12s / 12.00s — 17.12s de trop`.

### L'arborescence OP-1, et le rack dans la fenêtre de création

L'arborescence copie **le disque de la machine** : `03_HARDWARE/OP-1/drum` et
`03_HARDWARE/OP-1/synth`, rien d'autre. Ce n'est pas inventé — c'est la forme
du pack de 768 patches. Un dossier fini se glisse donc tel quel sur l'OP-1 ;
toute autre disposition demanderait de réorganiser à la main au transfert,
c'est-à-dire exactement le travail qu'on veut éviter. (Les anciens
`OP-1_DRUM_PATCHES` / `OP-1_SYNTH_PATCHES` étaient vides ; le balayage des
dossiers vides les emporte.)

`components/ToolTree.tsx` : les lignes de dossier (`FolderRow`, `LeafRow`,
`GroupLabel`) sortent de `AtelierColumn` pour être partagées. La colonne
d'atelier se lit comme l'arbre de bibliothèque en face d'elle ; tout panneau
qui propose des outils doit se lire pareil, et partager les lignes est ce qui
l'empêche de dériver vers un « presque, mais pas tout à fait » pareil.

`components/Op1RackPanel.tsx` : troisième colonne du constructeur de kit. Même
chaîne, même store que la colonne d'atelier — une chaîne construite d'un côté
est celle que l'autre voit. **Un seul rack sonne à la fois** : la colonne se
retire (`useLiveRack(..., !op1Studio)`) pendant que la fenêtre est devant, sinon
les deux tiendraient chacun un nœud source et se les disputeraient.
`APPLIQUER AU PAD` rend la chaîne, la pose sur le pad et **recompile la bande** :
le son traité n'a pas la même longueur que celui qu'il remplace, donc les
marqueurs et la jauge doivent suivre.

Vérifié dans l'app : fenêtre ouverte en 4 ms, `RACK · C1 · <nom du pad>`,
dossier EFFETS avec ses 24 effets par famille, jauge `29.12s / 12.00s`.

### L'ingestion, débloquée — et pourquoi ça a pris si longtemps

**Résolu, vérifié sur les vrais fichiers.** 767 patches en réception → 383 en
quelques minutes ; `03_OP-1/drum` 231, `03_OP-1/synth` 539, **zéro échec**. Sur
50 fichiers vérifiés dans chaque dossier : `drum/` 50 kits et 0 synthé,
`synth/` 50 synthé et 0 kit. Séparation parfaite.

La cause : **`parseOp1AiffPatch` appelait `getAudioContext().decodeAudioData`
en direct**, donc ne traversait jamais le repli AIFF branché sur
`audioEngine.decodeAudioData`. Or c'est la fonction par laquelle passe *chaque*
`.aif`. Le repli était à un appel de distance, sans rien faire. Un test balaie
maintenant les sources et échoue sur tout décodage brut hors du moteur
(`decodeThroughEngine.test.ts`) — l'enregistreur avait le même raccourci.

Trois choses expliquaient pourquoi ça ne repartait jamais, toutes muettes :

- **`processQueue` n'avait pas de `finally`.** Son drapeau empêche le scan de
  réception de remettre son watcher *et* son timer. Une exception échappée, ou
  un `await` qui ne se règle jamais, arrêtait l'ingestion **définitivement**.
- **`analysisPool.analyse` n'avait pas de délai maximal.** Un worker qui ne
  répond ni par un résultat ni par une erreur laisse sa promesse en suspens —
  précisément l'`await` ci-dessus. 30 s puis reprise sur le thread principal.
- **Les échecs ne quittaient jamais la file** et chaque nouveau lot fusionnait
  par-dessus : les mêmes fichiers cassés redécodés à chaque lot, coût croissant.

Et le scan marquait « en file » toutes les entrées demandées, y compris celles
dont les octets n'étaient jamais revenus — son propre commentaire disait le
contraire. Ces fichiers étaient retirés sans avoir été transmis.

Les échecs sont maintenant regroupés par raison, dits une fois par lot, et la
raison remonte jusqu'au badge qui n'affichait qu'un nombre.

⚠️ **Fausse piste, notée pour ne pas y revenir** : le balayage des dossiers
vides tourne dans le scan et son horloge démarrait à zéro, donc il partait au
premier scan de **chaque** démarrage en parcourant un demi-million de fichiers.
Ça ressemblait beaucoup à la cause. Ce n'en était pas une — il finit. Corrigé
quand même (horloge au lancement, exécution non bloquante) parce qu'il retarde
l'ingestion de plusieurs minutes à chaque relance, ce qui a masqué le vrai
problème pendant tout le diagnostic.

### Le navigateur ne décode pas l'AIFF — 78 000 fichiers étaient bloqués

**La découverte la plus importante de la session.** Trouvée en cherchant
pourquoi les patches OP-1 copiés dans `00_RECEPTION` n'étaient pas ingérés.

Chrome, donc Electron, répond `Unable to decode audio data` pour l'AIFF sur
cette plateforme — `FORM…AIFF` comme `FORM…AIFC`, les deux vérifiés contre
l'app en fonctionnement. Et rien ne peut se passer après ça : un fichier qui ne
décode pas ne devient jamais quelque chose que la bibliothèque puisse ranger,
donc il reste dans le dossier de dépôt **pour toujours, sans un message**.

Ici : **78 443 fichiers, plus de 22 Go**, dont les 77 675 qui dormaient dans un
dossier `00_RECEPTION/OP-1` depuis le début. Ce n'était pas une file lente,
c'était une file qui ne pouvait pas avancer.

`services/aiffDecoder.ts` le fait nous-mêmes — l'AIFF est du PCM non compressé
dans un conteneur à chunks, donc c'est lire deux chunks et convertir des
entiers. Échantillonné sur la bibliothèque : 16 bits gros-boutiste presque
partout, un peu de 24 bits, et les patches OP-1 en `AIFC/sowt` (le même PCM à
l'envers). Tout ce qui est réellement compressé est **refusé**, pas deviné.

Branché dans `audioEngine.decodeAudioData`, **après** que le navigateur ait
refusé : un seul point, tous les chemins en profitent, et une plateforme qui
sait lire l'AIFF garde son propre décodeur.

Vérifié sur les vrais fichiers, pas seulement des fixtures : 456 échantillonnés
sur la bibliothèque et le pack — tous décodés, aucun silencieux, aucun hors
bornes (ce que donnerait une lecture à l'envers).

⚠️ **Piège de diagnostic** : `00_RECEPTION/OP-1` contient 77 675 `.aif` qui ne
sont **pas** des patches. 300 échantillonnés au hasard dans tout l'arbre :
100 % de l'audio brut, aucune métadonnée OP-1. Le nom du dossier ment. Ils
iront dans `01_ONE_SHOTS`/`02_LOOPS`, ce qui est correct.

### L'éditeur de patch OP-1

`components/Op1PatchEditor.tsx`, sous l'onde dans la vue édition : nom, octave,
effet, LFO, enveloppe, boutons du moteur, et les 24 pads d'un kit (hauteur,
volume, inversion, boucle). Il n'apparaît que pour un vrai patch — lu dans le
fichier, pas deviné d'après un nom.

`writeOp1PatchMetadata` ne reconstruit que le chunk `APPL` et **recopie tous
les autres octet pour octet**. Renommer un kit n'a pas à ré-encoder ce qu'il
joue, et un aller-retour par un décodeur changerait les échantillons en
silence. Un fichier sans chunk OP-1 en reçoit un **avant** `SSND` — le firmware
ne lit pas un patch qui le porte après.

Vérifié sur 144 vrais patches : renommés, écrits, relus — aucun octet d'audio
changé, aucun genre changé, aucun illisible.

### L'arborescence à plat, et la vue édition

`03_HARDWARE` ne chapeautait que l'OP-1. Supprimé : l'OP-1 remonte à
**`03_OP-1`**, à côté de `01_ONE_SHOTS` et `02_LOOPS`, avec `drum/` et
`synth/` dessous. Rien n'y était rangé (0 fichier, 0 entrée manifeste) — on a
déplacé une forme, pas des sons. `03_HARDWARE` reste dans la liste de balayage
des dossiers vides uniquement pour que le répertoire résiduel disparaisse ; il
n'est plus jamais créé. `UNTOUCHED_ROOTS` du trieur suit : un patch n'est pas
un sample, et le re-ranger d'après son nom mettrait un kit « AZ_Kick_Kit »
dans les kicks. Son test utilisait l'ancien chemin **et passait quand même** —
il ne gardait donc plus rien ; il couvre maintenant drum et synth.

**Sélectionner un son bascule le centre de la fenêtre sur l'éditeur** : l'onde
prend tout le volet au lieu de le partager avec la liste. Même page, pas une
nouvelle — l'onglet LISTE ramène. La hauteur du volet est **mesurée**
(`ResizeObserver`), pas supposée : la fenêtre se redimensionne et les volets
de part et d'autre se glissent. Vérifié : 175 → 759 → 175 px.

Au passage, un bug qui dormait : `drawWaveform` lit `clientWidth`/`clientHeight`
du canvas pour dimensionner son tampon, mais **rien ne le prévenait qu'ils
avaient changé**. Le conteneur rétrécissait, le dessin restait à son ancienne
résolution, étiré. Un `ResizeObserver` sur le canvas couvre d'un coup les trois
cas : bascule liste/édition, glissement d'un séparateur, redimensionnement de
la fenêtre.

**À faire ensuite** : le dossier PACK EP-133, sous l'OP-1, pour regrouper des
ensembles de sons tout prêts.

### Trois régressions attrapées sur le build installé

Le refactor `audioBuffer` en a produit deux, la troisième dormait depuis
toujours. Toutes trouvées en installant et en mesurant, pas en relisant.

1. **Fuite de 6 Go** (`7395893`). `cacheSampleAudio` épinglait tout ce qui
   n'avait pas de `diskPath` — ce qui semble prudent, mais l'ingestion crée
   des samples sans chemin par milliers et les écrit sur disque juste après.
   Le rendu montait à 6,1 Go et ne répondait plus. Défaut inversé :
   évinçable, sauf si l'appelant dit tenir la seule copie (une prise non
   sauvegardée, un rendu avant écriture). Plafond de 300 s d'audio épinglé,
   avec avertissement, comme filet.
2. **Le kit se reconstruisait tout seul** (`b0dcc69`). L'effet du
   constructeur dépendait de `availableSamples`, dont l'identité change à
   chaque lot d'ingestion : il repiochait 24 pads, relisait 24 fichiers et
   recompilait, en boucle. Mauvais aussi par principe — ça efface
   l'arrangement en cours d'édition.
3. **Le sélecteur dessinait une ligne DOM par sample** (`a2e3634`), soit
   283 000. Antérieur à tout ça, fatal seulement à cette taille. Il en montre
   200, le compte réel reste affiché : `Base de Samples (298 873 · 200
   affichés)`. Ouverture : **7 ms**.

### Reste à faire

- `audioBuffer` vit encore dans `SampleItem` : deux mécanismes coexistent pour
  trouver un buffer (le champ, et le cache via `loadSampleAudio`). Les trois
  bugs ci-dessus sont des symptômes de cette dualité. Le nettoyer est l'étape 5
  du plan de perf — 164 références, 12 fichiers.
- Les modales ne se ferment pas avec Échap (constaté, pas corrigé).
- `src/components/LayerSynthRackModal.tsx` n'est plus référencé nulle part.

## État actuel

Application desktop **Electron** (React 19 / Vite 6 / Tailwind 4 / Tone.js).
Portes de vérification à chaque commit : `tsc --noEmit` · `eslint .` (0 erreur) ·
`vitest run` (370 tests) · `vite build`.

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

## Phase 6 — DEBLOQUEE le 2026-09-04 : Plaits tourne en WASM

Emscripten 3.1.40 installe (`choco install emscripten`, emsdk dans
`%LOCALAPPDATA%\emsdk`). **Plaits compile et sonne** : 16 modeles Mutable
Instruments reels, verifies dans le navigateur (7 modeles sondes, signatures
RMS et passages a zero tous distincts).

### Trois obstacles, trois corrections

1. **`stmlib` etait un sous-module git vide.** La bibliotheque DSP partagee
   dont Plaits depend entierement n'avait jamais ete initialisee : meme avec
   emcc, rien n'aurait compile. `git clone https://github.com/pichenettes/stmlib.git
   vendor/mutable-eurorack/stmlib`.
2. **Assembleur ARM Cortex-M4** (`ssat`, `usat`, `vsqrt.f32`) dans
   `stmlib/dsp/dsp.h`. Upstream garde la version portable derriere `#ifdef TEST` :
   il suffit de `-DTEST`.
3. **`plaits/user_data.h` appelle `printf` sans inclure `<cstdio>`** dans sa
   branche TEST (bug amont). Corrige par `-include cstdio`, sans toucher aux
   sources vendorees.

### Ce qui a ete ecrit

- `tools/engines/plaits_bridge.cc` — surface C minimale autour de
  `plaits::Voice`. Seule la synthese est prise ; drivers, bootloader, UI et
  settings pilotent le STM32 et sont exclus.
- `tools/build-plaits.sh` — la compilation reelle (`Build-NativeEngines.ps1`
  n'etait qu'un squelette qui verifiait la chaine d'outils puis s'arretait).
  emcc ecrit sur stderr, ce que PowerShell transforme en erreur : d'ou la
  version bash.
- `public/engines/mutable-plaits/plaits.js` — 293 Ko, wasm embarque
  (`SINGLE_FILE`), charge a la demande.
- `public/engines/mutable-plaits/bridge.js` — implemente le contrat
  `EngineBridge` qui existait deja depuis des semaines sans implementation.

### Le piege Vite

`import(/* @vite-ignore */ url)` ne suffit pas : Vite reconnait un chemin de
`public/` et refuse (« should not be imported from source code »). L'import
passe par `new Function('url', 'return import(url)')`, opaque au bundler.
Aucune CSP declaree dans l'app, donc c'est sur.

### Rings suit, et la recette se generalise

`tools/build-plaits.sh` est devenu `tools/build-engine.sh <moteur>` : memes
trois contournements, un `case` par moteur pour ses sources et ses exports.
**Rings a compile du premier coup** (95 Ko) — 6 resonateurs, verifies au
navigateur, signatures distinctes et coherentes : « Corde » decroit vite
(RMS 0,023), « Corde + reverberation » traine avec 1578 passages a zero.

Rings est un resonateur : sur le module c'est une entree audio qui l'excite,
mais il embarque son propre exciteur (`internal_exciter`), et c'est celui-la
qu'une note joue ici. Il compte sa hauteur en demi-tons au-dessus de sa
tonique, pas en note MIDI — d'ou le -24 dans son pont.

`NativeEngineFolder.tsx` porte le dossier generique (chargement paresseux,
liste des modeles, rendu sur l'onde) ; ajouter un moteur est desormais **une
ligne** dans `NATIVE_ENGINES` plus son pont sous `public/engines/`.

Candidats suivants dans `vendor/mutable-eurorack` : Clouds (granulaire — mais
il traite un flux entrant, le contrat n'a pas encore de notion d'entree),
Elements, Braids.

### Clouds : le premier moteur qui *traite* au lieu de fabriquer

Clouds ne produit aucun son propre — il granule ce qu'on lui donne. C'est le
plus utile des trois pour une bibliotheque de samples, et il a demande
d'etendre le contrat : `EngineBridge.process?(input): Promise<AudioBuffer>`,
absent des voix qui n'ont rien a transformer. `NativeEngineFolder` bascule
tout seul : si le pont expose `process`, cliquer un mode passe le sample
charge dedans au lieu de rendre depuis rien.

**Clouds tourne en 32 kHz**, pas 48. Le pont reechantillonne des deux cotes ;
sans ca le sample revenait une quinte trop bas. Verifie : 48 kHz en entree,
48 kHz en sortie, duree 1,000 s preservee.

**Trois modes sur quatre.** Granulaire (RMS 0,178), delai boucle (0,144) et
spectral (0,192) transforment bien la source (0,25). **L'etirement temporel
rend du silence.** Le mode est retire de la liste plutot qu'expose muet ;
`MODE_INDEX` mappe nos trois entrees sur les index 0, 2 et 3 du firmware.

**Deux hypotheses ecartees, avec mesures** — a ne pas re-tenter :

1. *Rechargement des tampons.* Clouds recarve ses tampons dans `Prepare` lors
   d'un changement de mode. Ajouter 64 cycles de prechauffage apres
   `set_playback_mode` : aucun effet.
2. *Ratio Prepare/Process.* Sur le module, `Prepare` tourne dans la boucle
   principale et `Process` sous interruption : Prepare s'execute donc bien plus
   d'une fois par bloc. Et en mode etirement, `Prepare` appelle
   `correlator_.EvaluateSomeCandidates()`, qui evalue les points de raccord
   WSOLA quelques-uns a la fois — l'explication semblait tenir. Passe a 16
   `Prepare` par bloc (`kPreparePerBlock`, garde parce que plus fidele au
   materiel) : l'etirement reste a 0,0015 RMS, a **toutes** les densites et
   toutes les positions testees. Les trois autres modes sont inchanges au
   chiffre pres.

Piste restante : la taille du tampon. `large_buffer` fait 118 784 octets, soit
~0,93 s a 32 kHz en stereo 16 bits ; WSOLA a peut-etre besoin de plus de
matiere que ca pour trouver un raccord.

**Effet de bord utile de l'enquete.** Le granulaire est pilote par la densite,
et brutalement : a 0,5 le nuage est si clairsemé qu'il mesure 0,0015 RMS
contre 0,25 pour la source — inaudible. A 0,8 il donne 0,390, a 1,0 il donne
0,766. La valeur par defaut passe de 0,5 a 0,8, sinon le mode semble casse
alors qu'il attend juste qu'on tourne un bouton.

### Elements : modelisation physique, quatrieme moteur

Un exciteur — archet, souffle, maillet — contre un resonateur. Trois
resonateurs, plus la synthese alternative que le firmware cache derriere
`set_easter_egg` : c'est un quatrieme caractere, offert plutot que masque.
32 kHz, rechantillonne a la sortie. 559 Ko.

Les mesures collent a la physique : la frappe donne une crete forte
(0,96-0,98) avec un RMS bas — un transitoire qui decroit ; l'archet donne une
crete basse mais un RMS soutenu. Les quatre modeles sonnent a la frappe.

**« Voix ominous » + archet est muet**, et c'est normal : cette synthese
n'utilise pas l'exciteur archet. Le modele est garde puisqu'il sonne a la
frappe.

Le gate est relache au tiers du rendu : sinon un modele archete donnerait deux
secondes d'un seul son tenu au lieu d'une note qui resonne.

### Etat des moteurs natifs

| Moteur | Taille | Modeles | Type |
|---|---|---|---|
| Plaits | 293 Ko | 16 | voix |
| Rings | 95 Ko | 6 | resonateur |
| Clouds | 150 Ko | 3 (sur 4) | **processeur** |
| Elements | 559 Ko | 4 | modelisation physique |

29 modeles, aucun dans le bundle. Ajouter un moteur : un shim C sous
`tools/engines/`, un `case` dans `build-engine.sh`, un `bridge.js` sous
`public/engines/`, une ligne dans `NATIVE_ENGINES`.

Restent dans `vendor/` : Braids (proche de Plaits), Marbles (generateur de CV,
peu d'interet ici), Warps, Tides.

### Kit OP-1 en un clic, depuis un moteur

`src/services/op1QuickKit.ts` : donne-lui des buffers, il rend le composite de
12 s, les 24 marqueurs et le `.aif`. Chaque dossier de moteur porte un bouton
« -> Kit OP-1 (n pads) » qui rend tous ses modeles d'affilee (0,45 s chacun :
seize modeles a deux secondes ne tiendraient pas dans les douze secondes du
format) et assemble le tout.

Le kit arrive **sur l'onde avec ses marqueurs**, pas comme un fichier opaque :
les tranches sont des `SliceRegion`, que l'editeur sait deja dessiner et
deplacer. Le `.aif` part en parallele dans
`03_HARDWARE/OP-1_DRUM_PATCHES` — dossier deja cree par
`ensureLibraryStructure`, donc rien a creer.

**Un defaut que seul le test reel a montre.** `buildOp1DrumBuffer` renvoie
toujours vingt-quatre slots, remplissant ceux qu'on ne lui a pas donnes avec
les noms de pads par defaut de l'OP-1. Seize sons donnaient donc seize pads
plus huit marqueurs fantomes, le dernier etiquete « Break / Mini Loop » sur du
silence. Corrige (`calculatedSlices.slice(0, kept.length)`), et le double du
test a ete rendu fidele — il renvoyait naivement autant de slots que de sons,
ce qui masquait exactement ce cas.

Verifie de bout en bout depuis Plaits : 16 sons -> 16 pads, noms de modeles
reels, bornes contigues de 0,45 s, derniere a 7,2 s, AIFF `FORM/AIFF` de
759 Ko en 44,1 kHz mono.

### La boucle OP-1 est fermee

`encodeOp1FromWave()` reecrit le patch avec les marqueurs **la ou ils sont
maintenant**. Le constructeur de kit en ecrit un en assemblant, mais les
marqueurs se deplacent ensuite et le fichier sur le disque ne correspondait
plus a l'ecran. Entree : AUDIO/DSP -> HARDWARE -> « Enregistrer l'onde en
patch OP-1 ».

Deux pieges du format, tenus par des tests :

- **Rechantillonnage obligatoire.** L'encodeur mono-ise et coupe a 12 s tout
  seul, mais il lit les temps de marqueur contre 44,1 kHz. Une onde en 48 kHz
  posait chaque pad ~10 % trop tot. Rechantillonnee en amont.
- **Marqueurs au-dela de 12 s.** Un marqueur glisse plus loin encodait un pad
  qui demarre apres la fin de l'audio — du silence sur la machine. Ceux qui
  depassent sont ramenes a 12 s, ceux qui commencent apres sont ecartes, et si
  tout est au-dela l'operation refuse plutot que d'ecrire un patch muet.

### Dexed

Toujours pas fait : JUCE, autrement plus lourd que Plaits. Le contrat
l'accepte deja (`NativeEngineId`), la place est prete.

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

## Session 2026-09-04 (suite) — l'atelier remplace les fenetres

Trois fenetres se recouvraient pour toucher un son : le rack d'effets, le rack
synth et un rack « extensions ». Deux d'entre elles s'ouvraient depuis
plusieurs boutons a la fois. Elles sont maintenant **une colonne** a droite de
l'onde, `src/components/AtelierColumn.tsx`, avec cinq sections repliables :
EFFETS, MOTEURS, PATCHES, DECOUPE, KIT OP-1.

### Le temps reel etait deja la, prisonnier d'une modale

`RackHostModal` portait la chaine vivante : un changement de structure
reconstruit, un changement de parametre est applique a chaud sans coupure.
Cette logique est extraite telle quelle dans `src/rack/useLiveRack.ts`, donc
n'importe quelle partie de l'interface peut l'heberger. La colonne la garde
montee en permanence : tourner un bouton s'entend sans ouvrir de fenetre, et
sans quitter le sample qu'on regarde.

`buildCarrier()` est teste (`useLiveRack.test.ts`) : un kick d'une demi-seconde
etait un porteur trop court, qui coupait un moteur au bout de 0,5 s et le
faisait passer pour muet. Il est etire a 4 s des qu'une source est dans la
chaine.

### Le rack « extensions » etait une coquille vide

`AdvancedEngineRackModal` : 145 lignes de cases a cocher et trois curseurs
(mix/tone/morph) ecrits dans `localStorage`, **aucune reference a
`engineBridge`, aucun son**. Les vrais Dexed/Mutable exigent de compiler du
WASM avec Emscripten, absent de la machine. Supprime sur decision explicite :
mieux vaut ne rien afficher que d'afficher ce qui ne marche pas.

La section MOTEURS n'expose donc que ce qui sonne : les modules `gen.*` du
rack (FM 2-op, oscillateurs, bruit, resonateur) et un acces au Creator
(10 couches Tone.js + MIDI), qui reste une fenetre parce qu'il a son clavier.

### Ce qui a bouge

- `useResizablePanels` gagne `atelierWidth` (220-560 px, persistant). Le
  delta est inverse : la colonne est a droite, tirer vers la gauche l'elargit.
- Les boutons SYNTH RACK et EXTENSIONS disparaissent de `Header.tsx`.
- Le bundle principal passe de 445 a 490 kB : les modules du rack sont
  desormais charges au demarrage, la colonne etant toujours montee. C'est le
  prix du temps reel permanent.

Tests : 151 -> 157.

## Session 2026-09-05 — l'ingestion en workers

Mesure d'abord, sur l'app en train de tourner (`tools/read-app-console.mjs`,
qui lit sa console via le protocole DevTools). Lot de 64 sons :
decodage 2 853 ms, **analyse 8 420 ms**, encodage 109 ms. L'analyse est les
trois quarts, et c'est de l'arithmetique sur des Float32Array.

**Le portage n'a coute aucune ligne d'`audioAnalyzer`.** Ses fonctions prennent
un `AudioBuffer` mais n'en lisent que quatre membres (`getChannelData`,
`duration`, `sampleRate`, `numberOfChannels`) : un objet de meme forme suffit.
Un test verifie que la reponse du worker est identique a l'appel direct — une
ingestion qui classerait differemment selon le thread serait pire que lente.

Le parallelisme vient du maintien de plusieurs analyses en vol, en reflechissant
le prefetch de decodage qui existait deja plutot qu'en inventant un second
motif. Un worker par cœur moins un, plafonne a six.

Les donnees de canaux sont **copiees**, pas transferees : le thread principal a
encore besoin du buffer pour encoder le WAV, et un ArrayBuffer detache lui
ferait ecrire du silence.

### Resultat, et le goulot suivant

| Etape (lot de 64) | Avant | Apres |
|---|---|---|
| Decodage | 2 853 ms | 4 284 ms |
| Analyse | **8 420 ms** | **4 969 ms** |
| Lot total | 11,7 s | 9,8 s |

Analyse **-41 %**, lot complet **~-20 %**. Moins que les ×4 a ×8 esperes, et la
mesure dit pourquoi : **le decodage est devenu le goulot**, et il a meme
augmente — le thread principal copie desormais les canaux pour les workers, et
les workers attendent des buffers au lieu de tourner a plein.

Le decodage ne peut pas partir en worker (`decodeAudioData` appartient a un
contexte audio). Le levier suivant est donc `DECODE_AHEAD` (6 aujourd'hui) : en
lancer davantage en parallele nourrirait les workers. **A mesurer avant de
changer** — c'est ce qui a evite de paralleliser la mauvaise etape ici.

## Lenteur generale — ce que la mesure a dit

Symptomes rapportes : chargement d'un sample long, lecture qui « demarre quand
ca veut », barre de lecture mal alignee.

Mesure dans l'app vivante (`tools/eval-in-app.mjs`, qui evalue une expression
via le protocole DevTools) :

| Fait | Valeur |
|---|---|
| Samples dans le store | **282 985** |
| Tri par date (defaut) | **113 ms** |
| Tri par nom (`localeCompare`) | **374 ms** |
| `map` vs `slice`+index sur 283 k | 9 ms vs 4,5 ms |
| `baseLatency` / `outputLatency` | 10 ms / 0 |

**Deux hypotheses ecartees par la mesure :**

1. *Le `previous.map` sur 283 k serait le coupable.* Il coute 9 ms contre 4,5 —
   l'ecart ne justifiait pas l'optimisation. (Elle est faite quand meme dans le
   chargement, elle est gratuite.)
2. *La barre de lecture derive a cause de la latence de sortie.* 10 ms, bien
   trop peu. La tete est peinte en `requestAnimationFrame` : un thread
   principal bloque 113 a 374 ms la fait **sauter**, pas deriver. Le decalage
   est un symptome de la lenteur, pas un bug d'horloge.

**Le vrai cout : le tri se refait a chaque `setSamples`** — donc a chaque
chargement de sample, chaque favori, chaque decoupe — parce que
`filteredSamples` depend de `samples`. Il filtre avant de trier, donc un
dossier selectionne reduit la note ; c'est la vue par defaut, sans filtre, qui
paie les 283 k.

### Fait

`audioBufferCache.ts` : revenir sur un sample ne relit plus son fichier par IPC
et ne le redecode plus. Budget en **secondes d'audio** et non en entrees — cent
kicks et cent boucles de quatre minutes ne pesent pas pareil — evicion LRU, et
un son plus long que le budget entier n'est pas garde du tout.

### A faire, dans l'ordre

1. **Sortir `audioBuffer` du tableau `samples`.** C'est lui qui force le
   re-tri : charger un buffer modifie `samples`, donc invalide le memo. Un
   store separe pour les buffers supprimerait le cout a la racine.
2. **Ne pas hydrater 283 000 objets React.** Le tableau est virtualise a
   l'affichage mais pas en memoire. C'est le plafond de tout le reste.

## Pistes ouvertes

- Réutiliser la vue riche de `WaveformCanvas` (zoom, slices, spectro, zone, ligne de volume) dans le rack, avec le calque couleur des effets.
- Enveloppe de volume : la garder par sample (elle est remise à plat au changement de sample) et l'appliquer aussi à `DÉCOUPER WAV`.
- **Perf restante** : bundle principal 429 kB — `AutoCuratorModal` (~1,2 kl) reste chargé d'office parce que le transfert de fond vit dedans ; extraire ce pipeline en service le sortirait du chunk de démarrage.
- `WaveformCanvas` (~1,8 kl), `Op1KitBuilderModal` / `AutoCuratorModal` (>1 kLOC) à découper.
- Test réel OP-1 : figer `reverse: 19968`, `playmode 20480`, `drum_version: 2`.
- **Paralléliser l'analyse d'ingestion.** Mesuré le 2026-09-04 sur `D:\Son` :
  64 fichiers par ~75 s, soit **~51 fichiers/min**. Chaque source est décodée,
  analysée (BPM, tonalité, transitoires, timbre), normalisée puis ré-encodée,
  le tout sur le seul thread du rendu — d'où la cadence. Des Web Workers
  diviseraient le temps par 4 à 8. **Volontairement remis à plus tard** :
  priorité à un tri qui range juste (voir la règle produit ci-dessous), la
  vitesse ensuite. Rien n'est bloqué en attendant, la réception se vide toute
  seule lot par lot ; l'ingestion se met en pause pendant une écoute, donc
  elle avance plus vite si on laisse l'app tranquille.

## Règle produit

Le dossier de travail est la source de vérité. Une source n'est supprimée
qu'après écriture du fichier de destination **et** du manifeste confirmées.
