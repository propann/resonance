import { describe, expect, it } from 'vitest';
import { Rack } from './Rack';
import { registerBuiltinModules } from './modules';
import { gainModule } from './modules/gain';
import { filterModule } from './modules/filter';
import type { ParamValues, RackNode, RackState } from './types';

registerBuiltinModules();

/**
 * Minimal fake BaseAudioContext for the modules exercised here (gain, filter).
 * AudioParams are plain `{ value }` objects — enough to prove that a slider
 * change reaches `node.<param>.value`.
 */
function fakeAudioParam(value = 0) {
  return {
    value,
    setValueAtTime(v: number) {
      this.value = v;
    },
    setTargetAtTime(v: number) {
      this.value = v;
    },
    linearRampToValueAtTime(v: number) {
      this.value = v;
    },
    cancelScheduledValues() {},
  };
}

function fakeGainNode() {
  return { gain: fakeAudioParam(1), connect() {}, disconnect() {} };
}

function fakeBiquad() {
  return {
    type: 'lowpass',
    frequency: fakeAudioParam(350),
    Q: fakeAudioParam(1),
    gain: fakeAudioParam(0),
    detune: fakeAudioParam(0),
    connect() {},
    disconnect() {},
  };
}

const fakeCtx = {
  sampleRate: 44100,
  currentTime: 0,
  createGain: fakeGainNode,
  createBiquadFilter: fakeBiquad,
} as unknown as BaseAudioContext;

const build = async (
  def: { createNode: (c: BaseAudioContext, p: ParamValues) => RackNode | Promise<RackNode> },
  params: ParamValues
): Promise<RackNode> => await Promise.resolve(def.createNode(fakeCtx, params));

describe('module.update() moves the audio param', () => {
  it('fx.gain: update({gain}) rewrites node.gain.value (dB → linear)', async () => {
    const node = await build(gainModule, { gain: 0 });
    const g = (node.output as unknown as { gain: { value: number } }).gain;
    expect(g.value).toBeCloseTo(1, 5); // 0 dB
    node.update({ gain: 12 });
    expect(g.value).toBeCloseTo(3.981, 3); // +12 dB
    node.update({ gain: -60 });
    expect(g.value).toBeCloseTo(0.001, 4);
  });

  it('fx.filter: update() rewrites type / frequency / Q / gain', async () => {
    const node = await build(filterModule, {
      type: 'lowpass',
      frequency: 1200,
      q: 0.7,
      gain: 0,
    });
    const b = node.output as unknown as {
      type: string;
      frequency: { value: number };
      Q: { value: number };
      gain: { value: number };
    };
    expect(b.frequency.value).toBe(1200);
    node.update({ type: 'highpass', frequency: 8000, q: 4, gain: -6 });
    expect(b.type).toBe('highpass');
    expect(b.frequency.value).toBe(8000);
    expect(b.Q.value).toBe(4);
    expect(b.gain.value).toBe(-6);
  });
});

describe('Rack.updateModuleParams reaches the live node', () => {
  const state = (params: ParamValues): RackState => ({
    version: 1,
    modules: [{ id: 'g1', type: 'fx.gain', enabled: true, params }],
  });

  /** A ctx whose gain nodes are recorded so the test can inspect them. */
  function trackingCtx() {
    const gains: Array<{ gain: { value: number } }> = [];
    const ctx = {
      sampleRate: 44100,
      currentTime: 0,
      createGain: () => {
        const n = fakeGainNode();
        gains.push(n);
        return n;
      },
      createBiquadFilter: fakeBiquad,
    } as unknown as BaseAudioContext;
    return { ctx, gains };
  }

  it('a slider change (partial param) patches the live gain node in place', async () => {
    const { ctx, gains } = trackingCtx();
    const rack = new Rack(ctx); // ctx.createGain() x2 → rack.input, rack.output
    await rack.setState(state({ gain: 0 })); // + 1 more for the fx.gain module
    const moduleNode = gains[2]; // input, output, then the module
    expect(moduleNode.gain.value).toBeCloseTo(1, 5); // 0 dB

    rack.updateModuleParams('g1', { gain: 6 }); // simulate a slider drag
    expect(moduleNode.gain.value).toBeCloseTo(1.995, 3); // +6 dB reached the node

    rack.updateModuleParams('g1', { gain: -24 });
    expect(moduleNode.gain.value).toBeCloseTo(0.063, 3);
    rack.dispose();
  });

  it('updateModuleParams on an unknown id is a no-op, not a throw', async () => {
    const rack = new Rack(fakeCtx);
    await rack.setState(state({ gain: 0 }));
    expect(() => rack.updateModuleParams('does-not-exist', { gain: 3 })).not.toThrow();
    rack.dispose();
  });
});
