# Resonance - audit et feuille de route (01/09/2026)

> **Historique (2026-09-01, avant la refonte Electron).** État courant : voir `docs/CONTINUATION.md`.

## Etat actuel

### Bibliotheque et dossiers
- [x] Dossier de travail persistant via File System Access API.
- [x] Creation de `00_RECEPTION`, `01_ONE_SHOTS`, `02_LOOPS`, `03_HARDWARE` et `_MANIFEST`.
- [x] Scan recursif, classement loops/one-shots/OP-1, renommage unique et manifeste JSON.
- [x] Suppression des sources apres transfert confirme et nettoyage des dossiers vides.
- [x] Reconnexion, reprise apres interruption et compteurs relus depuis le disque.

### Edition et analyse
- [x] Lecture, navigation, forme d'onde, BPM, tonalite, pitch, loudness, spectre et tags.
- [x] Slicer avec transitoires, zero-crossing et export de tranches.
- [x] Conversion WAV, normalisation EBU R128 et presets DSP.
- [x] Rack DSP avec sauvegarde des rendus en nouveaux samples.
- [x] Renommage en masse, favoris, filtres et vue timbre.

### Creation et hardware
- [x] Creator principal : 10 couches, ADSR, gain, pan, detune, clavier et MIDI.
- [x] Moteurs Tone.js : synth, FM, AM, membrane, metal, pluck et noise.
- [x] Banque repliable et glisser-deposer depuis la bibliotheque.
- [x] Second rack a la demande avec 10 familles : Dexed, Mutable, Surge, chiptune, granular et sampler.
- [x] Builder OP-1, export EP-133. (La synchronisation GitHub des sons a été retirée le 2026-09-04 : les sons restent sur la machine, dans le dossier de travail.)

## Ecarts connus

- Les cartes Dexed/Mutable du second rack sont preparees cote UI et persistance, mais leurs vrais bridges WASM/WebAudio ne sont pas encore embarques.
- Les sources upstream sont maintenant presentes dans `vendor/dexed` et `vendor/mutable-eurorack`, avec commits et licences references dans `vendor/README.md`.
- Le contrat `EngineBridge` et le chargeur dynamique sont en place dans `src/services/engineBridge.ts` ; les binaires sont attendus dans `public/engines/<id>/`.
- Le routage live des effets dans le Creator reste a finaliser ; le rack DSP fonctionne sur les samples rendus/importes.
- Le bundle principal Vite reste au-dessus de 500 kB ; les moteurs lourds sont deja en chunks charges a la demande.
- Les tests automatises audio et File System Access sont encore a ajouter ; lint, build et smoke test navigateur passent.

## Prochaines etapes

1. Compiler un bridge Dexed WASM isole, charge uniquement a l'activation.
2. Ajouter un premier modele Mutable (Plaits ou Braids), puis Rings/Clouds.
3. Brancher les bus Creator vers un master DSP avec limiteur et mesure anti-clipping.
4. Ajouter les tests de transfert : doublon, erreur, interruption, reprise et suppression.
5. Ajouter le rendu d'un pattern MIDI/loop et sa reanalyse automatique.
6. Produire les packages Electron Windows/macOS/Linux apres telechargement du binaire Electron.

## Regle produit

Le dossier de travail est la source de verite. Resonance lit, traite et ecrit dans ce dossier ; une source n'est supprimee qu'apres ecriture et manifeste confirmes.
