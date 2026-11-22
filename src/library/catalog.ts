// The catalogue of the private library: one card per source, for the Library tab's Sources shelf.
// What is here is about each text (who wrote it, when, what it is for), never the text itself: the words of
// a book stay on the server and reach the browser only as short excerpts found by a search.
// No imports from the browser or from node, so the server function and the page can share it.

export type SourceKind = "manual" | "paper" | "book" | "maker" | "patent";
export const KIND_NAMES: Record<SourceKind, string> = { manual: "Manual", paper: "Research paper", book: "Book", maker: "Maker's document", patent: "Patent" };
export const TOPICS = ["Synthesis", "Effects", "Physical modelling", "Rhythm and groove", "Hearing", "Sound systems", "Tools you own"] as const;
export type Topic = (typeof TOPICS)[number];

export interface SourceMeta {
  /** who wrote it, in the short form a citation uses */
  by: string;
  year: number;
  kind: SourceKind;
  topic: Topic;
  /** one plain sentence: what it covers and what it is for here */
  about: string;
  /** when it was taken into the library (ISO date) */
  added: string;
  /** something the reader should keep in mind: a maker's own claims, a draft, a partial copy */
  note?: string;
}

/** Every text in `library/`, by its id. A test keeps this list and the files in step. */
export const SOURCES: Record<string, SourceMeta> = {
  "serum-2-user-guide": { by: "Xfer Records", year: 2025, kind: "manual", topic: "Tools you own", about: "The manual for Serum 2: every panel, knob and menu. Used for the names in rebuilt patches and for the guide's answers about Serum.", added: "2026-11-12" },
  "ableton-live-11-manual": { by: "Ableton", year: 2021, kind: "manual", topic: "Tools you own", about: "The whole Live 11 reference manual, including every stock effect, instrument and shortcut. The Studio's layout and its list of what is still missing come from it.", added: "2026-11-13" },
  "rift-manual": { by: "Minimal Audio", year: 2021, kind: "manual", topic: "Tools you own", about: "The manual for the distortion plugin Rift: its distortion types, feedback, filters and modulation.", added: "2026-11-13" },
  "puckette-electronic-music": { by: "Miller Puckette", year: 2006, kind: "book", topic: "Synthesis", about: "A textbook on how electronic sound is made: sinusoids, wavetables and samplers, modulation, designed spectra, delays, filters, Fourier methods and classic waveforms.", added: "2026-11-20", note: "The author's draft of 30 December 2006. Its examples are Pure Data patches." },
  "chowning-fm-synthesis": { by: "John Chowning", year: 1973, kind: "paper", topic: "Synthesis", about: "The paper that introduced FM synthesis: how one oscillator shaking another's pitch makes rich, changing spectra, with recipes for brass, woodwind, bell and drum tones.", added: "2026-11-20" },
  "stilson-alias-free-waveforms": { by: "Stilson and Smith", year: 1996, kind: "paper", topic: "Synthesis", about: "How a digital synth can make saws, squares and triangles without the false tones (aliasing) a naive method adds.", added: "2026-11-20" },
  "szabo-super-saw": { by: "Adam Szabo", year: 2010, kind: "paper", topic: "Synthesis", about: "A thesis that measures the Roland JP-8000's Super Saw: seven saws, how the detune and mix knobs really behave, and how to rebuild it.", added: "2026-11-20", note: "A bachelor's thesis: careful measurements by one author, not a peer-reviewed study." },
  "pekonen-moog-sawtooth": { by: "Pekonen, Lazzarini, Timoney, Kleimola, Välimäki", year: 2011, kind: "paper", topic: "Synthesis", about: "What a Moog sawtooth really looks like, measured from a Minimoog Voyager, and how to model it. The Analogue saw wavetable is built from its formula.", added: "2026-11-15" },
  "lazzarini-adaptive-phase-distortion": { by: "Lazzarini, Timoney, Pekonen, Välimäki", year: 2009, kind: "paper", topic: "Synthesis", about: "Phase distortion, the method behind the Casio CZ synths: bending how fast a sine is read to make saws, pulses and resonant shapes.", added: "2026-11-15" },
  "kleimola-vector-phaseshaping": { by: "Kleimola, Lazzarini, Timoney, Välimäki", year: 2011, kind: "paper", topic: "Synthesis", about: "An extension of phase distortion that reaches formant-like shapes. The Formant wavetable comes from it.", added: "2026-11-15" },
  "lazzarini-distortion-synthesis": { by: "Lazzarini and Timoney", year: 2010, kind: "paper", topic: "Synthesis", about: "Making classic waveforms by pushing a sine through a curve. The Driven square and Driven saw wavetables come from it.", added: "2026-11-15" },
  "esqueda-wavefolders": { by: "Esqueda, Pöntynen, Parker, Bilbao", year: 2017, kind: "paper", topic: "Synthesis", about: "Models of two analogue wavefolder circuits, the Lockhart and the Serge. The Circuit fold warp is one stage of the first.", added: "2026-11-15" },
  "esqueda-buchla-wavefolder": { by: "Esqueda, Pöntynen, Välimäki, Parker", year: 2017, kind: "paper", topic: "Synthesis", about: "A model of the Buchla 259's wavefolder, the circuit behind the classic west-coast timbre.", added: "2026-11-20" },
  "dattorro-effect-design-1": { by: "Jon Dattorro", year: 1997, kind: "paper", topic: "Effects", about: "A complete plate-style reverb laid out part by part, then a set of filter designs. Many later reverbs follow it.", added: "2026-11-20", note: "Part 1 of two. Part 2 (delay-line modulation and chorus) is not in the library." },
  "smith-digital-waveguides": { by: "Julius O. Smith", year: 1992, kind: "paper", topic: "Physical modelling", about: "The founding paper on digital waveguides: strings, tubes, reeds and bows modelled as delay lines with filters.", added: "2026-11-15" },
  "smith-virtual-acoustic-instruments": { by: "Julius O. Smith", year: 2004, kind: "paper", topic: "Physical modelling", about: "A review of physical modelling by the inventor of waveguide synthesis: what works for strings, winds, pianos and voices.", added: "2026-11-15" },
  "four-decades-digital-waveguides": { by: "Tablas de Paula, Smith, Välimäki, Reiss", year: 2026, kind: "paper", topic: "Physical modelling", about: "A recent history and survey of waveguide synthesis.", added: "2026-11-15", note: "A draft that has not been through review." },
  "karjalainen-plucked-string-models": { by: "Karjalainen, Välimäki, Tolonen", year: 1998, kind: "paper", topic: "Physical modelling", about: "How the simple Karplus-Strong plucked string grows into a realistic guitar model: tuning, loss, pluck position, the body, and two strings sounding together.", added: "2026-11-20" },
  "bank-piano-synthesis": { by: "Bank, Avanzini, Borin, De Poli, Fontana, Rocchesso", year: 2003, kind: "paper", topic: "Physical modelling", about: "An overview of modelling a piano: the hammer, the stiff string, coupled strings and the soundboard.", added: "2026-11-20" },
  "serafin-bowed-string": { by: "Serafin, Smith, Woodhouse", year: 1999, kind: "paper", topic: "Physical modelling", about: "What makes a modelled bowed string playable: friction and twisting waves.", added: "2026-11-15" },
  "mcintyre-oscillations-of-instruments": { by: "McIntyre, Schumacher, Woodhouse", year: 1983, kind: "paper", topic: "Physical modelling", about: "The classic account of instruments that sustain a note: reeds, bows and flutes as one kind of system.", added: "2026-11-15" },
  "vanduyne-waveguide-mesh": { by: "Van Duyne and Smith", year: 1993, kind: "paper", topic: "Physical modelling", about: "Drum heads and plates modelled as a mesh of waveguides.", added: "2026-11-15" },
  "avanzini-membrane-percussion": { by: "Avanzini and Marogna", year: 2010, kind: "paper", topic: "Physical modelling", about: "A drum built from parts: the skin as ringing modes, struck at a chosen place.", added: "2026-11-15" },
  "modal-synthesis-framework": { by: "Bisnovatyi", year: 2000, kind: "paper", topic: "Physical modelling", about: "Modal synthesis: any ringing object as a bank of modes.", added: "2026-11-15" },
  "bilbao-ness-project": { by: "Bilbao and others", year: 2019, kind: "paper", topic: "Physical modelling", about: "Large modern models of brass, strings, plates, drums and rooms.", added: "2026-11-15" },
  "raman-drums-harmonic-overtones": { by: "C. V. Raman and Sivakali Kumar", year: 1920, kind: "paper", topic: "Physical modelling", about: "A one-page letter on a kind of Indian drum whose overtones are harmonic, like a string's: a loaded patch on the skin lines them up. It names no particular drum.", added: "2026-11-20" },
  "yamaha-vl1-getting-started": { by: "Yamaha", year: 1994, kind: "manual", topic: "Physical modelling", about: "The first volume of the manual for the VL1, the first physical-modelling synth: how its maker explains a blown or bowed model and how the player controls it.", added: "2026-11-20", note: "A maker's manual for a synth you do not own: read it for the ideas." },
  "yamaha-vl1-feature-reference": { by: "Yamaha", year: 1994, kind: "manual", topic: "Physical modelling", about: "The second volume of the VL1 manual: every setting of the model, the controllers and the modifiers.", added: "2026-11-20", note: "A maker's manual for a synth you do not own: read it for the ideas." },
  "senn-groove-drum-patterns": { by: "Senn, Kilchenmann, Bechtold, Hoesl", year: 2018, kind: "paper", topic: "Rhythm and groove", about: "A large listening study of what in a drum pattern goes with listeners wanting to move, and how much depends on the listener.", added: "2026-11-20", note: "It reports what listeners rated, not what sound does to anyone." },
  "senn-microtiming-groove": { by: "Senn, Kilchenmann, von Georgi, Bullerjahn", year: 2016, kind: "paper", topic: "Rhythm and groove", about: "A listening study of whether expert players' tiny timing shifts change how much swing and funk grooves.", added: "2026-11-20", note: "It reports what listeners rated, not what sound does to anyone." },
  "hove-low-pitch-timing": { by: "Hove, Marie, Bruce, Trainor", year: 2014, kind: "paper", topic: "Rhythm and groove", about: "Experiments showing listeners catch timing slips better in a low note than a high one, offered as a reason bass instruments carry the rhythm.", added: "2026-11-20", note: "About timing perception in the tasks tested, nothing broader." },
  "hockman-breakbeat-resequencing": { by: "Hockman and Davies", year: 2015, kind: "paper", topic: "Rhythm and groove", about: "How breakbeats are sliced and rearranged in hardcore, jungle and drum and bass, and ways for a computer to do it.", added: "2026-11-20" },
  "rajala-infrasound-loudness": { by: "Rajala, Hakala, Alakoivu, Koskela, Hongisto", year: 2022, kind: "paper", topic: "Hearing", about: "A listening study of very low frequencies: how loud they must be to be heard, and how loud and annoying they then seem.", added: "2026-11-20", note: "The authors' reprint, so its page numbers are the reprint's." },
  "kolbrek-horn-theory": { by: "Bjørn Kolbrek", year: 2008, kind: "paper", topic: "Sound systems", about: "A two-part introduction to how horn loudspeakers work: what a horn's shape does to how low and how wide it plays.", added: "2026-11-14" },
  "funktion-one-documents": { by: "Funktion-One", year: 2024, kind: "maker", topic: "Sound systems", about: "Seventy-one of the maker's user guides, spec sheets and brochures for the Resolution and Evolution ranges.", added: "2026-11-14", note: "The maker's own documents: figures are theirs." },
  "funktion-one-vero": { by: "Funktion-One", year: 2024, kind: "maker", topic: "Sound systems", about: "The Vero user guide, brochure and spec sheets, and drawings of the F124 and F221 bass cabinets.", added: "2026-11-14", note: "The maker's own documents: figures are theirs." },
  "funktion-one-patent-us6650760": { by: "Andrews, Hunt, Newsham", year: 2003, kind: "patent", topic: "Sound systems", about: "A patent for an upper-bass horn with a central plug, with cross-section drawings.", added: "2026-11-14", note: "Which products use this device is not known." },
  "knowles-premium-sound": { by: "Knowles", year: 2018, kind: "maker", topic: "Sound systems", about: "A white paper on the tiny drivers inside in-ear monitors and how several are combined.", added: "2026-11-20", note: "A maker's paper arguing for its own products. Its year is not printed in it; 2018 is approximate." },
  "luke-computational-music-synthesis": { by: "Sean Luke", year: 2023, kind: "book", topic: "Synthesis", about: "Lecture notes on building synthesizers in software: additive and subtractive synthesis, modulation, oscillators, filters, FM, sampling, effects, MIDI and the Fourier transform, with synth history.", added: "2026-11-21", note: "Free from the author under CC BY-ND 3.0 US: it may be copied but not changed. The author says he is not an expert and that it may hold errors. Contents, figure credits and index left out." },
  "witek-syncopation-groove": { by: "Witek, Clarke, Wallentin, Kringelbach, Vuust", year: 2014, kind: "paper", topic: "Rhythm and groove", about: "An online listening study of drum patterns: listeners rated wanting to move and pleasure highest for a medium amount of syncopation, lower for very little or a lot.", added: "2026-11-21", note: "It reports what listeners rated for the drum patterns tested, nothing broader. CC BY." },
  "butler-turning-the-beat-around": { by: "Mark J. Butler", year: 2001, kind: "paper", topic: "Rhythm and groove", about: "A music-theory article on analysing rhythm and metre in electronic dance music: layered metre, patterns that pull against it or leave it unclear, turning the beat around, and uneven groupings.", added: "2026-11-21", note: "It analyses named tracks. Pages 16 to 22 are its music examples. The journal allows saving and sharing for research, not republishing." },
  "dancecult-christodoulou-break-beat": { by: "Chris Christodoulou", year: 2020, kind: "paper", topic: "Rhythm and groove", about: "A cultural study of the breakbeat in drum and bass: what the sampled break has meant to the scene, and the arguments over rhythm and authenticity as the music changed.", added: "2026-11-21", note: "Cultural scholarship: an argued reading, not a measurement. CC BY-NC-SA 3.0." },
  "dancecult-christodoulou-rumble-jungle": { by: "Chris Christodoulou", year: 2011, kind: "paper", topic: "Rhythm and groove", about: "A cultural study of bass in jungle and drum and bass: bass as a source of intense pleasure on the dance floor, read alongside ideas about the modern city.", added: "2026-11-21", note: "Cultural theory, drawing on psychoanalysis: an argued reading, not a measurement. CC BY-NC-SA 3.0." },
  "dancecult-gilbert-hardcore-continuum": { by: "Jeremy Gilbert", year: 2009, kind: "paper", topic: "Rhythm and groove", about: "A report on a 2009 symposium that debated the hardcore continuum, a critic's idea that a line of British dance styles from hardcore onwards forms one tradition.", added: "2026-11-21", note: "A report of a debate among writers, by one of those who took part. CC BY-NC-SA 3.0." },
  "dancecult-alwakeel-idm": { by: "Ramzy Alwakeel", year: 2009, kind: "paper", topic: "Rhythm and groove", about: "A cultural study of the term intelligent dance music and the music filed under it: how it treats identity, tradition and musical form, with three case studies of a label and two artists.", added: "2026-11-21", note: "Cultural scholarship: an argued reading, not a measurement. CC BY-NC-SA 3.0." },
  "dancecult-solberg-bass-drop": { by: "Ragnhild Torvanger Solberg", year: 2014, kind: "paper", topic: "Rhythm and groove", about: "An analysis of build-ups and drops in two dance tracks, with spectrograms: the production techniques used, read through theories of musical expectation and strong emotional moments.", added: "2026-11-21", note: "It reads two tracks through theories; it did not measure listeners, so it does not show that a technique causes a feeling. CC BY-NC-SA 3.0." },
  "dancecult-ratcliffe-sample-typology": { by: "Robert Ratcliffe", year: 2014, kind: "paper", topic: "Rhythm and groove", about: "A proposed way of sorting the samples used in electronic dance music into types, by how they sound, what they refer to, how they were made and what the producer meant by them, with examples.", added: "2026-11-21", note: "One author's proposed categories, illustrated with named tracks. CC BY-NC-SA 3.0." },
  "dancecult-mouraviev-london-dubstep": { by: "Ivan Mouraviev", year: 2024, kind: "paper", topic: "Rhythm and groove", about: "A study of an online dubstep community and its weekly streamed DJ sets: how a scene built around sub-bass and sound systems takes shape when its meeting places move to the internet.", added: "2026-11-21", note: "A study of one online community. CC BY-NC-SA 3.0." },
  "dancecult-charles-psytrance-genre": { by: "Christopher David Charles", year: 2020, kind: "paper", topic: "Rhythm and groove", about: "A study of genre names in psytrance culture: how online tagging lets musicians describe their own music, and how the scene's many style terms are used in practice.", added: "2026-11-21", note: "A study of how people in one scene use genre names. CC BY-NC-SA 3.0." },
};

