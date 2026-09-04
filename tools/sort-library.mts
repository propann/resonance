/**
 * Run the library sorting pass offline, with the app closed.
 *
 * Same rules as `src/services/librarySorter.ts` — it imports the very
 * classification functions the app uses — only the file layer differs, because
 * this runs on `node:fs` instead of the app's IPC bridge. It exists so a large
 * library can be walked back into shape in one go, outside the app.
 *
 *   npx tsx tools/sort-library.mts "D:\\Son"           # report only
 *   npx tsx tools/sort-library.mts "D:\\Son" --apply   # actually move
 *
 * Files are moved, never rewritten: no audio is decoded or re-encoded. A sound
 * whose name says nothing and whose manifest entry has no type is left exactly
 * where it is.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { classifySampleForLibrary } from '../src/services/proFolderOrganizer';
import { keywordTypeFromName } from '../src/services/audioAnalyzer';
import type { SampleItem, SampleType } from '../src/types/sample';

const ROOT = process.argv[2] ?? 'D:\\Son';
const APPLY = process.argv.includes('--apply');
const AUDIO = /\.(wav|aiff?|mp3|flac|ogg|m4a)$/i;
/** Hardware patches belong to their device, not to what they sound like. */
const TOP = ['01_ONE_SHOTS', '02_LOOPS'];
const SNAPSHOT = '_MANIFEST/resonance-library.json';
const JOURNAL = '_MANIFEST/resonance-library.journal.ndjson';

const REAL_TYPES = new Set<string>([
  'kick', 'snare', 'hihat', 'clap', 'cymbal', 'percussion',
  'bass', '808', 'lead', 'pad', 'vocal', 'fx', 'loop', 'multi-sound',
]);

interface Entry { path?: string; fileName?: string; name?: string; type?: string; category?: string }

const abs = (rel: string) => path.join(ROOT, rel.split('/').join(path.sep));
const keyOf = (e: Entry) => `${String(e.path ?? '').replace(/^\//, '')}/${e.fileName ?? e.name ?? ''}`;

/** Snapshot merged with its journal, exactly as the app reads it. */
async function loadManifest(): Promise<Entry[]> {
  const index = new Map<string, Entry>();
  const raw = await fs.readFile(abs(SNAPSHOT), 'utf8');
  for (const entry of (JSON.parse(raw).samples ?? []) as Entry[]) index.set(keyOf(entry), entry);
  try {
    const journal = await fs.readFile(abs(JOURNAL), 'utf8');
    for (const line of journal.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as Entry;
        index.set(keyOf(entry), entry);
      } catch {
        /* a half-written last line is normal */
      }
    }
  } catch {
    /* no journal is fine */
  }
  return [...index.values()];
}

async function* walk(rel: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(abs(rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) yield* walk(child);
    else if (AUDIO.test(entry.name)) yield child;
  }
}

