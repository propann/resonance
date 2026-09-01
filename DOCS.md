# 📘 Resonance Studio — Guide Utilisateur & Documentation Technique

> **Plateforme :** Engineering Studio — Station de Curation Audio, Laboratoire DSP & Synchronisation Hardware  
> **Dépôt Git :** [`propann/az-sample`](https://github.com/propann/az-sample)  
> **Version :** `v2.5.0 Local Work Folder + Creator`

---

## 📑 Table des Matières

1. [Vue d'Ensemble de l'Interface (Visualisation ASCII)](#-1-vue-densemble-de-linterface)
2. [Flux de Travail Rapide (Workflow en 5 Étapes)](#-2-flux-de-travail-rapide)
3. [Studio Auto-Curateur & Pipeline DSP](#-3-studio-auto-curateur--pipeline-dsp)
4. [Laboratoire Acoustique DSP & Mesures](#-4-laboratoire-acoustique-dsp--mesures)
5. [Découpeur de Transitoires & Slicer Intelligent](#-5-découpeur-de-transitoires--slicer-intelligent)
6. [Création de Kits Hardware (OP-1 & EP-133 K.O. II)](#-6-création-de-kits-hardware-op-1--ep-133)
7. [Renommage en Masse & Convention Standard](#-7-renommage-en-masse--convention-standard)
8. [Synchronisation Git & Dépôt `propann/az-sample`](#-8-synchronisation-git--dépôt-propannaz-sample)
9. [Raccourcis Clavier & Productivité](#-9-raccourcis-clavier--productivité)

---

## 🖥️ 1. Vue d'Ensemble de l'Interface

Voici l'architecture globale de l'interface **Resonance Studio** affichée à l'écran :

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🎛️ ENGINEERING STUDIO  │  Fichier  Édition  Audio/DSP  Hardware  Vue  Aide  │  [● RECORD]   │
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

## ⚡ 2. Flux de Travail Rapide

Pour transformer un dossier de sons désordonnés en un pack professionnel prêt pour vos machines et Git :

```
 ┌──────────────────────┐
 │ 1. GLISSER-DÉPOSER   │ ➔ Glissez un dossier brut de sons sur l'application
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 2. AUTO-CURATEUR DSP │ ➔ Cliquez sur [CURATEUR PRO] pour l'analyse spectrale,
 └──────────┬───────────┘    détection de tonalité, BPM, trim & normalisation LUFS
            ▼
 ┌──────────────────────┐
 │ 3. DÉCOUPE & ÉDITION │ ➔ Utilisez le [SLICER] pour isoler les transitoires
 └──────────┬───────────┘    ou fabriquer un kit de 24 pads OP-1
            ▼
 ┌──────────────────────┐
 │ 4. RANGEMENT EN 7    │ ➔ Validation automatique dans les 7 dossiers fondamentaux
 └──────────┬───────────┘    (01_DRUMS, 02_BASS_808, 03_MELODIC, etc.)
            ▼
 ┌──────────────────────┐
 │ 5. SYNC GITHUB       │ ➔ Cliquez sur [🐙 GIT PUSH] pour mettre à jour
 └──────────────────────┘    le dépôt https://github.com/propann/az-sample
```

---

## 🪄 3. Studio Auto-Curateur & Pipeline DSP

Accessible via le bouton **`CURATEUR PRO`** ou le menu **`Fichier > Studio Auto-Curateur`**.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🪄 STUDIO AUTO-CURATEUR & RANGEMENT INTELLIGENT (DSP Pipeline)                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ Source : [● Dossier/Disque Externe] [Bibliothèque Actuelle]   Format : [24-bit 48kHz WAV ▾] │
│ Convention : [Splice Pro ▾]   Dossiers : [7 Dossiers Épurés ▾]  Normalisation : [-14 LUFS ▾]│
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [▶] │ STATUT │ NOM BRUT ORIGINAL        │ → │ NOUVEAU NOM PRO          │ CLÉ/BPM │ DOSSIER   │
├─────┼────────┼──────────────────────────┼───┼──────────────────────────┼─────────┼───────────┤
│ [▶] │  PRÊT  │ kick_heavy_dist (2).wav  │ → │ AZ_KCK_HeavyDist_F#m_01  │ F#m/140 │ 01_DRUMS  │
│ [▶] │  PRÊT  │ trap_808_long_c.wav      │ → │ AZ_808_LongSub_Cmin_01   │ Cmin    │ 02_BASS   │
│ [▶] │  PRÊT  │ rhodes chord fmaj9.wav   │ → │ AZ_PAD_RhodesChord_Fmaj  │ Fmaj    │ 03_MELODIC│
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [📁 + Dossier]  [🎵 + Fichiers]            │ [📦 Exporter Pack ZIP]  [✅ VALIDER & RANGER (3)] │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Options Clés :
- **Format Cible :** 24-bit 48kHz (Master), 16-bit 46.8k (EP-133) ou 16-bit 44.1k (DAW).
- **Gain EBU R128 :** Égalise le niveau moyen d'écoute pour éviter tout choc de volume entre kicks et percussions.
- **Trim Silence :** Supprime les millisecondes de silence et le courant continu (DC Offset) en entrée de fichier.

---

## 🔬 4. Laboratoire Acoustique DSP & Mesures

Accessible en cliquant sur **`DSP`** ou **`Audio/DSP > Analyseur Acoustique`**.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🔬 LABORATOIRE D'INSPECTION ACOUSTIQUE DSP                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─ LOUDNESS & ÉNERGIE ──────────────────┐ ┌─ SPECTRE & TIMBRE ────────────────────────────┐ │
│ │ • Intégré (LUFS) : -13.8 LUFS         │ │ • Centroïde Spectral : 1 240 Hz (Warm/Mid)    │ │
│ │ • True Peak      : -0.2 dBFS          │ │ • Zero-Crossing Rate : 0.042 (Tonal Low)      │ │
│ │ • Facteur Crête  : 11.2 dB            │ │ • Harmonies Clés    : 92 Hz, 185 Hz, 277 Hz   │ │
│ └───────────────────────────────────────┘ └───────────────────────────────────────────────┘ │
│ ┌─ TONALITÉ & PITCH ────────────────────┐ ┌─ DIAGNOSTIC SANTÉ AUDIO ──────────────────────┐ │
│ │ • Clé Estimée    : Fa# Mineur (F#min) │ │ • DC Offset         : 0.00% (Parfait)         │ │
│ │ • Note Fondam.   : F#1 (92.48 Hz)     │ │ • Écrêtage (Clip)   : Aucun                   │ │
│ │ • Précision      : 96% Confiance      │ │ • Rumble Sub (<20Hz): 0.1% (Filtré)           │ │
│ └───────────────────────────────────────┘ └───────────────────────────────────────────────┘ │
│ [🧹 Nettoyer DC Offset]  [⚖️ Normaliser -14 LUFS]  [⚡ True Peak -0.5 dB]  [✨ Enrichir Tags]  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✂️ 5. Découpeur de Transitoires & Slicer Intelligent

Accessible via le bouton **`SLICER`** sur n'importe quel sample ou boucle :

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ ✂️ DÉCOUPEUR DE TRANSIOIRES (Transient Slicer)                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ Sensibilité : [───●────────] 65%   Snap Zero-Crossing : [V]   Tranches Détectées : 8        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  |1       |2       |3       |4       |5       |6       |7       |8                          │
│ ┌┴────────┴────────┴────────┴────────┴────────┴────────┴────────┴─────────────────────────┐ │
│ │/ \  /\  / \  /\  / \  /\  / \  /\  / \  /\  / \  /\  / \  /\  / \  /\                   │ │
│ │   \/  \/   \/  \/   \/  \/   \/  \/   \/  \/   \/  \/   \/  \/   \/  \                  │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│ [Touche 1-8 pour auditionner chaque tranche]                                                │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [💾 Exporter Tranches WAV (.zip)]  [🎛️ Convertir en Kit OP-1 (24 Pads)]  [➕ Ajouter aux Drums]│
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎚️ 6. Création de Kits Hardware (OP-1 & EP-133)

### OP-1 OG & Field Drum Patch Builder :
- **Budget Hardware Strict :** 12.0 secondes cumulées.
- **Balisage Binaire :** Génération instantanée du fichier `.aif` avec le chunk `op-1 drum snapshot`.
- **Assignation 24 touches :** Clavier virtuel pour tester les déclenchements avant transfert USB.

### Teenage Engineering EP-133 K.O. II :
- Numérotation séquentielle des pads (`sound_001.wav` à `sound_099.wav`).
- Conversion automatique 16-bit 46.875 kHz / 44.1 kHz.

---

## 🏷️ 7. Renommage en Masse & Convention Standard

La norme officielle `az-sample` est accessible dans le modal **`Batch Naming`** ou dans le fichier [`CONVENTION.md`](./CONVENTION.md).

### Syntaxe Standard :
`AZ_[TYPE]_[NomDescriptif]_[Key]_[BPM]_[Index].wav`

Exemples :
- `AZ_KCK_SubPunch_F#m_140BPM_01.wav`
- `AZ_SNR_LayeredCrack_01.wav`
- `AZ_808_DistortedSlide_Cmin_142BPM_01.wav`
- `AZ_DLP_BoomBapSoul_092BPM_4Bars_01.wav`

---

## 🐙 8. Synchronisation Git & Dépôt `propann/az-sample`

### Méthode 1 : Push Direct en 1 Clic (Recommandé)
1. Ouvrez **`🐙 GIT PUSH`**.
2. Renseignez votre GitHub Personal Access Token (PAT avec scope `repo`).
3. Cliquez sur **`Pousser vers propann/az-sample`**.
4. L'application crée les commits, les blobs audio et met à jour la branche `main` instantanément.

### Méthode 2 : Téléchargement du Pack Git-Ready
1. Cliquez sur **`Télécharger Package Git-Ready (.zip)`**.
2. Décompressez l'archive dans votre répertoire local.
3. Exécutez le script automatique :
   ```bash
   chmod +x scripts/push_to_az_sample.sh
   ./scripts/push_to_az_sample.sh
   ```

### Méthode 3 : Commandes Manuelles en Ligne de Commande
```bash
# 1. Cloner le dépôt officiel
git clone https://github.com/propann/az-sample.git
cd az-sample

# 2. Configurer Git LFS pour les fichiers audio lourds
git lfs install
git lfs track "*.wav" "*.aif"

# 3. Ajouter les nouveaux samples rangés
git add .
git commit -m "feat(samples): synchronize curated library & OP-1 kits"

# 4. Pousser vers GitHub
git push origin main
```

---

## ⌨️ 9. Raccourcis Clavier & Productivité

| Raccourci | Action |
| :--- | :--- |
| <kbd>Espace</kbd> | Lecture / Pause du sample sélectionné |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Naviguer vers le sample précédent / suivant |
| <kbd>Ctrl</kbd> + <kbd>O</kbd> | Réactiver le dossier de travail |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> | Ouvrir le traitement du dossier de travail |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Ouvrir le Studio Auto-Curateur & Rangement DSP |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Découper le sample actif (Slicer) |
| <kbd>Ctrl</kbd> + <kbd>G</kbd> | Ouvrir le Hub de Synchronisation GitHub |
| <kbd>1</kbd> à <kbd>8</kbd> | Déclencher les tranches dans le Slicer |
| <kbd>+</kbd> / <kbd>-</kbd> | Transposer le pitch (-12 à +12 demi-tons) |
| <kbd>F</kbd> | Ajouter / Retirer des favoris |
| <kbd>Suppr</kbd> | Supprimer le sample de la bibliothèque active |

---
*Engineering Studio — Conçu pour une exécution sans compromis, une fidélité acoustique totale et une organisation sans faille.*
