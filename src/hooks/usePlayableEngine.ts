/**
 * Makes the engines playable: the computer keyboard and a MIDI controller both
 * drive the same instrument, and the notes being held are reported back so the
 * interface can light them up.
 *
 * MIDI used to be wired inside the Creator window and died with it; the typing
 * keyboard was not wired at all. Both live here now, so any part of the
 * interface can offer a playable engine.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { synthRackEngine } from '../services/synthRackEngine';
import { clampOctave, DEFAULT_OCTAVE, noteForKey, shouldPlay } from '../services/playableKeys';

/** What the browser exposes for a MIDI port, without pulling in the DOM lib. */
interface MidiInputLike {
  name?: string;
  onmidimessage: ((event: { data: Uint8Array }) => void) | null;
}
interface MidiAccessLike {
  inputs: { values: () => IterableIterator<MidiInputLike> };
}

/** Which keyboard plays the engines. Only one is bound at a time. */
export type PlayInput = 'pc' | 'midi';

export interface PlayableEngine {
  /** MIDI notes currently held, from either keyboard. */
  heldNotes: Set<number>;
  octave: number;
  setOctave: (octave: number) => void;
  /** Play a note by hand, for a clickable key. */
  press: (note: number, velocity?: number) => void;
  release: (note: number) => void;
  /** What to tell the user about their controller. */
  midiStatus: string;
  input: PlayInput;
  setInput: (input: PlayInput) => void;
}

/**
 * Bind the keyboards to the engine while `active` is true.
 *
 * Nothing is bound when inactive, so the space bar and the library shortcuts
 * keep working normally with the engines folded away.
 */
export function usePlayableEngine(
  active: boolean,
  /**
   * The live rack, when there is one. Its sources are gated, so the keyboard
   * has to reach them too — otherwise adding an oscillator to the chain gives
   * a module that can be seen but never played.
   */
  rack?: { noteOn: (note: number, velocity: number) => void; noteOff: (note: number) => void }
): PlayableEngine {
  // One keyboard at a time: a controller plugged in should not double every
  // note with the typing keys, and vice versa.
  const [input, setInput] = useState<PlayInput>('pc');
  const [heldNotes, setHeldNotes] = useState<Set<number>>(new Set());
  const [octave, setOctaveState] = useState(DEFAULT_OCTAVE);
  const [midiStatus, setMidiStatus] = useState('MIDI non connecté');

  // Which note each physical key started, so releasing after an octave change
  // stops the note that was actually sounded.
  const keyNotesRef = useRef(new Map<string, number>());

  // Kept in a ref so binding the keyboard does not depend on the rack object
  // being stable across renders.
  const rackRef = useRef(rack);
  rackRef.current = rack;

  const press = useCallback((note: number, velocity = 100) => {
    synthRackEngine.noteOn(note, velocity);
    rackRef.current?.noteOn(note, velocity);
    setHeldNotes((prev) => {
      if (prev.has(note)) return prev;
      const next = new Set(prev);
      next.add(note);
      return next;
    });
  }, []);

  const release = useCallback((note: number) => {
    synthRackEngine.noteOff(note);
    rackRef.current?.noteOff(note);
    setHeldNotes((prev) => {
      if (!prev.has(note)) return prev;
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, []);

  const setOctave = useCallback((next: number) => setOctaveState(clampOctave(next)), []);

  // --- the typing keyboard -------------------------------------------------
  useEffect(() => {
    if (!active || input !== 'pc') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldPlay(event)) return;
      const note = noteForKey(event.code, octave);
      if (note === undefined) return;
      event.preventDefault();
      keyNotesRef.current.set(event.code, note);
      press(note);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const note = keyNotesRef.current.get(event.code);
      if (note === undefined) return;
      keyNotesRef.current.delete(event.code);
      release(note);
    };

    // Losing focus mid-chord would otherwise leave the notes sounding forever.
    const onBlur = () => {
      for (const note of keyNotesRef.current.values()) release(note);
      keyNotesRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      onBlur();
    };
  }, [active, input, octave, press, release]);

  // --- the MIDI controller -------------------------------------------------
  useEffect(() => {
    if (!active || input !== 'midi') return;
    if (!('requestMIDIAccess' in navigator)) {
      setMidiStatus('MIDI indisponible dans cet environnement');
      return;
    }
    let access: MidiAccessLike | undefined;
    let cancelled = false;

    const connect = async () => {
      try {
        const request = (navigator as unknown as {
          requestMIDIAccess: () => Promise<MidiAccessLike>;
        }).requestMIDIAccess;
        access = await request.call(navigator);
        if (cancelled) return;
        const inputs = [...access.inputs.values()];
        setMidiStatus(
          inputs.length
            ? `MIDI : ${inputs.map((input) => input.name || 'entrée').join(', ')}`
            : 'MIDI connecté — aucun clavier détecté'
        );
        for (const input of inputs) {
          input.onmidimessage = (event) => {
            const [status, note, velocity = 0] = event.data;
            const command = status & 0xf0;
            if (command === 0x90 && velocity > 0) press(note, velocity);
            else if (command === 0x80 || (command === 0x90 && velocity === 0)) release(note);
          };
        }
      } catch {
        if (!cancelled) setMidiStatus('MIDI refusé ou indisponible');
      }
    };
    void connect();

    return () => {
      cancelled = true;
      if (access) for (const input of access.inputs.values()) input.onmidimessage = null;
    };
  }, [active, input, press, release]);

  // Everything stops when the section folds away or the app moves on.
  useEffect(() => {
    if (active) return;
    synthRackEngine.allNotesOff();
    keyNotesRef.current.clear();
    setHeldNotes(new Set());
  }, [active]);

  // Swapping keyboards mid-chord would otherwise leave those notes sounding.
  useEffect(() => {
    synthRackEngine.allNotesOff();
    keyNotesRef.current.clear();
    setHeldNotes(new Set());
  }, [input]);

  return { heldNotes, octave, setOctave, press, release, midiStatus, input, setInput };
}
