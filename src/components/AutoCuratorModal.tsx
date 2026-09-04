import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from '../stores/toastStore';
import {
  FolderUp,
  FileAudio,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Play,
  Pause,
  Download,
  Loader2,
  Sliders,
  FolderTree,
  Check,
  Disc,
  ArrowRight,
  RefreshCw,
  Folder,
  Tag,
  Music,
  Activity,
  Layers,
  Wand2,
} from 'lucide-react';
import { Modal } from './Modal';
import { SampleItem, SampleCategory, SampleType, MusicGenre } from '../types/sample';
import { audioEngine } from '../services/audioEngine';
import {
  calculateAudioMetrics,
  detectPitchAndKey,
  detectBpm,
  detectLoopVsOneShot,
  classifySample,
  classifyGenre,
  assignEp133Slot,
  detectAutoSlices,
  generateEnrichedTags,
  extractAcousticFeatures,
  extractTimbralDescriptors,
} from '../services/audioAnalyzer';
import {
  audioBufferToWavBlob,
  exportMultipleWavsAsZip,
  exportEp133ProjectPack,
  triggerFileDownload,
} from '../services/audioConverter';
import {
  cleanRawSampleName,
  deriveSourceName,
  generateStandardSampleName,
  NamingConventionConfig,
  DEFAULT_NAMING_CONFIG,
  NamingConventionPreset,
} from '../services/sampleNamingConvention';
import { classifySampleForLibrary } from '../services/proFolderOrganizer';
import { parseOp1AiffPatch } from '../services/op1PatchEncoder';
import {
  archiveIncomingFiles,
  chooseLibraryRoot,
  folderDisplayName,
  getDirectoryForPath,
  restoreLibraryRoot,
  supportsLocalLibrary,
  writeUniqueFile,
  writeLibraryManifest,
  getLibraryContentHashes,
  getProcessedSourceFingerprints,
  hashFileContent,
  removeWorkFolderFiles,
  reserveUniqueFileName,
  resetDirectoryNameCache,
  runWithConcurrency,
  writeFileAt,
  type WorkFolderAudioFile,
  type DirectoryHandle,
} from '../services/localLibrary';

export interface CuratorItem {
  id: string;
  source: 'upload' | 'library';
  file?: File;
  originalName: string;
  cleanName: string;
  status: 'pending' | 'analyzing' | 'ready' | 'error';
  progress: number;
  audioBuffer?: AudioBuffer;
  duration: number;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  bpm?: number;
  key?: string;
  pitchHz?: number;
  type: SampleType;
  category: SampleCategory;
  isLoop: boolean;
  loopBars?: number;
  genre: MusicGenre;
  tags: string[];
  timbralTags: string[];
  lufs: number;
  gainAdjustmentDb: number;
  targetFolderPath: string;
  targetFolderId: string;
  ep133Slot?: number;
  errorMessage?: string;
  sampleItem?: SampleItem;
  archivedToReception?: boolean;
  sourcePath?: string;
  isOp1Patch?: boolean;
}

interface AutoCuratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  librarySamples: SampleItem[];
  initialFiles?: Array<File | WorkFolderAudioFile>;
  initialFilesAlreadyArchived?: boolean;
  onInitialFilesHandled?: () => void;
  onReceptionFilesArchived?: (files: File[]) => void;
  libraryRoot?: DirectoryHandle | null;
  libraryName?: string | null;
  onLibraryRootChange?: (root: DirectoryHandle) => void;
  onLibraryChanged?: () => void;
  onProcessingChange?: (isProcessing: boolean) => void;
  onQueueResult?: (result: { ready: number; errors: number }) => void;
  autoTransfer?: boolean;
  onApplyCuration: (curatedSamples: SampleItem[]) => void;
}

/** Files decoded ahead of the analysis cursor. */
const DECODE_AHEAD = 6;
/** Destination files written at once. */
const WRITE_CONCURRENCY = 6;
/** Minimum gap between queue repaints while a batch is being analysed. */
const PAINT_INTERVAL_MS = 200;

