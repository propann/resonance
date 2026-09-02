import type { ParamValues, RackModuleDef, RackNode } from '../types';

function driveCurve(samples = 2048): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 2);
  }
  return curve;
}

/** Resonant lowpass with drive and an optional cutoff LFO — 303-flavoured. */
export const acidModule: RackModuleDef = {
  type: 'fx.acid',
  kind: 'insert',
  label: 'Acid Filter',
  family: 'Filter',
  params: [
    { key: 'cutoff', label: 'Cutoff', type: 'float', min: 100, max: 4000, step: 10, unit: 'Hz', default: 800 },
    { key: 'resonance', label: 'Resonance', type: 'float', min: 1, max: 30, step: 0.5, default: 16 },
    { key: 'drive', label: 'Drive', type: 'float', min: 1, max: 12, step: 0.1, default: 2.5 },
    { key: 'lfoRate', label: 'LFO Rate', type: 'float', min: 0, max: 12, step: 0.1, unit: 'Hz', default: 0 },
    { key: 'lfoDepth', label: 'LFO Depth', type: 'float', min: 0, max: 2500, step: 10, unit: 'Hz', default: 0 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 1 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const pre = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.oversample = '4x';
    shaper.curve = driveCurve();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    const post = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    const lfoGain = ctx.createGain();

    input.connect(dry).connect(output);
    input.connect(pre).connect(shaper).connect(lp).connect(post).connect(wet).connect(output);
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();

    const apply = (p: ParamValues) => {
      pre.gain.value = p.drive as number;
      post.gain.value = Math.min(1, 1.6 / (p.drive as number));
      lp.frequency.value = p.cutoff as number;
      lp.Q.value = p.resonance as number;
      lfo.frequency.value = p.lfoRate as number;
      lfoGain.gain.value = p.lfoDepth as number;
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
        for (const n of [input, output, dry, wet, pre, shaper, lp, post, lfo, lfoGain]) {
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
