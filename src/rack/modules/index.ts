import { registerModule } from '../registry';
import { acidModule } from './acid';
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
import { fmVoiceModule } from './fmVoice';
import { formantModule } from './formant';
import { noiseSourceModule } from './noiseSource';
import { oscillatorModule } from './oscillator';
import { freqShiftModule } from './freqShift';
import { gainModule } from './gain';
import { phaserModule } from './phaser';
import { pitchModule } from './pitch';
import { reverbModule } from './reverb';
import { ringModModule } from './ringMod';
import { saturatorModule } from './saturator';
import { stereoImagerModule } from './stereoImager';
import { stutterModule } from './stutter';
import { subBassModule } from './subBass';
import { transientModule } from './transient';
import { vinylModule } from './vinyl';

let registered = false;

/** Register the built-in rack modules. Idempotent — call before using a Rack. */
export function registerBuiltinModules(): void {
  if (registered) return;
  registered = true;
  for (const def of [
    // Sources first: they head a chain, and the rack sums them with the sample.
    oscillatorModule,
    fmVoiceModule,
    noiseSourceModule,
    filterModule,
    acidModule,
    combResonatorModule,
    formantModule,
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
    stutterModule,
    chorusModule,
    phaserModule,
    ringModModule,
    freqShiftModule,
    pitchModule,
    autoPanModule,
    stereoImagerModule,
    vinylModule,
  ]) {
    registerModule(def);
  }
}

export {
  acidModule,
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
  formantModule,
  freqShiftModule,
  gainModule,
  phaserModule,
  pitchModule,
  reverbModule,
  ringModModule,
  saturatorModule,
  stereoImagerModule,
  stutterModule,
  subBassModule,
  transientModule,
  vinylModule,
};
