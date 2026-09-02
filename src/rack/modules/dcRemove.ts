import type { ParamValues, RackModuleDef, RackNode } from '../types';

/** Highpass just above DC — kills offset and sub-rumble on the monitor path. */
export const dcRemoveModule: RackModuleDef = {
  type: 'fx.dcremove',
  kind: 'utility',
  label: 'DC / Rumble',
  family: 'Utility',
  params: [
    { key: 'frequency', label: 'Corner', type: 'float', min: 2, max: 40, step: 1, unit: 'Hz', default: 12 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.Q.value = 0.707;
    const apply = (p: ParamValues) => {
      hp.frequency.value = p.frequency as number;
    };
    apply(params);
    return {
      input: hp,
      output: hp,
      update: apply,
      dispose: () => {
        try {
          hp.disconnect();
        } catch {
          /* noop */
        }
      },
    };
  },
};
