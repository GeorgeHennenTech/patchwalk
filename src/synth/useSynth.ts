// React glue for the practice synth: one state object, one engine, and a record of what the learner has
// done since the current lesson step began.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "../course/types";
import { modulated } from "./mod";
import { Engine } from "./engine";
import { arpCycle, arpStepSeconds, nextArpTime } from "./arp";
import { applyMacros } from "./macros";
import { INITIAL, type SynthState } from "./params";
import { newTrack, snapshot, trackAllReleased, trackFlag, trackNoteOn, trackState, type Track } from "./tracker";

/** Computer-keyboard layout: A S D F G H J K are white keys from C, the row above gives the black keys. */
export const KEY_MAP: Record<string, number> = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72 };

/** How far Z and X can move the computer keyboard, in octaves either way. */
export const KEY_OCTAVES = 3;
/** C and V step the computer keyboard's velocity by this much, between 20 and 127. */
export const VELOCITY_STEP = 20;
export const shiftVelocity = (now: number, by: 1 | -1) => Math.min(127, Math.max(20, now === 127 && by === -1 ? 120 : now + by * VELOCITY_STEP));
/** Where on a key it was clicked, from its top (0) to its bottom (1), as a velocity: lower down is harder. */
export const clickVelocity = (y: number) => Math.round(Math.min(127, Math.max(20, 20 + Math.min(1, Math.max(0, y)) * 107)));
export const shiftOctave = (now: number, by: 1 | -1) => Math.min(KEY_OCTAVES, Math.max(-KEY_OCTAVES, now + by));

/** What a message from a MIDI keyboard means to the synth, or null when it is one we do not use. */
export type MidiEvent = { type: "on"; note: number; velocity: number } | { type: "off"; note: number } | { type: "wheel"; value: number } | { type: "bend"; value: number };
export function midiMessage(data: ArrayLike<number>): MidiEvent | null {
  const kind = (data[0] ?? 0) & 0xf0, a = data[1] ?? 0, b = data[2] ?? 0;
  if (kind === 0x90 && b > 0) return { type: "on", note: a, velocity: b };
  if (kind === 0x80 || kind === 0x90) return { type: "off", note: a };
  // controller 1 is the mod wheel on every keyboard
  if (kind === 0xb0 && a === 1) return { type: "wheel", value: Math.round((b / 127) * 100) };
  // pitch bend is fourteen bits with the centre at 8192; the top is 16383, so the two halves are scaled apart
  if (kind === 0xe0) { const v = (b << 7) | a; return { type: "bend", value: v >= 8192 ? (v - 8192) / 8191 : (v - 8192) / 8192 }; }
  return null;
}
export type MidiStatus = "off" | "unsupported" | "refused" | "none" | "on";

/**
 * `host` lets something else own the engine and the settings (a track in the Studio): the hook then plays
 * and edits that engine, reports every change of settings, and leaves the engine running when it goes.
 */
