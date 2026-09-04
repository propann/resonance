/**
 * Search text for a sample, computed once and remembered.
 *
 * The library filter used to lower-case a sample's name, type, key, genre and
 * every tag on each keystroke. Over 200 000 samples that is millions of throw-
 * away strings per letter typed. The text is built once per sample object and
 * cached in a WeakMap, so an untouched sample never pays again and a replaced
 * one is re-indexed on its next look-up.
 */
import type { SampleItem } from '../types/sample';

const haystacks = new WeakMap<SampleItem, string>();

export function sampleHaystack(sample: SampleItem): string {
  const cached = haystacks.get(sample);
  if (cached !== undefined) return cached;
  const text = [
    sample.name,
    sample.type,
    sample.key ?? '',
    sample.genre ?? '',
    sample.bpm ? String(sample.bpm) : '',
    ...(sample.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();
  haystacks.set(sample, text);
  return text;
}

/** True when the sample matches an already-lower-cased query. */
export const sampleMatchesQuery = (sample: SampleItem, lowerQuery: string): boolean =>
  sampleHaystack(sample).includes(lowerQuery);
