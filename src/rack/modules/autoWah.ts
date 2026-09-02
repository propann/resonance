import { ensureWorklet, workletUrl } from '../Rack';
import type { ParamValues, RackModuleDef, RackNode } from '../types';

const WORKLET_URL = workletUrl('autowah.worklet.js');

export const autoWahModule: RackModuleDef = {
  type: 'fx.autowah',
  kind: 'insert',
  label: 'Auto-Wah',
  family: 'Filter',
  params: [
    { key: 'sensitivity', label: 'Sens', type: 'float', min: 0, max: 1, step: 0.01, default: 0.6 },
    { key: 'base', label: 'Base', type: 'float', min: 200, max: 2000, step: 10, unit: 'Hz', default: 500 },
    { key: 'range', label: 'Range', type: 'float', min: 200, max: 6000, step: 50, unit: 'Hz', default: 3000 },
    { key: 'resonance', label: 'Resonance', type: 'float', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 0.85 },
  ],
  async createNode(ctx: BaseAudioContext, params: ParamValues): Promise<RackNode> {
    await ensureWorklet(ctx, WORKLET_URL);
    const node = new AudioWorkletNode(ctx, 'autowah-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const apply = (p: ParamValues) => {
      node.parameters.get('sensitivity')!.value = p.sensitivity as number;
      node.parameters.get('base')!.value = p.base as number;
      node.parameters.get('range')!.value = p.range as number;
      node.parameters.get('resonance')!.value = p.resonance as number;
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
