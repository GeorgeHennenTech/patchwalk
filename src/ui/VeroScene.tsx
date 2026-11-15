// A Vero column you can walk round: the guide's typical 12-cabinet arena array, hung to scale, with the
// beams of the mid-high cabinets and bass cabinets on the ground. Figures are from the Vero user guide.
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { aimedAt, ARENA_ARRAY, columnFacts, EAR, footprint, hang, MAX_ANGLE, MAX_CABINETS, MIN_CABINETS, reach, tilts, travelTime, VERO, zones, type VeroKind } from "../soundsystems/vero";
import { grass, grille, paint, paper, plywood, shadowed, sign, sky, steel, truss } from "./three/look";
import { makeStage, type Stage } from "./three/stage";

const TOP_START = 11;     // height of the top of the column above the ground, metres (illustrative; the learner can change it)
const SUBS = 8;           // bass cabinets drawn in the row (illustrative)
const STAGE_X = 12;       // the middle of the stage; the second column hangs as far to its other side
const VIEWS: Record<string, { label: string; from: [number, number, number]; to: [number, number, number] }> = {
  column: { label: "The column", from: [-4.6, 9.4, 7.6], to: [0, 8.9, -0.2] },
  stage: { label: "The stage", from: [-6, 5, 34], to: [STAGE_X, 5.5, -2] },
  side: { label: "From the side", from: [-46, 9, 24], to: [0, 4, 24] },
  field: { label: "The whole field", from: [-62, 74, 78], to: [6, 0, 52] },
};
const SLOWED = 30;        // the ripples on the ground travel this many times slower than sound
const FAR = 125;          // the furthest a landing mark is drawn, metres
const metres = (d: number) => `${d < 10 ? d.toFixed(1) : Math.round(d)} m`;
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
  const [beams, setBeams] = useState(false), [measures, setMeasures] = useState(true), [failed, setFailed] = useState(false);
  const [map, setMap] = useState(true), [stand, setStand] = useState(40);
  const live = useRef({ lit: undefined as string | undefined, beams: false, measures: true, map: true, stand: 40 });
  live.current.lit = hover ?? picked; live.current.beams = beams; live.current.measures = measures; live.current.map = map; live.current.stand = stand;
  // the column itself can be changed: which cabinets, the angle under each, and how high it hangs
  const [array, setArray] = useState(ARENA_ARRAY), [TOP, setTop] = useState(TOP_START);
  const angles = tilts(array), HANG = useMemo(() => hang(array, TOP), [array, TOP]), ZONES = useMemo(() => zones(array, TOP), [array, TOP]);
  const own = array !== ARENA_ARRAY || TOP !== TOP_START, facts = columnFacts(array, TOP);
  const seen = useRef<{ p: [number, number, number]; t: [number, number, number] } | undefined>(undefined); // where the camera was, kept across a rebuild
  const edit = (i: number, change: Partial<(typeof array)[number]>) => setArray(array.map((c, k) => { if (k !== i) return c; const next = { ...c, ...change }; return { ...next, angleBelow: Math.min(next.angleBelow, MAX_ANGLE[next.kind]) }; }));

  useEffect(() => {
    const cabinets: { id: string; lit: THREE.MeshStandardMaterial[]; glow: THREE.Color; beam?: THREE.Mesh }[] = [];
    // measurements: `rule` is always there (distances along the field, heights up the tower); `landing` is for the cabinet pointed at
    const rule = new THREE.Group(), landing = new THREE.Group(), cover = new THREE.Group(); let shown: string | undefined;
    const flat = (pts: [number, number][], color: string, opacity: number) => { // a patch lying on the ground, corners as (x, z)
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flatMap(([x, z]) => [x, 0.06, z]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, fog: false })); m.raycast = () => {}; return m;
    };
    const land = (id: string | undefined) => {
      for (const o of [...landing.children]) { landing.remove(o); (o as THREE.Mesh).geometry?.dispose(); }
      const n = id?.startsWith("a") ? Number(id.slice(1)) : undefined; if (n === undefined) return;
      const spec = VERO[array[n]!.kind], at = HANG[n]!; if (!spec.beam) return;
      const { near, far } = footprint(at.height, at.tilt, spec.beam.upDown), end = Math.min(far, FAR), half = Math.tan(((spec.beam.across / 2) * Math.PI) / 180), z0 = -at.back;
      if (near < end) landing.add(flat([[-near * half, z0 + near], [near * half, z0 + near], [end * half, z0 + end], [-end * half, z0 + end]], spec.color, 0.42));
      // the middle of the beam, from the cabinet to where it meets the ground
      const mid = Math.min(reach(at.height, at.tilt), FAR), drop = Number.isFinite(reach(at.height, at.tilt)) && mid < FAR ? 0.1 : at.height - mid * Math.tan((at.tilt * Math.PI) / 180);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, at.height, z0), new THREE.Vector3(0, drop, z0 + mid)]), new THREE.LineBasicMaterial({ color: spec.color, fog: false })); line.raycast = () => {}; landing.add(line);
      const tag = (text: string, z: number) => { const s = sign(text, 2.1, { fill: spec.color, ink: "#16121c" }); s.position.set(0, 1.6, z0 + z); landing.add(s); };
      if (near < FAR) tag(`starts ${metres(near)}`, near);
      tag(Number.isFinite(far) && far <= FAR ? `ends ${metres(far)}` : "carries on past the field", end);
      const here = sign(`${metres(at.height)} up · tipped ${at.tilt}°`, 0.42, { fill: spec.color, ink: "#16121c" }); here.position.set(-2.1, at.height, z0 + 0.4); landing.add(here);
    };
    const st = makeStage(mount.current!, { camera: seen.current?.p ?? VIEWS.column!.from, target: seen.current?.t ?? VIEWS.column!.to, far: 1400, min: 2.5, max: 240, sun: [-55, 60, 50], shadow: 46, exposure: 0.95,
      onHover: setHover, onPick: setPicked,
      onFrame: (t) => { cover.visible = live.current.map; if (cover.visible) coverFrame(t); rule.visible = live.current.measures; landing.visible = live.current.measures; if (shown !== live.current.lit) { shown = live.current.lit; land(shown); } for (const c of cabinets) { const on = c.id === live.current.lit; for (const m of c.lit) { m.emissive.copy(c.glow); m.emissiveIntensity = on ? 0.55 : 0; } if (c.beam) { c.beam.visible = live.current.beams; (c.beam.material as THREE.MeshBasicMaterial).opacity = on ? 0.5 : 0.075; } } } });
    if (!st) { setFailed(true); return; }
    stage.current = st;
    const { scene } = st, built = new THREE.Group(); scene.add(built);
    sky(scene, 520);
    // the field, with marks every 20 metres so distances can be read
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), grass(260)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    scene.add(rule, landing, cover);
    // who covers where: the ground painted by the cabinet pointed at each stretch, ripples running out along it, and a listener
    const halfAt = (index: number) => Math.tan(((VERO[array[index]!.kind].beam!.across / 2) * Math.PI) / 180);
    ZONES.forEach((z, k) => {
      const kind = VERO[array[z.index]!.kind], h = halfAt(z.index);
      cover.add(flat([[-z.from * h, z.from], [z.from * h, z.from], [z.to * h, z.to], [-z.to * h, z.to]], z.inside ? kind.color : "#8a8791", z.inside ? (kind.kind === "V60" ? 0.62 : 0.5) - (k % 2 ? 0 : 0.14) : 0.22));
      if (z.to - z.from >= 5) { const s = sign(z.inside ? `cabinet ${z.index + 1} · ${kind.kind}` : "between beams", 1.3 + z.from * 0.035, z.inside ? { fill: kind.color, ink: "#16121c" } : {}); s.position.set(((z.from + z.to) / 2) * h * 0.55, 1.6, (z.from + z.to) / 2); cover.add(s); }
    });
    const ripples = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: 0.85, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.09; m.raycast = () => {}; cover.add(m); return m; });
    const person = new THREE.Group(), pink = new THREE.MeshStandardMaterial({ color: "#ff2e93", emissive: new THREE.Color("#ff2e93"), emissiveIntensity: 0.4 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 1.4, 12), pink); torso.position.y = 0.7; const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), pink); head.position.y = EAR;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 40), new THREE.MeshBasicMaterial({ color: "#ff2e93", side: THREE.DoubleSide, fog: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.11;
    person.add(torso, head, ring); person.traverse((o) => { o.raycast = () => {}; }); cover.add(person);
    const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: "#ff2e93", fog: false })); ray.raycast = () => {}; ray.frustumCulled = false; cover.add(ray);
    const coverFrame = (t: number) => {
      const span = 116, speed = 343 / SLOWED;
      ripples.forEach((m, k) => {
        const d = 4 + ((t * speed + (k * span) / ripples.length) % span), z = ZONES.find((q) => d >= q.from && d < q.to);
        m.visible = !!z?.inside; if (!z?.inside) return;
        m.position.z = d; m.scale.x = 2 * d * halfAt(z.index); (m.material as THREE.MeshBasicMaterial).color.set("#ffffff").lerp(new THREE.Color(VERO[array[z.index]!.kind].color), 0.35);
      });
      const d = live.current.stand, a = aimedAt(array, TOP, d);
      person.position.z = d;
      if (a) { const from = HANG[a.index]!, pos = ray.geometry.attributes.position as THREE.BufferAttribute; pos.setXYZ(0, 0, from.height, -from.back); pos.setXYZ(1, 0, EAR, d); pos.needsUpdate = true; }
    };
    for (let m = 10; m <= 120; m += 10) {
      if (m % 20) { const tick = new THREE.Mesh(new THREE.PlaneGeometry(70, 0.08), new THREE.MeshBasicMaterial({ color: "#f3f1e6", transparent: true, opacity: 0.4 })); tick.rotation.x = -Math.PI / 2; tick.position.set(STAGE_X, 0.03, m); rule.add(tick); continue; }
      for (const x of [STAGE_X - 37, STAGE_X + 37]) { const s = sign(`${m} m`, 2.4); s.position.set(x, 1.5, m); rule.add(s); }
    }
    // a height scale up the near tower: a tick every metre, a figure every two
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.05, TOP + 3.2, 0.05), new THREE.MeshBasicMaterial({ color: "#f3f1e6" })); pole.position.set(-2.7, (TOP + 3.2) / 2, -1.2); rule.add(pole);
    for (let hgt = 1; hgt <= TOP + 3; hgt++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(hgt % 2 ? 0.2 : 0.36, 0.035, 0.05), new THREE.MeshBasicMaterial({ color: "#f3f1e6" })); tick.position.set(-2.7 - (hgt % 2 ? 0.1 : 0.18), hgt, -1.2); rule.add(tick);
      if (hgt % 2 === 0) { const s = sign(`${hgt} m`, 0.42); s.position.set(-3.5, hgt, -1.2); rule.add(s); }
    }
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
      array.forEach((c, i) => {
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
    return () => { seen.current = { p: st.camera.position.toArray() as [number, number, number], t: st.controls.target.toArray() as [number, number, number] }; st.dispose(); stage.current = undefined; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [array, TOP]);

  const id = hover ?? picked, nRaw = id?.startsWith("a") ? Number(id.slice(1)) : undefined, n = nRaw !== undefined && nRaw < array.length ? nRaw : undefined;
  const kind: VeroKind | undefined = id === undefined ? undefined : n !== undefined ? array[n]!.kind : "V221";
  const spec = kind ? VERO[kind] : undefined, tilt = n !== undefined ? angles[n]! : undefined;
  const at = n !== undefined ? HANG[n] : undefined;
  const lands = at && spec?.beam ? reach(at.height, at.tilt) : undefined, covers = at && spec?.beam ? footprint(at.height, at.tilt, spec.beam.upDown) : undefined;
  return (
    <>
      <p className="muted">The system reported at Tipper's shows. {own ? "This is your own column, changed from the guide’s array under “Build your own column” below." : "This is the \"typical 12-cabinet arena array\" from Funktion-One's Vero user guide, hung to scale each side of a stage: four V60, three V315, two V90, one V315, two V90, from the top."} Drag to walk round it; click a cabinet.</p>
      <div className="driver-grid">
        <div className="driver-stage three" ref={mount} role="img" aria-label="A column of twelve loudspeaker cabinets hanging beside a stage, with coloured beams showing where each one sends its sound, and bass cabinets on the ground">
          {failed && <p className="driver-failed">This browser could not start 3D drawing.</p>}
        </div>
        <div className="driver-side">
          <div className="driver-parts" role="group" aria-label="Views">
            {Object.entries(VIEWS).map(([k, v]) => <button key={k} onClick={() => stage.current?.lookFrom(v.from, v.to)}>{v.label}</button>)}
            <button aria-pressed={map} className={map ? "on" : ""} onClick={() => setMap((m) => !m)}>Who covers where</button>
            <button aria-pressed={beams} className={beams ? "on" : ""} onClick={() => setBeams((b) => !b)}>Beams</button>
            <button aria-pressed={measures} className={measures ? "on" : ""} onClick={() => setMeasures((m) => !m)}>Measurements</button>
          </div>
          <div className="driver-parts vero-key" role="group" aria-label="Cabinets in the column, top to bottom">
            {array.map((c, i) => <button key={i} style={{ borderColor: VERO[c.kind].color }} className={id === `a${i}` ? "on" : ""} aria-pressed={picked === `a${i}`} onClick={() => setPicked(picked === `a${i}` ? undefined : `a${i}`)} onPointerEnter={() => setHover(`a${i}`)} onPointerLeave={() => setHover(undefined)}>{i + 1} · {c.kind}</button>)}
          </div>
          <div className="driver-info" role="status">
            {spec ? (
              <>
                <h3>{spec.name}{n !== undefined && ` · cabinet ${n + 1} from the top`}</h3>
                <p>{spec.job}</p>
                <p className="muted">{spec.drivers}. {spec.band}. {spec.coverage}. {spec.weight}.</p>
                {at && <p>The middle of its front hangs {metres(at.height)} above the ground.</p>}
                {covers && <p>By its coverage angle, its beam reaches the ground from about {metres(covers.near)} out{Number.isFinite(covers.far) ? ` to about ${metres(covers.far)}` : " and its top edge never comes down: it carries over the whole audience"}.</p>}
                {tilt !== undefined && <p>Tipped down {tilt}° from level{lands !== undefined && (Number.isFinite(lands) ? `, so the middle of its beam meets the ground about ${Math.round(lands)} m out` : ", so its beam runs level over the audience")}.</p>}
                <p className="muted">Vero user guide, page {spec.page}.</p>
              </>
            ) : <p className="muted">The dial on each cabinet's end tells the kinds apart, as on the real ones: blue is V60 (narrow beam), yellow is V90 (wide beam), red is V315 (mid-bass, with the open horn mouths). The top ones are tipped least, so their narrow beams carry furthest; each one lower is tipped a little more and covers nearer ground.</p>}
          </div>
        </div>
      </div>
      {map && (() => {
        const a = aimedAt(array, TOP, stand), c = a ? array[a.index]! : undefined, far = a ? Math.hypot(stand + HANG[a.index]!.back, HANG[a.index]!.height - EAR) : stand;
        return (
          <div className="vero-stand">
            <label className="driver-slider"><span>Stand</span><input type="range" min={3} max={118} step={1} value={stand} onChange={(e) => setStand(Number(e.target.value))} aria-valuetext={`${stand} metres from the column`} /><output>{stand} m out</output></label>
            <div className="vero-hears" role="status">
              <p><strong>Standing {stand} m out, on the pink ring.</strong></p>
              <ul>
                <li><b style={{ background: c ? VERO[c.kind].color : "#8a8791" }} /> <span><strong>Mids and highs (200 Hz up):</strong> {a && c ? (a.inside ? `cabinet ${a.index + 1}, a ${c.kind}, is the one pointed at you (the pink line). You are ${a.off.toFixed(1)}° off the middle of its beam.` : `you are between beams here: the nearest aim is cabinet ${a.index + 1} (${c.kind}), and you are ${a.off.toFixed(1)}° off it, outside its stated ${VERO[c.kind].beam!.upDown}°. ${stand < 15 ? "This close you are under the column; rigs put small fill speakers along the stage for the front rows." : ""}`) : ""}</span></li>
                <li><b style={{ background: VERO.V315.color }} /> <span><strong>Mid-bass (50 to 250 Hz):</strong> the four red V315s in the column. The guide gives them 70° across; how tall their beam is depends on how many hang together, so no patch is drawn for them.</span></li>
                <li><b style={{ background: VERO.V221.color }} /> <span><strong>Bass (40 to 150 Hz):</strong> the cabinets on the ground. Bass this low spreads widely, so it is not drawn as a beam.</span></li>
              </ul>
              <p className="muted">The sound from that cabinet takes about {(travelTime(far) * 1000).toFixed(0)} ms to reach you ({far.toFixed(0)} m at 343 m a second). The white ripples show it travelling, {SLOWED} times slower than real.</p>
            </div>
          </div>
        );
      })()}
      <details className="vero-build">
        <summary>Build your own column{own ? " (changed from the guide’s)" : ""}</summary>
        <p className="muted">Change which cabinet hangs where, the angle under each one, and how high the column hangs. The picture, the painted ground and the listener’s panel all follow. A bigger angle under a cabinet tips everything below it further down, so their sound lands nearer the stage.</p>
        <ol className="vero-rows">
          {array.map((c, i) => (
            <li key={i} style={{ borderColor: VERO[c.kind].color }}>
              <span className="vero-n">{i + 1}</span>
              <select value={c.kind} aria-label={`Cabinet ${i + 1}: kind`} onChange={(e) => edit(i, { kind: e.target.value as VeroKind })}>{(["V60", "V90", "V315"] as VeroKind[]).map((k2) => <option key={k2} value={k2}>{k2}</option>)}</select>
              {i < array.length - 1 ? <label>angle below <input type="number" min={0} max={MAX_ANGLE[c.kind]} step={0.5} value={c.angleBelow} aria-label={`Cabinet ${i + 1}: degrees between it and the one below`} onChange={(e) => edit(i, { angleBelow: Math.max(0, Math.min(MAX_ANGLE[c.kind], Number(e.target.value) || 0)) })} />°</label> : <span className="muted">bottom of the column</span>}
              <span className="muted">tipped {angles[i]}°</span>
              <button className="link" disabled={array.length <= MIN_CABINETS} aria-label={`Remove cabinet ${i + 1}`} onClick={() => setArray(array.filter((_, k2) => k2 !== i))}>Remove</button>
            </li>
          ))}
        </ol>
        <p>
          <button disabled={array.length >= MAX_CABINETS} onClick={() => setArray([...array, { kind: array[array.length - 1]!.kind, angleBelow: 0 }])}>Add a cabinet at the bottom</button>{" "}
          <label className="driver-slider tone"><span>Top of the column</span><input type="range" min={5} max={18} step={0.5} value={TOP} onChange={(e) => setTop(Number(e.target.value))} /><output>{TOP} m</output></label>{" "}
          {own && <button className="link" onClick={() => { setArray(ARENA_ARRAY); setTop(TOP_START); }}>Back to the guide’s array</button>}
        </p>
        <p role="status">{array.length} cabinets, {facts.length.toFixed(1)} m of column, about {Math.round(facts.weightKg)} kg in all. Its lowest point is {facts.bottom.toFixed(1)} m above the ground{facts.bottom < 0.5 ? ": that is on or in the ground, so raise the column or take cabinets off" : ""}. {!array.some((c) => c.kind === "V315") && "With no V315 in it, this column has no mid-bass of its own."} {!array.some((c) => VERO[c.kind].beam) && "With no V60 or V90, nothing in it carries the mids and highs."}</p>
        <p className="muted">Angle limits: V60 up to 6° and V90 up to 12.5°, the guide’s own figures for unbroken coverage. The 6° limit under a V315 is this page’s, not the guide’s. The page does not check that a real column could be flown this way: the maker’s Projection software does that.</p>
      </details>
      <p className="muted driver-draft">From the guide: the cabinets' sizes, which kinds hang where, the angles between them (pages 62, 67, 108 to 111), and each kind's coverage. The cabinets' look (curved grille, open horn mouths, steel end plates, coloured dials) follows the guide's photographs by eye. Drawn for illustration: the height of the columns, the towers and flying frame, the length of the beams, the number of bass cabinets, the stage, and the cabinets' exact outline and insides. Bold lines on the ground are 20 m apart, faint ones 10 m, measured from the front of the top cabinet. "Who covers where" paints each stretch of ground in the colour of the mid-high cabinet pointed most nearly at a listener standing there (ears 1.7 m up), from the left-hand column only; grey means outside every cabinet's stated angle. In life the cabinets overlap and blend rather than hand over at a line. The "starts" and "ends" marks are straight-line geometry from each cabinet's height, tilt and coverage angle; real sound fades past an edge, it does not stop there, and with the columns' height being illustrative so are these distances.</p>
    </>
  );
}
