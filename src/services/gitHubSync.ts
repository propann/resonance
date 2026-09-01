import JSZip from 'jszip';
import { SampleItem } from '../types/sample';
import { audioBufferToWavBlob } from './audioConverter';
import { batchGenerateOp1Kits } from './op1PatchEncoder';

export interface GitHubSyncConfig {
  repoUrl: string;
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  commitMessage: string;
  includeOp1Kits: boolean;
  includeEp133Pack: boolean;
  includeMasterWavs: boolean;
  normalizeLufs: boolean;
}

export interface SyncProgressUpdate {
  stage: 'preparing' | 'generating_kits' | 'creating_manifest' | 'building_tree' | 'uploading' | 'completed' | 'error';
  currentFile?: string;
  progressPercent: number;
  message: string;
  details?: string;
}

export const DEFAULT_GITHUB_CONFIG: GitHubSyncConfig = {
  repoUrl: 'https://github.com/propann/az-sample.git',
  owner: 'propann',
  repo: 'az-sample',
  branch: 'main',
  commitMessage: 'feat(samples): sync studio library, OP-1 kits & EP-133 presets',
  includeOp1Kits: true,
  includeEp133Pack: true,
  includeMasterWavs: true,
  normalizeLufs: true,
};

/**
 * Generates an automated README.md for the az-sample repository
 */
export function generateRepositoryReadme(samples: SampleItem[], repoName: string = 'propann/az-sample'): string {
  const totalDuration = samples.reduce((acc, s) => acc + s.duration, 0).toFixed(1);
  const byType: Record<string, number> = {};
  samples.forEach((s) => {
    byType[s.type] = (byType[s.type] || 0) + 1;
  });

  const now = new Date().toISOString().split('T')[0];

  return `# 🎛️ az-sample Studio Library

> Master Sound Repository synchronized from **Engineering Studio**
> **Target:** \`${repoName}\` | **Updated:** \`${now}\`

## 📊 Catalog Overview

- **Total Samples:** ${samples.length} assets
- **Total Duration:** ~${totalDuration}s
- **Standard Format:** 24-bit / 16-bit 44.1kHz Broadcast WAV & OP-1 AIFF
- **Loudness Spec:** EBU R128 (-14.0 LUFS normalized, True Peak ≤ -0.5 dBFS)

### Distribution by Instrument & Type
| Category | Count | Primary Use |
| :--- | :--- | :--- |
${Object.entries(byType)
  .sort((a, b) => b[1] - a[1])
  .map(([type, count]) => `| \`${type.toUpperCase()}\` | **${count}** | Drum kits, Sequencing & Live Performance |`)
  .join('\n')}

---

## 📁 Repository Structure

\`\`\`
${repoName.split('/')[1] || 'az-sample'}/
├── README.md               # Repository documentation & sound index
├── manifest.json           # Machine-readable catalog (BPM, Key, LUFS, Transient slices)
├── .gitattributes          # Git LFS definitions for uncompressed binary audio
├── op1_kits/               # Teenage Engineering OP-1 OG/Field Drum Patches (.aif with APPL markers)
│   └── *.aif
├── ep133_packs/            # EP-133 K.O. II formatted sounds (Pads 001-099)
│   └── sound_*.wav
├── samples/                # Master Categorized WAV Library
│   ├── kicks/
│   ├── snares/
│   ├── hihats/
│   ├── claps/
│   ├── bass_808/
│   ├── leads/
│   ├── pads_chords/
│   └── fx_textures/
└── scripts/
    └── push_to_az_sample.sh # Fast terminal sync script
\`\`\`

---

## ⚡ Quick Deployment & Hardware Transfer

### 1. OP-1 OG / OP-1 Field
Drop any \`.aif\` file from \`op1_kits/\` into your OP-1 \`drum/user\` folder via USB Disk Mode. The 24 pads are pre-mapped with precise time slicing markers.

### 2. Teenage Engineering EP-133 K.O. II
Use the TE Sample Tool or drop samples directly to load the numbered WAV files from \`ep133_packs/\`.

### 3. Local Git Sync
\`\`\`bash
git clone https://github.com/${repoName}.git
cd ${repoName.split('/')[1] || 'az-sample'}
\`\`\`

---
*Generated automatically by Engineering Studio Engine.*
`;
}

/**
 * Generates the manifest.json database file for the repository
 */