/** Names already taken in a destination folder, read once and kept up to date. */
const takenByDir = new Map<string, Set<string>>();
async function freeName(dirRel: string, wanted: string): Promise<string> {
  let taken = takenByDir.get(dirRel);
  if (!taken) {
    taken = new Set(
      (await fs.readdir(abs(dirRel)).catch(() => [] as string[])).map((n) => n.toLowerCase())
    );
    takenByDir.set(dirRel, taken);
  }
  const dot = wanted.lastIndexOf('.');
  const stem = dot > 0 ? wanted.slice(0, dot) : wanted;
  const ext = dot > 0 ? wanted.slice(dot) : '';
  let candidate = wanted;
  let index = 2;
  while (taken.has(candidate.toLowerCase())) candidate = `${stem}_${index++}${ext}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

const manifest = await loadManifest();
const byPath = new Map(manifest.map((entry) => [keyOf(entry), entry]));
console.log(`manifeste : ${manifest.length.toLocaleString('fr-FR')} entrées`);

let scanned = 0;
let inPlace = 0;
let skipped = 0;
let moved = 0;
let renamed = 0;
let failed = 0;
const perMove = new Map<string, number>();
const moves = new Map<string, { path: string; name: string }>();

for (const top of TOP) {
  for await (const rel of walk(top)) {
    scanned++;
    const from = rel.slice(0, rel.lastIndexOf('/'));
    const fileName = rel.slice(rel.lastIndexOf('/') + 1);
    const entry = byPath.get(rel);

    const stored = entry?.type && REAL_TYPES.has(entry.type) ? (entry.type as SampleType) : undefined;
    const type = keywordTypeFromName(fileName) ?? stored;
    if (!type) {
      skipped++;
      continue;
    }
    const isLoop = entry?.category === 'loop' || type === 'loop';
    const to = classifySampleForLibrary({
      type,
      category: isLoop ? 'loop' : 'one-shot',
      isLoop,
      name: fileName,
      originalFileName: fileName,
    } as SampleItem).folderPath.replace(/^\//, '');

    if (to === from) {
      inPlace++;
      continue;
    }
    perMove.set(`${from} -> ${to}`, (perMove.get(`${from} -> ${to}`) ?? 0) + 1);
    if (!APPLY) {
      moved++;
      continue;
    }

    try {
      await fs.mkdir(abs(to), { recursive: true });
      const name = await freeName(to, fileName);
      if (name !== fileName) renamed++;
      await fs.rename(abs(rel), abs(`${to}/${name}`));
      moves.set(rel, { path: `${to}/${name}`, name });
      moved++;
      if (moved % 5000 === 0) console.log(`  ${moved.toLocaleString('fr-FR')} déplacés…`);
    } catch (error) {
      failed++;
      if (failed <= 5) console.error(`  échec ${rel}: ${(error as Error).message}`);
    }
  }
}

if (APPLY && moves.size > 0) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.copyFile(abs(SNAPSHOT), abs(`_MANIFEST/resonance-library.before-sort-${stamp}.json`));

  // Every move, so the pass can be walked back file by file if it turns out
  // to have filed something somewhere unwanted.
  await fs.writeFile(
    abs(`_MANIFEST/sort-log-${stamp}.json`),
    JSON.stringify([...moves].map(([from, to]) => ({ from, to: to.path })), null, 1)
  );
  console.log(`journal des déplacements : _MANIFEST/sort-log-${stamp}.json`);

  const updated = manifest.map((entry) => {
    const move = moves.get(keyOf(entry));
    if (!move) return entry;
    return {
      ...entry,
      path: `/${move.path.slice(0, move.path.lastIndexOf('/'))}`,
      fileName: move.name,
    };
  });
  await fs.writeFile(
    abs(SNAPSHOT),
    JSON.stringify({ generatedAt: new Date().toISOString(), schemaVersion: 1, samples: updated }, null, 2)
  );
  // The journal is folded into the snapshot above; leaving it would replay
  // stale paths over the corrected ones on the next read.
  await fs.rm(abs(JOURNAL), { force: true });
  console.log(`\nmanifeste réécrit (sauvegarde : _MANIFEST/resonance-library.before-sort-${stamp}.json)`);
}

const pct = (n: number) => `${((n / scanned) * 100).toFixed(1)} %`;
console.log(`\n${APPLY ? 'PASSE APPLIQUÉE' : 'SIMULATION (rien déplacé)'}`);
console.log(`  parcourus           : ${scanned.toLocaleString('fr-FR')}`);
console.log(`  déjà au bon endroit : ${inPlace.toLocaleString('fr-FR')} (${pct(inPlace)})`);
console.log(`  déplacés            : ${moved.toLocaleString('fr-FR')} (${pct(moved)})`);
console.log(`  renommés (collision): ${renamed.toLocaleString('fr-FR')}`);
console.log(`  laissés en place    : ${skipped.toLocaleString('fr-FR')} (${pct(skipped)})`);
console.log(`  échecs              : ${failed.toLocaleString('fr-FR')}`);

console.log('\ndéplacements :');
for (const [move, count] of [...perMove].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log(`  ${String(count).padStart(7)}  ${move}`);
}
