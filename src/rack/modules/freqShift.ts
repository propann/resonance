import { ensureWorklet } from '../Rack';
import type { ParamValues, RackModuleDef, RackNode } from '../types';

const WORKLET_URL = '/worklets/freqshift.worklet.js';

export const freqShiftModule: RackModuleDef = {
  type: 'fx.freqshift',
  kind: 'insert',
  label: 'Freq Shifter',
  family: 'Pitch',
  params: [
    { key: 'shift', label: 'Shift', type: 'float', min: -2000, max: 2000, step: 1, unit: 'Hz', default: 0 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
  async createNode(ctx: BaseAudioContext, params: ParamValues): Promise<RackNode> {
    await ensureWorklet(ctx, WORKLET_URL);
    const node = new AudioWorkletNode(ctx, 'freqshift-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const apply = (p: ParamValues) => {
      node.parameters.get('shift')!.value = p.shift as number;
      node.parameters.get('mix')!.value = p.mix as number;
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
