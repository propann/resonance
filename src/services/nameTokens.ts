/**
 * Reading a sample's name without being fooled by it.
 *
 * Two stages of the sorter used to look for keywords with bare substring
 * tests, or with `\b`. Both are wrong for sample names:
 *
 * - `\b` counts `_` as a word character, so `\bhat\b` never matched
 *   `Hat_Loose.wav` — and `_` is exactly what this app's naming convention
 *   separates with.
 * - A bare `includes('hat')` reads a hi-hat out of `Whatever_Vox.wav`,
 *   a ride out of `Override_Lead.wav`, an arp out of `Sharp_Stab.wav`.
 *
 * So: only letters count as "inside a word". `_`, `-`, `.`, spaces, digits and
 * both ends of the name all close a token.
 */

/**
 * A short code that has to stand on its own: `hat`, `bd`, `arp`, `key`.
 * A trailing plural `s` belongs to the token, so `Claps`, `Kicks` and `Hats`
 * read the same as their singular.
 */
export const token = (...words: string[]): string => `(?<![a-z])(?:${words.join('|')})s?(?![a-z])`;

/**
 * A word long enough to be safe anywhere in a name, run-together names
 * included: `TrapKick`, `KickDrum808` and `Kicks` all have to read as kicks.
 */
export const word = (...words: string[]): string => `(?:${words.join('|')})`;

/** One case-insensitive pattern out of any mix of `word` and `token` groups. */
export const rule = (...alternatives: string[]): RegExp => new RegExp(alternatives.join('|'), 'i');

/**
 * Every spelling of a type this app writes into a file name: the type itself,
 * and the three-letter hardware code from the naming convention.
 */
const DECLARED_TYPES: Record<string, string> = {
  kick: 'kick', kck: 'kick', kik: 'kick',
  snare: 'snare', snr: 'snare',
  hihat: 'hihat', hat: 'hihat',
  clap: 'clap', clp: 'clap',
  cymbal: 'cymbal', cym: 'cymbal',
  percussion: 'percussion', perc: 'percussion', prc: 'percussion',
  bass: 'bass', bas: 'bass',
  '808': '808',
  lead: 'lead', led: 'lead',
  pad: 'pad',
  vocal: 'vocal', voc: 'vocal',
  fx: 'fx', sfx: 'fx',
  loop: 'loop', lop: 'loop',
  mlt: 'multi-sound',
};

/** Words the naming convention puts in front of the type, never instead of it. */
const CATEGORY_LABELS = new Set(['drum', 'bass', 'synth', 'vocal', 'fx', 'loop', 'stem', 'misc']);

/**
 * The type this app itself wrote into the name.
 *
 * A file it has filed is named `<PREFIX>_<Type>_<rest>` —
 * `AZ_Clap_Electro_Rim_03_A#m.wav`. That second token is the app's own
 * verdict, and a word further along must not overrule it: the `Rim` there
 * comes from the original source name, and reading it would file a sound
 * called `AZ_Clap_…` under snares, where nobody would look for it.
 *
 * Returns undefined for a name that does not follow the convention, leaving
 * the caller to read the whole name instead.
 */
export function declaredTypeFromName(name: string): string | undefined {
  const parts = name.replace(/\.[^/.]+$/, '').split(/[_-]/);
  const at = (i: number) => DECLARED_TYPES[(parts[i] ?? '').toLowerCase()];
  // `AZ_Clap_…` and `DRUM_KICK_…` both put the type second; a convention that
  // spells the category out first (`AZ_DRUM_KICK_…`) pushes it one further.
  return at(1) ?? (CATEGORY_LABELS.has((parts[1] ?? '').toLowerCase()) ? at(2) : undefined);
}
