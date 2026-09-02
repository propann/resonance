import { ensureWorklet } from '../Rack';
import type { ParamValues, RackModuleDef, RackNode } from '../types';

const WORKLET_URL = '/worklets/transient.worklet.js';

export const transientModule: RackModuleDef = {
  type: 'fx.transient',
  kind: 'insert',
  label: 'Transient',
  family: 'Dynamics',
  params: [
    { key: 'attack', label: 'Attack', type: 'float', min: -20, max: 20, step: 0.5, unit: 'dB', default: 0 },
    { key: 'sustain', label: 'Sustain', type: 'float', min: -20, max: 20, step: 0.5, unit: 'dB', default: 0 },
    { key: 'speed', label: 'Speed', type: 'float', min: 1, max: 200, step: 1, unit: 'ms', default: 30 },
  ],
  async createNode(ctx: BaseAudioContext, params: ParamValues): Promise<RackNode> {
    await ensureWorklet(ctx, WORKLET_URL);
    const node = new AudioWorkletNode(ctx, 'transient-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const apply = (p: ParamValues) => {
      node.parameters.get('attack')!.value = p.attack as number;
      node.parameters.get('sustain')!.value = p.sustain as number;
      node.parameters.get('speed')!.value = p.speed as number;
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
