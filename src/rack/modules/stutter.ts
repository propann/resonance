import { ensureWorklet, workletUrl } from '../Rack';
import type { ParamValues, RackModuleDef, RackNode } from '../types';

const WORKLET_URL = workletUrl('stutter.worklet.js');

export const stutterModule: RackModuleDef = {
  type: 'fx.stutter',
  kind: 'insert',
  label: 'Stutter',
  family: 'Space',
  params: [
    { key: 'rate', label: 'Rate', type: 'float', min: 1, max: 20, step: 0.5, unit: 'Hz', default: 8 },
    { key: 'repeat', label: 'Repeat', type: 'int', min: 1, max: 8, step: 1, default: 2 },
    { key: 'duty', label: 'Duty', type: 'float', min: 0, max: 1, step: 0.01, default: 1 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 0.8 },
  ],
  async createNode(ctx: BaseAudioContext, params: ParamValues): Promise<RackNode> {
    await ensureWorklet(ctx, WORKLET_URL);
    const node = new AudioWorkletNode(ctx, 'stutter-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const apply = (p: ParamValues) => {
      node.parameters.get('rate')!.value = p.rate as number;
      node.parameters.get('repeat')!.value = p.repeat as number;
      node.parameters.get('duty')!.value = p.duty as number;
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
