import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../stores/toastStore';
import { audioEngine } from '../services/audioEngine';
import {
  adoptLibraryRoot,
  chooseLibraryRoot,
  folderDisplayName,
  readLibraryManifest,
  readWorkFolderAudioFiles,
  scanWorkFolderAudioEntries,
  removeEmptyManagedFolders,
  restoreLibraryRoot,
  scanManagedLibrary,
  supportsLocalLibrary,
  watchWorkFolder,
  workFolderEntryKey,
  type DirectoryHandle,
  type WorkFolderAudioFile,
} from '../services/localLibrary';

export type WorkFolderStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// chokidar only watches the top of the drop folder now, so this timer is what
// picks up files dropped deeper in. The scan is bounded and reads no bytes,
// so it can run often.
const RECEPTION_FALLBACK_INTERVAL_MS = 8000;
/**
 * How many source files go to curation at once. Each one is decoded, analysed,
 * normalised and rewritten, so the queue is worked in batches: a drop folder
 * holding tens of thousands of files must still make progress file by file,
 * and each batch removes its sources before the next one is picked up.
 */
const RECEPTION_BATCH_SIZE = 64;
/** How deep a scan looks to fill a batch. Bounded: the backlog can be huge. */
const RECEPTION_SCAN_WINDOW = 400;
/**
 * How often the emptied folders are swept while an import is running. The
 * sweep walks every managed directory, so it is deliberately rare; folders
 * disappearing a few minutes after their last sound leaves is soon enough.
 */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export interface UseWorkFolderOptions {
  /** The curator modal is open — pause the background reception scan. */
  isCuratorOpen: boolean;
  /** The curator is mid-transfer — pause the background reception scan. */
  isCuratorProcessing: boolean;
  /** Merge manifest entries read from disk into the in-memory library. */
  onManifestSamples: (entries: Array<Record<string, unknown>>) => void;
  /**
   * New source files found in the work folder, ready for curation.
   * `openCurator` is true for an explicit "process reception" action, false
   * for a silent background pickup.
   */
  onReceptionFilesReady: (files: WorkFolderAudioFile[], openCurator: boolean) => void;
}

export interface WorkFolderApi {
  libraryRoot: DirectoryHandle | null;
  libraryName: string | null;
  workFolderStatus: WorkFolderStatus;
  diskSampleCount: number;
  diskFolderCounts: Record<string, number>;
  incomingCount: number;
  /** True when more files wait behind `incomingCount` (bounded scan). */
  incomingIsPartial: boolean;
  failedIncomingCount: number;
  setFailedIncomingCount: (count: number) => void;
  /** Adopt a root the curator already connected, without re-scanning here. */
  adoptExternalRoot: (root: DirectoryHandle) => void;
  chooseLibrary: () => Promise<void>;
  reactivateWorkFolder: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  cleanEmptyFolders: () => Promise<void>;
  processReception: () => Promise<void>;
}

/**
 * Owns the connection to the on-disk working folder: the directory handle,
 * connection status, disk sample counts, and the periodic reception scan that
 * feeds new source files into curation.
 */
