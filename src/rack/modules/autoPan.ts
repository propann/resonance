import type { ParamValues, RackModuleDef, RackNode } from '../types';

export const autoPanModule: RackModuleDef = {
  type: 'fx.autopan',
  kind: 'insert',
  label: 'Auto-Pan',
  family: 'Stereo',
  params: [
    { key: 'rate', label: 'Rate', type: 'float', min: 0.05, max: 10, step: 0.05, unit: 'Hz', default: 1 },
    { key: 'depth', label: 'Depth', type: 'float', min: 0, max: 1, step: 0.01, default: 0.7 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const panner = ctx.createStereoPanner();
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    const lfoGain = ctx.createGain();

    lfo.connect(lfoGain).connect(panner.pan);
    lfo.start();

    const apply = (p: ParamValues) => {
      lfo.frequency.value = p.rate as number;
      lfoGain.gain.value = p.depth as number;
    };
    apply(params);

    return {
      input: panner,
      output: panner,
      update: apply,
      dispose: () => {
        try {
          lfo.stop();
        } catch {
          /* noop */
        }
        for (const n of [panner, lfo, lfoGain]) {
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
