// The catalogue of the private library: what each source is, who wrote it and when, what it is for, and
// (worked out from the library itself) how many pages, chapters and pictures it has. This file holds only
// our own descriptions; a source's text never comes through here except as a short excerpt found by a search.
import { z } from "zod";
import { pageOf, search, type Index, type Passage } from "./search.js";

export const KINDS = ["Manual", "Book", "Paper", "Maker's document", "Patent"] as const;
export type Kind = (typeof KINDS)[number];
export const TOPICS = ["Synthesis", "Physical modelling", "Effects", "Rhythm and groove", "Hearing", "Sound systems", "The owner's tools"] as const;
export type Topic = (typeof TOPICS)[number];

export interface Meta { kind: Kind; by: string; year: number; topic: Topic; about: string; /** where the copy came from */ from: string }

/** One entry per book id in `library/`. A test fails when a book has no entry here. */
export const META: Record<string, Meta> = {
  "serum-2-user-guide": { kind: "Manual", by: "Xfer Records", year: 2025, topic: "The owner's tools", about: "Every panel and control of Serum 2. The guide's source for anything done in Serum.", from: "Supplied by the owner" },
  "ableton-live-11-manual": { kind: "Manual", by: "Ableton", year: 2021, topic: "The owner's tools", about: "The whole Live 11 reference manual: views, clips, warping, automation, every device and instrument. The Studio follows it.", from: "Supplied by the owner" },
  "rift-manual": { kind: "Manual", by: "Minimal Audio", year: 2021, topic: "The owner's tools", about: "The Rift distortion plugin: its distortion types, feedback, filter and modulation.", from: "Supplied by the owner" },
  "yamaha-vl1-getting-started": { kind: "Manual", by: "Yamaha", year: 1994, topic: "Physical modelling", about: "The first volume of the manual of the first physical-modelling synthesizer: what its model is and how its controllers are played.", from: "Supplied by the owner" },
  "yamaha-vl1-feature-reference": { kind: "Manual", by: "Yamaha", year: 1994, topic: "Physical modelling", about: "The second volume: every setting of the VL1's model, controllers, modifiers and effects, as the maker explains them.", from: "Supplied by the owner" },
  "puckette-electronic-music": { kind: "Book", by: "Miller Puckette", year: 2006, topic: "Synthesis", about: "A textbook of synthesis methods: sinusoids, wavetables and sampling, modulation, designer spectra, delays, filters, Fourier methods and classical waveforms. Its examples are Pure Data patches.", from: "Supplied by the owner (the author's free draft)" },
  "chowning-fm-synthesis": { kind: "Paper", by: "John M. Chowning", year: 1973, topic: "Synthesis", about: "The paper that introduced FM synthesis: how one oscillator shaking another's frequency makes whole spectra, and recipes for brass, woodwind and bells.", from: "Supplied by the owner" },
  "stilson-alias-free-waveforms": { kind: "Paper", by: "Tim Stilson and Julius Smith", year: 1996, topic: "Synthesis", about: "Why a digital sawtooth or square makes false tones, and ways of making clean ones.", from: "Supplied by the owner" },
  "szabo-super-saw": { kind: "Paper", by: "Adam Szabo", year: 2010, topic: "Synthesis", about: "A thesis measuring the Roland JP-8000's Super Saw: seven detuned saws, and its detune and mix curves.", from: "Supplied by the owner" },
  "pekonen-moog-sawtooth": { kind: "Paper", by: "Pekonen, Lazzarini, Timoney, Kleimola, Välimäki", year: 2011, topic: "Synthesis", about: "The sawtooth of a Minimoog Voyager as recorded, against the textbook sawtooth. The synth's Analogue saw table comes from it.", from: "Open access, taken from the publisher" },
  "lazzarini-adaptive-phase-distortion": { kind: "Paper", by: "Lazzarini, Timoney, Pekonen, Välimäki", year: 2009, topic: "Synthesis", about: "Phase distortion, the method of Casio's CZ synths, and an extension of it. The synth's Phase saw and Phase pulse come from it.", from: "The authors' university archive" },
  "kleimola-vector-phaseshaping": { kind: "Paper", by: "Kleimola, Lazzarini, Timoney, Välimäki", year: 2011, topic: "Synthesis", about: "A further extension of phase distortion that makes formant-like shapes. The synth's Formant table comes from it.", from: "The authors' university archive" },
  "lazzarini-distortion-synthesis": { kind: "Paper", by: "Victor Lazzarini and Joseph Timoney", year: 2010, topic: "Synthesis", about: "Making saws, squares and triangles by bending a sine. The synth's Driven square and Driven saw come from it.", from: "The authors' university archive" },
  "esqueda-wavefolders": { kind: "Paper", by: "Esqueda, Pöntynen, Parker, Bilbao", year: 2017, topic: "Synthesis", about: "Models of the Lockhart and Serge wavefolder circuits. The synth's Circuit fold warp comes from it.", from: "Open access, taken from the publisher" },
  "esqueda-buchla-wavefolder": { kind: "Paper", by: "Esqueda, Pöntynen, Välimäki, Parker", year: 2017, topic: "Synthesis", about: "A model of the wavefolder in the Buchla 259, the heart of the \"west coast\" sound.", from: "Supplied by the owner" },
  "dattorro-effect-design-1": { kind: "Paper", by: "Jon Dattorro", year: 1997, topic: "Effects", about: "How a plate-style reverb is built from delays and all-pass filters, with the full design, plus notes on other filters.", from: "Supplied by the owner" },
  "smith-digital-waveguides": { kind: "Paper", by: "Julius O. Smith", year: 1992, topic: "Physical modelling", about: "The founding paper of waveguide synthesis: strings, tubes, reeds and bows as delay loops. The plucked string, tube and bow models follow it.", from: "The author's own site" },
  "smith-virtual-acoustic-instruments": { kind: "Paper", by: "Julius O. Smith", year: 2004, topic: "Physical modelling", about: "A review of physical modelling by its inventor: strings, pianos, guitars, winds and voice.", from: "The author's own site" },
  "four-decades-digital-waveguides": { kind: "Paper", by: "Tablas de Paula, Smith, Välimäki, Reiss", year: 2026, topic: "Physical modelling", about: "A recent history and survey of waveguide synthesis (a draft).", from: "arXiv" },
  "karjalainen-plucked-string-models": { kind: "Paper", by: "Karjalainen, Välimäki, Tolonen", year: 1998, topic: "Physical modelling", about: "From the simple Karplus-Strong plucked string to full string models: tuning, loss filters, pluck position, two polarisations.", from: "Supplied by the owner" },
  "serafin-bowed-string": { kind: "Paper", by: "Serafin, Smith, Woodhouse", year: 1999, topic: "Physical modelling", about: "How friction and twisting of the string decide whether a bowed-string model can be played.", from: "The author's own site" },
  "mcintyre-oscillations-of-instruments": { kind: "Paper", by: "McIntyre, Schumacher, Woodhouse", year: 1983, topic: "Physical modelling", about: "The classic account of instruments that sustain themselves: reeds, bows and flutes as a loop with one bent part.", from: "The author's own page" },
  "bank-piano-synthesis": { kind: "Paper", by: "Bank, Avanzini, Borin, De Poli, Fontana, Rocchesso", year: 2003, topic: "Physical modelling", about: "An overview of modelling a piano: the hammer, the string, the soundboard.", from: "Supplied by the owner" },
  "vanduyne-waveguide-mesh": { kind: "Paper", by: "Scott Van Duyne and Julius Smith", year: 1993, topic: "Physical modelling", about: "Drum skins and plates as a mesh of delay lines.", from: "The author's own site" },
  "avanzini-membrane-percussion": { kind: "Paper", by: "Federico Avanzini and Riccardo Marogna", year: 2010, topic: "Physical modelling", about: "A drum built from parts: the skin's modes and what strikes it. The drum head model follows it.", from: "The author's own site" },
  "modal-synthesis-framework": { kind: "Paper", by: "Ilia Bisnovatyi", year: 2000, topic: "Physical modelling", about: "Modal synthesis: a sound as a bank of ringing modes.", from: "arXiv" },
  "bilbao-ness-project": { kind: "Paper", by: "Bilbao and others", year: 2019, topic: "Physical modelling", about: "Large modern models of brass, strings, plates, drums and rooms from the NESS project.", from: "The authors' university archive" },
  "raman-drums-harmonic-overtones": { kind: "Paper", by: "C. V. Raman and Sivakali Kumar", year: 1920, topic: "Physical modelling", about: "A one-page letter on why Indian drums with a loaded skin give harmonic overtones and a clear pitch.", from: "Supplied by the owner" },
  "senn-groove-drum-patterns": { kind: "Paper", by: "Senn, Kilchenmann, Bechtold, Hoesl", year: 2018, topic: "Rhythm and groove", about: "A listening study of which features of drum patterns go with the urge to move, and how much depends on the listener.", from: "Supplied by the owner (open access)" },
  "senn-microtiming-groove": { kind: "Paper", by: "Senn, Kilchenmann, von Georgi, Bullerjahn", year: 2016, topic: "Rhythm and groove", about: "A listening study of whether expert players' tiny timing deviations change how swing and funk grooves are felt.", from: "Supplied by the owner (open access)" },
  "hove-low-pitch-timing": { kind: "Paper", by: "Hove, Marie, Bruce, Trainor", year: 2014, topic: "Rhythm and groove", about: "Experiments showing timing is perceived more precisely in lower-pitched tones than higher ones.", from: "Supplied by the owner" },
  "hockman-breakbeat-resequencing": { kind: "Paper", by: "Jason Hockman and Matthew Davies", year: 2015, topic: "Rhythm and groove", about: "How breakbeats are cut up and rearranged in hardcore, jungle and drum and bass, and how software can recognise them.", from: "Supplied by the owner" },
  "rajala-infrasound-loudness": { kind: "Paper", by: "Rajala, Hakala, Alakoivu, Koskela, Hongisto", year: 2022, topic: "Hearing", about: "Measurements of how loud very low frequencies must be to be heard, and how loud and annoying they then seem.", from: "Supplied by the owner (the authors' reprint)" },
  "knowles-premium-sound": { kind: "Maker's document", by: "Knowles", year: 2020, topic: "Sound systems", about: "A maker's white paper on the small drivers inside in-ear monitors. It argues for its own products: read it as the maker's view.", from: "Supplied by the owner" },
  "kolbrek-horn-theory": { kind: "Paper", by: "Bjørn Kolbrek", year: 2008, topic: "Sound systems", about: "Two magazine articles on how horn loudspeakers work: horn shapes, cutoff, directivity.", from: "The publisher's own site, where it is given away" },
  "funktion-one-documents": { kind: "Maker's document", by: "Funktion-One", year: 2024, topic: "Sound systems", about: "Seventy-one user guides, spec sheets and brochures for the Resolution, Evolution and bass ranges.", from: "The maker's own site" },
  "funktion-one-vero": { kind: "Maker's document", by: "Funktion-One", year: 2024, topic: "Sound systems", about: "The Vero touring system: its user guide, brochure, spec sheets and bass cabinet drawings.", from: "The maker's own site" },
  "funktion-one-patent-us6650760": { kind: "Patent", by: "Andrews, Hunt, Newsham (Funktion One)", year: 2003, topic: "Sound systems", about: "A patent for an upper bass and low mid horn loudspeaker with a central plug, with cross-section drawings.", from: "Google Patents (a public document)" },
};

