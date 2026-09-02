import type { ParamValues, RackModuleDef, RackNode } from '../types';

const dbToLin = (db: number) => Math.pow(10, db / 20);

export const gainModule: RackModuleDef = {
  type: 'fx.gain',
  kind: 'utility',
  label: 'Gain',
  family: 'Utility',
  params: [{ key: 'gain', label: 'Gain', type: 'float', min: -60, max: 24, step: 0.5, unit: 'dB', default: 0 }],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const node = ctx.createGain();
    const apply = (p: ParamValues) => {
      node.gain.value = dbToLin(p.gain as number);
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
