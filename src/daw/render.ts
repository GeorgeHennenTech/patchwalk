// The song as a sound file. A second transport plays the whole song into an offline context (no speakers), which
// the browser works out as fast as it can; the result is written as a WAV file.
import { stepSeconds } from "./drums";
import { samplesUsed, type Song } from "./song";
import { Transport } from "./transport";
import { encodeWav, peakDb } from "./wav";

export const RENDER_TAIL = 2.5, RENDER_RATE = 44100;
/** How long the file will be, in seconds: the song plus a tail for echoes and reverb. */
export const renderSeconds = (song: Song) => song.bars * 16 * stepSeconds(song.bpm) + 0.05 + RENDER_TAIL;
/** Render the song. `sound` gives the bytes of one of the learner's sound files by its id. */
export async function renderSong(song: Song, sound: (id: string) => ArrayBuffer | undefined): Promise<{ wav: Uint8Array<ArrayBuffer>; seconds: number; peak: number; missing: number }> {
  const seconds = renderSeconds(song), ctx = new OfflineAudioContext(2, Math.ceil(seconds * RENDER_RATE), RENDER_RATE), t = new Transport(() => song, ctx);
  let missing = 0;
  for (const id of samplesUsed(song)) { const bytes = sound(id); if (!bytes) { missing++; continue; } try { await t.load(id, bytes); } catch { missing++; } }
  const buf = await t.render(), left = buf.getChannelData(0), right = buf.getChannelData(1);
  t.dispose();
  return { wav: encodeWav(left, right, RENDER_RATE), seconds, peak: peakDb(left, right), missing };
}
