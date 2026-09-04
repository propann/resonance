import { coerceParams } from './params';
import { requireModuleDef } from './registry';
import type { ParamValues, RackNode, RackState } from './types';

/**
 * Resolve a worklet file under the app's base URL so it works both in the dev
 * server (base "/") and in the packaged Electron app loaded from file:// (base
 * "./").
 */
export function workletUrl(file: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/worklets/${file}`;
}

/** Load an AudioWorklet module once per (context, url). */
const workletLoads = new WeakMap<BaseAudioContext, Map<string, Promise<void>>>();

export function ensureWorklet(ctx: BaseAudioContext, url: string): Promise<void> {
  let perCtx = workletLoads.get(ctx);
  if (!perCtx) {
    perCtx = new Map();
    workletLoads.set(ctx, perCtx);
  }
  let load = perCtx.get(url);
  if (!load) {
    load = ctx.audioWorklet.addModule(url);
    perCtx.set(url, load);
  }
  return load;
}

interface LiveModule {
  id: string;
  type: string;
  node: RackNode;
  params: ParamValues;
}

/**
 * Runtime for one rack in one AudioContext. Builds `input -> [enabled modules]
 * -> output`. The same class runs against a realtime AudioContext (monitoring)
 * and an OfflineAudioContext (bounce) — see `renderRackOffline`.
 *
 * Source modules (input === null) are supported as the chain head; the current
 * proof modules are all inserts.
 */
export class Rack {
  readonly input: GainNode;
  readonly output: GainNode;
  /** Where the rack's input and every source module meet before the inserts. */
  private readonly sum: GainNode;
  private readonly ctx: BaseAudioContext;
  private live: LiveModule[] = [];

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.sum = ctx.createGain();
    this.input.connect(this.sum);
    this.sum.connect(this.output);
  }

  /** Tear down the current chain and build the one described by `state`. */
  async setState(state: RackState): Promise<void> {
    this.teardown();

    const enabled = state.modules.filter((m) => m.enabled);
    const built: LiveModule[] = [];
    for (const instance of enabled) {
      const def = requireModuleDef(instance.type);
      const params = coerceParams(def, instance.params);
      try {
        const node = await def.createNode(this.ctx, params);
        built.push({ id: instance.id, type: instance.type, node, params });
      } catch (error) {
        // A module that fails to build (e.g. missing worklet) is skipped so the
        // rest of the chain still works.
        console.error(`[rack] module "${instance.type}" failed to build — skipped`, error);
      }
    }

    // Rewire. Sources (input === null) are summed together with the rack's own
    // input — that is what lets a sound engine be layered over a sample rather
    // than replacing it — and the inserts chain from that sum to the output.
    try {
      this.input.disconnect();
    } catch {
      // nothing connected yet
    }
    this.sum.disconnect();

    this.input.connect(this.sum);
    for (const m of built) {
      if (!m.node.input) m.node.output.connect(this.sum);
    }

    let cursor: AudioNode = this.sum;
    for (const m of built) {
      if (!m.node.input) continue;
      cursor.connect(m.node.input);
      cursor = m.node.output;
    }
    cursor.connect(this.output);

    this.live = built;
  }

  /** Apply a partial parameter change to one live module, no rebuild. */
  updateModuleParams(id: string, partial: ParamValues): void {
    const m = this.live.find((x) => x.id === id);
    if (!m) return;
    const def = requireModuleDef(m.type);
    m.params = coerceParams(def, { ...m.params, ...partial });
    m.node.update(m.params);
  }

  hasModule(id: string): boolean {
    return this.live.some((m) => m.id === id);
  }

  /** How many modules are actually live — a module that failed to build is not. */
  get moduleCount(): number {
    return this.live.length;
  }

  dispose(): void {
    this.teardown();
    try {
      this.input.disconnect();
    } catch {
      /* noop */
    }
    try {
      this.output.disconnect();
    } catch {
      /* noop */
    }
  }

  private teardown(): void {
    for (const m of this.live) {
      try {
        m.node.dispose();
      } catch (error) {
        console.warn(`[rack] dispose failed for ${m.type}`, error);
      }
    }
    this.live = [];
  }
}

/**
 * Render a source buffer through a rack in an OfflineAudioContext.
 * `tailSec` extends the render past the source for delay/reverb tails.
 */
export async function renderRackOffline(
  state: RackState,
  source: AudioBuffer,
  tailSec = 0
): Promise<AudioBuffer> {
  const extra = Math.max(0, Math.ceil(tailSec * source.sampleRate));
  const ctx = new OfflineAudioContext(
    source.numberOfChannels,
    source.length + extra,
    source.sampleRate
  );
  const rack = new Rack(ctx);
  await rack.setState(state);

  const src = ctx.createBufferSource();
  src.buffer = source;
  src.connect(rack.input);
  rack.output.connect(ctx.destination);
  src.start();

  const rendered = await ctx.startRendering();
  rack.dispose();
  return rendered;
}
