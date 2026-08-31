# 🏷️ Standard Naming Convention & Curation Guidelines (`az-sample`)

> **Projet :** `propann/az-sample` & **Engineering Studio**  
> **Auteur / Mainteneur :** Engineering Studio Audio Architecture  
> **Version de la norme :** `2.4.0 (Studio Production Master)`  
> **Statut :** Norme officielle de catalogage, d'encodage et de synchronisation

---

## 🎯 1. Philosophie & Objectifs de la Norme

La convention de nommage et de curation **az-sample** a été formulée pour résoudre définitivement les problématiques récurrentes dans la production musicale moderne et l'utilisation de samplers hardware :

1. **Lisibilité Universelle :** Identification immédiate du type de son, de sa note harmonique fondamentale ($f_0$), de son tempo (BPM) et de ses spécifications acoustiques sans devoir ouvrir un DAW.
2. **Compatibilité Hardware & Samplers Sans Faille :** Zéro crash ou troncature sur Teenage Engineering (OP-1 OG / OP-1 Field, EP-133 K.O. II), Akai MPC, Roland SP-404MKII, Elektron Digitakt, Polyend Tracker.
3. **Zéro Prolifération de Dossiers :** Organisation concentrée autour de **7 Dossiers Fondamentaux**, interdisant la création anarchique de sous-dossiers inutiles.
4. **Indexation Algorithmique & Git :** Tri alphabétique naturel, intégration Git LFS propre, et métadonnées JSON standardisées.

---

## 📐 2. Syntaxe Formelle du Nom de Fichier

Chaque sample normalisé répond au gabarit d'ingénierie suivant :

```
[PREFIX]_[TYPE]_[DESCRIPTIVE_NAME]_[KEY]_[BPM]_[FORMAT]_[INDEX].wav
```

### Exemple Décomposé :
```
AZ_KCK_PunchyHard_F#m_140BPM_24b48k_01.wav
│  │   │          │   │      │      └── Index séquentiel (2 chiffres)
│  │   │          │   │      └────────── Format (24 bits / 48 kHz)
│  │   │          │   └───────────────── Tempo détecté en BPM
│  │   │          └───────────────────── Tonalité / Clé harmonique (F# minor)
│  │   └──────────────────────────────── Nom descriptif timbral (CamelCase)
│  └──────────────────────────────────── Code abrégé d'instrument (Kick)
└─────────────────────────────────────── Préfixe de studio / sound-bank
```

---

## 🗂️ 3. Table des Préfixes & Codes d'Instruments (`TYPE`)

| Code 3L | Type d'Instrument | Catégorie | Dossier Cible | Plage de Fréquences Typique |
| :--- | :--- | :--- | :--- | :--- |
| `KCK` | Grosse Caisse (Kick) | One-Shot | `01_DRUMS/` | 40 Hz – 4 kHz |
| `SNR` | Caisse Claire (Snare) | One-Shot | `01_DRUMS/` | 150 Hz – 8 kHz |
| `CLP` | Clap / Handclap | One-Shot | `01_DRUMS/` | 400 Hz – 10 kHz |
| `HAT` | Hi-Hat (Fermé / Ouvert) | One-Shot | `01_DRUMS/` | 3 kHz – 18 kHz |
| `CYM` | Cymbale (Crash / Ride) | One-Shot | `01_DRUMS/` | 2 kHz – 20 kHz |
| `PRC` | Percussion (Tom, Bongo, Shaker) | One-Shot | `01_DRUMS/` | 80 Hz – 12 kHz |
| `808` | Sub 808 Saturé / Trap Bass | One-Shot | `02_BASS_808/` | 25 Hz – 250 Hz |
| `BAS` | Basse Synthé / Acoustic Bass | One-Shot | `02_BASS_808/` | 35 Hz – 2 kHz |
| `SYN` | Synth Lead / Pluck / Key | One-Shot | `03_MELODIC/` | 200 Hz – 14 kHz |
| `PAD` | Nappe / Chord / Ambient Pad | One-Shot | `03_MELODIC/` | 100 Hz – 12 kHz |
| `VOC` | Vocal Chop / Vox FX / Chant | One-Shot | `04_VOCALS/` | 200 Hz – 8 kHz |
| `SFX` | Effet Sonore / Riser / Impact | One-Shot | `05_FX_TEXTURES/` | 20 Hz – 20 kHz |
| `TEX` | Texture Foley / Bruit de fond | One-Shot | `05_FX_TEXTURES/` | 50 Hz – 16 kHz |
| `LOP` | Boucle Complète (Full Loop) | Loop | `06_LOOPS/` | Full Spectrum |
| `DLP` | Boucle de Batterie (Drum Loop) | Loop | `06_LOOPS/` | Full Spectrum |
| `MLP` | Boucle Mélodique (Melody Loop) | Loop | `06_LOOPS/` | Full Spectrum |
| `FLP` | Boucle de Tranches (Sliced Loop) | Loop | `06_LOOPS/` | Full Spectrum |
| `INS` | Instrument Acoustique / Guitare / Piano | One-Shot | `07_INSTRUMENTS/` | 80 Hz – 15 kHz |

