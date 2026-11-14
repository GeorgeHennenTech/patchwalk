// The loudspeaker of US patent 6,650,760 (Andrews, Hunt, Newsham; Funktion One; 2003), for the 3D cutaway.
// The shapes follow the patent's FIG. 1 and FIG. 2 by eye: proportions are approximate, and what matters is
// the order of things and whether the channel is widening or narrowing, which the patent states in words.
// It is the device the patent describes, not a drawing of the inside of any particular product.

/** Distances are in arbitrary units along the direction the sound travels; 0 is the plane of the baffle. */
export const BACK = -2.2, MOUTH = 20, HALF_HEIGHT = 3.2;
const lerp = (pts: readonly (readonly [number, number])[], z: number) => {
  if (z <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) if (z <= pts[i]![0]) { const [z0, v0] = pts[i - 1]!, [z1, v1] = pts[i]!; return v0 + ((v1 - v0) * (z - z0)) / (z1 - z0); }
  return pts[pts.length - 1]![1];
};
/** Radius of the cone (the diaphragm), from the pole piece out to its rim at the baffle. */
export const CONE: readonly (readonly [number, number])[] = [[BACK, 1.4], [0, 4.6]];
/** Radius of the central member: it swells inside the cone, tapers past the baffle, runs straight through the throat and ends in a rounded tip. */
export const MEMBER: readonly (readonly [number, number])[] = [[BACK, 1.0], [-0.2, 2.9], [0.2, 3.0], [6.5, 1.0], [9, 1.0], [9.5, 0.87], [9.85, 0.5], [10, 0]];
/** Half the width between the housing's side walls. The top and bottom are flat and parallel all the way. */
export const WALL: readonly (readonly [number, number])[] = [[0, 5.2], [6.5, 1.9], [9, 2.3], [MOUTH, 9.5]];
export const coneAt = (z: number) => lerp(CONE, z), memberAt = (z: number) => (z > 10 ? 0 : lerp(MEMBER, z)), wallAt = (z: number) => lerp(WALL, z);

/** The area open to the sound at one point along the channel: round inside the cone, a rectangle after it, less the plug. */
export function channelArea(z: number): number {
  const plug = Math.PI * memberAt(z) ** 2;
  return z < 0 ? Math.PI * coneAt(z) ** 2 - plug : 4 * wallAt(z) * HALF_HEIGHT - plug;
}

export interface HornStage { id: string; name: string; from: number; to: number; trend: "widens" | "narrows" | "widens slowly" | "widens quickly"; text: string }
export const STAGES: HornStage[] = [
  { id: "first", name: "First region", from: BACK, to: 0, trend: "widens", text: "Inside the cone, in the ring-shaped space between the cone and the plug. The room for the sound grows as it moves forward." },
  { id: "second", name: "Second region: the constriction", from: 0, to: 6.5, trend: "narrows", text: "Past the baffle the walls close in faster than the plug tapers, so the room for the sound shrinks. The patent says this is believed to lower the bottom of the horn's range from about 150 to 200 Hz down to about 75 Hz." },
  { id: "throat", name: "Throat", from: 6.5, to: 9, trend: "widens slowly", text: "The channel starts to open again, slowly. The plug stays about the same thickness along here." },
  { id: "horn", name: "Horn", from: 9, to: MOUTH, trend: "widens quickly", text: "The walls open much faster than in the throat, out to the mouth. The plug ends in a rounded tip at the start of the horn." },
];
export const stageAt = (z: number) => STAGES.find((s) => z <= s.to) ?? STAGES[STAGES.length - 1]!;

export const HORN_PARTS: Record<string, { name: string; text: string }> = {
  member: { name: "Central member (the plug)", text: "A solid, round plug fixed to the driver's pole piece. It reaches into the cone and on down the channel. The patent says it is believed to keep the upper part of the range coherent and to move the whole band upwards, and adds that the mechanism is not fully understood." },
  cone: { name: "Cone driver", text: "An ordinary cone loudspeaker driver. Its cone is the diaphragm that pushes the air. Behind it an enclosure forms a sealed chamber." },
  motor: { name: "Magnet and pole piece", text: "The driver's motor. The plug is attached to the pole piece at its centre." },
  baffle: { name: "Baffle", text: "The board the front of the driver is mounted on. The channel changes here from round, inside the cone, to rectangular." },
  housing: { name: "Housing", text: "The walls of the channel. It is rectangular in cross-section, and its top and bottom are flat and parallel: only its width changes. The top is left off here so you can see in." },
};
export const HORN_FACTS = "The patent says a loudspeaker of this kind can cover about a decade, from about 75 Hz to about 750 Hz, and typically gives 107 dB at one metre for one watt.";
