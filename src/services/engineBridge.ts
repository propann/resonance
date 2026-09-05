export type NativeEngineId =
  | 'dexed'
  | 'mutable-plaits'
  | 'mutable-braids'
  | 'mutable-clouds'
  | 'mutable-rings'
  | 'mutable-elements';

export interface EngineBridge {
  readonly id: NativeEngineId;
  readonly version: string;
  /**
   * The models this engine offers, when it has more than one. Plaits carries
   * sixteen behind the same set of knobs, and the interface lists them by
   * name rather than by index.
   */
  readonly models?: readonly string[];
  load(): Promise<void>;
  setParameter(name: string, value: number): void;
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  render(durationSeconds: number, sampleRate: number): Promise<AudioBuffer>;
  /**
   * Engines that transform a sound rather than make one — Clouds grains what
   * it is fed. Absent on the voices, which have nothing to transform.
   *
   * The buffer comes back at the rate it went in: the engines run at their own
   * fixed rate on the hardware, and resampling around that is the bridge's
   * job, not the caller's.
   */
  process?(input: AudioBuffer): Promise<AudioBuffer>;
  dispose(): void;
}

/**
 * Loads a compiled AudioWorklet/WASM engine without bundling it into the app.
 * The generated module must expose `createEngineBridge()` in `/engines/<id>/bridge.js`.
 */
/**
 * Imports a URL the bundler must not look at.
 *
 * The engines live in `public/`, so they are copied into the build untouched
 * and served as plain files. Vite refuses to resolve such a file from source
 * code — even behind `@vite-ignore`, it recognises the path and stops the dev
 * server with "should not be imported from source code". Going through
 * `new Function` leaves nothing for it to recognise: the specifier only exists
 * at runtime, which is exactly the point of an engine loaded on demand.
 */
const importAtRuntime = new Function('url', 'return import(url)') as (
  url: string
) => Promise<Record<string, unknown>>;

export async function loadEngineBridge(id: NativeEngineId): Promise<EngineBridge> {
  const moduleUrl = `/engines/${id}/bridge.js`;
  try {
    const module = await importAtRuntime(moduleUrl) as { createEngineBridge?: () => Promise<EngineBridge> | EngineBridge };
    if (!module.createEngineBridge) throw new Error(`Bridge invalide pour ${id}`);
    return await module.createEngineBridge();
  } catch (error) {
    throw new Error(`Le moteur ${id} n'est pas encore compile pour cette plateforme. (${String(error)})`);
  }
}
