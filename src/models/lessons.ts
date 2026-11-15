// Lessons for the physical models (the plucked string and the drum head). They are data, like the practice
// synth's lessons, but checked against the model's own settings: each step is passed by playing the model
// with the settings the step asks for. Codes such as Q1.1 are for plans and code only.
import type { QuizItem } from "../course/quiz";
import type { DrumState } from "../modal/membrane";
import type { StringState } from "../strings/string";

/** What has been played since the current step began. */
export interface Played { plays: number; notes: number[] }
export interface ModelStep<S> { do: string; hear: string; target: string; check: (s: S, played: Played) => boolean }
export interface ModelLesson<S> { id: string; title: string; minutes: number; outcome: string; idea: string[]; initial: Partial<S>; steps: ModelStep<S>[]; recap: string[]; quiz: QuizItem[] }

const distinct = (p: Played) => new Set(p.notes).size;
const q = (text: string, options: string[], answer: number, why: string, point: number): QuizItem => ({ q: text, options, answer, why, point });

export const STRING_LESSONS: ModelLesson<StringState>[] = [
  {
    id: "Q1.1", title: "A burst of noise becomes a note", minutes: 5, initial: { exciter: "noise" },
    outcome: "Explain why a loop turns a burst of noise into a note, and what decides its pitch.",
    idea: [
      "Send a short burst of noise into a loop that hands it back a moment later, slightly quieter, over and over. Whatever goes round keeps arriving at the same interval, and a sound that repeats at a steady interval is a note. The interval, the length of the loop, is the pitch.",
      "A string works the same way. A pluck sends a wave to the end and back; one trip there and back is one cycle of the note. So this loop is a string, and the noise is only the pluck.",
    ],
    steps: [
      { do: "Play any key. The string is set going by a burst of noise.", hear: "A clear note with a rough, breathy start. There is no oscillator: the loop made the pitch.", target: "One note played with Burst of noise", check: (s, p) => s.exciter === "noise" && p.plays >= 1 },
      { do: "Play three different keys.", hear: "Three different pitches from the same noise. Only the length of the loop changed.", target: "Three different keys played", check: (s, p) => s.exciter === "noise" && distinct(p) >= 3 },
      { do: "Change “Set going by” to Pluck and play one of those keys again.", hear: "The same pitch with a cleaner start. What goes into the loop colours the beginning; the loop still decides the note.", target: "Pluck chosen, a note played", check: (s, p) => s.exciter === "pluck" && p.plays >= 1 },
    ],
    recap: ["A loop that repeats what it is given makes a note; the loop's length is the pitch.", "One trip round the loop is one trip down a string and back.", "What sets the string going colours the start of the note, not its pitch."],
    quiz: [
      q("What decides the pitch of the plucked-string model?", ["The kind of noise put in", "The length of the loop", "The brightness control", "How hard it is plucked"], 1, "Whatever goes round arrives back at a steady interval, and that interval is the pitch.", 0),
      q("What does one trip round the loop stand for?", ["One trip down the string and back", "One whole note", "One harmonic", "One second"], 0, "A pluck travels to the end of the string and back, and that is one cycle of the note.", 1),
      q("You swap the burst of noise for a clean pluck. What changes?", ["The pitch", "Nothing at all", "The start of the note", "The length of the loop"], 2, "The exciter colours the beginning. The loop still sets the note.", 2),
    ],
  },
  {
    id: "Q1.2", title: "Loss is tone: bright, dull, long, short", minutes: 6, initial: {},
    outcome: "Set how bright a string is and how long it rings, and say what each control changes in the loop.",
    idea: [
      "Each time the wave goes round, it loses a little. If it lost the same amount at every frequency the note would simply fade. A real string loses more of its highs than its lows on every trip, so the note gets duller as it fades.",
      "Two controls set that loss. Brightness is how much more the highs lose than the lows. Decay time is how long the lowest part of the note takes to fade away. Together they are most of what separates nylon from steel, and a muted string from an open one.",
    ],
    steps: [
      { do: "Set Brightness to 10% or less and play a low key.", hear: "A dull, soft note, like nylon or an old string. The top is gone almost at once.", target: "Brightness at 10% or less, a note played", check: (s, p) => s.bright <= 10 && p.plays >= 1 },
      { do: "Set Brightness to 90% or more and play the same key.", hear: "Bright and wiry, like new steel. The top hangs on.", target: "Brightness at 90% or more, a note played", check: (s, p) => s.bright >= 90 && p.plays >= 1 },
      { do: "Set Decay time to 0.6 s or less and play.", hear: "A short, damped thud, like a string muted with the side of the hand.", target: "Decay time at 0.6 s or less, a note played", check: (s, p) => s.decay <= 0.6 && p.plays >= 1 },
      { do: "Set Decay time to 5 s or more and play.", hear: "A note that hangs in the air. Watch “The note it made”: the slope is much shallower.", target: "Decay time at 5 s or more, a note played", check: (s, p) => s.decay >= 5 && p.plays >= 1 },
    ],
    recap: ["A string loses a little on every trip, and more of its highs than its lows.", "Brightness sets how much more the highs lose; a dull string goes soft almost at once.", "Decay time sets how long the lowest part of the note rings."],
    quiz: [
      q("Why does a plucked note get duller as it fades?", ["The pitch drops", "The highs lose more than the lows on every trip", "The loop gets longer", "Noise is added"], 1, "Each trip takes a little more from the highs, so they are gone first.", 0),
      q("What does the Brightness control set?", ["The loop's length", "How hard the pluck is", "How much more the highs lose than the lows", "The volume"], 2, "Low brightness means the highs lose a lot on each trip.", 1),
      q("Which setting gives a short, muted thud?", ["A long decay time", "A short decay time", "High brightness alone", "A second string"], 1, "Decay time is how long the lowest part of the note takes to fade.", 2),
    ],
  },
  {
    id: "Q1.3", title: "Where you pluck, and what with", minutes: 6, initial: { bright: 85, decay: 4 },
    outcome: "Change a string's tone by moving the pluck along it and by softening the pick.",
    idea: [
      "Every harmonic of a string has still points along it. The second harmonic stands still in the middle; the third at each third. Pluck exactly on a still point and that harmonic is not set going at all. So where you pluck chooses which harmonics the note starts with.",
      "What you pluck with matters too. A hard pick leaves a sharp corner in the string, and a sharp corner is rich in high harmonics. A soft thumb leaves a rounded one.",
    ],
    steps: [
      { do: "Set Pluck position to 50% (the middle) and play a low key.", hear: "Hollow and round, a little like a clarinet. Every second bar is missing.", target: "Pluck position at 50%, a note played", check: (s, p) => s.exciter === "pluck" && s.pick === 50 && p.plays >= 1 },
      { do: "Move Pluck position to 8% or less, close to the bridge, and play.", hear: "Thin, nasal and bright. Nearly every bar is there, at nearly the same height.", target: "Pluck position at 8% or less, a note played", check: (s, p) => s.exciter === "pluck" && s.pick <= 8 && p.plays >= 1 },
      { do: "Set Pluck position to about 33% and play.", hear: "Every third bar has gone: a third of the way along is a still point for those.", target: "Pluck position between 32% and 34%, a note played", check: (s, p) => s.exciter === "pluck" && s.pick >= 32 && s.pick <= 34 && p.plays >= 1 },
      { do: "Turn Pick hardness down to 15% or less and play.", hear: "A soft thumb. The high bars shrink and the start of the note is rounder.", target: "Pick hardness at 15% or less, a note played", check: (s, p) => s.hard <= 15 && p.plays >= 1 },
    ],
    recap: ["Plucking on a harmonic's still point leaves that harmonic out.", "The middle removes every second harmonic; near the bridge keeps nearly all of them.", "A hard pick gives a bright start; a soft one a rounded start."],
    quiz: [
      q("You pluck a string exactly in the middle. What is missing?", ["The lowest note", "Every second harmonic", "Every harmonic", "Nothing"], 1, "The even harmonics stand still in the middle, so a pluck there cannot set them going.", 1),
      q("Why does the pluck position change the tone?", ["It changes the loop's length", "It changes which harmonics are set going", "It changes the decay time", "It adds noise"], 1, "A harmonic with a still point where you pluck is left out of the note.", 0),
      q("What does a softer pick do?", ["Raises the pitch", "Makes the note longer", "Takes away high harmonics at the start", "Removes every second harmonic"], 2, "A soft pick rounds the corner in the string, and a rounded corner has fewer highs.", 2),
    ],
  },
  {
    id: "Q1.4", title: "Where you listen, and a second string", minutes: 6, initial: { bright: 85, decay: 5, pick: 13 },
    outcome: "Thin a string's tone by choosing where it is heard, and make it shimmer with a second string.",
    idea: [
      "Where you listen works just as where you pluck does. A pickup under a still point of some harmonic cannot hear that harmonic. This is why the pickups on an electric guitar sound different from each other: same string, different place.",
      "Two strings tuned a few cents apart drift slowly in and out of step. In step they add; out of step they partly cancel. The result is one note that swells and fades by itself.",
    ],
    steps: [
      { do: "Set Listening position to 25% and play a low key.", hear: "A hollower tone. Every fourth bar has dropped out.", target: "Listening position at 25%, a note played", check: (s, p) => s.pickup === 25 && p.plays >= 1 },
      { do: "Set Listening position to 50% and play.", hear: "Hollower still: now every second bar is gone, as it was when you plucked in the middle.", target: "Listening position at 50%, a note played", check: (s, p) => s.pickup === 50 && p.plays >= 1 },
      { do: "Put Listening position back to 0 (at the bridge). Set Second string to between 5 and 12 cents and play one long note.", hear: "The note swells and fades slowly. The caption under “The note it made” says how many times a second.", target: "Listening at the bridge, second string 5 to 12 cents apart, a note played", check: (s, p) => s.pickup === 0 && s.pair >= 5 && s.pair <= 12 && p.plays >= 1 },
      { do: "Raise Second string to 25 cents or more and play.", hear: "Faster swells, and a slightly sour, honky-tonk edge: the two are now far enough apart to hear as out of tune.", target: "Second string 25 cents or more apart, a note played", check: (s, p) => s.pair >= 25 && p.plays >= 1 },
    ],
    recap: ["Listening at a harmonic's still point leaves that harmonic unheard.", "Two strings a few cents apart drift in and out of step, so the note swells and fades.", "The further apart the two strings, the faster the swells."],
    quiz: [
      q("A pickup sits a quarter of the way along the string. What does it miss?", ["Every fourth harmonic", "The lowest note", "Every harmonic", "Nothing"], 0, "Every fourth harmonic has a still point there, so the pickup cannot hear it.", 0),
      q("Why does a pair of slightly detuned strings swell and fade?", ["One string is louder", "They drift in and out of step", "The loop gets shorter", "The pick is soft"], 1, "In step they add; out of step they partly cancel.", 1),
      q("You tune the second string further from the first. What happens to the swells?", ["They stop", "They get slower", "They get faster", "They get quieter only"], 2, "The bigger the difference between the two, the faster they drift in and out of step.", 2),
    ],
  },
];

