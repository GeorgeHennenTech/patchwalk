// React glue for the practice synth: one state object, one engine, and a record of what the learner has
// done since the current lesson step began.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "../course/types";
import { Engine } from "./engine";
import { INITIAL, type SynthState } from "./params";
import { newTrack, snapshot, trackAllReleased, trackFlag, trackNoteOn, trackState, type Track } from "./tracker";

/** Computer-keyboard layout: A S D F G H J K are white keys from C, the row above gives the black keys. */
export const KEY_MAP: Record<string, number> = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72 };

/** How far Z and X can move the computer keyboard, in octaves either way. */
export const KEY_OCTAVES = 3;
export const shiftOctave = (now: number, by: 1 | -1) => Math.min(KEY_OCTAVES, Math.max(-KEY_OCTAVES, now + by));

export function useSynth() {
  const engine = useRef<Engine | null>(null);
  const [state, setStateRaw] = useState<SynthState>(INITIAL);
  const stateRef = useRef(state);
  const [running, setRunning] = useState(false);
  const [held, setHeld] = useState<number[]>([]);
  const [holdOn, setHoldOn] = useState(false);
  const holdRef = useRef(false);
  const down = useRef(new Set<number>()); // keys physically pressed
  // Z and X shift the computer keyboard down and up an octave. Each held letter remembers the note it started.
  const [keyOctave, setKeyOctave] = useState(0);
  const keyOctaveRef = useRef(0);
  const letters = useRef(new Map<string, number>());
  const track = useRef<Track>(newTrack(INITIAL));
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);
  const now = () => performance.now() / 1000;

  const setState = useCallback((patch: Partial<SynthState>) => {
    const prev = stateRef.current, next = { ...prev, ...patch };
    stateRef.current = next;
    track.current = trackState(track.current, prev, next);
    engine.current?.update(next);
    setStateRaw(next);
  }, []);

  const start = useCallback(async () => {
    engine.current ??= new Engine(stateRef.current);
    await engine.current.start();
    setRunning(engine.current.running);
  }, []);

  const sync = () => {
    const h = engine.current?.held ?? [];
    setHeld(h);
    if (h.length === 0) track.current = trackAllReleased(track.current);
  };

  const noteOn = useCallback((note: number, source: "mouse" | "keys" | "midi") => {
    if (!engine.current?.running) return;
    down.current.add(note);
    // With Hold on, a new note replaces whatever was latched.
    if (holdRef.current) for (const n of engine.current.held) if (n !== note) engine.current.noteOff(n);
    engine.current.noteOn(note);
    track.current = trackNoteOn(track.current, source, note, now());
    sync();
  }, []);

  const noteOff = useCallback((note: number) => {
    down.current.delete(note);
    if (holdRef.current) return;
    engine.current?.noteOff(note);
    sync();
  }, []);

  const setHold = useCallback((on: boolean) => {
    holdRef.current = on;
    setHoldOn(on);
    if (!on) {
      for (const n of engine.current?.held ?? []) if (!down.current.has(n)) engine.current?.noteOff(n);
      sync();
    }
  }, []);

  const flag = useCallback((name: string) => { track.current = trackFlag(track.current, name); refresh(); }, []);

  /** Begin a new lesson step: forget what was done before and optionally load settings. */
  const beginStep = useCallback((preset?: Partial<SynthState>) => {
    if (preset) {
      const next = { ...stateRef.current, ...preset };
      stateRef.current = next;
      engine.current?.update(next);
      setStateRaw(next);
    }
    const last = track.current.lastNote;
    track.current = { ...newTrack(stateRef.current), lastNote: last };
    if ((engine.current?.held.length ?? 0) > 0) track.current = { ...track.current, heldSince: now() };
    refresh();
  }, []);

  const reset = useCallback((to: SynthState) => {
    engine.current?.allNotesOff();
    holdRef.current = false;
    setHoldOn(false);
    setHeld([]);
    stateRef.current = to;
    engine.current?.update(to);
    setStateRaw(to);
    track.current = newTrack(to);
  }, []);

  // Computer keyboard
  useEffect(() => {
    // Letters typed into a text box must not play notes; sliders and checkboxes do not count as typing.
    const typing = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el instanceof HTMLElement && el.isContentEditable)) return true;
      return el instanceof HTMLInputElement && !["range", "checkbox", "radio", "button"].includes(el.type);
    };
    const onDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
      if (key === "z" || key === "x") {
        keyOctaveRef.current = shiftOctave(keyOctaveRef.current, key === "x" ? 1 : -1);
        setKeyOctave(keyOctaveRef.current);
        return;
      }
      const base = KEY_MAP[key];
      if (base === undefined) return;
      const note = base + 12 * keyOctaveRef.current;
      letters.current.set(key, note);
      noteOn(note, "keys");
    };
    const onUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase(), note = letters.current.get(key);
      if (note === undefined) return;
      letters.current.delete(key);
      noteOff(note);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [noteOn, noteOff]);

  // Silence on unmount so sound never outlives the lesson screen.
  useEffect(() => () => { engine.current?.allNotesOff(); void engine.current?.ctx.suspend(); }, []);

  const snap = (): Snapshot => snapshot(track.current, stateRef.current, { audioRunning: running, held, holdOn, now: now() });

  return { keyOctave, state, setState, running, start, held, holdOn, setHold, noteOn, noteOff, flag, beginStep, reset, snap, engine };
}
export type Synth = ReturnType<typeof useSynth>;
