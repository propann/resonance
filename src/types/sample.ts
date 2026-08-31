export type SampleType =
  | 'kick'
  | 'snare'
  | 'hihat'
  | 'clap'
  | 'cymbal'
  | 'percussion'
  | 'bass'
  | '808'
  | 'lead'
  | 'pad'
  | 'vocal'
  | 'fx'
  | 'loop'
  | 'multi-sound'
  | 'other';

export type MusicGenre =
  | 'Hip-Hop / BoomBap'
  | 'Trap / Drill'
  | 'House / EDM'
  | 'Techno'
  | 'Techno / Industrial'
  | 'Lo-Fi / Chillhop'
  | 'Synthwave / Retro'
  | 'Drum & Bass'
  | 'Drum & Bass / Jungle'
  | 'Afrobeat / Dancehall'
  | 'Ambient / Cinematic'
  | 'Pop / R&B'
  | 'Acoustic / Rock'
  | 'Universal / Multi-Genre';

export type SampleCategory = 'one-shot' | 'loop' | 'multi-sound';

export type HardwarePreset = 'ep133' | 'op1' | 'sp404' | 'mpc' | 'digitakt' | 'studio';

export interface SliceRegion {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  label: string;
  color: string;
  detectedKey?: string;
  detectedBpm?: number;
  detectedType?: SampleType;
}

export interface SampleItem {
  id: string;
  name: string;
  originalFileName: string;
  format: 'wav' | 'mp3' | 'ogg' | 'flac' | 'aiff' | 'webm' | 'm4a';
  size: number; // bytes
  duration: number; // seconds
  sampleRate: number; // e.g. 44100, 48000, 46875
  bitDepth: number; // 16, 24, 32
  channels: number; // 1 = mono, 2 = stereo
  bpm?: number;
  key?: string; // e.g. "C min", "F# maj"
  musicalMode?: 'maj' | 'min';
  confidence?: number;
  pitchHz?: number;
  type: SampleType;
  category: SampleCategory; // 'one-shot' | 'loop' | 'multi-sound'
  isLoop: boolean;
  loopBars?: number; // 1, 2, 4, 8, 16 bars
  genre: MusicGenre;
  tags: string[];
  folderId: string;
  folderPath: string;
  favorite: boolean;
  rating: number; // 0 to 5
  spectralCentroid: number; // 0 - 10000 Hz (brightness)
  dynamicRangeDb: number;
  peakDb: number;
  rmsDb: number;
  lufs: number; // Integrated LUFS loudness (EBU R128 approx)
  loudnessGainDb: number; // Gain needed to match reference level
  zeroCrossingRate: number;
  slices: SliceRegion[];
  blobUrl: string;
  audioBuffer?: AudioBuffer;
  dateAdded: number;
  colorTag?: string;
  isMultiSound?: boolean;
  ep133Slot?: number; // 1 - 999
}

export interface FolderItem {
  id: string;
  name: string;
  path: string;
  color?: string;
  icon?: string;
  count: number;
  parentId?: string;
}

export interface FilterState {
  searchQuery: string;
  selectedFolderId: string | null;
  selectedType: SampleType | 'all';
  selectedCategory: SampleCategory | 'all';
  selectedGenre: MusicGenre | 'all';
  selectedKey: string | 'all';
  minBpm: number;
  maxBpm: number;
  minDuration: number;
  maxDuration: number;
  favoritesOnly: boolean;
  hasSlicesOnly: boolean;
  selectedTags: string[];
  sortField: 'name' | 'dateAdded' | 'bpm' | 'key' | 'duration' | 'size' | 'rating' | 'type' | 'lufs' | 'genre';
  sortDirection: 'asc' | 'desc';
}

export interface BatchConvertSettings {
  targetFormat: 'wav' | 'mp3' | 'webm';
  hardwarePreset: HardwarePreset;
  sampleRate: 44100 | 48000 | 46875 | 96000 | 'original';
  bitDepth: 16 | 24 | 32;
  channels: 'stereo' | 'mono' | 'original';
  normalize: boolean;
  loudnessMatch: boolean;
  targetLufs: number; // default -14 LUFS for loops, -1 dBFS for one shots
  targetPeakDb: number;
  removeDcOffset: boolean;
  trimSilence: boolean;
  silenceThresholdDb: number;
  fileNamePattern: string; // e.g. "{ep133_slot}_{name}_{key}_{bpm}bpm_{type}"
  ep133StartingSlot: number; // 1 to 999
  splitByCategories: boolean; // Create /Kicks, /Snares, /Loops subfolders in ZIP
}

export interface BatchJob {
  id: string;
  sampleId: string;
  sampleName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  errorMessage?: string;
  resultBlobUrl?: string;
  resultFileName?: string;
  resultSize?: number;
}

