// A synth track's sound: the practice synth, playing on this track. The track owns the synth and its
// settings; this panel edits them, and the keys play it live.
import { useState } from "react";
import type { Engine } from "../../synth/engine";
import type { SynthState } from "../../synth/params";
import { useSynth } from "../../synth/useSynth";
import { SOUNDS, soundPatch } from "../../daw/song";
import type { PlayableLesson } from "../../course/types";
import { SynthPanel } from "../PlayView";
import { PatchBar } from "../synth/Patches";
import type { Panel } from "../../course/types";

const FREE = { id: "studio", title: "Studio", buildsOn: [], minutes: 0, outcome: "", idea: [], cardIds: [], steps: [], recap: [] } as unknown as PlayableLesson;

export function TrackSynth({ engine, patch, bpm, onPatch, onNote, keysOff, show }: { engine: Engine; patch: SynthState; bpm: number; onPatch: (s: SynthState) => void; onNote?: (note: number, on: boolean, velocity: number) => void; keysOff?: () => boolean; /** draw the synth (the Device view); when false only the keys are live */ show: boolean }) {
  const synth = useSynth({ engine, initial: patch, onChange: onPatch, onNote, keysOff });
  const open = true;
  const [views, setViews] = useState<Panel[]>([]);
  const [plain, setPlain] = useState(false);
  if (!show) return null; // the hook above stays alive, so the keys still play this track
  return (
    <div className="track-synth">
      <div className="track-synth-bar">
        <span>Start from a sound:</span>
        {SOUNDS.map((s) => <button key={s.name} onClick={() => synth.reset({ ...soundPatch(s.name), bpm })}>{s.name}</button>)}
        {!synth.running && <button onClick={() => void synth.start()}>Switch the keys on</button>}
      </div>
      {open && <>
        <SynthPanel synth={synth} show={[]} lesson={FREE} all extra={views} onExtra={(p) => setViews((v) => (v.includes(p) ? v.filter((x) => x !== p) : [...v, p]))} plain={plain} onSkin={() => setPlain(!plain)} />
        <PatchBar synth={synth} />
      </>}
      <p className="muted daw-sound-small">Tempo is set by the song, not by the synth's own tempo knob.</p>
    </div>
  );
}
