// A Vero column you can walk round: the guide's typical 12-cabinet arena array, hung to scale, with the
// beams of the mid-high cabinets and bass cabinets on the ground. Figures are from the Vero user guide.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ARENA_ARRAY, reach, tilts, VERO, type VeroKind } from "../soundsystems/vero";
import { makeStage, type Stage } from "./three/stage";

const TOP = 11;           // height of the top of the column above the ground, metres (illustrative)
const SUBS = 6;           // bass cabinets drawn in the row (illustrative)
const VIEWS: Record<string, { label: string; from: [number, number, number]; to: [number, number, number] }> = {
  column: { label: "The column", from: [-8, 9.5, 12], to: [0, 8.4, 0] },
  side: { label: "From the side", from: [48, 10, 22], to: [0, 4, 22] },
  field: { label: "The whole field", from: [-38, 40, -30], to: [0, 0, 40] },
};

/** A cabinet seen from above is wider at the front than the back, with a curved front. Its top front edge is the origin. */
function cabinetShape(w: number, d: number): THREE.Shape {
  const s = new THREE.Shape(), half = w / 2, back = half * 0.62, bulge = d * 0.16;
  s.moveTo(-half, bulge); // shape y runs backwards from the front
  for (let i = 0; i <= 16; i++) { const u = i / 16, x = -half + u * w; s.lineTo(x, bulge * (1 - Math.cos((u - 0.5) * Math.PI))); }
  s.lineTo(half, d * 0.55); s.lineTo(back, d); s.lineTo(-back, d); s.lineTo(-half, d * 0.55); s.closePath();
  return s;
}

