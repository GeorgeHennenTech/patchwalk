// An audio clip in the detail view: the sound file's shape with the part the clip plays lit, and its settings.
import { useState } from "react";
import { AUDIO_GAIN, AUDIO_TUNE, audioBars, audioRate, type AudioClip } from "../../daw/song";
import { beatsNear } from "../../daw/stretch";

const WARPS = [1, 2, 4, 8, 16, 32, 64];
export function AudioClipPanel({ clip, bpm, peaks, onChange, onFit }: { clip: AudioClip; bpm: number; /** the file's shape, as heights from 0 to 1 */ peaks: number[]; onChange: (change: Partial<Pick<AudioClip, "gain" | "tune" | "offset" | "beats">>) => void; /** make a copy of the file stretched to this many beats at the song's tempo, pitch kept, and use it */ onFit: (beats: number) => Promise<void> }) {
  const [busy, setBusy] = useState(false), [said, setSaid] = useState("");
  const rate = audioRate(clip, bpm), n = peaks.length || 1, from = (clip.offset / clip.seconds) * n, plays = Math.min(clip.seconds - clip.offset, clip.bars * (240 / bpm) * rate), to = ((clip.offset + plays) / clip.seconds) * n;
  const guess = beatsNear(clip.seconds, bpm), fileBars = audioBars(clip, bpm);
  return (
    <div className="aclip">
      <svg className="pad-wave aclip-wave" viewBox={`0 0 ${n} 40`} preserveAspectRatio="none" role="img" aria-label="The sound file's shape, with the part this clip plays lit">
        {peaks.map((p, i) => <rect key={i} x={i} y={20 - p * 19} width={0.8} height={Math.max(0.6, p * 38)} className={i >= from && i < to ? "in" : "out"} />)}
        <line x1={from} x2={from} y1={0} y2={40} className="edge" /><line x1={to} x2={to} y1={0} y2={40} className="edge" />
      </svg>
      <div className="aclip-set">
        <label title="Warp: say how many beats long the file is, and it is played at the speed that makes that true at the song's tempo, so it stays in time when the tempo changes. Its pitch moves with the speed (as a tape would). Off: played as recorded.">Warp
          <select value={clip.beats ?? 0} aria-label="Warp" onChange={(e) => onChange({ beats: Number(e.target.value) || undefined })}>
            <option value={0}>Off</option>{[...new Set([...WARPS, guess, ...(clip.beats ? [clip.beats] : [])])].sort((a, b) => a - b).map((b) => <option key={b} value={b}>{b} beat{b === 1 ? "" : "s"}{b === guess ? " (nearest)" : ""}</option>)}
          </select></label>
        <label title="Louder or quieter, in dB">Gain <input type="range" min={AUDIO_GAIN.min} max={AUDIO_GAIN.max} step={0.5} value={clip.gain} aria-label="Clip gain" onChange={(e) => onChange({ gain: Number(e.target.value) })} onDoubleClick={() => onChange({ gain: 0 })} /> <b>{clip.gain > 0 ? "+" : ""}{clip.gain} dB</b></label>
        <label title="Transpose in semitones. The file is played faster or slower, so its length changes too.">Transpose <input type="range" min={-AUDIO_TUNE} max={AUDIO_TUNE} step={1} value={clip.tune} aria-label="Clip transpose" onChange={(e) => onChange({ tune: Number(e.target.value) })} onDoubleClick={() => onChange({ tune: 0 })} /> <b>{clip.tune > 0 ? "+" : ""}{clip.tune} st</b></label>
        <label title="Where in the file the clip starts playing, in seconds">Start <input type="range" min={0} max={Math.max(0.01, clip.seconds - 0.01)} step={0.01} value={clip.offset} aria-label="Clip start in the file" onChange={(e) => onChange({ offset: Number(e.target.value) })} onDoubleClick={() => onChange({ offset: 0 })} /> <b>{clip.offset.toFixed(2)} s</b></label>
        <button disabled={busy} title="Make a copy of the file stretched to a whole number of beats at the song's tempo, with its pitch kept, and use that copy in this clip. It is made once, for this tempo." onClick={() => { setBusy(true); setSaid("Stretching…"); void onFit(clip.beats ?? guess).then(() => setSaid("Stretched to the song's tempo, pitch kept."), (e: unknown) => setSaid(e instanceof Error ? e.message : "That did not work.")).finally(() => setBusy(false)); }}>Stretch to tempo, keep pitch</button>
      </div>
      <p className="daw-hint">{clip.label}: {clip.seconds.toFixed(2)} s long, played at {rate.toFixed(3).replace(/\.?0+$/, "")} times its speed. From its start point it lasts {fileBars.toFixed(2)} bars at {bpm} bpm; the clip is {clip.bars} bar{clip.bars === 1 ? "" : "s"}. Drag the clip's right edge in the arrangement to show more or less of it. {said}</p>
    </div>
  );
}