export function generateRepositoryManifest(samples: SampleItem[]): string {
  const manifest = {
    repository: 'propann/az-sample',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    engine: 'Engineering Studio Sound System',
    sampleCount: samples.length,
    specs: {
      standardSampleRate: 44100,
      standardBitDepth: 24,
      targetLufs: -14.0,
      maxTruePeakDbfs: -0.5,
    },
    samples: samples.map((s) => ({
      id: s.id,
      name: s.name,
      fileName: s.originalFileName,
      category: s.category,
      type: s.type,
      bpm: s.bpm,
      key: s.key,
      durationSec: Number(s.duration.toFixed(3)),
      sampleRate: s.sampleRate,
      bitDepth: s.bitDepth,
      channels: s.channels,
      loudnessLufs: s.lufs,
      spectralCentroidHz: s.spectralCentroid,
      ep133Slot: s.ep133Slot,
      tags: s.tags,
      sliceCount: s.slices?.length || 0,
      sliceRegions: s.slices?.map((r) => ({
        id: r.id,
        index: r.index,
        label: r.label,
        startSec: Number(r.startSec.toFixed(3)),
        endSec: Number(r.endSec.toFixed(3)),
        detectedType: r.detectedType,
      })),
    })),
  };

  return JSON.stringify(manifest, null, 2);
}

/**
 * Generates a standard .gitattributes file with Git LFS rules
 */
export function generateGitAttributes(): string {
  return `# Git LFS configuration for high-fidelity audio assets
*.wav filter=lfs diff=lfs merge=lfs -text
*.aif filter=lfs diff=lfs merge=lfs -text
*.aiff filter=lfs diff=lfs merge=lfs -text
*.flac filter=lfs diff=lfs merge=lfs -text
*.mp3 filter=lfs diff=lfs merge=lfs -text
*.zip filter=lfs diff=lfs merge=lfs -text

# Text and code files
*.json text
*.md text
*.sh text eol=lf
`;
}

/**
 * Generates a fast helper push shell script for terminal users
 */
export function generatePushScript(repoUrl: string = 'https://github.com/propann/az-sample.git'): string {
  return `#!/usr/bin/env bash
# ====================================================================
# Fast Git Sync Script for ${repoUrl}
# ====================================================================
set -e

echo "🚀 Synchronizing sample repository with GitHub..."

if [ ! -d ".git" ]; then
  echo "📦 Initializing local git repository..."
  git init
  git branch -M main
fi

if ! git remote | grep -q "origin"; then
  echo "🔗 Adding remote origin ${repoUrl}..."
  git remote add origin "${repoUrl}"
else
  echo "🔗 Updating remote origin to ${repoUrl}..."
  git remote set-url origin "${repoUrl}"
fi

echo "📋 Staging assets and metadata..."
git add .

COMMIT_MSG="feat(sound-lib): sync $(ls -1 samples/ | wc -l) categories and OP-1 kits ($(date +'%Y-%m-%d %H:%M'))"
echo "✍️ Committing: \${COMMIT_MSG}"
git commit -m "\${COMMIT_MSG}" || echo "Nothing new to commit."

echo "⬆️ Pushing to origin main..."
git push -u origin main

echo "✅ Synchronization complete! View your files at: https://github.com/propann/az-sample"
`;
}

/**
 * Builds the complete ZIP archive representing the Git repository
 */
