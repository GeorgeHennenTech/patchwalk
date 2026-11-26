// The drum rack's pads and patterns, as plain data and maths: no sound and no screen here, so lessons, tests
// and the Studio all work from the same rules. A pattern is a grid: one lane per pad, one cell per step,
// each cell off or struck at one of three strengths. A lane carries its pad's sound settings as well.

export const VOICES = ["kick", "snare", "clap", "hat", "openhat", "tomlow", "tomhigh", "rim", "ride", "ridebell", "crash", "shaker", "tambourine", "cowbell", "clave", "snap", "sub", "congahigh", "congalow", "mkick", "msnare", "mhat", "mohat"] as const;
/** The drums a new rack starts with. The ride bell is there to choose for a pad, not given a pad of its own. */
export const DEFAULT_VOICES = ["kick", "snare", "clap", "hat", "openhat", "tomlow", "tomhigh", "rim", "ride"] as const;
export type Voice = (typeof VOICES)[number];
export const VOICE_NAMES: Record<Voice, string> = { kick: "Kick", snare: "Snare", clap: "Clap", hat: "Closed hat", openhat: "Open hat", tomlow: "Low tom", tomhigh: "High tom", rim: "Rim", ride: "Ride", ridebell: "Ride bell", crash: "Crash", shaker: "Shaker", tambourine: "Tambourine", cowbell: "Cowbell", clave: "Clave", snap: "Finger snap", sub: "Long sub kick", congahigh: "High conga", congalow: "Low conga", mkick: "Kick (circuit model)", msnare: "Snare (circuit model)", mhat: "Closed hat (circuit model)", mohat: "Open hat (circuit model)" };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A cell: 0 is silent; 1 soft, 2 normal, 3 accented. */
export type Hit = 0 | 1 | 2 | 3;
/** How hard each strength is struck, as a fraction of full. */
export const STRENGTH: Record<Hit, number> = { 0: 0, 1: 0.45, 2: 0.75, 3: 1 };

/** One pad of the rack: what it plays and how. */
export interface Pad {
  id: string;
  name: string;
  /** The built-in drum it plays when it has no sound file of its own. */
  voice: Voice;
  /** The id of one of the learner's own sounds, kept in this browser; none means the built-in drum. */
  sample?: string;
  /** 0 to 100 */
  level: number;
  mute: boolean;
  solo: boolean;
  /** semitones up or down */
  tune: number;
  /** -100 (left) to 100 (right) */
  pan: number;
  /** Where in a sound file playing starts, as a percentage of its length, 0 to 95. */
  start: number;
  /** How much of what is left is played, 5 to 100 percent. */
  length: number;
  /** Fade-out at the end of what is played, in milliseconds. */
  fade: number;
  /** Pads in the same choke group (1 to 4) cut each other off; 0 is no group. */
  choke: number;
  /** Built-in drums only. How long it rings: percent of its usual length, 25 to 400 (left out means 100). */
  decay?: number;
  /** Built-in drums only. Darker (below 0) or brighter (above), -100 to 100: it moves the noise and metal parts' filters by up to an octave and a half (left out means 0). */
  tone?: number;
}
export interface Lane extends Pad { steps: Hit[] }
export const TUNE_MAX = 12, FADE_MAX = 2000, CHOKE_GROUPS = 4, MAX_PADS = 16;
/** How much faster or slower a sound is played for a tuning in semitones. */
export const tuneRate = (tune: number) => 2 ** (clamp(tune || 0, -TUNE_MAX, TUNE_MAX) / 12);
/** The part of a sound file `seconds` long that a pad plays: where it starts, how long it runs, and its fade, in seconds of the file. */
export function padWindow(pad: Pick<Pad, "start" | "length" | "fade">, seconds: number): { offset: number; span: number; fade: number } {
  const offset = seconds * clamp(pad.start, 0, 95) / 100, span = Math.max(0.001, (seconds - offset) * clamp(pad.length, 5, 100) / 100);
  return { offset, span, fade: Math.min(span, clamp(pad.fade, 0, FADE_MAX) / 1000) };
}

