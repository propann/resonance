import { describe, expect, it } from 'vitest';
import { isTextEntry } from './useKeyboardShortcuts';

const el = (tag: string, props: Record<string, unknown> = {}) =>
  Object.assign({ tagName: tag, isContentEditable: false }, props) as unknown as EventTarget;

describe('isTextEntry', () => {
  it('lets knobs through, so the space bar still works after moving a slider', () => {
    expect(isTextEntry(el('INPUT', { type: 'range' }))).toBe(false);
    expect(isTextEntry(el('INPUT', { type: 'checkbox' }))).toBe(false);
    expect(isTextEntry(el('BUTTON'))).toBe(false);
    expect(isTextEntry(el('CANVAS'))).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });

  it('holds the shortcuts back while typing', () => {
    expect(isTextEntry(el('INPUT', { type: 'text' }))).toBe(true);
    expect(isTextEntry(el('INPUT', { type: 'number' }))).toBe(true);
    expect(isTextEntry(el('TEXTAREA'))).toBe(true);
    expect(isTextEntry(el('SELECT'))).toBe(true);
    expect(isTextEntry(el('DIV', { isContentEditable: true }))).toBe(true);
  });
});
