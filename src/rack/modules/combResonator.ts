import type { ParamValues, RackModuleDef, RackNode } from '../types';

export const combResonatorModule: RackModuleDef = {
  type: 'fx.comb',
  kind: 'insert',
  label: 'Comb Resonator',
  family: 'Filter',
  params: [
    { key: 'frequency', label: 'Freq', type: 'float', min: 20, max: 2000, step: 1, unit: 'Hz', default: 220 },
    { key: 'resonance', label: 'Resonance', type: 'float', min: 0, max: 0.98, step: 0.01, default: 0.8 },
    { key: 'tone', label: 'Tone', type: 'float', min: 200, max: 12000, step: 50, unit: 'Hz', default: 6000 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const delay = ctx.createDelay(0.1);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    const fb = ctx.createGain();

    input.connect(dry).connect(output);
    input.connect(delay).connect(wet).connect(output);
    delay.connect(tone).connect(fb).connect(delay);

    const minDelay = 1 / ctx.sampleRate;
    const apply = (p: ParamValues) => {
      delay.delayTime.value = Math.max(minDelay, 1 / (p.frequency as number));
      fb.gain.value = p.resonance as number;
      tone.frequency.value = p.tone as number;
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
        for (const n of [input, output, dry, wet, delay, tone, fb]) {
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
