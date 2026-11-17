import { useEffect, useMemo, useState } from "react";
import { analyze, type Analysis } from "./flow/build";
import { guessSoundType } from "./flow/soundtype";
import { decodePreset, PresetError, type DecodedPreset } from "./format";
import { parseCard, type Card } from "./lesson/cards";
import { INIT_BASELINE } from "./patch/baseline";
import { Badge } from "./ui/Badge";
import { AskView } from "./ui/AskView";
import { WalkLibrary } from "./ui/Walkthrough";
import { DriverPage } from "./ui/DriverDiagram";
import ModelLabs from "./ui/ModelLabs";
import DawView from "./ui/DawView";
import { CompareView } from "./ui/CompareView";
import { DisplayTable } from "./ui/DisplayTable";
import { DropZone } from "./ui/DropZone";
import { FlowView } from "./ui/FlowView";
import { JsonView } from "./ui/JsonView";
import { LearnView } from "./ui/LearnView";
import { LessonView } from "./ui/LessonView";
import { ModulesView } from "./ui/ModulesView";
import { OpenLesson } from "./ui/Answer";
import { AccountBar, DatabaseCheck, SignInGate } from "./ui/Account";
import { session as readSession, settle, type Session } from "./guide/sync";
import { PlayView } from "./ui/PlayView";
import { SelfTest } from "./ui/SelfTest";

// Knowledge cards are bundled at build time; files starting with "_" (the template) are skipped.
const CARDS: Card[] = Object.entries(import.meta.glob("../knowledge-cards/*.md", { query: "?raw", import: "default", eager: true }))
  .filter(([path]) => !path.split("/").pop()!.startsWith("_"))
  .map(([, text]) => parseCard(text as string))
  .filter((c): c is Card => !!c);

type Loaded = { fileName: string; preset: DecodedPreset; analysis: Analysis };
type State = { kind: "empty" } | { kind: "error"; fileName: string; message: string } | ({ kind: "ok" } & Loaded);

