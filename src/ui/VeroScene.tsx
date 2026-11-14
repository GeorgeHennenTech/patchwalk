// A Vero column you can walk round: the guide's typical 12-cabinet arena array, hung to scale, with the
// beams of the mid-high cabinets and bass cabinets on the ground. Figures are from the Vero user guide.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ARENA_ARRAY, reach, tilts, VERO, type VeroKind } from "../soundsystems/vero";
import { grass, grille, paint, paper, plywood, shadowed, sky, steel, truss } from "./three/look";
import { makeStage, type Stage } from "./three/stage";

const TOP = 11;           // height of the top of the column above the ground, metres (illustrative)
const SUBS = 8;           // bass cabinets drawn in the row (illustrative)
const STAGE_X = 12;       // the middle of the stage; the second column hangs as far to its other side
const VIEWS: Record<string, { label: string; from: [number, number, number]; to: [number, number, number] }> = {
  column: { label: "The column", from: [-4.6, 9.4, 7.6], to: [0, 8.9, -0.2] },
  stage: { label: "The stage", from: [-6, 5, 34], to: [STAGE_X, 5.5, -2] },
  side: { label: "From the side", from: [-46, 9, 24], to: [0, 4, 24] },
  field: { label: "The whole field", from: [-40, 40, -30], to: [STAGE_X, 0, 40] },
};
const BODY = "#16151a", HORN = "#1d1b2b";

/** A cabinet seen from above is wider at the front than the back, with a curved front. Its top front edge is the origin. `from` cuts the front off at that depth. */
function cabinetShape(w: number, d: number, bulge: number, from = 0): THREE.Shape {
  const s = new THREE.Shape(), half = w / 2, back = half * 0.62;
  if (from > 0) { s.moveTo(-half, from); s.lineTo(half, from); }
  else { s.moveTo(-half, bulge); for (let i = 0; i <= 24; i++) { const u = i / 24; s.lineTo(-half + u * w, bulge * (1 - Math.cos((u - 0.5) * Math.PI))); } }
  s.lineTo(half, d * 0.55); s.lineTo(back, d); s.lineTo(-back, d); s.lineTo(-half, d * 0.55); s.closePath();
  return s;
}
/** Stand a top-view outline up as a solid `h` tall: front at z = 0, body running back (-z) and down (-y). */
function solid(shape: THREE.Shape, h: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 24 }); g.rotateX(Math.PI / 2); g.scale(1, 1, -1);
  return g;
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, ry = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.y = ry; return b; };

/**
 * One cabinet, built the way the guide's photographs show it. V60 and V90: a curved perforated grille across
 * the front. V315 and the bass: an open front divided into horn mouths. All carry steel rigging plates on
 * their ends, and the flown ones the coloured dial that tells the kinds apart.
 */
