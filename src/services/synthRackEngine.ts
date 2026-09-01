import { audioEngine } from './audioEngine';
import * as Tone from 'tone';

export type SynthWave = OscillatorType;
export type CreatorEngineType = 'native' | 'tone-synth' | 'tone-fm' | 'tone-am' | 'tone-membrane' | 'tone-metal' | 'tone-pluck' | 'tone-noise';

export const CREATOR_ENGINES: Array<{ id: CreatorEngineType; label: string; family: string }> = [
  { id: 'native', label: 'Native Oscillator', family: 'Web Audio' },
  { id: 'tone-synth', label: 'Tone Synth', family: 'Subtractive' },
  { id: 'tone-fm', label: 'Tone FM Synth', family: 'FM' },
  { id: 'tone-am', label: 'Tone AM Synth', family: 'AM' },
  { id: 'tone-membrane', label: 'Tone Membrane', family: 'Drums / 808' },
  { id: 'tone-metal', label: 'Tone Metal', family: 'Metallic' },
  { id: 'tone-pluck', label: 'Tone Pluck', family: 'Karplus / Pluck' },
  { id: 'tone-noise', label: 'Tone Noise', family: 'Noise / FX' },
];

export interface SynthLayer {
  id: string;
  name: string;
  enabled: boolean;
  engine: CreatorEngineType;
  wave: SynthWave;
  octave: number;
  detune: number;
  gain: number;
  pan: number;
  attack: number;
  release: number;
}

export const DEFAULT_SYNTH_LAYERS: SynthLayer[] = Array.from({ length: 10 }, (_, index) => ({
  id: `layer-${index + 1}`,
  name: `MOTEUR ${String(index + 1).padStart(2, '0')}`,
  enabled: index === 0,
  engine: index === 0 ? 'tone-synth' : index === 1 ? 'tone-fm' : 'native',
  wave: index === 0 ? 'sawtooth' : index === 1 ? 'sine' : 'square',
  octave: index === 1 ? -1 : 0,
  detune: index === 2 ? 7 : 0,
  gain: index === 0 ? 0.22 : 0.12,
  pan: index === 1 ? -0.15 : index === 2 ? 0.15 : 0,
  attack: 0.02,
  release: 0.25,
}));

interface VoiceLayer {
  oscillator: OscillatorNode;
  gain: GainNode;
}

export class SynthRackEngine {
  private voices = new Map<number, VoiceLayer[]>();
  private master: GainNode | null = null;
  private layers: SynthLayer[] = DEFAULT_SYNTH_LAYERS.map((layer) => ({ ...layer }));
  private toneInstruments = new Map<string, any>();
  private toneVoices = new Map<number, any[]>();

  setLayers(layers: SynthLayer[]): void {
    this.layers = layers.map((layer) => ({ ...layer }));
  }

  private noteName(note: number): string {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
  }

  private getToneInstrument(layer: SynthLayer): any {
    const existing = this.toneInstruments.get(layer.id);
    if (existing) return existing;
    let instrument: any;
    if (layer.engine === 'tone-fm') instrument = new (Tone as any).PolySynth((Tone as any).FMSynth);
    else if (layer.engine === 'tone-am') instrument = new (Tone as any).PolySynth((Tone as any).AMSynth);
    else if (layer.engine === 'tone-membrane') instrument = new (Tone as any).PolySynth((Tone as any).MembraneSynth);
    else if (layer.engine === 'tone-metal') instrument = new (Tone as any).PolySynth((Tone as any).MetalSynth);
    else if (layer.engine === 'tone-pluck') instrument = new (Tone as any).PolySynth((Tone as any).PluckSynth);
    else if (layer.engine === 'tone-noise') instrument = new (Tone as any).NoiseSynth();
    else instrument = new (Tone as any).PolySynth((Tone as any).Synth);
    instrument.volume.value = Math.max(-48, 20 * Math.log10(Math.max(0.0001, layer.gain)));
    instrument.toDestination();
    this.toneInstruments.set(layer.id, instrument);
    return instrument;
  }

