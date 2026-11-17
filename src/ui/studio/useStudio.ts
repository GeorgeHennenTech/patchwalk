// The Studio's state: the song, the transport that plays it, and the learner's own sounds.
import { useCallback, useEffect, useRef, useState } from "react";
import { Transport, type Loop } from "../../daw/transport";
import { STARTERS } from "../../daw/drums";
import { addClip, dropSongSample, duplicateClip, newSong, putNote, renameSamples, samplesUsed, withPattern, type Song } from "../../daw/song";
import { loadRacks, loadSong, loadSongs, loadWork, storeRacks, storeSongs } from "../../daw/store";
import { fromBase64, libGet, libList, shareSound, soundHash } from "../../guide/library";
import { checkFile, deleteSample, listSamples, putSample, sampleName } from "../../daw/samples";

export interface SampleInfo { id: string; name: string }

/** The song a first visit starts with: two bars of drums (the pattern from before the Studio had tracks, if there is one) and a held chord. */
export function firstSong(): Song {
  let s = newSong("My first song");
  const pattern = loadWork() ?? STARTERS[0]!, drums = s.tracks[0]!, pad = s.tracks[1]!;
  const a = addClip(s, drums.id, 0)!;
  s = withPattern({ ...a.song, bpm: pattern.bpm, swing: pattern.swing }, drums.id, a.clip, pattern);
  s = duplicateClip(s, drums.id, a.clip)?.song ?? s;
  const b = addClip(s, pad.id, 0)!;
  s = b.song;
  for (const note of [57, 60, 64]) s = putNote(s, pad.id, b.clip, { note, start: 0, length: 16, velocity: 90 });
  return { ...s, tracks: s.tracks.map((t) => (t.kind === "synth" ? { ...t, patch: { ...t.patch, bpm: s.bpm } } : t)) };
}