const TABS = [
  { id: "lesson", label: "Lesson" },
  { id: "flow", label: "Signal flow" },
  { id: "modules", label: "Active modules" },
  { id: "compare", label: "Compare attempt" },
  { id: "display", label: "Display values" },
  { id: "raw", label: "Raw data" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

/** Reads and analyses a file entirely in this tab. Nothing is uploaded or stored. */
async function load(file: File): Promise<Loaded> {
  const preset = decodePreset(new Uint8Array(await file.arrayBuffer()));
  return { fileName: file.name, preset, analysis: analyze(preset, INIT_BASELINE) };
}
const explain = (e: unknown) => {
  if (e instanceof PresetError) return e.message;
  console.error(e);
  return "Something unexpected went wrong while reading this file.";
};

function SoundType({ analysis }: { analysis: Analysis }) {
  const g = useMemo(() => guessSoundType(analysis), [analysis]);
  return (
    <div className="soundtype">
      <div>
        <span className="muted">Sound type: </span>
        <strong>{g.label ? `probably a ${g.label.charAt(0).toLowerCase()}${g.label.slice(1)}` : "no guess"}</strong>{" "}
        <Badge kind="warn" title={g.caveats.join(" ")}>guess from settings</Badge>
      </div>
      <ul>{g.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
    </div>
  );
}

export function App() {
  const [state, setState] = useState<State>({ kind: "empty" });
  const [mode, setMode] = useState<"rebuild" | "play" | "learn" | "ask" | "walks" | "sound" | "studio" | "strings" | "check">("rebuild");
  const [tab, setTab] = useState<TabId>("lesson");
  // A lesson the guide has pointed to. The counter makes a second click on the same lesson count.
  const [wanted, setWanted] = useState<{ id: string; n: number }>();
  const openLesson = (id: string) => { setWanted((w) => ({ id, n: (w?.n ?? 0) + 1 })); setMode("play"); window.scrollTo({ top: 0 }); };
  const [filter, setFilter] = useState("");
  // who is signed in, as the server sees it; until it answers nothing is shown
  const [sess, setSess] = useState<Session>();
  useEffect(() => { void readSession().then((s) => { settle(s); setSess(s); }); }, []);
  const inside = sess?.state === "signedIn" || sess?.state === "open";
  const [attempt, setAttempt] = useState<{ loaded?: Loaded; name?: string; error?: string }>({});

  async function onFile(file: File) {
    setAttempt({});
    try {
      setState({ kind: "ok", ...(await load(file)) });
    } catch (e) {
      setState({ kind: "error", fileName: file.name, message: explain(e) });
    }
  }
  async function onAttempt(file: File) {
    try {
      setAttempt({ loaded: await load(file), name: file.name });
    } catch (e) {
      setAttempt({ name: file.name, error: `Could not read ${file.name}. ${explain(e)}` });
    }
  }

  const filtered = useMemo(() => {
    if (state.kind !== "ok") return {};
    const q = filter.trim().toLowerCase();
    const entries = Object.entries(state.preset.root);
    return Object.fromEntries(q ? entries.filter(([k]) => k.toLowerCase().includes(q)) : entries);
  }, [state, filter]);

  return (
    <OpenLesson.Provider value={openLesson}>
    <main>
      <header className="top">
        <h1>Patchwalk</h1>
        <p>Learn synthesis hands-on, or drop a Serum 2 preset and get a step-by-step walk-through for rebuilding it. Files stay in this browser tab.</p>
        {inside && <div className="modes" role="tablist" aria-label="Mode">
          <button role="tab" aria-selected={mode === "rebuild"} className={mode === "rebuild" ? "on" : ""} onClick={() => setMode("rebuild")}>Rebuild a patch</button>
          <button role="tab" aria-selected={mode === "play"} className={mode === "play" ? "on" : ""} onClick={() => setMode("play")}>Lessons</button>
          <button role="tab" aria-selected={mode === "learn"} className={mode === "learn" ? "on" : ""} onClick={() => setMode("learn")}>Serum tasks</button>
          <button role="tab" aria-selected={mode === "ask"} className={mode === "ask" ? "on" : ""} onClick={() => setMode("ask")}>Ask the guide</button>
          <button role="tab" aria-selected={mode === "walks"} className={mode === "walks" ? "on" : ""} onClick={() => setMode("walks")}>Walkthroughs</button>
          <button role="tab" aria-selected={mode === "sound"} className={mode === "sound" ? "on" : ""} onClick={() => setMode("sound")}>Sound systems</button>
          <button role="tab" aria-selected={mode === "studio"} className={mode === "studio" ? "on" : ""} onClick={() => setMode("studio")}>Studio</button>
          <button role="tab" aria-selected={mode === "strings"} className={mode === "strings" ? "on" : ""} onClick={() => setMode("strings")}>Physical models</button>
          <button role="tab" aria-selected={mode === "check"} className={mode === "check" ? "on" : ""} onClick={() => setMode("check")}>System check</button>
        </div>}
      </header>
      {sess?.state === "signedIn" && <AccountBar session={sess} />}
      {!sess && <section className="panel"><p className="muted">One moment…</p></section>}
      {sess?.state === "signedOut" && <SignInGate ownerSet={sess.ownerSet} mail={sess.mail} />}
      {sess?.state === "down" && <section className="panel error" role="alert"><h2>Accounts are not available</h2><p>{sess.message}</p><p><button className="primary" onClick={() => window.location.reload()}>Try again</button></p></section>}
      {inside && <>

      {mode === "play" && (
        <section className="panel">
          <PlayView cards={CARDS} wanted={wanted} />
        </section>
      )}

      {mode === "learn" && (
        <section className="panel">
          <LearnView cards={CARDS} loadFile={async (f) => (await load(f)).analysis} />
        </section>
      )}

      {mode === "ask" && <AskView />}
      {mode === "walks" && <WalkLibrary />}
      {mode === "sound" && <DriverPage />}
      {mode === "studio" && <DawView />}
      {mode === "strings" && <ModelLabs />}
      {mode === "check" && <><SelfTest cards={CARDS} /><DatabaseCheck /></>}

      {mode === "rebuild" && <DropZone onFile={onFile} compact={state.kind !== "empty"} />}

      {mode === "rebuild" && state.kind === "error" && (
        <section className="panel error" role="alert">
          <h2>Could not read {state.fileName}</h2>
          <p>{state.message}</p>
        </section>
      )}

      {mode === "rebuild" && state.kind === "ok" && (
        <>
          <section className="panel">
            <h2>{state.preset.header.presetName || state.fileName}</h2>
            <dl className="facts">
              <div><dt>File</dt><dd>{state.fileName}</dd></div>
              <div><dt>Author</dt><dd>{state.preset.header.presetAuthor || "—"}</dd></div>
              <div><dt>Made in</dt><dd>{state.preset.header.product} {state.preset.header.productVersion}</dd></div>
              <div><dt>Tags</dt><dd>{state.preset.header.tags?.join(", ") || "—"}</dd></div>
              <div><dt>Steps</dt><dd>{state.analysis.steps.length}</dd></div>
              <div><dt>Size</dt><dd>{kb(state.preset.stats.fileBytes)} on disk, {kb(state.preset.stats.decompressedBytes)} decoded</dd></div>
            </dl>
            {state.preset.header.presetDescription && <p className="desc">{state.preset.header.presetDescription}</p>}
            <SoundType analysis={state.analysis} />
          </section>

          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </nav>

          <section className="panel tabpanel" role="tabpanel">
            {tab === "lesson" && <LessonView steps={state.analysis.steps} modules={state.analysis.modules} cards={CARDS} presetKey={state.fileName + state.preset.stats.fileBytes}
              patchName={state.preset.header.presetName || state.fileName} />}
            {tab === "flow" && <FlowView graph={state.analysis.graph} />}
            {tab === "modules" && <ModulesView analysis={state.analysis} />}
            {tab === "compare" && <CompareView target={state.analysis} attempt={attempt.loaded?.analysis} attemptName={attempt.name} attemptError={attempt.error} onFile={onAttempt} />}
            {tab === "display" && <DisplayTable />}
            {tab === "raw" && (
              <>
                <div className="panel-head">
                  <h2>Decoded data</h2>
                  <input type="search" placeholder="Filter modules, e.g. Env or ModSlot" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter top-level keys" />
                </div>
                <p className="hint">Raw stored values, not what Serum shows on screen. {Object.keys(filtered).length} of {state.preset.stats.rootKeys} keys shown.</p>
                <JsonView key={state.fileName + filter} value={filtered} openDepth={1} />
                <h2 className="sub">Header</h2>
                <JsonView value={state.preset.header} openDepth={1} />
              </>
            )}
          </section>
        </>
      )}
      </>}
      <p className="build-stamp">Version {typeof __BUILD__ === "string" ? __BUILD__ : "unknown"}</p>
    </main>
    </OpenLesson.Provider>
  );
}