export function useWorkFolder(options: UseWorkFolderOptions): WorkFolderApi {
  const [libraryRoot, setLibraryRoot] = useState<DirectoryHandle | null>(null);
  const [libraryName, setLibraryName] = useState<string | null>(null);
  const [diskSampleCount, setDiskSampleCount] = useState(0);
  const [diskFolderCounts, setDiskFolderCounts] = useState<Record<string, number>>({});
  const [workFolderStatus, setWorkFolderStatus] = useState<WorkFolderStatus>('disconnected');
  const [incomingCount, setIncomingCount] = useState(0);
  const [incomingIsPartial, setIncomingIsPartial] = useState(false);
  const [failedIncomingCount, setFailedIncomingCount] = useState(0);

  const scanInFlightRef = useRef(false);
  /**
   * Whether the empty folders left behind have been swept since the reception
   * last held anything. Without it the sweep would run on every idle tick.
   */
  const sweptSinceDrainRef = useRef(false);
  /** When the folders were last swept, for the periodic sweep during ingest. */
  const lastSweepRef = useRef(0);
  const queuedSourceKeysRef = useRef(new Set<string>());

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refreshLibrary = useCallback(async () => {
    if (!libraryRoot) return;
    try {
      const scan = await scanManagedLibrary(libraryRoot);
      setDiskSampleCount(scan.totalSamples);
      setDiskFolderCounts(scan.folderCounts);
      optionsRef.current.onManifestSamples(await readLibraryManifest(libraryRoot));
      setWorkFolderStatus('connected');
    } catch (error) {
      setWorkFolderStatus('error');
      console.error('Erreur rafraîchissement bibliothèque', error);
      toast.error('Impossible de lire le dossier de travail. Reconnectez-le depuis Fichier.');
    }
  }, [libraryRoot]);

  const chooseLibrary = useCallback(async () => {
    if (!supportsLocalLibrary()) {
      toast.info(
        "Le dossier de travail nécessite l'application de bureau Resonance (Windows ou Linux). La version navigateur n'a pas accès au disque."
      );
      return;
    }
    try {
      setWorkFolderStatus('connecting');
      const root = await chooseLibraryRoot();
      setLibraryRoot(root);
      setLibraryName(folderDisplayName(root));
      const scan = await scanManagedLibrary(root);
      setDiskSampleCount(scan.totalSamples);
      setDiskFolderCounts(scan.folderCounts);
      optionsRef.current.onManifestSamples(await readLibraryManifest(root));
      setWorkFolderStatus('connected');
    } catch (error) {
      setWorkFolderStatus(libraryRoot ? 'connected' : 'error');
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Erreur dossier de travail', error);
        toast.error(
          error instanceof Error
            ? `Impossible de connecter ce dossier : ${error.message}`
            : 'Impossible de connecter ce dossier de travail.'
        );
      }
    }
  }, [libraryRoot]);

  const reactivateWorkFolder = useCallback(async () => {
    if (!libraryRoot) {
      await chooseLibrary();
      return;
    }
    // Desktop: the path is always accessible — just re-scan. Fall back to a
    // fresh pick if the folder has gone missing.
    const readopted = await adoptLibraryRoot(libraryRoot);
    if (readopted) await refreshLibrary();
    else await chooseLibrary();
  }, [libraryRoot, chooseLibrary, refreshLibrary]);

  const cleanEmptyFolders = useCallback(async () => {
    if (!libraryRoot) return;
    try {
      const removed = await removeEmptyManagedFolders(libraryRoot);
      await refreshLibrary();
      toast.info(
        removed > 0
          ? `${removed} dossier(s) vide(s) supprimé(s).`
          : 'Aucun dossier vide à supprimer.'
      );
    } catch (error) {
      console.error('Erreur nettoyage dossiers', error);
      toast.error('Impossible de nettoyer les dossiers. Reconnectez le dossier de travail.');
    }
  }, [libraryRoot, refreshLibrary]);

  const processReception = useCallback(async () => {
    if (!libraryRoot) return;
    try {
      const { entries, truncated } = await scanWorkFolderAudioEntries(
        libraryRoot,
        RECEPTION_SCAN_WINDOW
      );
      queuedSourceKeysRef.current.clear();
      if (entries.length === 0) {
        toast.info(
          'Aucun nouveau fichier audio dans le dossier de travail. Déposez vos sons ou dossiers à sa racine, puis relancez cette commande.'
        );
        return;
      }
      const batch = entries.slice(0, RECEPTION_BATCH_SIZE);
      for (const entry of batch) queuedSourceKeysRef.current.add(workFolderEntryKey(entry));
      if (entries.length > batch.length || truncated) {
        toast.info(
          `Lot de ${batch.length} son(s) envoyé au curateur. Le reste de la réception suit automatiquement, lot par lot.`
        );
      }
      optionsRef.current.onReceptionFilesReady(await readWorkFolderAudioFiles(batch), true);
    } catch (error) {
      console.error('Erreur analyse réception', error);
      toast.error(
        'Impossible de lire 00_RECEPTION. Reconnectez le dossier de travail depuis le menu Fichier.'
      );
    }
  }, [libraryRoot]);

  const adoptExternalRoot = useCallback((root: DirectoryHandle) => {
    void adoptLibraryRoot(root);
    setLibraryRoot(root);
    setLibraryName(folderDisplayName(root));
  }, []);

  // Restore a previously connected work folder on mount, so the user does not
  // have to re-pick it every launch.
  useEffect(() => {
    void restoreLibraryRoot()
      .then((root) => {
        if (!root) return;
        setLibraryRoot(root);
        setLibraryName(folderDisplayName(root));
        setWorkFolderStatus('connected');
        void scanManagedLibrary(root)
          .then((scan) => {
            setDiskSampleCount(scan.totalSamples);
            setDiskFolderCounts(scan.folderCounts);
          })
          .catch((error) => console.error('[library] restore: scan failed', error));
        void readLibraryManifest(root)
          .then((entries) => optionsRef.current.onManifestSamples(entries))
          .catch((error) => console.error('[library] restore: manifest read failed', error));
      })
      .catch((error) => console.error('[library] restore failed', error));
  }, []);

  // Background reception scan: pick up new source files while idle.
  useEffect(() => {
    if (!libraryRoot || options.isCuratorOpen || options.isCuratorProcessing) return;
    let cancelled = false;

    const scanReception = async () => {
      if (scanInFlightRef.current) return;
      // The user comes first: while a sound is playing, the ingestion waits.
      // Its analysis holds the main thread in bursts, which is heard as
      // stutter and felt as a dead transport.
      if (audioEngine.getState().isPlaying) return;
      scanInFlightRef.current = true;
      try {
        // Metadata only, and bounded: this runs on every watch event and on a
        // timer, over a folder that may hold tens of thousands of files.
        const { entries, truncated } = await scanWorkFolderAudioEntries(
          libraryRoot,
          RECEPTION_SCAN_WINDOW
        );
        if (cancelled) return;
        setIncomingCount(entries.length);
        setIncomingIsPartial(truncated);

        // A transferred pack leaves its directory tree standing, empty, which
        // reads as work still to do. Sweeping only at a full drain would never
        // fire on a large import — a quarter of a million files take days — so
        // it also runs on a slow timer while the ingest works through them.
        const drained = entries.length === 0;
        if (!drained) sweptSinceDrainRef.current = false;
        const due = Date.now() - lastSweepRef.current >= SWEEP_INTERVAL_MS;
        if ((drained && !sweptSinceDrainRef.current) || due) {
          if (drained) sweptSinceDrainRef.current = true;
          lastSweepRef.current = Date.now();
          const swept = await removeEmptyManagedFolders(libraryRoot).catch((error) => {
            console.error('Nettoyage des dossiers vides impossible', error);
            return 0;
          });
          if (cancelled) return;
          if (swept > 0) toast.info(`${swept} dossier(s) vide(s) supprimé(s).`);
        }
        const currentKeys = new Set(entries.map(workFolderEntryKey));
        for (const knownKey of queuedSourceKeysRef.current) {
          if (!currentKeys.has(knownKey)) queuedSourceKeysRef.current.delete(knownKey);
        }
        const freshEntries = entries
          .filter((entry) => !queuedSourceKeysRef.current.has(workFolderEntryKey(entry)))
          .slice(0, RECEPTION_BATCH_SIZE);
        if (freshEntries.length === 0) return;
        const freshFiles = await readWorkFolderAudioFiles(freshEntries);
        if (cancelled) return;
        // Only mark them once the bytes are in hand: a failed read must leave
        // the entry pending so the next scan retries it.
        for (const entry of freshEntries) queuedSourceKeysRef.current.add(workFolderEntryKey(entry));
        optionsRef.current.onReceptionFilesReady(freshFiles, false);
      } catch (error) {
        console.error('Surveillance de réception indisponible', error);
        // Only a real access failure means the folder is unusable.
        setWorkFolderStatus((current) => (current === 'connected' ? current : 'error'));
      } finally {
        scanInFlightRef.current = false;
      }
    };

    void scanReception();
    const unwatch = watchWorkFolder(() => void scanReception());
    const fallback = window.setInterval(() => void scanReception(), RECEPTION_FALLBACK_INTERVAL_MS);
    return () => {
      cancelled = true;
      unwatch();
      window.clearInterval(fallback);
    };
  }, [libraryRoot, options.isCuratorOpen, options.isCuratorProcessing]);

  return {
    libraryRoot,
    libraryName,
    workFolderStatus,
    diskSampleCount,
    diskFolderCounts,
    incomingCount,
    incomingIsPartial,
    failedIncomingCount,
    setFailedIncomingCount,
    adoptExternalRoot,
    chooseLibrary,
    reactivateWorkFolder,
    refreshLibrary,
    cleanEmptyFolders,
    processReception,
  };
}
