// A sampler: one sound file played across the keys. A key above the file's own note plays it faster and so
// higher, a key below slower and lower (there is no time-stretching: higher notes are also shorter).
// The first half of the file is plain rules, shared with tests; `playSample` is the audio.
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface SamplerSet {
  /** the stored sound file's id */ sample: string;
  /** the key that plays the file at its own pitch (MIDI number; 60 is middle C) */ root: number;
  /** "classic": the note lasts as long as the key is held, then fades over the release. "oneshot": the whole stretch plays however short the key press. */
  mode: "classic" | "oneshot";
  /** where in the file playing starts, and how much of it is used: percent of the file */ start: number; length: number;
  /** go round the used stretch again and again while the key is held (classic only) */ loop: boolean;
  /** fade in and fade out, in milliseconds */ attack: number; release: number;
  /** semitones up or down */ tune: number;
  /** 0 to 100 */ level: number;
}
export const newSampler = (sample: string): SamplerSet => ({ sample, root: 60, mode: "classic", start: 0, length: 100, loop: false, attack: 2, release: 80, tune: 0, level: 80 });
/** How much faster or slower the file is played for a key: double for an octave up, half for an octave down. */
export const samplerRate = (note: number, set: Pick<SamplerSet, "root" | "tune">) => 2 ** ((note - set.root + set.tune) / 12);
/** The stretch of the file that is used, in seconds from its start. */
export function samplerWindow(set: Pick<SamplerSet, "start" | "length">, fileSeconds: number): { offset: number; span: number } {
  const offset = (clamp(set.start, 0, 99) / 100) * fileSeconds;
  return { offset, span: Math.max(0.005, Math.min(fileSeconds - offset, (clamp(set.length, 1, 100) / 100) * fileSeconds)) };
}
/** How long a note sounds, in seconds, before its release: the held time, cut short when the stretch runs out first (unless it loops). */
export function samplerSounds(set: SamplerSet, note: number, held: number, fileSeconds: number): number {
  const own = samplerWindow(set, fileSeconds).span / samplerRate(note, set);
  if (set.mode === "oneshot") return own;
  return set.loop ? held : Math.min(held, own);
}
/** Settings read back from storage, made safe; nothing when there is no sound file named. */
export function tidySampler(raw: unknown): SamplerSet | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<SamplerSet>, num = (v: unknown, d: number, lo: number, hi: number) => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? clamp(Number(v), lo, hi) : d);
  if (typeof r.sample !== "string" || !/^[\w-]{1,80}$/.test(r.sample)) return undefined;
  return { sample: r.sample, root: Math.round(num(r.root, 60, 0, 127)), mode: r.mode === "oneshot" ? "oneshot" : "classic", start: num(r.start, 0, 0, 99), length: num(r.length, 100, 1, 100), loop: r.loop === true,
    attack: num(r.attack, 2, 0, 2000), release: num(r.release, 80, 1, 5000), tune: Math.round(num(r.tune, 0, -24, 24)), level: num(r.level, 80, 0, 100) };
}

// ---- the audio ----
export interface SampleVoice { /** let go of the key at this time: the release starts */ release(at: number): void }
/**
 * Play one note. `seconds` is how long the key is held; leave it out for a key that is still down (then call
 * `release`). Gives back nothing when the level is zero.
 */
export function playSample(ctx: BaseAudioContext, buffer: AudioBuffer, set: SamplerSet, note: number, at: number, velocity: number, to: AudioNode, seconds?: number): SampleVoice | undefined {
  const peak = (clamp(set.level, 0, 100) / 100) * (clamp(velocity, 1, 127) / 127) ** 1.5;
  if (peak <= 0) return undefined;
  const rate = samplerRate(note, set), { offset, span } = samplerWindow(set, buffer.duration), src = ctx.createBufferSource(), gain = ctx.createGain();
  src.buffer = buffer; src.playbackRate.value = rate;
  const looping = set.loop && set.mode === "classic";
  if (looping) { src.loop = true; src.loopStart = offset; src.loopEnd = offset + span; }
  src.connect(gain); gain.connect(to);
  const t = Math.max(at, ctx.currentTime), att = Math.max(0.001, set.attack / 1000), rel = Math.max(0.004, set.release / 1000), own = span / rate;
  gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(peak, t + att);
  if (looping) src.start(t, offset); else src.start(t, offset, span);
  let done = false;
  const release = (when: number) => {
    if (done) return; done = true;
    const r = Math.max(when, t + att);
    gain.gain.cancelScheduledValues(r); gain.gain.setValueAtTime(peak, r); gain.gain.linearRampToValueAtTime(0, r + rel);
    try { src.stop(r + rel + 0.02); } catch { /* already stopped */ }
  };
  if (set.mode === "oneshot") { const end = t + own; gain.gain.setValueAtTime(peak, Math.max(t + att, end - 0.004)); gain.gain.linearRampToValueAtTime(0, end); done = true; }
  else if (seconds !== undefined) release(t + samplerSounds(set, note, seconds, buffer.duration));
  else if (!looping) { const end = t + own; if (end - 0.004 > t + att) { gain.gain.setValueAtTime(peak, end - 0.004); gain.gain.linearRampToValueAtTime(0, end); } }
  src.onended = () => { try { gain.disconnect(); } catch { /* gone */ } };
  return { release };
}
