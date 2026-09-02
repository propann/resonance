import type { ParamValues, RackModuleDef, RackNode } from '../types';

export const ringModModule: RackModuleDef = {
  type: 'fx.ringmod',
  kind: 'insert',
  label: 'Ring Mod',
  family: 'Modulation',
  params: [
    { key: 'frequency', label: 'Freq', type: 'float', min: 1, max: 4000, step: 1, unit: 'Hz', default: 200 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const ring = ctx.createGain();
    ring.gain.value = 0; // multiplied entirely by the carrier
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';

    input.connect(dry).connect(output);
    input.connect(ring).connect(wet).connect(output);
    carrier.connect(ring.gain);
    carrier.start();

    const apply = (p: ParamValues) => {
      carrier.frequency.value = p.frequency as number;
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
          carrier.stop();
        } catch {
          /* noop */
        }
        for (const n of [input, output, dry, wet, ring, carrier]) {
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
