import { beforeEach, describe, expect, it } from 'vitest';
import { useRackStore } from './rackStore';

const reset = () => useRackStore.getState().reset();

describe('rackStore', () => {
  beforeEach(reset);

  it('adds built-in modules with default params', () => {
    useRackStore.getState().addModule('fx.filter');
    const { modules } = useRackStore.getState().rack;
    expect(modules).toHaveLength(1);
    expect(modules[0].type).toBe('fx.filter');
    expect(modules[0].enabled).toBe(true);
    expect(modules[0].params.frequency).toBe(1200);
  });

  it('ignores an unknown module type', () => {
    useRackStore.getState().addModule('fx.nope');
    expect(useRackStore.getState().rack.modules).toHaveLength(0);
  });

  it('toggles, moves, updates params and removes', () => {
    const s = useRackStore.getState();
    s.addModule('fx.filter');
    s.addModule('fx.delay');
    let modules = useRackStore.getState().rack.modules;
    const [filterId, delayId] = modules.map((m) => m.id);

    s.toggleModule(filterId);
    expect(useRackStore.getState().rack.modules[0].enabled).toBe(false);

    s.moveModule(delayId, -1);
    expect(useRackStore.getState().rack.modules[0].id).toBe(delayId);

    s.setParams(filterId, { frequency: 8000 });
    modules = useRackStore.getState().rack.modules;
    expect(modules.find((m) => m.id === filterId)?.params.frequency).toBe(8000);

    s.removeModule(delayId);
    expect(useRackStore.getState().rack.modules).toHaveLength(1);
  });

  it('does not move past the ends', () => {
    const s = useRackStore.getState();
    s.addModule('fx.filter');
    const id = useRackStore.getState().rack.modules[0].id;
    s.moveModule(id, -1);
    expect(useRackStore.getState().rack.modules[0].id).toBe(id);
  });

  it('round-trips through export / import JSON', () => {
    const s = useRackStore.getState();
    s.addModule('fx.bitcrusher');
    s.setParams(useRackStore.getState().rack.modules[0].id, { bits: 4 });
    const json = s.exportJson();

    reset();
    expect(useRackStore.getState().rack.modules).toHaveLength(0);

    expect(useRackStore.getState().importJson(json)).toBe(true);
    const modules = useRackStore.getState().rack.modules;
    expect(modules).toHaveLength(1);
    expect(modules[0].type).toBe('fx.bitcrusher');
    expect(modules[0].params.bits).toBe(4);
  });

  it('rejects malformed import JSON', () => {
    expect(useRackStore.getState().importJson('{"nope":true}')).toBe(false);
    expect(useRackStore.getState().importJson('not json')).toBe(false);
  });

  it('applyTemplate expands module specs with fresh ids and merged params', () => {
    useRackStore.getState().applyTemplate([
      { type: 'fx.filter', params: { frequency: 900 } },
      { type: 'fx.gain' },
      { type: 'fx.unknown' },
    ]);
    const modules = useRackStore.getState().rack.modules;
    expect(modules).toHaveLength(2);
    expect(modules[0].type).toBe('fx.filter');
    expect(modules[0].params.frequency).toBe(900);
    expect(modules[0].params.q).toBe(0.7); // default filled in
    expect(modules[1].type).toBe('fx.gain');
    expect(new Set(modules.map((m) => m.id)).size).toBe(2);
  });
});
