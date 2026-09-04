/**
 * Typed access to the Electron preload bridge (`window.resonanceFS`). Present
 * only in the desktop build; in a plain browser dev server it is undefined and
 * `isDesktop()` returns false so callers can degrade gracefully.
 */

export interface FsEntry {
  name: string;
  isDir: boolean;
  isFile: boolean;
  size: number;
  mtimeMs: number;
}

export interface FsStat {
  exists: boolean;
  isDir: boolean;
  isFile: boolean;
  size: number;
  mtimeMs: number;
}

export interface DesktopFS {
  /** Absolute path of the chosen working folder, or null if cancelled. */
  pickRoot(): Promise<string | null>;
  /** Re-adopt a previously chosen root by absolute path. */
  setRoot(absPath: string): Promise<string | null>;
  stat(rel: string): Promise<FsStat>;
  /** `stats: false` returns names only — far cheaper on huge folders. */
  readDir(rel: string, options?: { stats?: boolean }): Promise<FsEntry[]>;
  /** True when the folder holds nothing; reads a single entry. */
  isDirEmpty?(rel: string): Promise<boolean>;
  readFile(rel: string): Promise<ArrayBuffer>;
  /** Read `length` bytes from `offset`; cheaper than reading a whole sample. */
  readFilePart?(rel: string, offset: number, length: number): Promise<ArrayBuffer>;
  writeFile(rel: string, data: ArrayBuffer | Uint8Array): Promise<boolean>;
  /** Append to a file — the manifest journal is written this way. */
  appendFile?(rel: string, data: ArrayBuffer | Uint8Array): Promise<boolean>;
  mkdirp(rel: string): Promise<boolean>;
  remove(rel: string): Promise<boolean>;
  rename(relFrom: string, relTo: string): Promise<boolean>;
  watchStart(): Promise<boolean>;
  watchStop(): Promise<boolean>;
  /** Subscribe to coalesced change events. Returns an unsubscribe fn. */
  onChange(cb: () => void): () => void;
  getSetting(key: string): Promise<unknown>;
  setSetting(key: string, value: unknown): Promise<boolean>;
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string | null): Promise<boolean>;
}

interface DesktopInfo {
  platform: string;
  version: string;
  nativeEngines: boolean;
}

declare global {
  interface Window {
    resonanceFS?: DesktopFS;
    resonanceDesktop?: DesktopInfo;
  }
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!window.resonanceFS;
}

/** The bridge, or throws if not running in the desktop build. */
export function desktopFS(): DesktopFS {
  if (!window.resonanceFS) throw new Error('Resonance desktop bridge indisponible (build navigateur).');
  return window.resonanceFS;
}

export const desktopInfo = (): DesktopInfo | undefined =>
  typeof window !== 'undefined' ? window.resonanceDesktop : undefined;
