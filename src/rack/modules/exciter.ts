import type { ParamValues, RackModuleDef, RackNode } from '../types';

function harmonicCurve(samples = 2048): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 2);
  }
  return curve;
}

/** Adds high-frequency harmonic sparkle: HP -> soft clip -> blend back in. */
export const exciterModule: RackModuleDef = {
  type: 'fx.exciter',
  kind: 'insert',
  label: 'Exciter',
  family: 'Lo-Fi',
  params: [
    { key: 'frequency', label: 'Freq', type: 'float', min: 1000, max: 12000, step: 100, unit: 'Hz', default: 7000 },
    { key: 'drive', label: 'Drive', type: 'float', min: 1, max: 10, step: 0.1, default: 3 },
    { key: 'amount', label: 'Amount', type: 'float', min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    const pre = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.oversample = '2x';
    shaper.curve = harmonicCurve();
    const post = ctx.createGain();

    input.connect(output);
    input.connect(hp).connect(pre).connect(shaper).connect(post).connect(output);

    const apply = (p: ParamValues) => {
      hp.frequency.value = p.frequency as number;
      pre.gain.value = p.drive as number;
      post.gain.value = p.amount as number;
    };
    apply(params);

    return {
      input,
      output,
      update: apply,
      dispose: () => {
        for (const n of [input, output, hp, pre, shaper, post]) {
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
