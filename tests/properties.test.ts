// Property tests: instead of a few hand-picked cases, fast-check makes hundreds of random ones and looks
// for any that break a rule which must always hold.
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { readMidi, writeMidi, notesToMidi, midiToNotes } from "../src/daw/midi";
import { fft, FRAME, fromBins, readWav, tableWav, toBins } from "../src/synth/wtedit";
import { snapStep, type NoteEv } from "../src/daw/song";

const midiNote = fc.record({ note: fc.integer({ min: 0, max: 127 }), start: fc.integer({ min: 0, max: 20000 }), length: fc.integer({ min: 1, max: 4000 }), velocity: fc.integer({ min: 1, max: 127 }) });

describe("rules that must hold for any input", () => {
  it("a MIDI file written and read back has the same tempo and the same notes", () => {
    fc.assert(fc.property(fc.integer({ min: 40, max: 240 }), fc.array(fc.array(midiNote, { maxLength: 30 }), { minLength: 1, maxLength: 4 }), (bpm, tracks) => {
      const file = { ppq: 480, bpm, tracks: tracks.map((notes, i) => ({ name: `T${i}`, channel: i, notes })) };
      const back = readMidi(writeMidi(file));
      expect(back).toBeDefined();
      expect(Math.round(back!.bpm ?? 0)).toBe(bpm);
      const key = (n: { note: number; start: number; length: number; velocity: number }) => `${n.start}:${n.note}:${n.length}:${n.velocity}`;
      const withNotes = back!.tracks.filter((t) => t.notes.length);
      const sent = tracks.filter((t) => t.length);
      expect(withNotes.length).toBe(sent.length);
      // two notes of one pitch that overlap cannot be told apart in a MIDI file, so only tracks without such pairs are compared exactly
      sent.forEach((notes, i) => {
        const clash = notes.some((a, x) => notes.some((b, y) => x !== y && a.note === b.note && a.start < b.start + b.length && b.start < a.start + a.length));
        if (!clash) expect(withNotes[i]!.notes.map(key).sort()).toEqual(notes.map(key).sort());
      });
    }), { numRuns: 150 });
  });
  it("clip notes survive the trip to MIDI and back", () => {
    const ev = fc.record({ note: fc.integer({ min: 36, max: 96 }), start: fc.integer({ min: 0, max: 15 * 24 }).map((x) => x / 24), length: fc.integer({ min: 6, max: 48 }).map((x) => x / 24), velocity: fc.integer({ min: 1, max: 127 }) });
    fc.assert(fc.property(fc.uniqueArray(ev, { maxLength: 20, selector: (n) => n.note }), (notes: NoteEv[]) => {
      const fit = notes.filter((n) => n.start + n.length <= 16);
      const back = midiToNotes(notesToMidi(fit), 480, 16);
      expect(back.left).toBe(0);
      const key = (n: NoteEv) => `${snapStep(n.start)}:${n.note}:${snapStep(n.length)}:${n.velocity}`;
      expect(back.notes.map(key).sort()).toEqual(fit.map(key).sort());
    }), { numRuns: 150 });
  });
  it("the fast transform there and back returns the wave", () => {
    fc.assert(fc.property(fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: 256, maxLength: 256 }), (xs) => {
      const re = Float64Array.from(xs), im = new Float64Array(256);
      fft(re, im); fft(re, im, true);
      xs.forEach((x, i) => { expect(re[i]! / 256).toBeCloseTo(x, 9); expect(im[i]! / 256).toBeCloseTo(0, 9); });
    }), { numRuns: 60 });
  });
  it("a frame taken apart into harmonics and put back is the same frame (less its average and its very top)", () => {
    fc.assert(fc.property(fc.array(fc.tuple(fc.integer({ min: 1, max: 500 }), fc.double({ min: 0.01, max: 1, noNaN: true }), fc.double({ min: -0.5, max: 0.5, noNaN: true })), { minLength: 1, maxLength: 12 }), (parts) => {
      const w = Float32Array.from({ length: FRAME }, (_, i) => parts.reduce((y, [k, m, p]) => y + m * Math.sin(2 * Math.PI * (k * i / FRAME + p)), 0));
      const back = fromBins(toBins(w));
      for (let i = 0; i < FRAME; i += 37) expect(back[i]!).toBeCloseTo(w[i]!, 3);
    }), { numRuns: 40 });
  });
  it("a table saved as a 32-bit file reads back sample for sample", () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 3 }), fc.integer({ min: 1, max: 1e6 }), (frames, seed) => {
      let s = seed; const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2147483648 - 1; };
      const table = Array.from({ length: frames }, () => Float32Array.from({ length: FRAME }, next));
      const back = readWav(tableWav(table, 32));
      expect(back?.samples.length).toBe(frames * FRAME);
      for (let i = 0; i < frames * FRAME; i += 101) expect(back!.samples[i]!).toBeCloseTo(table[Math.floor(i / FRAME)]![i % FRAME]!, 6);
    }), { numRuns: 25 });
  });
});
