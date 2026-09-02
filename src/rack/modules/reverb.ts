import type { ParamValues, RackModuleDef, RackNode } from '../types';

/** Synthetic decaying-noise impulse response. */
function buildImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(seconds * rate));
  const ir = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5);
    }
  }
  return ir;
}

export const reverbModule: RackModuleDef = {
  type: 'fx.reverb',
  kind: 'insert',
  label: 'Reverb',
  family: 'Space',
  params: [
    { key: 'size', label: 'Size', type: 'float', min: 0.1, max: 5, step: 0.1, unit: 's', default: 1.8 },
    { key: 'preDelay', label: 'Pre-delay', type: 'float', min: 0, max: 0.2, step: 0.005, unit: 's', default: 0.01 },
    { key: 'damp', label: 'Damp', type: 'float', min: 0, max: 1, step: 0.01, default: 0.4 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 0.3 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const preDelay = ctx.createDelay(0.5);
    const convolver = ctx.createConvolver();
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';

    input.connect(dry).connect(output);
    input.connect(preDelay).connect(convolver).connect(damp).connect(wet).connect(output);

    let currentSize = -1;
    const apply = (p: ParamValues) => {
      const size = p.size as number;
      if (size !== currentSize) {
        currentSize = size;
        convolver.buffer = buildImpulse(ctx, size);
      }
      preDelay.delayTime.value = p.preDelay as number;
      damp.frequency.value = 20000 * (1 - (p.damp as number) * 0.92) + 400;
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
        for (const n of [input, output, dry, wet, preDelay, convolver, damp]) {
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
