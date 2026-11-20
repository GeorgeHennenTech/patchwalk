// The Sources shelf of the Library tab: every text in the private library as a table you can sort, filter
// and open, and a search inside all of them that answers with page numbers and short excerpts.
// The texts themselves are never shown whole: they are other people's writing, kept here for study.
import { useEffect, useMemo, useState } from "react";
import { KIND_NAMES, SOURCES, TOPICS, type SourceCard, type SourceHit, type SourceKind, type Topic } from "../library/catalog";
import { listSources, searchSources } from "../guide/sources";

type Row = SourceCard & { by: string; year: number; kind: SourceKind; topic: Topic | "Other"; about: string; added: string; note?: string };
type Sort = "topic" | "title" | "year" | "pages" | "added";
const SORTS: { id: Sort; name: string }[] = [{ id: "topic", name: "Subject" }, { id: "title", name: "Title" }, { id: "year", name: "Year" }, { id: "pages", name: "Length" }, { id: "added", name: "Newest in the library" }];
const day = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); };
const n = (x: number) => x.toLocaleString();

function Hits({ hits, rows, query, onOpen }: { hits: SourceHit[]; rows: Row[]; query: string; onOpen?: (id: string) => void }) {
  if (!hits.length) return <p className="muted">Nothing in the library matches “{query}”. Try other words: a search looks for the words themselves and a few close relatives.</p>;
  return (
    <ol className="src-hits">
      {hits.map((h, i) => { const row = rows.find((r) => r.id === h.book); return (
        <li key={`${h.book}-${h.page}-${i}`}>
          <div className="src-hit-where">{onOpen ? <button className="linkish" onClick={() => onOpen(h.book)}>{row?.title ?? h.book}</button> : <b>{row?.title ?? h.book}</b>}<span> · page {h.page}{h.chapter ? ` · ${h.chapter}` : ""}{h.pictures ? ` · ${h.pictures} picture${h.pictures === 1 ? "" : "s"} on the page` : ""}</span></div>
          <p className="src-excerpt">{h.excerpt}</p>
        </li>
      ); })}
    </ol>
  );
}

