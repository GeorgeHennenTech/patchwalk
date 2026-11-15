// The "Physical models" tab: instruments that make sound by imitating how an object vibrates.
import { useState } from "react";
import BowLab from "./BowLab";
import DrumLab from "./DrumLab";
import StringLab from "./StringLab";
import TubeLab from "./TubeLab";

export default function ModelLabs() {
  const [view, setView] = useState<"string" | "bow" | "drum" | "tube">("string");
  return (
    <>
      <div className="seg driver-views" role="tablist" aria-label="Which model">
        <button role="tab" aria-selected={view === "string"} className={view === "string" ? "on" : ""} onClick={() => setView("string")}>Plucked string</button>
        <button role="tab" aria-selected={view === "bow"} className={view === "bow" ? "on" : ""} onClick={() => setView("bow")}>Bowed string</button>
        <button role="tab" aria-selected={view === "drum"} className={view === "drum" ? "on" : ""} onClick={() => setView("drum")}>Drum head</button>
        <button role="tab" aria-selected={view === "tube"} className={view === "tube" ? "on" : ""} onClick={() => setView("tube")}>Blown tube</button>
      </div>
      {view === "string" ? <StringLab /> : view === "bow" ? <BowLab /> : view === "drum" ? <DrumLab /> : <TubeLab />}
    </>
  );
}