export interface Pattern {
  name: string;
  bpm: number;
  /** How late every second step is played, 0 to 75 (% of the way to the step after it). 0 is straight. */
  swing: number;
  /** Steps in the pattern: 16 is one bar of sixteenths, 32 is two. */
  /** steps: 16 a bar. The old single-pattern page knew 16 and 32; a Studio clip can be up to four bars. */
  length: number;
  lanes: Lane[];
}
export const STEPS_PER_BEAT = 4, STEPS_PER_BAR = 16, BPM_MIN = 60, BPM_MAX = 200, SWING_MAX = 75;

export const newPad = (id: string, voice: Voice, name: string = VOICE_NAMES[voice]): Pad => ({ id, name, voice, level: 80, mute: false, solo: false, tune: 0, pan: 0, start: 0, length: 100, fade: 0, choke: voice === "hat" || voice === "openhat" || voice === "mhat" || voice === "mohat" ? 1 : 0 });
/**
 * A sound file cut into equal slices, one pad each, in order: for chopping a break. A pad's length is a share
 * of what is left after its start, so slice i of n is 100 / (n - i) percent.
 */
export const SLICE_COUNTS = [4, 8, 16] as const;
export const slicePads = (sample: string, name: string, n: number): Pad[] => Array.from({ length: n }, (_, i) => ({ ...newPad(`s${i + 1}`, "kick", `${name.slice(0, 18)} ${i + 1}`), sample, start: Math.round((10000 * i) / n) / 100, length: Math.round(10000 / (n - i)) / 100 }));
/** The nine pads a new rack starts with. The two hats share a choke group, so a closed hat cuts a ringing open one. */
export const defaultPads = (): Pad[] => DEFAULT_VOICES.map((v) => newPad(v, v));
const silent = (length: number): Hit[] => Array.from({ length }, () => 0 as Hit);

