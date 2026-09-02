import type { ParamValues, RackModuleDef, RackNode } from '../types';

export const compressorModule: RackModuleDef = {
  type: 'fx.compressor',
  kind: 'insert',
  label: 'Compressor',
  family: 'Dynamics',
  params: [
    { key: 'threshold', label: 'Threshold', type: 'float', min: -60, max: 0, step: 1, unit: 'dB', default: -24 },
    { key: 'knee', label: 'Knee', type: 'float', min: 0, max: 40, step: 1, unit: 'dB', default: 6 },
    { key: 'ratio', label: 'Ratio', type: 'float', min: 1, max: 20, step: 0.5, default: 4 },
    { key: 'attack', label: 'Attack', type: 'float', min: 0, max: 1, step: 0.001, unit: 's', default: 0.01 },
    { key: 'release', label: 'Release', type: 'float', min: 0.01, max: 1, step: 0.01, unit: 's', default: 0.25 },
    { key: 'makeup', label: 'Makeup', type: 'float', min: -12, max: 24, step: 0.5, unit: 'dB', default: 0 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const comp = ctx.createDynamicsCompressor();
    const makeup = ctx.createGain();
    comp.connect(makeup);

    const apply = (p: ParamValues) => {
      comp.threshold.value = p.threshold as number;
      comp.knee.value = p.knee as number;
      comp.ratio.value = p.ratio as number;
      comp.attack.value = p.attack as number;
      comp.release.value = p.release as number;
      makeup.gain.value = Math.pow(10, (p.makeup as number) / 20);
    };
    apply(params);

    return {
      input: comp,
      output: makeup,
      update: apply,
      dispose: () => {
        for (const n of [comp, makeup]) {
          try {
            n.disconnect();
          } catch {
            /* noop */
          }
        }
      },
    };
  },
};
