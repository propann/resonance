import type { ParamSpec, ParamValue, ParamValues, RackModuleDef } from './types';

/** All params at their declared defaults. */
export function defaultParams(def: RackModuleDef): ParamValues {
  const out: ParamValues = {};
  for (const spec of def.params) out[spec.key] = spec.default;
  return out;
}

function coerceOne(spec: ParamSpec, raw: ParamValue | undefined): ParamValue {
  if (raw === undefined) return spec.default;
  switch (spec.type) {
    case 'bool':
      return Boolean(raw);
    case 'enum': {
      const value = String(raw);
      return spec.options?.includes(value) ? value : (spec.default as string);
    }
    case 'int':
    case 'float': {
      let n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) n = spec.default as number;
      if (spec.min !== undefined) n = Math.max(spec.min, n);
      if (spec.max !== undefined) n = Math.min(spec.max, n);
      if (spec.type === 'int') n = Math.round(n);
      return n;
    }
    default:
      return spec.default;
  }
}

/**
 * Merge partial user values onto the module defaults, clamping numbers to
 * range, rounding ints and validating enums. Unknown keys are dropped.
 */
export function coerceParams(def: RackModuleDef, raw: ParamValues = {}): ParamValues {
  const out: ParamValues = {};
  for (const spec of def.params) out[spec.key] = coerceOne(spec, raw[spec.key]);
  return out;
}
