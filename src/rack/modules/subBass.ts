import { ensureWorklet } from '../Rack';
import type { ParamValues, RackModuleDef, RackNode } from '../types';

const WORKLET_URL = '/worklets/subbass.worklet.js';

export const subBassModule: RackModuleDef = {
  type: 'fx.subbass',
  kind: 'insert',
  label: 'Sub / 808',
  family: 'Drive',
  params: [
    { key: 'frequency', label: 'Freq', type: 'float', min: 30, max: 120, step: 1, unit: 'Hz', default: 55 },
    { key: 'boost', label: 'Boost', type: 'float', min: 0, max: 18, step: 0.5, unit: 'dB', default: 6 },
    { key: 'sub', label: 'Sub', type: 'float', min: 0, max: 1, step: 0.01, default: 0.4 },
    { key: 'drive', label: 'Drive', type: 'float', min: 0, max: 1, step: 0.01, default: 0.3 },
  ],
  async createNode(ctx: BaseAudioContext, params: ParamValues): Promise<RackNode> {
    await ensureWorklet(ctx, WORKLET_URL);
    const node = new AudioWorkletNode(ctx, 'subbass-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const apply = (p: ParamValues) => {
      node.parameters.get('frequency')!.value = p.frequency as number;
      node.parameters.get('boost')!.value = p.boost as number;
      node.parameters.get('sub')!.value = p.sub as number;
      node.parameters.get('drive')!.value = p.drive as number;
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
