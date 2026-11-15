// Sheet music as data, and the rules for following it. A score is a row of notes or chords, each with a
// length in beats. The page is drawn from this by src/ui/Score.tsx, and `follow` says how far a learner has
// got from the notes they have played. Following goes by note name, so any octave counts, and it does not
// judge timing: the page waits for you.
export interface ScoreItem { /** MIDI note numbers as written; more than one is a chord */ notes: number[]; /** 1 is a quarter note, 2 a half note, 4 a whole note */ beats: number }
export interface Score { items: ScoreItem[]; /** a line shown above the staff */ title?: string }

const STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6], SHARP = [false, true, false, true, false, false, true, false, true, false, true, false];
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
/** The letter keys of the computer keyboard that play each note, from C: A W S E D F T G Y H U J, and K for the next C. */
const KEYS = ["A", "W", "S", "E", "D", "F", "T", "G", "Y", "H", "U", "J"];
export const pitchClass = (note: number) => ((note % 12) + 12) % 12;

/** Where a note sits on the treble staff: steps above the bottom line (E above middle C is 0), and whether it carries a sharp. */
export function staffPlace(note: number): { step: number; sharp: boolean; name: string; key: string } {
  const pc = pitchClass(note), octave = Math.floor(note / 12) - 1, diatonic = octave * 7 + STEP[pc]!;
  return { step: diatonic - 30, sharp: SHARP[pc]!, name: LETTERS[STEP[pc]!]! + (SHARP[pc] ? "♯" : ""), key: note % 12 === 0 && note >= 72 ? "K" : KEYS[pc]! };
}
/** The short extra lines a note outside the five staff lines needs: their steps (even numbers below 0 or above 8). */
export function ledgerLines(step: number): number[] {
  const out: number[] = [];
  for (let s = -2; s >= step; s -= 2) out.push(s);
  for (let s = 10; s <= step; s += 2) out.push(s);
  return out;
}

export interface Followed { /** how many items of the current pass are done */ at: number; /** how many times the whole score has been played through */ completed: number; /** the most recent note was not the one asked for */ wrong: boolean; /** for a chord in progress: the note names already played */ part: number[] }
/**
 * How far through the score the played notes have got. A single note is passed by playing a note of that
 * name; a chord by playing all its notes one after another in any order (or together). A wrong note is
 * simply not counted. After the last item the score starts again.
 */
export function follow(score: Score, sequence: readonly number[]): Followed {
  let at = 0, completed = 0, wrong = false, part: number[] = [];
  if (!score.items.length) return { at, completed, wrong, part };
  for (const n of sequence) {
    const want = [...new Set(score.items[at]!.notes.map(pitchClass))], p = pitchClass(n);
    if (want.length === 1) { if (p === want[0]) { at++; wrong = false; } else wrong = true; }
    else if (want.includes(p)) { if (!part.includes(p)) part = [...part, p]; wrong = false; if (part.length === want.length) { at++; part = []; } }
    else { wrong = true; part = []; }
    if (at >= score.items.length) { completed++; at = 0; }
  }
  return { at, completed, wrong, part };
}
/** True once the whole score has been played through at least once. */
export const played = (score: Score, sequence: readonly number[]) => follow(score, sequence).completed >= 1;
/** A score from note numbers, every note the same length (0 in the list is not allowed; use `items` for chords). */
export const melody = (notes: number[], beats = 1, title?: string): Score => ({ items: notes.map((n) => ({ notes: [n], beats })), ...(title ? { title } : {}) });
/** When each item starts, in beats from the beginning, and the whole length. */
export function timing(score: Score): { starts: number[]; total: number } {
  const starts: number[] = []; let t = 0;
  for (const it of score.items) { starts.push(t); t += it.beats; }
  return { starts, total: t };
}