export interface Source extends Meta {
  id: string; title: string;
  /** pages of text in the library, and the first and last page numbers */
  pages: number; first: number; last: number;
  /** chapters in reading order, with the pages each covers */
  chapters: { name: string; from: number; to: number; pages: number }[];
  /** pictures the guide can show with this source's pages */
  pictures: number;
}

const bookOf = (p: Passage) => p.id.split("#")[0]!;

/** Every book in the library as a catalogue entry, in the order of `META` (books with no entry come last, described as unknown). */
export function catalogue(index: Index): Source[] {
  const books = new Map<string, { title: string; pages: Map<number, string>; pictures: Set<string> }>();
  for (const p of index.passages) {
    if (p.page === undefined || p.id.startsWith("card:")) continue;
    const id = bookOf(p), b = books.get(id) ?? { title: p.source, pages: new Map(), pictures: new Set() };
    b.pages.set(p.page, p.section);
    for (const im of p.images ?? []) b.pictures.add(im.file);
    books.set(id, b);
  }
  const order = Object.keys(META);
  return [...books.entries()].sort(([a], [b]) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999)).map(([id, b]) => {
    const nums = [...b.pages.keys()].sort((x, y) => x - y), chapters: Source["chapters"] = [];
    for (const n of nums) { const name = b.pages.get(n) || "(no chapter)", last = chapters[chapters.length - 1]; if (last && last.name === name) { last.to = n; last.pages++; } else chapters.push({ name, from: n, to: n, pages: 1 }); }
    const meta = META[id] ?? { kind: "Paper" as Kind, by: "", year: 0, topic: "Synthesis" as Topic, about: "Not described yet.", from: "" };
    return { id, title: b.title, ...meta, pages: nums.length, first: nums[0] ?? 0, last: nums[nums.length - 1] ?? 0, chapters, pictures: b.pictures.size };
  });
}

