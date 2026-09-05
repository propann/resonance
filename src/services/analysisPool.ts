/**
 * A pool of workers doing the ingest's analysis.
 *
 * One sound at a time on the main thread was costing 8.4 s of every 11.7 s
 * batch, measured on the running app. The work is arithmetic over sample data,
 * so it spreads across cores; the pool hands each free worker the next sound
 * and keeps the rest queued.
 *
 * Channel data is copied before being transferred. Transferring the originals
 * would be cheaper still, but the main thread needs the buffer afterwards to
 * encode the WAV — a detached ArrayBuffer would take that away, and the sound
 * would be written as silence.
 */
import type { AnalysisFailure, AnalysisRequest, AnalysisResult } from './analysisWorker';

/**
 * How many workers to run. One per core, less one for the main thread, which
 * still has decoding and the interface to do; capped because past a handful
 * the copying costs more than the parallelism returns.
 */
export function workerCount(cores = navigator.hardwareConcurrency || 4): number {
  return Math.max(1, Math.min(6, cores - 1));
}

type Pending = {
  resolve: (result: AnalysisResult) => void;
  reject: (error: Error) => void;
};

export class AnalysisPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Array<{ request: AnalysisRequest; transfer: Transferable[] }> = [];
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private broken = false;

  constructor(private readonly size = workerCount()) {}

  /** True once the pool has given up and callers should analyse in-thread. */
  get unavailable(): boolean {
    return this.broken;
  }

  private spawn(): void {
    if (this.workers.length >= this.size || this.broken) return;
    try {
      const worker = new Worker(new URL('./analysisWorker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event: MessageEvent<AnalysisResult | AnalysisFailure>) => {
        const message = event.data;
        const waiting = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (waiting) {
          if ('error' in message) waiting.reject(new Error(message.error));
          else waiting.resolve(message);
        }
        this.idle.push(worker);
        this.drain();
      };
      worker.onerror = (event) => {
        console.error('[analyse] worker en échec, retour au thread principal', event.message);
        // One broken worker means the module did not load; the rest will fail
        // the same way, so the pool stands down rather than stalling the queue.
        this.broken = true;
        for (const [, waiting] of this.pending) waiting.reject(new Error('worker indisponible'));
        this.pending.clear();
        this.dispose();
      };
      this.workers.push(worker);
      this.idle.push(worker);
    } catch (error) {
      console.error('[analyse] impossible de démarrer un worker', error);
      this.broken = true;
    }
  }

  private drain(): void {
    while (this.queue.length > 0 && this.idle.length > 0) {
      const job = this.queue.shift()!;
      const worker = this.idle.pop()!;
      worker.postMessage(job.request, job.transfer);
    }
  }

  /**
   * Analyse one decoded sound. Rejects when no worker can take it, so the
   * caller can fall back to doing the work itself.
   */
  analyse(buffer: AudioBuffer, name: string, index: number): Promise<AnalysisResult> {
    if (this.broken) return Promise.reject(new Error('pool indisponible'));
    while (this.workers.length < this.size) this.spawn();
    if (this.workers.length === 0) return Promise.reject(new Error('pool indisponible'));

    // A copy per channel: the main thread keeps its own buffer for the encode.
    const channels: Float32Array[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channels.push(new Float32Array(buffer.getChannelData(c)));
    }

    const id = this.nextId++;
    const request: AnalysisRequest = {
      id,
      channels,
      sampleRate: buffer.sampleRate,
      name,
      index,
    };
    const transfer = channels.map((c) => c.buffer);

    return new Promise<AnalysisResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.queue.push({ request, transfer });
      this.drain();
    });
  }

  dispose(): void {
    for (const worker of this.workers) worker.terminate();
    this.workers = [];
    this.idle = [];
    this.queue = [];
  }
}

let shared: AnalysisPool | null = null;

/** The pool the ingest uses. Built on first call, kept for the session. */
export function analysisPool(): AnalysisPool {
  if (!shared) shared = new AnalysisPool();
  return shared;
}
