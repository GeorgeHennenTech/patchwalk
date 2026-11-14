// The horn of US patent 6,650,760 with its top off: turn it, point at its parts, and follow the sound from
// the cone to the mouth while a bar shows how much room the channel gives it.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BACK, channelArea, CONE, coneAt, HALF_HEIGHT, HORN_FACTS, HORN_PARTS, MEMBER, MOUTH, STAGES, stageAt, WALL, wallAt } from "../soundsystems/horn";
import { paper, plywood, shadowed, steel, studio } from "./three/look";
import { makeStage } from "./three/stage";

const H = HALF_HEIGHT, T = 0.3;
const MAX_AREA = channelArea(MOUTH);
const mat = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: new THREE.Color("#ff2e93"), emissiveIntensity: 0, side: THREE.DoubleSide, ...o });
/** Spin an outline of (radius, distance along the channel) round the channel's axis. `half` keeps the lower half only. */
function spun(points: readonly (readonly [number, number])[], half: boolean): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(points.map(([z, r]) => new THREE.Vector2(Math.max(r, 0.0001), z)), 48, half ? -Math.PI / 2 : 0, half ? Math.PI : Math.PI * 2);
  g.rotateX(Math.PI / 2); // the lathe spins round "up"; lay it along the channel
  return g;
}
/** A flat outline in (across, along) made `depth` thick, standing with its thickness up and down. */
function slab(outline: [number, number][], depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape(); outline.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.rotateX(Math.PI / 2);
  return g;
}

