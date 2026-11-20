// "Reading your tools": what the meter, the scope, the spectrum and the spectrogram really show, and where each
// can mislead. Facts about level come from Puckette, "The Theory and Technique of Electronic Music" (library id
// puckette-electronic-music): peak and RMS pp. 3-4, decibels pp. 5-6, adding signals pp. 10-11, finding partials
// with a swept band-pass p. 258, jumps and corners pp. 295-307. Every level quoted in a remark was measured on
// this synth in a browser (20 Nov 2026): a sine reads 3.0 dB between peak and average at any pitch; two
// identical sines add 6.0 dB; an octave or a fifth apart they add 3.0 dB on average; half a cycle apart, silence.
// Nothing here says what a listener will hear beyond what the book says: where the ear is the judge, the step
// asks the learner to listen and says so.
import type { PlayableLesson, Snapshot } from "../types";

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const K = ["keyboard", "hold"] as const;
const struck = (s: Snapshot) => s.played.mouse + s.played.keys + s.played.midi;
const swept = (s: Snapshot, id: keyof Snapshot["range"], lo: number, hi: number) => !!s.range[id] && s.range[id]!.min <= lo && s.range[id]!.max >= hi;
const hz = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)} kHz` : `${Math.round(n)} Hz`);
/** How many times taller or shorter a wave is after a change in dB. */
const times = (db: number) => 10 ** (Math.abs(db) / 20);
const tidy = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ""));
/** The frequency of the note sounding: the last key played, moved by Osc A's octave and semitone. */
const noteHz = (s: Snapshot) => 440 * 2 ** (((s.lastNote ?? 57) + 12 * s.state.octave + s.state.semitone - 69) / 12);
/** Which harmonic of the note the cutoff is sitting on (within 4%), or 0 for none. */
const harmonicAt = (s: Snapshot) => { const k = Math.round(s.state.cutoff / noteHz(s)); return k >= 1 && k <= 16 && Math.abs(s.state.cutoff / (k * noteHz(s)) - 1) <= 0.04 ? k : 0; };

const SINE = { shape: "sine" } as const;
const PAIR = { shape: "sine", bShape: "sine", bLevelDb: 0 } as const;
const HUNT = { shape: "saw", octave: -1, filterOn: true, filterType: "band", cutoff: 110, resonance: 90, slope: "12" } as const;

export const TOOLS_CHAPTER: PlayableLesson[] = [
  {
    id: "CV.1", title: "Peak and average: two readings of one sound", buildsOn: ["C0.3", "C1.1"], minutes: 6, cardIds: [], initial: { ...SINE },
    outcome: "Read both numbers on the level meter and say what each one measures.",
    idea: [
      "The meter shows two numbers for the same moment. Peak is the tallest point the wave reaches. Average is closer to how much sound there is: it is worked out from every point of the wave over a short stretch, not only the tallest.",
      "The average can never read above the peak. For a pure tone the two are always 3 dB apart. For other shapes the gap is different, because a wave with brief tall points has a high peak with little sound underneath it.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. The shape is a sine. Read both numbers on the meter.", show: [...K, "meter", "scope"], hear: "A pure tone, with the peak reading 3 dB above the average.", target: "A note held for two seconds", check: (s) => s.heldSeconds >= 2,
        remark: () => "For a pure tone the peak always reads 3 dB above the average, on any note. Try another key: the gap does not move." },
      { do: "Change the shape to Square and read the two numbers again.", show: [...K, "shape", "meter", "scope"], hear: "Buzzier. Both numbers have moved, and they are no longer 3 dB apart.", target: "Square chosen, a note held", check: (s) => s.state.shape === "square" && s.held.length >= 1 },
      { do: "Change the shape to Saw.", show: [...K, "shape", "meter", "scope"], hear: "Brighter again. The peak reads well above the average: the widest gap of the shapes here.", target: "Saw chosen, a note held", check: (s) => s.state.shape === "saw" && s.held.length >= 1,
        remark: () => "The saw on this synth has a short tall point in every cycle. That point sets the peak, and it holds very little of the sound, so the average sits far below." },
      { do: "Leave the shape alone and turn Volume down by 6 dB.", show: [...K, "volumeDb", "meter", "scope"], hear: "Quieter. Both numbers drop by 6, and the gap between them stays the same.", target: "Volume 5 to 7 dB below where this step began", check: (s) => between(s.start.volumeDb - s.state.volumeDb, 5, 7),
        remark: (s) => `Volume went down ${s.start.volumeDb - s.state.volumeDb} dB and so did both readings. A volume control changes the size of the wave, not its shape, so the gap cannot change.` },
    ],
    recap: ["Peak is the tallest point of the wave. Average is how much sound there is over a short stretch.", "The average never reads above the peak. For a pure tone it sits 3 dB below.", "Volume moves both readings together. Changing the shape of the wave changes the gap between them."],
  },
  {
    id: "CV.2", title: "Decibels count how many times", buildsOn: ["C0.3"], minutes: 6, cardIds: [], initial: { ...SINE, volumeDb: 0 },
    outcome: "Turn a change in decibels into how many times taller or shorter the wave becomes.",
    idea: [
      "A decibel number never describes one sound alone. It compares two levels and says how many times bigger one is than the other. Taking away 6 dB halves the height of the wave. Taking away 20 dB makes it ten times shorter.",
      "Because decibels count times, steps add up where heights multiply: 6 dB down twice is a quarter of the height. It also means silence has no decibel number, since nothing is not any number of times smaller than something.",
    ],
    steps: [
      { do: "This lesson starts with Volume at the top, so turn your computer's volume down first if you need to. Switch on Hold, play a note and look at how tall the wave is on the scope.", show: [...K, "volumeDb", "scope", "meter"], hear: "A pure tone, with a tall wave on the scope.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "Turn Volume down by 6 dB.", show: [...K, "volumeDb", "scope", "meter"], hear: "Quieter, and the wave is half as tall.", target: "Volume 5 to 7 dB below where this step began", check: (s) => between(s.start.volumeDb - s.state.volumeDb, 5, 7),
        remark: (s) => `${s.start.volumeDb - s.state.volumeDb} dB down: the wave is ${tidy(times(s.start.volumeDb - s.state.volumeDb))} times shorter than it was.` },
      { do: "Turn Volume down by another 6 dB.", show: [...K, "volumeDb", "scope", "meter"], hear: "Half as tall again: a quarter of where you began.", target: "Volume 5 to 7 dB lower again", check: (s) => between(s.start.volumeDb - s.state.volumeDb, 5, 7),
        remark: (s) => `You are now ${-s.state.volumeDb} dB below the top: ${tidy(times(s.state.volumeDb))} times shorter. Two halvings make a quarter, and 6 dB plus 6 dB make 12.` },
      { do: "Set Volume to -20 dB.", show: [...K, "volumeDb", "scope", "meter"], hear: "Much quieter. The wave is one tenth of the height it started at.", target: "Volume between -21 and -19 dB", check: (s) => between(s.state.volumeDb, -21, -19) },
      { do: "Turn Volume all the way down.", show: [...K, "volumeDb", "scope", "meter"], hear: "Very faint, and nearly a flat line. It is still not silence.", target: "Volume at -46 dB or lower", check: (s) => s.state.volumeDb <= -46,
        remark: (s) => `At ${s.state.volumeDb} dB the wave is about ${Math.round(times(s.state.volumeDb))} times shorter than at the top, and it is still there. No decibel number means silence: the meter says "silent" only when nothing plays.` },
    ],
    recap: ["Every 6 dB halves or doubles the height of the wave.", "A change of 20 dB is ten times the height.", "Decibels compare two levels, so steps add up, and silence has no decibel number."],
  },
  {
    id: "CV.3", title: "The same reading is not the same loudness", buildsOn: ["CV.1", "C1.2"], minutes: 6, cardIds: [], initial: { ...SINE },
    outcome: "Show that two sounds with the same meter reading can differ in loudness, and say what a meter can be trusted for.",
    idea: [
      "A meter measures the size of the wave. Loudness is what you hear, and the two are not the same thing: sounds that read the same on a meter will not necessarily sound equally loud.",
      "What a meter is good for is change. Turning one sound up by about 3 dB will fairly reliably make it sound about one step louder. So use the meter to compare a sound with itself, and your ears to compare two different sounds.",
    ],
    steps: [
      { do: "Set Octave to -2 and play a note. Read the meter and notice how loud it seems.", show: [...K, "octave", "meter"], hear: "A very low pure tone. On small speakers it may nearly vanish.", target: "Octave at -2 or lower, a note played", check: (s) => s.state.octave <= -2 && struck(s) >= 1 },
      { do: "Set Octave to 2 and play the same key. Read the meter again.", show: [...K, "octave", "meter"], hear: "A high pure tone. Decide for yourself which of the two seemed louder.", target: "Octave at 2 or higher, a note played", check: (s) => s.state.octave >= 2 && struck(s) >= 1,
        remark: () => "The meter read the same for both notes: on this synth a pure tone has the same level on every key. If one seemed louder to you, that difference is in the hearing, not in the wave." },
      { do: "Set Octave back to 0, play a note, then turn Volume up by 3 dB and play it again.", show: [...K, "octave", "volumeDb", "meter"], hear: "About one step louder.", target: "Octave at 0, Volume 3 dB above where this step began, a note played", check: (s) => s.state.octave === 0 && between(s.state.volumeDb - s.start.volumeDb, 2.5, 3.5) && struck(s) >= 1 },
      { do: "Turn Volume down by 6 dB and play the note again.", show: [...K, "volumeDb", "meter"], hear: "About two steps quieter.", target: "Volume 5 to 7 dB below where this step began, a note played", check: (s) => between(s.start.volumeDb - s.state.volumeDb, 5, 7) && struck(s) >= 1,
        remark: () => "Changes to one sound are where the meter earns its keep: each 3 dB is about one step. It still cannot rank two different sounds for you." },
    ],
    recap: ["A meter measures the wave. Loudness is what you hear.", "Two sounds with the same reading will not necessarily sound equally loud.", "Changing one sound by about 3 dB is fairly reliably about one step in loudness."],
  },
  {
    id: "CV.4", title: "Adding two sounds: six, three or nothing", buildsOn: ["CV.1", "C1.8"], minutes: 7, cardIds: [], initial: { ...PAIR },
    outcome: "Predict how much louder the meter reads when a second sound is added: 6 dB, 3 dB, or silence.",
    idea: [
      "Adding a second sound does not add a fixed amount of level. It depends on how alike the two are. Two identical waves, in step, make one wave twice as tall: 6 dB more. The same two half a cycle apart cancel completely.",
      "Two sounds that have nothing to do with each other, such as different notes, sometimes line up and sometimes do not. On average they add 3 dB. That is the usual case in a mix, which is why doubling the number of parts does not double the meter.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. Only Osc A is on. Read the average on the meter and remember it.", show: [...K, "meter", "scope"], hear: "One pure tone.", target: "A note held for two seconds", check: (s) => s.heldSeconds >= 2 },
      { do: "Switch on Osc B. It is the same shape, at the same pitch and level.", show: [...K, "bOn", "meter", "scope"], hear: "The same tone, louder. Both readings go up by 6 dB.", target: "Osc B on, a note held", check: (s) => s.state.bOn && s.state.bPhase === 0 && s.held.length >= 1,
        remark: () => "Two identical waves in step add to one wave twice as tall, and twice as tall is 6 dB." },
      { do: "Turn B's Phase to 180°.", show: [...K, "bPhase", "meter", "scope"], hear: "Silence. B is now half a cycle behind A, so every rise meets an equal fall.", target: "B phase at 180°", check: (s) => s.state.bOn && s.state.bPhase === 180,
        remark: () => "Nothing was switched off. Two full-level sounds are playing and the meter reads silent, because they are exact opposites." },
      { do: "Put B's Phase back to 0° and set B's Semitone to 7, so the two play different notes.", show: [...K, "bPhase", "bSemitone", "meter", "scope"], hear: "Two notes together. The average reads 3 dB above one oscillator alone, not 6.", target: "B phase at 0°, B semitone at 7", check: (s) => s.state.bOn && s.state.bPhase === 0 && s.state.bSemitone === 7,
        remark: () => "The peak still reaches 6 dB up at the instants when the two waves happen to line up. The average, which looks at the whole stretch, gains only 3." },
      { do: "Set B's Semitone back to 0 and B's Fine to about 7 cents. Watch the meter.", show: [...K, "bSemitone", "bFine", "meter", "scope"], hear: "A slow swell. The meter swings between 6 dB up and nearly nothing as the two drift in and out of step.", target: "B semitone at 0, B fine between 3 and 15 cents", check: (s) => s.state.bOn && s.state.bSemitone === 0 && between(Math.abs(s.state.bFine), 3, 15),
        remark: (s) => `At ${Math.abs(s.state.bFine)} cents apart the pair goes round about ${(noteHz(s) * (2 ** (Math.abs(s.state.bFine) / 1200) - 1)).toFixed(1)} times a second: every case from this lesson, one after another.` },
    ],
    recap: ["Two identical waves in step add 6 dB.", "The same two waves half a cycle apart cancel to silence.", "Two unrelated sounds add about 3 dB on average, though the peak can reach higher."],
  },
  {
    id: "CV.5", title: "Same ingredients, different picture", buildsOn: ["CV.1", "C1.8"], minutes: 6, cardIds: [], initial: { ...PAIR, bOn: true, bOctave: 1 },
    outcome: "Say what the scope shows that the spectrum does not, by changing one and leaving the other untouched.",
    idea: [
      "The scope and the spectrum answer different questions. The scope draws the shape of the wave. The spectrum lists what the wave is made of: which pure tones, and how strong each one is.",
      "The same list of tones can add up to many different shapes, depending on how the tones line up in time. So a change on the scope does not always mean a change in what the sound is made of.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. Osc A is a pure tone and Osc B is a pure tone one octave above it. Look at the scope and at the spectrum.", show: [...K, "scope", "spectrum", "meter"], hear: "Two pure tones an octave apart. The spectrum shows two bars. The scope shows one lopsided wave.", target: "A note held for two seconds", check: (s) => s.heldSeconds >= 2 },
      { do: "Turn B's Phase to about 90° and watch both pictures.", show: [...K, "bPhase", "scope", "spectrum", "meter"], hear: "The wave on the scope changes shape. The two bars on the spectrum do not move.", target: "B phase between 60° and 120°", check: (s) => between(s.state.bPhase, 60, 120) && s.held.length >= 1 },
      { do: "Turn B's Phase on to about 180°.", show: [...K, "bPhase", "scope", "spectrum", "meter"], hear: "A different shape again, from the same two bars. Listen as you turn: does the tone change for you?", target: "B phase between 150° and 210°", check: (s) => between(s.state.bPhase, 150, 210) && s.held.length >= 1,
        remark: () => "Measured here: as the phase turns, the peak reading wanders by a little under 1 dB, because the shape changes. The average does not move at all, because the ingredients do not." },
      { do: "Sweep B's Phase slowly all the way round, from below 20° to above 340°.", show: [...K, "bPhase", "scope", "spectrum", "meter"], hear: "The shape on the scope keeps changing the whole way. The spectrum stays put.", target: "B phase taken below 20° and above 340°", check: (s) => swept(s, "bPhase", 20, 340) },
    ],
    recap: ["The scope shows the shape of the wave. The spectrum shows which tones it is made of and how strong each is.", "Sliding one tone in time changes the shape on the scope without changing the spectrum.", "The peak can move when the shape does. The average follows the ingredients."],
  },
  {
    id: "CV.6", title: "Reading a spectrogram", buildsOn: ["C2.1", "C1.7"], minutes: 7, cardIds: [], initial: { shape: "saw", filterOn: true, filterType: "low", cutoff: 8000 },
    outcome: "Read a spectrogram: tell a steady note, a run of notes, a filter sweep and noise apart by their pictures.",
    idea: [
      "A spectrogram is the spectrum drawn again and again as time passes. Time runs from left to right with the newest on the right, pitch runs from bottom to top, and a stronger colour means louder. It is the one view that shows how a sound changes.",
      "On this one every octave gets the same height, as on a piano. Harmonics are evenly spaced in frequency, so on this picture they sit closer and closer together toward the top.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. Watch the spectrogram fill from the right.", show: [...K, "spectrogram"], hear: "A steady saw. The picture is a stack of level stripes, one for each harmonic, bunching together toward the top.", target: "A note held for three seconds", check: (s) => s.heldSeconds >= 3 },
      { do: "Play at least three different keys, one after another.", show: [...K, "spectrogram"], hear: "Each note is its own block of stripes. A higher note starts its stack higher up.", target: "Three different notes played", check: (s) => s.distinctNotes >= 3 },
      { do: "With a note held, sweep Cutoff slowly down below 300 Hz and back up above 4 kHz.", show: [...K, "cutoff", "spectrogram"], hear: "The sound dulls and brightens. On the picture the upper stripes fade from the top down and come back: the sweep is drawn as a slope.", target: "Cutoff taken below 300 Hz and above 4 kHz", check: (s) => swept(s, "cutoff", 300, 4000) && s.state.cutoff >= 4000,
        remark: () => "A spectrum shows one instant, so it could only have shown you one moment of that sweep. The spectrogram kept all of it." },
      { do: "Switch on Noise and switch Osc A off.", show: [...K, "noiseOn", "aOn", "spectrogram"], hear: "A hiss. No stripes at all: an even fog from bottom to top.", target: "Noise on, Osc A off", check: (s) => s.state.noiseOn && !s.state.aOn,
        remark: () => "Stripes mean harmonics, and harmonics mean a pitch. Noise has neither, so it paints the whole height." },
    ],
    recap: ["Time runs left to right, pitch runs bottom to top, and stronger colour means louder.", "A steady note is a stack of level stripes, a filter sweep is a slope, and noise is a fog with no stripes.", "Each octave gets equal height here, so harmonics crowd together toward the top."],
  },
  {
    id: "CV.7", title: "Brightness lives in jumps and corners", buildsOn: ["C1.1", "CV.5"], minutes: 7, cardIds: [], initial: { shape: "saw", octave: -1 },
    outcome: "Look at a wave made of straight lines and predict how bright it is from its jumps and corners.",
    idea: [
      "The classic shapes are made of straight lines, and what matters about them is where the lines meet. A jump is a sudden change in height. A corner is a sudden change in direction with no jump. A saw has one jump in every cycle, a square has two, and a triangle has no jumps, only two corners.",
      "Jumps make strong high harmonics: a saw's harmonics get weaker only in proportion to their number, so the tenth is a tenth as strong as the first. Corners make weak ones: a triangle's fall with the square of their number, so its fifth is a twenty-fifth as strong. A sine has neither and has no harmonics above the first.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. The shape is a saw. Find the jump in its picture on the oscillator, then look at the spectrum.", show: [...K, "shape", "scope", "spectrum"], hear: "Bright and buzzy. The bars on the spectrum step down slowly and carry on far to the right.", target: "A note held for two seconds", check: (s) => s.heldSeconds >= 2,
        remark: () => "With one jump per cycle, the second harmonic is 6 dB under the first, the fourth is 12 dB under and the eighth is 18. Each doubling costs only 6 dB, so there is plenty left at the top." },
      { do: "Change the shape to Triangle.", show: [...K, "shape", "scope", "spectrum"], hear: "Soft and flute-like. The bars drop away steeply and soon disappear.", target: "Triangle chosen, a note held", check: (s) => s.state.shape === "triangle" && s.held.length >= 1,
        remark: () => "No jumps, only corners: the third harmonic is already about 19 dB under the first and the fifth about 28. The even ones are missing altogether." },
      { do: "Change the shape to Square.", show: [...K, "shape", "scope", "spectrum"], hear: "Bright again, but hollow. The bars run far to the right like the saw's, with every second one missing.", target: "Square chosen, a note held", check: (s) => s.state.shape === "square" && s.held.length >= 1,
        remark: () => "Two jumps per cycle, so the harmonics it has are as strong as a saw's. It is the jumps that carry the brightness, not the particular shape." },
      { do: "Change the shape to Sine.", show: [...K, "shape", "scope", "spectrum"], hear: "The purest tone. One bar, and nothing above it.", target: "Sine chosen, a note held", check: (s) => s.state.shape === "sine" && s.held.length >= 1,
        remark: () => "No jump and no corner anywhere, so nothing above the first harmonic. The scope here draws the wave after the rest of the synth, which bends the flat parts of a shape a little, but a jump still shows as a sharp edge." },
    ],
    recap: ["A jump is a sudden change in height. A corner is a sudden change in direction.", "Jumps make strong high harmonics: a saw and a square are bright because they jump.", "Corners make weak high harmonics, so a triangle is soft, and a sine has neither."],
  },
  {
    id: "CV.8", title: "Hunting harmonics with a narrow band", buildsOn: ["C2.2", "C2.3", "C2.4"], minutes: 8, cardIds: [], initial: { ...HUNT },
    outcome: "Find a sound's harmonics one at a time by sweeping a narrow band across it and watching the meter.",
    idea: [
      "A band-pass filter with high resonance lets through a narrow band and very little else. Sweep that band slowly across a steady sound and you hear what the sound holds at each place. When the band lands on a harmonic the level jumps. Between harmonics it sinks.",
      "This turns the filter and the meter into a measuring tool: the meter reports how strong each harmonic is. Two filter stages in a row separate neighbours better than one, which here is the Steep slope.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. The filter is a narrow band-pass sitting near the bottom.", show: [...K, "cutoff", "resonance", "curve", "meter"], hear: "A soft, nearly pure tone: the band is letting through little more than the note's first harmonic.", target: "A note held for two seconds", check: (s) => s.heldSeconds >= 2 },
      { do: "Sweep Cutoff slowly upward, from below 150 Hz to above 1.5 kHz. Listen, and watch the meter.", show: [...K, "cutoff", "curve", "meter", "spectrum"], hear: "The tone climbs in steps, like a bugle call. Each step is one harmonic passing under the band, and the meter jumps each time.", target: "Cutoff taken below 150 Hz and above 1.5 kHz", check: (s) => swept(s, "cutoff", 150, 1500) },
      { do: "Come back down and park the Cutoff where the meter reads highest on one of the steps.", show: [...K, "cutoff", "curve", "meter", "spectrum"], hear: "One harmonic singing on its own.", target: "Cutoff sitting on one of the note's harmonics, from the second upward", check: (s) => harmonicAt(s) >= 2,
        remark: (s) => `You are on harmonic ${harmonicAt(s)}, near ${hz(harmonicAt(s) * noteHz(s))}: ${harmonicAt(s)} times the note's own ${hz(noteHz(s))}. Every step you heard was a whole number times that.` },
      { do: "Change Slope to Steep and nudge the Cutoff a little either side.", show: [...K, "slope", "cutoff", "curve", "meter"], hear: "The harmonic stands out more cleanly, and less of its neighbours leaks through.", target: "Slope set to Steep", check: (s) => s.state.slope === "24" },
      { do: "Change Osc A's shape to Square and sweep Cutoff from below 150 Hz to above 1.5 kHz again.", show: [...K, "shape", "cutoff", "curve", "meter", "spectrum"], hear: "The bugle call has gaps. Every second step is missing, and the meter sinks where it used to jump.", target: "Square chosen, Cutoff taken below 150 Hz and above 1.5 kHz", check: (s) => s.state.shape === "square" && swept(s, "cutoff", 150, 1500),
        remark: () => "A square has only the odd harmonics: the first, third, fifth and so on. You found that by measuring it, without being told." },
    ],
    recap: ["A narrow band swept across a steady sound finds its harmonics one at a time.", "The meter jumps when the band sits on a harmonic, and harmonics sit at whole-number multiples of the note.", "Two filter stages separate neighbouring harmonics better than one."],
  },
];