/** The most text of a source the Sources tab ever shows for one search result. */
export const EXCERPT_MAX = 420;
/** A short stretch of a passage around the first place one of the asked words appears. Never the whole page. */
export function excerpt(text: string, query: string, max = EXCERPT_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim(), words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const low = flat.toLowerCase();
  let at = -1; for (const w of words) { const i = low.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; }
  const start = Math.max(0, (at < 0 ? 0 : at) - Math.floor(max / 3)), cut = flat.slice(start, start + max);
  return `${start > 0 ? "…" : ""}${cut}${start + max < flat.length ? "…" : ""}`;
}

export interface Found { book: string; title: string; page: number; chapter: string; excerpt: string }
/** Search the library's texts (never the knowledge cards), optionally inside one source: where the words are, with a short excerpt. */
export function findIn(index: Index, query: string, book?: string, limit = 12): Found[] {
  const seen = new Set<string>(), out: Found[] = [];
  for (const h of search(index, query, limit * 2, { perPage: 1, only: (p) => p.page !== undefined && !p.id.startsWith("card:") && (!book || bookOf(p) === book) })) {
    const page = pageOf(h.passage); if (seen.has(page)) continue; seen.add(page);
    out.push({ book: bookOf(h.passage), title: h.passage.source, page: h.passage.page!, chapter: h.passage.section, excerpt: excerpt(h.passage.text, query) });
    if (out.length >= limit) break;
  }
  return out;
}

export const SourcesRequestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("list") }),
  z.object({ op: z.literal("find"), query: z.string().trim().min(2).max(200), book: z.string().max(80).optional() }),
]);
