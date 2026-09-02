import type { ParamValues, RackModuleDef, RackNode } from '../types';

const VOWELS = ['a', 'e', 'i', 'o', 'u'] as const;
type Vowel = (typeof VOWELS)[number];

// Approximate F1/F2/F3 formant centres (Hz).
const FORMANTS: Record<Vowel, [number, number, number]> = {
  a: [800, 1150, 2900],
  e: [400, 1600, 2700],
  i: [350, 1700, 2700],
  o: [450, 800, 2830],
  u: [325, 700, 2530],
};

export const formantModule: RackModuleDef = {
  type: 'fx.formant',
  kind: 'insert',
  label: 'Formant',
  family: 'Filter',
  params: [
    { key: 'vowel', label: 'Vowel', type: 'enum', options: VOWELS, default: 'a' },
    { key: 'shift', label: 'Shift', type: 'float', min: 0.5, max: 2, step: 0.01, default: 1 },
    { key: 'resonance', label: 'Resonance', type: 'float', min: 1, max: 24, step: 0.5, default: 10 },
    { key: 'mix', label: 'Mix', type: 'float', min: 0, max: 1, step: 0.01, default: 0.6 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const sum = ctx.createGain();
    sum.gain.value = 0.5;

    const bands = [0, 1, 2].map(() => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      input.connect(bp).connect(sum);
      return bp;
    });

    input.connect(dry).connect(output);
    sum.connect(wet).connect(output);

    const apply = (p: ParamValues) => {
      const table = FORMANTS[p.vowel as Vowel] ?? FORMANTS.a;
      const shift = p.shift as number;
      bands.forEach((bp, k) => {
        bp.frequency.value = Math.max(20, Math.min(12000, table[k] * shift));
        bp.Q.value = p.resonance as number;
      });
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
        for (const n of [input, output, dry, wet, sum, ...bands]) {
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
