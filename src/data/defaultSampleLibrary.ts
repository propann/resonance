import { SampleItem, FolderItem } from '../types/sample';
import { audioEngine } from '../services/audioEngine';
import { audioBufferToWavBlob } from '../services/audioConverter';
import { calculateAudioMetrics, detectAutoSlices } from '../services/audioAnalyzer';
import { classifySampleForLibrary } from '../services/proFolderOrganizer';

// This is the exact hierarchy created in the working folder. Keeping a single
// definition here prevents the UI from advertising folders that do not exist.
export const DEFAULT_FOLDERS: FolderItem[] = [
  { id: 'f-root-oneshots', name: '01_ONE_SHOTS', path: '/01_ONE_SHOTS', color: '#00F0FF', icon: 'Zap', count: 0 },
  { id: 'f-os-drums', name: '01_DRUMS', path: '/01_ONE_SHOTS/01_DRUMS', color: '#00F0FF', icon: 'Drum', count: 0, parentId: 'f-root-oneshots' },
  { id: 'f-os-bass', name: '02_BASS_808', path: '/01_ONE_SHOTS/02_BASS_808', color: '#A855F7', icon: 'Flame', count: 0, parentId: 'f-root-oneshots' },
  { id: 'f-os-melodic', name: '03_MELODIC', path: '/01_ONE_SHOTS/03_MELODIC', color: '#3B82F6', icon: 'Music', count: 0, parentId: 'f-root-oneshots' },
  { id: 'f-os-vocals', name: '04_VOCALS', path: '/01_ONE_SHOTS/04_VOCALS', color: '#EC4899', icon: 'Mic', count: 0, parentId: 'f-root-oneshots' },
  { id: 'f-os-fx', name: '05_FX_TEXTURES', path: '/01_ONE_SHOTS/05_FX_TEXTURES', color: '#EAB308', icon: 'Sparkles', count: 0, parentId: 'f-root-oneshots' },
  { id: 'f-root-multisound', name: '06_KITS_MULTI', path: '/01_ONE_SHOTS/06_KITS_MULTI', color: '#FF7A00', icon: 'Layers', count: 0, parentId: 'f-root-oneshots' },
  { id: 'f-root-loops', name: '02_LOOPS', path: '/02_LOOPS', color: '#10B981', icon: 'Repeat', count: 0 },
  { id: 'f-lp-drums', name: '01_DRUM_LOOPS', path: '/02_LOOPS/01_DRUM_LOOPS', color: '#10B981', icon: 'Drum', count: 0, parentId: 'f-root-loops' },
  { id: 'f-lp-melodic', name: '02_MELODIC_LOOPS', path: '/02_LOOPS/02_MELODIC_LOOPS', color: '#06B6D4', icon: 'Music', count: 0, parentId: 'f-root-loops' },
  { id: 'f-lp-vocals', name: '03_VOCAL_LOOPS', path: '/02_LOOPS/03_VOCAL_LOOPS', color: '#EC4899', icon: 'Mic', count: 0, parentId: 'f-root-loops' },
  { id: 'f-lp-atmo', name: '04_TEXTURES', path: '/02_LOOPS/04_TEXTURES', color: '#6366F1', icon: 'Layers', count: 0, parentId: 'f-root-loops' },
  { id: 'f-root-hardware', name: '03_HARDWARE', path: '/03_HARDWARE', color: '#FF7A00', icon: 'Cpu', count: 0 },
  { id: 'f-op1-patches', name: 'OP-1_DRUM_PATCHES', path: '/03_HARDWARE/OP-1_DRUM_PATCHES', color: '#FF7A00', icon: 'Disc', count: 0, parentId: 'f-root-hardware' },
];

/**
 * Procedurally synthesizes high-quality audio buffers for the starter library
 */
