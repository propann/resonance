import { useCallback, useState, type MouseEvent as ReactMouseEvent } from 'react';

const SIDEBAR_KEY = 'resonance_sidebar_width_v2';
const WAVEFORM_KEY = 'resonance_waveform_height_v2';

const SIDEBAR_DEFAULT = 280;
const SIDEBAR_MIN = 190;
const SIDEBAR_MAX = 520;

const WAVEFORM_DEFAULT = 175;
const WAVEFORM_MIN = 100;
const WAVEFORM_MAX = 420;

function readStored(key: string, fallback: number): number {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return Number(saved);
  } catch {
    // localStorage unavailable (private mode, disabled) — use the default.
  }
  return fallback;
}

function writeStored(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Best effort only.
  }
}

/**
 * Owns the two draggable workspace splitters (sidebar width, waveform height),
 * their live-drag flags and their localStorage persistence.
 */
export function useResizablePanels() {
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => readStored(SIDEBAR_KEY, SIDEBAR_DEFAULT));
  const [waveformHeight, setWaveformHeight] = useState<number>(() => readStored(WAVEFORM_KEY, WAVEFORM_DEFAULT));
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingWaveform, setIsResizingWaveform] = useState(false);

  const startSidebarResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startWidth + moveEvent.clientX - startX));
      setSidebarWidth(next);
      writeStored(SIDEBAR_KEY, next);
    };
    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  const startWaveformResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    setIsResizingWaveform(true);
    const startY = e.clientY;
    const startHeight = waveformHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const next = Math.max(WAVEFORM_MIN, Math.min(WAVEFORM_MAX, startHeight + moveEvent.clientY - startY));
      setWaveformHeight(next);
      writeStored(WAVEFORM_KEY, next);
    };
    const handleMouseUp = () => {
      setIsResizingWaveform(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [waveformHeight]);

  return {
    sidebarWidth,
    waveformHeight,
    isResizingSidebar,
    isResizingWaveform,
    startSidebarResize,
    startWaveformResize,
  };
}
