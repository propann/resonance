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
  onOpenFxRackForSelected: () => void;
  /** F1 */
  onOpenDocumentation: () => void;
  /** F2 */
  onToggleView: () => void;
  /** F4 */
  onOpenDspForSelected: () => void;
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Global transport & workspace keyboard shortcuts. Handlers are read through a
 * ref, so the listener is attached once and always calls the latest callbacks.
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (TYPING_TAGS.has((e.target as HTMLElement).tagName)) return;

      const h = handlersRef.current;
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
      } else if (e.code === 'KeyE' && mod) {
        e.preventDefault();
        h.onOpenFxRackForSelected();
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
