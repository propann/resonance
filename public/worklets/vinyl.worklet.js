/**
 * Vinyl / tape character: wow + flutter pitch modulation via a fractional
 * delay line, surface crackle, and an "age" lowpass.
 * Registered as "vinyl-processor". Params k-rate.
 *
 *  wow      0..1   slow (~0.6 Hz) pitch drift depth
 *  flutter  0..1   fast (~6.3 Hz) pitch wobble depth
 *  crackle  0..1   density of surface-noise pops
 *  age      0..1   high-frequency rolloff
 *  mix      0..1   dry/wet
 */
class VinylProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'wow', defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'flutter', defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'crackle', defaultValue: 0.2, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'age', defaultValue: 0.4, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 0.7, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._N = 4096;
    this._buf = [];
    this._write = [];
    this._lp = [];
    this._wowPhase = 0;
    this._flutPhase = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const wow = parameters.wow[0];
    const flutter = parameters.flutter[0];
    const crackle = parameters.crackle[0];
    const age = parameters.age[0];
    const mix = parameters.mix[0];

    const nCh = input.length;
    const frames = input[0].length;
    const N = this._N;

    // age -> one-pole lowpass coefficient
    const cutoff = 16000 * (1 - age * 0.85) + 800;
    const dt = 1 / sampleRate;
    const rc = 1 / (2 * Math.PI * cutoff);
    const alpha = dt / (rc + dt);

    const wowInc = (2 * Math.PI * 0.6) / sampleRate;
    const flutInc = (2 * Math.PI * 6.3) / sampleRate;

    for (let ch = 0; ch < nCh; ch++) {
      if (!this._buf[ch]) {
        this._buf[ch] = new Float32Array(N);
        this._write[ch] = 0;
        this._lp[ch] = 0;
      }
    }

    for (let i = 0; i < frames; i++) {
      const wowMod = Math.sin(this._wowPhase) * wow * 28;
      const flutMod = Math.sin(this._flutPhase) * flutter * 5;
      const d = 64 + wowMod + flutMod;

      let pop = 0;
      if (Math.random() < crackle * 0.0025) {
        pop = (Math.random() * 2 - 1) * 0.35 * (0.5 + crackle);
      }

      for (let ch = 0; ch < nCh; ch++) {
        const buf = this._buf[ch];
        const w = this._write[ch];
        buf[w] = input[ch][i];

        let read = w - d;
        while (read < 0) read += N;
        const i0 = Math.floor(read) % N;
        const i1 = (i0 + 1) % N;
        const frac = read - Math.floor(read);
        const delayed = buf[i0] * (1 - frac) + buf[i1] * frac;

        this._lp[ch] += alpha * (delayed - this._lp[ch]);
        const wet = this._lp[ch] + pop;
        const y = input[ch][i] * (1 - mix) + wet * mix;
        output[ch][i] = y > 1 ? 1 : y < -1 ? -1 : y;

        this._write[ch] = (w + 1) % N;
      }

      this._wowPhase += wowInc;
      this._flutPhase += flutInc;
      if (this._wowPhase > 2 * Math.PI) this._wowPhase -= 2 * Math.PI;
      if (this._flutPhase > 2 * Math.PI) this._flutPhase -= 2 * Math.PI;
    }
    return true;
  }
}

registerProcessor('vinyl-processor', VinylProcessor);
