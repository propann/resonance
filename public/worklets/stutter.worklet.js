/**
 * Beat-repeat / stutter gate. Captures a slice of length one period and replays
 * it for `repeat` periods before recapturing; a duty cycle gates each period.
 * Registered as "stutter-processor". Params k-rate.
 *
 *  rate    1..20 Hz   period = sampleRate / rate
 *  repeat  1..8       periods the captured slice is held (1 = no stutter)
 *  duty    0..1       on-fraction within each period (gate)
 *  mix     0..1       dry/wet
 */
class StutterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rate', defaultValue: 8, minValue: 1, maxValue: 20, automationRate: 'k-rate' },
      { name: 'repeat', defaultValue: 2, minValue: 1, maxValue: 8, automationRate: 'k-rate' },
      { name: 'duty', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 0.8, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._bufLen = Math.ceil(sampleRate);
    this._ring = [];
    this._write = [];
    this._slice = [];
    this._phase = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const rate = parameters.rate[0];
    const repeat = Math.max(1, Math.min(8, parameters.repeat[0] | 0));
    const duty = parameters.duty[0];
    const mix = parameters.mix[0];

    const P = Math.max(1, Math.floor(sampleRate / rate));
    const win = P * repeat;
    const onLen = Math.max(1, Math.floor(duty * P));
    const nCh = input.length;
    const frames = input[0].length;
    const N = this._bufLen;

    for (let ch = 0; ch < nCh; ch++) {
      if (!this._ring[ch]) {
        this._ring[ch] = new Float32Array(N);
        this._slice[ch] = new Float32Array(N);
        this._write[ch] = 0;
      }
    }

    for (let i = 0; i < frames; i++) {
      const r = this._phase % win;
      if (r === 0) {
        for (let ch = 0; ch < nCh; ch++) {
          const ring = this._ring[ch];
          const slice = this._slice[ch];
          const w = this._write[ch];
          for (let k = 0; k < P; k++) {
            slice[k] = ring[(w - P + k + N) % N];
          }
        }
      }
      const sub = r % P;
      for (let ch = 0; ch < nCh; ch++) {
        const x = input[ch][i];
        this._ring[ch][this._write[ch]] = x;
        this._write[ch] = (this._write[ch] + 1) % N;
        const wet = sub < onLen ? this._slice[ch][sub] : 0;
        const y = x * (1 - mix) + wet * mix;
        output[ch][i] = y > 1 ? 1 : y < -1 ? -1 : y;
      }
      this._phase++;
    }
    return true;
  }
}

registerProcessor('stutter-processor', StutterProcessor);
