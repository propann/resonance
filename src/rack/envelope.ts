/**
 * The amplitude envelope the rack's sound sources play through.
 *
 * Without one they are oscillators with the power on: adding a source to the
 * chain put a raw tone in your ears and kept it there. An envelope closed at
 * rest turns the same module into something you play — silent until a key is
 * pressed, and gone again when it is released.
 *
 * The schedule is worked out separately from the audio nodes so it can be
 * checked without a context, which matters because envelope bugs are heard as
 * clicks rather than seen.
 */
import type { ParamSpec, ParamValues } from './types';

/** The four controls, shared by every source so they behave alike. */
export const ENVELOPE_PARAMS: readonly ParamSpec[] = [
  { key: 'attack', label: 'Attaque', type: 'float', min: 0.001, max: 2, step: 0.001, unit: 's', default: 0.005 },
  { key: 'decay', label: 'Chute', type: 'float', min: 0.001, max: 4, step: 0.001, unit: 's', default: 0.12 },
  { key: 'sustain', label: 'Tenue', type: 'float', min: 0, max: 1, step: 0.01, default: 0.7 },
  { key: 'release', label: 'Relâche', type: 'float', min: 0.001, max: 6, step: 0.001, unit: 's', default: 0.25 },
];

export interface EnvelopeSettings {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

/** The shortest ramp used anywhere: below this a change is heard as a click. */
export const MIN_RAMP_SEC = 0.001;

/** Read the four controls out of a module's params, whatever else is there. */
export function envelopeFrom(params: ParamValues): EnvelopeSettings {
  const num = (key: string, fallback: number) => {
    const value = params[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  };
  return {
    attack: Math.max(MIN_RAMP_SEC, num('attack', 0.005)),
    decay: Math.max(MIN_RAMP_SEC, num('decay', 0.12)),
    sustain: Math.min(1, Math.max(0, num('sustain', 0.7))),
    release: Math.max(MIN_RAMP_SEC, num('release', 0.25)),
  };
}

/** One point of the ramp: reach `value` at `time`. */
export interface EnvelopePoint {
  time: number;
  value: number;
}

/**
 * The attack-decay-sustain ramp for a note struck at `now`, at `peak`.
 *
 * It starts from zero at the moment of the strike rather than from wherever
 * the envelope happened to be, so a note retriggered while the last one is
 * still fading does not jump.
 */
export function attackPoints(now: number, peak: number, env: EnvelopeSettings): EnvelopePoint[] {
  const safePeak = Math.max(0, peak);
  return [
    { time: now, value: 0 },
    { time: now + env.attack, value: safePeak },
    { time: now + env.attack + env.decay, value: safePeak * env.sustain },
  ];
}

/**
 * The release ramp from wherever the envelope currently sits.
 *
 * Releasing to exactly zero is what stops a source droning after the key is
 * let go — but the ramp still takes `release` seconds, so it is a fade and not
 * a cut.
 */
export function releasePoints(now: number, from: number, env: EnvelopeSettings): EnvelopePoint[] {
  return [
    { time: now, value: Math.max(0, from) },
    { time: now + env.release, value: 0 },
  ];
}

/**
 * How long a note lasts from strike to silence, for an offline bounce that has
 * to decide how much to render.
 */
export const envelopeTailSec = (env: EnvelopeSettings): number =>
  env.attack + env.decay + env.release;

/** A gain node that opens on a note and closes when it ends. */
export interface AmpEnvelope {
  /** Put this between the source and the rest of the chain. */
  readonly node: GainNode;
  noteOn(velocity: number): void;
  noteOff(): void;
  update(params: ParamValues): void;
}

/**
 * Build the envelope. The gain starts at zero: a source added to the chain is
 * silent until it is played, which is the whole point.
 */
export function createAmpEnvelope(ctx: BaseAudioContext, params: ParamValues): AmpEnvelope {
  const node = ctx.createGain();
  node.gain.value = 0;
  let env = envelopeFrom(params);
  /** What the last strike ramped to, so a release starts from the right place. */
  let held = 0;

  return {
    node,
    noteOn(velocity: number) {
      const peak = Math.max(0, Math.min(1, velocity));
      const now = ctx.currentTime;
      node.gain.cancelScheduledValues(now);
      for (const point of attackPoints(now, peak, env)) {
        node.gain.linearRampToValueAtTime(point.value, point.time);
      }
      held = peak * env.sustain;
    },
    noteOff() {
      const now = ctx.currentTime;
      node.gain.cancelScheduledValues(now);
      for (const point of releasePoints(now, held, env)) {
        node.gain.linearRampToValueAtTime(point.value, point.time);
      }
      held = 0;
    },
    update(next: ParamValues) {
      env = envelopeFrom(next);
    },
  };
}
