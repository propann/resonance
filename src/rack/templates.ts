import type { ParamValues } from './types';

export interface RackTemplateModule {
  type: string;
  params?: ParamValues;
}

export interface RackTemplate {
  id: string;
  label: string;
  modules: RackTemplateModule[];
}

/**
 * Starter racks — plain data, expanded into a RackState by
 * rackStore.applyTemplate. The first group mirrors the recipes that used to
 * live in the AudioEffectsRackModal combo buttons.
 */
export const RACK_TEMPLATES: RackTemplate[] = [
  {
    id: 'drill-808',
    label: '808 Drill',
    modules: [
      { type: 'fx.subbass', params: { frequency: 50, boost: 12, sub: 0.4, drive: 0.35 } },
      { type: 'fx.saturator', params: { shape: 'hardclip', drive: 6, mix: 0.45 } },
      { type: 'fx.transient', params: { attack: 4, sustain: 2, speed: 35 } },
      {
        type: 'fx.compressor',
        params: { threshold: -14, ratio: 4, attack: 0.006, release: 0.12, makeup: 3 },
      },
    ],
  },
  {
    id: 'cosmic-echo',
    label: 'Cosmic Echo',
    modules: [
      { type: 'fx.delay', params: { time: 0.42, feedback: 0.55, mix: 0.4 } },
      { type: 'fx.reverb', params: { size: 4.5, damp: 0.2, mix: 0.5 } },
      { type: 'fx.imager', params: { width: 1.6 } },
      { type: 'fx.autopan', params: { rate: 0.4, depth: 0.35 } },
    ],
  },
  {
    id: 'lofi-sampler',
    label: 'Lo-Fi Sampler',
    modules: [
      { type: 'fx.bitcrusher', params: { bits: 12, reduction: 2, mix: 0.65 } },
      { type: 'fx.saturator', params: { shape: 'tape', drive: 3, mix: 0.5 } },
      { type: 'fx.filter', params: { type: 'lowpass', frequency: 4500, q: 2 } },
      { type: 'fx.vinyl', params: { wow: 0.3, flutter: 0.25, crackle: 0.3, age: 0.5, mix: 0.5 } },
    ],
  },
  {
    id: 'vinyl-cassette',
    label: 'Vinyl Cassette',
    modules: [
      { type: 'fx.vinyl', params: { wow: 0.4, flutter: 0.35, crackle: 0.55, age: 0.6, mix: 0.7 } },
      { type: 'fx.saturator', params: { shape: 'tube', drive: 3, mix: 0.4 } },
      {
        type: 'fx.compressor',
        params: { threshold: -18, ratio: 3, attack: 0.01, release: 0.2, makeup: 2 },
      },
    ],
  },
  {
    id: 'glitch-acid',
    label: 'Glitch Acid',
    modules: [
      { type: 'fx.stutter', params: { rate: 14, repeat: 3, duty: 0.5, mix: 0.8 } },
      {
        type: 'fx.acid',
        params: { cutoff: 1800, resonance: 14, drive: 3, lfoRate: 1.2, lfoDepth: 600, mix: 1 },
      },
      { type: 'fx.bitcrusher', params: { bits: 6, reduction: 1, mix: 0.5 } },
    ],
  },
  {
    id: 'funk-wah',
    label: 'Funk Wah',
    modules: [
      { type: 'fx.autowah', params: { sensitivity: 0.65, base: 450, range: 2800, resonance: 0.5, mix: 0.85 } },
      { type: 'fx.exciter', params: { frequency: 8000, drive: 3, amount: 0.5 } },
      {
        type: 'fx.compressor',
        params: { threshold: -12, ratio: 3.5, attack: 0.015, release: 0.2, makeup: 2.5 },
      },
    ],
  },

  {
    id: 'drum-punch',
    label: 'Drum Punch',
    modules: [
      { type: 'fx.transient', params: { attack: 5, sustain: -2, speed: 40 } },
      { type: 'fx.saturator', params: { shape: 'tube', drive: 2, mix: 0.3 } },
      {
        type: 'fx.compressor',
        params: { threshold: -16, ratio: 3, attack: 0.008, release: 0.1, makeup: 2 },
      },
    ],
  },
  {
    id: 'drum-glue',
    label: 'Drum Glue',
    modules: [
      { type: 'fx.saturator', params: { shape: 'tube', drive: 2.5, mix: 0.4 } },
      {
        type: 'fx.compressor',
        params: { threshold: -18, ratio: 4, attack: 0.005, release: 0.12, makeup: 3 },
      },
    ],
  },
  {
    id: 'eight-weight',
    label: '808 Weight',
    modules: [
      { type: 'fx.subbass', params: { frequency: 50, boost: 8, sub: 0.5, drive: 0.35 } },
      { type: 'fx.saturator', params: { shape: 'tape', drive: 2.5, mix: 0.35 } },
      { type: 'fx.dcremove', params: { frequency: 20 } },
    ],
  },
  {
    id: 'space',
    label: 'Space Designer',
    modules: [
      { type: 'fx.delay', params: { time: 0.28, feedback: 0.4, mix: 0.35 } },
      { type: 'fx.reverb', params: { size: 3, damp: 0.35, mix: 0.4 } },
    ],
  },
  {
    id: 'warm-wide',
    label: 'Warm & Wide',
    modules: [
      { type: 'fx.dcremove', params: { frequency: 24 } },
      { type: 'fx.saturator', params: { shape: 'tube', drive: 1.8, mix: 0.35 } },
      { type: 'fx.chorus', params: { rate: 0.5, depth: 0.004, mix: 0.3 } },
      { type: 'fx.imager', params: { width: 1.4 } },
    ],
  },
  {
    id: 'air-sparkle',
    label: 'Air & Sparkle',
    modules: [
      { type: 'fx.exciter', params: { frequency: 6500, drive: 3.5, amount: 0.45 } },
      { type: 'fx.imager', params: { width: 1.25 } },
    ],
  },
];
