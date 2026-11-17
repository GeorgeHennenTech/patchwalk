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
