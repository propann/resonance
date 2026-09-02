import { ensureWorklet } from '../Rack';
import type { ParamValues, RackModuleDef, RackNode } from '../types';

const WORKLET_URL = '/worklets/bitcrusher.worklet.js';

export const bitcrusherModule: RackModuleDef = {
  type: 'fx.bitcrusher',
  kind: 'insert',
  label: 'Bitcrusher',
  family: 'Drive',
  params: [
    { key: 'bits', label: 'Bits', type: 'int', min: 1, max: 16, step: 1, default: 8 },
    { key: 'reduction', label: 'SR Reduce', type: 'int', min: 1, max: 50, step: 1, default: 4 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 0.6 },
  ],
  async createNode(ctx: BaseAudioContext, params: ParamValues): Promise<RackNode> {
    await ensureWorklet(ctx, WORKLET_URL);
    const node = new AudioWorkletNode(ctx, 'bitcrusher-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });

    const apply = (p: ParamValues) => {
      node.parameters.get('bits')!.value = p.bits as number;
      node.parameters.get('reduction')!.value = p.reduction as number;
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