export async function buildRepositoryZip(
  samples: SampleItem[],
  config: GitHubSyncConfig,
  onProgress?: (progress: SyncProgressUpdate) => void
): Promise<Blob> {
  const zip = new JSZip();

  onProgress?.({
    stage: 'preparing',
    progressPercent: 5,
    message: 'Initialisation de la structure du dépôt propann/az-sample...',
  });

  // 1. Root files
  zip.file('README.md', generateRepositoryReadme(samples, `${config.owner}/${config.repo}`));
  zip.file('CONVENTION.md', generateRepositoryConvention());
  zip.file('DOCS.md', generateRepositoryDocs());
  zip.file('manifest.json', generateRepositoryManifest(samples));
  zip.file('.gitattributes', generateGitAttributes());
  zip.file('scripts/push_to_az_sample.sh', generatePushScript(config.repoUrl));

  // 2. Master WAVs categorized
  if (config.includeMasterWavs) {
    const totalSamples = samples.length;
    for (let i = 0; i < totalSamples; i++) {
      const sample = samples[i];
      const categoryFolder = getCategoryFolderName(sample.type, sample.category === 'loop');
      const safeName = sample.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${categoryFolder}/${safeName}.wav`;

      onProgress?.({
        stage: 'uploading',
        currentFile: fileName,
        progressPercent: 10 + Math.round((i / totalSamples) * 40),
        message: `Conversion & indexation: ${fileName}`,
      });

      if (sample.audioBuffer) {
        const wavBlob = audioBufferToWavBlob(sample.audioBuffer, {
          bitDepth: 24,
          sampleRate: 44100,
          monoSum: sample.channels === 1,
          loudnessMatch: config.normalizeLufs,
          targetLufs: -14.0,
        });
        const arrayBuffer = await wavBlob.arrayBuffer();
        zip.file(fileName, arrayBuffer);
      }
    }
  }

  // 3. OP-1 Kits (.aif)
  if (config.includeOp1Kits && samples.length > 0) {
    onProgress?.({
      stage: 'generating_kits',
      progressPercent: 55,
      message: 'Génération et balisage des kits Teenage Engineering OP-1 OG (.aif)...',
    });

    const op1ZipBlob = await batchGenerateOp1Kits(samples, {
      packName: 'az_sample_OP1',
      loudnessMatch: config.normalizeLufs,
      useMono: false,
    });

    // Unzip the OP-1 kits into the op1_kits folder
    const op1Zip = await JSZip.loadAsync(op1ZipBlob);
    const op1Files = Object.keys(op1Zip.files);
    for (const op1Path of op1Files) {
      if (!op1Zip.files[op1Path].dir) {
        const data = await op1Zip.files[op1Path].async('arraybuffer');
        const cleanName = op1Path.split('/').pop() || op1Path;
        zip.file(`op1_kits/${cleanName}`, data);
      }
    }
  }

  // 4. EP-133 Sound bank (Pads 001-099)
  if (config.includeEp133Pack) {
    onProgress?.({
      stage: 'uploading',
      progressPercent: 80,
      message: 'Structuration du Sound Bank EP-133 KO II (Pads 001-099)...',
    });

    const ep133Subset = samples.slice(0, 99);
    for (let idx = 0; idx < ep133Subset.length; idx++) {
      const sample = ep133Subset[idx];
      const padNum = String(sample.ep133Slot || idx + 1).padStart(3, '0');
      const safeName = sample.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);
      const fileName = `ep133_packs/sound_${padNum}_${safeName}.wav`;

      if (sample.audioBuffer) {
        const wavBlob = audioBufferToWavBlob(sample.audioBuffer, {
          bitDepth: 16,
          sampleRate: 44100,
          monoSum: true,
          loudnessMatch: config.normalizeLufs,
          targetLufs: -14.0,
        });
        const arrayBuffer = await wavBlob.arrayBuffer();
        zip.file(fileName, arrayBuffer);
      }
    }
  }

  onProgress?.({
    stage: 'building_tree',
    progressPercent: 95,
    message: 'Compression finale de l\'archive dépôt Git...',
  });

  const finalBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  onProgress?.({
    stage: 'completed',
    progressPercent: 100,
    message: 'Dépôt git structuré prêt pour propann/az-sample !',
  });

  return finalBlob;
}

/**
 * Pushes the sample collection directly to GitHub via REST API
 */
export async function pushToGitHubDirect(
  samples: SampleItem[],
  config: GitHubSyncConfig,
  onProgress?: (progress: SyncProgressUpdate) => void
): Promise<{ success: boolean; commitUrl?: string; error?: string }> {
  if (!config.token) {
    return {
      success: false,
      error: 'Un Personal Access Token GitHub (PAT) est requis pour pousser directement via API.',
    };
  }

  const { owner, repo, branch, token, commitMessage } = config;
  const headers = {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    onProgress?.({
      stage: 'preparing',
      progressPercent: 10,
      message: `Connexion à l'API GitHub (https://github.com/${owner}/${repo})...`,
    });

    // 1. Verify repo access and get default branch reference
    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
      headers,
    });

    if (!refRes.ok) {
      if (refRes.status === 404) {
        throw new Error(`Dépôt introuvable ou inaccessible (${owner}/${repo}). Vérifiez que le dépôt existe et que votre token GitHub possède la permission 'repo'.`);
      } else if (refRes.status === 401) {
        throw new Error('Token GitHub invalide ou expiré. Veuillez vérifier votre Personal Access Token.');
      } else {
        const errJson = await refRes.json().catch(() => ({}));
        throw new Error(errJson.message || `Erreur GitHub API (${refRes.status})`);
      }
    }

    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Get latest commit to get base tree
    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, {
      headers,
    });
    if (!commitRes.ok) throw new Error('Impossible de récupérer le commit parent.');
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Create Blobs and Tree Entries
    const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];

    // Root Readme
    onProgress?.({
      stage: 'creating_manifest',
      progressPercent: 25,
      message: 'Création des métadonnées (README.md, manifest.json, .gitattributes)...',
    });

    const readmeBlobSha = await createTextBlob(generateRepositoryReadme(samples, `${owner}/${repo}`), owner, repo, headers);
    treeItems.push({ path: 'README.md', mode: '100644', type: 'blob', sha: readmeBlobSha });

    const conventionBlobSha = await createTextBlob(generateRepositoryConvention(), owner, repo, headers);
    treeItems.push({ path: 'CONVENTION.md', mode: '100644', type: 'blob', sha: conventionBlobSha });

    const docsBlobSha = await createTextBlob(generateRepositoryDocs(), owner, repo, headers);
    treeItems.push({ path: 'DOCS.md', mode: '100644', type: 'blob', sha: docsBlobSha });

    const manifestBlobSha = await createTextBlob(generateRepositoryManifest(samples), owner, repo, headers);
    treeItems.push({ path: 'manifest.json', mode: '100644', type: 'blob', sha: manifestBlobSha });

    const gitAttrBlobSha = await createTextBlob(generateGitAttributes(), owner, repo, headers);
    treeItems.push({ path: '.gitattributes', mode: '100644', type: 'blob', sha: gitAttrBlobSha });

    const pushScriptSha = await createTextBlob(generatePushScript(config.repoUrl), owner, repo, headers);
    treeItems.push({ path: 'scripts/push_to_az_sample.sh', mode: '100755', type: 'blob', sha: pushScriptSha });

    // Audio Files as Base64 Blobs
    const totalSamples = samples.length;
    for (let i = 0; i < totalSamples; i++) {
      const s = samples[i];
      const categoryFolder = getCategoryFolderName(s.type, s.category === 'loop');
      const safeName = s.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = `${categoryFolder}/${safeName}.wav`;

      onProgress?.({
        stage: 'uploading',
        currentFile: filePath,
        progressPercent: 30 + Math.round((i / totalSamples) * 50),
        message: `Téléversement blob audio (${i + 1}/${totalSamples}): ${filePath}`,
      });

      if (s.audioBuffer) {
        const wavBlob = audioBufferToWavBlob(s.audioBuffer, {
          bitDepth: 24,
          sampleRate: 44100,
          monoSum: s.channels === 1,
          loudnessMatch: config.normalizeLufs,
          targetLufs: -14.0,
        });
        const arrayBuf = await wavBlob.arrayBuffer();
        const base64Audio = arrayBufferToBase64(arrayBuf);
        const audioBlobSha = await createBinaryBlob(base64Audio, owner, repo, headers);
        treeItems.push({ path: filePath, mode: '100644', type: 'blob', sha: audioBlobSha });
      }
    }

    // 4. Create new Git Tree
    onProgress?.({
      stage: 'building_tree',
      progressPercent: 85,
      message: 'Création de l\'arborescence Git Tree...',
    });

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems,
      }),
    });

    if (!treeRes.ok) {
      const err = await treeRes.json().catch(() => ({}));
      throw new Error(err.message || 'Échec de création du Tree Git.');
    }
    const newTreeData = await treeRes.json();
    const newTreeSha = newTreeData.sha;

    // 5. Create Commit
    onProgress?.({
      stage: 'building_tree',
      progressPercent: 92,
      message: 'Signature et enregistrement du commit Git...',
    });

    const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: commitMessage || `feat(samples): sync ${samples.length} assets to ${owner}/${repo}`,
        tree: newTreeSha,
        parents: [latestCommitSha],
      }),
    });

    if (!newCommitRes.ok) {
      const err = await newCommitRes.json().catch(() => ({}));
      throw new Error(err.message || 'Échec de création du Commit Git.');
    }
    const newCommitData = await newCommitRes.json();
    const newCommitSha = newCommitData.sha;

    // 6. Update Branch Ref to new commit
    onProgress?.({
      stage: 'uploading',
      progressPercent: 98,
      message: `Mise à jour de la branche '${branch}'...`,
    });

    const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommitSha,
        force: false,
      }),
    });

    if (!updateRefRes.ok) {
      const err = await updateRefRes.json().catch(() => ({}));
      throw new Error(err.message || 'Échec de mise à jour de la référence Git.');
    }

    onProgress?.({
      stage: 'completed',
      progressPercent: 100,
      message: `🎉 Synchronisation réussie sur https://github.com/${owner}/${repo} !`,
    });

    return {
      success: true,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitSha}`,
    };
  } catch (err: any) {
    onProgress?.({
      stage: 'error',
      progressPercent: 0,
      message: `Erreur: ${err.message || String(err)}`,
    });
    return {
      success: false,
      error: err.message || String(err),
    };
  }
}

// Internal Helper Functions
async function createTextBlob(content: string, owner: string, repo: string, headers: Record<string, string>): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content,
      encoding: 'utf-8',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Impossible de créer le blob texte.');
  }
  const data = await res.json();
  return data.sha;
}

async function createBinaryBlob(base64Content: string, owner: string, repo: string, headers: Record<string, string>): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: base64Content,
      encoding: 'base64',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Impossible de créer le blob binaire audio.');
  }
  const data = await res.json();
  return data.sha;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function getCategoryFolderName(type: string, isLoop: boolean = false): string {
  if (isLoop || type === 'loop') return '06_LOOPS';
  switch (type) {
    case 'kick':
    case 'snare':
    case 'clap':
    case 'hihat':
    case 'percussion':
    case 'other':
      return '01_DRUMS';
    case '808':
    case 'bass':
      return '02_BASS_808';
    case 'lead':
    case 'pad':
    case 'synth':
      return '03_MELODIC';
    case 'vocal':
      return '04_VOCALS';
    case 'fx':
      return '05_FX_TEXTURES';
    case 'instrument':
    case 'piano':
    case 'guitar':
      return '07_INSTRUMENTS';
    default:
      return '01_DRUMS';
  }
}

export function generateRepositoryConvention(): string {
  return `# 🏷️ Standard Naming Convention & Curation Guidelines (\`az-sample\`)

