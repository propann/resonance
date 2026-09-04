import type { ParamValues, RackModuleDef, RackNode } from '../types';

/** Two seconds of noise, looped: enough not to hear the seam. */
function buildNoise(ctx: BaseAudioContext, colour: 'white' | 'pink'): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  if (colour === 'white') {
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  // Paul Kellett's pink filter: cheap, and close enough for sound design.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.25;
  }
  return buffer;
}

/**
 * Noise source with a tone filter — the raw material for wind, breath, hats
 * and risers, layered under a sample or fed into the rack's effects.
 */
export const noiseSourceModule: RackModuleDef = {
  type: 'gen.noise',
  kind: 'source',
  label: 'Bruit',
  family: 'Moteurs',
  params: [
    { key: 'colour', label: 'Couleur', type: 'enum', options: ['white', 'pink'], default: 'pink' },
    { key: 'tone', label: 'Tonalité', type: 'float', min: 100, max: 18000, step: 50, unit: 'Hz', default: 6000 },
    { key: 'resonance', label: 'Résonance', type: 'float', min: 0.1, max: 12, step: 0.1, default: 1 },
    { key: 'level', label: 'Niveau', type: 'float', min: 0, max: 1, step: 0.01, default: 0.25 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const output = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    const source = ctx.createBufferSource();
    source.loop = true;
    source.connect(tone).connect(output);

    let colour = '';
    const apply = (p: ParamValues) => {
      const wanted = p.colour as 'white' | 'pink';
      if (wanted !== colour) {
        colour = wanted;
        source.buffer = buildNoise(ctx, wanted);
      }
      tone.frequency.value = p.tone as number;
      tone.Q.value = p.resonance as number;
      output.gain.value = p.level as number;
    };
    apply(params);
    source.start();

    return {
      input: null,
      output,
      update: apply,
      dispose: () => {
        try {
          source.stop();
          source.disconnect();
        } catch {
          /* already stopped */
        }
        try {
          tone.disconnect();
          output.disconnect();
        } catch {
          /* noop */
        }
      },
    };
  },
};
