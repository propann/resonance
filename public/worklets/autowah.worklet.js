/**
 * Envelope-following resonant lowpass (auto-wah). An amplitude follower sweeps
 * a Chamberlin state-variable filter's cutoff.
 * Registered as "autowah-processor". Params k-rate.
 *
 *  sensitivity  0..1        how hard the envelope opens the filter
 *  base         200..2000   resting cutoff (Hz)
 *  range        200..6000   sweep span above base (Hz)
 *  resonance    0..1        filter Q
 *  mix          0..1        dry/wet
 */
class AutoWahProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'sensitivity', defaultValue: 0.6, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'base', defaultValue: 500, minValue: 200, maxValue: 2000, automationRate: 'k-rate' },
      { name: 'range', defaultValue: 3000, minValue: 200, maxValue: 6000, automationRate: 'k-rate' },
      { name: 'resonance', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 0.85, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._env = [];
    this._low = [];
    this._band = [];
    this._attack = Math.exp(-1 / (sampleRate * 0.005));
    this._release = Math.exp(-1 / (sampleRate * 0.08));
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const sens = parameters.sensitivity[0];
    const base = parameters.base[0];
    const range = parameters.range[0];
    const q = 1 - parameters.resonance[0] * 0.95; // damping (lower = more resonant)
    const mix = parameters.mix[0];
    const maxFc = sampleRate * 0.45;
    const atk = this._attack;
    const rel = this._release;

    for (let ch = 0; ch < input.length; ch++) {
      const inCh = input[ch];
      const outCh = output[ch];
      if (this._env[ch] === undefined) {
        this._env[ch] = 0;
        this._low[ch] = 0;
        this._band[ch] = 0;
      }
      let env = this._env[ch];
      let low = this._low[ch];
      let band = this._band[ch];
      for (let i = 0; i < inCh.length; i++) {
        const x = inCh[i];
        const a = Math.abs(x);
        env = a > env ? a + (env - a) * atk : a + (env - a) * rel;

        let fc = base + range * Math.min(1, env * sens * 8);
        if (fc > maxFc) fc = maxFc;
        else if (fc < 20) fc = 20;

        const f = 2 * Math.sin((Math.PI * fc) / sampleRate);
        low += f * band;
        const high = x - low - q * band;
        band += f * high;

        const y = x * (1 - mix) + low * mix;
        outCh[i] = y > 1 ? 1 : y < -1 ? -1 : y;
      }
      this._env[ch] = env;
      this._low[ch] = low;
      this._band[ch] = band;
    }
    return true;
  }
}

registerProcessor('autowah-processor', AutoWahProcessor);
