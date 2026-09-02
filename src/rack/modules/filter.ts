import type { ParamValues, RackModuleDef, RackNode } from '../types';

const FILTER_TYPES = [
  'lowpass',
  'highpass',
  'bandpass',
  'notch',
  'lowshelf',
  'highshelf',
  'peaking',
] as const;

export const filterModule: RackModuleDef = {
  type: 'fx.filter',
  kind: 'insert',
  label: 'Filter',
  family: 'Filter',
  params: [
    { key: 'type', label: 'Type', type: 'enum', options: FILTER_TYPES, default: 'lowpass' },
    { key: 'frequency', label: 'Freq', type: 'float', min: 20, max: 20000, step: 1, unit: 'Hz', default: 1200 },
    { key: 'q', label: 'Q', type: 'float', min: 0.1, max: 20, step: 0.1, default: 0.7 },
    { key: 'gain', label: 'Gain', type: 'float', min: -24, max: 24, step: 0.5, unit: 'dB', default: 0 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const node = ctx.createBiquadFilter();
    const apply = (p: ParamValues) => {
      node.type = p.type as BiquadFilterType;
      node.frequency.value = p.frequency as number;
      node.Q.value = p.q as number;
      node.gain.value = p.gain as number;
    };
    apply(params);
    return {
      input: node,
      output: node,
      update: apply,
      dispose: () => {
        try {
          node.disconnect();
        } catch {
          /* noop */
        }
      },
    };
  },
};