export default function HornCutaway() {
  const mount = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string>(), [hover, setHover] = useState<string>();
  const [z, setZ] = useState(BACK), [failed, setFailed] = useState(false);
  const live = useRef({ lit: undefined as string | undefined, z: BACK });
  live.current.lit = hover ?? picked; live.current.z = z;

  useEffect(() => {
    const parts: Record<string, THREE.Mesh[]> = {};
    const marker = new THREE.Group();
    const st = makeStage(mount.current!, { camera: [-24, 22, -4], target: [0, -1.5, 9], min: 8, max: 90, sun: [-24, 20, -14], shadow: 34, exposure: 0.92, onHover: setHover, onPick: setPicked,
      onFrame: () => {
        for (const [id, meshes] of Object.entries(parts)) for (const m of meshes) { const mm = m.material as THREE.MeshStandardMaterial; mm.emissive.set("#ff2e93"); mm.emissiveIntensity = id === live.current.lit ? 0.3 : 0; }
        // the marker: a frame the size of the channel where the sound has got to
        const at = live.current.z, w = at < 0 ? coneAt(at) : wallAt(at), h = at < 0 ? coneAt(at) : H;
        marker.position.z = at; marker.scale.set(w, h, 1); marker.children.forEach((c, i) => { c.visible = (at < 0) === (i === 0); });
      } });
    if (!st) { setFailed(true); return; }
    const add = (id: string, geo: THREE.BufferGeometry, material: THREE.Material, place?: (m: THREE.Mesh) => void) => { const m = new THREE.Mesh(geo, material); m.userData.id = id; place?.(m); st.scene.add(m); st.pickable.push(m); (parts[id] ??= []).push(m); };
    studio(st.scene, -H - T - 0.02, 40);
    const wood = () => { const w = plywood([3, 1]); w.side = THREE.DoubleSide; return w; }, pulp = paper("#26232c"); pulp.side = THREE.DoubleSide;
    const magnet = steel("#8d9199", 0.42); magnet.side = THREE.DoubleSide; magnet.emissive = new THREE.Color("#000");
    add("member", spun(MEMBER, false), mat("#d9a441", { roughness: 0.32, metalness: 0.15 }));
    add("cone", spun(CONE.map(([zz, r]) => [zz, r] as const), true), pulp);
    add("motor", spun([[BACK - 1.5, 0], [BACK - 1.5, 2.7], [BACK - 0.25, 2.7], [BACK - 0.25, 1.0], [BACK, 1.0], [BACK, 0]], true), magnet);
    add("baffle", spun([[-0.18, 4.6], [-0.18, 6.6], [0.18, 6.6], [0.18, 4.6], [-0.18, 4.6]], true), wood());
    // the housing: two side walls that follow the channel's width, and a floor; the top is left off
    for (const side of [1, -1]) {
      const inner = WALL.map(([zz, w]) => [side * w, zz] as [number, number]), outer = [...WALL].reverse().map(([zz, w]) => [side * (w + T), zz] as [number, number]);
      add("housing", slab([...inner, ...outer], 2 * H), wood(), (m) => { m.position.y = H; });
    }
    add("housing", slab([...WALL.map(([zz, w]) => [w + T, zz] as [number, number]), ...[...WALL].reverse().map(([zz, w]) => [-(w + T), zz] as [number, number])], T), wood(), (m) => { m.position.y = -H; });
    for (const meshes of Object.values(parts)) for (const m of meshes) shadowed(m);
    // the marker's two forms: a ring inside the cone, a rectangle after it (each drawn at size 1 and scaled)
    const glow = new THREE.LineBasicMaterial({ color: "#ff2e93" });
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, i) => new THREE.Vector3(Math.cos((i / 64) * 2 * Math.PI), Math.sin((i / 64) * 2 * Math.PI), 0))), glow);
    const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new THREE.Vector3(x!, y!, 0))), glow);
    marker.add(ring, frame); st.scene.add(marker);
    return () => st.dispose();
  }, []);

  const stage = stageAt(z), area = channelArea(z), part = HORN_PARTS[(hover ?? picked) ?? ""];
  return (
    <>
      <p className="muted">A horn from a Funktion One patent (US 6,650,760, granted 2003), with its top taken off. This is the device the patent describes; it is not a drawing of the inside of a Vero or of any particular cabinet.</p>
      <div className="driver-grid">
        <div className="driver-stage three" ref={mount} role="img" aria-label="A horn loudspeaker with its top removed: a cone driver at the back, a plug running down the middle of the channel, walls that close in and then open out to the mouth">
          {failed && <p className="driver-failed">This browser could not start 3D drawing.</p>}
        </div>
        <div className="driver-side">
          <div className="driver-parts" role="group" aria-label="Parts">
            {Object.entries(HORN_PARTS).map(([id, p]) => <button key={id} className={id === (hover ?? picked) ? "on" : ""} aria-pressed={id === picked} onClick={() => setPicked(id === picked ? undefined : id)} onPointerEnter={() => setHover(id)} onPointerLeave={() => setHover(undefined)}>{p.name}</button>)}
          </div>
          <div className="driver-info" role="status">
            {part ? <><h3>{part.name}</h3><p>{part.text}</p></> : <><h3>{stage.name}</h3><p>{stage.text}</p></>}
          </div>
        </div>
      </div>
      <div className="driver-controls">
        <label className="driver-slider">
          <span>Follow the sound</span>
          <input type="range" min={BACK} max={MOUTH} step={0.1} value={z} onChange={(e) => { setZ(Number(e.target.value)); setPicked(undefined); }} aria-valuetext={`${stage.name}: the channel ${stage.trend}`} />
          <output>{stage.name.split(":")[0]}</output>
        </label>
        <div className="driver-parts" role="group" aria-label="Jump to a part of the channel">
          {STAGES.map((s) => <button key={s.id} className={s.id === stage.id ? "on" : ""} onClick={() => { setZ((s.from + s.to) / 2); setPicked(undefined); }}>{s.name.split(":")[0]}</button>)}
        </div>
      </div>
      <div className="horn-room" aria-label={`Room for the sound here: ${Math.round((area / MAX_AREA) * 100)} percent of the mouth. The channel ${stage.trend}.`}>
        <span>Room for the sound here</span>
        <div className="horn-room-bar"><i style={{ width: `${Math.max(1.5, (area / MAX_AREA) * 100)}%` }} /></div>
        <strong>{stage.trend}</strong>
      </div>
      <p className="muted">{HORN_FACTS}</p>
      <p className="muted driver-draft">Drawn after FIG. 1 and FIG. 2 of the patent, by eye: the order of the parts and where the channel widens and narrows are the patent's; the exact proportions are not. The patent's text and drawings are in the library.</p>
    </>
  );
}
