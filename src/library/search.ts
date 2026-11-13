// Keyword retrieval (BM25) over the private library. Runs on the server only: the library's text is never
// part of the browser bundle. Files here use ".js" import suffixes so they load as plain Node ESM.

export interface Passage {
  /** Stable id, e.g. "serum-2-user-guide#136" or "card:unison-detune". */
  id: string;
  /** Human title of the source document. */
  source: string;
  /** Page number within the source, when it has pages. */
  page?: number;
  /** Chapter or card title. */
  section: string;
  text: string;
  /** Pictures that belong to this passage (a manual page's screenshots). Shown whenever the passage is cited. */
  images?: PassageImage[];
}
export interface PassageImage { book: string; file: string; width: number; height: number }

const STOP = new Set("a an and are as at be by can do does for from how i in is it of on or the this to what when where which why with you your my me".split(" "));

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+(?:[+\-/][a-z0-9]+)*/g) ?? [])
    .flatMap((t) => (/[+\-/]/.test(t) ? [t, ...t.split(/[+\-/]/)] : [t]))
    .filter((t) => !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export interface Index {
  passages: Passage[];
  /** term -> list of [passage index, term frequency] */
  postings: Map<string, [number, number][]>;
  lengths: number[];
  avgLength: number;
}

export function buildIndex(passages: Passage[]): Index {
  const postings = new Map<string, [number, number][]>();
  const lengths: number[] = [];
  passages.forEach((p, i) => {
    // The section title is counted twice so a page in the right chapter outranks a passing mention.
    const terms = tokenize(`${p.section} ${p.section} ${p.text}`);
    lengths.push(terms.length);
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, n] of tf) {
      const list = postings.get(t);
      if (list) list.push([i, n]);
      else postings.set(t, [[i, n]]);
    }
  });
  return { passages, postings, lengths, avgLength: lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length) };
}

export interface Hit {
  passage: Passage;
  score: number;
}

const K1 = 1.4, B = 0.75;

export function search(index: Index, query: string, limit = 6): Hit[] {
  const scores = new Map<number, number>();
  const N = index.passages.length;
  for (const term of new Set(tokenize(query))) {
    const list = index.postings.get(term);
    if (!list) continue;
    const idf = Math.log(1 + (N - list.length + 0.5) / (list.length + 0.5));
    for (const [i, tf] of list) {
      const norm = tf + K1 * (1 - B + (B * index.lengths[i]!) / index.avgLength);
      scores.set(i, (scores.get(i) ?? 0) + idf * ((tf * (K1 + 1)) / norm));
    }
  }
  return [...scores].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([i, score]) => ({ passage: index.passages[i]!, score }));
}
