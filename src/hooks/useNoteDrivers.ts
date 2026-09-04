/**
 * Runs the arpeggiator and the step sequencer against the engines.
 *
 * The musical logic is pure and tested in `services/noteDrivers.ts`; this is
 * the clock around it. Steps are scheduled one at a time against the audio
 * context's own clock rather than `setInterval`, which drifts audibly within a
 * few bars — the next step is booked from the time the last one was *meant* to
 * happen, so a slow frame does not push the whole pattern late.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { audioGraph } from '../services/audioGraph';
import { synthRackEngine } from '../services/synthRackEngine';
import {
  arpNoteAt,
  arpOrder,
  emptyPattern,
  stepDurationSec,
  stepNote,
  stepVelocity,
  wrapStep,
  type ArpMode,
  type Step,
} from '../services/noteDrivers';

/** How long a driven note is held, as a fraction of the step. */
const GATE = 0.6;

export interface NoteDrivers {
  arpOn: boolean;
  setArpOn: (on: boolean) => void;
  arpMode: ArpMode;
  setArpMode: (mode: ArpMode) => void;
  arpOctaves: number;
  setArpOctaves: (octaves: number) => void;

  seqOn: boolean;
  setSeqOn: (on: boolean) => void;
  pattern: Step[];
  toggleStep: (index: number) => void;
  /** Which step is sounding, for the strip to light up. -1 when stopped. */
  currentStep: number;

  bpm: number;
  setBpm: (bpm: number) => void;
}

/**
 * @param heldNotes what the keyboards are holding; the arpeggiator walks these.
 * @param root the note the sequencer's offsets are measured from.
 */
export function useNoteDrivers(heldNotes: Set<number>, root: number): NoteDrivers {
  const [arpOn, setArpOn] = useState(false);
  const [arpMode, setArpMode] = useState<ArpMode>('up');
  const [arpOctaves, setArpOctaves] = useState(1);
  const [seqOn, setSeqOn] = useState(false);
  const [pattern, setPattern] = useState<Step[]>(emptyPattern);
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpmState] = useState(120);

  const setBpm = useCallback((next: number) => setBpmState(Math.max(20, Math.min(300, next))), []);
  const toggleStep = useCallback(
    (index: number) =>
      setPattern((prev) =>
        prev.map((step, i) => (i === index ? { ...step, on: !step.on } : step))
      ),
    []
  );

  // Read inside the timer without restarting it on every change.
  const state = useRef({ heldNotes, root, arpOn, arpMode, arpOctaves, seqOn, pattern, bpm });
  state.current = { heldNotes, root, arpOn, arpMode, arpOctaves, seqOn, pattern, bpm };

  const running = arpOn || seqOn;

  useEffect(() => {
    if (!running) {
      setCurrentStep(-1);
      return;
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let index = 0;
    const ctx = audioGraph.getContext();
    let due = ctx.currentTime;
    /** Notes this driver started, so it releases exactly those. */
    const sounding = new Set<number>();

    const releaseAll = () => {
      for (const note of sounding) synthRackEngine.noteOff(note);
      sounding.clear();
    };

    const fire = () => {
      if (stopped) return;
      const s = state.current;
      const stepSec = stepDurationSec(s.bpm);

      releaseAll();

      if (s.arpOn) {
        const order = arpOrder([...s.heldNotes], s.arpMode, s.arpOctaves);
        if (s.arpMode === 'chord') {
          for (const note of order) {
            synthRackEngine.noteOn(note, 100);
            sounding.add(note);
          }
        } else {
          const note = arpNoteAt(order, index, s.arpMode);
          if (note !== undefined) {
            synthRackEngine.noteOn(note, 100);
            sounding.add(note);
          }
        }
      }

      if (s.seqOn) {
        const step = s.pattern[wrapStep(index)];
        const note = stepNote(step, s.root);
        if (note !== undefined && step) {
          synthRackEngine.noteOn(note, stepVelocity(step));
          sounding.add(note);
        }
        setCurrentStep(wrapStep(index));
      } else {
        setCurrentStep(-1);
      }

      // Let go before the next step, so repeated notes retrigger audibly.
      const gate = setTimeout(releaseAll, stepSec * GATE * 1000);

      index += 1;
      due += stepSec;
      // Book against the clock, not against now: a late frame does not shift
      // everything that follows.
      const wait = Math.max(0, (due - ctx.currentTime) * 1000);
      timer = setTimeout(() => {
        clearTimeout(gate);
        fire();
      }, wait);
    };

    fire();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      releaseAll();
      setCurrentStep(-1);
    };
  }, [running]);

  return {
    arpOn,
    setArpOn,
    arpMode,
    setArpMode,
    arpOctaves,
    setArpOctaves,
    seqOn,
    setSeqOn,
    pattern,
    toggleStep,
    currentStep,
    bpm,
    setBpm,
  };
}
