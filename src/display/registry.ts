// Raw stored value -> what to show. RULE 7: nothing here is "verified" until the owner has
// confirmed it against Serum 2's screen and `confirmedBy` names the probe fixture that proves it.
import type { ParamValue } from "../patch/model";
import { generic, humanize, onOff, pct, plain, signed, time, withUnit, type Display } from "./format";

export type Stage = "core" | "thickness" | "character" | "filter" | "contour" | "motion" | "space" | "performance";

/**
 * verified   — conversion confirmed on screen by the owner (needs confirmedBy)
 * documented — the name or meaning is taken from the Serum 2 User Guide (public source, rule 2); the owner has
 *              not yet checked it on screen, and the link from the stored token to the name is by spelling
 * unverified — a conversion is applied, based on evidence in `basis`, but nobody has checked it
 * raw        — no conversion known; the stored number is shown as-is
 */
export type DisplayStatus = "verified" | "documented" | "unverified" | "raw";

export interface ParamSpec {
  label: string;
  /** One-concept grouping used by the beginner rendering. */
  concept: string;
  stage?: Stage;
  status: DisplayStatus;
  /** Why this conversion is believed, or what is unknown. */
  basis: string;
  /** Probe fixture path proving the conversion. Required for status "verified". */
  confirmedBy?: string;
  format: (raw: ParamValue) => Display;
  /** Where the Serum 2 User Guide describes this control (section and page). */
  manual?: string;
  /** Label that depends on other settings of the same module (e.g. the filter's Var knob). */
  labelFor?: (params: Record<string, ParamValue>) => string | undefined;
}

const n = (v: ParamValue) => (typeof v === "number" ? v : Number(v));
const raw = (label: string, concept: string, basis: string, decimals = 3, stage?: Stage): ParamSpec => ({
  label, concept, stage, status: "raw", basis, format: (v) => (typeof v === "number" ? plain(v, decimals) : generic(v)),
});
const guess = (label: string, concept: string, basis: string, format: (v: ParamValue) => Display, stage?: Stage): ParamSpec => ({
  label, concept, stage, status: "unverified", basis, format,
});
const toggle = (label: string, concept: string, stage?: Stage): ParamSpec =>
  guess(label, concept, "Stored as 0/1; assumed to be an on/off switch.", onOff, stage);

/**
 * Filter types named in the Serum 2 User Guide ("Using the Filter Modules", pp. 135-139), keyed by the token
 * stored in presets. `varName` is what the guide calls the Var knob for that type. Only tokens seen in
 * fixtures are listed; the token-to-name link is by spelling.
 */
export const FILTER_TYPES: Record<string, { name: string; varName?: string }> = {
  MgL6: { name: "MG Low 6", varName: "FAT" },
  MgL12: { name: "MG Low 12", varName: "FAT" },
  MgL18: { name: "MG Low 18", varName: "FAT" },
  MgL24: { name: "MG Low 24", varName: "FAT" },
  LadderAcid: { name: "Acid Ladder", varName: "SMOOTH" },
};
/** The guide states that Init's filter type is MG Low 6 (p. 139), which is what applies when none is stored. */
export const DEFAULT_FILTER_TYPE = "MgL6";

/** "MgL24" -> "MG Low 24" from the guide; unknown tokens are shown re-spaced and stay unverified. */
export function filterTypeName(token: string): Display {
  const known = FILTER_TYPES[token];
  return known ? { text: known.name, status: "documented" } : { text: humanize(token) };
}

/** Warp modes named in the guide ("Warp", pp. 49-56), keyed by stored token. Only tokens seen in fixtures. */
export const WARP_MODES: Record<string, string> = {
  kBendPos: "Bend +",
  kFilterHPF: "HPF (Filter)",
  kPD_OSC: "PD (from other oscillator)",
};
const warpMode = (label: string, concept: string): ParamSpec => ({
  label, concept, stage: "character", status: "unverified", manual: "Warp, pp. 49-56",
  basis: "Stored as an internal token. Tokens that match a warp mode in the Serum 2 User Guide by spelling are shown with the guide's name; others are shown re-spaced.",
  format: (v) => (WARP_MODES[String(v)] ? { text: WARP_MODES[String(v)]!, status: "documented" } : { text: humanize(String(v)) }),
});