export function emptyPattern(name = "New pattern", length: 16 | 32 = 16): Pattern {
  return { name, bpm: 120, swing: 0, length, lanes: defaultPads().map((pad) => ({ ...pad, steps: silent(length) })) };
}
/** Write a pattern from rows of 16 characters: "x" a hit, "X" an accent, "o" a soft hit, anything else silence. */
export function fromRows(name: string, bpm: number, rows: Partial<Record<Voice, string>>, swing = 0): Pattern {
  const p = emptyPattern(name, Object.values(rows).some((r) => r.replace(/\s/g, "").length > 16) ? 32 : 16);
  p.bpm = bpm; p.swing = swing;
  for (const lane of p.lanes) { const row = (rows[lane.voice] ?? "").replace(/\s/g, ""); lane.steps = lane.steps.map((_, i) => (row[i] === "X" ? 3 : row[i] === "x" ? 2 : row[i] === "o" ? 1 : 0)); }
  return p;
}
/** Starting points. These are common drum-machine shapes, not anyone's recorded beat. */
export const STARTERS: Pattern[] = [
  fromRows("Four on the floor", 124, { kick: "X...x...x...x...", clap: "....x.......x...", hat: "..x...x...x...x.", openhat: "..............o." }),
  fromRows("Backbeat", 96, { kick: "X.......x.x.....", snare: "....X.......X...", hat: "x.x.x.x.x.x.x.x." }),
  fromRows("Ride groove", 110, { kick: "X.....x...x.....", snare: "....X.......X...", ride: "x.o.x.o.x.o.x.ox", hat: "....o.......o..." }),
  fromRows("Half-time", 140, { kick: "X.....x...x.....", snare: "........X.......", hat: "x.o.x.o.x.o.x.oo", rim: "...x..........x." }),
  fromRows("Broken beat", 132, { kick: "X.....x..x......", snare: "....X.......X..o", hat: "x.xxx.x.x.xxx.x.", openhat: ".......o........" }, 12),
  fromRows("Shuffle", 100, { kick: "X..x....x..x....", snare: "....X.......X...", hat: "x.xxx.xxx.xxx.xx" }, 55),
];
/** Starting points by genre. Each is a common shape for that style of music, written for this page: not anyone's recorded beat. */
export const GENRE_STARTERS: Pattern[] = [
  fromRows("Glitch-hop", 105, { kick: "X.....x...x..o..", snare: "....X.......X...", hat: "x.xox.x.x.xox.xx", rim: ".......x........" }, 30),
  fromRows("Breakbeat", 135, { kick: "X.........x.....", snare: "....X..o.o..X...", hat: "x.x.x.x.x.x.x.x.", openhat: "..............o." }, 0),
  fromRows("Psydub", 85, { kick: "X......x..x.....", snare: "........X.......", hat: "..x...x...x...x.", rim: "...o.....o...o..", tomlow: ".............x.." }, 20),
  fromRows("Trip-hop", 84, { kick: "X..o......x.....", snare: "....X.......X.o.", hat: "x.x.x.x.x.x.x.x." }, 25),
  fromRows("Dubstep half-time", 140, { kick: "X.........x.....", snare: "........X.......", hat: "x...x.x.x...x.xo", rim: "......x........." }, 0),
  fromRows("Drum and bass", 172, { kick: "X.........x.....", snare: "....X.......X...", hat: "x.x.x.x.x.x.x.x.", openhat: "......o........." }, 0),
  fromRows("Two-step garage", 132, { kick: "X......x..x.....", clap: "....X.......X...", hat: "..x...x...x...x.", rim: ".x.......x......" }, 35),
  fromRows("Club pop", 128, { kick: "X...x...x...x...", clap: "....X.......X...", hat: "x.x.x.x.x.x.x.x.", openhat: "..o...o...o...o." }, 0),
  // More genres (26 Nov 2026, owner's list). Common shapes for each style, written for this page. The four "Eastern"
  // ones are the usual shapes of those Arabic rhythms with the low drum as "dum" and the rim as "tek", written from
  // memory: no text in the library backs them yet, so check them against a source before a lesson teaches them.
  fromRows("Trip-hop: heavy", 82, { kick: "X.....x..x......", snare: "....X.......X...", hat: "x.x.x.x.x.x.x.x.", openhat: "..............o." }, 20),
  fromRows("Trip-hop: sparse", 78, { kick: "X.........x..o..", snare: "........X.......", hat: "x...x...x...x.o.", rim: "......o........." }, 30),
  fromRows("Breaks: nu-skool", 135, { kick: "X.....x...x.....", snare: "....X.......X...", hat: "x.x.x.x.x.x.x.x.", openhat: "..o...o...o...o.", clap: "............x..." }, 0),
  fromRows("Breaks: skippy", 128, { kick: "X..x......x..x..", snare: "....X.......X...", hat: "x.xox.xox.xox.xo" }, 15),
  fromRows("Breaks: half-step", 136, { kick: "X.........x.x...", snare: "........X.....o.", hat: "x.x.x.x.x.x.x.x.", rim: "...x..x........." }, 0),
  fromRows("Breaks: with a fill", 134, { kick: "X.....x...x.....X.....x...x.....", snare: "....X.......X.......X.....x.xxXX", hat: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.....", tomhigh: "..........................x.x...", tomlow: "............................x.x." }, 0),
  fromRows("Big beat: stomp", 120, { kick: "X...x.x...x.x...", snare: "....X.......X...", hat: "x.x.x.x.x.x.x.x.", openhat: "..x...x...x...x.", clap: "....x.......x..." }, 0),
  fromRows("Big beat: funky", 114, { kick: "X..x..x...x.....", snare: "....X..o.o..X..o", hat: "x.xxx.xxx.xxx.xx" }, 10),
  fromRows("Big beat: ride", 126, { kick: "X.x.....x.x.....", snare: "....X.......X.x.", ride: "x...x...x...x...", hat: "..x...x...x...x." }, 0),
  fromRows("Jungle: rolling", 165, { kick: "X.x.......xx....", snare: "....X..o.o..X...", hat: "x.x.x.x.x.x.x.x." }, 0),
  fromRows("Jungle: chopped", 168, { kick: "X.....x..x......", snare: "....X.x....xX..o", hat: "x.x.x.x.x.x.x.x.", openhat: ".......o........" }, 0),
  fromRows("Jungle: two bars", 166, { kick: "X.x.......xx....X.x......x...x..", snare: "....X..o.o..X.......X..o.x..X.xx", hat: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.", ride: "x...x...x...x...x...x...x...x..." }, 0),
  fromRows("Liquid DnB: smooth", 174, { kick: "X.........x.....", snare: "....X.......X...", hat: "x.xox.xox.xox.xo", ride: "x...x...x...x...", rim: ".......o......o." }, 0),
  fromRows("Liquid DnB: rolling", 172, { kick: "X......x..x.....", snare: "....X.......X..o", hat: "x.x.x.x.x.x.x.x.", openhat: "......o.......o." }, 0),
  fromRows("Halftime DnB: deep", 170, { kick: "X.........x.....", snare: "........X.......", hat: "x...x...x...x.x.", rim: "......o......o.." }, 0),
  fromRows("Halftime DnB: stagger", 172, { kick: "X..x.........x..", snare: "........X.....o.", hat: "x.x.x.x.x.x.x.x.", tomlow: "..........x....." }, 0),
  fromRows("Glitch-hop: bounce", 100, { kick: "X..x......x..x..", snare: "....X.......X...", hat: "x.xox.xox.xox.xo", clap: "............x..." }, 35),
  fromRows("Glitch-hop: stutter kick", 110, { kick: "X.xx......x.x...", snare: "....X.......X.oo", hat: "x.x.xxx.x.x.xxx.", rim: ".......x.....x.." }, 25),
  fromRows("Dubstep: classic", 140, { kick: "X.....x.......x.", snare: "........X.......", hat: "x.x.x.x.x.x.x.x.", openhat: "....o.......o..." }, 0),
  fromRows("Dubstep: sparse", 140, { kick: "X..........x....", snare: "........X.......", hat: "..x...x...x...xx", rim: "......o........." }, 0),
  fromRows("UK garage: four to the floor", 130, { kick: "X...x...x...x...", clap: "....X.......X...", hat: "x.xxx.xxx.xxx.xx", rim: ".......x......x." }, 40),
  fromRows("UK garage: skippy", 134, { kick: "X.........x..x..", snare: "....X.......X...", hat: "x.xox.xox.xox.xo", rim: "...x.....x......" }, 45),
  fromRows("Footwork: basic", 160, { kick: "X..x..x...x..x..", clap: "....X.......X...", hat: "x.x.x.x.x.x.x.x." }, 0),
  fromRows("Footwork: threes", 160, { kick: "X..x..x..x..x...", clap: "........X.......", hat: "..x...x...x...x.", rim: "......x......x.." }, 0),
  fromRows("Juke: claps", 160, { kick: "X..x..x.X..x..x.", clap: "....x..x....x.xx", hat: "x.x.x.x.x.x.x.x.", tomhigh: "..............x." }, 0),
  fromRows("Club pop: snare build", 128, { kick: "X...x...x...x...", clap: "....X.......X...", hat: "..x...x...x...x.", snare: "........o.o.oooo" }, 0),
  fromRows("Club pop: electro house", 128, { kick: "X...x...x...x...", clap: "....X.......X...", hat: "x.x.x.x.x.x.x.x.", openhat: "..x...x...x...x.", rim: ".......x.......x" }, 0),
  fromRows("Psydub: steppers", 88, { kick: "X...x...x...x...", rim: "....x.......x...", hat: "..x...x...x...x.", tomlow: "..........o..o.." }, 15),
  fromRows("Psydub: tribal", 84, { kick: "X......x..x.....", snare: "........X.......", tomlow: "...x..x......x..", tomhigh: ".....o......o...", hat: "x.x.x.x.x.x.x.x." }, 20),
  fromRows("Reggae: one drop", 76, { kick: "........X.......", rim: "........X.......", hat: "x.x.x.x.x.x.x.x.", openhat: "..............o." }, 30),
  fromRows("Reggae: rockers", 78, { kick: "X.......x.......", snare: "........X.......", hat: "x.x.x.x.x.x.x.x.", rim: "....o.......o..." }, 30),
  fromRows("Dub: steppers", 72, { kick: "X...x...x...x...", rim: "........X.......", hat: "..x...x...x...x.", openhat: "......o.......o." }, 20),
  fromRows("Eastern: maqsum", 100, { tomlow: "X.......X.......", rim: "..x...x.....x...", hat: "....o.....o...o." }, 0),
  fromRows("Eastern: baladi", 96, { tomlow: "X.X.....X.......", rim: "......x.....x...", hat: "....o.....o...o." }, 0),
  fromRows("Eastern: saidi", 104, { tomlow: "X.....X.X.......", rim: "..x.........x...", hat: "....o.....o...o." }, 0),
  fromRows("Eastern: ayoub", 112, { tomlow: "X...X...X...X...", rim: "...x..x....x..x.", hat: ".o...o...o...o.." }, 0),
  fromRows("Electro: classic", 125, { kick: "X.....x...x.x...", snare: "....X.......X...", hat: "x.x.x.x.x.x.x.x.", clap: "....x.......x...", openhat: "..............o." }, 0),
  fromRows("Electro: broken", 128, { kick: "X..x....x.x.....", snare: "....X.......X..x", hat: "xxx.xxx.xxx.xxx.", tomlow: "..............x." }, 0),
  fromRows("Electro: rim funk", 120, { kick: "X.....x..x..x...", clap: "....X.......X...", rim: "..x..x....x..x..", hat: "x.x.x.x.x.x.x.x." }, 0),
  // Funk and jazz (27 Nov 2026). The swung "Jazz" ones (and the bossa) are written with one step as an EIGHTH note, so the
  // tempo shown is half the tempo felt (70 here is a medium swing at 140) and one clip bar is two bars of music;
  // "Jazz: fusion" and "Jazz: hip-hop swing" are ordinary sixteenths. No waltz: a clip cannot be in three yet.
  fromRows("Funk: on the one", 100, { kick: "X.....x...x..x..", snare: "....X..o.o..X..o", hat: "x.x.x.x.x.x.x.x." }, 0),
  fromRows("Funk: sixteenth hats", 96, { kick: "X..x......x.x...", snare: "....X.......X...", hat: "XoxoXoxoXoxoXoxo" }, 0),
  fromRows("Funk: syncopated kick", 104, { kick: "X..x..x...x....x", snare: "....X..o....X.o.", hat: "x.x.x.x.x.x.x.x.", openhat: "..............o." }, 0),
  fromRows("Funk: ghost notes", 98, { kick: "X.....x.x.....x.", snare: "..o.X.oo.o.oX.o.", hat: "x.x.x.x.x.x.x.x." }, 0),
  fromRows("Funk: open hat barks", 108, { kick: "X..x....x.x.....", snare: "....X.......X...", hat: "x.x.x...x.x.x...", openhat: "......x.......x." }, 0),
  fromRows("Funk: linear", 100, { kick: "X.....x..x......", snare: "....X.......X...", hat: "..xx.x.xx.xx.xxx" }, 0),
  fromRows("Funk: half-time shuffle", 90, { kick: "X.........x.....", snare: "..o...o.X.o...o.", hat: "x.xxx.xxx.xxx.xx" }, 60),
  fromRows("Funk: street beat", 96, { kick: "X.....x...x.x...", snare: "x.ox.ox.x.ox.oxX", openhat: "..............o." }, 45),
  fromRows("Funk: disco funk", 112, { kick: "X...x...x...x...", snare: "....X.......X...", hat: "xoxoxoxoxoxoxoxo", openhat: "..x...x...x...x." }, 0),
  fromRows("Funk: two bars", 102, { kick: "X.....x...x..x..X..x..x...x.....", snare: "....X..o.o..X.......X..o....X.oo", hat: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.", openhat: "..............o...............o." }, 0),
  fromRows("Jazz: swing ride", 70, { ride: "x.xxx.xxx.xxx.xx", hat: "..x...x...x...x.", kick: "o...o...o...o...", snare: "...........o...." }, 62),
  fromRows("Jazz: comping", 75, { ride: "x.xxx.xxx.xxx.xx", hat: "..x...x...x...x.", snare: "...o......o..o..", kick: ".......x........" }, 62),
  fromRows("Jazz: slow swing", 60, { ride: "x.xxx.xxx.xxx.xx", hat: "..x...x...x...x.", snare: ".....o.......o..", kick: "o.......o......." }, 64),
  fromRows("Jazz: shuffle", 65, { hat: "xxxxxxxxxxxxxxxx", snare: "..X...X...X...X.", kick: "x...x...x...x..." }, 62),
  fromRows("Jazz: bossa nova", 70, { rim: "x..x..x...x..x..", hat: "xxxxxxxxxxxxxxxx", kick: "x..xx..xx..xx..x" }, 0),
  fromRows("Jazz: fusion", 110, { kick: "X..x..x..x....x.", snare: "....X..o.o..X...", ride: "x.x.x.x.x.x.x.x.", hat: "..x...x...x...x." }, 0),
  fromRows("Jazz: hip-hop swing", 88, { kick: "X......x..x.....", snare: "....X.......X...", ride: "x.x.x.x.x.x.x.x.", rim: ".......o.....o.." }, 55),
  fromRows("Jazz: four bars with bombs", 72, { ride: "x.xxx.xxx.xxx.xxx.xxx.xxx.xxx.xx", hat: "..x...x...x...x...x...x...x...x.", snare: "...o......o..o.......o...o....oo", kick: "o...o...o..x....o...o.....x.o..." }, 62),
  fromRows("Glitch stutter", 110, { kick: "X.....x...x.....X..x..x...x.....", snare: "....X.......X.......X.......X.xx", hat: "x.xox.x.xxxox.x.x.xox.xxx.x.oooo", tomhigh: "...............x.............o.." }, 15),
  // Boom bap: slow, swung, a heavy kick and a snare on beats 2 and 4, soft "ghost" hits between
  fromRows("Boom bap: classic", 90, { kick: "X......x..x.....", snare: "....X.......X...", hat: "x.x.x.x.x.x.x.x." }, 40),
  fromRows("Boom bap: lazy kick", 86, { kick: "X..o......xo....", snare: "....X.......X...", hat: "x.xox.x.x.xox.x.", openhat: "..............o." }, 50),
  fromRows("Boom bap: ghost snares", 92, { kick: "X.....x...x..x..", snare: "....X..o.o..X..o", hat: "x.x.x.x.x.x.x.x.", rim: "..............o." }, 45),
  fromRows("Boom bap: two bars", 88, { kick: "X......x..x.....X..x......x..x..", snare: "....X.......X.......X.......X.o.", hat: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.xo", openhat: "..............................o." }, 45),
  // Breakbeat: a syncopated kick, snares on 2 and 4 with extra hits pushed off the beat
  fromRows("Breaks: rolling", 132, { kick: "X.x.......x.....", snare: "....X..o....X...", hat: "x.x.x.x.x.x.x.x.", openhat: "......o........." }, 8),
  fromRows("Breaks: late kick", 130, { kick: "X......x.x......", snare: "....X.......X..o", hat: "x.xxx.x.x.xxx.x.", rim: ".........o......" }, 10),
  fromRows("Breaks: busy snare", 138, { kick: "X.....x...x..x..", snare: "....X.o..o..X.oo", hat: "x.x.x.x.x.x.x.x.", ride: "x...x...x...x..." }, 0),
  fromRows("Breaks: two bars", 134, { kick: "X.........x.....X.x....x..x.....", snare: "....X..o.o..X.......X.......X.xo", hat: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.", openhat: "..............o...............o." }, 6),
];

const withLane = (p: Pattern, index: number, change: (l: Lane) => Lane): Pattern => ({ ...p, lanes: p.lanes.map((l, i) => (i === index ? change(l) : l)) });
/** Set one cell. */
export const setHit = (p: Pattern, lane: number, step: number, hit: Hit): Pattern => withLane(p, lane, (l) => ({ ...l, steps: l.steps.map((h, i) => (i === step ? hit : h)) }));
/** A struck cell's next strength: normal, accent, soft, and round again. A silent cell stays silent. */
export const nextStrength = (hit: Hit): Hit => (hit === 0 ? 0 : hit === 2 ? 3 : hit === 3 ? 1 : 2);
export type PadChange = Partial<Pick<Pad, "name" | "voice" | "level" | "mute" | "solo" | "tune" | "pan" | "start" | "length" | "fade" | "choke" | "decay" | "tone">>;
/** A pad's settings after a change, each kept in its range. */
export function tidyPad<T extends Pad>(pad: T, change: PadChange = {}): T {
  const l = { ...pad, ...change };
  return { ...l, name: (String(l.name ?? "").slice(0, 24).trim() || VOICE_NAMES[l.voice]), level: clamp(Number(l.level) || 0, 0, 100), tune: clamp(Math.round(Number(l.tune) || 0), -TUNE_MAX, TUNE_MAX), pan: clamp(Math.round(Number(l.pan) || 0), -100, 100),
    start: clamp(Math.round((Number(l.start) || 0) * 100) / 100, 0, 95), length: clamp(Math.round((Number(l.length ?? 100) || 0) * 100) / 100, 5, 100),
    ...(Number.isFinite(Number(l.decay)) && l.decay !== undefined && Math.round(Number(l.decay)) !== 100 ? { decay: clamp(Math.round(Number(l.decay)), 25, 400) } : { decay: undefined }), ...(Number.isFinite(Number(l.tone)) && l.tone !== undefined && Math.round(Number(l.tone)) !== 0 ? { tone: clamp(Math.round(Number(l.tone)), -100, 100) } : { tone: undefined }), fade: clamp(Math.round(Number(l.fade) || 0), 0, FADE_MAX), choke: clamp(Math.round(Number(l.choke) || 0), 0, CHOKE_GROUPS), mute: l.mute === true, solo: l.solo === true };
}
export const setLane = (p: Pattern, lane: number, change: PadChange): Pattern => withLane(p, lane, (l) => tidyPad(l, change));
/** Give a pad one of the learner's own sounds, or (with no id) go back to the built-in drum. */
export const setSample = (p: Pattern, lane: number, id?: string): Pattern => withLane(p, lane, (l) => { const { sample: _old, ...rest } = l; return id ? { ...rest, sample: id } : rest; });
/** Take a sound off every pad that uses it. */
export const dropSample = (p: Pattern, id: string): Pattern => ({ ...p, lanes: p.lanes.map((l) => { if (l.sample !== id) return l; const { sample: _old, ...rest } = l; return rest; }) });
/** A new pad's id: one no other pad has. */
export const freeId = (taken: readonly string[], stem = "pad"): string => { let n = 1; while (taken.includes(`${stem}${n}`)) n++; return `${stem}${n}`; };
/** Add a pad (and its empty row). Nothing happens when the rack is full. */
export function addPad(p: Pattern, voice: Voice = "kick", name?: string): Pattern {
  if (p.lanes.length >= MAX_PADS) return p;
  return { ...p, lanes: [...p.lanes, { ...newPad(freeId(p.lanes.map((l) => l.id)), voice, name ?? `Pad ${p.lanes.length + 1}`), steps: silent(p.length) }] };
}
/** Remove a pad and its row. The last pad stays. */
export const removePad = (p: Pattern, lane: number): Pattern => (p.lanes.length <= 1 ? p : { ...p, lanes: p.lanes.filter((_, i) => i !== lane) });
export const clearLane = (p: Pattern, lane: number): Pattern => withLane(p, lane, (l) => ({ ...l, steps: l.steps.map(() => 0 as Hit) }));
export const clearAll = (p: Pattern): Pattern => ({ ...p, lanes: p.lanes.map((l) => ({ ...l, steps: l.steps.map(() => 0 as Hit) })) });
/** Change the pattern's length: going to two bars repeats the first bar; going back keeps the first. */
export function setLength(p: Pattern, length: 16 | 32): Pattern {
  if (length === p.length) return p;
  return { ...p, length, lanes: p.lanes.map((l) => ({ ...l, steps: length === 32 ? [...l.steps, ...l.steps] : l.steps.slice(0, 16) })) };
}
export const setTempo = (p: Pattern, bpm: number): Pattern => ({ ...p, bpm: clamp(Math.round(bpm), BPM_MIN, BPM_MAX) });
export const setSwing = (p: Pattern, swing: number): Pattern => ({ ...p, swing: clamp(Math.round(swing), 0, SWING_MAX) });

/** Seconds from one step to the next, straight. */
export const stepSeconds = (bpm: number) => 60 / clamp(bpm, BPM_MIN, BPM_MAX) / STEPS_PER_BEAT;
/** When step `n` (counting on for ever, not wrapping) is played, in seconds from the start: every second step is pushed late by the swing. */
export function stepTime(n: number, bpm: number, swing: number): number {
  const s = stepSeconds(bpm);
  return n * s + (n % 2 === 1 ? (clamp(swing, 0, SWING_MAX) / 100) * s : 0);
}
/** Which of some pads (or tracks) sound: if any is soloed, only those; otherwise every one that is not muted. */
export function audibleOf(items: readonly { mute: boolean; solo: boolean }[]): boolean[] {
  const solo = items.some((l) => l.solo);
  return items.map((l) => (solo ? l.solo : !l.mute));
}
export const audible = (p: Pattern): boolean[] => audibleOf(p.lanes);
export interface Strike { pad: Pad; /** seconds from the start */ at: number; /** 0..1 */ strength: number; step: number }
/**
 * Every drum hit from step `from` up to but not including step `until` (steps count on for ever; the
 * pattern repeats). This decides what is heard and when, so the sound and the tests cannot drift apart.
 */
export function strikes(p: Pattern, from: number, until: number): Strike[] {
  const on = audible(p), out: Strike[] = [];
  for (let n = from; n < until; n++) {
    const step = ((n % p.length) + p.length) % p.length;
    p.lanes.forEach((l, i) => { const hit = l.steps[step] ?? 0; if (hit && on[i] && l.level > 0) out.push({ pad: l, at: stepTime(n, p.bpm, p.swing), strength: STRENGTH[hit] * (l.level / 100), step }); });
  }
  return out;
}
const isVoice = (v: unknown): v is Voice => (VOICES as readonly unknown[]).includes(v);
/** Pads read back from storage, made safe. Anything that is not a pad is dropped; ids are made different. */
export function tidyPads(raw: unknown): Pad[] {
  const out: Pad[] = [];
  for (const got of Array.isArray(raw) ? raw : []) {
    if (!got || typeof got !== "object" || !isVoice((got as Pad).voice) || out.length >= MAX_PADS) continue;
    const g = got as Partial<Pad>, taken = out.map((p) => p.id);
    const id = typeof g.id === "string" && /^[\w-]{1,24}$/.test(g.id) && !taken.includes(g.id) ? g.id : taken.includes(g.voice!) ? freeId(taken) : g.voice!;
    const pad = tidyPad({ ...newPad(id, g.voice!), ...(typeof g.name === "string" ? { name: g.name } : {}), level: g.level ?? 80, mute: g.mute === true, solo: g.solo === true, tune: g.tune ?? 0, pan: g.pan ?? 0, start: g.start ?? 0, length: g.length ?? 100, fade: g.fade ?? 0, ...(g.choke !== undefined ? { choke: g.choke } : {}) });
    out.push(typeof g.sample === "string" && g.sample && g.sample.length <= 64 ? { ...pad, sample: g.sample } : pad);
  }
  return out;
}
export const tidySteps = (raw: unknown, length: number): Hit[] => Array.from({ length }, (_, i) => { const h = Number((raw as unknown[] | undefined)?.[i]); return (h === 1 || h === 2 || h === 3 ? h : 0) as Hit; });
/** A pattern read back from storage, made safe: anything missing or out of range is put right, anything unknown dropped. */
export function tidyPattern(raw: unknown): Pattern | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<Pattern>, length = r.length === 32 ? 32 : 16, base = emptyPattern(typeof r.name === "string" ? r.name.slice(0, 40) : "Pattern", length);
  base.bpm = clamp(Math.round(Number(r.bpm) || 120), BPM_MIN, BPM_MAX); base.swing = clamp(Math.round(Number(r.swing) || 0), 0, SWING_MAX);
  const given = Array.isArray(r.lanes) ? r.lanes.filter((l) => l && typeof l === "object" && isVoice(l.voice)).slice(0, MAX_PADS) : [], pads = tidyPads(given);
  if (pads.length) base.lanes = pads.map((pad, i) => ({ ...pad, steps: tidySteps(given[i]!.steps, length) }));
  return base;
}
