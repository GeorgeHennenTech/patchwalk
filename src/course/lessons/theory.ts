// "Notes and chords": the first lessons of the theory track (track I in docs/CURRICULUM.md). They are
// checked from what is played: the notes sounding together (`held`) and the notes played in order
// (`sequence`). Everything can be done on the letter keys A to K, which run from one C to the next.
import { melody, played, type Score } from "../score";
import type { DemoTone, PlayableLesson, Snapshot } from "../types";

const SOFT = { shape: "triangle", envA: 5, envD: 900, envS: 55, envR: 350 } as const;
const K = ["keyboard"] as const;
const NAMES = ["C", "C sharp", "D", "D sharp", "E", "F", "F sharp", "G", "G sharp", "A", "A sharp", "B"];
const nameOf = (note: number) => NAMES[((note % 12) + 12) % 12]!;
/** The notes sounding together, lowest first, as steps above the lowest. */
const shape = (s: Snapshot) => { const h = [...new Set(s.held)].sort((a, b) => a - b); return h.map((n) => n - h[0]!); };
const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
/** The last two notes played, as the step from the first to the second. */
const lastStep = (s: Snapshot) => (s.sequence.length >= 2 ? s.sequence[s.sequence.length - 1]! - s.sequence[s.sequence.length - 2]! : null);
/** True when the most recent notes played, in order, follow `steps` from any starting note. */
const ran = (s: Snapshot, steps: number[]) => { const tail = s.sequence.slice(-steps.length); return tail.length === steps.length && tail.every((n, i) => n - tail[0]! === steps[i]); };
/** True when the notes sounding together are exactly these pitch classes (in any octave). */
const sounding = (s: Snapshot, classes: number[]) => { const got = [...new Set(s.held.map((n) => ((n % 12) + 12) % 12))].sort((a, b) => a - b); return same(got, [...classes].sort((a, b) => a - b)); };
/** True when the most recent notes played, taken three at a time, are these chords in order (each as pitch classes, in any octave). */
const chordRun = (s: Snapshot, chords: number[][]) => {
  const tail = s.sequence.slice(-3 * chords.length);
  if (tail.length !== 3 * chords.length) return false;
  return chords.every((want, i) => same([...new Set(tail.slice(i * 3, i * 3 + 3).map((n) => ((n % 12) + 12) % 12))].sort((a, b) => a - b), [...want].sort((a, b) => a - b)));
};
const tone = (note: number, at: number, seconds = 0.5): DemoTone => ({ patch: { ...SOFT }, note, at, seconds });
const chord = (notes: number[], at: number, seconds = 1.2): DemoTone[] => notes.map((n) => tone(n, at, seconds));
const ODE_2: Score = { title: "Ode to Joy, second phrase", items: [...[60, 60, 62, 64, 64, 62].map((n) => ({ notes: [n], beats: 1 })), { notes: [62], beats: 2 }] };
const ODE: Score = { title: "Ode to Joy", items: [...[64, 64, 65, 67, 67, 65, 64, 62].map((n) => ({ notes: [n], beats: 1 })), ...ODE_2.items] };
const CHORDS: Score = { title: "Four chords", items: [[60, 64, 67], [60, 65, 69], [62, 67, 71], [60, 64, 67]].map((notes) => ({ notes, beats: 2 })) };
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12], MINOR = [0, 2, 3, 5, 7, 8, 10, 12];

