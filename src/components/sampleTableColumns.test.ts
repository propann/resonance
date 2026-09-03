import { describe, expect, it } from 'vitest';
import { ROW_HEIGHT, ROW_OVERSCAN, visibleRowRange } from './sampleTableColumns';

describe('visibleRowRange', () => {
  it('mounts a screenful plus overscan at the top of the list', () => {
    const { first, last } = visibleRowRange(0, 720, 442);
    expect(first).toBe(0);
    expect(last).toBe(Math.ceil(720 / ROW_HEIGHT) + ROW_OVERSCAN * 2);
    expect(last).toBeLessThan(442);
  });

  it('follows the scroll position', () => {
    const { first, last } = visibleRowRange(200 * ROW_HEIGHT, 720, 442);
    expect(first).toBe(200 - ROW_OVERSCAN);
    expect(last).toBeGreaterThan(200);
    expect(last).toBeLessThanOrEqual(442);
  });

  it('clamps to the end of the list', () => {
    const { first, last } = visibleRowRange(441 * ROW_HEIGHT, 720, 442);
    expect(last).toBe(442);
    expect(first).toBeLessThan(442);
  });

  it('renders a fallback screenful before the container is measured', () => {
    expect(visibleRowRange(0, 0, 442).last).toBeGreaterThan(0);
  });

  it('handles an empty list and a negative scrollTop', () => {
    expect(visibleRowRange(0, 720, 0)).toEqual({ first: 0, last: 0 });
    expect(visibleRowRange(-50, 720, 10)).toEqual({ first: 0, last: 10 });
  });
});
