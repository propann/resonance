import type { ParamValues, RackModuleDef, RackNode } from '../types';

export const chorusModule: RackModuleDef = {
  type: 'fx.chorus',
  kind: 'insert',
  label: 'Chorus',
  family: 'Modulation',
  params: [
    { key: 'rate', label: 'Rate', type: 'float', min: 0.05, max: 8, step: 0.05, unit: 'Hz', default: 0.8 },
    { key: 'depth', label: 'Depth', type: 'float', min: 0, max: 0.02, step: 0.0005, unit: 's', default: 0.003 },
    { key: 'base', label: 'Delay', type: 'float', min: 0.001, max: 0.05, step: 0.001, unit: 's', default: 0.02 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 0.4 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const delay = ctx.createDelay(0.1);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    const lfoGain = ctx.createGain();

    input.connect(dry).connect(output);
    input.connect(delay).connect(wet).connect(output);
    lfo.connect(lfoGain).connect(delay.delayTime);
    lfo.start();

    const apply = (p: ParamValues) => {
      lfo.frequency.value = p.rate as number;
      lfoGain.gain.value = p.depth as number;
      delay.delayTime.value = p.base as number;
      const mix = p.mix as number;
      wet.gain.value = mix;
      dry.gain.value = 1 - mix;
    };
    apply(params);

    return {
      input,
      output,
      update: apply,
      dispose: () => {
        try {
          lfo.stop();
        } catch {
          /* noop */
        }
        for (const n of [input, output, dry, wet, delay, lfo, lfoGain]) {
          try {
            n.disconnect();
          } catch {
            /* noop */
          }
        }
      },
    };
  },
};
