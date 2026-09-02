/**
 * Single-sideband frequency shifter (Bode-style). A polyphase IIR Hilbert
 * network builds an approximate quadrature pair which is then ring-modulated
 * with a complex exponential. Sideband rejection is approximate — expect a
 * faint mirror image. Registered as "freqshift-processor". Params k-rate.
 *
 *  shift  -2000..2000 Hz   linear frequency shift
 *  mix    0..1             dry/wet
 */
const A_COEFF = [0.6923877778065, 0.9360654322959, 0.9882295226860, 0.9987488452737];
const B_COEFF = [0.4021921162426, 0.856171088242, 0.9722909545651, 0.9952884791278];

class FreqShiftProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'shift', defaultValue: 0, minValue: -2000, maxValue: 2000, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    // per-channel: 4 A stages + 4 B stages, each { xz1,xz2,yz1,yz2 }
    this._stages = [];
    this._xprev = [];
    this._osc = 0;
  }

  _initChannel() {
    const mk = () => A_COEFF.map(() => ({ xz1: 0, xz2: 0, yz1: 0, yz2: 0 }));
    return { a: mk(), b: mk() };
  }

  _run(chain, coeffs, x) {
    let v = x;
    for (let s = 0; s < coeffs.length; s++) {
      const st = chain[s];
      const c = coeffs[s];
      const y = c * v + st.xz2 - c * st.yz2;
      st.xz2 = st.xz1;
      st.xz1 = v;
      st.yz2 = st.yz1;
      st.yz1 = y;
      v = y;
    }
    return v;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const shift = parameters.shift[0];
    const mix = parameters.mix[0];
    const w = (2 * Math.PI * shift) / sampleRate;
    const nCh = input.length;
    const frames = input[0].length;

    for (let ch = 0; ch < nCh; ch++) {
      if (!this._stages[ch]) {
        this._stages[ch] = this._initChannel();
        this._xprev[ch] = 0;
      }
    }

    for (let i = 0; i < frames; i++) {
      const c = Math.cos(this._osc);
      const s = Math.sin(this._osc);
      for (let ch = 0; ch < nCh; ch++) {
        const x = input[ch][i];
        const st = this._stages[ch];
        const re = this._run(st.a, A_COEFF, this._xprev[ch]);
        const im = this._run(st.b, B_COEFF, x);
        this._xprev[ch] = x;
        const shifted = re * c - im * s;
        const y = x * (1 - mix) + shifted * mix;
        output[ch][i] = y > 1 ? 1 : y < -1 ? -1 : y;
      }
      this._osc += w;
      if (this._osc > Math.PI) this._osc -= 2 * Math.PI;
      else if (this._osc < -Math.PI) this._osc += 2 * Math.PI;
    }
    return true;
  }
}

registerProcessor('freqshift-processor', FreqShiftProcessor);