function cabinet(kind: VeroKind): { group: THREE.Group; lit: THREE.MeshStandardMaterial[] } {
  const spec = VERO[kind], [w, h, d] = spec.size, flown = kind !== "V221", bulge = flown ? d * 0.16 : 0, half = w / 2;
  const skin = paint(kind === "V60" || kind === "V90" ? BODY : HORN), group = new THREE.Group(), lit = [skin];
  if (kind === "V60" || kind === "V90") {
    group.add(new THREE.Mesh(solid(cabinetShape(w, d, bulge), h), skin));
    // the grille follows the curve of the front, a finger's width proud of it
    const g = new THREE.PlaneGeometry(w * 0.985, h * 0.9, 48, 1), at = g.attributes.position!;
    for (let i = 0; i < at.count; i++) { const u = at.getX(i) / w + 0.5; at.setZ(i, 0.012 - bulge * (1 - Math.cos((u - 0.5) * Math.PI))); }
    g.computeVertexNormals();
    const mesh = grille(Math.round(w / 0.011), Math.round((h * 0.9) / 0.011)), front = new THREE.Mesh(g, mesh); front.position.y = -h / 2;
    group.add(front); lit.push(mesh);
  } else {
    // an open front: lid, floor, ends and back, with dividers between the horn mouths and walls that close in towards each driver
    const cut = d * 0.5, cells = kind === "V315" ? 3 : 2, t = 0.03, dark = paint("#0b0a10", { roughness: 0.9 });
    group.add(new THREE.Mesh(solid(cabinetShape(w, d, bulge, cut), h), skin));
    for (const y of [0, -(h - t)]) { const lid = new THREE.Mesh(solid(cabinetShape(w, cut + 0.01, bulge), t), skin); lid.position.y = y; group.add(lid); }
    for (const side of [-1, 1]) group.add(box(t, h, cut - bulge, side * (half - t / 2), -h / 2, -(bulge + cut) / 2, skin));
    const cell = (w - 2 * t) / cells;
    for (let k = 0; k < cells; k++) {
      const cx = -half + t + cell * (k + 0.5), frontZ = -bulge * (1 - Math.cos(((cx / w)) * Math.PI)) - 0.02, run = cut + frontZ, throat = cell * 0.36;
      if (k) group.add(box(t, h - 2 * t, cut - bulge, cx - cell / 2, -h / 2, -(bulge + cut) / 2, skin));
      for (const side of [-1, 1]) { // the two flared walls of this mouth
        const dx = (cell - throat) / 2, len = Math.hypot(dx, run);
        group.add(box(0.015, h - 2 * t, len, cx + side * (throat / 2 + dx / 2), -h / 2, frontZ - run / 2, dark, side * Math.atan2(dx, run)));
      }
      const driver = new THREE.Mesh(new THREE.CircleGeometry(Math.min(throat, h - 3 * t) / 2, 32), paper("#0e0d12")); driver.position.set(cx, -h / 2, -cut + 0.012); group.add(driver);
    }
  }
  // the ends: a steel rigging plate with its pins, a recessed handle, and on flown cabinets the coloured dial
  const plate = steel("#8f9298", 0.45), pin = steel("#d5d7db", 0.25), dialPaint = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.4, emissive: new THREE.Color(spec.color), emissiveIntensity: 0.25 });
  for (const side of [-1, 1]) {
    const x = side * (half + 0.006), z = -(bulge + 0.15);
    group.add(box(0.012, h * 0.94, 0.2, x, -h / 2, z, plate));
    group.add(box(0.014, h * 0.3, 0.12, x, -h / 2, z - 0.22, paint("#050506")));
    for (const y of [-0.05, -h + 0.05]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 12), pin); p.rotation.z = Math.PI / 2; p.position.set(x + side * 0.01, y, z + 0.05); group.add(p); }
    if (flown) {
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 24), dialPaint); dial.rotation.z = Math.PI / 2; dial.position.set(x + side * 0.016, -h * 0.5, z - 0.02); group.add(dial);
      // the link that joins this cabinet to the one below
      group.add(box(0.016, 0.1, 0.05, x + side * 0.012, -h, z + 0.05, pin));
    }
  }
  return { group, lit };
}