function Detail({ row, rows }: { row: Row; rows: Row[] }) {
  const [q, setQ] = useState(""), [hits, setHits] = useState<SourceHit[]>(), [asked, setAsked] = useState(""), [busy, setBusy] = useState(false), [note, setNote] = useState("");
  const go = async () => { if (q.trim().length < 2) return; setBusy(true); setNote(""); const r = await searchSources(q, row.id); setBusy(false); if (r.ok) { setHits(r.value.hits); setAsked(q.trim()); } else setNote(r.message); };
  return (
    <div className="src-detail">
      <p>{row.about}</p>
      {row.note && <p className="src-note"><b>Keep in mind:</b> {row.note}</p>}
      <p className="src-facts">{n(row.pages)} pages of text (pages {row.first} to {row.last}) · about {n(Math.round(row.words / 100) * 100)} words · {row.pictures ? `${n(row.pictures)} pictures` : "no pictures"} · in the library since {day(row.added)}</p>
      {row.chapters.length > 1 && <details className="src-chapters"><summary>{row.chapters.length} chapters</summary><ol>{row.chapters.map((c) => <li key={c.name}><span>{c.name}</span><span className="muted">{c.from === c.to ? `page ${c.from}` : `pages ${c.from} to ${c.to}`}</span></li>)}</ol></details>}
      <form className="src-in" onSubmit={(e) => { e.preventDefault(); void go(); }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search inside this source" aria-label={`Search inside ${row.title}`} />
        <button disabled={busy || q.trim().length < 2}>{busy ? "Looking…" : "Search"}</button>
      </form>
      {note && <p className="daw-note" role="status">{note}</p>}
      {hits && <Hits hits={hits} rows={rows} query={asked} />}
    </div>
  );
}

export function SourcesShelf() {
  const [cards, setCards] = useState<SourceCard[]>(), [problem, setProblem] = useState("");
  const [topic, setTopic] = useState<Topic | "All">("All"), [kind, setKind] = useState<SourceKind | "all">("all"), [find, setFind] = useState(""), [sort, setSort] = useState<Sort>("topic");
  const [open, setOpen] = useState<string>();
  const [q, setQ] = useState(""), [hits, setHits] = useState<SourceHit[]>(), [asked, setAsked] = useState(""), [busy, setBusy] = useState(false), [note, setNote] = useState("");
  useEffect(() => { void listSources().then((r) => (r.ok ? setCards(r.value.sources) : setProblem(r.message))); }, []);
  const rows: Row[] = useMemo(() => (cards ?? []).map((c) => { const m = SOURCES[c.id]; return { ...c, by: m?.by ?? "", year: m?.year ?? 0, kind: m?.kind ?? "paper", topic: m?.topic ?? "Other", about: m?.about ?? "", added: m?.added ?? "", ...(m?.note ? { note: m.note } : {}) }; }), [cards]);
  const shown = useMemo(() => {
    const words = find.toLowerCase().split(/\s+/).filter(Boolean);
    const list = rows.filter((r) => (topic === "All" || r.topic === topic) && (kind === "all" || r.kind === kind) && words.every((w) => `${r.title} ${r.by} ${r.about} ${r.year}`.toLowerCase().includes(w)));
    const order = (r: Row) => TOPICS.indexOf(r.topic as Topic);
    return list.sort((a, b) => (sort === "title" ? a.title.localeCompare(b.title) : sort === "year" ? b.year - a.year : sort === "pages" ? b.pages - a.pages : sort === "added" ? b.added.localeCompare(a.added) || a.title.localeCompare(b.title) : order(a) - order(b) || a.year - b.year));
  }, [rows, topic, kind, find, sort]);
  const search = async () => { if (q.trim().length < 2) return; setBusy(true); setNote(""); const r = await searchSources(q); setBusy(false); if (r.ok) { setHits(r.value.hits); setAsked(q.trim()); } else setNote(r.message); };
  const jump = (id: string) => { setTopic("All"); setKind("all"); setFind(""); setOpen(id); window.setTimeout(() => document.getElementById(`src-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 30); };

  if (problem) return <p role="status">{problem}</p>;
  if (!cards) return <p className="muted">Looking in the library…</p>;
  const pages = rows.reduce((a, r) => a + r.pages, 0), pictures = rows.reduce((a, r) => a + r.pictures, 0);
  return (
    <div className="src">
      <p className="lib-blurb">Every text the guide answers from: {rows.length} sources, {n(pages)} pages, {n(pictures)} pictures. Sort and filter the list, open a source to see what it covers, or search inside all of them. A search costs nothing and shows a few lines around each match with its page number. The texts are other people's writing, so they are not shown whole: to have something explained, take the page number to <b>Ask the guide</b>.</p>
      <form className="src-in src-all" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search inside every source: sidebands, plate reverb, swing ratio…" aria-label="Search inside every source" />
        <button className="primary" disabled={busy || q.trim().length < 2}>{busy ? "Looking…" : "Search"}</button>
        {hits && <button type="button" className="linkish" onClick={() => { setHits(undefined); setQ(""); }}>Clear</button>}
      </form>
      {note && <p className="daw-note" role="status">{note}</p>}
      {hits && <Hits hits={hits} rows={rows} query={asked} onOpen={jump} />}

      <div className="src-filters">
        <div className="seg" role="group" aria-label="Subject">{(["All", ...TOPICS] as const).map((t) => { const count = t === "All" ? rows.length : rows.filter((r) => r.topic === t).length; return count ? <button key={t} className={topic === t ? "on" : ""} aria-pressed={topic === t} onClick={() => setTopic(t)}>{t} <small>{count}</small></button> : null; })}</div>
        <label>Kind <select value={kind} onChange={(e) => setKind(e.target.value as SourceKind | "all")}><option value="all">any</option>{(Object.keys(KIND_NAMES) as SourceKind[]).map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}</select></label>
        <label>Sort by <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>{SORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <input type="search" className="lib-find" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Filter by title or author" aria-label="Filter the list by title or author" />
      </div>
      <table className="src-table">
        <thead><tr><th>Source</th><th>By</th><th>Year</th><th>Kind</th><th>Subject</th><th className="num">Pages</th><th className="num">Pictures</th></tr></thead>
        <tbody>
          {shown.map((r) => (
            <FragmentRow key={r.id} row={r} rows={rows} open={open === r.id} onToggle={() => setOpen(open === r.id ? undefined : r.id)} />
          ))}
          {shown.length === 0 && <tr><td colSpan={7} className="muted">No source matches those filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({ row, rows, open, onToggle }: { row: Row; rows: Row[]; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr id={`src-${row.id}`} className={open ? "open" : ""}>
        <td><button className="src-title" aria-expanded={open} onClick={onToggle}><span aria-hidden="true">{open ? "▾" : "▸"}</span> {row.title}</button></td>
        <td>{row.by}</td><td>{row.year || ""}</td><td>{KIND_NAMES[row.kind]}</td><td>{row.topic}</td><td className="num">{n(row.pages)}</td><td className="num">{row.pictures ? n(row.pictures) : ""}</td>
      </tr>
      {open && <tr className="src-open"><td colSpan={7}><Detail row={row} rows={rows} /></td></tr>}
    </>
  );
}