/** LFO types and modes named in the guide ("Modifying LFOs", pp. 190-193). */
const LFO_TYPES: Record<string, string> = { Lorenz: "Chaos: Lorenz", Rossler: "Chaos: Rossler", RandomSH: "S&H", Normal: "Normal", Path: "Path" };
const LFO_MODES: Record<string, string> = { free: "FREE", retrig: "RETRIG", envelope: "ENVELOPE" };

const menu = (label: string, concept: string, stage?: Stage): ParamSpec =>
  guess(label, concept, "Menu choice stored as an internal token; shown re-spaced, on-screen name not confirmed.", (v) => ({ text: humanize(String(v)) }), stage);

const ENV: Record<string, ParamSpec> = {
  kParamAttack: guess("Attack (ATK)", "attack", "Stored 0.000515 and 0.0147 in a Serum-1-compatible preset match the classic 0.5 ms attack / 15 ms release defaults, so the unit is taken to be seconds.", (v) => time(n(v))),
  kParamDecay: guess("Decay (DEC)", "decay", "Assumed seconds, like Attack.", (v) => time(n(v))),
  kParamRelease: guess("Release (REL)", "release", "Assumed seconds, like Attack.", (v) => time(n(v))),
  kParamHold: guess("Hold (HOLD)", "hold", "Assumed seconds, like Attack.", (v) => time(n(v))),
  kParamSustain: raw("Sustain (SUS)", "sustain", "Stored 0..1. Whether the screen shows %, dB or something else is unknown."),
  kParamCurve1: raw("Attack curve", "curves", "Stored 0..100 (Init: 50). On-screen reading unknown.", 1),
  kParamCurve2: raw("Decay curve", "curves", "Stored 0..100 (Init: 66.6). On-screen reading unknown.", 1),
  kParamCurve3: raw("Release curve", "curves", "Stored 0..100 (Init: 66.6). On-screen reading unknown.", 1),
};

