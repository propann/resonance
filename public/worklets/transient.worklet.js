/**
 * Transient shaper. Dual envelope follower (fast vs slow) splits the signal
 * into attack vs sustain regions and applies independent gain to each.
 * Registered as "transient-processor". Params k-rate.
 *
 *  attack   -20..20 dB   gain on detected attacks
 *  sustain  -20..20 dB   gain on the sustain/body
 *  speed    1..200 ms    slow-envelope time constant
 */
class TransientProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'attack', defaultValue: 0, minValue: -20, maxValue: 20, automationRate: 'k-rate' },
      { name: 'sustain', defaultValue: 0, minValue: -20, maxValue: 20, automationRate: 'k-rate' },
      { name: 'speed', defaultValue: 30, minValue: 1, maxValue: 200, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._fast = [];
    this._slow = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const attackMult = Math.pow(10, parameters.attack[0] / 20);
    const sustainMult = Math.pow(10, parameters.sustain[0] / 20);
    const speedSec = Math.max(0.001, parameters.speed[0] / 1000);
    const fastAlpha = Math.exp(-1 / (sampleRate * 0.005));
    const slowAlpha = Math.exp(-1 / (sampleRate * speedSec));

    for (let ch = 0; ch < input.length; ch++) {
      const inCh = input[ch];
      const outCh = output[ch];
      if (this._fast[ch] === undefined) {
        this._fast[ch] = 0;
        this._slow[ch] = 0;
      }
      let fast = this._fast[ch];
      let slow = this._slow[ch];
      for (let i = 0; i < inCh.length; i++) {
        const a = Math.abs(inCh[i]);
        fast = Math.max(a, fast * fastAlpha);
        slow = Math.max(a, slow * slowAlpha);
        const diff = fast - slow;
        let g;
        if (diff > 0.01) {
          g = 1 + (attackMult - 1) * (diff / (fast + 1e-4));
        } else {
          g = sustainMult;
        }
        const y = inCh[i] * g;
        outCh[i] = y > 1 ? 1 : y < -1 ? -1 : y;
      }
      this._fast[ch] = fast;
      this._slow[ch] = slow;
    }
    return true;
  }
}

registerProcessor('transient-processor', TransientProcessor);