export function useStudio() {
  const [song, setSong] = useState<Song>(() => loadSong() ?? firstSong());
  const now = useRef(song);
  const transport = useRef<Transport | null>(null);
  if (!transport.current) {
    transport.current = new Transport(() => now.current);
    if (import.meta.env.DEV) (window as unknown as { __patchwalkTransport?: Transport }).__patchwalkTransport = transport.current;
  }
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  // Undo: the songs before each change. Changes that follow each other within half a second (a slider being
  // dragged, a row being painted) count as one.
  const past = useRef<Song[]>([]), future = useRef<Song[]>([]), lastChange = useRef(0);
  const [, bump] = useState(0);
  const put = useCallback((after: Song) => {
    const before = now.current;
    now.current = after;
    if (before.bpm !== after.bpm || before.swing !== after.swing) transport.current!.retime(before);
    transport.current!.sync();
    setSong(after);
  }, []);
  const change = useCallback((next: Song | ((s: Song) => Song)) => {
    const before = now.current, after = typeof next === "function" ? next(before) : next;
    if (after === before) return;
    const t = performance.now();
    if (t - lastChange.current > 500) { past.current.push(before); if (past.current.length > 100) past.current.shift(); }
    lastChange.current = t; future.current = [];
    put(after); bump((n) => n + 1);
  }, [put]);
  /** The next change is its own step to undo, however soon after the last one it comes (a command, not a drag). */
  const mark = useCallback(() => { lastChange.current = 0; }, []);
  const undo = useCallback(() => { const prev = past.current.pop(); if (!prev) return; future.current.push(now.current); lastChange.current = 0; put(prev); bump((n) => n + 1); }, [put]);
  const redo = useCallback(() => { const next = future.current.pop(); if (!next) return; past.current.push(now.current); lastChange.current = 0; put(next); bump((n) => n + 1); }, [put]);
  const toggle = useCallback(() => {
    const t = transport.current!;
    if (t.playing) { t.stop(); setPlaying(false); setStep(-1); } else { t.start(); setPlaying(true); }
  }, []);
  /** Play from a step of the song (stopping first if it is playing). */
  const playFrom = useCallback((from: number) => { const t = transport.current!; if (t.playing) t.stop(); t.start(from); setPlaying(true); }, []);
  const setLoop = useCallback((loop: Loop | undefined) => { transport.current!.loop = loop; }, []);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => { setStep(transport.current!.step()); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => () => { transport.current?.stop(); }, []);

  // the learner's own sounds: read from this browser's storage once, decoded so they can be struck
  const [samples, setSamples] = useState<SampleInfo[]>([]);
  useEffect(() => {
    let live = true;
    listSamples().then(async (all) => {
      const ok: SampleInfo[] = [], renamed: Record<string, string> = {};
      for (const s of all) {
        try {
          // a sound kept before ids were made from the file's bytes is moved to such an id, so every browser and the library agree on it
          let id = s.id;
          if (!id.startsWith("h")) { id = await soundHash(s.bytes); await putSample({ ...s, id }); await deleteSample(s.id); renamed[s.id] = id; void shareSound(s.name, s.bytes); }
          await transport.current!.load(id, s.bytes); if (!ok.some((x) => x.id === id)) ok.push({ id, name: s.name });
        } catch { /* a file the browser can no longer read is left out */ }
      }
      if (Object.keys(renamed).length) {
        storeSongs(loadSongs().map((x) => renameSamples(x, renamed)));
        storeRacks(loadRacks().map((r) => ({ ...r, pads: r.pads.map((p) => (p.sample && renamed[p.sample] ? { ...p, sample: renamed[p.sample]! } : p)) })));
        if (live) put(renameSamples(now.current, renamed));
      }
      if (live) { setSamples(ok); setLoaded(true); }
    }).catch(() => { if (live) setLoaded(true); /* no storage here: built-in drums still work */ });
    return () => { live = false; };
  }, [put]);
  // A pad whose sound is not in this browser (a song, rack or break from the library, or from another
  // computer): fetch the file from the library once, keep it here, and the pad plays it.
  const [loaded, setLoaded] = useState(false);
  const asked = useRef(new Set<string>());
  const wanted = samplesUsed(song).filter((id) => id.startsWith("h") && !samples.some((s) => s.id === id)).join(",");
  useEffect(() => {
    if (!loaded || !wanted) return;
    const ids = wanted.split(",").filter((id) => !asked.current.has(id));
    if (!ids.length) return;
    ids.forEach((id) => asked.current.add(id));
    let live = true;
    void (async () => {
      const names = await libList("sound");
      for (const id of ids) {
        const data = await libGet("sound", id);
        if (typeof data !== "string") continue;
        try {
          const bytes = fromBase64(data), name = (names.ok ? names.value.items.find((e) => e.id === id)?.name : undefined) ?? "Sound";
          await transport.current!.load(id, bytes);
          await putSample({ id, name, bytes, added: Date.now() }).catch(() => undefined);
          if (live) setSamples((list) => (list.some((s) => s.id === id) ? list : [...list, { id, name }]));
        } catch { /* not a sound the browser can read: the built-in drum plays */ }
      }
    })();
    return () => { live = false; };
  }, [loaded, wanted]);
  /** Take in a sound file. Throws an Error whose message can be shown. */
  const addSample = useCallback(async (file: File, have: number): Promise<SampleInfo & { /** what became of saving it to the library, as a line to show */ shared: Promise<string> }> => {
    const no = checkFile(file.name, file.type, file.size, have);
    if (no) throw new Error(no);
    const bytes = await file.arrayBuffer(), id = await soundHash(bytes);
    try { await transport.current!.load(id, bytes); } catch { throw new Error("The browser could not read that file as sound. Try saving it as a WAV."); }
    const info = { id, name: sampleName(file.name) };
    try { await putSample({ ...info, bytes, added: Date.now() }); } catch { transport.current!.forget(id); throw new Error("The browser would not store the file (its storage may be full or switched off)."); }
    setSamples((list) => (list.some((s) => s.id === id) ? list : [...list, info]));
    return { ...info, shared: shareSound(info.name, bytes) };
  }, []);
  const removeSample = useCallback((id: string) => {
    transport.current!.forget(id); void deleteSample(id).catch(() => undefined);
    setSamples((list) => list.filter((s) => s.id !== id));
    change((s) => dropSongSample(s, id));
  }, [change]);
  return { mark, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0, song, change, playing, toggle, playFrom, step, setLoop, transport: transport.current!, samples, addSample, removeSample };
}
export type Studio = ReturnType<typeof useStudio>;
