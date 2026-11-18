// Patterns kept in this browser: the one being worked on, and the ones saved under a name.
import { tidyPattern, type Pattern } from "./drums";

const WORK = "patchwalk.pattern.v1", SAVED = "patchwalk.patterns.v1", MOST = 40;
const read = (key: string): unknown => { try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; } };
const write = (key: string, value: unknown): void => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage is full or switched off: the pattern still plays */ } };

export const loadWork = (): Pattern | undefined => tidyPattern(read(WORK));
export const saveWork = (p: Pattern): void => write(WORK, p);
export function loadSaved(): Pattern[] {
  const raw = read(SAVED);
  return Array.isArray(raw) ? raw.map(tidyPattern).filter((p): p is Pattern => !!p) : [];
}
/** Add a pattern to a list of saved ones: the same name replaces the old one, newest first. */
export function withSaved(list: Pattern[], p: Pattern): Pattern[] {
  const name = p.name.trim() || "Pattern";
  return [{ ...p, name }, ...list.filter((x) => x.name !== name)].slice(0, MOST);
}
export const withoutSaved = (list: Pattern[], name: string): Pattern[] => list.filter((x) => x.name !== name);
export const storeSaved = (list: Pattern[]): void => write(SAVED, list);

// Songs: the one being worked on, and the ones saved under a name.
import { tidySong, type Song } from "./song";
const SONG = "patchwalk.song.v1", SONGS = "patchwalk.songs.v1", MOST_SONGS = 20;
export const loadSong = (): Song | undefined => tidySong(read(SONG));
export const saveSong = (s: Song): void => write(SONG, s);
export function loadSongs(): Song[] {
  const raw = read(SONGS);
  return Array.isArray(raw) ? raw.map(tidySong).filter((s): s is Song => !!s) : [];
}
export function withSavedSong(list: Song[], s: Song): Song[] {
  const name = s.name.trim() || "Song";
  return [{ ...s, name }, ...list.filter((x) => x.name !== name)].slice(0, MOST_SONGS);
}
export const withoutSavedSong = (list: Song[], name: string): Song[] => list.filter((x) => x.name !== name);
export const storeSongs = (list: Song[]): void => write(SONGS, list);

// Saved breaks (a drum clip's rows, with the pad names they were written for) and saved racks (the pads).
import { tidyPads, tidySteps, type Hit, type Pad } from "./drums";
export interface Break { name: string; /** 1 to 4 */ bars: number; bpm: number; swing: number; /** one row per pad, in pad order */ rows: Hit[][]; /** the pads' names when it was saved */ pads: string[] }
export interface Rack { name: string; pads: Pad[] }
const BREAKS = "patchwalk.breaks.v1", RACKS = "patchwalk.racks.v1", MOST_KEPT = 60;
export function tidyBreak(raw: unknown): Break | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<Break>, bars = Math.min(4, Math.max(1, Math.round(Number(r.bars) || 1)));
  if (!Array.isArray(r.rows) || !r.rows.length) return undefined;
  return { name: typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 40) : "Break", bars, bpm: Math.min(200, Math.max(60, Math.round(Number(r.bpm) || 120))), swing: Math.min(75, Math.max(0, Math.round(Number(r.swing) || 0))),
    rows: r.rows.slice(0, 16).map((row) => tidySteps(row, bars * 16)), pads: (Array.isArray(r.pads) ? r.pads : []).slice(0, 16).map((p) => String(p).slice(0, 24)) };
}
export function tidyRack(raw: unknown): Rack | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<Rack>, pads = tidyPads(r.pads);
  return pads.length ? { name: typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 40) : "Rack", pads } : undefined;
}
const list = <T>(key: string, tidy: (raw: unknown) => T | undefined): T[] => { const raw = read(key); return Array.isArray(raw) ? raw.map(tidy).filter((x): x is T => !!x) : []; };
/** Add to a list of named things: the same name replaces the old one, newest first. */
export const withNamed = <T extends { name: string }>(all: T[], item: T): T[] => [item, ...all.filter((x) => x.name !== item.name)].slice(0, MOST_KEPT);
export const loadBreaks = (): Break[] => list(BREAKS, tidyBreak);
export const storeBreaks = (all: Break[]): void => write(BREAKS, all);
export const loadRacks = (): Rack[] => list(RACKS, tidyRack);
export const storeRacks = (all: Rack[]): void => write(RACKS, all);
/** A saved rack put onto a track: its pads take the ids of the pads they replace, in order, so the track's clips keep their rows. */
export function rackOnto(now: Pad[], rack: Rack): Pad[] {
  const taken = now.map((p) => p.id);
  return rack.pads.map((p, i) => { const id = now[i]?.id ?? (() => { let n = 1; while (taken.includes(`pad${n}`)) n++; taken.push(`pad${n}`); return `pad${n}`; })(); return { ...p, id }; });
}
