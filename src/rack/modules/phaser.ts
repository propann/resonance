import type { ParamValues, RackModuleDef, RackNode } from '../types';

const STAGES = 4;

export const phaserModule: RackModuleDef = {
  type: 'fx.phaser',
  kind: 'insert',
  label: 'Phaser',
  family: 'Modulation',
  params: [
    { key: 'rate', label: 'Rate', type: 'float', min: 0.05, max: 8, step: 0.05, unit: 'Hz', default: 0.5 },
    { key: 'depth', label: 'Depth', type: 'float', min: 0, max: 3000, step: 10, unit: 'Hz', default: 1200 },
    { key: 'centre', label: 'Centre', type: 'float', min: 200, max: 2000, step: 10, unit: 'Hz', default: 800 },
    { key: 'feedback', label: 'Feedback', type: 'float', min: 0, max: 0.9, step: 0.01, default: 0.3 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const fb = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    const lfoGain = ctx.createGain();

    const stages: BiquadFilterNode[] = [];
    for (let i = 0; i < STAGES; i++) {
      const ap = ctx.createBiquadFilter();
      ap.type = 'allpass';
      lfoGain.connect(ap.frequency);
      stages.push(ap);
    }

    input.connect(dry).connect(output);
    input.connect(stages[0]);
    for (let i = 0; i < STAGES - 1; i++) stages[i].connect(stages[i + 1]);
    stages[STAGES - 1].connect(wet).connect(output);
    stages[STAGES - 1].connect(fb).connect(stages[0]);
    lfo.connect(lfoGain);
    lfo.start();

    const apply = (p: ParamValues) => {
      lfo.frequency.value = p.rate as number;
      lfoGain.gain.value = p.depth as number;
      for (const ap of stages) ap.frequency.value = p.centre as number;
      fb.gain.value = p.feedback as number;
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
        for (const n of [input, output, dry, wet, fb, lfo, lfoGain, ...stages]) {
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