export interface Chapter { name: string; from: number; to: number; pages: number }
export interface SourceCard { id: string; title: string; pages: number; first: number; last: number; words: number; chapters: Chapter[]; pictures: number }
export interface SourceDoc { id: string; title: string; pages: { page: number; chapter: string; text: string }[] }

/** A book as its card: how long it is and what chapters it has. None of its words. */
export function summarise(doc: SourceDoc, pictures = 0): SourceCard {
  const chapters: Chapter[] = [];
  let words = 0;
  for (const p of doc.pages) {
    words += p.text.split(/\s+/).length;
    const last = chapters[chapters.length - 1], name = p.chapter || "";
    if (last && last.name === name) { last.to = p.page; last.pages++; } else chapters.push({ name, from: p.page, to: p.page, pages: 1 });
  }
  // a chapter that comes back later in a book (a manual's repeated section name) is one entry
  const joined: Chapter[] = [];
  for (const c of chapters) { const same = joined.find((x) => x.name === c.name); if (same) { same.to = Math.max(same.to, c.to); same.from = Math.min(same.from, c.from); same.pages += c.pages; } else joined.push({ ...c }); }
  // the bracketed authors and year at the end of a paper's title are shown separately, from SOURCES
  return { id: doc.id, title: doc.title.replace(/\s*\([^()]*(19|20)\d\d[^()]*\)\s*$/, ""), pages: doc.pages.length, first: doc.pages[0]?.page ?? 0, last: doc.pages[doc.pages.length - 1]?.page ?? 0, words, chapters: joined.filter((c) => c.name), pictures };
}

/** The longest excerpt of a page that a search may show. */
export const SNIPPET_MAX = 320;
/** A short excerpt of a page around the first of the asked-for words, cut at word ends. Never the whole page. */
export function snippet(text: string, query: string, max = SNIPPET_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim(), words = (query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const lower = flat.toLowerCase();
  let at = -1;
  for (const w of words) { const i = lower.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; }
  let from = Math.max(0, (at < 0 ? 0 : at) - Math.floor(max / 3)), to = Math.min(flat.length, from + max);
  if (from > 0) { const sp = flat.indexOf(" ", from); if (sp >= 0 && sp < from + 30) from = sp + 1; }
  if (to < flat.length) { const sp = flat.lastIndexOf(" ", to); if (sp > from + max / 2) to = sp; }
  return `${from > 0 ? "… " : ""}${flat.slice(from, to)}${to < flat.length ? " …" : ""}`;
}

export interface SourceHit { book: string; page: number; chapter: string; excerpt: string; pictures: number }
/** The most search results one request returns. */
export const HITS_MAX = 12;