export const DRUM_LESSONS: ModelLesson<DrumState>[] = [
  {
    id: "Q4.1", title: "Modes: why a drum is not a string", minutes: 6, initial: {},
    outcome: "Say what a mode is, and why a drum's pitch is harder to name than a string's.",
    idea: [
      "A stretched skin can only vibrate in certain patterns. Each pattern is called a mode, and each has its own frequency. A hit sets several going together, and the sound is all of them at once, each dying away at its own speed.",
      "On a string the patterns' frequencies are whole multiples of the lowest, which is why a string has a clear pitch. On a round skin they are not: the second sits about 1.59 times the lowest, the third about 2.14. The ear cannot fuse them into one clear note.",
    ],
    steps: [
      { do: "Click the head in its dead centre.", hear: "A plain, round thump. Only a few bars stand.", target: "A hit within 3% of the centre", check: (s, p) => s.strike <= 3 && p.plays >= 1 },
      { do: "Click the head more than 70% of the way out to the edge.", hear: "A thinner, clangy hit. Many more bars stand, and they fall between the faint lines where harmonics would be.", target: "A hit 70% or more of the way out", check: (s, p) => s.strike >= 70 && p.plays >= 1 },
      { do: "Hit it about half way out, between 40% and 60%.", hear: "Between the two: a full drum sound with some ring to it.", target: "A hit between 40% and 60% out", check: (s, p) => s.strike >= 40 && s.strike <= 60 && p.plays >= 1 },
    ],
    recap: ["A mode is one pattern a skin can vibrate in, with its own frequency.", "A drum's modes are not whole multiples of the lowest, so its pitch is unclear.", "Where you hit decides which modes are set going: the centre excites only a few."],
    quiz: [
      q("What is a mode?", ["A kind of drumstick", "One pattern the skin can vibrate in, with its own frequency", "The loudness of a hit", "A type of filter"], 1, "A skin can only vibrate in certain patterns, and each has its own frequency.", 0),
      q("Why is a drum's pitch harder to name than a string's?", ["Drums are quieter", "Its modes are not whole multiples of the lowest", "It has only one mode", "It fades too fast to hear"], 1, "The ear fuses whole multiples into one note. A round skin's modes sit in between.", 1),
      q("What does hitting a drum in the dead centre do?", ["Excites every mode equally", "Excites only the few patterns that move at the centre", "Makes no sound", "Raises the pitch"], 1, "A pattern that stands still at the centre is not set going by a hit there.", 2),
    ],
  },
  {
    id: "Q4.2", title: "Damping and shape", minutes: 6, initial: { strike: 50 },
    outcome: "Take a drum from a dry tom to a ringing plate with damping, and hear how the head's shape changes its notes.",
    idea: [
      "How long each mode rings matters as much as which modes there are. If the high modes die at once, only the lowest is left and the drum sounds dry and tuned. If they all ring on, you hear the whole out-of-tune set together, which sounds like metal.",
      "Change the shape of the head and the same idea gives other frequencies. A square skin's modes sit in different places from a round one's, so the same hit rings with a different set of notes.",
    ],
    steps: [
      { do: "Turn Damping of the high modes to 85% or more and hit the head off centre.", hear: "The clang is gone almost at once and one low note is left: a tom.", target: "Damping at 85% or more, a hit at least 20% out", check: (s, p) => s.damp >= 85 && s.strike >= 20 && p.plays >= 1 },
      { do: "Turn Damping to 15% or less and Ring time to 3 s or more, and hit it.", hear: "Every mode rings on together, more like a gong or a metal plate than a drum.", target: "Damping at 15% or less, ring time 3 s or more, a hit", check: (s, p) => s.damp <= 15 && s.decay >= 3 && p.plays >= 1 },
      { do: "Change the head to Square and hit it off centre.", hear: "A different set of notes inside the hit. Look at the bars: they have moved.", target: "Square head, a hit at least 20% out", check: (s, p) => s.head === "square" && s.strike >= 20 && p.plays >= 1 },
    ],
    recap: ["When the high modes die quickly, a drum sounds dry and tuned.", "When all the modes ring on, it sounds like metal.", "A different shape of head has its modes at different frequencies."],
    quiz: [
      q("You damp the high modes heavily. What is left?", ["A long metallic ring", "Mostly the lowest mode: a dry, tuned drum", "Silence", "Only the highest mode"], 1, "With the high modes gone at once, the lowest is what you hear.", 0),
      q("All the modes ring on for seconds. What does it sound like?", ["A soft thump", "A string", "Metal: a gong or a plate", "A click"], 2, "The whole out-of-tune set ringing together is the sound of struck metal.", 1),
      q("What changes when the round head is swapped for a square one?", ["The modes sit at different frequencies", "The drum gets louder", "Nothing", "It gains harmonics that are whole multiples"], 0, "The shape decides which patterns are possible and where their frequencies fall.", 2),
    ],
  },
];
