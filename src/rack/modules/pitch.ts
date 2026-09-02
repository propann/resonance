import { ensureWorklet, workletUrl } from '../Rack';
import type { ParamValues, RackModuleDef, RackNode } from '../types';

const WORKLET_URL = workletUrl('pitch.worklet.js');

export const pitchModule: RackModuleDef = {
  type: 'fx.pitch',
  kind: 'insert',
  label: 'Pitch Shift',
  family: 'Pitch',
  params: [
    { key: 'semitones', label: 'Semitones', type: 'int', min: -12, max: 12, step: 1, default: 0 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 1 },
  ],
  async createNode(ctx: BaseAudioContext, params: ParamValues): Promise<RackNode> {
    await ensureWorklet(ctx, WORKLET_URL);
    const node = new AudioWorkletNode(ctx, 'pitch-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const apply = (p: ParamValues) => {
      node.parameters.get('semitones')!.value = p.semitones as number;
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
