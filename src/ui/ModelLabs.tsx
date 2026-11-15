// The "Physical models" tab: instruments that make sound by imitating how an object vibrates.
import { useState } from "react";
import DrumLab from "./DrumLab";
import StringLab from "./StringLab";

export default function ModelLabs() {
  const [view, setView] = useState<"string" | "drum">("string");
  return (
    <>
      <div className="seg driver-views" role="tablist" aria-label="Which model">
        <button role="tab" aria-selected={view === "string"} className={view === "string" ? "on" : ""} onClick={() => setView("string")}>Plucked string</button>
        <button role="tab" aria-selected={view === "drum"} className={view === "drum" ? "on" : ""} onClick={() => setView("drum")}>Drum head</button>
      </div>
      {view === "string" ? <StringLab /> : <DrumLab />}
    </>
  );
}
