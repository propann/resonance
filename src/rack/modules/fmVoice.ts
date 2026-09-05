import type { ParamValues, RackModuleDef, RackNode } from '../types';
import { createAmpEnvelope, ENVELOPE_PARAMS } from '../envelope';

const noteHz = (semitones: number): number => 440 * Math.pow(2, semitones / 12);

/**
 * Two-operator FM: one oscillator modulates another's frequency. Ratio and
 * index between them are what turn a plain tone into a bell, a bass or a
 * metallic texture — the cheapest way to get sounds a sample library does not
 * already contain.
 */
export const fmVoiceModule: RackModuleDef = {
  type: 'gen.fm',
  kind: 'source',
  label: 'FM 2-op',
  family: 'Moteurs',
  params: [
    { key: 'note', label: 'Note', type: 'int', min: -36, max: 24, step: 1, unit: 'demi-tons', default: -12 },
    { key: 'ratio', label: 'Ratio', type: 'float', min: 0.25, max: 12, step: 0.25, default: 2 },
    { key: 'index', label: 'Index', type: 'float', min: 0, max: 2000, step: 10, unit: 'Hz', default: 320 },
    { key: 'level', label: 'Niveau', type: 'float', min: 0, max: 1, step: 0.01, default: 0.3 },
    ...ENVELOPE_PARAMS,
  ],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const level = ctx.createGain();
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modDepth = ctx.createGain();

    carrier.type = 'sine';
    modulator.type = 'sine';
    modulator.connect(modDepth).connect(carrier.frequency);
    carrier.connect(level);
    const envelope = createAmpEnvelope(ctx, params);
    level.connect(envelope.node);
    const output = envelope.node;

    // Kept so a note can retune the modulator against the current ratio.
    let current: ParamValues = params;
    const apply = (p: ParamValues) => {
      current = p;
      const hz = noteHz(p.note as number);
      carrier.frequency.value = hz;
      modulator.frequency.value = hz * (p.ratio as number);
      modDepth.gain.value = p.index as number;
      level.gain.value = p.level as number;
      envelope.update(p);
    };
    apply(params);
    carrier.start();
    modulator.start();

    return {
      input: null,
      output,
      update: apply,
      noteOn: (note, velocity) => {
        const hz = noteHz(note - 60);
        carrier.frequency.setValueAtTime(hz, ctx.currentTime);
        modulator.frequency.setValueAtTime(hz * ((current.ratio as number) || 2), ctx.currentTime);
        envelope.noteOn(velocity / 127);
      },
      noteOff: () => envelope.noteOff(),
      dispose: () => {
        for (const osc of [carrier, modulator]) {
          try {
            osc.stop();
            osc.disconnect();
          } catch {
            /* already stopped */
          }
        }
        try {
          modDepth.disconnect();
          output.disconnect();
        } catch {
          /* noop */
        }
      },
    };
  },
};
