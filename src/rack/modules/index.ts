import { registerModule } from '../registry';
import { bitcrusherModule } from './bitcrusher';
import { delayModule } from './delay';
import { filterModule } from './filter';

let registered = false;

/** Register the built-in rack modules. Idempotent — call before using a Rack. */
export function registerBuiltinModules(): void {
  if (registered) return;
  registered = true;
  registerModule(filterModule);
  registerModule(delayModule);
  registerModule(bitcrusherModule);
}

export { bitcrusherModule, delayModule, filterModule };
