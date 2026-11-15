// Lessons added after their chapters were first written, for controls that arrived later: the peak and shelf
// filter types, the second filter, Osc B's own voices and warp, and the order of the effects. Each is slotted
// into its chapter just before that chapter's checkpoint (see index.ts).
import { SHAPE_MAX_DB } from "../../synth/filter";
import { fxOrderOf } from "../../synth/fx";
import { foldGain, stepCount } from "../../synth/params";
import type { DemoTone, PlayableLesson, Snapshot } from "../types";

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const K = ["keyboard", "hold"] as const;
const struck = (s: Snapshot) => s.played.mouse + s.played.keys + s.played.midi;
const swept = (s: Snapshot, id: keyof Snapshot["range"], lo: number, hi: number) => !!s.range[id] && s.range[id]!.min <= lo && s.range[id]!.max >= hi;
const tones = (list: DemoTone["patch"][], len = 1.4, gap = 0.3, note = 45): DemoTone[] => list.map((patch, i) => ({ patch, note, at: i * (len + gap), seconds: len }));
const hz = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)} kHz` : `${Math.round(n)} Hz`);
const before = (s: Snapshot, a: string, b: string) => { const o = fxOrderOf(s.state.fxOrder) as string[]; return o.indexOf(a) < o.indexOf(b); };

const SAW = { shape: "saw" } as const;
const PEAK = { ...SAW, filterOn: true, filterType: "peak", cutoff: 1000, resonance: 0 } as const;
const TWO = { ...SAW, filterOn: true, filterType: "low", cutoff: 2000 } as const;
const B_START = { bOn: true, bShape: "saw", bLevelDb: -6 } as const;
const B_ONLY = { aOn: false, bOn: true, bShape: "saw", bLevelDb: -6 } as const;
const ORDER = ["comp", "chorus", "delay", "eq", "dist", "reverb"];
const GRIT = { ...SAW, distOn: true, distType: "hard", distDrive: 55, distMix: 100, reverbOn: true, reverbSize: 2, reverbMix: 35, fxOrder: ORDER } as const;

export const FILTER_ADDITIONS: PlayableLesson[] = [
  {
    id: "C2.8", title: "Peak and shelf", buildsOn: ["C2.2", "C2.3"], minutes: 7, cardIds: ["filter-types-and-slope"], initial: { ...PEAK },
    outcome: "Lift one band of a sound with Peak, and turn the top down without removing it with Shelf.",
    demo: { caption: "A plain saw, then a band lifted low, then lifted high, then the top turned down with a shelf.", tones: tones([{ ...SAW }, { ...PEAK, cutoff: 500, resonance: 80 }, { ...PEAK, cutoff: 2500, resonance: 80 }, { ...PEAK, filterType: "shelf", cutoff: 800, resonance: 100 }]) },
    idea: [
      "Low-pass, high-pass, band-pass and notch all take something away. Peak takes nothing away: it lifts a band around the cutoff and leaves everything else as it was. It is the resonant bump on its own, without the cut.",
      "Shelf turns down everything above the cutoff by a set amount and then stops. A low-pass keeps cutting harder the higher you go; a shelf steps down and stays level, so the top is quieter but still there. On both types the Resonance knob sets how much.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. The type is Peak, with Resonance at 0.", show: [...K, "filterType", "resonance", "curve", "spectrum"], hear: "A plain saw. The curve is a flat line: with nothing lifted, Peak changes nothing.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "Turn Resonance up past 60%.", show: [...K, "resonance", "curve", "spectrum"], hear: "One band stands out, like a voice saying a vowel. The bass and the top are as loud as before.", target: "Peak, resonance at 60% or more", check: (s) => s.state.filterType === "peak" && s.state.resonance >= 60,
        remark: (s) => `At ${s.state.resonance}% the band around ${hz(s.state.cutoff)} is lifted about ${Math.round((s.state.resonance / 100) * SHAPE_MAX_DB)} dB. Nothing else has moved.` },
      { do: "Sweep Cutoff slowly from below 400 Hz to above 3 kHz.", show: [...K, "cutoff", "curve", "spectrum"], hear: "The lifted band travels up through the sound, and the vowel changes as it goes. The note never gets duller or thinner.", target: "Cutoff taken below 400 Hz and above 3 kHz", check: (s) => s.state.filterType === "peak" && swept(s, "cutoff", 400, 3000) },
      { do: "Change the type to Shelf and set Cutoff near 800 Hz, Resonance at 100%.", show: [...K, "filterType", "cutoff", "resonance", "curve", "spectrum"], hear: "Softer on top, but the top is still there. The curve steps down and then runs level.", target: "Shelf, cutoff between 500 Hz and 1.2 kHz, resonance at 100%", check: (s) => s.state.filterType === "shelf" && between(s.state.cutoff, 500, 1200) && s.state.resonance === 100 },
      { do: "Change the type to Low-pass and compare, then go back to Shelf.", show: [...K, "filterType", "curve", "spectrum"], hear: "The low-pass removes the top bars altogether. The shelf only turns them down.", target: "Low-pass tried, then Shelf chosen again", check: (s) => s.state.filterType === "shelf" && (s.changes.filterType ?? 0) >= 2 },
    ],
    recap: ["Peak lifts a band around the cutoff and leaves everything else alone.", "Shelf turns everything above the cutoff down by a set amount, without removing it.", "On both, the Resonance knob sets how much."],
    inSerum: "Serum's filter menu lists Band/Peak/Notch types (page 136 of its guide). How the height of its peak is set is not confirmed, so nothing is checked. Listening only.",
  },
  {
    id: "C2.9", title: "Two filters", buildsOn: ["C2.3"], minutes: 9, cardIds: ["two-filters"], initial: { ...TWO },
    outcome: "Use a second filter after the first to leave a band, and beside the first to leave a hole.",
    demo: { caption: "A low-pass alone, then a high-pass after it (a band), then the two side by side set wide apart (a hole in the middle).", tones: tones([{ ...TWO }, { ...TWO, cutoff: 1200, filter2On: true, filter2Type: "high", cutoff2: 600 }, { ...TWO, cutoff: 200, filter2On: true, filter2Type: "high", cutoff2: 4000, filterRoute: "parallel" }]) },
    idea: [
      "Two filters can be joined in two ways. One after the other, the second filter only gets what the first let through, so each removes more: what you hear is what passes both.",
      "Side by side, each filter hears the whole sound and their outputs are added: what you hear is what passes either. The same two filters give opposite results depending on which way they are joined.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note, then switch on Filter 2. It starts as a high-pass at 200 Hz.", show: [...K, "filter2On", "filter2Type", "cutoff2", "curve", "spectrum"], hear: "A little bass goes. The curve now falls away at both ends.", target: "A note held, Filter 2 on", check: (s) => s.held.length >= 1 && s.state.filter2On },
      { do: "Raise Filter 2's cutoff to about 600 Hz.", show: [...K, "cutoff2", "curve", "spectrum"], hear: "Thinner: the low bars sink. The curve is a hill with the sound that is left under it.", target: "Filter 2 cutoff between 450 and 800 Hz, sitting after filter 1", check: (s) => s.state.filter2On && s.state.filterRoute === "series" && between(s.state.cutoff2, 450, 800) },
      { do: "Lower filter 1's Cutoff to about 1.2 kHz.", show: [...K, "cutoff", "cutoff2", "curve", "spectrum"], hear: "A narrow, boxy band, like a small radio. Each filter has taken its own end away.", target: "Filter 1 cutoff between 900 Hz and 1.5 kHz", check: (s) => s.state.filter2On && s.state.filterRoute === "series" && between(s.state.cutoff, 900, 1500) && between(s.state.cutoff2, 450, 800),
        remark: (s) => `What is left runs from about ${hz(s.state.cutoff2)} to ${hz(s.state.cutoff)}: ${Math.log2(s.state.cutoff / s.state.cutoff2).toFixed(1)} octaves wide.` },
      { do: "Change where Filter 2 sits to Beside filter 1.", show: [...K, "filterRoute", "curve", "spectrum"], hear: "Nearly everything comes back, and louder. Whatever one filter removes, the other lets through.", target: "Filter 2 beside filter 1", check: (s) => s.state.filter2On && s.state.filterRoute === "parallel" },
      { do: "Still side by side: take filter 1's Cutoff down to about 200 Hz and Filter 2's cutoff up to about 4 kHz.", show: [...K, "cutoff", "cutoff2", "curve", "spectrum"], hear: "Bass and fizz with the middle scooped out. The curve is a valley.", target: "Filter 1 cutoff at 300 Hz or lower, Filter 2 cutoff at 3 kHz or higher, side by side", check: (s) => s.state.filter2On && s.state.filterRoute === "parallel" && s.state.cutoff <= 300 && s.state.cutoff2 >= 3000 },
      { do: "Without touching the cutoffs, change Filter 2 back to After filter 1.", show: [...K, "filterRoute", "curve", "spectrum"], hear: "Almost nothing. The first filter keeps only the bass, and the second then removes the bass.", target: "Filter 2 after filter 1, cutoffs as they were", check: (s) => s.state.filter2On && s.state.filterRoute === "series" && s.state.cutoff <= 300 && s.state.cutoff2 >= 3000 },
    ],
    recap: ["One after the other, each filter removes more: only what passes both is left.", "Side by side, the outputs are added: what passes either one is heard.", "A low-pass and a high-pass leave a band when in a row, and a hole in the middle when side by side."],
    inSerum: "Serum has two filters. Its routing options include sending a filter's signal on to the other filter or to the main output (page 149 of its guide), which is how two filters end up one after the other or side by side. Listening only.",
  },
];

export const OSC_ADDITIONS: PlayableLesson[] = [
  {
    id: "C1.10", title: "Osc B: more voices and a bent wave", buildsOn: ["C1.5", "C1.9"], minutes: 7, cardIds: ["unison-detune"], initial: { ...B_START },
    outcome: "Thicken Osc B with its own unison voices and reshape its wave with its own warp, separately from Osc A.",
    demo: { caption: "Osc B alone: one voice, then five voices spread apart in pitch, then the same with its wave bent by Sync.", tones: tones([{ ...B_ONLY }, { ...B_ONLY, bVoices: 5, bDetune: 25 }, { ...B_ONLY, bVoices: 5, bDetune: 25, bWarp: "sync", bWarpAmount: 60 }], 1.8) },
    idea: [
      "Osc B is a full oscillator in its own right. It has its own unison: several copies of itself, each a little apart in pitch, which drift against one another and make one note sound like many players.",
      "It also has its own warp, so its wave can be reshaped without touching Osc A. Two oscillators that differ in thickness and in shape give far more to work with than two copies of the same thing.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. Osc A is off, so this is Osc B alone: one saw.", show: [...K, "bOn", "scope", "spectrum"], preset: { aOn: false }, hear: "A plain, steady saw.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "Set B's Voices to 3 or more and its Detune to about 25 cents.", show: [...K, "bVoices", "bDetune", "scope", "spectrum"], hear: "Thick and slowly swirling. The scope no longer stands still.", target: "Three or more voices, detune between 15 and 40 cents", check: (s) => s.state.bVoices >= 3 && between(s.state.bDetune, 15, 40) },
      { do: "Turn B's Detune down to 0.", show: [...K, "bDetune", "scope", "spectrum"], hear: "The swirl stops dead. The voices are still there, but with no difference in pitch nothing drifts.", target: "Detune at 0, three or more voices", check: (s) => s.state.bVoices >= 3 && s.state.bDetune === 0 },
      { do: "Bring Detune back to about 20 cents. Set B's Warp to Sync and turn its amount past 50%.", show: [...K, "bDetune", "bWarp", "bWarpAmount", "scope", "spectrum"], hear: "Brighter and harder, still thick. The picture of B's wave shows extra teeth.", target: "Sync, amount at 50% or more, detune between 10 and 40 cents", check: (s) => s.state.bWarp === "sync" && s.state.bWarpAmount >= 50 && between(s.state.bDetune, 10, 40) },
      { do: "Switch Osc A on.", show: [...K, "aOn", "bOn", "scope", "spectrum"], hear: "A's single plain voice under B's thick, bent one. Each oscillator keeps its own character.", target: "Osc A and Osc B both on, B still with three or more voices", check: (s) => s.state.aOn && s.state.bOn && s.state.bVoices >= 3 },
    ],
    recap: ["Osc B has its own unison: several voices slightly apart in pitch make it thick and moving.", "With detune at zero the voices stop drifting and the movement goes.", "Osc B has its own warp, so its wave can be reshaped separately from Osc A's."],
    inSerum: "In Serum each oscillator's panel has its own UNISON and DETUNE controls and its own warp menu (the oscillator panel is shown on page 49 of its guide). Listening only.",
  },
];

const TB = ["table", "position", "scope", "spectrum"] as const;
export const TABLE_ADDITIONS: PlayableLesson[] = [
  {
    id: "C1.11", title: "Shapes from classic synths", buildsOn: ["C1.3"], minutes: 9, cardIds: ["wavetable"], initial: { shape: "sine" },
    outcome: "Play four wavetables built from published formulas, and hear what each classic method does to a wave.",
    demo: { caption: "Each table swept from one end to the other: Phase saw, Analogue saw, Phase pulse, Formant.", tones: (["pdsaw", "moogsaw", "pdpulse", "formant"] as const).flatMap((table, i) => [0, 50, 100].map((position, k) => ({ patch: { table, position }, note: 45, at: i * 1.9 + k * 0.55, seconds: 0.5 }))) },
    idea: [
      "Some classic digital synths made their tones without a filter. The Casio CZ series read a plain sine at an uneven speed, hurrying through part of the cycle and dawdling through the rest. The more uneven the reading, the further the sine bends toward a saw or a pulse, and the brighter it sounds. This is called phase distortion.",
      "Researchers have also measured what analogue synths really put out. A saw recorded from a Minimoog Voyager turned out rounder than the textbook saw, and rounder still on high notes. The four tables here are built by this app from the formulas in those papers; nothing is copied from any synth.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. Choose the wavetable Phase saw. Position starts at 0.", show: [...K, ...TB], hear: "A pure sine: at position 0 the reading speed is even, so nothing is bent.", target: "A note held, Phase saw chosen", check: (s) => s.held.length >= 1 && s.state.table === "pdsaw" },
      { do: "Sweep Position slowly from 0 to 100%.", show: [...K, ...TB], hear: "The sine leans over into a saw and gets steadily brighter, as if a filter were opening. There is no filter: the wave itself is changing.", target: "Phase saw, position taken below 5% and above 95%", check: (s) => s.state.table === "pdsaw" && swept(s, "position", 5, 95) },
      { do: "Choose Analogue saw and set Position to 100%.", show: [...K, ...TB], hear: "Very nearly a saw, with its sharp corner slightly rounded. This is the shape fitted to low notes on the recorded synth.", target: "Analogue saw, position at 95% or more", check: (s) => s.state.table === "moogsaw" && s.state.position >= 95 },
      { do: "Bring Position down to 0.", show: [...K, ...TB], hear: "Softer on top. The corner is rounder: this is the shape the same synth gave on its highest notes.", target: "Analogue saw, position at 5% or less", check: (s) => s.state.table === "moogsaw" && s.state.position <= 5 },
      { do: "Choose Phase pulse and sweep Position from below 10% to above 90%.", show: [...K, ...TB], hear: "Thinner, more nasal and quieter as it goes. On the scope one hump squeezes into a narrow spike with a flat stretch after it.", target: "Phase pulse, position taken below 10% and above 90%", check: (s) => s.state.table === "pdpulse" && swept(s, "position", 10, 90) },
      { do: "Choose Formant and sweep Position slowly from below 10% to above 90%.", show: [...K, ...TB], hear: "One bright band climbing through the note like a whistle, while the bars either side of it stay low.", target: "Formant, position taken below 10% and above 90%", check: (s) => s.state.table === "formant" && swept(s, "position", 10, 90) },
    ],
    recap: ["Phase distortion reads a sine at an uneven speed: the more uneven, the brighter.", "A real analogue saw is rounder than the textbook saw, and rounder still on high notes.", "A table can hold a pulse that narrows or one band that climbs; the position chooses where along it you are."],
    inSerum: "Serum's wavetables are stored tables chosen from its browser. The four here are generated by this app from published formulas and are not Serum's tables. Listening only.",
  },
];

export const FX_ADDITIONS: PlayableLesson[] = [
  {
    id: "C7.7", title: "The order of effects", buildsOn: ["C7.1", "C7.2", "C7.6"], minutes: 8, cardIds: ["fx-rack-order"], initial: { ...GRIT },
    outcome: "Hear how swapping two effects changes a sound, and choose an order on purpose.",
    demo: { caption: "Short notes with distortion before reverb, then the same notes with reverb before distortion.", tones: [0, 0.9, 3.4, 4.3].map((at, i) => ({ patch: i < 2 ? { ...GRIT } : { ...GRIT, fxOrder: ["comp", "chorus", "delay", "eq", "reverb", "dist"] }, note: i % 2 ? 52 : 45, at, seconds: 0.25 })) },
    idea: [
      "The effects sit in a row, and each one works on whatever the one before it sends on. So the same effects with the same settings give a different sound in a different order.",
      "Two questions settle most choices. Should this effect change what the next one receives, or tidy up what it produced? And should a tail (an echo or a reverb) be left clean, or be processed along with the note?",
    ],
    steps: [
      { do: "Play a few short notes, letting each one go. Distortion comes before Reverb.", show: ["keyboard", "distOn", "reverbOn", "fxOrder"], hear: "A gritty note, then a smooth tail dying away. The reverb is echoing a sound that is already distorted.", target: "Three notes played", check: (s) => struck(s) >= 3 },
      { do: "Click ▶ on Distortion so it sits after Reverb.", show: ["keyboard", "distOn", "reverbOn", "fxOrder"], hear: "Nothing until you play.", target: "Reverb before Distortion", check: (s) => before(s, "reverb", "dist") },
      { do: "Play the same short notes again.", show: ["keyboard", "distOn", "reverbOn", "fxOrder"], hear: "The tail is now rough, louder, and hangs on longer. The distortion is turning up and reshaping the quiet reverb as well as the note.", target: "Three notes played, Reverb before Distortion", check: (s) => struck(s) >= 3 && before(s, "reverb", "dist") },
      { do: "Click ◀ on Distortion to put it back before Reverb. Switch on EQ and turn its High band down to -12 dB or lower.", show: ["keyboard", "distOn", "reverbOn", "eqOn", "eqHigh", "fxOrder", "spectrum"], hear: "Hardly any duller. The EQ comes first, and the distortion after it makes new high harmonics of its own.", target: "EQ before Distortion before Reverb, EQ high at -10 dB or lower", check: (s) => s.state.eqOn && s.state.eqHigh <= -10 && before(s, "eq", "dist") && before(s, "dist", "reverb") && struck(s) >= 1 },
      { do: "Click ▶ on EQ so it sits after Distortion, and play again.", show: ["keyboard", "distOn", "eqOn", "eqHigh", "fxOrder", "spectrum"], hear: "Clearly duller. Now the EQ is turning down the edge the distortion made.", target: "Distortion before EQ, a note played", check: (s) => s.state.eqOn && s.state.eqHigh <= -10 && before(s, "dist", "eq") && struck(s) >= 1 },
    ],
    recap: ["Each effect works on what the one before it sends on, so order changes the result.", "Distortion after reverb roughens the tail and makes it louder; before reverb, the tail stays smooth.", "An EQ cut before distortion changes what gets distorted; after it, the cut shapes the finished tone."],
    inSerum: "Serum's effects can be reordered by dragging an effect to a new place in the list or in the rack (page 156 of its guide). Try distortion before and after reverb there. Listening only.",
  },
];

const FOLD = { shape: "sine", warp: "fold", warpAmount: 0 } as const;
const W = ["scope", "spectrum"] as const;
export const WARP_ADDITIONS: PlayableLesson[] = [
  {
    id: "C6.6", title: "Fold, steps and flip", buildsOn: ["C6.1"], minutes: 8, cardIds: ["warp"], initial: { ...FOLD },
    outcome: "Reshape a wave by changing its height, not only where it is read: fold it, cut it into steps, and turn part of it over.",
    demo: { caption: "A sine: plain, folded, cut into steps, then with its second half turned over.", tones: tones([{ shape: "sine" }, { ...FOLD, warpAmount: 60 }, { shape: "sine", warp: "steps", warpAmount: 60 }, { shape: "sine", warp: "flip", warpAmount: 50 }], 1.3, 0.3, 57) },
    idea: [
      "Bend, mirror, sync and squeeze all change where in the wave the oscillator reads. Fold and Flip work on the wave's height instead. Fold turns the wave up and folds whatever passes the top back down. Flip turns the end of each cycle upside down.",
      "Steps is in between: it holds each reading for a while before taking the next, so a smooth wave becomes a staircase. All three add harmonics to a plain wave, each with its own character.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. It is a sine, and Warp is set to Fold with the amount at 0.", show: [...K, ...W], hear: "A pure tone: one bar on the spectrum.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "Turn Warp amount up to about 50%.", show: [...K, "warp", "warpAmount", ...W], hear: "Brighter and hollow. On the scope the tops of the wave have been folded down into dips.", target: "Fold, amount between 40% and 60%", check: (s) => s.state.warp === "fold" && between(s.state.warpAmount, 40, 60),
        remark: (s) => `At ${s.state.warpAmount}% the wave is turned up ${foldGain(s.state.warpAmount).toFixed(1)} times, and everything past the top is folded back.` },
      { do: "Sweep the amount slowly from below 10% to above 90%.", show: [...K, "warpAmount", ...W], hear: "A metallic, shifting tone. The bars on the spectrum rise and fall in turn; they do not simply grow.", target: "Amount taken below 10% and above 90%", check: (s) => s.state.warp === "fold" && swept(s, "warpAmount", 10, 90) },
      { do: "Change Warp to Steps and set the amount to about 60%.", show: [...K, "warp", "warpAmount", ...W], hear: "A buzzy, digital edge on the note. The scope shows a staircase in the outline of the sine.", target: "Steps, amount between 50% and 70%", check: (s) => s.state.warp === "steps" && between(s.state.warpAmount, 50, 70),
        remark: (s) => `At ${s.state.warpAmount}% each cycle is cut into ${stepCount(s.state.warpAmount)} flat steps.` },
      { do: "Raise the amount to about 80%.", show: [...K, "warpAmount", ...W], hear: "Much rougher: only a handful of steps are left in each cycle.", target: "Steps, amount between 72% and 88%", check: (s) => s.state.warp === "steps" && between(s.state.warpAmount, 72, 88),
        remark: (s) => `Now there are ${stepCount(s.state.warpAmount)} steps in each cycle. Fewer steps, rougher sound.` },
      { do: "Change Warp to Flip and set the amount to 50%.", show: [...K, "warp", "warpAmount", ...W], hear: "The note seems to jump up an octave. With its second half turned over, the wave repeats twice in the time it used to repeat once.", target: "Flip, amount between 45% and 55%", check: (s) => s.state.warp === "flip" && between(s.state.warpAmount, 45, 55) },
    ],
    recap: ["Fold turns the wave up and folds back what passes the top, adding harmonics that shift unevenly.", "Steps cuts each cycle into flat steps: fewer steps, rougher tone.", "Flip turns the end of the cycle upside down; half way, a sine repeats twice as often and sounds an octave up."],
    inSerum: "Serum's warp menu includes Flip and Quantize (pages 50 and 51 of its guide). The versions here follow our own rules and have not been checked against Serum's, so nothing is checked. Listening only.",
  },
];
