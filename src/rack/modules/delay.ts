import type { ParamValues, RackModuleDef, RackNode } from '../types';

export const delayModule: RackModuleDef = {
  type: 'fx.delay',
  kind: 'insert',
  label: 'Delay',
  family: 'Space',
  params: [
    { key: 'time', label: 'Time', type: 'float', min: 0.001, max: 2, step: 0.001, unit: 's', default: 0.3 },
    { key: 'feedback', label: 'Feedback', type: 'float', min: 0, max: 0.95, step: 0.01, default: 0.35 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 0.3 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const delay = ctx.createDelay(2);
    const feedback = ctx.createGain();

    input.connect(dry).connect(output);
    input.connect(delay);
    delay.connect(wet).connect(output);
    delay.connect(feedback).connect(delay);

    const apply = (p: ParamValues) => {
      delay.delayTime.value = p.time as number;
      feedback.gain.value = p.feedback as number;
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
        for (const n of [input, output, dry, wet, delay, feedback]) {
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