---

## 🎼 4. Standardisation des Notes & Clés Musicales (`KEY`)

Pour éviter toute ambiguïté de notation (altérations bémols/dièses ou casse), la norme **az-sample** applique la table ISO suivante :

| Note Fondamentale | Majeur (Symbole) | Mineur (Symbole) | Exemple Fichier |
| :--- | :--- | :--- | :--- |
| **Do** | `Cmaj` | `Cmin` (ou `Cm`) | `AZ_SYN_ClassicLead_Cmin_120BPM_01.wav` |
| **Do Dièse / Ré Bémol** | `C#maj` | `C#min` | `AZ_808_DeepSub_C#min_140BPM_01.wav` |
| **Ré** | `Dmaj` | `Dmin` | `AZ_BAS_AcidReso_Dmin_130BPM_01.wav` |
| **Ré Dièse / Mi Bémol** | `D#maj` / `Ebmaj` | `D#min` / `Ebmin` | `AZ_PAD_Ethereal_Ebmin_095BPM_01.wav` |
| **Mi** | `Emaj` | `Emin` | `AZ_INS_AcousticRiff_Emin_110BPM_01.wav` |
| **Fa** | `Fmaj` | `Fmin` | `AZ_808_Rumble_Fmin_142BPM_01.wav` |
| **Fa Dièse / Sol Bémol** | `F#maj` | `F#min` | `AZ_KCK_TunedSub_F#min_128BPM_01.wav` |
| **Sol** | `Gmaj` | `Gmin` | `AZ_SYN_AnalogSaw_Gmin_124BPM_01.wav` |
| **Sol Dièse / La Bémol** | `G#maj` / `Abmaj` | `G#min` / `Abmin` | `AZ_VOC_ChopReverb_Abmin_120BPM_01.wav` |
| **La** | `Amaj` | `Amin` | `AZ_LOP_TrapFlute_Amin_135BPM_01.wav` |
| **La Dièse / Si Bémol** | `A#maj` / `Bbmaj` | `A#min` / `Bbmin` | `AZ_PAD_VintageRhodes_Bbmaj_088BPM_01.wav` |
| **Si** | `Bmaj` | `Bmin` | `AZ_808_Distorted_Bmin_145BPM_01.wav` |

*Règle pour les sons percussifs non accordés (Claps, Shakers, FX bruits blancs) :* le segment `[KEY]` est simplement omis (ex: `AZ_CLP_TightSmack_24b48k_01.wav`).

---

## 🎛️ 5. Standardisation du Tempo (`BPM`) & des Mesures (`BARS`)

- **Notation Unique :** Toujours suivi de `BPM` sans espace (ex : `120BPM`, `140BPM`, `87BPM`).
- **Pour les Boucles (Loops) :** Précision optionnelle du nombre de mesures entre parenthèses ou en suffixe (ex : `AZ_LOP_AfroGroove_105BPM_4Bars_01.wav`).
- **One-Shots Sans Tempo Spécifique :** Le tag BPM est omis pour garder le nom concis.

---

## 🔬 6. Ontologie des Descripteurs Acoustiques & DSP (`TAGS`)

Le moteur d'analyse DSP extrait automatiquement des métadonnées psychoacoustiques objectives intégrées dans le catalogue `manifest.json` et les tags du fichier :

```
┌─────────────────┬──────────────────────────────────┬─────────────────────────────┐
│ Tag Timbral     │ Critère Mesuré DSP               │ Application Idéale          │
├─────────────────┼──────────────────────────────────┼─────────────────────────────┤
│ punchy          │ Attaque ≤ 10ms & Dynamique ≥ 7dB │ Kicks, Snares percutants    │
│ warm            │ Centroïde Spectral < 1200 Hz     │ Basses rondes, Pads feutrés │
│ bright          │ Centroïde Spectral > 3600 Hz     │ Hi-Hats clairs, Leads EDM   │
│ sub-heavy       │ Énergie < 80 Hz > 45%            │ 808s, Sub Kicks             │
│ crisp           │ ZCR élevé & High-Energy > 40%    │ Shakers, Claps secs         │
│ saturated       │ Dynamique < 6.5dB & RMS > -13dB  │ 808s distordus, Drum crush  │
│ tight           │ Déclin rapide (< 180ms)          │ Percussions sèches, Rimshots│
│ sustained       │ Déclin long (> 550ms) ou sustain │ Crashs, Nappes d'accords    │
└─────────────────┴──────────────────────────────────┴─────────────────────────────┘
```

---

## 📂 7. Arborescence Cible des 7 Dossiers Studio

Pour bannir l'éparpillement des fichiers, la bibliothèque **propann/az-sample** est obligatoirement structurée en **7 dossiers racines immuables** :

