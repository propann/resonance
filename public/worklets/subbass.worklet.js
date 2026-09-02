/**
 * Sub-bass / 808 enhancer. Isolates the low band, synthesises an octave-down
 * sine that tracks its energy, and tube-drives the boosted bass.
 * Registered as "subbass-processor". Params k-rate. Ported from the offline
 * dspEffectsEngine sub-bass stage.
 *
 *  frequency  30..120 Hz   crossover for the low band
 *  boost      0..18 dB     gain on the low band
 *  sub        0..1         sub-harmonic (half frequency) amount
 *  drive      0..1         808 tube drive on the low band
 */
class SubBassProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 55, minValue: 30, maxValue: 120, automationRate: 'k-rate' },
      { name: 'boost', defaultValue: 6, minValue: 0, maxValue: 18, automationRate: 'k-rate' },
      { name: 'sub', defaultValue: 0.4, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'drive', defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._lp = [];
    this._phase = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const freq = parameters.frequency[0];
    const boostLin = Math.pow(10, parameters.boost[0] / 20);
    const subAmt = parameters.sub[0];
    const drive = parameters.drive[0];

    const dt = 1 / sampleRate;
    const rc = 1 / (2 * Math.PI * freq);
    const alpha = dt / (rc + dt);
    const subStep = (2 * Math.PI * (freq / 2)) / sampleRate;
    const TWO_PI = 2 * Math.PI;

    for (let ch = 0; ch < input.length; ch++) {
      const inCh = input[ch];
      const outCh = output[ch];
      if (this._lp[ch] === undefined) {
        this._lp[ch] = 0;
        this._phase[ch] = 0;
      }
      let lp = this._lp[ch];
      let phase = this._phase[ch];
      for (let i = 0; i < inCh.length; i++) {
        const x = inCh[i];
        lp += alpha * (x - lp);
        const energy = Math.abs(lp);
        phase += subStep;
        if (phase > TWO_PI) phase -= TWO_PI;
        const subSine = Math.sin(phase) * energy * subAmt * 1.5;
        const driven = Math.tanh(lp * boostLin * (1 + drive * 3));
        const y = x - lp + driven + subSine;
        outCh[i] = y > 1 ? 1 : y < -1 ? -1 : y;
      }
      this._lp[ch] = lp;
      this._phase[ch] = phase;
    }
    return true;
  }
}

registerProcessor('subbass-processor', SubBassProcessor);
