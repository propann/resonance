# 🎛️ Resonance — Pro Audio Sample Manager, DSP Curator & Hardware Hub

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio-Hardware%20DSP-FF7A00)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![EBU R128](https://img.shields.io/badge/Loudness-EBU%20R128%20(-14%20LUFS)-00F0FF)](https://tech.ebu.ch/loudness)
[![Target Repo](https://img.shields.io/badge/GitHub%20Sync-propann%2Faz--sample-A855F7?logo=github&logoColor=white)](https://github.com/propann/az-sample)

**La station de curation, d'analyse acoustique DSP, de fabrication de kits hardware et de synchronisation Git pour sound designers & beatmakers exigeants.**

[📖 Guide Utilisateur (DOCS.md)](./DOCS.md) • [🏷️ Convention de Nommage (CONVENTION.md)](./CONVENTION.md) • [⚡ Dépôt Cible (`propann/az-sample`)](https://github.com/propann/az-sample)

[🔎 Audit du code (01/09/2026)](./docs/AUDIT-2026-09.md) • [🗺️ Feuille de route](./docs/ROADMAP.md)

</div>

---

## 📸 Aperçu de l'Interface Studio (ASCII Mockup)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🎛️ RESONANCE STUDIO   │  Fichier  Édition  Audio/DSP  Hardware  Vue  Aide  │  [● RECORD LIVE]│
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🔍 [Rechercher sample, note, bpm...] │ [⚡ CURATEUR PRO]  [✂️ SLICER]  [🎚️ OP-1]  [🐙 GIT PUSH] │
├──────────────────────────┬──────────────────────────────────────────────────────────────────┤
│ 📂 ARBORESCENCE STUDIO   │ 📊 SAMPLE MASTER : AZ_KCK_PunchyHard_F#m_140BPM_01.wav           │
│ ├─ 01_DRUMS              │ ┌──────────────────────────────────────────────────────────────┐ │
│ ├─ 02_BASS_808           │ │  /\_/\    /\  /\_/\    /\  /\_/\    /\  /\_/\                │ │
│ ├─ 03_MELODIC            │ │ /    \  /  \/    \  /  \/    \  /  \/    \   [ 00:00.428s ]  │ │
│ ├─ 04_VOCALS             │ └──────────────────────────────────────────────────────────────┘ │
│ ├─ 05_FX_TEXTURES        │ ▶ [PLAY/SPACE]  [PITCH: -12..+12]  [GAIN: -14 LUFS]  [LOOP: OFF] │
│ ├─ 06_LOOPS              ├──────────────────────────────────────────────────────────────────┤
│ └─ 07_INSTRUMENTS        │ 🔬 MÉTRIQUES DSP EN DIRECT                                       │
├──────────────────────────┤ │ • Clé : F#min (f0: 92.5 Hz)    • Loudness : -13.8 LUFS (OK)    │
│ 🏷️ TAGS RAPIDES          │ │ • Peak : -0.2 dBFS             • Centroïde : 1150 Hz (Warm)    │
│ [punchy] [warm] [bright] │ │ • BPM : 140                    • DC Offset : 0.00% (Clean)     │
│ [sub-heavy] [tight]      ├──────────────────────────────────────────────────────────────────┤
│                          │ 📋 TABLE DES SAMPLES DISPONIBLES (60 FPS)                        │
│ ⚙️ OP-1 BUFFER (12.0s)   │ │  # │ Nom Standardisé       │ Type │ Clé  │ BPM │ LUFS │ Actions │
│ [████████░░░░] 7.8s / 12s│ │ 01 │ AZ_KCK_DeepPunch_01   │ KCK  │ F#m  │ 140 │ -14  │ [▶][✂]  │
│                          │ │ 02 │ AZ_808_RumbleSub_01   │ 808  │ F#m  │ 140 │ -12  │ [▶][✂]  │
└──────────────────────────┴─┴────┴───────────────────────┴──────┴──────┴─────┴──────┴─────────┘
```

---

## ⚡ Fonctionnalités Majeures

### 1. 🪄 Studio Auto-Curateur & Pipeline DSP
- **Puisage & Analyse en Masse :** Glissez-déposez un dossier complet de samples bruts ou puisez dans votre bibliothèque active.
- **Analyse Spectrale & Tonalité :** Algorithmes d'autocorrélation et de centroïde spectral pour identifier automatiquement la note fondamentale ($f_0$), la gamme (Majeur/Mineur), le tempo en BPM et les tranches de transitoires.
- **Enrichissement de Tags Timbraux :** Génération de métadonnées sémantiques précises (`punchy`, `warm`, `bright`, `sub-heavy`, `crisp`, `saturated`, `tight`, `sustained`).
- **Formatage Audio Conforme :** Conversion et encodage automatique en **WAV 24-bit 48kHz** (Master Studio) ou **16-bit 46.8k/44.1k** (Hardware).
- **Rangement par dossier de travail :** Le scan crée et utilise `00_RECEPTION`, `01_ONE_SHOTS`, `02_LOOPS`, `03_HARDWARE` et `_MANIFEST`, avec des sous-dossiers spécialisés.

### 2. 🔬 Laboratoire d'Analyse Acoustique DSP
- **Mesure de Loudness EBU R128 :** Calcul intégré LUFS, True Peak (dBFS), RMS et Facteur de Crête (Crest Factor).
- **Diagnostic de Santé Audio :** Détection automatique du DC Offset (courant continu), risque d'écrêtage (clipping) et rumble sub-harmonique (< 20 Hz).
- **Correcteurs en 1-Clic :** Élimination du DC Offset, normalisation True Peak à -0.5 dBFS et normalisation -14.0 LUFS.

### 3. ✂️ Découpeur de Transitoires & Slicer Intelligent
- **Détection Automatique de Transitoires :** Analyse d'énergie spectrale avec sensibilité réglable.
- **Snap au Passage à Zéro (Zero-Crossing) :** Élimination des clics et artéfacts audio lors du découpage.
- **Audition au Clavier :** Déclenchement instantané des tranches via les touches numériques 1 à 8.
- **Export Multi-Format :** Export en archive WAV individuelle ou conversion directe en kit de 24 pads OP-1.

### 4. 🎚️ Studio de Kits Teenage Engineering OP-1 & EP-133
- **OP-1 Drum Kit Builder :**
  - Assemblage de 24 pads avec jauge budgétaire de 12.0 secondes maximum (limite mémoire hardware OP-1 OG).
  - Génération conforme du conteneur **AIFF** intégrant le chunk JSON propriétaire `op-1 drum snapshot` (positions `0..4095`, pitch, playmode, revers, etc.).
  - Compatible **OP-1 OG** et **OP-1 Field**.
- **EP-133 K.O. II Exporter :**
  - Numérotation séquentielle standardisée `sound_001.wav` à `sound_099.wav`.
  - Format 44.1 kHz / 16-bit ou 24-bit optimisé pour le transfert via le TE Sample Tool.

### 5. 🏷️ Convention de Nommage Pro Standardisée
- Gabarit officiel : `AZ_[TYPE]_[NomDescriptif]_[Key]_[BPM]_[Index].wav`
- Voir le guide complet des codes et des règles : [CONVENTION.md](./CONVENTION.md)

### 6. 🐙 Synchronisation Git Directe (`propann/az-sample`)
- **Push Direct via GitHub API :** Synchronisation en un clic vers `https://github.com/propann/az-sample.git` à l'aide d'un Personal Access Token (PAT).
- **Export Package Git-Ready :** Création d'une archive `.zip` contenant les dossiers structurés, les kits OP-1, les sons EP-133, le `manifest.json`, le `README.md`, `CONVENTION.md`, `DOCS.md` et `.gitattributes` (Git LFS).
- **Script Terminal Automatisé :** Script `push_to_az_sample.sh` inclus pour la synchronisation en ligne de commande.

---

## 📂 Arborescence du Dépôt Cible (`az-sample`)

Lorsque vous synchronisez votre bibliothèque avec [propann/az-sample](https://github.com/propann/az-sample), le dépôt adopte la structure suivante :

```
az-sample/
├── 01_DRUMS/                   # Kicks, Snares, Claps, HiHats, Cymbals, Percussions
├── 02_BASS_808/                # Basses analogiques, 808 subs accordés
├── 03_MELODIC/                 # Synthétiseurs, Leads, Pads, Chords, Plucks
├── 04_VOCALS/                  # Vocal chops, Hooks, One-shots de voix
├── 05_FX_TEXTURES/             # Risers, Impacts, Textures ambiantes, Foley
├── 06_LOOPS/                   # Boucles rythmiques et mélodiques avec tempo & bar count
├── 07_INSTRUMENTS/             # Guitares, Pianos, Cuivres acoustiques
├── op1_kits/                   # Kits OP-1 Drum Patches (.aif avec métadonnées 24 pads)
│   └── az_sample_OP1_Kit_01.aif
├── ep133_packs/                # Banques formatées Teenage Engineering EP-133
│   ├── sound_001_Kick_*.wav
│   └── sound_099_FX_*.wav
├── .gitattributes              # Configuration Git LFS pour les binaires audio
├── README.md                   # Index et documentation du pack
├── CONVENTION.md               # Guide officiel de nommage et de curation
├── DOCS.md                     # Manuel utilisateur et fiches techniques
├── manifest.json               # Métadonnées audio (BPM, Key, LUFS, Tags)
└── scripts/
    └── push_to_az_sample.sh    # Script de synchronisation rapide en ligne de commande
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

### Shell desktop (Windows / macOS / Linux)
Après installation complète des scripts Electron :
```bash
npm run build
npm run desktop:start
```
En développement, lancer Vite puis `npm run desktop:dev`. Le shell garde le traitement audio côté application et prépare le point d'entrée des moteurs natifs.

### Validation TypeScript & Linting
```bash
npm run lint
```

---

## ⌨️ Raccourcis Clavier Principaux

| Raccourci | Action |
| :--- | :--- |
| <kbd>Espace</kbd> | Lecture / Pause du sample actif |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Naviguer dans la liste des sons |
| <kbd>Ctrl</kbd> + <kbd>O</kbd> | Réactiver le dossier de travail |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> | Ouvrir le traitement du dossier de travail |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Ouvrir le Studio Auto-Curateur & Rangement DSP |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Ouvrir le Découpeur de Transitoires (Slicer) |
| <kbd>Ctrl</kbd> + <kbd>G</kbd> | Ouvrir le Hub de Synchronisation GitHub |
| <kbd>1</kbd> à <kbd>8</kbd> | Déclencher les tranches dans le Slicer |
| <kbd>+</kbd> / <kbd>-</kbd> | Transposer le pitch (-12 à +12 demi-tons) |
| <kbd>F</kbd> | Basculer l'état Favori |

---

## 🔒 Confidentialité & Sécurité

- **100% Client-Side Processing :** Tout le traitement de signal numérique (DSP), la découpe et l'encodage binaire AIFF/WAV se déroulent localement dans votre navigateur sans serveur tiers.
- **Sécurité des Clés Git :** Les tokens d'accès GitHub (PAT) restent stockés uniquement dans le stockage local de votre navigateur (`localStorage`).

---

## 📜 Documentation Complémentaire

- [📘 Manuel Utilisateur & Guides Visuels (DOCS.md)](./DOCS.md)
- [🏷️ Convention de Nommage & Standards Audio (CONVENTION.md)](./CONVENTION.md)
- [🐙 Dépôt Git Officiel](https://github.com/propann/az-sample)

---
*Développé avec précision technique par **Engineering Studio**.*