export const AutoCuratorModal: React.FC<AutoCuratorModalProps> = ({
  isOpen,
  onClose,
  librarySamples,
  initialFiles = [],
  initialFilesAlreadyArchived = false,
  onInitialFilesHandled,
  onReceptionFilesArchived,
  libraryRoot: connectedLibraryRoot,
  libraryName: connectedLibraryName,
  onLibraryRootChange,
  onLibraryChanged,
  onProcessingChange,
  onQueueResult,
  autoTransfer = false,
  onApplyCuration,
}) => {
  const [sourceMode, setSourceMode] = useState<'upload' | 'library'>('upload');
  const [items, setItems] = useState<CuratorItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Settings
  const [targetFormat, setTargetFormat] = useState<'24b48k' | '16b44k'>('24b48k');
  const [targetLufs, setTargetLufs] = useState<number>(-14);
  const [autoNormalizeLufs, setAutoNormalizeLufs] = useState<boolean>(true);
  const [trimSilence, setTrimSilence] = useState<boolean>(true);
  const [namingPreset, setNamingPreset] = useState<NamingConventionPreset>('splice_pro');
  const [namingPrefix, setNamingPrefix] = useState<string>('AZ');
  const [folderScheme, setFolderScheme] = useState<'streamlined' | 'detailed'>('detailed');

  // Currently playing sample in curator
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const workFolderOnly = true;
  const autoTransferredSignature = useRef<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [libraryRoot, setLibraryRoot] = useState<DirectoryHandle | null>(null);
  const [libraryName, setLibraryName] = useState<string | null>(null);

  // Track playback
  useEffect(() => {
    const unsub = audioEngine.subscribe((state) => {
      if (!state.isPlaying) {
        setPlayingId(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (connectedLibraryRoot) {
      setLibraryRoot(connectedLibraryRoot);
      setLibraryName(connectedLibraryName || folderDisplayName(connectedLibraryRoot));
    }
  }, [connectedLibraryRoot, connectedLibraryName]);

  useEffect(() => {
    restoreLibraryRoot().then((root) => {
      if (root) {
        setLibraryRoot(root);
        setLibraryName(folderDisplayName(root));
      }
    });
  }, []);

  const handleChooseLibrary = async () => {
    try {
      const root = await chooseLibraryRoot();
      setLibraryRoot(root);
      setLibraryName(folderDisplayName(root));
      onLibraryRootChange?.(root);
      const pendingOriginals = items
        .filter((item) => item.source === 'upload' && item.file && !item.archivedToReception)
        .map((item) => item.file!);
      if (pendingOriginals.length > 0) {
        const archivedNames = await archiveIncomingFiles(root, pendingOriginals);
        onReceptionFilesArchived?.(pendingOriginals);
        setItems((current) => current.map((item) =>
          item.file && pendingOriginals.includes(item.file)
            ? {
                ...item,
                archivedToReception: true,
                sourcePath: `00_RECEPTION/${archivedNames[pendingOriginals.indexOf(item.file)]}`,
              }
            : item
        ));
      }
      setNotification(`Bibliothèque connectée : ${folderDisplayName(root)}. Les dossiers de réception et de classement sont prêts.`);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setNotification(err instanceof Error ? err.message : 'Impossible de connecter ce dossier.');
    }
  };

  // Sync with library samples when choosing library source
  const handleLoadFromLibrary = () => {
    if (librarySamples.length === 0) return;
    const libraryItems: CuratorItem[] = librarySamples.map((s, i) => {
      const cleanName = cleanRawSampleName(s.name);
      const folderInfo = classifySampleForLibrary(s);

      return {
        id: `curate-lib-${s.id}`,
        source: 'library',
        originalName: s.originalFileName || s.name,
        cleanName: s.name,
        status: s.audioBuffer ? 'ready' : 'pending',
        progress: s.audioBuffer ? 100 : 0,
        audioBuffer: s.audioBuffer,
        duration: s.duration,
        sampleRate: s.sampleRate,
        bitDepth: s.bitDepth,
        channels: s.channels,
        bpm: s.bpm,
        key: s.key,
        pitchHz: s.pitchHz,
        type: s.type,
        category: s.category,
        isLoop: s.isLoop,
        loopBars: s.loopBars,
        genre: s.genre,
        tags: s.tags,
        timbralTags: s.tags.filter((t) =>
          ['punchy', 'warm', 'bright', 'sub-heavy', 'crisp', 'metallic', 'saturated', 'tight', 'sustained'].includes(t)
        ),
        lufs: s.lufs,
        gainAdjustmentDb: s.loudnessGainDb,
        targetFolderPath: folderInfo.folderPath,
        targetFolderId: folderInfo.folderId,
        ep133Slot: s.ep133Slot || i + 1,
        sampleItem: s,
      };
    });

    setItems(libraryItems);
    if (libraryItems.some((it) => it.status !== 'ready')) {
      processQueue(libraryItems);
    }
  };

  const handleFilesSelected = async (files: FileList | Array<File | WorkFolderAudioFile>, alreadyArchived = false) => {
    const fileEntries: Array<{ file: File; sourcePath?: string }> = Array.from(files).map((entry) =>
      entry instanceof File ? { file: entry } : entry
    );
    const rawFiles = fileEntries.filter(({ file }) =>
      file.type.startsWith('audio/') || file.name.match(/\.(wav|mp3|aif|aiff|flac|ogg|m4a|webm)$/i)
    );

    const newItems: CuratorItem[] = rawFiles.map(({ file, sourcePath }, i) => ({
      id: `curate-up-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      source: 'upload',
      file,
      originalName: file.name,
      cleanName: cleanRawSampleName(file.name),
      status: 'pending',
      progress: 0,
      duration: 0,
      sampleRate: 44100,
      bitDepth: 24,
      channels: 2,
      type: 'other',
      category: 'one-shot',
      isLoop: false,
      genre: 'Universal / Multi-Genre',
      tags: [],
      timbralTags: [],
      lufs: -18,
      gainAdjustmentDb: 0,
      targetFolderPath: '/01_DRUMS',
      targetFolderId: 'f-drums',
      sourcePath: sourcePath || (alreadyArchived ? `00_RECEPTION/${file.name}` : undefined),
    }));

    if (newItems.length > 0) {
      let originalsArchived = alreadyArchived;
      if (libraryRoot && !alreadyArchived) {
        try {
          const archivedNames = await archiveIncomingFiles(libraryRoot, rawFiles.map(({ file }) => file));
          onReceptionFilesArchived?.(rawFiles.map(({ file }) => file));
          originalsArchived = true;
          newItems.forEach((item, index) => { item.sourcePath = `00_RECEPTION/${archivedNames[index]}`; });
          setNotification(`${rawFiles.length} original(aux) copié(s) dans 00_RECEPTION.`);
        } catch (err) {
          console.error('Erreur copie réception', err);
          setNotification("Les sons sont analysés, mais leur copie dans 00_RECEPTION a échoué.");
        }
      }
      const merged = [...items, ...newItems];
      if (originalsArchived) merged.forEach((item) => {
        if (item.source === 'upload' && rawFiles.some(({ file }) => file.name === item.originalName)) item.archivedToReception = true;
      });
      setItems(merged);
      processQueue(merged);
    }
  };

  /** Decode one source; AIFF may carry an OP-1 patch. */
  const decodeItem = async (item: CuratorItem): Promise<{ buffer: AudioBuffer; isOp1Patch: boolean }> => {
    if (item.audioBuffer) return { buffer: item.audioBuffer, isOp1Patch: false };
    if (!item.file) throw new Error('Impossible de décoder le flux audio');
    if (/\.aif{1,2}$/i.test(item.file.name)) {
      const parsed = await parseOp1AiffPatch(item.file);
      return { buffer: parsed.audioBuffer, isOp1Patch: Boolean(parsed.rawJson) };
    }
    const buffer = await audioEngine.decodeAudioData(await item.file.arrayBuffer());
    return { buffer, isOp1Patch: false };
  };

  // DSP Study & Processing Pipeline
  const processQueue = async (queue: CuratorItem[]) => {
    setIsProcessing(true);
    onProcessingChange?.(true);
    const updatedQueue = [...queue];

    // Decoding happens off the main thread, so keep a few files decoding ahead
    // of the analysis instead of decoding one, analysing it, decoding the next.
    const decoding = new Map<string, Promise<{ buffer: AudioBuffer; isOp1Patch: boolean }>>();
    const scheduleDecode = (index: number) => {
      const target = updatedQueue[index];
      if (!target || decoding.has(target.id) || target.status === 'error') return;
      const pending = decodeItem(target);
      pending.catch(() => undefined); // awaited later; this only avoids a noisy rejection
      decoding.set(target.id, pending);
    };
    for (let i = 0; i < DECODE_AHEAD; i++) scheduleDecode(i);

    // Cheap timings: a stalled or slow ingest is otherwise invisible.
    const batchStart = performance.now();
    let decodeMs = 0;
    let analyseMs = 0;
    let encodeMs = 0;

    // Repainting a 64-item queue three times per file costs more than the
    // analysis itself; paint on a timer instead.
    let lastPaint = 0;
    const paint = (force = false) => {
      const now = Date.now();
      if (!force && now - lastPaint < PAINT_INTERVAL_MS) return;
      lastPaint = now;
      setItems([...updatedQueue]);
    };

    for (let i = 0; i < updatedQueue.length; i++) {
      const item = updatedQueue[i];
      if (item.status === 'ready' && item.audioBuffer && item.sampleItem) continue;

      item.status = 'analyzing';
      item.progress = 20;
      paint();

      try {
        scheduleDecode(i + DECODE_AHEAD);
        const decodeStart = performance.now();
        const decoded = await (decoding.get(item.id) ?? decodeItem(item));
        decoding.delete(item.id);
        decodeMs += performance.now() - decodeStart;
        const analyseStart = performance.now();
        const buffer = decoded.buffer;
        const isOp1Patch = decoded.isOp1Patch;

        if (!buffer) {
          throw new Error('Impossible de décoder le flux audio');
        }

        item.audioBuffer = buffer;
        item.duration = buffer.duration;
        item.sampleRate = buffer.sampleRate;
        item.channels = buffer.numberOfChannels;
        item.progress = 60;
        paint();

        // 1. DSP Metrics & LUFS
        const metrics = calculateAudioMetrics(buffer);
        const features = extractAcousticFeatures(buffer);

        // 2. Pitch & Key detection
        const pitchKey = detectPitchAndKey(buffer);
        const detectedBpm = detectBpm(buffer);

        // 3. Loop vs One-shot classification
        const loopAnalysis = detectLoopVsOneShot(buffer, item.originalName, detectedBpm, metrics.sustainFactor);

        // 4. Slices detection
        const slices = detectAutoSlices(buffer, { sensitivity: 0.6, minSliceDurationMs: 120 });

        // 5. Sound Type & Genre
        const classification = classifySample(buffer, item.originalName, metrics, slices.length);
        const sampleType = isOp1Patch ? 'multi-sound' : classification.type;
        const genre = classifyGenre(sampleType, detectedBpm, metrics, item.originalName);

        // 6. EP-133 Slot
        const ep133Slot = assignEp133Slot(sampleType, loopAnalysis.isLoop, i + 1);

        // 7. Timbral & Enriched Tags
        const timbralTags = extractTimbralDescriptors(metrics, features);
        const enrichedTags = generateEnrichedTags(
          {
            type: sampleType,
            category: isOp1Patch ? 'multi-sound' : loopAnalysis.isLoop ? 'loop' : 'one-shot',
            isLoop: isOp1Patch ? false : loopAnalysis.isLoop,
            key: pitchKey?.keyString,
            bpm: detectedBpm || loopAnalysis.bpm,
            loopBars: loopAnalysis.loopBars,
            genre,
            tags: [...classification.tags, ...timbralTags, ...(isOp1Patch ? ['op-1', 'op1-drum-patch', '24-pad'] : [])],
            ep133Slot,
            sampleRate: targetFormat === '24b48k' ? 48000 : 44100,
            bitDepth: targetFormat === '24b48k' ? 24 : 16,
          },
          buffer
        );

        // 8. Clean Standard Name Generation
        const namingConfig: NamingConventionConfig = {
          ...DEFAULT_NAMING_CONFIG,
          preset: namingPreset,
          prefix: namingPrefix,
          includeKey: true,
          includeBpm: true,
          includeCategory: true,
          includeSpecs: true,
          includeSlot: false,
        };

        const targetBitDepth = targetFormat === '24b48k' ? 24 : 16;
        const targetSampleRate = targetFormat === '24b48k' ? 48000 : 44100;

        const dummySample: SampleItem = {
          id: item.id,
          // A source called "1-001_01" says nothing: fall back to its pack
          // folder, then to its timbre, so the library does not fill up with
          // AZ_808_01, AZ_808_01_2, AZ_808_01_3…
          name: deriveSourceName(item.originalName, item.sourcePath, {
            tags: [...classification.tags, ...timbralTags],
          }),
          originalFileName: item.originalName,
          format: isOp1Patch ? 'aiff' : 'wav',
          size: 0,
          duration: buffer.duration,
          sampleRate: targetSampleRate,
          bitDepth: targetBitDepth,
          channels: buffer.numberOfChannels,
          bpm: detectedBpm || loopAnalysis.bpm,
          key: pitchKey?.keyString,
          pitchHz: pitchKey?.pitchHz,
          type: sampleType,
          category: isOp1Patch ? 'multi-sound' : loopAnalysis.isLoop ? 'loop' : 'one-shot',
          isLoop: isOp1Patch ? false : loopAnalysis.isLoop,
          loopBars: loopAnalysis.loopBars,
          genre,
          tags: enrichedTags,
          folderId: 'f-drums',
          folderPath: '/01_DRUMS',
          favorite: false,
          rating: 4,
          spectralCentroid: metrics.spectralCentroid,
          dynamicRangeDb: metrics.dynamicRangeDb,
          peakDb: metrics.peakDb,
          rmsDb: metrics.rmsDb,
          lufs: metrics.lufs,
          loudnessGainDb: metrics.loudnessGainDb,
          zeroCrossingRate: metrics.zeroCrossingRate,
          slices,
          blobUrl: '',
          dateAdded: Date.now(),
          ep133Slot,
        };

        const standardCleanName = generateStandardSampleName(dummySample, namingConfig, i + 1);

        // 9. Clean Target Folder
        const folderInfo = isOp1Patch
          ? { folderPath: '/03_HARDWARE/OP-1_DRUM_PATCHES', folderId: 'f-op1-patches', category: 'multi-sound' as const }
          : classifySampleForLibrary(dummySample);

        analyseMs += performance.now() - analyseStart;

        // 10. Generate Final Standardized WAV Blob
        const encodeStart = performance.now();
        const wavBlob = audioBufferToWavBlob(buffer, {
          bitDepth: targetBitDepth,
          normalize: true,
          loudnessMatch: autoNormalizeLufs,
          targetLufs: loopAnalysis.isLoop ? targetLufs : -18,
          trimSilence,
        });

        encodeMs += performance.now() - encodeStart;
        const blobUrl = URL.createObjectURL(wavBlob);

        const finalSampleItem: SampleItem = {
          ...dummySample,
          name: isOp1Patch ? `OP1_${standardCleanName}` : standardCleanName,
          size: wavBlob.size,
          blobUrl,
          audioBuffer: buffer,
          folderPath: folderInfo.folderPath,
          folderId: folderInfo.folderId,
        };

        item.status = 'ready';
        item.progress = 100;
        item.cleanName = finalSampleItem.name;
        item.bpm = detectedBpm || loopAnalysis.bpm;
        item.key = pitchKey?.keyString;
        item.pitchHz = pitchKey?.pitchHz;
        item.type = sampleType;
        item.category = loopAnalysis.isLoop ? 'loop' : 'one-shot';
        item.category = isOp1Patch ? 'multi-sound' : item.category;
        item.isLoop = isOp1Patch ? false : loopAnalysis.isLoop;
        item.loopBars = loopAnalysis.loopBars;
        item.genre = genre;
        item.tags = enrichedTags;
        item.timbralTags = timbralTags;
        item.lufs = metrics.lufs;
        item.gainAdjustmentDb = metrics.loudnessGainDb;
        item.targetFolderPath = folderInfo.folderPath;
        item.targetFolderId = folderInfo.folderId;
        item.ep133Slot = ep133Slot;
        item.sampleItem = finalSampleItem;
        item.isOp1Patch = isOp1Patch;
      } catch (err: unknown) {
        console.error('Curator DSP error on item', item.originalName, err);
        item.status = 'error';
        item.errorMessage = err instanceof Error ? err.message : 'Erreur analyse DSP';
      }

      paint();
      // Hand the main thread back between files. Each one is a few hundred ms
      // of solid DSP; without this the window froze for the whole batch and
      // the space bar, the play button and the table all went dead.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    paint(true);
    const done = updatedQueue.filter((it) => it.status === 'ready').length;
    const totalMs = performance.now() - batchStart;
    console.info(
      `[curator] ${done} son(s) analysés en ${(totalMs / 1000).toFixed(1)} s ` +
        `(${Math.round(totalMs / Math.max(1, done))} ms/son — décodage ${Math.round(decodeMs)} ms, ` +
        `analyse ${Math.round(analyseMs)} ms, encodage ${Math.round(encodeMs)} ms)`
    );
    setIsProcessing(false);
    onProcessingChange?.(false);
    onQueueResult?.({
      ready: updatedQueue.filter((item) => item.status === 'ready').length,
      errors: updatedQueue.filter((item) => item.status === 'error').length,
    });
  };

  const handleTogglePlay = (item: CuratorItem) => {
    if (playingId === item.id) {
      audioEngine.pause();
      setPlayingId(null);
    } else if (item.audioBuffer) {
      audioEngine.play(item.audioBuffer, item.id, item.gainAdjustmentDb);
      setPlayingId(item.id);
    }
  };

  // 1-Click: Commit Curation into Sound Database
  const handleCommitCuration = () => {
    const readySamples = items.filter((it) => it.status === 'ready' && it.sampleItem).map((it) => it.sampleItem!);

    if (readySamples.length === 0) return;

    onApplyCuration(readySamples);
    setNotification(`${readySamples.length} sons formatés, renommés et classés avec succès dans la base !`);
    setTimeout(() => {
      setNotification(null);
      onClose();
    }, 1200);
  };

  // Export Organized ZIP Pack
  const handleExportZip = async () => {
    const readyItems = items.filter((it) => it.status === 'ready' && it.sampleItem);
    if (readyItems.length === 0) return;

    setIsExportingZip(true);
    setNotification('Génération du pack ZIP professionnel...');

    try {
      const itemsToExport = readyItems.map((it) => ({
        sample: it.sampleItem!,
        destinationPath: `${it.targetFolderPath.replace(/^\//, '')}/${it.cleanName}.wav`,
      }));

      const zipBlob = await exportMultipleWavsAsZip(itemsToExport, {
        onProgress: (cur, tot) => {
          setNotification(`Compression du pack (${cur}/${tot})...`);
        },
      });

      triggerFileDownload(zipBlob, `Curated_SoundBase_${Date.now().toString(36)}.zip`);
      setNotification('Pack ZIP téléchargé avec succès !');
      setTimeout(() => setNotification(null), 2500);
    } catch (err) {
      console.error('Erreur export ZIP', err);
      toast.error('Erreur lors de la génération du ZIP.');
    } finally {
      setIsExportingZip(false);
    }
  };

  useEffect(() => {
    if (initialFiles.length === 0) return;
    void handleFilesSelected(initialFiles, initialFilesAlreadyArchived);
    onInitialFilesHandled?.();
  }, [initialFiles, initialFilesAlreadyArchived]);

  const handleExportToFolder = async () => {
    const readyItems = items.filter((it) => it.status === 'ready' && it.sampleItem?.blobUrl);
    if (readyItems.length === 0) {
      console.info(
        `[curator] transfert ignoré : aucun son prêt (file de ${items.length}, ` +
          `${items.filter((it) => it.status === 'ready').length} analysés, ` +
          `${items.filter((it) => it.status === 'error').length} en erreur)`
      );
      return;
    }
    console.info(`[curator] transfert de ${readyItems.length} son(s) démarré`);

    if (!supportsLocalLibrary()) {
      setNotification('Cette fonction nécessite Chrome ou Edge sur ordinateur. Utilisez sinon Pack ZIP.');
      return;
    }

    try {
      const exportRoot = libraryRoot || await chooseLibraryRoot();
      if (!libraryRoot) {
        setLibraryRoot(exportRoot);
        setLibraryName(exportRoot.name);
      }

      const processedFingerprints = await getProcessedSourceFingerprints(exportRoot);
      const knownContentHashes = await getLibraryContentHashes(exportRoot);
      const transferredSourceFiles: string[] = [];
      const pendingManifest: Array<Record<string, unknown>> = [];
      const pendingWrites: Array<{ relPath: string; blob: Blob }> = [];
      let duplicatesSkipped = 0;
      const transferStart = performance.now();
      // Destination listings are cached for the batch; start from fresh ones.
      resetDirectoryNameCache();
      let hashMs = 0;
      let writeMs = 0;
      let blobMs = 0;
      let done = 0;
      let lastTick = performance.now();
      for (const item of readyItems) {
        // Progress heartbeat: a transfer that crawls is otherwise a black box.
        if (performance.now() - lastTick > 5000) {
          lastTick = performance.now();
          console.info(
            `[curator] transfert ${done}/${readyItems.length} — ` +
              `${((performance.now() - transferStart) / 1000).toFixed(1)} s ` +
              `(hachage ${Math.round(hashMs)} ms, blob ${Math.round(blobMs)} ms, écriture ${Math.round(writeMs)} ms)`
          );
        }
        done++;
        const sourceFingerprint = item.sourcePath && item.file
          ? `${item.sourcePath}:${item.file.size}:${item.file.lastModified}`
          : undefined;
        if (sourceFingerprint && processedFingerprints.has(sourceFingerprint)) {
          transferredSourceFiles.push(item.sourcePath!);
          continue;
        }
        // Same bytes as something already filed: drop the source instead of
        // writing a second copy under a "_2" name.
        const hashStart = performance.now();
        const contentHash = item.file ? await hashFileContent(item.file) : undefined;
        hashMs += performance.now() - hashStart;
        if (contentHash && knownContentHashes.has(contentHash)) {
          duplicatesSkipped++;
          if (item.sourcePath) transferredSourceFiles.push(item.sourcePath);
          continue;
        }
        const targetDirectory = await getDirectoryForPath(exportRoot, item.targetFolderPath);

        const blobStart = performance.now();
        const sourceBlob = item.isOp1Patch && item.file
          ? item.file
          : await fetch(item.sampleItem!.blobUrl).then((response) => response.blob());
        blobMs += performance.now() - blobStart;
        const extension = item.isOp1Patch ? '.aif' : '.wav';
        const filename = `${item.sampleItem!.name.replace(/\.(wav|aif|aiff)$/i, '')}${extension}`;
        // Name claimed now, bytes written later: the writes go out in parallel
        // once every destination is decided.
        const writtenFileName = await reserveUniqueFileName(targetDirectory, filename);
        pendingWrites.push({ relPath: `${targetDirectory}/${writtenFileName}`, blob: sourceBlob });
        const manifestItem: Record<string, unknown> = {
          name: item.sampleItem!.name,
          fileName: writtenFileName,
          originalName: item.originalName,
          path: item.targetFolderPath,
          type: item.type,
          category: item.category,
          bpm: item.bpm,
          key: item.key,
          tags: item.tags,
          duration: item.duration,
          sampleRate: item.sampleRate,
          bitDepth: item.bitDepth,
          format: item.isOp1Patch ? 'op-1-aiff' : 'wav',
          sourceFingerprint,
          contentHash,
        };
        // Collected, then committed once for the whole batch: rewriting the
        // full manifest per file made every batch slower as the library grew.
        pendingManifest.push(manifestItem);
        if (sourceFingerprint) processedFingerprints.add(sourceFingerprint);
        if (contentHash) knownContentHashes.add(contentHash);
        if (item.sourcePath) transferredSourceFiles.push(item.sourcePath);
      }
      // Writes overlap: one file at a time spent its life waiting on the disk.
      const writeStart = performance.now();
      await runWithConcurrency(pendingWrites, WRITE_CONCURRENCY, async (write) => {
        await writeFileAt(write.relPath, write.blob);
      });
      writeMs = performance.now() - writeStart;

      // The sources only go once their destination *and* the manifest are on
      // disk — that order is the guarantee the working folder never loses a
      // sound.
      if (pendingManifest.length > 0) await writeLibraryManifest(exportRoot, pendingManifest);
      const removedCount = await removeWorkFolderFiles(exportRoot, transferredSourceFiles);
      onLibraryChanged?.();

      if (autoTransfer && !isOpen) {
        const transferredIds = new Set(readyItems.map((item) => item.id));
        setItems((current) => current.filter((item) => !transferredIds.has(item.id)));
      }

      const written = readyItems.length - duplicatesSkipped;
      console.info(
        `[curator] transfert de ${written} son(s) en ${((performance.now() - transferStart) / 1000).toFixed(1)} s ` +
          `(hachage ${Math.round(hashMs)} ms, blob ${Math.round(blobMs)} ms, écriture ${Math.round(writeMs)} ms)`
      );
      setNotification(
        `${written} son(s) rangé(s), ${removedCount} source(s) retirée(s) de la réception` +
          (duplicatesSkipped > 0 ? `, ${duplicatesSkipped} doublon(s) déjà en bibliothèque ignoré(s).` : '.')
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Erreur export vers dossier', err);
      setNotification("Impossible d'écrire dans ce dossier. Vérifiez l'autorisation puis réessayez.");
    }
  };

  useEffect(() => {
    if (!autoTransfer || isOpen || isProcessing || !libraryRoot) return;
    const readyItems = items.filter((item) => item.status === 'ready' && item.sampleItem);
    if (readyItems.length === 0) return;
    const signature = readyItems.map((item) => item.id).join('|');
    if (autoTransferredSignature.current === signature) {
      console.info('[curator] lot déjà transféré, en attente de nouveaux sons');
      return;
    }
    autoTransferredSignature.current = signature;
    void handleExportToFolder();
  }, [autoTransfer, isOpen, isProcessing, items, libraryRoot]);

  const readyCount = items.filter((i) => i.status === 'ready').length;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="full"
      accent="#00F0FF"
      icon={<Wand2 className="h-5 w-5" />}
      title="Studio Auto-Curateur & rangement intelligent"
      subtitle="Puisage, analyse spectrale, enrichissement des tags, mise au format WAV & rangement"
      bodyClassName="flex flex-col overflow-hidden font-mono text-xs"
      headerRight={
        <>
            <button
              onClick={handleChooseLibrary}
              className="px-3 py-1.5 rounded-lg bg-[#A855F7]/15 hover:bg-[#A855F7]/25 border border-[#A855F7]/40 text-xs font-semibold text-[#C084FC] flex items-center gap-1.5 transition"
              title="Choisir la racine de votre bibliothèque locale"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>{libraryName ? `Bibliothèque : ${libraryName}` : 'Connecter bibliothèque'}</span>
            </button>
            <button
              disabled={readyCount === 0}
              onClick={handleExportZip}
              className="px-3 py-1.5 rounded-lg bg-[#181B26] hover:bg-[#222636] border border-[#2B2F40] text-xs font-semibold text-white flex items-center gap-1.5 transition disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Pack ZIP</span>
            </button>
            <button
              disabled={readyCount === 0}
              onClick={handleExportToFolder}
              className="px-3 py-1.5 rounded-lg bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 border border-[#00F0FF]/40 text-xs font-semibold text-[#00F0FF] flex items-center gap-1.5 transition disabled:opacity-40"
              title="Choisir un dossier de destination et y créer l'arborescence de classement"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Exporter dans un dossier</span>
            </button>


            <button
              onClick={handleCommitCuration}
              disabled={readyCount === 0}
              className="px-4 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#33F3FF] text-[#0A0A0E] text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-[#00F0FF]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>Valider & Ranger ({readyCount})</span>
            </button>
        </>
      }
    >
        {/* Notification banner */}
        {notification && (
          <div className="bg-[#00F0FF]/15 border-b border-[#00F0FF]/30 px-5 py-2 text-xs text-[#00F0FF] flex items-center gap-2 font-semibold animate-in fade-in">
            <Sparkles className="w-4 h-4" />
            <span>{notification}</span>
          </div>
        )}

        {/* Source Mode Tabs & Parameters Toolbar */}
        <div className="px-5 py-3 bg-[#0E1017] border-b border-[#20222F] space-y-3">
          {/* Source Switcher */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8E8E9A] uppercase tracking-wider">Source :</span>
              <div className="flex rounded-lg bg-[#141620] border border-[#262836] p-0.5">
                <button
                  onClick={() => setSourceMode('upload')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                    sourceMode === 'upload'
                      ? 'bg-[#00F0FF] text-[#0A0A0E]'
                      : 'text-[#8E8E9A] hover:text-white'
                  }`}
                >
                  <FolderUp className="w-3.5 h-3.5" />
                  <span>Dossier / Disque externe</span>
                </button>
                <button
                  onClick={() => {
                    setSourceMode('library');
                    handleLoadFromLibrary();
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                    sourceMode === 'library'
                      ? 'bg-[#00F0FF] text-[#0A0A0E]'
                      : 'text-[#8E8E9A] hover:text-white'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Bibliothèque Actuelle ({librarySamples.length} sons)</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {!workFolderOnly && sourceMode === 'upload' && (
                <>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="px-3 py-1 rounded-lg bg-[#181B26] hover:bg-[#222636] border border-[#2B2F40] text-xs text-[#00F0FF] font-semibold flex items-center gap-1.5 transition"
                  >
                    <FolderUp className="w-3.5 h-3.5" />
                    <span>Choisir le dossier source</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 rounded-lg bg-[#181B26] hover:bg-[#222636] border border-[#2B2F40] text-xs text-white font-semibold flex items-center gap-1.5 transition"
                  >
                    <FileAudio className="w-3.5 h-3.5" />
                    <span>+ Fichiers</span>
                  </button>
                </>
              )}
              {items.length > 0 && (
                <button
                  onClick={() => setItems([])}
                  className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs text-red-400 transition"
                >
                  Vider la file
                </button>
              )}
            </div>
          </div>

          {/* Curation Rules & Controls Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            {/* Target Audio Format */}
            <div className="bg-[#13151F] p-2 rounded-lg border border-[#222433] space-y-1">
              <span className="text-[10px] text-[#8E8E9A] block">Format Audio Cible :</span>
              <select
                value={targetFormat}
                onChange={(e) => setTargetFormat(e.target.value as any)}
                className="w-full bg-[#181B28] border border-[#2B2F40] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#00F0FF]"
              >
                <option value="24b48k">24-bit 48kHz (Studio Master)</option>
                                <option value="16b44k">16-bit 44.1k (EP-133 &amp; OP-1)</option>
              </select>
            </div>

            {/* Renaming Convention Preset */}
            <div className="bg-[#13151F] p-2 rounded-lg border border-[#222433] space-y-1">
              <span className="text-[10px] text-[#8E8E9A] block">Convention de Nom :</span>
              <select
                value={namingPreset}
                onChange={(e) => setNamingPreset(e.target.value as any)}
                className="w-full bg-[#181B28] border border-[#2B2F40] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#00F0FF]"
              >
                <option value="splice_pro">Splice Pro (AZ_Kick_Punchy_F#m_140)</option>
                <option value="industry_pro">Industry Pro (DRUM_KCK_F#m_140BPM)</option>
                <option value="teenage_eng">Teenage Eng. (001_KCK_Punchy)</option>
                <option value="daw_clean">DAW Clean (Kick Punchy F#m 140bpm)</option>
                <option value="minimal_type">Minimal (KCK_Punchy)</option>
              </select>
            </div>

            {/* Target Folder Layout Scheme */}
            <div className="bg-[#13151F] p-2 rounded-lg border border-[#222433] space-y-1">
              <span className="text-[10px] text-[#8E8E9A] block">Structure Dossiers :</span>
              <div className="w-full bg-[#181B28] border border-[#2B2F40] rounded px-2 py-0.5 text-xs text-[#00F0FF] font-semibold">
                2 catégories : One-shots / Loops
              </div>
            </div>

            {/* Target Loudness */}
            <div className="bg-[#13151F] p-2 rounded-lg border border-[#222433] space-y-1">
              <span className="text-[10px] text-[#8E8E9A] block">Normalisation LUFS :</span>
              <select
                value={targetLufs}
                onChange={(e) => setTargetLufs(Number(e.target.value))}
                className="w-full bg-[#181B28] border border-[#2B2F40] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#00F0FF]"
              >
                <option value={-14}>-14 LUFS (Standard Universel)</option>
                <option value={-12}>-12 LUFS (Club & Hard Hits)</option>
                <option value={-16}>-16 LUFS (Acoustique & Dynamique)</option>
                <option value={-18}>-18 LUFS (Headroom Max)</option>
              </select>
            </div>

            {/* Trim silence toggle */}
            <label className="bg-[#13151F] p-2 rounded-lg border border-[#222433] flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-[#EDEDEE]">Trim Silences & DC</span>
              <input
                type="checkbox"
                checked={trimSilence}
                onChange={(e) => setTrimSilence(e.target.checked)}
                className="rounded bg-[#181B28] border-[#2B2F40] text-[#00F0FF] focus:ring-0"
              />
            </label>

            {/* Auto Level Gain toggle */}
            <label className="bg-[#13151F] p-2 rounded-lg border border-[#222433] flex items-center justify-between cursor-pointer">
              <span className="text-[11px] text-[#00F0FF] font-semibold">Auto-Gain EBU R128</span>
              <input
                type="checkbox"
                checked={autoNormalizeLufs}
                onChange={(e) => setAutoNormalizeLufs(e.target.checked)}
                className="rounded bg-[#181B28] border-[#2B2F40] text-[#00F0FF] focus:ring-0"
              />
            </label>
          </div>
        </div>

        {/* Drag & Drop Area or Interactive Table */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) {
                  setNotification("Déposez les fichiers dans le dossier de travail : ils seront détectés automatiquement.");
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all flex flex-col items-center justify-center gap-4 ${
                isDragging
                  ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                  : 'border-[#222433] hover:border-[#383B4F] bg-[#0F1118]'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-[#141622] border border-[#262838] flex items-center justify-center text-[#00F0FF] shadow-inner">
                <FolderUp className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Déposez un dossier brut de sons ou puisez dans votre bibliothèque
                </h3>
                <p className="text-xs text-[#8E8E9A] max-w-lg mx-auto">
                  L'intelligence DSP étudie chaque fichier (fréquences, timbre, tonalité, BPM), applique les bons tags enrichis, renomme selon les standards pro et classe chaque son dans les 7 dossiers fondamentaux sans surcharge.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setNotification("Utilisez le dossier de travail connecté, pas un dossier source externe.")}
                  className="px-4 py-2 rounded-lg bg-[#00F0FF] text-[#0A0A0E] font-bold text-xs hover:bg-[#33F3FF] transition flex items-center gap-2 shadow"
                >
                  <FolderUp className="w-4 h-4" /> Sélectionner un Dossier
                </button>
                <button
                  onClick={() => setNotification("Utilisez le dossier de travail connecté, pas une importation de fichiers.")}
                  className="px-4 py-2 rounded-lg bg-[#181B26] border border-[#2B2F40] text-white text-xs hover:bg-[#222636] transition flex items-center gap-2"
                >
                  <FileAudio className="w-4 h-4" /> Sélectionner des Fichiers
                </button>
                {librarySamples.length > 0 && (
                  <button
                    onClick={() => {
                      setSourceMode('library');
                      handleLoadFromLibrary();
                    }}
                    className="px-4 py-2 rounded-lg bg-[#A855F7]/20 border border-[#A855F7]/40 text-[#A855F7] text-xs hover:bg-[#A855F7]/30 transition flex items-center gap-2"
                  >
                    <Folder className="w-4 h-4" /> Curer la Bibliothèque ({librarySamples.length})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>File de Curation ({readyCount} / {items.length} prêts)</span>
                  {isProcessing && (
                    <span className="flex items-center gap-1 text-[#00F0FF] text-[11px] font-normal">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyse DSP & Encodage...
                    </span>
                  )}
                </div>
              </div>

              {/* Curator Interactive Table */}
              <div className="border border-[#20222F] rounded-xl overflow-hidden bg-[#0D0F16]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#20222F] bg-[#12141F] text-[#8E8E9A] font-semibold text-[11px]">
                      <th className="py-2.5 px-3 w-10 text-center">Audition</th>
                      <th className="py-2.5 px-3">Statut</th>
                      <th className="py-2.5 px-3">Nom Original</th>
                      <th className="py-2.5 px-3 text-center">→</th>
                      <th className="py-2.5 px-3 text-[#00F0FF]">Nouveau Nom Standardisé</th>
                      <th className="py-2.5 px-3">Tonalité / BPM</th>
                      <th className="py-2.5 px-3">Tags & Timbre DSP</th>
                      <th className="py-2.5 px-3">Dossier Cible</th>
                      <th className="py-2.5 px-3">Loudness</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#171926]">
                    {items.map((it) => (
                      <tr
                        key={it.id}
                        className={`transition hover:bg-[#131520] ${
                          playingId === it.id ? 'bg-[#00F0FF]/5' : ''
                        }`}
                      >
                        {/* Play Button */}
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleTogglePlay(it)}
                            disabled={!it.audioBuffer}
                            className={`p-1.5 rounded-lg border transition ${
                              playingId === it.id
                                ? 'bg-[#00F0FF] text-black border-[#00F0FF]'
                                : 'bg-[#181B26] text-[#EDEDEE] border-[#2A2E3E] hover:border-[#00F0FF]'
                            } disabled:opacity-30`}
                          >
                            {playingId === it.id ? (
                              <Pause className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current" />
                            )}
                          </button>
                        </td>

                        {/* Status */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          {it.status === 'ready' && (
                            <span className="text-[#10B981] flex items-center gap-1 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Prêt
                            </span>
                          )}
                          {it.status === 'analyzing' && (
                            <span className="text-[#00F0FF] flex items-center gap-1 text-[11px]">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {it.progress}%
                            </span>
                          )}
                          {it.status === 'pending' && (
                            <span className="text-[#8E8E9A]">En attente</span>
                          )}
                          {it.status === 'error' && (
                            <span className="text-red-400 flex items-center gap-1 text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5" /> Erreur
                            </span>
                          )}
                        </td>

                        {/* Old Name */}
                        <td className="py-2 px-3 text-[#8E8E9A] max-w-[160px] truncate" title={it.originalName}>
                          {it.originalName}
                        </td>

                        {/* Arrow */}
                        <td className="py-2 px-1 text-center text-[#00F0FF]">
                          <ArrowRight className="w-3.5 h-3.5 inline" />
                        </td>

                        {/* Clean Standardized Name */}
                        <td className="py-2 px-3 text-white font-bold max-w-[200px] truncate" title={it.cleanName}>
                          {it.cleanName}
                        </td>

                        {/* Key & BPM */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          {it.key || it.bpm ? (
                            <div className="flex items-center gap-1.5">
                              {it.key && (
                                <span className="px-1.5 py-0.5 rounded bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/30 font-bold text-[10px]">
                                  {it.key}
                                </span>
                              )}
                              {it.bpm && (
                                <span className="px-1.5 py-0.5 rounded bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 font-bold text-[10px]">
                                  {it.bpm} BPM
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#555]">-</span>
                          )}
                        </td>

                        {/* Tags & Timbre Pills */}
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {it.timbralTags.slice(0, 3).map((tg) => (
                              <span
                                key={tg}
                                className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#1B1E2C] text-[#38BDF8] border border-[#38BDF8]/30"
                              >
                                {tg}
                              </span>
                            ))}
                            {it.tags.length > it.timbralTags.length && (
                              <span className="text-[9px] text-[#8E8E9A]">
                                +{it.tags.length - Math.min(3, it.timbralTags.length)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Target Folder */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-[#181B26] border border-[#2B2F40] text-[#00F0FF] font-semibold text-[11px] flex items-center gap-1 w-fit">
                            <Folder className="w-3 h-3" />
                            {it.targetFolderPath}
                          </span>
                        </td>

                        {/* Loudness & Gain */}
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px]">
                          {it.lufs ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[#EDEDEE]">{it.lufs.toFixed(1)} LUFS</span>
                              {it.gainAdjustmentDb !== 0 && (
                                <span
                                  className={`text-[10px] ${
                                    it.gainAdjustmentDb > 0 ? 'text-[#10B981]' : 'text-amber-400'
                                  }`}
                                >
                                  ({it.gainAdjustmentDb > 0 ? `+${it.gainAdjustmentDb.toFixed(1)}` : it.gainAdjustmentDb.toFixed(1)}dB)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#555]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Hidden inputs for folder and files */}
        <input
          ref={folderInputRef}
          type="file"
          {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,.wav,.mp3,.aiff,.flac,.ogg"
          className="hidden"
          onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
        />

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#20222F] bg-[#0E1017] flex items-center justify-between text-xs">
          <div className="text-[#8E8E9A] flex items-center gap-2">
            <Disc className="w-4 h-4 text-[#00F0FF]" />
            <span>
              {readyCount} sons prêts • Formatage 24-bit 48kHz & Tagging acoustique complet
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-[#181B26] hover:bg-[#222636] text-[#8E8E9A] hover:text-white transition"
            >
              Fermer
            </button>
            <button
              onClick={handleCommitCuration}
              disabled={readyCount === 0}
              className="px-5 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#33F3FF] text-[#0A0A0E] font-bold flex items-center gap-1.5 transition shadow-lg shadow-[#00F0FF]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>Valider & Ranger la Base ({readyCount})</span>
            </button>
          </div>
        </div>
    </Modal>
  );
};