/** A beam: a wedge opening `across` degrees sideways and `upDown` degrees top to bottom, `length` long, pointing along +z. */
function beam(across: number, upDown: number, length: number): THREE.BufferGeometry {
  const h = ((across / 2) * Math.PI) / 180, v = ((upDown / 2) * Math.PI) / 180, n = 24, pts: number[] = [0, 0, 0], idx: number[] = [];
  for (const sign of [1, -1]) for (let i = 0; i <= n; i++) { const a = -h + (2 * h * i) / n; pts.push(length * Math.sin(a) * Math.cos(v), sign * length * Math.sin(v), length * Math.cos(a) * Math.cos(v)); }
  const top = (i: number) => 1 + i, bottom = (i: number) => 2 + n + i;
  for (let i = 0; i < n; i++) { idx.push(0, top(i), top(i + 1), 0, bottom(i + 1), bottom(i), top(i), bottom(i), bottom(i + 1), top(i), bottom(i + 1), top(i + 1)); }
  idx.push(0, bottom(0), top(0), 0, top(n), bottom(n));
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); g.setIndex(idx); g.computeVertexNormals();
  // bright at the cabinet, fading to nothing at its far end, as light through haze does
  g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: pts.length / 3 }, (_, i) => (i === 0 ? [1, 1, 1, 1] : [1, 1, 1, 0.3])).flat(), 4));
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
    const cabinets: { id: string; lit: THREE.MeshStandardMaterial[]; glow: THREE.Color; beam?: THREE.Mesh }[] = [];
    const st = makeStage(mount.current!, { camera: VIEWS.column!.from, target: VIEWS.column!.to, far: 1400, min: 2.5, max: 240, sun: [-55, 60, 50], shadow: 46, exposure: 0.95,
      onHover: setHover, onPick: setPicked,
      onFrame: () => { for (const c of cabinets) { const on = c.id === live.current.lit; for (const m of c.lit) { m.emissive.copy(c.glow); m.emissiveIntensity = on ? 0.55 : 0; } if (c.beam) { c.beam.visible = live.current.beams; (c.beam.material as THREE.MeshBasicMaterial).opacity = on ? 0.5 : 0.075; } } } });
    if (!st) { setFailed(true); return; }
    stage.current = st;
    const { scene } = st, built = new THREE.Group(); scene.add(built);
    sky(scene, 520);
    // the field, with marks every 20 metres so distances can be read
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), grass(260)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    for (let m = 20; m <= 120; m += 20) { const line = new THREE.Mesh(new THREE.PlaneGeometry(70, 0.22), new THREE.MeshBasicMaterial({ color: "#f3f1e6", transparent: true, opacity: 0.75 })); line.rotation.x = -Math.PI / 2; line.position.set(STAGE_X, 0.03, m); scene.add(line); }
    // the stage: a deck on a skirt, a roof on four truss legs, a black cloth behind
    const black = paint("#0d0c10", { roughness: 0.95 }), deckTop = plywood([8, 4], "#3b3531");
    built.add(box(22, 1.5, 12, STAGE_X, 0.75, -8, black), box(22, 0.06, 12, STAGE_X, 1.53, -8, deckTop), box(21, 9, 0.1, STAGE_X, 6, -13.6, black), box(23.2, 0.5, 13.2, STAGE_X, 11, -8, black));
    for (const x of [STAGE_X - 11, STAGE_X + 11]) for (const z of [-2.4, -13.6]) built.add(truss(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 10.8, z), 0.5));
    for (const z of [-2.4, -13.6]) built.add(truss(new THREE.Vector3(STAGE_X - 11, 10.5, z), new THREE.Vector3(STAGE_X + 11, 10.5, z), 0.5));
    // the columns, one each side of the stage: each cabinet hangs from the front bottom edge of the one above, tipped by the angles added up
    for (const cx of [0, 2 * STAGE_X]) {
      let y = TOP, z = 0;
      // a tower of truss either side, a beam across the top, two chain hoists and the flying frame the column hangs from
      const towerTop = TOP + 3.2;
      for (const side of [-1, 1]) built.add(truss(new THREE.Vector3(cx + side * 1.9, 0, -1.5), new THREE.Vector3(cx + side * 1.9, towerTop, -1.5), 0.45), box(1.2, 0.08, 1.2, cx + side * 1.9, 0.04, -1.5, steel("#7d8087", 0.6)),
        truss(new THREE.Vector3(cx + side * 0.6, towerTop, -1.7), new THREE.Vector3(cx + side * 0.6, towerTop, 0.1), 0.3));
      built.add(truss(new THREE.Vector3(cx - 2.2, towerTop, -1.5), new THREE.Vector3(cx + 2.2, towerTop, -1.5), 0.45));
      const frame = steel("#2a2a30", 0.5);
      built.add(box(1.5, 0.1, 0.08, cx, TOP + 0.09, -0.12, frame), box(1.5, 0.1, 0.08, cx, TOP + 0.09, -0.6, frame), box(0.08, 0.12, 0.62, cx - 0.6, TOP + 0.1, -0.36, frame), box(0.08, 0.12, 0.62, cx + 0.6, TOP + 0.1, -0.36, frame));
      for (const side of [-1, 1]) { const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, towerTop - TOP - 0.5, 6), steel("#9a9da3", 0.5)); chain.position.set(cx + side * 0.6, (towerTop + TOP) / 2 - 0.1, -0.36); built.add(chain, box(0.2, 0.34, 0.2, cx + side * 0.6, towerTop - 0.42, -0.36, paint("#c9a21b", { roughness: 0.5 }))); }
      ARENA_ARRAY.forEach((c, i) => {
        const spec = VERO[c.kind], h = spec.size[1], tilt = (angles[i]! * Math.PI) / 180, id = `a${i}`;
        const { group, lit } = cabinet(c.kind);
        group.position.set(cx, y, z); group.rotation.x = tilt; group.userData.id = id;
        let wedge: THREE.Mesh | undefined;
        if (spec.beam) {
          const far = Math.min(c.kind === "V60" ? 110 : 55, reach(y, angles[i]! + 0.001) * 1.15);
          wedge = new THREE.Mesh(beam(spec.beam.across, spec.beam.upDown, far), new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.075, vertexColors: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
          wedge.position.set(0, -h / 2, 0.12); wedge.raycast = () => {}; wedge.renderOrder = 2;
        }
        shadowed(group); if (wedge) group.add(wedge);
        scene.add(group); st.pickable.push(group); cabinets.push({ id, lit, glow: new THREE.Color(spec.color), beam: wedge });
        y -= h * Math.cos(tilt); z -= h * Math.sin(tilt);
      });
    }
    // bass cabinets on the ground in front of the stage
    const [sw, sh] = VERO.V221.size;
    for (let k = 0; k < SUBS; k++) {
      const { group, lit } = cabinet("V221");
      group.position.set(STAGE_X + (k - (SUBS - 1) / 2) * (sw + 0.04), sh, -0.6); group.userData.id = `s${k}`;
      shadowed(group); scene.add(group); st.pickable.push(group); cabinets.push({ id: `s${k}`, lit, glow: new THREE.Color(VERO.V221.color) });
    }
    shadowed(built);
    return () => { st.dispose(); stage.current = undefined; };
  }, []);

  const id = hover ?? picked, n = id?.startsWith("a") ? Number(id.slice(1)) : undefined;
  const kind: VeroKind | undefined = id === undefined ? undefined : n !== undefined ? ARENA_ARRAY[n]!.kind : "V221";
  const spec = kind ? VERO[kind] : undefined, tilt = n !== undefined ? angles[n]! : undefined;
  const lands = n !== undefined && spec?.beam ? reach(TOP - n * 0.43, tilt!) : undefined;
  return (
    <>
      <p className="muted">The system reported at Tipper's shows. This is the "typical 12-cabinet arena array" from Funktion-One's Vero user guide, hung to scale each side of a stage: four V60, three V315, two V90, one V315, two V90, from the top. Drag to walk round it; click a cabinet.</p>
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
            ) : <p className="muted">The dial on each cabinet's end tells the kinds apart, as on the real ones: blue is V60 (narrow beam), yellow is V90 (wide beam), red is V315 (mid-bass, with the open horn mouths). The top ones are tipped least, so their narrow beams carry furthest; each one lower is tipped a little more and covers nearer ground.</p>}
          </div>
        </div>
      </div>
      <p className="muted driver-draft">From the guide: the cabinets' sizes, which kinds hang where, the angles between them (pages 62, 67, 108 to 111), and each kind's coverage. The cabinets' look (curved grille, open horn mouths, steel end plates, coloured dials) follows the guide's photographs by eye. Drawn for illustration: the height of the columns, the towers and flying frame, the length of the beams, the number of bass cabinets, the stage, and the cabinets' exact outline and insides. Lines on the ground are 20 m apart.</p>
    </>
  );
}
