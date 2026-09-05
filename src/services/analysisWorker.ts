/// <reference lib="webworker" />
/**
 * The ingest's analysis, off the main thread.
 *
 * Measured on the running app, a batch of 64 sounds spent 2 853 ms decoding,
 * **8 420 ms analysing** and 109 ms encoding. The analysis is where the time
 * goes, and unlike decoding it is arithmetic over Float32Arrays with nothing
 * browser-specific in it — so it can run anywhere, including here.
 *
 * Decoding stays on the main thread because it has to: `decodeAudioData`
 * belongs to a BaseAudioContext, and there is no audio context in a worker.
 *
 * The analysis functions take an AudioBuffer, but they only ever read four of
 * its members. A plain object with the same four is enough, so not one line of
 * `audioAnalyzer` had to change to run here.
 */
import {
  assignEp133Slot,
  calculateAudioMetrics,
  classifyGenre,
  classifySample,
  detectAutoSlices,
  detectBpm,
  detectLoopVsOneShot,
  detectPitchAndKey,
  extractAcousticFeatures,
  extractTimbralDescriptors,
} from './audioAnalyzer';

/** What the analysis actually needs of an AudioBuffer. */
export interface BufferLike {
  readonly sampleRate: number;
  readonly duration: number;
  readonly numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

/** Rebuild the four members the analysis reads, around transferred channels. */
export function bufferLike(channels: Float32Array[], sampleRate: number): BufferLike {
  const length = channels[0]?.length ?? 0;
  return {
    sampleRate,
    duration: sampleRate > 0 ? length / sampleRate : 0,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => channels[Math.min(channel, channels.length - 1)],
  };
}

export interface AnalysisRequest {
  id: number;
  channels: Float32Array[];
  sampleRate: number;
  /** The source's original file name; several detectors read it. */
  name: string;
  /** Position in the batch, which the EP-133 slot assignment uses. */
  index: number;
}

/** Everything the curator needs back, in one message. */
export interface AnalysisResult {
  id: number;
  metrics: ReturnType<typeof calculateAudioMetrics>;
  features: ReturnType<typeof extractAcousticFeatures>;
  pitchKey: ReturnType<typeof detectPitchAndKey>;
  bpm: ReturnType<typeof detectBpm>;
  loopAnalysis: ReturnType<typeof detectLoopVsOneShot>;
  slices: ReturnType<typeof detectAutoSlices>;
  classification: ReturnType<typeof classifySample>;
  genre: ReturnType<typeof classifyGenre>;
  ep133Slot: ReturnType<typeof assignEp133Slot>;
  timbralTags: ReturnType<typeof extractTimbralDescriptors>;
}

export interface AnalysisFailure {
  id: number;
  error: string;
}

/**
 * The same analysis, on whatever thread the caller is on.
 *
 * The fallback for when no worker can be had: an ingest that is slow beats one
 * that stops. It takes a real AudioBuffer, since the caller already has one.
 */
export function analyseOnThisThread(
  buffer: AudioBuffer,
  name: string,
  index: number
): AnalysisResult {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
  return analyseBuffer({ id: -1, channels, sampleRate: buffer.sampleRate, name, index });
}

/** Run the whole analysis over one sound. Exported so a test can call it. */
export function analyseBuffer(request: AnalysisRequest): AnalysisResult {
  const buffer = bufferLike(request.channels, request.sampleRate) as unknown as AudioBuffer;

  const metrics = calculateAudioMetrics(buffer);
  const features = extractAcousticFeatures(buffer);
  const pitchKey = detectPitchAndKey(buffer);
  const bpm = detectBpm(buffer);
  const loopAnalysis = detectLoopVsOneShot(buffer, request.name, bpm, metrics.sustainFactor);
  const slices = detectAutoSlices(buffer, { sensitivity: 0.6, minSliceDurationMs: 120 });
  const classification = classifySample(buffer, request.name, metrics, slices.length);
  const genre = classifyGenre(classification.type, bpm, metrics, request.name);
  const ep133Slot = assignEp133Slot(classification.type, loopAnalysis.isLoop, request.index);
  const timbralTags = extractTimbralDescriptors(metrics, features);

  return {
    id: request.id,
    metrics,
    features,
    pitchKey,
    bpm,
    loopAnalysis,
    slices,
    classification,
    genre,
    ep133Slot,
    timbralTags,
  };
}

// Only wire the message handler when actually running as a worker; the module
// is also imported by the pool and by tests, where `self` is a window.
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
    try {
      self.postMessage(analyseBuffer(event.data));
    } catch (error) {
      const failure: AnalysisFailure = {
        id: event.data?.id ?? -1,
        error: error instanceof Error ? error.message : String(error),
      };
      self.postMessage(failure);
    }
  };
}
