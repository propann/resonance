export type NativeEngineId = 'dexed' | 'mutable-plaits' | 'mutable-braids' | 'mutable-clouds' | 'mutable-rings';

export interface EngineBridge {
  readonly id: NativeEngineId;
  readonly version: string;
  load(): Promise<void>;
  setParameter(name: string, value: number): void;
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  render(durationSeconds: number, sampleRate: number): Promise<AudioBuffer>;
  dispose(): void;
}

/**
 * Loads a compiled AudioWorklet/WASM engine without bundling it into the app.
 * The generated module must expose `createEngineBridge()` in `/engines/<id>/bridge.js`.
 */
export async function loadEngineBridge(id: NativeEngineId): Promise<EngineBridge> {
  const moduleUrl = `/engines/${id}/bridge.js`;
  try {
    const module = await import(/* @vite-ignore */ moduleUrl) as { createEngineBridge?: () => Promise<EngineBridge> | EngineBridge };
    if (!module.createEngineBridge) throw new Error(`Bridge invalide pour ${id}`);
    return await module.createEngineBridge();
  } catch (error) {
    throw new Error(`Le moteur ${id} n'est pas encore compile pour cette plateforme. (${String(error)})`);
  }
}
