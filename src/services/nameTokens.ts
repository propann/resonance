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
