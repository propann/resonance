import { registerModule } from '../registry';
import { autoPanModule } from './autoPan';
import { autoWahModule } from './autoWah';
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
import { subBassModule } from './subBass';
import { transientModule } from './transient';

let registered = false;

/** Register the built-in rack modules. Idempotent — call before using a Rack. */
export function registerBuiltinModules(): void {
  if (registered) return;
  registered = true;
  for (const def of [
    filterModule,
    combResonatorModule,
    dcRemoveModule,
    autoWahModule,
    saturatorModule,
    bitcrusherModule,
    exciterModule,
    subBassModule,
    compressorModule,
    transientModule,
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
  autoWahModule,
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
  subBassModule,
  transientModule,
};
