# 🎛️ Resonance — Pro Audio Sample Manager & Hardware Slicer

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-Hardware%20DSP-FF7A00)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Target Repo](https://img.shields.io/badge/GitHub-propann%2Faz--sample-00F0FF?logo=github)](https://github.com/propann/az-sample)

**Resonance** est une station de travail audio numérique (DAW-companion) complète et ultra-rapide fonctionnant directement dans le navigateur. Conçue pour les sound designers, beatmakers, producteurs et possesseurs de hardware (Teenage Engineering OP-1, EP-133 K.O. II, samplers MPC/Roland), elle offre des outils avancés d'analyse acoustique DSP, de découpe automatique de transitoires, de fabrication de kits hardware et de synchronisation Git.

---

## ⚡ Fonctionnalités Clés

### 1. 🔍 Exploration & Indexation Audio Ultra-Rapide
- **Chargement instantané** : Drag-and-drop de fichiers uniques ou dossiers complets avec scan récursif.
- **Lecture à latence zéro** : Moteur Web Audio API optimisé, pré-mise en mémoire tampon et gestion multi-voix.
- **MiniWaveforms vectorielles** : Formes d'ondes graphiques légères calculées via cache de crêtes pour un défilement à 60 FPS.
- **Auto-Loudness Leveling** : Égalisation automatique en temps réel à -14 LUFS lors de l'audition pour éviter la fatigue auditive.
- **Audition au clavier & Pitch rapide** : Pré-écoute transposée de -12 à +12 demi-tons en direct.

### 2. 🔬 Laboratoire d'Analyse Acoustique DSP
- **Loudness & Dynamique** : Mesure intégrée EBU R128 (LUFS), True Peak (dBFS), RMS moyen et Facteur de Crête (Crest Factor).
- **Spectre Fréquentiel & Timbre** : FFT temps réel avec calcul du Centroïde Spectral (brillance/chaleur en Hz), bande passante effective et détection des 3 harmoniques dominantes.
- **Détection de Pitch & Clé Musicale** : Algorithme hybride d'autocorrélation & spectre de produit harmonique pour identifier la fréquence fondamentale ($f_0$), note MIDI et gamme (Mineur/Majeur).
- **Diagnostic de Santé Audio** : Détection du DC Offset (courant continu), risque d'écrêtage (clipping) et rumble sub-harmonique (< 20 Hz).
- **Correction rapide en 1-clic** : Élimination du DC offset, normalisation True Peak à -0.2 dBFS et normalisation -14 LUFS.

### 3. ✂️ Découpeur de Transitoires & Slicer Intelligent
- **Découpe automatique** : Détection de transitoires basée sur l'énergie spectrale et le ratio de pente d'attaque.
- **Snap au passage à zéro (Zero-Crossing)** : Évite les clics et pops indésirables lors de l'export des tranches.
- **Édition fine des régions** : Ajustement visuel des points de début/fin, crossfade, inversion (reverse) et transposition par tranche.
- **Export multiple** : Export en WAVs individuels ou assemblage direct vers un kit de percussions.

### 4. 🎚️ Studio de Kits Teenage Engineering OP-1 & EP-133
- **OP-1 Drum Kit Builder** :
  - Assemblage de 24 pads avec jauge budgétaire de 12.0 secondes maximum (limite mémoire hardware OP-1 OG).
  - Génération conforme du conteneur **AIFF** intégrant le chunk JSON propriétaire `op-1 drum snapshot` (positions de start/end 0..4095, pitch, playmode, revers, etc.).
  - Compatible **OP-1 OG** et **OP-1 Field**.
- **EP-133 K.O. II Exporter** :
  - Numérotation séquentielle standardisée `sound_001.wav` à `sound_099.wav`.
  - Format 44.1 kHz / 16-bit ou 24-bit optimisé pour le transfert via l'utilitaire Teenage Engineering.

### 5. 🏷️ Convention de Nommage Pro & Rangement Automatique
- **Modèles de nommage configurables** :
  - `Studio Standard` : `[Type]_[Key]_[BPM]_[Name].wav` (ex : `KCK_Cmin_124_DeepPunch.wav`)
  - `Vendor Clean` : `[Type]_[Name]_[Key]_[BPM].wav`
  - `Hardware Minimal` : `01_[Type]_[Name].wav`
  - `EP-133 Slot` : `[Slot]_[Type]_[Name].wav`
- **Sanitisation sécurisée** : Suppression des caractères interdits par les OS et samplers hardware (`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`), normalisation des espaces en tirets bas.
- **Structure de dossiers automatique** : Tri par instrument (`/Kicks`, `/Snares`, `/Bass_808`, `/HiHats`, `/Loops`, etc.).
- **Prévisualisation Diff temps réel** : Tableau comparatif avant/après avant application.

### 6. 🌐 Synchronisation GitHub (`propann/az-sample`)
- **Push Direct via GitHub API** : Synchronisation en 1 clic vers `https://github.com/propann/az-sample.git` à l'aide d'un Personal Access Token (PAT).
- **Export Package Git-Ready** : Création d'une archive `.zip` contenant les dossiers structurés, les kits OP-1, les sons EP-133, le `manifest.json`, le `README.md` et `.gitattributes` (Git LFS).
- **Assistant Terminal CLI** : Commandes prêtes à copier-coller pour cloner, commiter et pusher.

### 7. 🎙️ Enregistreur & Capture Audio Directe
- Enregistrement direct depuis le microphone ou une carte son externe.
- Vu-mètre de niveau crête en temps réel avec indicateur de clipping.
- Déclencheur automatique de seuil (Auto-Threshold gate).
- Normalisation et insertion immédiate dans la bibliothèque active.

---

## 🏗️ Architecture Technique

```
src/
├── components/                # Composants UI modulaires
│   ├── AudioAnalysisModal.tsx # Laboratoire DSP & inspection acoustique
│   ├── AudioRecorderModal.tsx # Capture live & micro/carte son
│   ├── BatchConverterModal.tsx# Convertisseur de masse & normaliseur
│   ├── BatchNamingModal.tsx   # Convention de nommage & rangement
│   ├── GitHubSyncModal.tsx    # Hub de synchronisation GitHub
│   ├── Header.tsx             # Barre de contrôle & accès rapide
│   ├── MarketBenchmarkModal.tsx# Benchmark & comparateur
│   ├── MiniWaveform.tsx       # Sparklines de forme d'onde légères (Canvas 2D)
│   ├── Op1KitBuilderModal.tsx # Constructeur de kits OP-1 & EP-133
│   ├── SampleBrowser.tsx      # Tableau de bord principal & filtres
│   ├── SampleDetailModal.tsx  # Inspecteur de sample individuel
│   ├── SlicerModal.tsx        # Découpeur de transitoires
│   └── WaveformViewer.tsx     # Afficheur de forme d'onde principal
├── services/                  # Moteurs métier & DSP (Zero complaisance)
│   ├── audioAnalyzer.ts       # Analyse FFT, LUFS, Pitch, Détection Transitoires
│   ├── audioConverter.ts      # Encodage WAV / AIFF, Resampling, ZIP
│   ├── audioEngine.ts         # Moteur Web Audio (Player, Leveling, Transpose)
│   ├── geminiEnhancer.ts      # Suggestions IA & Tagging sémantique
│   ├── gitHubSync.ts          # Intégration Git & GitHub REST API
│   ├── op1AiffEncoder.ts      # Spécification binaire AIFF & chunk OP-1
│   ├── sampleNamingConvention.ts # Moteur de renommage & arborescence
│   └── sampleStorage.ts       # Indexation locale & persistance
├── types/                     # Schémas & contrats TypeScript stricts
│   └── sample.ts              # Types SampleItem, Metrics, Presets, Configs
└── main.tsx                   # Point d'entrée de l'application
```

---

## 🚀 Démarrage & Installation

### Pré-requis
- **Node.js** >= 18.0.0
- **npm** ou **bun**

### Installation des dépendances
```bash
npm install
```

### Lancement en mode Développement (Port 3000)
```bash
npm run dev
```
L'application démarre sur `http://localhost:3000`.

### Compilation de Production
```bash
npm run build
```
Les fichiers statiques optimisés sont générés dans le dossier `dist/`.

### Validation TypeScript / Linter
```bash
npm run lint
```

---

## 📦 Structure du Répertoire GitHub Cible (`az-sample`)

Lorsque vous synchronisez votre bibliothèque avec [propann/az-sample](https://github.com/propann/az-sample), le dépôt adopte la disposition suivante :

```
az-sample/
├── .gitattributes              # Configuration Git LFS pour les binaires audio
├── README.md                   # Index et documentation du pack
├── manifest.json               # Métadonnées audio (BPM, Key, LUFS, Tags)
├── op1_kits/                   # Kits OP-1 Drum Patches (.aif avec métadonnées 24 pads)
│   └── az_sample_OP1_Kit_01.aif
├── ep133_packs/                # Banques formatées Teenage Engineering EP-133
│   ├── sound_001_Kick_*.wav
│   └── sound_099_FX_*.wav
└── samples/                    # Masters WAV 24-bit triés par catégorie
    ├── Kicks/
    ├── Snares/
    ├── Claps/
    ├── HiHats/
    ├── Bass_808/
    ├── Leads/
    ├── Pads_Chords/
    └── FX_Textures/
```

---

## 🔒 Sécurité & Confidentialité
- **100% Client-Side Processing** : Tout le traitement de signal numérique (DSP), la découpe et l'encodage binaire AIFF/WAV se déroulent en local dans votre navigateur.
- **Protection des identifiants** : Les jetons d'accès GitHub (PAT) restent stockés uniquement dans le stockage local de votre navigateur (`localStorage`).

---

## 📜 Licence
Développé avec précision technique par **Engineering Studio**. Tous droits réservés.