  private playToneLayer(layer: SynthLayer, note: number, velocity: number): void {
    void (Tone as any).start().then(() => {
      const instrument = this.getToneInstrument(layer);
      const noteName = this.noteName(note + layer.octave * 12);
      if (layer.engine === 'tone-noise') instrument.triggerAttack(undefined, velocity / 127);
      else instrument.triggerAttack(noteName, undefined, velocity / 127);
      const voices = this.toneVoices.get(note) || [];
      voices.push({ layer, instrument, noteName });
      this.toneVoices.set(note, voices);
    });
  }

  private getMaster(ctx: AudioContext): GainNode {
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(ctx.destination);
    }
    return this.master;
  }

  noteOn(note: number, velocity = 100): void {
    this.noteOff(note);
    const ctx = audioEngine.getAudioContext();
    const now = ctx.currentTime;
    const frequency = 440 * Math.pow(2, (note - 69) / 12);
    const voice: VoiceLayer[] = [];
    for (const layer of this.layers.filter((item) => item.enabled)) {
      if (layer.engine !== 'native') {
        this.playToneLayer(layer, note, velocity);
        continue;
      }
      const oscillator = ctx.createOscillator();
      oscillator.type = layer.wave;
      oscillator.frequency.value = frequency * Math.pow(2, layer.octave);
      oscillator.detune.value = layer.detune;
      const gain = ctx.createGain();
      const peak = Math.max(0, Math.min(0.5, layer.gain * (velocity / 127)));
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + Math.max(0.005, layer.attack));
      oscillator.connect(gain);
      try {
        const panner = ctx.createStereoPanner();
        panner.pan.value = layer.pan;
        gain.connect(panner);
        panner.connect(this.getMaster(ctx));
      } catch {
        gain.connect(this.getMaster(ctx));
      }
      oscillator.start(now);
      voice.push({ oscillator, gain });
    }
    if (voice.length) this.voices.set(note, voice);
  }

  noteOff(note: number): void {
    const voice = this.voices.get(note);
    if (voice) {
      const ctx = audioEngine.getAudioContext();
      const now = ctx.currentTime;
      voice.forEach(({ oscillator, gain }) => {
        const release = Math.max(...this.layers.filter((layer) => layer.enabled).map((layer) => layer.release), 0.03);
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + release);
        oscillator.stop(now + release + 0.03);
      });
      this.voices.delete(note);
    }
    const toneVoice = this.toneVoices.get(note);
    toneVoice?.forEach(({ layer, instrument, noteName }) => {
      if (layer.engine === 'tone-noise') instrument.triggerRelease();
      else instrument.triggerRelease(noteName);
    });
    this.toneVoices.delete(note);
  }

  allNotesOff(): void {
    [...this.voices.keys()].forEach((note) => this.noteOff(note));
    this.toneInstruments.forEach((instrument) => instrument.releaseAll?.());
  }
}

export const synthRackEngine = new SynthRackEngine();

/** Renders the current layered patch to a portable AudioBuffer for the sample library. */
export async function renderSynthPatch(layers: SynthLayer[], note = 48, duration = 2): Promise<AudioBuffer> {
  const sampleRate = 48000;
  const context = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate);
  const master = context.createGain();
  master.gain.value = 0.75;
  master.connect(context.destination);
  const baseFrequency = 440 * Math.pow(2, (note - 69) / 12);
  layers.filter((layer) => layer.enabled).forEach((layer) => {
    const oscillator = context.createOscillator();
    oscillator.type = layer.engine === 'tone-noise' ? 'sawtooth' : layer.wave;
    oscillator.frequency.value = baseFrequency * Math.pow(2, layer.octave);
    oscillator.detune.value = layer.detune;
    const gain = context.createGain();
    const peak = Math.max(0.0001, Math.min(0.4, layer.gain));
    const attack = Math.max(0.005, layer.attack);
    const release = Math.min(duration - 0.01, Math.max(0.03, layer.release));
    gain.gain.setValueAtTime(0.0001, 0);
    gain.gain.exponentialRampToValueAtTime(peak, attack);
    gain.gain.setValueAtTime(peak, Math.max(attack, duration - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, duration);
    oscillator.connect(gain);
    try {
      const panner = context.createStereoPanner();
      panner.pan.value = layer.pan;
      gain.connect(panner);
      panner.connect(master);
    } catch {
      gain.connect(master);
    }
    oscillator.start(0);
    oscillator.stop(duration);
  });
  return await context.startRendering();
}