export const REGISTRY: Record<string, Record<string, ParamSpec>> = {
  Oscillator: {
    kParamEnable: toggle("Power", "enable"),
    kParamVolume: guess("Level", "level", "Stored 0.5625 = 0.75 squared, which suggests level% = sqrt(stored) x 100. One data point.", (v) => pct(Math.sqrt(Math.max(0, n(v))) * 100, 1)),
    kParamOctave: { ...guess("Octave (OCT)", "pitch", "The guide names the control OCT (octave). The stored whole number is assumed to be that reading.", (v) => signed(n(v), 0, "oct")), manual: "Pitch controls, p. 40" },
    kParamPitch: { ...guess("Semitones (SEM)", "pitch", "The guide names the control SEM (semitone). Stored 7 in a preset with a fifth; assumed semitones.", (v) => signed(n(v), 0, "st")), manual: "Pitch controls, p. 40" },
    kParamFine: { ...guess("Fine (FIN)", "pitch", "The guide names the control FIN (fine tuning in cents). Stored +/-40 on a detuned two-oscillator bass.", (v) => signed(n(v), 0, "cents")), manual: "Pitch controls, p. 40" },
    kParamUnison: guess("Unison voices", "unison", "Stored as a whole number; assumed voice count.", (v) => withUnit(n(v), 0, ""), "thickness"),
    kParamDetune: raw("Unison detune", "unison", "Stored number; on-screen scale unknown.", 3, "thickness"),
    kParamUnisonStereo: raw("Unison stereo", "unison", "Stored number; on-screen scale unknown.", 3, "thickness"),
    kParamUnisonBlend: raw("Unison blend", "unison", "Stored number; on-screen scale unknown.", 3, "thickness"),
    kParamPan: raw("Pan", "pan", "Stored number; on-screen scale unknown."),
  },
  WTOsc: {
    kParamTablePos: raw("Wavetable position", "wavetable", "Stored number; whether the screen shows a frame number or a percentage is unknown.", 1),
    kParamWarpMenu: warpMode("Warp mode", "warp"),
    kParamWarp: raw("Warp amount", "warp", "Stored number; on-screen scale unknown.", 3, "character"),
    kParamWarpMenu2: warpMode("Warp 2 mode", "warp2"),
    kParamWarp2: raw("Warp 2 amount", "warp2", "Stored number; on-screen scale unknown.", 3, "character"),
    kParamRandomPhase: raw("Random phase", "phase", "Stored number; on-screen scale unknown.", 1),
    kParamInitialPhase: raw("Phase", "phase", "Stored number; on-screen scale unknown.", 1),
  },
  NoiseOsc: {
    kParamNoiseType: menu("Noise type", "noise"),
    kParamColor: raw("Noise colour", "noise", "Stored number; on-screen scale unknown."),
    kParamInitialPhase: raw("Phase", "phase", "Stored number; on-screen scale unknown.", 1),
  },
  VoiceFilter: {
    kParamEnable: toggle("Power", "enable"),
    kParamType: { ...guess("Filter type", "type", "Tokens that match a filter type in the Serum 2 User Guide by spelling are shown with the guide's name; others are shown re-spaced.", (v) => filterTypeName(String(v))), manual: "Filter types, pp. 135-139" },
    kParamFreq: raw("Cutoff", "cutoff", "Stored 0..1 (normalised). The Hz mapping is unknown."),
    kParamReso: guess("Resonance", "resonance", "Stored 0..100; assumed to be the percentage shown.", (v) => pct(n(v), 0)),
    kParamDrive: guess("Drive", "drive", "Stored 0..100; assumed to be the percentage shown.", (v) => pct(n(v), 0)),
    kParamVar: {
      ...guess("Var", "var", "Stored 0..100; assumed to be the percentage shown. The guide gives this knob a different name and job for each filter type.", (v) => pct(n(v), 0)),
      manual: "Var parameter functions, pp. 135-139",
      labelFor: (params) => {
        const type = FILTER_TYPES[String(params.kParamType ?? DEFAULT_FILTER_TYPE)];
        return type?.varName ? `Var (${type.varName})` : undefined;
      },
    },
    kParamMix: guess("Mix", "mix", "Stored 0..100; assumed to be the percentage shown.", (v) => pct(n(v), 0)),
  },
  Env: ENV,
  LFO: {
    kParamRate: raw("Rate", "rate", "Stored number. Likely Hz when free-running and a division index when synced; unconfirmed.", 2),
    kParamBeatSync: toggle("Tempo sync (BPM)", "rate"),
    kParamMode: { ...guess("Mode", "mode", "The guide lists the LFO modes FREE, RETRIG and ENVELOPE. A stored token matching one by spelling is shown with that name.", (v) => (LFO_MODES[String(v).toLowerCase()] ? { text: LFO_MODES[String(v).toLowerCase()]!, status: "documented" } : { text: humanize(String(v)) })), manual: "Modifying LFOs, p. 191" },
    kParamType: { ...guess("LFO type", "shape", "The guide lists the LFO types Normal, Path, Chaos: Lorenz, Chaos: Rossler and S&H. A stored token matching one by spelling is shown with that name.", (v) => (LFO_TYPES[String(v)] ? { text: LFO_TYPES[String(v)]!, status: "documented" } : { text: humanize(String(v)) })), manual: "Modifying LFOs, p. 191" },
    kParamRise: raw("Rise", "rise", "Stored number; unit unknown.", 2),
    kParamDelay: raw("Delay", "rise", "Stored number; unit unknown.", 2),
    kParamSmooth: guess("Smooth", "smooth", "Stored 0..100; assumed to be the percentage shown.", (v) => pct(n(v), 0)),
    kParamMono: { ...toggle("Mono", "mode"), status: "documented", basis: "The guide: with MONO enabled the same modulation is applied to all voices; otherwise each voice has its own.", manual: "Modifying LFOs, p. 191" },
    kParamDotted: toggle("Dotted", "rate"),
    kParamTriplets: toggle("Triplets", "rate"),
    kParamRate10x: toggle("Rate x10", "rate"),
    kParamDefaultMode: raw("Default mode flag", "mode", "Appears on most edited LFOs; meaning unknown.", 0),
  },
  Macro: {
    kParamValue: guess("Value", "macro", "Stored 0..100; assumed to be the percentage shown.", (v) => pct(n(v), 0)),
  },
  ModSlot: {
    kParamAmount: guess("Amount", "amount", "Stored -100..100; assumed to be the percentage shown.", (v) => pct(n(v), 0)),
    kParamBipolar: toggle("Bipolar", "amount"),
    kParamOut: raw("Output", "amount", "Stored number; meaning unknown.", 2),
  },
  Global: {
    kParamMasterVolume: raw("Master volume", "volume", "Stored 0..1; on-screen scale unknown."),
    kParamTranspose: { ...guess("Transpose", "pitch", "The guide: TRANSPOSE is the number of semitones to transpose incoming notes.", (v) => signed(n(v), 0, "st")), status: "documented", manual: "Global settings" },
    kParamMonoToggle: toggle("Mono", "voicing"),
    kParamLegato: toggle("Legato", "voicing"),
    kParamPortamentoTime: guess("Portamento time", "glide", "Assumed seconds, like envelope times.", (v) => time(n(v))),
    kParamPortaAlways: toggle("Portamento always", "glide"),
    kParamBendRangeUp: guess("Pitch bend up", "bend", "Stored as a whole number; assumed semitones.", (v) => signed(n(v), 0, "st")),
    kParamBendRangeDn: guess("Pitch bend down", "bend", "Stored as a whole number; assumed semitones.", (v) => signed(n(v), 0, "st")),
    kParamModWheel: raw("Mod wheel position", "wheel", "Saved controller position (0..127 scale suspected). Not a sound-design setting.", 1),
    kParamLimitSameNotePolyphony: toggle("Limit same-note polyphony", "voicing"),
    kParamS1Compatibility: toggle("Serum 1 compatibility", "compat"),
    kParamMasterTuning: raw("Master tuning", "pitch", "Stored number; unit unknown."),
  },
  RoutingSlot: {
    kParamRoutingDest: menu("Routing destination", "routing"),
  },
};

