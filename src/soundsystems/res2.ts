// Funktion-One's Resolution 2 ("Res 2"), for its interactive model. Sizes are from the maker's own drawing
// (library/cad/funktion-one/R2-webdxf.dxf, millimetres, read with ezdxf); everything else is from the maker's
// Res 2 spec sheet (library book "funktion-one-documents", page 537). What neither says is said to be unknown.

/** Metres. The cabinet body: its front, its back (it narrows by 28 degrees), its height and depth. */
export const RES2 = { front: 0.522, back: 0.344, height: 0.92, depth: 0.445, depthOnWheelboard: 0.56, flypointsApart: 0.81, taper: 28, weightKg: 48,
  coverage: { across: 50, upDown: 25 }, lowest: 60, highest: 18000, crossover: 250, bassFrom: 35, page: 537 } as const;

/** Openings in the front, in metres from the left edge and from the top, measured off the drawing's front view. */
export const OPENINGS = {
  mid: { x0: 0.059, x1: 0.464, y0: 0.051, y1: 0.3 },
  high: { x0: 0.186, x1: 0.338, y0: 0.341, y1: 0.428 },
  bass: { x0: 0.016, x1: 0.506, y0: 0.558, y1: 0.905 },
} as const;
export type Res2Band = "below" | "bass" | "midhigh" | "above";

/** Which part of the cabinet a frequency comes out of, by the sheet's figures. */
export function bandAt(hz: number): Res2Band {
  return hz < RES2.lowest ? "below" : hz < RES2.crossover ? "bass" : hz <= RES2.highest ? "midhigh" : "above";
}
export const BAND_TEXT: Record<Res2Band, { title: string; text: string }> = {
  below: { title: "Below this cabinet’s range", text: "The sheet gives 60 Hz as the bottom of its response (3 dB down). The 15-inch still moves below that, but less and less comes out. This is why the sheet says a Res 2 system can be supplemented with separate bass cabinets." },
  bass: { title: "The bass horn: the 15-inch", text: "From the bottom of its range up to 250 Hz the sound comes from the 15-inch driver, through the big horn mouth in the lower half. It has an amplifier channel of its own." },
  midhigh: { title: "The mid and high horns: the 8-inch and the 1-inch", text: "From 250 Hz up the sound comes from the upper half: the 8-inch midrange through the large horn, handing over to the 1-inch through the small horn below it. These two share one amplifier channel and a passive crossover inside the cabinet. The sheet does not say at what frequency the 8-inch hands over." },
  above: { title: "Above this cabinet’s range", text: "The sheet gives 18 kHz as the top of its response (3 dB down)." },
};

export interface Res2Part { id: string; name: string; job: string; lights: Res2Band[] }
export const RES2_PARTS: Res2Part[] = [
  { id: "bassHorn", name: "Bass horn", job: "The big opening in the lower half, split down the middle. The sound of the 15-inch driver comes out here: 35 to 250 Hz by the sheet’s crossover figures.", lights: ["bass"] },
  { id: "midHorn", name: "Mid horn", job: "The large flared opening in the upper half, for the 8-inch midrange driver. The cabinet is fully horn loaded: every driver plays through a horn, which is where its efficiency comes from.", lights: ["midhigh"] },
  { id: "plug", name: "Shape in the mid horn", job: "The drawing shows a shaped piece sitting in the middle of the mid horn’s mouth. The sheet does not name it or say what it does, so nothing is claimed about it here.", lights: [] },
  { id: "highHorn", name: "High horn", job: "The small opening under the mid horn, for the 1-inch high-frequency driver.", lights: ["midhigh"] },
  { id: "body", name: "Cabinet", job: "522 mm wide at the front, 920 mm high, 445 mm deep, narrowing by 28° to 344 mm at the back, so cabinets can stand side by side in a curve. 48 kg.", lights: [] },
  { id: "fly", name: "Flypoints", job: "Threaded M10 points for hanging the cabinet, 810 mm apart up each side.", lights: [] },
  { id: "plate", name: "Connectors", job: "Two Neutrik NL4 sockets on the back. The cabinet is “three-way, bi-amp”: two amplifier channels come in, one for the 15-inch and one shared by the 8-inch and the 1-inch.", lights: [] },
];

/** How wide and how tall the cabinet's stated coverage is at a distance, in metres. Geometry only. */
export function spread(distance: number): { wide: number; tall: number } {
  const half = (deg: number) => Math.tan(((deg / 2) * Math.PI) / 180);
  return { wide: 2 * distance * half(RES2.coverage.across), tall: 2 * distance * half(RES2.coverage.upDown) };
}
/** The nearest note to a frequency, as "A1": for tying a tone to the keyboard. */
export function noteNear(hz: number): string {
  const n = Math.round(69 + 12 * Math.log2(hz / 440));
  return `${["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}
/** Things a producer makes, placed roughly on the frequency scale so the slider has landmarks. Rough, by convention. */
export const LANDMARKS: { label: string; hz: number }[] = [
  { label: "Sub bass", hz: 45 }, { label: "Kick thump", hz: 80 }, { label: "Bass note", hz: 110 }, { label: "Snare body", hz: 200 },
  { label: "Voice", hz: 1000 }, { label: "Presence", hz: 4000 }, { label: "Hi-hat", hz: 9000 }, { label: "Air", hz: 16000 },
];

/** How far apart to draw wavefronts: one wavelength, or every nth front when they would sit closer than 12 cm. */
export function frontGap(hz: number): { wavelength: number; every: number; shown: number } {
  const wavelength = 343 / hz, every = Math.max(1, Math.ceil(0.12 / wavelength));
  return { wavelength, every, shown: wavelength * every };
}
