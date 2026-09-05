# Resonance — état et feuille de route

> Dernière revue : **2026-09-05**. État détaillé et journal des sessions :
> `docs/CONTINUATION.md`. Historique complet : `git log`.

## Ce que fait l'application

Une station de gestion de samples en Electron : elle range une bibliothèque
sur disque, analyse ce qu'on lui donne, l'édite, et fabrique du son.

Portes de vérification à chaque commit :
`tsc --noEmit` · `eslint .` (0 erreur) · `vitest run` (**207 tests**) · `vite build`.

## État réel

### Bibliothèque et rangement — solide

- [x] Dossier de travail persistant, arborescence créée au démarrage.
- [x] Ingestion depuis `00_RECEPTION`, sous-dossiers compris, par lots.
- [x] Analyse : type, BPM, tonalité, LUFS, transitoires, timbre.
- [x] Nommage normalisé, manifeste journalisé, dé-duplication par hash.
- [x] **Tri par déplacement** (`librarySorter`) : range toute la bibliothèque
      sans re-décoder un octet. Vérifié sur 252 564 fichiers.
- [x] Une source n'est supprimée qu'après écriture **et** manifeste confirmés.

### Édition — fonctionnelle, mais sans filet

- [x] Onde avec zoom, spectre, zones, ligne de volume, fondus, poignées.
- [x] Découpe par transitoires, calage sur les passages à zéro.
- [x] Conversion, normalisation EBU R128, presets DSP.
- [ ] **`WaveformCanvas` (1 935 l) n'a aucun test.** Voir les urgences.

### Atelier — refondu le 2026-09-04

- [x] Colonne unique à droite de l'onde, en arborescence : MOTEURS / EFFETS /
      PATCHES / ARPÉGIATEUR / SÉQUENCEUR. Elle remplace trois fenêtres qui se
      recouvraient.
- [x] Rack modulaire **temps réel** monté en permanence : un paramètre modifié
      s'entend au bloc suivant, sans reconstruire la chaîne.
- [x] 27 modules DSP, 10 chaînes toutes faites, banc de test des effets.
- [x] Moteurs **jouables** au clavier PC et au MIDI, un bouton pour basculer.
- [x] Arpégiateur (5 modes, 1–4 octaves) et séquenceur 16 pas, calés sur
      l'horloge audio.

### Moteurs natifs — débloqués le 2026-09-04

Le blocage ne venait pas d'Emscripten mais de `stmlib`, sous-module git vide.

| Moteur | Taille | Modèles | Type |
|---|---|---|---|
| Plaits | 296 ko | 16 | voix |
| Rings | 104 ko | 6 | résonateur |
| Clouds | 156 ko | 3 (sur 4) | processeur |
| Elements | 556 ko | 4 | modélisation physique |

29 modèles, aucun dans le bundle : chacun est chargé à la première ouverture
de son dossier. Ajouter un moteur : un shim C, un `case` dans
`tools/build-engine.sh`, un `bridge.js`, une ligne dans `NATIVE_ENGINES`.

### Hardware

- [x] Encodeur OP-1 OG (drum + sampler), 14 tests.
- [x] **Kit OP-1 en un clic** depuis un moteur : composite 12 s, 24 pads,
      marqueurs déplaçables sur l'onde, `.aif` écrit dans
      `03_HARDWARE/OP-1_DRUM_PATCHES`.
- [x] Réenregistrement du patch après déplacement des marqueurs.
- [x] Studio OP-1 manuel : glisser-déposer sur les pads, réordonnancement,
      pitch / reverse / playmode / volume par pad.
- [x] Export EP-133 K.O. II.
- [ ] **Jamais vérifié sur la machine.** Voir les urgences.

## Urgences, par ordre

### 1. Vérifier un patch sur l'OP-1 réel

Tout l'édifice OP-1 repose sur un encodeur dont les constantes n'ont jamais
été confirmées sur l'appareil (`reverse: 19968`, `playmode: 20480`,
`drum_version: 2`). C'est le seul endroit où l'on peut avoir entièrement tort
sans le savoir : les tests vérifient qu'on écrit ce qu'on croit devoir écrire,
pas que la machine le lise. `03_HARDWARE` contient **0 fichier** — la chaîne
n'a jamais servi pour de vrai.

Coût : écrire un kit, le copier sur l'OP-1, écouter. Une heure.

### 2. Mettre `WaveformCanvas` sous test

1 935 lignes, aucun test, et c'est là que va toute la suite : l'onde est
censée devenir la fenêtre d'édition unique du système. Chaque ajout y est un
pari. Les maths pures (enveloppes, zones, fondus) sont déjà extraites dans
`waveform/gainEnvelope.ts` et testées — il faut continuer à sortir la logique
du composant plutôt que d'essayer de tester le rendu.

### 3. Relier le kit rapide au studio OP-1

Ils s'ignorent. Le kit rapide pose 24 pads dans l'ordre avec des réglages par
défaut ; le studio sait glisser, réordonner et régler chaque pad — mais on ne
peut pas passer de l'un à l'autre. C'est la moitié manquante de « on déplace
simplement le patch pour superposer ».

### 4. Paralléliser l'ingestion

~51 fichiers/min, mono-thread dans le rendu. Des Web Workers diviseraient le
temps par 4 à 8. Reporté volontairement le 2026-09-04 : la justesse du tri
d'abord.

## Défauts connus, assumés

- **Clouds, mode « étirement temporel »** : rend du silence. Retiré de la
  liste plutôt qu'exposé muet. Deux hypothèses écartées avec mesures (voir
  `CONTINUATION.md`) ; piste restante : la taille du tampon.
- **Elements, « voix ominous » + archet** : muet, et c'est correct — cette
  synthèse n'utilise pas cet exciteur. Le modèle sonne à la frappe.
- **Bundle principal 498 ko** : la colonne étant toujours montée, les modules
  du rack se chargent au démarrage. C'est le prix du temps réel permanent.
- **Dexed** : pas compilé. JUCE est une autre affaire que Plaits. Le contrat
  `EngineBridge` le nomme déjà, la place est prête.
- **157 warnings eslint**, 0 erreur. Concentrés dans `AutoCuratorModal` (20),
  `synthRackEngine` (18), `WaveformCanvas` (17), `App` (15).

## Règle produit

Le dossier de travail est la source de vérité. Resonance lit, traite et écrit
dedans ; une source n'est supprimée qu'après écriture et manifeste confirmés.
