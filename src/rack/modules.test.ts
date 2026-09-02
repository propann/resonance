import { describe, expect, it } from 'vitest';
import { registerBuiltinModules } from './modules';
import { getModuleDef, listModuleDefs } from './registry';
import { coerceParams, defaultParams } from './params';
import { RACK_TEMPLATES } from './templates';

registerBuiltinModules();

describe('built-in rack modules', () => {
  const defs = listModuleDefs();

  it('registers the expected set', () => {
    const types = defs.map((d) => d.type).sort();
    expect(types).toEqual(
      [
        'fx.bitcrusher',
        'fx.chorus',
        'fx.comb',
        'fx.compressor',
        'fx.delay',
        'fx.filter',
        'fx.gain',
        'fx.reverb',
        'fx.saturator',
      ].sort()
    );
  });

  it('every module has well-formed param specs', () => {
    for (const def of defs) {
      expect(def.params.length).toBeGreaterThan(0);
      const keys = def.params.map((p) => p.key);
      expect(new Set(keys).size).toBe(keys.length); // unique
      for (const spec of def.params) {
        if (spec.type === 'enum') {
          expect(spec.options && spec.options.length).toBeGreaterThan(0);
          expect(spec.options).toContain(spec.default);
        }
        if (spec.type === 'float' || spec.type === 'int') {
          expect(typeof spec.default).toBe('number');
        }
      }
    }
  });

  it('defaultParams round-trips through coerceParams unchanged', () => {
    for (const def of defs) {
      const d = defaultParams(def);
      expect(coerceParams(def, d)).toEqual(d);
    }
  });
});

describe('rack templates', () => {
  it('only reference registered modules with valid param keys', () => {
    for (const tpl of RACK_TEMPLATES) {
      expect(tpl.modules.length).toBeGreaterThan(0);
      for (const m of tpl.modules) {
        const def = getModuleDef(m.type);
        expect(def, `${tpl.id} -> ${m.type}`).toBeTruthy();
        const validKeys = new Set(def!.params.map((p) => p.key));
        for (const key of Object.keys(m.params ?? {})) {
          expect(validKeys.has(key), `${tpl.id}/${m.type}.${key}`).toBe(true);
        }
      }
    }
  });
});
