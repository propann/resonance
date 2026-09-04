import React, { useState } from 'react';
import { Copy, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { toast } from '../stores/toastStore';
import {
  removeDuplicateGroups,
  scanLibraryDuplicates,
  type DedupeScan,
} from '../services/libraryDedupe';
import { rebuildManifestFromDisk } from '../services/manifestRebuilder';
import type { DirectoryHandle } from '../services/localLibrary';

interface LibraryDedupeModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraryRoot: DirectoryHandle | null;
  /** Re-read the library after files were removed. */
  onLibraryChanged: () => void;
}

const formatMb = (bytes: number): string => `${(bytes / 1048576).toFixed(1)} Mo`;

/**
 * Finds files with identical content in the library and, on demand, removes
 * the extra copies. The scan never deletes anything: removal is a second,
 * explicit click, and the surviving copy is the one whose name was not pushed
 * aside by a `_2` collision suffix.
 */
export const LibraryDedupeModal: React.FC<LibraryDedupeModalProps> = ({
  isOpen,
  onClose,
  libraryRoot,
  onLibraryChanged,
}) => {
  const [scan, setScan] = useState<DedupeScan | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);

  const duplicateCount = scan?.groups.reduce((n, g) => n + g.duplicates.length, 0) ?? 0;

  const handleScan = async () => {
    if (!libraryRoot) return;
    setScan(null);
    setProgress({ done: 0, total: 0 });
    try {
      const result = await scanLibraryDuplicates(libraryRoot, (done, total) =>
        setProgress({ done, total })
      );
      setScan(result);
    } catch (error) {
      console.error('Analyse des doublons impossible', error);
      toast.error("L'analyse des doublons a échoué. Reconnectez le dossier de travail.");
    } finally {
      setProgress(null);
    }
  };

  /**
   * Re-registers every file found in the library folders. Used when the
   * manifest has fallen behind what is on disk — the sounds are there, the app
   * just no longer lists them.
   */
  const handleRebuild = async () => {
    if (!libraryRoot) return;
    setIsRebuilding(true);
    try {
      const { onDisk, before, after } = await rebuildManifestFromDisk(libraryRoot);
      toast.success(
        `Manifeste reconstruit : ${after} entrée(s) pour ${onDisk} fichier(s) (${after - before} ajoutée(s)).`
      );
      onLibraryChanged();
    } catch (error) {
      console.error('Reconstruction du manifeste impossible', error);
      toast.error('Impossible de reconstruire le manifeste.');
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleRemove = async () => {
    if (!libraryRoot || !scan || duplicateCount === 0) return;
    setIsRemoving(true);
    try {
      const { removedFiles, prunedEntries } = await removeDuplicateGroups(libraryRoot, scan.groups);
      toast.success(
        `${removedFiles} doublon(s) supprimé(s), ${prunedEntries} entrée(s) retirée(s) du manifeste.`
      );
      setScan(null);
      onLibraryChanged();
    } catch (error) {
      console.error('Suppression des doublons impossible', error);
      toast.error('Impossible de supprimer les doublons.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      accent="#F59E0B"
      icon={<Copy className="h-4 w-4" />}
      title="Dédoublonner la bibliothèque"
      subtitle="Repère les fichiers au contenu identique et retire les copies en trop"
    >
      <div className="space-y-4 font-mono text-xs">
        <div className="flex items-center gap-3 border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3">
          <button
            onClick={() => void handleScan()}
            disabled={!libraryRoot || progress !== null || isRemoving}
            className="flex items-center gap-2 border border-[#F59E0B] bg-[#F59E0B] px-3 py-1.5 font-bold text-black transition hover:bg-[#FBBF24] disabled:opacity-40"
          >
            {progress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            <span>{progress ? 'Analyse...' : 'Analyser la bibliothèque'}</span>
          </button>
          <button
            onClick={() => void handleRebuild()}
            disabled={!libraryRoot || isRebuilding || progress !== null}
            className="flex items-center gap-2 border border-[#F59E0B]/60 px-3 py-1.5 font-bold text-[#FBBF24] transition hover:bg-[#F59E0B]/20 disabled:opacity-40"
            title="Ré-enregistrer dans le manifeste tous les fichiers présents dans les dossiers de la bibliothèque"
          >
            {isRebuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span>{isRebuilding ? 'Reconstruction...' : 'Reconstruire le manifeste'}</span>
          </button>
          <p className="text-[10px] text-[#FBBF24]">
            {progress
              ? `Comparaison octet par octet : ${progress.done} / ${progress.total} fichier(s) de même taille`
              : 'Seuls les fichiers de taille identique sont lus — l’analyse ne supprime rien.'}
          </p>
        </div>

        {scan && (
          <>
            <div className="flex flex-wrap items-center gap-4 border border-[#242436] bg-[#0F0F16] px-3 py-2 text-[10px]">
              <span className="text-[#8E8E98]">
                {scan.scanned} fichier(s) en bibliothèque, {scan.hashed} comparé(s)
              </span>
              <span className={duplicateCount > 0 ? 'font-bold text-[#F59E0B]' : 'text-[#34D399]'}>
                {duplicateCount > 0
                  ? `${duplicateCount} doublon(s) dans ${scan.groups.length} groupe(s) — ${formatMb(scan.reclaimedBytes)} à récupérer`
                  : 'Aucun doublon : la bibliothèque est propre.'}
              </span>
              {duplicateCount > 0 && (
                <button
                  onClick={() => void handleRemove()}
                  disabled={isRemoving}
                  className="ml-auto flex items-center gap-1.5 border border-[#EF4444] bg-[#EF4444]/15 px-3 py-1.5 font-bold text-[#FCA5A5] transition hover:bg-[#EF4444] hover:text-white disabled:opacity-40"
                  title="Supprime les copies en trop, garde un exemplaire de chaque son"
                >
                  {isRemoving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>Supprimer les {duplicateCount} doublon(s)</span>
                </button>
              )}
            </div>

            {scan.groups.length > 0 && (
              <ul className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                {scan.groups.map((group) => (
                  <li key={group.hash} className="border border-[#242436] bg-[#0F0F16] p-2">
                    <div className="flex items-center gap-2 text-[#34D399]">
                      <span className="text-[9px] font-bold uppercase">Gardé</span>
                      <span className="truncate">{group.keep.relPath}</span>
                    </div>
                    {group.duplicates.map((dup) => (
                      <div key={dup.relPath} className="flex items-center gap-2 text-[#FCA5A5]">
                        <span className="text-[9px] font-bold uppercase">Doublon</span>
                        <span className="truncate">{dup.relPath}</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
