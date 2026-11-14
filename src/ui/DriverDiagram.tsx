// An interactive cutaway of a loudspeaker driver: point at a part to see what it does, move the cone, or
// hide the names and try to name each part. The pictures are rendered ahead of time; code does the rest.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DRIVER_PARTS, nameChoices, partAt, quizOrder, type Rgb } from "../soundsystems/driver";
import meta from "../assets/diagrams/driver/parts.json";

const urls = (pattern: Record<string, string>) => Object.entries(pattern).sort(([a], [b]) => a.localeCompare(b)).map(([, url]) => url);
const FRAMES = urls(import.meta.glob("../assets/diagrams/driver/frame*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>);
const MAPS = urls(import.meta.glob("../assets/diagrams/driver/map*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>);
const COLORS = meta.parts.map((p) => p.map as unknown as Rgb);
const W = 1600, H = 830, REST = meta.rest;
const NAMES = DRIVER_PARTS.map((p) => p.name);

type Quiz = { order: number[]; at: number; firstTry: number; missed: number[]; wrong?: string; solved: boolean; seed: number };

export function DriverDiagram() {
  const [frame, setFrame] = useState(REST);
  const [picked, setPicked] = useState<number>();
  const [hover, setHover] = useState(-1);
  const [quiz, setQuiz] = useState<Quiz>();
  const [moving, setMoving] = useState(false);
  const overlay = useRef<HTMLCanvasElement>(null);
  const maps = useRef<(ImageData | undefined)[]>([]);
  const [ready, setReady] = useState(0);

  // read each position's map of parts once, so pointing and highlighting need no further loading
  useEffect(() => {
    let live = true;
    MAPS.forEach((src, k) => {
      const im = new Image();
      im.onload = () => {
        if (!live) return;
        const c = document.createElement("canvas"); c.width = W; c.height = H;
        const g = c.getContext("2d", { willReadFrequently: true })!; g.drawImage(im, 0, 0, W, H);
        maps.current[k] = g.getImageData(0, 0, W, H); setReady((n) => n + 1);
      };
      im.src = src;
    });
    return () => { live = false; };
  }, []);

  const asked = quiz && quiz.at < quiz.order.length ? quiz.order[quiz.at]! : undefined;
  const lit = asked ?? (hover >= 0 ? hover : picked ?? -1);

  // tint the lit part, straight from the map
  useEffect(() => {
    const canvas = overlay.current, map = maps.current[frame];
    if (!canvas) return;
    const g = canvas.getContext("2d")!; g.clearRect(0, 0, W, H);
    if (lit < 0 || !map) return;
    const out = g.createImageData(W, H), src = map.data, dst = out.data;
    for (let i = 0; i < src.length; i += 4) {
      if (partAt(COLORS, src[i]!, src[i + 1]!, src[i + 2]!) === lit) { dst[i] = 255; dst[i + 1] = 60; dst[i + 2] = 160; dst[i + 3] = 120; }
    }
    g.putImageData(out, 0, 0);
  }, [lit, frame, ready]);

  const under = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const map = maps.current[frame]; if (!map) return -1;
    const box = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - box.left) / box.width) * W), y = Math.floor(((e.clientY - box.top) / box.height) * H);
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    const i = (y * W + x) * 4;
    return partAt(COLORS, map.data[i]!, map.data[i + 1]!, map.data[i + 2]!);
  }, [frame]);

  // "Move it": the cone swings in and out a few times, then comes back to rest
  useEffect(() => {
    if (!moving) return;
    const started = performance.now(); let id = 0;
    const tick = (t: number) => {
      const age = (t - started) / 1000;
      if (age > 4) { setFrame(REST); setMoving(false); return; }
      setFrame(Math.round(REST + Math.sin(age * 2 * Math.PI * 1.25) * REST));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [moving]);

  const startQuiz = () => { const seed = Date.now() % 100000; setPicked(undefined); setFrame(REST); setQuiz({ order: quizOrder(NAMES.length, seed), at: 0, firstTry: 0, missed: [], solved: false, seed }); };
  const answer = (name: string) => setQuiz((q) => {
    if (!q || q.solved || asked === undefined) return q;
    if (name === NAMES[asked]) return { ...q, solved: true, firstTry: q.firstTry + (q.wrong ? 0 : 1) };
    return { ...q, wrong: name, missed: q.missed.includes(asked) ? q.missed : [...q.missed, asked] };
  });
  const next = () => setQuiz((q) => (q ? { ...q, at: q.at + 1, wrong: undefined, solved: false } : q));
  const choices = useMemo(() => (quiz && asked !== undefined ? nameChoices(NAMES, asked, quiz.seed + quiz.at) : []), [quiz?.seed, quiz?.at, asked]);
  const shown = quiz ? (quiz.solved ? asked : undefined) : picked ?? (hover >= 0 ? hover : undefined);
  const part = shown !== undefined ? DRIVER_PARTS[shown] : undefined;
  const travel = meta.travel[frame]!;

  return (
    <section className="driver">
      <h2>Inside a cone loudspeaker driver</h2>
      <p className="muted">A driver cut open so you can see inside. {quiz ? "Name the part that is lit." : "Point at any part, or pick one from the list, to see what it does. Then move the cone."}</p>
      <div className="driver-grid">
        <div className="driver-stage">
          <img src={FRAMES[frame]} width={W} height={H} alt="A loudspeaker driver with a wedge cut out of it, showing the magnet, the coil, the cone and the parts that hold them" draggable={false} />
          <canvas ref={overlay} width={W} height={H} aria-hidden="true"
            onPointerMove={(e) => { if (!quiz) setHover(under(e)); }} onPointerLeave={() => setHover(-1)}
            onPointerDown={(e) => { if (quiz) return; const p = under(e); setPicked(p >= 0 ? p : undefined); }} />
        </div>
        <div className="driver-side">
          {!quiz && (
            <>
              <div className="driver-parts" role="group" aria-label="Parts">
                {DRIVER_PARTS.map((p, i) => <button key={p.name} className={i === (picked ?? hover) ? "on" : ""} aria-pressed={i === picked} onClick={() => setPicked(i === picked ? undefined : i)} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(-1)}>{p.name}</button>)}
              </div>
              <div className="driver-info" role="status">
                {part ? <><h3>{part.name}</h3><p>{part.job}</p><p className="muted">When the cone moves, this part {part.moves === "with the cone" ? "moves with it" : part.moves === "flexes" ? "flexes: its inner edge moves and its outer edge stays put" : "stays still"}.</p></>
                  : <p className="muted">The narrow ring-shaped slot between the pole piece and the top plate is the magnetic gap. The voice coil sits in it.</p>}
              </div>
            </>
          )}
          {quiz && asked !== undefined && (
            <div className="driver-info" role="status">
              <p className="muted">Part {quiz.at + 1} of {quiz.order.length}</p>
              <div className="driver-parts" role="group" aria-label="Which part is lit?">
                {choices.map((n) => <button key={n} disabled={quiz.solved} className={quiz.solved && n === NAMES[asked] ? "on" : n === quiz.wrong && !quiz.solved ? "no" : ""} onClick={() => answer(n)}>{n}</button>)}
              </div>
              {quiz.wrong && !quiz.solved && <p>Not {quiz.wrong.toLowerCase()}. Have another go.</p>}
              {quiz.solved && part && <><h3>{part.name}</h3><p>{part.job}</p><button className="primary" onClick={next}>{quiz.at + 1 < quiz.order.length ? "Next part" : "See how you did"}</button></>}
            </div>
          )}
          {quiz && asked === undefined && (
            <div className="driver-info" role="status">
              <h3>{quiz.firstTry} of {quiz.order.length} named first time</h3>
              {quiz.missed.length > 0 ? <p>Worth another look: {quiz.missed.map((i) => NAMES[i]).join(", ")}.</p> : <p>Every part named first time.</p>}
              <button className="primary" onClick={startQuiz}>Go again</button>
            </div>
          )}
        </div>
      </div>
      <div className="driver-controls">
        <label className="driver-slider">
          <span>Cone position</span>
          <input type="range" min={0} max={FRAMES.length - 1} step={1} value={frame} disabled={moving} onChange={(e) => setFrame(Number(e.target.value))} aria-valuetext={travel === 0 ? "at rest" : `${Math.abs(travel * 10)} millimetres ${travel > 0 ? "out" : "in"}`} />
          <output>{travel === 0 ? "at rest" : `${Math.abs(travel * 10)} mm ${travel > 0 ? "out" : "in"}`}</output>
        </label>
        <button onClick={() => setMoving(true)} disabled={moving}>Move it</button>
        {quiz ? <button onClick={() => setQuiz(undefined)}>Back to exploring</button> : <button className="primary" onClick={startQuiz}>Name the parts</button>}
      </div>
      <p className="muted">Watch what moves: the coil, former, cone and dust cap travel together; the surround and spider flex; the magnet, the steel parts and the basket stay where they are.</p>
      <p className="muted driver-draft">Draft picture. The proportions are illustrative and the wording has not yet been checked against a loudspeaker text in the library.</p>
    </section>
  );
}
