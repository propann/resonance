import { registerModule } from '../registry';
import { bitcrusherModule } from './bitcrusher';
import { chorusModule } from './chorus';
import { combResonatorModule } from './combResonator';
import { compressorModule } from './compressor';
import { delayModule } from './delay';
import { filterModule } from './filter';
import { gainModule } from './gain';
import { reverbModule } from './reverb';
import { saturatorModule } from './saturator';

let registered = false;

/** Register the built-in rack modules. Idempotent — call before using a Rack. */
export function registerBuiltinModules(): void {
  if (registered) return;
  registered = true;
  for (const def of [
    filterModule,
    combResonatorModule,
    saturatorModule,
    bitcrusherModule,
    compressorModule,
    gainModule,
    delayModule,
    reverbModule,
    chorusModule,
  ]) {
    registerModule(def);
  }
}

export {
  bitcrusherModule,
  chorusModule,
  combResonatorModule,
  compressorModule,
  delayModule,
  filterModule,
  gainModule,
  reverbModule,
  saturatorModule,
};