export const THEORY_CHAPTER: PlayableLesson[] = [
  {
    id: "CN.1", title: "Notes, semitones and octaves", buildsOn: ["C0.2"], minutes: 6, cardIds: [], initial: { ...SOFT },
    outcome: "Find any note’s neighbour a semitone away and its twin an octave away, and say why the twin sounds like the same note.",
    demo: { caption: "A note, the note one semitone above it, then the note an octave above it.", tones: [tone(60, 0), tone(61, 0.7), tone(60, 1.8), tone(72, 2.5)] },
    idea: [
      "The keyboard is one pattern of twelve keys, repeated. The step from any key to the very next one, black or white, is a semitone: the smallest step most music uses. Twelve semitones up, the pattern starts again.",
      "That twelfth key has the same name as the one you started on, because it vibrates exactly twice as fast and the two blend into one colour. The gap between them is an octave. On the letter keys, A is a C and K is the C an octave above it.",
    ],
    steps: [
      { do: "Press the letter A (or click a C on the keyboard).", show: [...K], hear: "A single soft note. This one is called C.", target: "A C played", check: (s) => s.sequence.length >= 1 && s.sequence[s.sequence.length - 1]! % 12 === 0 },
      { do: "Play any note, then the very next key above it (for example A then W).", show: [...K], hear: "Two notes as close as the keyboard allows. Played one after the other they sound tense, like a question.", target: "Two notes in a row, the second one semitone above the first", check: (s) => lastStep(s) === 1 },
      { do: "Play any note, then the key two steps above it (for example A then S).", show: [...K], hear: "A wider, easier step: two semitones, called a tone. Most tunes move mainly by tones and semitones.", target: "Two notes in a row, the second two semitones above the first", check: (s) => lastStep(s) === 2 },
      { do: "Play A and then K: the lowest and highest letter keys.", show: [...K], hear: "The same note, higher. Different pitch, same colour: an octave.", target: "Two notes in a row, the second twelve semitones above the first", check: (s) => lastStep(s) === 12,
        remark: (s) => `You played ${nameOf(s.sequence[s.sequence.length - 2]!)} and then the ${nameOf(s.sequence[s.sequence.length - 1]!)} twelve semitones above it, which vibrates exactly twice as fast.` },
      { do: "Hold A and K down together.", show: [...K, "scope"], hear: "They fuse into one fuller note. Nothing clashes.", target: "Two notes sounding together, an octave apart", check: (s) => same(shape(s), [0, 12]) },
    ],
    recap: ["A semitone is the step from one key to the very next; a tone is two of them.", "Twelve semitones make an octave, where the pattern of keys starts again.", "Notes an octave apart share a name because one vibrates exactly twice as fast as the other."],
  },
  {
    id: "CN.2", title: "Intervals: fifths and thirds", buildsOn: ["CN.1"], minutes: 7, cardIds: [], initial: { ...SOFT },
    outcome: "Play a fifth, a major third and a minor third from any note, and hear how each one feels.",
    demo: { caption: "Two notes together: a fifth, a major third, then a minor third.", tones: [...chord([60, 67], 0), ...chord([60, 64], 1.5), ...chord([60, 63], 3)] },
    idea: [
      "An interval is the distance between two notes, counted in semitones. Each distance has its own character, whichever note you start from. That is why a tune is still the same tune when it is played higher or lower.",
      "Three intervals do most of the work in chords. Seven semitones is a fifth: open and strong. Four is a major third: bright. Three is a minor third: darker. You count the gap, not the keys’ colours.",
    ],
    steps: [
      { do: "Hold A and G together (C and the G above it).", show: [...K], hear: "Open, hollow and stable. This is a fifth: seven semitones.", target: "Two notes sounding together, seven semitones apart", check: (s) => same(shape(s), [0, 7]) },
      { do: "Hold A and D together (C and E).", show: [...K], hear: "Sweet and bright. A major third: four semitones.", target: "Two notes sounding together, four semitones apart", check: (s) => same(shape(s), [0, 4]) },
      { do: "Hold A and E together (C and the black key D sharp).", show: [...K], hear: "Close to the last one, but darker. A minor third: three semitones.", target: "Two notes sounding together, three semitones apart", check: (s) => same(shape(s), [0, 3]) },
      { do: "Now start somewhere else: hold S and H together (D and A).", show: [...K], hear: "The same open sound as the first step, a little higher. Seven semitones is a fifth from any note.", target: "A fifth whose lower note is not C", check: (s) => same(shape(s), [0, 7]) && s.held.length >= 2 && Math.min(...s.held) % 12 !== 0,
        remark: (s) => `That fifth runs from ${nameOf(Math.min(...s.held))} up to ${nameOf(Math.max(...s.held))}.` },
      { do: "Find a minor third that starts on a note other than C, and hold it.", show: [...K], hear: "The same darker colour, wherever you put it.", target: "Two notes three semitones apart, the lower one not C", check: (s) => same(shape(s), [0, 3]) && Math.min(...s.held) % 12 !== 0 },
    ],
    recap: ["An interval is the distance between two notes, counted in semitones.", "A fifth is seven semitones; a major third is four; a minor third is three.", "An interval keeps its character from whichever note it starts."],
  },
  {
    id: "CN.3", title: "Major and minor chords", buildsOn: ["CN.2"], minutes: 7, cardIds: [], initial: { ...SOFT },
    outcome: "Build a major or a minor chord on any note, and say which single note makes the difference.",
    demo: { caption: "C major, then C minor: only the middle note moves.", tones: [...chord([60, 64, 67], 0, 1.4), ...chord([60, 63, 67], 1.8, 1.4)] },
    idea: [
      "The basic chord is three notes: a starting note called the root, a third above it, and a fifth above it. The fifth makes it solid. The third gives it its mood.",
      "With a major third (four semitones) the chord is major, which most people hear as bright. Lower that one note by a semitone to a minor third (three) and the chord is minor, heard as darker. The root and the fifth do not move.",
    ],
    steps: [
      { do: "Hold A, D and G together (C, E and G).", show: [...K], hear: "A full, settled, bright chord: C major.", target: "Three notes together: a root, four semitones up, and seven up", check: (s) => same(shape(s), [0, 4, 7]) },
      { do: "Hold A, E and G together (C, D sharp and G).", show: [...K], hear: "The same chord with its middle note lowered: C minor. Darker, with the same solid frame.", target: "Three notes together: a root, three semitones up, and seven up", check: (s) => same(shape(s), [0, 3, 7]) },
      { do: "Build a major chord on F: hold F, H and K (F, A and C).", show: [...K], hear: "Bright again, on a different root. The recipe is the same: four semitones, then three more.", target: "A major chord whose root is not C", check: (s) => same(shape(s), [0, 4, 7]) && Math.min(...s.held) % 12 !== 0 },
      { do: "Build a minor chord on D: hold S, F and H (D, F and A).", show: [...K], hear: "Dark, on D. Three semitones, then four more.", target: "A minor chord whose root is not C", check: (s) => same(shape(s), [0, 3, 7]) && Math.min(...s.held) % 12 !== 0,
        remark: (s) => `That is ${nameOf(Math.min(...s.held))} minor: a root, a minor third above it and a fifth above it.` },
    ],
    recap: ["A basic chord is a root, a third above it and a fifth above it.", "A major third makes the chord major; a minor third makes it minor.", "Only the middle note changes between major and minor; the root and fifth stay."],
  },
  {
    id: "CN.4", title: "Scales: major and minor", buildsOn: ["CN.1"], minutes: 8, cardIds: [], initial: { ...SOFT },
    outcome: "Play a major scale and a natural minor scale from C, and describe each as a pattern of tones and semitones.",
    demo: { caption: "The C major scale going up, then the C minor scale going up.", tones: [...MAJOR.map((n, i) => tone(60 + n, i * 0.38, 0.34)), ...MINOR.map((n, i) => tone(60 + n, 3.6 + i * 0.38, 0.34))] },
    idea: [
      "A scale is a chosen set of notes to make music from, played in order. The major scale takes seven of the twelve notes in each octave, spaced by a fixed pattern of steps: tone, tone, semitone, tone, tone, tone, semitone. From C that pattern lands on the white keys only.",
      "The natural minor scale uses a different pattern: tone, semitone, tone, tone, semitone, tone, tone. Three of its notes sit a semitone lower than in the major scale, and those three give it its darker colour.",
    ],
    steps: [
      { do: "Play the white keys upward from C to C, one at a time: A S D F G H J K.", show: [...K], hear: "The familiar “do re mi” climb. It sounds finished when it reaches the top C.", target: "Eight notes in a row following the major scale upward", check: (s) => ran(s, MAJOR), score: melody(MAJOR.map((n) => 60 + n), 1, "C major, going up") },
      { do: "Play it back down: K J H G F D S A.", show: [...K], hear: "The same notes falling home.", target: "Eight notes in a row following the major scale downward", check: (s) => ran(s, [...MAJOR].reverse().map((n) => n - 12)) },
      { do: "Now C minor, upward: A S E F G Y U K. Three of the notes are black keys.", show: [...K], hear: "The same climb with a darker, more serious colour.", target: "Eight notes in a row following the natural minor scale upward", check: (s) => ran(s, MINOR), score: melody(MINOR.map((n) => 60 + n), 1, "C minor, going up") },
      { do: "Play just the first five notes of C major, then the first five of C minor: A S D F G, then A S E F G.", show: [...K], hear: "Only the third note differs, and it is enough to change the mood: the same note that separates a major chord from a minor one.", target: "The first five notes of the minor scale, played after trying the major", check: (s) => ran(s, MINOR.slice(0, 5)) && s.sequence.length >= 10 },
    ],
    recap: ["A scale is a set of notes chosen by a pattern of tones and semitones.", "The major scale’s pattern is tone, tone, semitone, tone, tone, tone, semitone; from C it is all white keys.", "The natural minor scale lowers three of those notes by a semitone, which darkens it."],
  },
  {
    id: "CN.5", title: "Chords that belong to a scale", buildsOn: ["CN.3", "CN.4"], minutes: 8, cardIds: [], initial: { ...SOFT },
    outcome: "Build chords using only the notes of C major, and hear which come out major and which minor.",
    demo: { caption: "Four chords made only from white keys: C, D minor, E minor, F.", tones: [...chord([60, 64, 67], 0, 0.9), ...chord([62, 65, 69], 1.1, 0.9), ...chord([64, 67, 71], 2.2, 0.9), ...chord([65, 69, 72], 3.3, 0.9)] },
    idea: [
      "Songs mostly stay inside one scale, and so do their chords. To build a chord that belongs to a scale, start on any of its notes and take every other note: play one, skip one, play one, skip one, play one.",
      "Do that on the white keys and you never choose major or minor: the scale chooses for you. Starting on C or F the chord comes out major. Starting on D or E it comes out minor. That mix of bright and dark chords is where a key gets its character.",
    ],
    steps: [
      { do: "Hold A, D and G: start on C and take every other white key.", show: [...K], hear: "C major: bright, and it feels like home.", target: "C, E and G sounding together", check: (s) => sounding(s, [0, 4, 7]) },
      { do: "Move every finger one white key up: hold S, F and H.", show: [...K], hear: "A darker chord. The same hand shape has given a minor chord: D minor.", target: "D, F and A sounding together", check: (s) => sounding(s, [2, 5, 9]) },
      { do: "One more white key up: hold D, G and J.", show: [...K], hear: "Minor again: E minor.", target: "E, G and B sounding together", check: (s) => sounding(s, [4, 7, 11]) },
      { do: "And once more: hold F, H and K.", show: [...K], hear: "Bright again: F major. The hand never changed shape; the scale decided.", target: "F, A and C sounding together", check: (s) => sounding(s, [5, 9, 0]) },
      { do: "Go back home: hold A, D and G again.", show: [...K], hear: "After the others, C major sounds like an arrival.", target: "C, E and G sounding together", check: (s) => sounding(s, [0, 4, 7]) && s.sequence.length >= 3 },
    ],
    recap: ["Chords that belong to a scale are built by taking every other note of it.", "In C major the chords on C and F come out major, and those on D and E come out minor.", "The scale decides which chords are major and which are minor; the hand shape stays the same."],
  },
  {
    id: "CN.6", title: "Inversions: the same chord, rearranged", buildsOn: ["CN.5"], minutes: 6, cardIds: [], initial: { ...SOFT },
    outcome: "Play a chord with a different note at the bottom, and say why it is still the same chord.",
    demo: { caption: "C major three ways: C at the bottom, then E at the bottom, then back.", tones: [...chord([60, 64, 67], 0, 1.1), ...chord([64, 67, 72], 1.4, 1.1), ...chord([60, 64, 67], 2.8, 1.1)] },
    idea: [
      "A chord is named by which notes are in it, not by the order they are stacked in. C, E and G make C major whether C is at the bottom, or E, or G. Putting a note other than the root at the bottom is called an inversion.",
      "Inversions matter for two reasons. They change the chord’s colour a little: lighter, less settled. And they let you move from one chord to the next by shifting a finger or two, where jumping the whole hand would sound clumsy.",
    ],
    steps: [
      { do: "Hold A, D and G: C major with C at the bottom.", show: [...K], hear: "The plain, settled form.", target: "C, E and G together, with C lowest", check: (s) => sounding(s, [0, 4, 7]) && Math.min(...s.held) % 12 === 0 },
      { do: "Hold D, G and K: the same three notes with E at the bottom and C moved to the top.", show: [...K], hear: "Still C major, but lighter and less final.", target: "C, E and G together, with E lowest", check: (s) => sounding(s, [0, 4, 7]) && Math.min(...s.held) % 12 === 4 },
      { do: "Hold F, H and K: F major with F at the bottom.", show: [...K], hear: "F major in its plain form.", target: "F, A and C together, with F lowest", check: (s) => sounding(s, [5, 9, 0]) && Math.min(...s.held) % 12 === 5 },
      { do: "Hold A, F and H: F major again, with C at the bottom.", show: [...K], hear: "The same chord, sitting right next to where C major was. Only two fingers had to move.", target: "F, A and C together, with C lowest", check: (s) => sounding(s, [5, 9, 0]) && Math.min(...s.held) % 12 === 0 },
    ],
    recap: ["A chord is named by the notes in it, not by their order.", "An inversion puts a note other than the root at the bottom, which lightens the chord.", "Inversions let neighbouring chords sit close together, so the hand hardly moves."],
  },
  {
    id: "CN.7", title: "A four-chord progression", buildsOn: ["CN.6"], minutes: 8, cardIds: [], initial: { ...SOFT },
    outcome: "Play four chords from one scale in a row, close together under the hand, and loop them.",
    demo: { caption: "C, G, A minor, F: four chords from the C major scale, each close to the last.", tones: [...chord([60, 64, 67], 0, 0.95), ...chord([62, 67, 71], 1.1, 0.95), ...chord([60, 64, 69], 2.2, 0.95), ...chord([60, 65, 69], 3.3, 0.95)] },
    idea: [
      "A progression is a row of chords played one after another. Music gets its sense of travelling and coming home from it. One of the most used takes four chords from a major scale: the chords on its first, fifth, sixth and fourth notes. In C that is C, G, A minor and F.",
      "Played with every root at the bottom, the hand would leap about. With inversions each chord is a small move from the last, and the top notes make a little tune of their own.",
    ],
    steps: [
      { do: "Hold A, D and G: C major.", show: [...K], hear: "Home.", target: "C, E and G together", check: (s) => sounding(s, [0, 4, 7]) },
      { do: "Hold S, G and J: G major, with D at the bottom.", show: [...K], hear: "A lift away from home. It wants to go somewhere.", target: "G, B and D together", check: (s) => sounding(s, [7, 11, 2]) },
      { do: "Hold A, D and H: A minor, with C at the bottom.", show: [...K], hear: "The dark one of the four. Only one finger moved from C major.", target: "A, C and E together", check: (s) => sounding(s, [9, 0, 4]) },
      { do: "Hold A, F and H: F major, with C at the bottom.", show: [...K], hear: "Warm, and leaning back toward home.", target: "F, A and C together", check: (s) => sounding(s, [5, 9, 0]) },
      { do: "Play all four in a row without stopping: C, G, A minor, F.", show: [...K], hear: "A loop you have heard in a great many songs. Go round again and it joins up.", target: "The four chords played one after another, in that order", check: (s) => chordRun(s, [[0, 4, 7], [7, 11, 2], [9, 0, 4], [5, 9, 0]]) },
    ],
    recap: ["A progression is a row of chords; it gives music its sense of leaving and coming home.", "The chords on the first, fifth, sixth and fourth notes of a major scale make a very widely used loop.", "Inversions keep each chord a small move from the one before."],
  },
  {
    id: "CN.8", title: "Seventh chords", buildsOn: ["CN.5"], minutes: 7, cardIds: [], initial: { ...SOFT },
    outcome: "Add a fourth note to a chord and hear how it softens or tightens it.",
    demo: { caption: "C major, then with a seventh added on top two ways, then D minor with its seventh.", tones: [...chord([60, 64, 67], 0, 1), ...chord([60, 64, 67, 71], 1.3, 1), ...chord([60, 64, 67, 70], 2.6, 1), ...chord([62, 65, 69, 72], 3.9, 1)] },
    idea: [
      "Keep taking every other note of the scale past the fifth and you reach a fourth note, seven steps of the scale above the root: the seventh. A three-note chord states its mood plainly. Adding the seventh makes it richer and less blunt.",
      "Which seventh matters. On C, the white-key seventh is B, eleven semitones up: a soft, dreamy major seventh chord. Lower it one semitone to A sharp and the chord tightens and wants to move on. A minor chord with its seventh sounds mellow.",
    ],
    steps: [
      { do: "Hold A, D, G and J together (C, E, G and B).", show: [...K], hear: "C major with a soft glow on top: a major seventh chord.", target: "A major chord with the note eleven semitones above its root", check: (s) => same(shape(s), [0, 4, 7, 11]) },
      { do: "Change the top note to the black key below it: hold A, D, G and U (C, E, G and A sharp).", show: [...K], hear: "Tighter and restless. It sounds as if it must lead somewhere.", target: "A major chord with the note ten semitones above its root", check: (s) => same(shape(s), [0, 4, 7, 10]) },
      { do: "Hold S, F, H and K (D, F, A and C).", show: [...K], hear: "Mellow and smooth: D minor with its seventh.", target: "A minor chord with the note ten semitones above its root", check: (s) => same(shape(s), [0, 3, 7, 10]) },
      { do: "Hold A, D, G and H (C, E, G and A).", show: [...K], hear: "Mellow again. These are the notes of A minor with its seventh, stacked with C at the bottom: an inversion.", target: "A, C, E and G together", check: (s) => sounding(s, [9, 0, 4, 7]) },
    ],
    recap: ["A seventh chord adds a fourth note by taking one more step of every-other-note up the scale.", "A major chord with a major seventh is soft and dreamy; with the seventh a semitone lower it is restless.", "A minor chord with its seventh sounds mellow."],
  },
  {
    id: "CN.9", title: "Changing key: the same shapes, somewhere else", buildsOn: ["CN.4", "C1.2"], minutes: 6, cardIds: [], initial: { ...SOFT },
    outcome: "Move a scale or a chord to another key without learning new fingerings, using the oscillator’s Semitone setting.",
    demo: { caption: "The start of a major scale from C, then the same pattern from D, then from G.", tones: [...[0, 2, 4, 5, 7].map((n, i) => tone(60 + n, i * 0.3, 0.27)), ...[0, 2, 4, 5, 7].map((n, i) => tone(62 + n, 1.9 + i * 0.3, 0.27)), ...[0, 2, 4, 5, 7].map((n, i) => tone(67 + n, 3.8 + i * 0.3, 0.27))] },
    idea: [
      "A scale is a pattern of steps, so it can start on any note. Start the major pattern on D and you have D major; on G, G major. The tune and the chords keep their shape and character and simply sit higher or lower. Moving music like this is called transposing, and the starting note names the key.",
      "On a real keyboard each key has its own mix of black and white notes to learn. A synth offers a shortcut: shift the oscillator by some semitones and the white keys you already know now sound in the new key.",
    ],
    steps: [
      { do: "Play the C major scale upward on the white keys: A S D F G H J K.", show: [...K, "semitone"], hear: "C major, as before.", target: "Eight notes in a row following the major scale upward", check: (s) => ran(s, MAJOR) },
      { do: "Set Osc A’s Semitone to 2, and play exactly the same keys.", show: [...K, "semitone"], hear: "The same climb, a tone higher. You are now playing D major with the fingering of C major.", target: "Semitone at 2, and the same eight keys played", check: (s) => s.state.semitone === 2 && ran(s, MAJOR) },
      { do: "Set Semitone to 7 and hold A, D and G together.", show: [...K, "semitone"], hear: "A major chord, bright as ever, but it is G major now: seven semitones above C.", target: "Semitone at 7, and a major chord held", check: (s) => s.state.semitone === 7 && same(shape(s), [0, 4, 7]),
        remark: (s) => `With Semitone at ${s.state.semitone}, the keys for C major sound as ${nameOf(s.state.semitone)} major.` },
      { do: "Set Semitone back to 0 and Octave to -1, and hold the same chord.", show: [...K, "semitone", "octave"], hear: "C major again, an octave lower: darker and heavier, but the same chord.", target: "Semitone at 0, octave at -1, and a major chord held", check: (s) => s.state.semitone === 0 && s.state.octave === -1 && same(shape(s), [0, 4, 7]) },
    ],
    recap: ["A scale or chord is a pattern, so it can start on any note; the starting note names the key.", "Moving music to another key is transposing: its shape and character stay the same.", "On a synth, shifting the oscillator by semitones puts the white keys in a new key."],
  },
  {
    id: "CN.10", title: "Reading notes on the staff", buildsOn: ["CN.1"], minutes: 8, cardIds: [], initial: { ...SOFT },
    outcome: "Read notes from a staff and play them: which line or space is which note, and what a sharp sign does.",
    demo: { caption: "Five notes climbing step by step from middle C, then the same five leaping about.", tones: [...[60, 62, 64, 65, 67].map((n, i) => tone(n, i * 0.4, 0.35)), ...[60, 64, 67, 62, 65].map((n, i) => tone(n, 2.4 + i * 0.4, 0.35))] },
    idea: [
      "Sheet music is a graph. Left to right is time; up and down is pitch. The five lines are a ladder: a note sits on a line or in the space between two lines, and each move to the next line or space is one white key. The sign at the far left, the treble clef, fixes which notes the lines stand for.",
      "With that clef the bottom line is the E above middle C, and the lines going up are E, G, B, D, F. The spaces between them are F, A, C, E. Middle C is too low for the five lines, so it gets a short line of its own underneath. A sharp sign in front of a note means the black key just above it.",
    ],
    steps: [
      { do: "Play the five notes on the page, left to right. They climb one step at a time from middle C.", show: [...K], hear: "C, D, E, F, G: the first five white keys. Each move up the page is one white key up.", target: "The five notes played in order", score: melody([60, 62, 64, 65, 67], 1, "Steps up from middle C"), check: (s) => played(melody([60, 62, 64, 65, 67]), s.sequence) },
      { do: "Now the notes that sit on the five lines, from the bottom line up.", show: [...K], hear: "E, G, B, D, F. They leap: from one line to the next skips a white key.", target: "The five line notes played in order", score: melody([64, 67, 71, 74, 77], 1, "The lines"), check: (s) => played(melody([64, 67, 71, 74, 77]), s.sequence) },
      { do: "And the notes in the four spaces, from the bottom up.", show: [...K], hear: "F, A, C, E. Together the lines and spaces cover every white key from E up to F.", target: "The four space notes played in order", score: melody([65, 69, 72, 76], 1, "The spaces"), check: (s) => played(melody([65, 69, 72, 76]), s.sequence) },
      { do: "Read this one: it leaps up and comes back down.", show: [...K], hear: "The notes of the C major chord, one at a time, up and back: C, E, G, C, G, E, C.", target: "The seven notes played in order", score: melody([60, 64, 67, 72, 67, 64, 60], 1, "Leaps"), check: (s) => played(melody([60, 64, 67, 72, 67, 64, 60]), s.sequence) },
      { do: "This one has a sharp sign in front of its fourth note. Play it.", show: [...K], hear: "C, D, E, then F sharp, the black key just above F, then G. The sharp makes the climb to G sound eager.", target: "The five notes played in order, with F sharp", score: melody([60, 62, 64, 66, 67], 1, "A sharp"), check: (s) => played(melody([60, 62, 64, 66, 67]), s.sequence) },
    ],
    recap: ["On a staff, left to right is time and up and down is pitch; each line or space is one white key.", "In the treble clef the lines are E, G, B, D, F and the spaces F, A, C, E; middle C has a short line of its own below.", "A sharp sign in front of a note means the black key just above it."],
  },
  {
    id: "CN.11", title: "Play a tune from the page", buildsOn: ["CN.10", "CN.3"], minutes: 9, cardIds: [], initial: { ...SOFT },
    outcome: "Play a well-known tune, and then a row of chords, by reading them from the staff.",
    demo: { caption: "The opening of Beethoven’s “Ode to Joy”.", tones: [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62].map((n, i) => tone(n, i * 0.42, i === 14 ? 0.8 : 0.38)) },
    idea: [
      "Reading music is the same small skill repeated: look at the next note, find how far it is from the last one, play it. Most tunes move by steps to the next line or space, with an occasional leap, so you rarely have to work a note out from nothing.",
      "Notes also show how long they last. A filled note with a stem lasts one beat. A hollow note with a stem lasts two. When notes are stacked one above another, they are played together: a chord.",
    ],
    steps: [
      { do: "Play the first phrase. It moves almost entirely by step. Press Listen first if you want to hear it.", show: [...K], hear: "The start of “Ode to Joy”: up from E to G and back down to D.", target: "The eight notes played in order", score: melody([64, 64, 65, 67, 67, 65, 64, 62], 1, "Ode to Joy, first phrase"), check: (s) => played(melody([64, 64, 65, 67, 67, 65, 64, 62]), s.sequence) },
      { do: "Play the second phrase. The last note is hollow: it lasts two beats.", show: [...K], hear: "Down to C, back up to E, and settling on D.", target: "The seven notes played in order", score: ODE_2, check: (s) => played(ODE_2, s.sequence) },
      { do: "Now both phrases in a row.", show: [...K], hear: "The whole opening line of the tune.", target: "All fifteen notes played in order", score: ODE, check: (s) => played(ODE, s.sequence) },
      { do: "Stacked notes are played together. Read and play these four chords.", show: [...K], hear: "C major, F major, G major, and home to C major. Each is three notes held at once.", target: "The four chords played in order", score: CHORDS, check: (s) => played(CHORDS, s.sequence) },
    ],
    recap: ["Reading is finding how far the next note is from the last: mostly steps, sometimes a leap.", "A filled note with a stem lasts one beat; a hollow one with a stem lasts two.", "Notes stacked one above another are played together as a chord."],
  },
];
