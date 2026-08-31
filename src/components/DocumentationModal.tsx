import React, { useState } from 'react';
import {
  BookOpen,
  X,
  FileCode,
  FolderTree,
  Activity,
  Cpu,
  Github,
  Keyboard,
  CheckCircle2,
  Copy,
  Sparkles,
  ExternalLink,
  Music,
  Waves,
  Sliders,
  Layers,
  Terminal,
} from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAutoCurator?: () => void;
  onOpenGitHubSync?: () => void;
}

type TabType = 'overview' | 'naming' | 'folders' | 'dsp' | 'hardware' | 'git' | 'shortcuts';

export const DocumentationModal: React.FC<DocumentationModalProps> = ({
  isOpen,
  onClose,
  onOpenAutoCurator,
  onOpenGitHubSync,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const navTabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Vue Studio & Guide', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'naming', label: 'Convention de Nommage', icon: <FileCode className="w-3.5 h-3.5" /> },
    { id: 'folders', label: '7 Dossiers Épurés', icon: <FolderTree className="w-3.5 h-3.5" /> },
    { id: 'dsp', label: 'Normes DSP & LUFS', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'hardware', label: 'OP-1 & EP-133 Kits', icon: <Cpu className="w-3.5 h-3.5" /> },
    { id: 'git', label: 'GitHub az-sample', icon: <Github className="w-3.5 h-3.5" /> },
    { id: 'shortcuts', label: 'Raccourcis Clavier', icon: <Keyboard className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      id="documentation-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="documentation-modal-container"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0c1017] border-2 border-[#00F0FF]/40 w-full max-w-5xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="bg-[#121824] border-b border-[#00F0FF]/30 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00F0FF]/15 border border-[#00F0FF]/40 rounded text-[#00F0FF]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-pixel text-base text-white tracking-wide">
                  DOCUMENTATION OFFICIELLE & CONVENTIONS STUDIO
                </h2>
                <span className="px-2 py-0.5 bg-[#00F0FF]/20 text-[#00F0FF] text-[9px] font-pixel border border-[#00F0FF]/40">
                  v2.4.0 MASTER
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">
                Référence complète de nommage, architecture 7 dossiers, laboratoire DSP et sync propann/az-sample
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition"
            title="Fermer (Échap)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-[#0f141f] border-b border-gray-800 px-4 flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#00F0FF] text-black font-bold shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-gray-200 text-sm font-sans leading-relaxed">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Hero Banner */}
              <div className="bg-gradient-to-r from-[#00F0FF]/15 via-[#A855F7]/15 to-transparent border border-[#00F0FF]/30 p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#00F0FF]" />
                    <h3 className="font-pixel text-sm text-[#00F0FF]">ENGINEERING STUDIO & RESONANCE</h3>
                  </div>
                  <p className="text-xs text-gray-300">
                    Station de travail audio numérique dédiée au tri instantané, à l'analyse spectrale DSP, au formatage
                    acoustique de précision et à la publication Git.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenAutoCurator && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenAutoCurator();
                      }}
                      className="px-3 py-1.5 bg-[#00F0FF] text-black font-pixel text-[10px] font-bold rounded hover:bg-[#00F0FF]/80 transition flex items-center gap-1.5 shadow"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      LANCER LE CURATEUR
                    </button>
                  )}
                  {onOpenGitHubSync && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenGitHubSync();
                      }}
                      className="px-3 py-1.5 bg-[#A855F7] text-white font-pixel text-[10px] font-bold rounded hover:bg-[#A855F7]/80 transition flex items-center gap-1.5 shadow"
                    >
                      <Github className="w-3.5 h-3.5" />
                      GIT SYNC
                    </button>
                  )}
                </div>
              </div>

              {/* ASCII Visual Interface Overview */}
              <div>
                <h4 className="font-pixel text-xs text-gray-300 mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#00F0FF]" />
                  VUE GLOBALE DE L'INTERFACE STUDIO (ASCII VIEW)
                </h4>
                <pre className="bg-black/80 border border-gray-800 rounded p-4 text-[11px] font-mono text-[#00F0FF] overflow-x-auto leading-tight selection:bg-[#00F0FF]/30">
{`┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🎛️ RESONANCE STUDIO   │  Fichier  Édition  Audio/DSP  Hardware  Vue  Aide  │  [● RECORD LIVE]│
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🔍 [Rechercher sample, note, bpm...] │ [⚡ CURATEUR PRO]  [✂️ SLICER]  [🎚️ OP-1]  [🐙 GIT PUSH] │
├──────────────────────────┬──────────────────────────────────────────────────────────────────┤
│ 📂 ARBORESCENCE STUDIO   │ 📊 SAMPLE MASTER : AZ_KCK_PunchyHard_F#m_140BPM_01.wav           │
│ ├─ 01_DRUMS              │ ┌──────────────────────────────────────────────────────────────┐ │
│ ├─ 02_BASS_808           │ │  /\\_/\\    /\\  /\\_/\\    /\\  /\\_/\\    /\\  /\\_/\\                │ │
│ ├─ 03_MELODIC            │ │ /    \\  /  \\/    \\  /  \\/    \\  /  \\/    \\   [ 00:00.428s ]  │ │
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
└──────────────────────────┴─┴────┴───────────────────────┴──────┴──────┴─────┴──────┴─────────┘`}
                </pre>
              </div>

              {/* 5-Step Workflow */}
              <div>
                <h4 className="font-pixel text-xs text-gray-300 mb-3 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#A855F7]" />
                  FLUX DE TRAVAIL RAPIDE EN 5 ÉTAPES
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {[
                    {
                      step: '1',
                      title: 'Import Brut',
                      desc: 'Glisser-déposer de fichiers audio ou scan d\'un dossier complet.',
                      color: 'border-blue-500/40 text-blue-400',
                    },
                    {
                      step: '2',
                      title: 'Analyse DSP',
                      desc: 'Détection auto de la clé (f0), tempo (BPM), LUFS et transitoires.',
                      color: 'border-[#00F0FF]/40 text-[#00F0FF]',
                    },
                    {
                      step: '3',
                      title: 'Curateur Pro',
                      desc: 'Formatage WAV 24b48k, suppression DC offset et renommage standardisé.',
                      color: 'border-purple-500/40 text-purple-400',
                    },
                    {
                      step: '4',
                      title: '7 Dossiers',
                      desc: 'Rangement immédiat sans arborescence tentaculaire.',
                      color: 'border-emerald-500/40 text-emerald-400',
                    },
                    {
                      step: '5',
                      title: 'Push GitHub',
                      desc: 'Synchronisation directe en 1 clic vers propann/az-sample.',
                      color: 'border-amber-500/40 text-amber-400',
                    },
                  ].map((item) => (
                    <div
                      key={item.step}
                      className={`bg-[#131926] border ${item.color} p-3 rounded flex flex-col justify-between`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-pixel text-xs text-white">ÉTAPE {item.step}</span>
                        <span className={`w-2 h-2 rounded-full bg-current ${item.color}`} />
                      </div>
                      <div className="font-bold text-xs text-white mb-1">{item.title}</div>
                      <p className="text-[11px] text-gray-400 leading-snug">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NAMING CONVENTION */}
          {activeTab === 'naming' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-pixel text-sm text-[#00F0FF] mb-1">SYNTAXE OFFICIELLE DU NOM DE FICHIER</h3>
                <p className="text-xs text-gray-400 font-mono">
                  Gabarit standardisé obligatoire pour assurer l'interopérabilité DAW & Hardware.
                </p>
              </div>

              {/* Template Card */}
              <div className="bg-[#121824] border border-[#00F0FF]/40 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-pixel text-gray-400">GABARIT AZ-SAMPLE MASTER</span>
                  <button
                    onClick={() => handleCopy('AZ_[TYPE]_[DESCRIPTIVE_NAME]_[KEY]_[BPM]_[FORMAT]_[INDEX].wav', 'template')}
                    className="flex items-center gap-1 text-[10px] font-mono text-[#00F0FF] hover:underline"
                  >
                    {copiedCode === 'template' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedCode === 'template' ? 'Copié !' : 'Copier le gabarit'}
                  </button>
                </div>
                <div className="bg-black/90 p-3 rounded font-mono text-sm text-[#00F0FF] border border-gray-800">
                  AZ_[TYPE]_[DESCRIPTIVE_NAME]_[KEY]_[BPM]_[FORMAT]_[INDEX].wav
                </div>
                <div className="text-xs text-gray-300 grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-gray-800 font-mono">
                  <div>• <b className="text-white">AZ</b> : Préfixe de la banque</div>
                  <div>• <b className="text-white">KCK / 808</b> : Code 3L instrument</div>
                  <div>• <b className="text-white">DeepPunch</b> : Nom timbral (CamelCase)</div>
                  <div>• <b className="text-white">F#min</b> : Tonalité musicale détectée</div>
                  <div>• <b className="text-white">140BPM</b> : Vitesse / Tempo</div>
                  <div>• <b className="text-white">01</b> : Numéro de version séquentielle</div>
                </div>
              </div>

              {/* Instrument Code Table */}
              <div>
                <h4 className="font-pixel text-xs text-gray-300 mb-2">TABLE DES CODES D'INSTRUMENTS (3 LETTRES)</h4>
                <div className="overflow-x-auto border border-gray-800 rounded">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#151c2c] text-gray-300 border-b border-gray-800">
                      <tr>
                        <th className="p-2.5">Code</th>
                        <th className="p-2.5">Instrument</th>
                        <th className="p-2.5">Catégorie</th>
                        <th className="p-2.5">Dossier Cible</th>
                        <th className="p-2.5">Exemple Fichier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 bg-[#0d121c]">
                      {[
                        { code: 'KCK', name: 'Grosse Caisse (Kick)', cat: 'One-Shot', folder: '01_DRUMS', ex: 'AZ_KCK_PunchyHard_01.wav' },
                        { code: 'SNR', name: 'Caisse Claire (Snare)', cat: 'One-Shot', folder: '01_DRUMS', ex: 'AZ_SNR_TightLayer_01.wav' },
                        { code: 'CLP', name: 'Clap / Handclap', cat: 'One-Shot', folder: '01_DRUMS', ex: 'AZ_CLP_SmackTape_01.wav' },
                        { code: 'HAT', name: 'Hi-Hat (Closed/Open)', cat: 'One-Shot', folder: '01_DRUMS', ex: 'AZ_HAT_CrispTop_01.wav' },
                        { code: 'CYM', name: 'Cymbale Crash / Ride', cat: 'One-Shot', folder: '01_DRUMS', ex: 'AZ_CYM_DarkWash_01.wav' },
                        { code: 'PRC', name: 'Percussion / Tom', cat: 'One-Shot', folder: '01_DRUMS', ex: 'AZ_PRC_BongoTuned_01.wav' },
                        { code: '808', name: 'Sub 808 Saturé / Slide', cat: 'One-Shot', folder: '02_BASS_808', ex: 'AZ_808_DeepRumble_Cmin_140BPM_01.wav' },
                        { code: 'BAS', name: 'Basse Synthé / Acoustique', cat: 'One-Shot', folder: '02_BASS_808', ex: 'AZ_BAS_AcidSaw_F#min_130BPM_01.wav' },
                        { code: 'SYN', name: 'Synth Lead / Pluck', cat: 'One-Shot', folder: '03_MELODIC', ex: 'AZ_SYN_VintageLead_Amin_120BPM_01.wav' },
                        { code: 'PAD', name: 'Nappe / Chord Pad', cat: 'One-Shot', folder: '03_MELODIC', ex: 'AZ_PAD_WarmRhodes_Ebmaj_090BPM_01.wav' },
                        { code: 'VOC', name: 'Vocal Chop / Vox FX', cat: 'One-Shot', folder: '04_VOCALS', ex: 'AZ_VOC_HeyTrap_Amin_130BPM_01.wav' },
                        { code: 'SFX', name: 'Effet / Riser / Impact', cat: 'One-Shot', folder: '05_FX_TEXTURES', ex: 'AZ_SFX_TensionRiser_128BPM_01.wav' },
                        { code: 'LOP', name: 'Boucle Complète (Full Loop)', cat: 'Loop', folder: '06_LOOPS', ex: 'AZ_LOP_AfroGroove_105BPM_4Bars_01.wav' },
                        { code: 'DLP', name: 'Boucle de Batterie', cat: 'Loop', folder: '06_LOOPS', ex: 'AZ_DLP_BoomBapSoul_092BPM_01.wav' },
                        { code: 'INS', name: 'Instrument Acoustique', cat: 'One-Shot', folder: '07_INSTRUMENTS', ex: 'AZ_INS_AcousticGuitarLick_Emin_01.wav' },
                      ].map((row) => (
                        <tr key={row.code} className="hover:bg-white/5 transition">
                          <td className="p-2.5 font-bold text-[#00F0FF]">{row.code}</td>
                          <td className="p-2.5 text-gray-200">{row.name}</td>
                          <td className="p-2.5 text-gray-400">{row.cat}</td>
                          <td className="p-2.5 text-purple-400 font-bold">{row.folder}</td>
                          <td className="p-2.5 text-gray-400 text-[11px]">{row.ex}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 7 FOLDERS */}
          {activeTab === 'folders' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-pixel text-sm text-[#00F0FF] mb-1">LES 7 DOSSIERS FONDAMENTAUX DU STUDIO</h3>
                <p className="text-xs text-gray-400 font-mono">
                  Fin de la prolifération anarchique des dossiers. Une arborescence plate, directe et universelle.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    name: '01_DRUMS',
                    desc: 'Kicks, Snares, Claps, Hi-Hats, Cymbales, Percussions et Toms.',
                    specs: 'One-shots percussifs non accordés ou accordés.',
                    icon: '🥁',
                  },
                  {
                    name: '02_BASS_808',
                    desc: 'Basses analogiques, 808 subs accordés avec note fondamentale f0 et distorsions harmoniques.',
                    specs: 'Accords précis (Cmin, F#min) & gestion sub < 80Hz.',
                    icon: '🔊',
                  },
                  {
                    name: '03_MELODIC',
                    desc: 'Synthétiseurs, Leads, Nappes d\'accords (Pads), Plucks et Keys.',
                    specs: 'Tonalité fondamentale et richesse spectrale.',
                    icon: '🎹',
                  },
                  {
                    name: '04_VOCALS',
                    desc: 'Vocal chops découpés, hooks, one-shots de voix et phrases traitées.',
                    specs: 'Alignement de clé et traitement anti-sibilance.',
                    icon: '🎙️',
                  },
                  {
                    name: '05_FX_TEXTURES',
                    desc: 'Risers, Impacts, Sweeps, Textures d\'ambiance, Foley et bruits analogiques.',
                    specs: 'Largeur stéréo et dynamique étendue.',
                    icon: '✨',
                  },
                  {
                    name: '06_LOOPS',
                    desc: 'Boucles rythmiques et mélodiques avec tempo précis (BPM) et nombre de mesures (Bars).',
                    specs: 'Bouclage parfait aux passages à zéro (Zero-Crossing).',
                    icon: '🔁',
                  },
                  {
                    name: '07_INSTRUMENTS',
                    desc: 'Guitares électriques/acoustiques, pianos de concert, cuivres, bois réels.',
                    specs: 'Enregistrement organique et dynamique naturelle.',
                    icon: '🎸',
                  },
                ].map((f) => (
                  <div key={f.name} className="bg-[#121824] border border-gray-800 p-4 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{f.icon}</span>
                      <h4 className="font-pixel text-sm text-white">{f.name}/</h4>
                    </div>
                    <p className="text-xs text-gray-300">{f.desc}</p>
                    <div className="text-[11px] font-mono text-[#00F0FF] bg-black/40 px-2 py-1 rounded border border-gray-800">
                      Spécification : {f.specs}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: DSP & LUFS */}
          {activeTab === 'dsp' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-pixel text-sm text-[#00F0FF] mb-1">NORMES ACOUSTIQUES DSP & LOUDNESS EBU R128</h3>
                <p className="text-xs text-gray-400 font-mono">
                  Garantie d'une qualité sonore de niveau Broadcast et protection auditive des musiciens.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                <div className="bg-[#121824] border border-[#00F0FF]/40 p-4 rounded space-y-2">
                  <div className="text-xs text-[#00F0FF] font-bold">LOUDNESS INTÉGRÉ</div>
                  <div className="text-2xl font-pixel text-white">-14.0 LUFS</div>
                  <p className="text-xs text-gray-400">
                    Cible EBU R128 appliquée par le moteur pour les loops et le master. (-18 LUFS pour les one-shots).
                  </p>
                </div>

                <div className="bg-[#121824] border border-purple-500/40 p-4 rounded space-y-2">
                  <div className="text-xs text-purple-400 font-bold">PLAFOND TRUE PEAK</div>
                  <div className="text-2xl font-pixel text-white">-0.5 dBFS</div>
                  <p className="text-xs text-gray-400">
                    Marge de sécurité stricte éliminant les risques de distorsion inter-échantillons (True Peak Clipping).
                  </p>
                </div>

                <div className="bg-[#121824] border border-emerald-500/40 p-4 rounded space-y-2">
                  <div className="text-xs text-emerald-400 font-bold">DC OFFSET FILTER</div>
                  <div className="text-2xl font-pixel text-white">0.00% DC</div>
                  <p className="text-xs text-gray-400">
                    Suppression intégrale du courant continu via filtre passe-haut de précision (15 Hz à 48dB/oct).
                  </p>
                </div>
              </div>

              {/* Timbral Tags Ontology */}
              <div>
                <h4 className="font-pixel text-xs text-gray-300 mb-2">ONTOLOGIE DES DESCRIPTEURS TIMBRAUX</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                  {[
                    { tag: 'punchy', rule: 'Attaque ≤ 10ms & Dynamique ≥ 7dB' },
                    { tag: 'warm', rule: 'Centroïde Spectral < 1200 Hz' },
                    { tag: 'bright', rule: 'Centroïde Spectral > 3600 Hz' },
                    { tag: 'sub-heavy', rule: 'Énergie < 80 Hz > 45%' },
                    { tag: 'crisp', rule: 'ZCR élevé & Haute énergie > 40%' },
                    { tag: 'saturated', rule: 'Dynamique < 6.5dB & RMS > -13dB' },
                    { tag: 'tight', rule: 'Déclin rapide (< 180ms)' },
                    { tag: 'sustained', rule: 'Déclin long (> 550ms) ou sustain' },
                  ].map((t) => (
                    <div key={t.tag} className="bg-[#131926] border border-gray-800 p-2.5 rounded">
                      <div className="text-[#00F0FF] font-bold">#{t.tag}</div>
                      <div className="text-[10px] text-gray-400">{t.rule}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HARDWARE */}
          {activeTab === 'hardware' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-pixel text-sm text-[#00F0FF] mb-1">INTÉGRATION HARDWARE TEENAGE ENGINEERING</h3>
                <p className="text-xs text-gray-400 font-mono">
                  Spécifications d'exportation prêtes pour OP-1 (OG / Field) et EP-133 K.O. II.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* OP-1 Builder */}
                <div className="bg-[#121824] border border-[#00F0FF]/40 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[#00F0FF]/20 text-[#00F0FF] rounded font-pixel text-xs">OP-1</div>
                    <h4 className="font-pixel text-sm text-white">OP-1 DRUM PATCH BUILDER (.aif)</h4>
                  </div>
                  <ul className="text-xs text-gray-300 space-y-1.5 font-mono">
                    <li>• <b className="text-white">Format :</b> Conteneur AIFF 44.1kHz 16-bit.</li>
                    <li>• <b className="text-white">Plafond Mémoire :</b> 12.0 secondes cumulées.</li>
                    <li>• <b className="text-white">Chunk Métadonnées :</b> <code className="text-[#00F0FF]">op-1 drum snapshot</code> JSON intégré (start/end 0..4095).</li>
                    <li>• <b className="text-white">Pads :</b> 24 tranches pré-assignées pour le clavier OP-1.</li>
                  </ul>
                  <div className="text-[11px] text-gray-400 bg-black/40 p-2.5 rounded border border-gray-800">
                    Déposez le fichier généré dans votre dossier <code className="text-[#00F0FF]">drum/user/</code> en mode Disk USB.
                  </div>
                </div>

                {/* EP-133 KO II */}
                <div className="bg-[#121824] border border-amber-500/40 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded font-pixel text-xs">EP-133</div>
                    <h4 className="font-pixel text-sm text-white">EP-133 K.O. II SOUND BANK</h4>
                  </div>
                  <ul className="text-xs text-gray-300 space-y-1.5 font-mono">
                    <li>• <b className="text-white">Numérotation :</b> <code className="text-amber-400">sound_001.wav</code> à <code className="text-amber-400">sound_099.wav</code>.</li>
                    <li>• <b className="text-white">Résolution :</b> 16-bit 46.875kHz ou 44.1kHz PCM.</li>
                    <li>• <b className="text-white">Canaux :</b> Mono sommé pour préserver la mémoire Flash du K.O. II.</li>
                    <li>• <b className="text-white">Loudness :</b> -14.0 LUFS harmonisé.</li>
                  </ul>
                  <div className="text-[11px] text-gray-400 bg-black/40 p-2.5 rounded border border-gray-800">
                    Importation directe via le Teenage Engineering Sample Tool officiel.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: GIT SYNC */}
          {activeTab === 'git' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-pixel text-sm text-[#00F0FF] mb-1">SYNCHRONISATION GITHUB (propann/az-sample)</h3>
                <p className="text-xs text-gray-400 font-mono">
                  Deux modes d'interaction : push direct sans quitter le navigateur ou commandes terminal.
                </p>
              </div>

              {/* Repo Link */}
              <div className="bg-[#121824] border border-purple-500/40 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-pixel text-xs text-white">DÉPÔT GITHUB OFFICIEL</div>
                  <a
                    href="https://github.com/propann/az-sample"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-[#00F0FF] hover:underline flex items-center gap-1 mt-0.5"
                  >
                    https://github.com/propann/az-sample.git
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {onOpenGitHubSync && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenGitHubSync();
                    }}
                    className="px-3 py-1.5 bg-[#A855F7] text-white font-pixel text-[10px] font-bold rounded hover:bg-[#A855F7]/80 transition flex items-center gap-1.5"
                  >
                    <Github className="w-3.5 h-3.5" />
                    OUVRIR LE MODULE DE SYNC
                  </button>
                )}
              </div>

              {/* Terminal CLI instructions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-pixel text-gray-300 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    COMMANDES CLI RAPIDES
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        'git clone https://github.com/propann/az-sample.git\ncd az-sample\ngit lfs install\ngit add .\ngit commit -m "feat(samples): sync studio library"\ngit push origin main',
                        'clicommands'
                      )
                    }
                    className="flex items-center gap-1 text-[10px] font-mono text-[#00F0FF] hover:underline"
                  >
                    {copiedCode === 'clicommands' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedCode === 'clicommands' ? 'Copié !' : 'Copier'}
                  </button>
                </div>
                <pre className="bg-black/90 p-3 rounded font-mono text-xs text-emerald-400 border border-gray-800 overflow-x-auto leading-relaxed">
{`# 1. Cloner le dépôt officiel
git clone https://github.com/propann/az-sample.git
cd az-sample

# 2. Configurer Git LFS pour les fichiers audio binaires
git lfs install
git lfs track "*.wav" "*.aif"

# 3. Synchroniser les nouveaux sons et kits
git add .
git commit -m "feat(samples): sync studio library & OP-1 kits"
git push origin main`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 7: SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-pixel text-sm text-[#00F0FF] mb-1">RACCOURCIS CLAVIER & COMMANDES EXPRESS</h3>
                <p className="text-xs text-gray-400 font-mono">
                  Gagnez du temps en pilotant Resonance au clavier comme un DAW professionnel.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                {[
                  { key: 'Espace', action: 'Lecture / Pause du sample actif' },
                  { key: '↑ / ↓', action: 'Naviguer dans la liste des sons' },
                  { key: 'Ctrl + O', action: 'Importer des fichiers audio' },
                  { key: 'Ctrl + Shift + O', action: 'Importer un dossier complet récursivement' },
                  { key: 'Ctrl + K', action: 'Ouvrir le Studio Auto-Curateur & Rangement DSP' },
                  { key: 'Ctrl + S', action: 'Ouvrir le Découpeur de Transitoires (Slicer)' },
                  { key: 'Ctrl + G', action: 'Ouvrir le Hub de Synchronisation GitHub' },
                  { key: '1 à 8', action: 'Déclencher les tranches dans le Slicer' },
                  { key: '+ / -', action: 'Transposer le pitch (-12 à +12 demi-tons)' },
                  { key: 'F', action: 'Ajouter / Retirer des favoris' },
                  { key: 'Suppr', action: 'Supprimer le sample de la bibliothèque' },
                  { key: 'Échap', action: 'Fermer la boîte de dialogue active' },
                ].map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between bg-[#121824] border border-gray-800 px-3.5 py-2.5 rounded hover:border-gray-700 transition"
                  >
                    <span className="text-gray-300">{s.action}</span>
                    <kbd className="px-2 py-1 bg-black/60 border border-[#00F0FF]/30 text-[#00F0FF] rounded font-pixel text-[10px]">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#121824] border-t border-gray-800 px-5 py-3 flex items-center justify-between text-xs text-gray-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
            <span>Resonance Audio Engine • Engineering Studio</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded font-pixel text-[10px] transition"
          >
            FERMER
          </button>
        </div>
      </div>
    </div>
  );
};
