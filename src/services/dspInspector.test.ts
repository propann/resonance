import { describe, expect, it, vi } from 'vitest';

// Pulled in at module load and unreachable from a test runner.
vi.mock('./audioGraph', () => ({ audioGraph: {} }));

import { analyzeFullDspReport } from './dspInspector';
import type { SampleItem } from '../types/sample';

/** A quiet sine, enough for the report to have something real to measure. */
function tone(seconds = 0.25, amplitude = 0.2, sampleRate = 48000): AudioBuffer {
  const length = Math.round(seconds * sampleRate);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = amplitude * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
  }
  return {
    length,
    sampleRate,
    numberOfChannels: 1,
    duration: seconds,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

const item = (fields: Partial<SampleItem>) => fields as SampleItem;

describe('analyzeFullDspReport — loudness', () => {
  // A sample hydrated from the manifest carries `lufs: 0`; the manifest keeps
  // no loudness field. Reported as-is, every sample on disk announced 0.0 LUFS.
  it('does not take a stored zero for a measurement', () => {
    const report = analyzeFullDspReport(tone(), item({ lufs: 0 }));
    expect(report.integratedLufs).toBeLessThan(-1);
    expect(report.integratedLufs).toBeGreaterThanOrEqual(-70);
  });

  it('estimates from the signal when nothing was ever measured', () => {
    const measured = analyzeFullDspReport(tone(), item({ lufs: 0 })).integratedLufs;
    const absent = analyzeFullDspReport(tone()).integratedLufs;
    expect(measured).toBeCloseTo(absent, 6);
  });

  it('keeps a real stored reading', () => {
    const report = analyzeFullDspReport(tone(), item({ lufs: -14.3 }));
    expect(report.integratedLufs).toBeCloseTo(-14.3, 6);
  });

  it('reads a quieter signal as quieter', () => {
    const loud = analyzeFullDspReport(tone(0.25, 0.5)).integratedLufs;
    const quiet = analyzeFullDspReport(tone(0.25, 0.05)).integratedLufs;
    expect(quiet).toBeLessThan(loud);
  });
});
