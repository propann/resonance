import type { ParamValues, RackModuleDef, RackNode } from '../types';

/** Semitones → frequency, A4 = 440 Hz. */
const noteHz = (semitones: number): number => 440 * Math.pow(2, semitones / 12);

/**
 * Two detuned oscillators — the workhorse source. It has no input: the rack
 * sums it with the sample and the other sources, so it layers instead of
 * replacing.
 */
export const oscillatorModule: RackModuleDef = {
  type: 'gen.osc',
  kind: 'source',
  label: 'Oscillateur',
  family: 'Moteurs',
  params: [
    {
      key: 'wave',
      label: 'Forme',
      type: 'enum',
      options: ['sawtooth', 'square', 'triangle', 'sine'],
      default: 'sawtooth',
    },
    { key: 'note', label: 'Note', type: 'int', min: -36, max: 24, step: 1, unit: 'demi-tons', default: -12 },
    { key: 'detune', label: 'Détune', type: 'float', min: 0, max: 50, step: 0.5, unit: 'cents', default: 12 },
    { key: 'level', label: 'Niveau', type: 'float', min: 0, max: 1, step: 0.01, default: 0.35 },
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const output = ctx.createGain();
    const a = ctx.createOscillator();
    const b = ctx.createOscillator();
    a.connect(output);
    b.connect(output);

    const apply = (p: ParamValues) => {
      const wave = p.wave as OscillatorType;
      a.type = wave;
      b.type = wave;
      const hz = noteHz(p.note as number);
      a.frequency.value = hz;
      b.frequency.value = hz;
      a.detune.value = -(p.detune as number);
      b.detune.value = p.detune as number;
      // Two voices sum, so halve the level to keep the module unity-ish.
      output.gain.value = (p.level as number) * 0.5;
    };
    apply(params);
    a.start();
    b.start();

    return {
      input: null,
      output,
      update: apply,
      dispose: () => {
        for (const osc of [a, b]) {
          try {
            osc.stop();
            osc.disconnect();
          } catch {
            /* already stopped */
          }
        }
        try {
          output.disconnect();
        } catch {
          /* noop */
        }
      },
    };
  },
};
