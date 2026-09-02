import type { ParamValues, RackModuleDef, RackNode } from '../types';

const SHAPES = ['tube', 'tape', 'hardclip', 'fuzz'] as const;
type Shape = (typeof SHAPES)[number];

function makeCurve(shape: Shape, samples = 2048): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    let y: number;
    switch (shape) {
      case 'tape':
        y = x / (1 + Math.abs(x));
        break;
      case 'hardclip':
        y = Math.max(-0.8, Math.min(0.8, x)) / 0.8;
        break;
      case 'fuzz':
        y = Math.sign(x) * (1 - Math.exp(-Math.abs(x * 3)));
        break;
      case 'tube':
      default:
        y = Math.tanh(x * 1.6) / Math.tanh(1.6);
        break;
    }
    curve[i] = y;
  }
  return curve;
}

export const saturatorModule: RackModuleDef = {
  type: 'fx.saturator',
  kind: 'insert',
  label: 'Saturator',
  family: 'Drive',
  params: [
    { key: 'shape', label: 'Shape', type: 'enum', options: SHAPES, default: 'tube' },
    { key: 'drive', label: 'Drive', type: 'float', min: 1, max: 20, step: 0.1, default: 2 },
    { key: 'output', label: 'Output', type: 'float', min: -24, max: 12, step: 0.5, unit: 'dB', default: 0 },
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
    const post = ctx.createGain();

    input.connect(dry).connect(output);
    input.connect(pre);
    pre.connect(shaper).connect(post).connect(wet).connect(output);

    let currentShape: Shape | null = null;
    const apply = (p: ParamValues) => {
      const shape = p.shape as Shape;
      if (shape !== currentShape) {
        currentShape = shape;
        shaper.curve = makeCurve(shape);
      }
      pre.gain.value = p.drive as number;
      post.gain.value = Math.pow(10, (p.output as number) / 20);
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
        for (const n of [input, output, dry, wet, pre, shaper, post]) {
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