const FX_COMMON: Record<string, ParamSpec> = {
  kParamWet: guess("Mix (wet)", "mix", "Stored 0..100; assumed to be the percentage shown.", (v) => pct(n(v), 0)),
};

export interface Resolved {
  label: string;
  concept: string;
  stage?: Stage;
  status: DisplayStatus;
  basis: string;
  /** False when there is no registry entry: the name is just the stored key, re-spaced. */
  known: boolean;
  display: Display;
}

export function specFor(moduleType: string, param: string): ParamSpec | undefined {
  return REGISTRY[moduleType]?.[param] ?? (moduleType.startsWith("FX") ? FX_COMMON[param] : undefined);
}

export function resolveParam(moduleType: string, param: string, value: ParamValue, params?: Record<string, ParamValue>): Resolved {
  const spec = specFor(moduleType, param);
  if (spec) {
    const display = spec.format(value);
    return {
      label: (params && spec.labelFor?.(params)) || spec.label, concept: spec.concept, stage: spec.stage,
      status: display.status ?? spec.status, basis: spec.basis, known: true, display,
    };
  }
  return {
    label: humanize(param),
    concept: param,
    status: "raw",
    basis: "No entry for this parameter yet. Name and value are shown exactly as stored.",
    known: false,
    display: generic(value),
  };
}

/** Every registry entry, flattened, for the table view and for tests. */
export function allSpecs(): { moduleType: string; param: string; spec: ParamSpec }[] {
  const out: { moduleType: string; param: string; spec: ParamSpec }[] = [];
  for (const [moduleType, params] of Object.entries({ ...REGISTRY, "FX*": FX_COMMON })) {
    for (const [param, spec] of Object.entries(params)) out.push({ moduleType, param, spec });
  }
  return out;
}
