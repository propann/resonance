import type { RackModuleDef } from './types';

const registry = new Map<string, RackModuleDef>();

export function registerModule(def: RackModuleDef): void {
  if (registry.has(def.type)) {
    console.warn(`[rack] module "${def.type}" registered twice — keeping the first.`);
    return;
  }
  registry.set(def.type, def);
}

export function getModuleDef(type: string): RackModuleDef | undefined {
  return registry.get(type);
}

export function requireModuleDef(type: string): RackModuleDef {
  const def = registry.get(type);
  if (!def) throw new Error(`[rack] unknown module type "${type}"`);
  return def;
}

export function listModuleDefs(): RackModuleDef[] {
  return [...registry.values()];
}

/** Test helper — not used by the app. */
export function _clearRegistry(): void {
  registry.clear();
}
