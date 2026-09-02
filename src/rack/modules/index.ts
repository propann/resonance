import { registerModule } from '../registry';
import { autoPanModule } from './autoPan';
import { bitcrusherModule } from './bitcrusher';
import { chorusModule } from './chorus';
import { combResonatorModule } from './combResonator';
import { compressorModule } from './compressor';
import { dcRemoveModule } from './dcRemove';
import { delayModule } from './delay';
import { exciterModule } from './exciter';
import { filterModule } from './filter';
import { gainModule } from './gain';
import { phaserModule } from './phaser';
import { reverbModule } from './reverb';
import { ringModModule } from './ringMod';
import { saturatorModule } from './saturator';
import { stereoImagerModule } from './stereoImager';

let registered = false;

/** Register the built-in rack modules. Idempotent — call before using a Rack. */
export function registerBuiltinModules(): void {
  if (registered) return;
  registered = true;
  for (const def of [
    filterModule,
    combResonatorModule,
    dcRemoveModule,
    saturatorModule,
    bitcrusherModule,
    exciterModule,
    compressorModule,
    gainModule,
    delayModule,
    reverbModule,
    chorusModule,
    phaserModule,
    ringModModule,
    autoPanModule,
    stereoImagerModule,
  ]) {
    registerModule(def);
  }
}

export {
  autoPanModule,
  bitcrusherModule,
  chorusModule,
  combResonatorModule,
  compressorModule,
  dcRemoveModule,
  delayModule,
  exciterModule,
  filterModule,
  gainModule,
  phaserModule,
  reverbModule,
  ringModModule,
  saturatorModule,
  stereoImagerModule,
};
