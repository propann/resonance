/**
 * The live rack, detached from the window that used to own it.
 *
 * The chain, its audition and the way it follows the store were written inside
 * `RackHostModal`, so hearing an effect meant opening a window over the app.
 * The behaviour is unchanged here — a structural edit rebuilds the chain, a
 * parameter change is patched in place so the sound never gaps — but any part
 * of the interface can now host it, which is what lets the rack live in a
 * column beside the waveform instead of on top of it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioGraph } from '../services/audioGraph';
import { Rack, renderRackOffline } from './Rack';
import { listModuleDefs } from './registry';
import { useRackStore } from '../stores/rackStore';
import type { ParamValues, RackState } from './types';

/** How long a chain that makes its own sound plays and bounces for. */
export const SYNTH_AUDITION_SEC = 4;

/** What a rebuild has to react to: modules, their order, and which are on. */
function structureKey(state: RackState): string {
  return state.modules.map((m) => `${m.id}:${m.type}:${m.enabled ? 1 : 0}`).join('|');
}

/**
 * What the rack plays through. With a sound engine in the chain the carrier is
 * stretched to at least `SYNTH_AUDITION_SEC`: otherwise a half-second sample
 * cuts the engine off after half a second, and the synth is inaudible.
 */
export function buildCarrier(
  ctx: BaseAudioContext,
  sampleBuffer: AudioBuffer | undefined,
  hasSource: boolean
): AudioBuffer | null {
  if (!sampleBuffer) {
    if (!hasSource) return null;
    return ctx.createBuffer(2, Math.floor(ctx.sampleRate * SYNTH_AUDITION_SEC), ctx.sampleRate);
  }
  if (!hasSource || sampleBuffer.duration >= SYNTH_AUDITION_SEC) return sampleBuffer;

  const length = Math.floor(ctx.sampleRate * SYNTH_AUDITION_SEC);
  const carrier = ctx.createBuffer(sampleBuffer.numberOfChannels, length, sampleBuffer.sampleRate);
  for (let channel = 0; channel < sampleBuffer.numberOfChannels; channel++) {
    carrier.getChannelData(channel).set(sampleBuffer.getChannelData(channel));
  }
  return carrier;
}

export interface LiveRack {
  isPlaying: boolean;
  /** Play the chain, or stop it if it is already playing. */
  toggle: () => void;
  stop: () => void;
  loop: boolean;
  setLoop: (value: boolean) => void;
  /** True when the chain makes its own sound and needs no sample loaded. */
  hasSourceModule: boolean;
  /** Nothing to play: no sample selected and no engine in the chain. */
  isSilent: boolean;
  /** Bounce the chain to a buffer, for saving it as a new sample. */
  render: (tailSec?: number) => Promise<AudioBuffer | null>;
  /** Seconds since the audition started, for a playhead. */
  elapsed: () => number;
}

/**
 * Hold a live rack for as long as `active` is true.
 *
 * @param sample what the chain processes; a chain with its own engine plays
 *   without one.
 * @param active false disposes the chain and frees its nodes.
 */
export function useLiveRack(
  sampleBuffer: AudioBuffer | undefined,
  active: boolean
): LiveRack {
  const rack = useRackStore((s) => s.rack);

  const rackRef = useRef<Rack | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const lastStructRef = useRef<string | null>(null);
  const lastParamsRef = useRef<Record<string, ParamValues>>({});
  // Serialises rebuilds so overlapping edits cannot race each other.
  const syncChainRef = useRef<Promise<void>>(Promise.resolve());
  const playStartRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  // Off by default: nothing in the app starts looping on its own.
  const [loop, setLoop] = useState(false);

  const hasSourceModule = useMemo(() => {
    const defs = listModuleDefs();
    return rack.modules.some(
      (m) => m.enabled && defs.find((d) => d.type === m.type)?.kind === 'source'
    );
  }, [rack.modules]);

  const isSilent = !sampleBuffer && !hasSourceModule;

  const stop = useCallback(() => {
    if (srcRef.current) {
      try {
        srcRef.current.onended = null;
        srcRef.current.stop();
        srcRef.current.disconnect();
      } catch {
        /* already stopped */
      }
      srcRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const start = useCallback(() => {
    const r = rackRef.current;
    if (!r) return;
    const ctx = audioGraph.getContext();
    const carrier = buildCarrier(ctx, sampleBuffer, hasSourceModule);
    if (!carrier) return;
    stop();
    const src = ctx.createBufferSource();
    src.buffer = carrier;
    src.loop = loop;
    src.connect(r.input);
    src.onended = () => {
      if (srcRef.current === src) {
        srcRef.current = null;
        setIsPlaying(false);
      }
    };
    src.start();
    playStartRef.current = ctx.currentTime;
    srcRef.current = src;
    setIsPlaying(true);
  }, [sampleBuffer, loop, stop, hasSourceModule]);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else start();
  }, [isPlaying, start, stop]);

  // Create / dispose the chain. It is built empty; the sync effect below fills
  // it from the store.
  useEffect(() => {
    if (!active) return;
    const r = new Rack(audioGraph.getContext());
    r.output.connect(audioGraph.getMasterInput());
    rackRef.current = r;
    lastStructRef.current = null;
    lastParamsRef.current = {};
    syncChainRef.current = Promise.resolve();

    return () => {
      stop();
      r.dispose();
      rackRef.current = null;
    };
  }, [active, stop]);

  // Follow the store: rebuild on a structural change, otherwise patch the
  // changed parameters in place — no rebuild, no audio gap.
  useEffect(() => {
    const r = rackRef.current;
    if (!r || !active) return;

    const nextStruct = structureKey(rack);
    if (nextStruct !== lastStructRef.current) {
      lastStructRef.current = nextStruct;
      const snapshot = rack;
      syncChainRef.current = syncChainRef.current
        .then(() => r.setState(snapshot))
        .then(() => {
          // Re-apply whatever the store holds *now*: a slider may have been
          // dragged while the async rebuild was in flight.
          const current = useRackStore.getState().rack;
          const next: Record<string, ParamValues> = {};
          for (const m of current.modules) {
            r.updateModuleParams(m.id, m.params);
            next[m.id] = { ...m.params };
          }
          lastParamsRef.current = next;
        })
        .catch((error) => console.error('[rack] sync failed', error));
      return;
    }

    for (const m of rack.modules) {
      const prev = lastParamsRef.current[m.id];
      const changed: ParamValues = {};
      for (const key of Object.keys(m.params)) {
        if (!prev || m.params[key] !== prev[key]) changed[key] = m.params[key];
      }
      if (Object.keys(changed).length > 0) r.updateModuleParams(m.id, changed);
      lastParamsRef.current[m.id] = { ...m.params };
    }
  }, [rack, active]);

  const render = useCallback(
    async (tailSec?: number): Promise<AudioBuffer | null> => {
      const ctx = audioGraph.getContext();
      const carrier = buildCarrier(ctx, sampleBuffer, hasSourceModule);
      if (!carrier) return null;
      const tail =
        tailSec ??
        (rack.modules.some((m) => m.enabled && (m.type === 'fx.delay' || m.type === 'fx.reverb'))
          ? 2
          : 0);
      return renderRackOffline(rack, carrier, tail);
    },
    [rack, sampleBuffer, hasSourceModule]
  );

  const elapsed = useCallback(
    () => audioGraph.getContext().currentTime - playStartRef.current,
    []
  );

  return { isPlaying, toggle, stop, loop, setLoop, hasSourceModule, isSilent, render, elapsed };
}
