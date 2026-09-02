/**
 * Bitcrusher / sample-rate reducer AudioWorkletProcessor.
 * Registered as "bitcrusher-processor". Params are k-rate.
 *
 *  bits       1..16   quantisation depth
 *  reduction  1..50   sample-and-hold factor (1 = off)
 *  mix        0..1    dry/wet
 */
class BitcrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 8, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'reduction', defaultValue: 1, minValue: 1, maxValue: 50, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._hold = [];
    this._phase = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const bits = Math.max(1, Math.min(16, parameters.bits[0] | 0));
    const reduction = Math.max(1, Math.min(50, parameters.reduction[0] | 0));
    const mix = Math.max(0, Math.min(1, parameters.mix[0]));
    const steps = Math.pow(2, bits - 1);

    for (let ch = 0; ch < input.length; ch++) {
      const inCh = input[ch];
      const outCh = output[ch];
      if (this._hold[ch] === undefined) {
        this._hold[ch] = 0;
        this._phase[ch] = 0;
      }
      for (let i = 0; i < inCh.length; i++) {
        if (this._phase[ch] % reduction === 0) {
          this._hold[ch] = Math.round(inCh[i] * steps) / steps;
        }
        this._phase[ch]++;
        outCh[i] = inCh[i] * (1 - mix) + this._hold[ch] * mix;
      }
    }
    return true;
  }
}

registerProcessor('bitcrusher-processor', BitcrusherProcessor);