export function useSynth(host?: { engine: Engine; initial: SynthState; onChange: (s: SynthState) => void }) {
  const engine = useRef<Engine | null>(host?.engine ?? null);
  const hostRef = useRef(host);
  hostRef.current = host;
  const [state, setStateRaw] = useState<SynthState>(host?.initial ?? INITIAL);
  const stateRef = useRef(state);
  const [running, setRunning] = useState(() => host?.engine.running ?? false);
  const [held, setHeld] = useState<number[]>([]);
  const [holdOn, setHoldOn] = useState(false);
  const holdRef = useRef(false);
  const down = useRef(new Set<number>()); // keys physically pressed
  // Z and X shift the computer keyboard down and up an octave. Each held letter remembers the note it started.
  const [keyOctave, setKeyOctave] = useState(0);
  const keyOctaveRef = useRef(0);
  const letters = useRef(new Map<string, number>());
  // C and V make the computer keyboard strike softer and harder; the on-screen keys go by where you click.
  const [keyVelocity, setKeyVelocity] = useState(100);
  const keyVelocityRef = useRef(100);
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
    hostRef.current?.onChange(next);
  }, []);

  const start = useCallback(async () => {
    engine.current ??= new Engine(stateRef.current);
    await engine.current.start();
    // In development only: lets an automated test listen to what is really playing.
    if (import.meta.env.DEV) (window as unknown as { __patchwalkEngine?: Engine }).__patchwalkEngine = engine.current;
    setRunning(engine.current.running);
  }, []);

  const sync = () => {
    const h = engine.current?.held ?? [];
    setHeld(h);
    if (h.length === 0) track.current = trackAllReleased(track.current, now());
  };

  // ---- arpeggiator: held keys are kept here and played one at a time on the tempo clock's grid.
  // Steps are scheduled on the audio clock a little ahead of time, so they land exactly on the grid.
  const arpKeys = useRef<number[]>([]);
  const arp = useRef<{ timer?: ReturnType<typeof setInterval>; next: number; index: number; velocity: number; shows: ReturnType<typeof setTimeout>[] }>({ next: 0, index: 0, velocity: 100, shows: [] });
  const arpStop = useCallback(() => {
    const a = arp.current;
    if (a.timer) clearInterval(a.timer);
    a.shows.forEach(clearTimeout);
    arp.current = { next: 0, index: 0, velocity: a.velocity, shows: [] };
    setHeld(engine.current?.held ?? []);
  }, []);
  const arpTick = useCallback(() => {
    const eng = engine.current, a = arp.current, st = stateRef.current;
    if (!eng || st.arpOn !== "on" || !arpKeys.current.length) { if (st.arpOn !== "on") arpKeys.current = []; arpStop(); return; }
    const step = arpStepSeconds(st.bpm, st.arpDiv), now = eng.ctx.currentTime;
    if (a.next < now - step) a.next = nextArpTime(now, step); // fell behind (a background tab): pick the grid up again
    while (a.next < now + 0.12) {
      const cycle = arpCycle(arpKeys.current, st.arpMode, st.arpOctaves), note = cycle[a.index % cycle.length]!, at = a.next, length = step * (st.arpGate / 100);
      eng.playAt(note, at, length, a.velocity);
      // light the key while its note sounds
      a.shows.push(setTimeout(() => setHeld([note]), Math.max(0, (at - now) * 1000)), setTimeout(() => setHeld((h) => (h.length === 1 && h[0] === note ? [] : h)), Math.max(0, (at + length - now) * 1000)));
      if (a.shows.length > 64) a.shows.splice(0, a.shows.length - 64);
      a.index = (a.index + 1) % cycle.length; a.next = at + step;
    }
  }, [arpStop]);
  useEffect(() => () => { if (arp.current.timer) clearInterval(arp.current.timer); arp.current.shows.forEach(clearTimeout); }, []);
  const arpStart = useCallback(() => {
    const eng = engine.current, a = arp.current;
    if (!eng || a.timer) return;
    a.index = 0; a.next = nextArpTime(eng.ctx.currentTime + 0.01, arpStepSeconds(stateRef.current.bpm, stateRef.current.arpDiv));
    a.timer = setInterval(arpTick, 25);
    arpTick();
  }, [arpTick]);

  const noteOn = useCallback((note: number, source: "mouse" | "keys" | "midi", velocity = 100) => {
    if (!engine.current?.running) return;
    if (stateRef.current.arpOn === "on") {
      // with Hold on, a fresh press (nothing else down) starts a new set of latched keys
      if (holdRef.current && down.current.size === 0) arpKeys.current = [];
      down.current.add(note);
      if (!arpKeys.current.includes(note)) arpKeys.current = [...arpKeys.current, note];
      arp.current.velocity = velocity;
      track.current = trackNoteOn(track.current, source, note, now(), velocity);
      arpStart();
      return;
    }
    down.current.add(note);
    // With Hold on, a new note replaces whatever was latched.
    // (in mono the engine does the replacing itself, so that legato and glide still work with Hold on)
    const mono = stateRef.current.voiceMode === "mono";
    if (holdRef.current && !mono) for (const n of engine.current.held) if (n !== note) engine.current.noteOff(n);
    engine.current.noteOn(note, velocity, holdRef.current && mono && down.current.size <= 1);
    track.current = trackNoteOn(track.current, source, note, now(), velocity);
    sync();
  }, []);

  const noteOff = useCallback((note: number) => {
    down.current.delete(note);
    if (holdRef.current) return;
    if (stateRef.current.arpOn === "on" || arpKeys.current.length) {
      arpKeys.current = arpKeys.current.filter((n) => n !== note);
      if (!arpKeys.current.length) { arpStop(); sync(); }
      return;
    }
    engine.current?.noteOff(note);
    sync();
  }, []);

  const setHold = useCallback((on: boolean) => {
    holdRef.current = on;
    setHoldOn(on);
    if (!on) {
      arpKeys.current = arpKeys.current.filter((n) => down.current.has(n));
      if (!arpKeys.current.length && arp.current.timer) arpStop();
      for (const n of engine.current?.held ?? []) if (!down.current.has(n)) engine.current?.noteOff(n);
      sync();
    }
  }, []);

  // The bend wheel is not a setting: it springs back, so it lives here and in the engine, not in the state.
  const [bend, setBendRaw] = useState(0);
  const setBend = useCallback((position: number) => {
    const p = Math.min(1, Math.max(-1, position));
    engine.current?.setBend(p);
    setBendRaw(p);
    if (Math.abs(p) >= 0.9) track.current = trackFlag(track.current, p > 0 ? "bentUp" : "bentDown");
  }, []);

  // A MIDI keyboard, if one is plugged in: notes, the mod wheel and the bend wheel.
  const [midi, setMidi] = useState<{ status: MidiStatus; name?: string }>({ status: "off" });
  const midiHandler = useRef<(e: { data: ArrayLike<number> | null }) => void>(() => {});
  midiHandler.current = (e) => {
    const m = e.data ? midiMessage(e.data) : null;
    if (!m) return;
    if (m.type === "on") noteOn(m.note, "midi", m.velocity);
    else if (m.type === "off") noteOff(m.note);
    else if (m.type === "wheel") setState({ wheel: m.value });
    else setBend(m.value);
  };
  const connectMidi = useCallback(async () => {
    type Input = { name?: string | null; onmidimessage: ((e: { data: ArrayLike<number> | null }) => void) | null };
    type Access = { inputs: { values(): Iterable<Input> }; onstatechange: (() => void) | null };
    const request = (navigator as unknown as { requestMIDIAccess?: () => Promise<Access> }).requestMIDIAccess;
    if (!request) { setMidi({ status: "unsupported" }); return; }
    try {
      const access = await request.call(navigator);
      const attach = () => {
        const inputs = [...access.inputs.values()];
        for (const input of inputs) input.onmidimessage = (e) => midiHandler.current(e);
        setMidi(inputs.length ? { status: "on", name: inputs.map((i) => i.name ?? "MIDI keyboard").join(", ") } : { status: "none" });
      };
      access.onstatechange = attach; // a keyboard plugged in later is picked up
      attach();
    } catch { setMidi({ status: "refused" }); }
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
    engine.current?.setBend(0); setBendRaw(0);
    holdRef.current = false;
    setHoldOn(false);
    setHeld([]);
    stateRef.current = to;
    engine.current?.update(to);
    setStateRaw(to);
    hostRef.current?.onChange(to);
    track.current = newTrack(to);
  }, []);

  // Computer keyboard
  useEffect(() => {
    // Letters typed into a text box must not play notes; sliders and checkboxes do not count as typing.
    const typing = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) return true;
      return el instanceof HTMLInputElement && !["range", "checkbox", "radio", "button"].includes(el.type);
    };
    const onDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
      // a menu that still has focus would otherwise jump to an entry starting with the letter pressed
      const inMenu = e.target instanceof HTMLSelectElement;
      if (inMenu && (key === "z" || key === "x" || key === "c" || key === "v" || KEY_MAP[key] !== undefined)) { e.preventDefault(); e.target.blur(); }
      if (key === "z" || key === "x") {
        const before = keyOctaveRef.current;
        keyOctaveRef.current = shiftOctave(before, key === "x" ? 1 : -1);
        setKeyOctave(keyOctaveRef.current);
        // A note that is sounding moves with the octave straight away: one latched with Hold, or a letter still
        // held down. Otherwise pressing Z or X would seem to do nothing until the next key was played.
        const by = 12 * (keyOctaveRef.current - before), eng = engine.current;
        if (by !== 0 && eng?.running) {
          const moved = new Map<number, number>();
          for (const n of [...eng.held]) { eng.noteOff(n); eng.noteOn(n + by, keyVelocityRef.current); moved.set(n, n + by); }
          for (const [letter, n] of letters.current) if (moved.has(n)) letters.current.set(letter, moved.get(n)!);
          down.current = new Set([...down.current].map((n) => moved.get(n) ?? n));
          if (moved.size) { track.current = { ...track.current, lastNote: [...moved.values()].at(-1)! }; sync(); }
        }
        return;
      }
      if (key === "c" || key === "v") {
        keyVelocityRef.current = shiftVelocity(keyVelocityRef.current, key === "v" ? 1 : -1);
        setKeyVelocity(keyVelocityRef.current);
        return;
      }
      const base = KEY_MAP[key];
      if (base === undefined) return;
      const note = base + 12 * keyOctaveRef.current;
      letters.current.set(key, note);
      noteOn(note, "keys", keyVelocityRef.current);
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
  useEffect(() => () => { if (hostRef.current) { engine.current?.allNotesOff(); return; } engine.current?.dispose(); void engine.current?.ctx.suspend(); }, []);

  /**
   * The settings as they are at this instant, with every source's movement applied: what the pictures and
   * the knobs' moving pointers show. Worked out at most once per frame however many things ask for it.
   */
  const liveCache = useRef<{ at: number; base: SynthState; value: SynthState } | null>(null);
  const live = useCallback((): SynthState => {
    const t = performance.now(), base = stateRef.current, c = liveCache.current;
    if (c && c.base === base && t - c.at < 12) return c.value;
    const value = modulated(applyMacros(base), engine.current?.liveNote, true);
    liveCache.current = { at: t, base, value };
    return value;
  }, []);

  const snap = (): Snapshot => snapshot(track.current, stateRef.current, { audioRunning: running, held, holdOn, now: now() });

  return { bend, setBend, midi, connectMidi, keyOctave, keyVelocity, effective: applyMacros(state), live, state, setState, running, start, held, holdOn, setHold, noteOn, noteOff, flag, beginStep, reset, snap, engine };
}
export type Synth = ReturnType<typeof useSynth>;
