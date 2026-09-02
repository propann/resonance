/**
 * Granular (2-tap crossfading delay-line) pitch shifter. Two windowed read
 * pointers drift through a grain and crossfade to hide the seam. Cheap and a
 * little warbly — a real-time approximation, not a phase vocoder.
 * Registered as "pitch-processor". Params k-rate.
 *
 *  semitones  -12..12   pitch offset
 *  mix        0..1       dry/wet
 */
class PitchProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'semitones', defaultValue: 0, minValue: -12, maxValue: 12, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._grain = Math.floor(0.08 * sampleRate);
    this._N = this._grain * 2 + 256;
    this._buf = [];
    this._write = [];
    this._offset = 0; // shared read drift within the grain
  }

  _read(buf, pos) {
    const N = this._N;
    let p = pos;
    while (p < 0) p += N;
    while (p >= N) p -= N;
    const i0 = Math.floor(p);
    const i1 = (i0 + 1) % N;
    const frac = p - i0;
    return buf[i0] * (1 - frac) + buf[i1] * frac;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const ratio = Math.pow(2, parameters.semitones[0] / 12);
    const mix = parameters.mix[0];
    const bypass = Math.abs(ratio - 1) < 1e-4;
    const grain = this._grain;
    const half = grain / 2;
    const delta = 1 - ratio;
    const nCh = input.length;
    const frames = input[0].length;
    const N = this._N;
    const base = 8;

    for (let ch = 0; ch < nCh; ch++) {
      if (!this._buf[ch]) {
        this._buf[ch] = new Float32Array(N);
        this._write[ch] = 0;
      }
    }

    for (let i = 0; i < frames; i++) {
      const o1 = this._offset;
      let o2 = this._offset + half;
      if (o2 >= grain) o2 -= grain;
      const win1 = 0.5 - 0.5 * Math.cos((2 * Math.PI * o1) / grain);
      const win2 = 0.5 - 0.5 * Math.cos((2 * Math.PI * o2) / grain);

      for (let ch = 0; ch < nCh; ch++) {
        const buf = this._buf[ch];
        const w = this._write[ch];
        buf[w] = input[ch][i];

        let y;
        if (bypass) {
          y = input[ch][i];
        } else {
          const t1 = this._read(buf, w - base - o1);
          const t2 = this._read(buf, w - base - o2);
          const wet = (t1 * win1 + t2 * win2) / Math.max(0.0001, win1 + win2);
          y = input[ch][i] * (1 - mix) + wet * mix;
        }
        output[ch][i] = y > 1 ? 1 : y < -1 ? -1 : y;
        this._write[ch] = (w + 1) % N;
      }

      this._offset += delta;
      while (this._offset >= grain) this._offset -= grain;
      while (this._offset < 0) this._offset += grain;
    }
    return true;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
