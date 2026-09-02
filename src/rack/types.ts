/**
 * RackModule kernel — the shared contract every rack unit implements.
 *
 * A module builds an audio node graph in ANY BaseAudioContext, so the exact
 * same module list drives the live monitor path and the offline bounce.
 */

export type ParamType = 'float' | 'int' | 'enum' | 'bool';

export interface ParamSpec {
  key: string;
  label: string;
  type: ParamType;
  /** float / int */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** enum */
  options?: readonly string[];
  default: ParamValue;
}

export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

export type RackModuleKind = 'source' | 'insert' | 'analyser' | 'utility';

/** A live instance of a module inside one AudioContext. */
export interface RackNode {
  /** Where upstream audio enters. `null` for a pure source. */
  readonly input: AudioNode | null;
  /** What connects downstream. */
  readonly output: AudioNode;
  /** Apply new parameter values without rebuilding the graph. */
  update(params: ParamValues): void;
  /** Detach and release everything this instance created. */
  dispose(): void;
}

export interface RackModuleDef {
  readonly type: string;
  readonly kind: RackModuleKind;
  readonly label: string;
  readonly family: string;
  readonly params: readonly ParamSpec[];
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode | Promise<RackNode>;
}

/** One module as stored in a rack: serialisable, no audio nodes. */
export interface RackModuleInstance {
  id: string;
  type: string;
  enabled: boolean;
  params: ParamValues;
}

/** A whole rack as stored / serialised. Modules run input -> output in order. */
export interface RackState {
  version: 1;
  modules: RackModuleInstance[];
}

export function emptyRackState(): RackState {
  return { version: 1, modules: [] };
}
