import { beforeEach, describe, expect, it } from 'vitest';
import { _clearRegistry, getModuleDef, listModuleDefs, registerModule, requireModuleDef } from './registry';
import { coerceParams, defaultParams } from './params';
import type { RackModuleDef } from './types';

const fakeModule: RackModuleDef = {
  type: 'test.fake',
  kind: 'insert',
  label: 'Fake',
  family: 'Test',
  params: [
    { key: 'gain', label: 'Gain', type: 'float', min: 0, max: 2, default: 1 },
    { key: 'taps', label: 'Taps', type: 'int', min: 1, max: 8, default: 3 },
    { key: 'shape', label: 'Shape', type: 'enum', options: ['a', 'b', 'c'], default: 'a' },
    { key: 'on', label: 'On', type: 'bool', default: true },
  ],
  createNode: () => {
    throw new Error('not used in these tests');
  },
};

describe('rack registry', () => {
  beforeEach(() => _clearRegistry());

  it('registers and retrieves a module', () => {
    registerModule(fakeModule);
    expect(getModuleDef('test.fake')).toBe(fakeModule);
    expect(listModuleDefs()).toHaveLength(1);
  });

  it('ignores a duplicate registration', () => {
    registerModule(fakeModule);
    registerModule({ ...fakeModule, label: 'Other' });
    expect(getModuleDef('test.fake')?.label).toBe('Fake');
  });

  it('requireModuleDef throws on unknown type', () => {
    expect(() => requireModuleDef('nope')).toThrow(/unknown module/);
  });
});

describe('param coercion', () => {
  it('defaultParams returns every declared default', () => {
    expect(defaultParams(fakeModule)).toEqual({ gain: 1, taps: 3, shape: 'a', on: true });
  });

  it('clamps floats, rounds ints, falls back for bad enums, drops unknown keys', () => {
    const out = coerceParams(fakeModule, {
      gain: 99,
      taps: 4.8,
      shape: 'z',
      on: 0 as unknown as boolean,
      bogus: 5,
    });
    expect(out).toEqual({ gain: 2, taps: 5, shape: 'a', on: false });
    expect('bogus' in out).toBe(false);
  });

  it('keeps in-range values and fills missing ones from defaults', () => {
    expect(coerceParams(fakeModule, { gain: 0.5 })).toEqual({
      gain: 0.5,
      taps: 3,
      shape: 'a',
      on: true,
    });
  });
});
