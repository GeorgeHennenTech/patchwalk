// The Library tab: everything people on this site have kept for each other. Walkthroughs the guide has
// written, and what has been made in the Studio: sound files, breaks, drum racks and songs.
import { useCallback, useEffect, useRef, useState } from "react";
import { WalkLibrary } from "./Walkthrough";
import { fromBase64, libGet, libList, libRemove, type LibEntry, type LibKind, type LibList } from "../guide/library";
import { loadBreaks, loadRacks, loadSongs, storeBreaks, storeRacks, storeSongs, tidyBreak, tidyRack, withNamed, withSavedSong } from "../daw/store";
import { tidySong } from "../daw/song";
import { listSamples, putSample } from "../daw/samples";

type Page = "walks" | LibKind;
const PAGES: { id: Page; name: string; blurb: string }[] = [
  { id: "walks", name: "Walkthroughs", blurb: "" },
  { id: "sound", name: "Sounds", blurb: "Sound files people have dropped onto drum pads in the Studio. Add one to your sounds and it appears in every drum rack's list." },
  { id: "break", name: "Breaks", blurb: "Drum patterns saved from the Studio. Add one to your breaks, then click it in a drum clip to use it." },
  { id: "rack", name: "Racks", blurb: "Drum racks saved from the Studio: the pads with their settings and sounds. Add one to your racks, then click it on a drum track." },
  { id: "song", name: "Songs", blurb: "Whole songs saved from the Studio. Add one to your songs, then open it from the Studio's list." },
];
const size = (n: number) => (n > 1_000_000 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); };

function Shelf({ kind, blurb }: { kind: LibKind; blurb: string }) {
  const [list, setList] = useState<LibList>();
  const [note, setNote] = useState("");
  const [find, setFind] = useState("");
  const [mine, setMine] = useState<Set<string>>(new Set());
  const ctx = useRef<AudioContext | null>(null), playing = useRef<AudioBufferSourceNode | null>(null);
  const load = useCallback(async () => { const r = await libList(kind); if (r.ok) setList(r.value); else { setList({ items: [], database: true }); setNote(r.message); } }, [kind]);
  useEffect(() => { setList(undefined); setNote(""); void load(); if (kind === "sound") void listSamples().then((all) => setMine(new Set(all.map((s) => s.id)))).catch(() => undefined); }, [kind, load]);
  useEffect(() => () => { playing.current?.stop(); void ctx.current?.close(); }, []);
  const bytesOf = async (e: LibEntry) => { const data = await libGet("sound", e.id); return typeof data === "string" ? fromBase64(data) : undefined; };
  const play = async (e: LibEntry) => {
    const bytes = await bytesOf(e);
    if (!bytes) { setNote("That sound could not be fetched."); return; }
    ctx.current ??= new AudioContext(); void ctx.current.resume();
    try { const buffer = await ctx.current.decodeAudioData(bytes); playing.current?.stop(); const src = ctx.current.createBufferSource(); src.buffer = buffer; src.connect(ctx.current.destination); src.start(); playing.current = src; }
    catch { setNote("The browser could not read that file as sound."); }
  };
  const take = async (e: LibEntry) => {
    if (kind === "sound") { const bytes = await bytesOf(e); if (!bytes) { setNote("That sound could not be fetched."); return; } try { await putSample({ id: e.id, name: e.name, bytes, added: Date.now() }); setMine((m) => new Set(m).add(e.id)); setNote(`“${e.name}” is now in your sounds: open a drum rack in the Studio to use it.`); } catch { setNote("The browser would not store the file."); } return; }
    const data = await libGet(kind, e.id);
    // what comes from the library is someone else's data: it is made safe again before it is kept here
    if (kind === "break") { const b = tidyBreak(data); if (b) { storeBreaks(withNamed(loadBreaks(), { ...b, name: e.name })); setNote(`“${e.name}” is now in your breaks.`); return; } }
    if (kind === "rack") { const r = tidyRack(data); if (r) { storeRacks(withNamed(loadRacks(), { ...r, name: e.name })); setNote(`“${e.name}” is now in your racks. Its sound files are fetched when you use it.`); return; } }
    if (kind === "song") { const s = tidySong(data); if (s) { storeSongs(withSavedSong(loadSongs(), { ...s, name: e.name })); setNote(`“${e.name}” is now in your songs: open it from the Studio's list.`); return; } }
    setNote("That could not be read.");
  };
  const remove = async (e: LibEntry) => { if (!window.confirm(`Remove “${e.name}” from the library for everyone?`)) return; const r = await libRemove(kind, e.id); if (r.ok) setList(r.value); else setNote(r.message); };
  if (!list) return <p className="muted">Looking in the library…</p>;
  if (!list.database) return <p>This site has no database connected, so there is no shared library here. What you make is still kept in this browser.</p>;
  const q = find.trim().toLowerCase(), shown = list.items.filter((e) => !q || `${e.name} ${e.by} ${e.about ?? ""}`.toLowerCase().includes(q));
  return (
    <div className="lib-shelf">
      <p className="lib-blurb">{blurb}</p>
      {note && <p className="daw-note" role="status">{note}</p>}
      {list.items.length > 6 && <input type="search" className="lib-find" placeholder="Search by name or person" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Search this shelf" />}
      {list.items.length === 0 ? <p className="muted">Nothing here yet. {kind === "sound" ? "Drop a sound file onto a drum pad in the Studio and it appears here." : "Save one in the Studio and it appears here."}</p> : (
        <ul className="lib-list">
          {shown.map((e) => (
            <li key={e.id}>
              <div className="lib-what"><b>{e.name}</b><span>{[e.about, kind === "sound" ? size(e.bytes) : undefined, `from ${e.by}`, when(e.at)].filter(Boolean).join(" · ")}</span></div>
              {kind === "sound" && <button onClick={() => void play(e)} aria-label={`Play ${e.name}`}>▶ Play</button>}
              {kind === "sound" && mine.has(e.id) ? <span className="lib-have">In your sounds</span> : <button onClick={() => void take(e)}>{kind === "sound" ? "Add to my sounds" : `Add to my ${kind}s`}</button>}
              {(list.owner || list.me === e.byId) && <button className="linkish" onClick={() => void remove(e)}>Remove</button>}
            </li>
          ))}
          {shown.length === 0 && <li className="muted">Nothing matches “{find}”.</li>}
        </ul>
      )}
    </div>
  );
}

export default function LibraryView() {
  const [page, setPage] = useState<Page>(() => { try { const p = localStorage.getItem("patchwalk.library.page"); return PAGES.some((x) => x.id === p) ? (p as Page) : "walks"; } catch { return "walks"; } });
  const go = (p: Page) => { setPage(p); try { localStorage.setItem("patchwalk.library.page", p); } catch { /* not remembered */ } };
  const now = PAGES.find((p) => p.id === page)!;
  return (
    <>
      <section className="panel lib-top">
        <h2>Library</h2>
        <p className="daw-lede">Everything people on this site have kept for each other. Looking and adding cost nothing.</p>
        <div className="seg lib-pages" role="tablist" aria-label="Shelves of the library">{PAGES.map((p) => <button key={p.id} role="tab" aria-selected={page === p.id} className={page === p.id ? "on" : ""} onClick={() => go(p.id)}>{p.name}</button>)}</div>
        {page !== "walks" && <Shelf key={page} kind={page} blurb={now.blurb} />}
      </section>
      {page === "walks" && <WalkLibrary />}
    </>
  );
}
