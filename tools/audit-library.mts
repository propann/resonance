/**
 * Read-only audit of the working folder: how many sounds sit somewhere other
 * than where the corrected rules would file them, and where they would go.
 *
 * Touches nothing. Run it before any re-sort:
 *   npx tsx tools/audit-library.mts "D:\\Son"
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { classifySampleForLibrary } from '../src/services/proFolderOrganizer';
import { keywordTypeFromName } from '../src/services/audioAnalyzer';
import type { SampleItem, SampleType } from '../src/types/sample';

const ROOT = process.argv[2] ?? 'D:\\Son';
const AUDIO = /\.(wav|aiff?|mp3|flac|ogg|m4a)$/i;
const TOP = ['01_ONE_SHOTS', '02_LOOPS'];

const REAL_TYPES = new Set<string>([
  'kick', 'snare', 'hihat', 'clap', 'cymbal', 'percussion',
  'bass', '808', 'lead', 'pad', 'vocal', 'fx', 'loop', 'multi-sound',
]);

interface ManifestEntry {
  path?: string;
  fileName?: string;
  name?: string;
  type?: string;
  category?: string;
}

/** Manifest snapshot plus its journal, keyed by `<folder>/<file>`. */
async function loadManifest(): Promise<Map<string, ManifestEntry>> {
  const index = new Map<string, ManifestEntry>();
  const key = (e: ManifestEntry) =>
    `${String(e.path ?? '').replace(/^\//, '')}/${e.fileName ?? e.name ?? ''}`;

  try {
    const raw = await fs.readFile(path.join(ROOT, '_MANIFEST/resonance-library.json'), 'utf8');
    for (const entry of (JSON.parse(raw).samples ?? []) as ManifestEntry[]) index.set(key(entry), entry);
  } catch (error) {
    console.error('manifest snapshot unreadable:', (error as Error).message);
  }
  try {
    const raw = await fs.readFile(path.join(ROOT, '_MANIFEST/resonance-library.journal.ndjson'), 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as ManifestEntry;
        index.set(key(entry), entry);
      } catch {
        /* a half-written last line is normal */
      }
    }
  } catch {
    /* no journal is fine */
  }
  return index;
}

async function* walk(rel: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(path.join(ROOT, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) yield* walk(child);
    else if (AUDIO.test(entry.name)) yield child;
  }
}

const manifest = await loadManifest();
console.log(`manifest entries: ${manifest.size.toLocaleString('fr-FR')}`);

let total = 0;
let unknown = 0;
let inPlace = 0;
const moves = new Map<string, number>();
const retyped = new Map<string, number>();
const examples: string[] = [];

for (const top of TOP) {
  for await (const rel of walk(top)) {
    total++;
    const dir = rel.slice(0, rel.lastIndexOf('/'));
    const fileName = rel.slice(rel.lastIndexOf('/') + 1);
    const entry = manifest.get(rel);

    const stored = entry?.type && REAL_TYPES.has(entry.type) ? (entry.type as SampleType) : undefined;
    const named = keywordTypeFromName(fileName);
    const type = named ?? stored;
    // No opinion worth moving a file for: the name says nothing and the
    // manifest has no real type either.
    if (!type) {
      unknown++;
      continue;
    }
    if (named && stored && named !== stored) {
      retyped.set(`${stored} -> ${named}`, (retyped.get(`${stored} -> ${named}`) ?? 0) + 1);
    }

    const isLoop = entry?.category === 'loop' || type === 'loop';
    const target = classifySampleForLibrary({
      type,
      category: isLoop ? 'loop' : 'one-shot',
      isLoop,
      name: fileName,
      originalFileName: fileName,
    } as SampleItem).folderPath.replace(/^\//, '');

    if (target === dir) {
      inPlace++;
      continue;
    }
    const move = `${dir}  ->  ${target}`;
    moves.set(move, (moves.get(move) ?? 0) + 1);
    if (examples.length < 25) examples.push(`  ${fileName}\n      ${dir}  ->  ${target}`);
  }
}

const moved = [...moves.values()].reduce((a, b) => a + b, 0);
const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

console.log(`\nfichiers audio rangés : ${total.toLocaleString('fr-FR')}`);
console.log(`  déjà au bon endroit : ${inPlace.toLocaleString('fr-FR')} (${pct(inPlace)})`);
console.log(`  à déplacer          : ${moved.toLocaleString('fr-FR')} (${pct(moved)})`);
console.log(`  sans avis (intacts) : ${unknown.toLocaleString('fr-FR')} (${pct(unknown)})`);

console.log('\ndéplacements les plus fréquents :');
for (const [move, count] of [...moves].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log(`  ${String(count).padStart(7)}  ${move}`);
}

if (retyped.size > 0) {
  console.log('\nre-typages dus au nom (les anciennes règles se trompaient) :');
  for (const [change, count] of [...retyped].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${String(count).padStart(7)}  ${change}`);
  }
}

console.log('\nexemples :');
for (const line of examples) console.log(line);
