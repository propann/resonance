import { useEffect, useState } from 'react';

/**
 * The value, delayed until it stops changing for `delayMs`.
 *
 * Used for the library search: filtering runs over every sample, so on a
 * 200 000-sound library a filter per keystroke is what makes typing feel like
 * wading. The input itself stays immediate — only the work waits.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    if (value === settled) return;
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, settled]);

  return settled;
}
