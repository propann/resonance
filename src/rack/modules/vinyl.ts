import { ensureWorklet, workletUrl } from '../Rack';
import type { ParamValues, RackModuleDef, RackNode } from '../types';

const WORKLET_URL = workletUrl('vinyl.worklet.js');

export const vinylModule: RackModuleDef = {
  type: 'fx.vinyl',
  kind: 'insert',
  label: 'Vinyl / Tape',
  family: 'Lo-Fi',
  params: [
    { key: 'wow', label: 'Wow', type: 'float', min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: 'flutter', label: 'Flutter', type: 'float', min: 0, max: 1, step: 0.01, default: 0.4 },
    { key: 'crackle', label: 'Crackle', type: 'float', min: 0, max: 1, step: 0.01, default: 0.4 },
    { key: 'age', label: 'Age', type: 'float', min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 0.85 },
  ],
  async createNode(ctx: BaseAudioContext, params: ParamValues): Promise<RackNode> {
    await ensureWorklet(ctx, WORKLET_URL);
    const node = new AudioWorkletNode(ctx, 'vinyl-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const apply = (p: ParamValues) => {
      node.parameters.get('wow')!.value = p.wow as number;
      node.parameters.get('flutter')!.value = p.flutter as number;
      node.parameters.get('crackle')!.value = p.crackle as number;
      node.parameters.get('age')!.value = p.age as number;
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