> **Projet :** \`propann/az-sample\` & **Engineering Studio**  
> **Version :** \`2.4.0 (Studio Production Master)\`

---

## 📐 Syntaxe Standard du Nom de Fichier
\`\`\`
[PREFIX]_[TYPE]_[DESCRIPTIVE_NAME]_[KEY]_[BPM]_[FORMAT]_[INDEX].wav
\`\`\`
*Exemple :* \`AZ_KCK_PunchyHard_F#m_140BPM_24b48k_01.wav\`

## 🗂️ Table des Codes d'Instruments
- \`KCK\` : Grosse Caisse (Kick) -> \`01_DRUMS/\`
- \`SNR\` : Caisse Claire (Snare) -> \`01_DRUMS/\`
- \`CLP\` : Clap / Handclap -> \`01_DRUMS/\`
- \`HAT\` : Hi-Hat (Fermé / Ouvert) -> \`01_DRUMS/\`
- \`CYM\` : Cymbale (Crash / Ride) -> \`01_DRUMS/\`
- \`PRC\` : Percussion (Tom, Bongo, Shaker) -> \`01_DRUMS/\`
- \`808\` : Sub 808 Saturé / Trap Bass -> \`02_BASS_808/\`
- \`BAS\` : Basse Synthé / Acoustic Bass -> \`02_BASS_808/\`
- \`SYN\` : Synth Lead / Pluck / Key -> \`03_MELODIC/\`
- \`PAD\` : Nappe / Chord / Ambient Pad -> \`03_MELODIC/\`
- \`VOC\` : Vocal Chop / Vox FX -> \`04_VOCALS/\`
- \`SFX\` : Effet Sonore / Riser / Impact -> \`05_FX_TEXTURES/\`
- \`LOP\` : Boucle Complète (Full Loop) -> \`06_LOOPS/\`
- \`DLP\` : Boucle de Batterie (Drum Loop) -> \`06_LOOPS/\`
- \`INS\` : Instrument Acoustique / Guitare -> \`07_INSTRUMENTS/\`

## 📂 7 Dossiers Studio Immuables
- \`01_DRUMS/\`
- \`02_BASS_808/\`
- \`03_MELODIC/\`
- \`04_VOCALS/\`
- \`05_FX_TEXTURES/\`
- \`06_LOOPS/\`
- \`07_INSTRUMENTS/\`

## 🎚️ Normes Audio EBU R128
- **Master WAV :** 24-bit / 48kHz ou 44.1kHz PCM
- **Loudness :** -14.0 LUFS (Loops) / -18.0 LUFS (One-Shots)
- **True Peak :** Max -0.5 dBFS
`;
}

export function generateRepositoryDocs(): string {
  return `# 📘 Resonance Studio — Guide Utilisateur & Documentation

> **Dépôt Git :** \`propann/az-sample\`  
> **Plateforme :** Engineering Studio

## ⚡ Flux de Travail en 5 Étapes
1. **Import :** Glissez un dossier brut de sons sur l'application.
2. **Auto-Curateur DSP :** Cliquez sur [CURATEUR PRO] pour l'analyse spectrale, détection de tonalité, BPM et normalisation.
3. **Découpe & Slicer :** Isolez les transitoires ou fabriquez un kit de 24 pads OP-1.
4. **Rangement :** Organisation automatique dans les 7 dossiers fondamentaux.
5. **Sync Git :** Push direct vers https://github.com/propann/az-sample.
`;
}
