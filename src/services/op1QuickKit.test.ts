import { describe, expect, it, vi } from 'vitest';
import { buildOp1QuickKit, kitFileName, OP1_PAD_COUNT } from './op1QuickKit';

// The encoder renders through an OfflineAudioContext and writes an AIFF; both
// are browser things. Only the kit's own arithmetic is under test here.
vi.mock('./op1PatchEncoder', () => ({
  buildOp1DrumBuffer: vi.fn(async (slots: Array<Record<string, unknown>>) => ({
    audioBuffer: { duration: 12, length: 12 * 44100, sampleRate: 44100, numberOfChannels: 1 },
    // Stand in for the real layout: each sound gets an equal share of the 12 s.
    // The real builder always returns twenty-four, padding with its own
    // default pad names; the mock does the same so the test means something.
    calculatedSlices: Array.from({ length: 24 }, (_, index) => ({
      ...(slots[index] ?? { id: `default-${index}`, name: 'Break / Mini Loop' }),
      startSec: (index * 12) / Math.max(1, slots.length),
      endSec: ((index + 1) * 12) / Math.max(1, slots.length),
    })),
  })),
  encodeOp1AiffPatch: vi.fn(() => new Blob(['FORM'], { type: 'audio/aiff' })),
}));

const sound = (label: string, duration = 0.5) => ({
  label,
  buffer: { duration, length: duration * 44100, sampleRate: 44100, numberOfChannels: 1 } as AudioBuffer,
});

describe('kitFileName', () => {
  it('makes a name safe on any filesystem', () => {
    expect(kitFileName('Plaits — Corde pincée')).toBe('Plaits_Corde_pincee');
    expect(kitFileName('FM 2 opérateurs')).toBe('FM_2_operateurs');
  });

  it('never comes back empty or unbounded', () => {
    expect(kitFileName('///')).toBe('KIT');
    expect(kitFileName('')).toBe('KIT');
    expect(kitFileName('x'.repeat(200)).length).toBe(40);
  });
});

describe('buildOp1QuickKit', () => {
  it('turns sounds into pads, markers and a patch', async () => {
    const kit = await buildOp1QuickKit([sound('Kick'), sound('Snare'), sound('Hat')], 'Mon Kit');

    expect(kit.name).toBe('Mon_Kit');
    expect(kit.slices).toHaveLength(3);
    expect(kit.aiff.type).toBe('audio/aiff');
    expect(kit.buffer.duration).toBe(12);
  });

  it('lays the markers out in order, without gaps or overlaps', async () => {
    const kit = await buildOp1QuickKit([sound('a'), sound('b'), sound('c'), sound('d')], 'K');

    expect(kit.slices.map((s) => s.index)).toEqual([0, 1, 2, 3]);
    for (let i = 0; i < kit.slices.length; i++) {
      expect(kit.slices[i].endSec).toBeGreaterThan(kit.slices[i].startSec);
      if (i > 0) expect(kit.slices[i].startSec).toBeCloseTo(kit.slices[i - 1].endSec, 6);
    }
  });

  it('names each pad after the sound in it', async () => {
    const kit = await buildOp1QuickKit([sound('Corde pincée'), sound('Grosse caisse')], 'K');
    expect(kit.slices.map((s) => s.label)).toEqual(['Corde pincée', 'Grosse caisse']);
  });

  it('gives neighbouring pads different colours', async () => {
    const kit = await buildOp1QuickKit([sound('a'), sound('b'), sound('c')], 'K');
    expect(kit.slices[0].color).not.toBe(kit.slices[1].color);
    expect(kit.slices[1].color).not.toBe(kit.slices[2].color);
  });

  // The OP-1 has twenty-four pads. A twenty-fifth sound squeezed in would only
  // make every pad shorter, so the extras are dropped instead.
  it('keeps twenty-four sounds and drops the rest', async () => {
    const many = Array.from({ length: 40 }, (_, i) => sound(`s${i}`));
    const kit = await buildOp1QuickKit(many, 'K');
    expect(kit.slices).toHaveLength(OP1_PAD_COUNT);
    expect(kit.slices.at(-1)?.label).toBe('s23');
  });

  // The builder reports all twenty-four slots whatever it was handed, naming
  // the empty ones after the OP-1's default pads. Drawing those would put
  // "Break / Mini Loop" on the wave over silence.
  it('draws a marker only for the pads it was given a sound for', async () => {
    const kit = await buildOp1QuickKit([sound('seul')], 'K');
    expect(kit.slices).toHaveLength(1);
    expect(kit.slices[0].label).toBe('seul');
  });

  it('refuses to build a kit out of nothing', async () => {
    await expect(buildOp1QuickKit([], 'K')).rejects.toThrow(/Aucun son/);
  });
});