```
az-sample/
├── 01_DRUMS/             # Kicks, Snares, Claps, HiHats, Cymbals, Percussions
├── 02_BASS_808/          # Basses analogiques, 808 subs accordés, Acid basslines
├── 03_MELODIC/           # Synthétiseurs, Leads, Pads, Chords, Plucks
├── 04_VOCALS/            # Vocal chops, Hooks, One-shots de voix, Ad-libs
├── 05_FX_TEXTURES/       # Risers, Impacts, Textures ambiantes, Foley, Bruits blancs
├── 06_LOOPS/             # Boucles rythmiques et mélodiques avec tempo & bar count
└── 07_INSTRUMENTS/       # Guitares, Pianos, Cuivres, Éléments acoustiques réels
```

### Sous-dossiers autorisés :
Seuls des sous-dossiers par instrument direct ou par pack peuvent être créés à l'intérieur de ces 7 racines (ex : `01_DRUMS/Kicks/`, `01_DRUMS/Snares/`). Aucune sous-arborescence profonde à plus de 2 niveaux n'est tolérée.

---

## 🎚️ 8. Spécifications Audio & Hardware

### Master Studio Standard
- **Format de conteneur :** WAV (PCM Linear)
- **Résolution :** **24-bit** ou **16-bit**
- **Fréquence d'échantillonnage :** **48.0 kHz** ou **44.1 kHz**
- **Normalisation Loudness :** EBU R128 (-14.0 LUFS ± 0.5 pour les loops, -18.0 LUFS pour les one-shots)
- **True Peak :** Plafond strict à **-0.5 dBFS** (marge de sécurité anti-intersample clipping)
- **DC Offset :** Éliminé à 100% (High-pass 15 Hz 48dB/oct)

### Profil Teenage Engineering OP-1 (OG & Field)
- **Conteneur :** AIFF (`.aif`)
- **Format interne :** 44.1 kHz / 16-bit
- **Budget temps maximal :** **12.0 secondes cumulées** (limite tampon RAM hardware OP-1 OG)
- **Tranches :** Exactement **24 pads** balisés dans le chunk JSON propriétaire `op-1 drum snapshot` (start/end `0..4095`).

### Profil Teenage Engineering EP-133 K.O. II
- **Conteneur :** WAV (`.wav`) Mono ou Stéréo
- **Numérotation des slots :** `sound_001.wav` à `sound_099.wav` (ou `AZ_001_KCK.wav`)
- **Fréquence optimale :** 46.875 kHz ou 44.1 kHz 16-bit PCM

---

## 🚫 9. Règles Strictes d'Assainissement & Anti-Erreurs (Sanitizer)

1. **Caractères Interdits Remplacés Automatiquement :**  
   Les caractères `\`, `/`, `:`, `*`, `?`, `"`, `<`, `>`, `|`, `#`, `@`, `!`, `$` sont automatiquement nettoyés ou transcrits (`#` devient `sharp` ou est accepté uniquement dans le tag de note musicale `C#`).
2. **Espaces & Séparateurs :**  
   Tous les espaces consécutifs sont remplacés par un tiret bas unique (`_`). Pas de double tiret bas (`__`).
3. **Accents & Diacritiques :**  
   Remplacement par leur équivalent ASCII simple (`é` $\to$ `e`, `à` $\to$ `a`, `ç` $\to$ `c`).
4. **Longueur Maximale :**  
   Le nom de fichier total ne doit jamais dépasser **64 caractères** pour éviter les coupures sur les écrans OLED hardware.

---

## 🔄 10. Table de Comparaison Avant / Après

| Nom de Fichier Brut (Avant) | Nom Conforme `az-sample` (Après) | Dossier Cible |
| :--- | :--- | :--- |
| `my dirty kick (new) [1].wav` | `AZ_KCK_DirtyPunch_24b48k_01.wav` | `01_DRUMS/` |
| `808 sub bass in F# minor 140 bpm.wav` | `AZ_808_HeavySub_F#min_140BPM_01.wav` | `02_BASS_808/` |
| `Vintage Rhodes Chord Progression 90bpm.wav`| `AZ_PAD_VintageRhodes_Dmaj_090BPM_01.wav`| `03_MELODIC/` |
| `vocal chop hey trap fx.wav` | `AZ_VOC_HeyChop_Amin_130BPM_01.wav` | `04_VOCALS/` |
| `EDM Riser 8 bars pitch up.wav` | `AZ_SFX_RiserTension_128BPM_8Bars_01.wav` | `05_FX_TEXTURES/` |
| `DrumLoop_Boombap_92_Full.wav` | `AZ_DLP_BoomBapGroove_092BPM_4Bars_01.wav`| `06_LOOPS/` |
| `Nylon Guitar Solo Lick A minor.wav` | `AZ_INS_NylonGuitarLick_Amin_110BPM_01.wav`| `07_INSTRUMENTS/` |

---
*Ce document est la spécification de référence pour l'ensemble des scripts de build, de l'auto-curateur DSP et de la synchronisation Git dans **Engineering Studio**.*