/** A beam: a wedge opening `across` degrees sideways and `upDown` degrees top to bottom, `length` long, pointing along +z. */
function beam(across: number, upDown: number, length: number): THREE.BufferGeometry {
  const h = ((across / 2) * Math.PI) / 180, v = ((upDown / 2) * Math.PI) / 180, n = 24, pts: number[] = [0, 0, 0], idx: number[] = [];
  for (const sign of [1, -1]) for (let i = 0; i <= n; i++) { const a = -h + (2 * h * i) / n; pts.push(length * Math.sin(a) * Math.cos(v), sign * length * Math.sin(v), length * Math.cos(a) * Math.cos(v)); }
  const top = (i: number) => 1 + i, bottom = (i: number) => 2 + n + i;
  for (let i = 0; i < n; i++) { idx.push(0, top(i), top(i + 1), 0, bottom(i + 1), bottom(i), top(i), bottom(i), bottom(i + 1), top(i), bottom(i + 1), top(i + 1)); }
  idx.push(0, bottom(0), top(0), 0, top(n), bottom(n));
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export default function VeroScene() {
  const mount = useRef<HTMLDivElement>(null), stage = useRef<Stage | undefined>(undefined);
  const [picked, setPicked] = useState<string>(), [hover, setHover] = useState<string>();
  const [beams, setBeams] = useState(true), [failed, setFailed] = useState(false);
  const live = useRef({ lit: undefined as string | undefined, beams: true });
  live.current.lit = hover ?? picked; live.current.beams = beams;
  const angles = tilts(ARENA_ARRAY);

  useEffect(() => {
    const cabinets: { id: string; body: THREE.Mesh; beam?: THREE.Mesh }[] = [];
    const st = makeStage(mount.current!, { camera: VIEWS.column!.from, target: VIEWS.column!.to, far: 900, min: 3, max: 220, background: "#e9e7e2",
      onHover: setHover, onPick: setPicked,
      onFrame: () => { for (const c of cabinets) { (c.body.material as THREE.MeshStandardMaterial).emissiveIntensity = c.id === live.current.lit ? 0.5 : 0; if (c.beam) { c.beam.visible = live.current.beams; (c.beam.material as THREE.MeshBasicMaterial).opacity = c.id === live.current.lit ? 0.42 : 0.13; } } } });
    if (!st) { setFailed(true); return; }
    stage.current = st;
    const { scene } = st;
    // the ground, a stage, and marks every 20 metres so distances can be read
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: "#cfd2c4", roughness: 1 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(22, 1.4, 10), new THREE.MeshStandardMaterial({ color: "#3a3340", roughness: 0.9 })); deck.position.set(9, 0.7, -6); scene.add(deck);
    for (let m = 20; m <= 120; m += 20) { const line = new THREE.Mesh(new THREE.PlaneGeometry(70, 0.25), new THREE.MeshBasicMaterial({ color: "#8d8f84" })); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.02, m); scene.add(line); }
    // the column: each cabinet hangs from the front bottom edge of the one above, tipped by the angles added up
    let y = TOP, z = 0;
    ARENA_ARRAY.forEach((c, i) => {
      const spec = VERO[c.kind], [w, h, d] = spec.size, tilt = (angles[i]! * Math.PI) / 180, id = `a${i}`;
      const geo = new THREE.ExtrudeGeometry(cabinetShape(w, d), { depth: h, bevelEnabled: false }); geo.rotateX(Math.PI / 2); // front at z = 0, body runs back (-z) and down (-y)
      geo.scale(1, 1, -1);
      const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#1c1a20", roughness: 0.75, emissive: new THREE.Color(spec.color), emissiveIntensity: 0, side: THREE.DoubleSide }));
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 0.985, 0.05, 0.04), new THREE.MeshStandardMaterial({ color: spec.color, emissive: new THREE.Color(spec.color), emissiveIntensity: 0.35 })); stripe.position.set(0, -h + 0.04, 0.13);
      const group = new THREE.Group(); group.add(body, stripe); group.position.set(0, y, z); group.rotation.x = tilt; group.userData.id = id;
      let wedge: THREE.Mesh | undefined;
      if (spec.beam) {
        const far = Math.min(c.kind === "V60" ? 110 : 55, reach(y, angles[i]! + 0.001) * 1.15);
        wedge = new THREE.Mesh(beam(spec.beam.across, spec.beam.upDown, far), new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }));
        wedge.position.set(0, -h / 2, 0.12); wedge.raycast = () => {}; group.add(wedge);
      }
      scene.add(group); st.pickable.push(group); cabinets.push({ id, body, beam: wedge });
      y -= h * Math.cos(tilt); z -= h * Math.sin(tilt);
    });
    // bass cabinets on the ground in front of the stage
    const [sw, sh, sd] = VERO.V221.size;
    for (let k = 0; k < SUBS; k++) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), new THREE.MeshStandardMaterial({ color: "#1c1a20", roughness: 0.75, emissive: new THREE.Color(VERO.V221.color), emissiveIntensity: 0 }));
      body.position.set(4 + k * (sw + 0.05), sh / 2, 0.6); body.userData.id = `s${k}`; scene.add(body); st.pickable.push(body); cabinets.push({ id: `s${k}`, body });
    }
    return () => { st.dispose(); stage.current = undefined; };
  }, []);

  const id = hover ?? picked, n = id?.startsWith("a") ? Number(id.slice(1)) : undefined;
  const kind: VeroKind | undefined = id === undefined ? undefined : n !== undefined ? ARENA_ARRAY[n]!.kind : "V221";
  const spec = kind ? VERO[kind] : undefined, tilt = n !== undefined ? angles[n]! : undefined;
  const lands = n !== undefined && spec?.beam ? reach(TOP - n * 0.43, tilt!) : undefined;
  return (
    <>
      <p className="muted">The system reported at Tipper's shows. This is the "typical 12-cabinet arena array" from Funktion-One's Vero user guide, hung to scale: four V60, three V315, two V90, one V315, two V90, from the top. Drag to walk round it; click a cabinet.</p>
      <div className="driver-grid">
        <div className="driver-stage three" ref={mount} role="img" aria-label="A column of twelve loudspeaker cabinets hanging beside a stage, with coloured beams showing where each one sends its sound, and bass cabinets on the ground">
          {failed && <p className="driver-failed">This browser could not start 3D drawing.</p>}
        </div>
        <div className="driver-side">
          <div className="driver-parts" role="group" aria-label="Views">
            {Object.entries(VIEWS).map(([k, v]) => <button key={k} onClick={() => stage.current?.lookFrom(v.from, v.to)}>{v.label}</button>)}
            <button aria-pressed={beams} className={beams ? "on" : ""} onClick={() => setBeams((b) => !b)}>Beams</button>
          </div>
          <div className="driver-parts vero-key" role="group" aria-label="Cabinets in the column, top to bottom">
            {ARENA_ARRAY.map((c, i) => <button key={i} style={{ borderColor: VERO[c.kind].color }} className={id === `a${i}` ? "on" : ""} aria-pressed={picked === `a${i}`} onClick={() => setPicked(picked === `a${i}` ? undefined : `a${i}`)} onPointerEnter={() => setHover(`a${i}`)} onPointerLeave={() => setHover(undefined)}>{i + 1} · {c.kind}</button>)}
          </div>
          <div className="driver-info" role="status">
            {spec ? (
              <>
                <h3>{spec.name}{n !== undefined && ` · cabinet ${n + 1} from the top`}</h3>
                <p>{spec.job}</p>
                <p className="muted">{spec.drivers}. {spec.band}. {spec.coverage}. {spec.weight}.</p>
                {tilt !== undefined && <p>Tipped down {tilt}° from level{lands !== undefined && (Number.isFinite(lands) ? `, so the middle of its beam meets the ground about ${Math.round(lands)} m out` : ", so its beam runs level over the audience")}.</p>}
                <p className="muted">Vero user guide, page {spec.page}.</p>
              </>
            ) : <p className="muted">Blue cabinets are V60 (narrow beam), yellow are V90 (wide beam), red are V315 (mid-bass), as on the real cabinets' dials. The top ones are tipped least, so their narrow beams carry furthest; each one lower is tipped a little more and covers nearer ground.</p>}
          </div>
        </div>
      </div>
      <p className="muted driver-draft">From the guide: the cabinets' sizes, which kinds hang where, the angles between them (pages 62, 67, 108 to 111), and each kind's coverage. Drawn for illustration: the height of the column, the length of the beams, the number of bass cabinets, the stage, and the cabinets' exact outline. Lines on the ground are 20 m apart.</p>
    </>
  );
}
