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

/** Starter racks — plain data, expanded into a RackState by rackStore.applyTemplate. */
export const RACK_TEMPLATES: RackTemplate[] = [
  {
    id: 'lofi-sampler',
    label: 'Lo-Fi Sampler',
    modules: [
      { type: 'fx.bitcrusher', params: { bits: 10, reduction: 3, mix: 0.7 } },
      { type: 'fx.filter', params: { type: 'lowpass', frequency: 4500, q: 0.7 } },
      { type: 'fx.saturator', params: { shape: 'tape', drive: 3, mix: 0.5 } },
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
    id: 'eight-weight',
    label: '808 Weight',
    modules: [
      { type: 'fx.subbass', params: { frequency: 50, boost: 8, sub: 0.5, drive: 0.35 } },
      { type: 'fx.saturator', params: { shape: 'tape', drive: 2.5, mix: 0.35 } },
      { type: 'fx.dcremove', params: { frequency: 20 } },
    ],
  },
  {
    id: 'funk-wah',
    label: 'Funk Wah',
    modules: [
      { type: 'fx.autowah', params: { sensitivity: 0.7, base: 450, range: 2800, resonance: 0.55, mix: 0.9 } },
      { type: 'fx.exciter', params: { frequency: 8000, drive: 3, amount: 0.4 } },
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
