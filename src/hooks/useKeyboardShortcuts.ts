import { useEffect, useRef } from 'react';

export interface KeyboardShortcutHandlers {
  /** Space */
  onTogglePlayPause: () => void;
  /** ArrowDown / J */
  onPlayNext: () => void;
  /** ArrowUp / K */
  onPlayPrev: () => void;
  /** L */
  onToggleLoop: () => void;
  /** Ctrl/Cmd + N */
  onOpenBatchNaming: () => void;
  /** Ctrl/Cmd + I */
  onReactivateWorkFolder: () => void;
  /** Ctrl/Cmd + E — caller decides what "selected" means */
  /** F1 */
  onOpenDocumentation: () => void;
  /** F2 */
  onToggleView: () => void;
  /** F4 */
  onOpenDspForSelected: () => void;
  /** Escape — close the top-most open modal */
  onCloseTopModal: () => void;
}

/** Input types that are knobs, not text: they must not swallow the shortcuts. */
const CONTROL_INPUT_TYPES = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset']);

/**
 * True when the key would be typing into something. A slider or a checkbox
 * keeps focus after you drag it, so treating every INPUT as text entry left
 * the space bar dead until the user clicked elsewhere.
 */
export function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  return !CONTROL_INPUT_TYPES.has((el as HTMLInputElement).type);
}

/**
 * Global transport & workspace keyboard shortcuts. Handlers are read through a
 * ref, so the listener is attached once and always calls the latest callbacks.
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;

      // Escape closes modals even from within an input field.
      if (e.code === 'Escape') {
        h.onCloseTopModal();
        return;
      }

      if (isTextEntry(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;

      if (e.code === 'Space') {
        e.preventDefault();
        h.onTogglePlayPause();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyJ') {
        e.preventDefault();
        h.onPlayNext();
      } else if (e.code === 'ArrowUp' || e.code === 'KeyK') {
        e.preventDefault();
        h.onPlayPrev();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        h.onToggleLoop();
      } else if (e.code === 'KeyN' && mod) {
        e.preventDefault();
        h.onOpenBatchNaming();
      } else if (e.code === 'KeyI' && mod) {
        e.preventDefault();
        h.onReactivateWorkFolder();
      } else if (e.code === 'F1') {
        e.preventDefault();
        h.onOpenDocumentation();
      } else if (e.code === 'F2') {
        e.preventDefault();
        h.onToggleView();
      } else if (e.code === 'F4') {
        e.preventDefault();
        h.onOpenDspForSelected();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
