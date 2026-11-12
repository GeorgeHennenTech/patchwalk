// Diagram data computed from the patch's own stored values. Drawn by code, never by the narrator.
import { resolveParam } from "../display/registry";
import { labelFor } from "../patch/labels";
import type { ModuleNode } from "../patch/model";
import type { Step } from "./facts";

export interface EnvelopeDiagram {
  kind: "envelope";
  title: string;
  /** Polyline points in a 0..width by 0..height box (y grows downward). */
  width: number;
  height: number;
  segments: { name: "A" | "H" | "D" | "S" | "R"; from: [number, number]; to: [number, number]; label: string; isDefault: boolean }[];
  caption: string;
}

export interface ShapeDiagram {
  kind: "shape";
  title: string;
  width: number;
  height: number;
  points: [number, number][];
  caption: string;
}

export type Diagram = EnvelopeDiagram | ShapeDiagram;

const H = 80;
const DEFAULT_W = 40;
/** Log-ish width so 0.5 ms and 6 s both stay visible. Not to scale. */
const timeWidth = (seconds: number) => 16 + 18 * Math.log10(1 + Math.max(0, seconds) * 1000);

function envelope(node: ModuleNode): EnvelopeDiagram {
  const p = node.params;
  const t = (key: string) => (typeof p[key] === "number" ? (p[key] as number) : undefined);
  const text = (key: string) => (p[key] === undefined ? "default" : resolveParam("Env", key, p[key]!).display.text);
  const attack = t("kParamAttack"), hold = t("kParamHold"), decay = t("kParamDecay"), release = t("kParamRelease");
  const sustain = t("kParamSustain");
  const level = sustain === undefined ? 1 : Math.min(1, Math.max(0, sustain));
  const yS = H * (1 - level);

  const segments: EnvelopeDiagram["segments"] = [];
  let x = 0;
  const add = (name: EnvelopeDiagram["segments"][number]["name"], w: number, y0: number, y1: number, label: string, isDefault: boolean) => {
    segments.push({ name, from: [x, y0], to: [x + w, y1], label, isDefault });
    x += w;
  };
  add("A", attack === undefined ? DEFAULT_W : timeWidth(attack), H, 0, `A ${text("kParamAttack")}`, attack === undefined);
  if (hold !== undefined) add("H", timeWidth(hold), 0, 0, `H ${text("kParamHold")}`, false);
  add("D", decay === undefined ? DEFAULT_W : timeWidth(decay), 0, yS, `D ${text("kParamDecay")}`, decay === undefined);
  add("S", 50, yS, yS, `S ${text("kParamSustain")}`, sustain === undefined);
  add("R", release === undefined ? DEFAULT_W : timeWidth(release), yS, H, `R ${text("kParamRelease")}`, release === undefined);

  return {
    kind: "envelope", title: `${labelFor("Env", node.index)} shape`, width: x, height: H, segments,
    caption: "Not to scale. Dashed parts are at the factory default, whose value is not stored in the file (sustain is drawn at full for those). Curve bends are not drawn; times and sustain use unverified readings.",
  };
}

function shape(node: ModuleNode): ShapeDiagram | undefined {
  const cd = node.extras.curveData as { xVals?: unknown; yVals?: unknown } | undefined;
  const xs = cd?.xVals, ys = cd?.yVals;
  if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length < 2 || xs.length !== ys.length) return undefined;
  if (![...xs, ...ys].every((v) => typeof v === "number")) return undefined;
  const W = 220;
  return {
    kind: "shape", title: `${labelFor("LFO", node.index)} drawn shape`, width: W, height: H,
    points: xs.map((x, i) => [Math.round((x as number) * W * 100) / 100, Math.round((ys[i] as number) * H * 100) / 100]),
    caption: "The stored points joined by straight lines; curvature between points is not drawn. Which way is up is assumed from the stored values and not confirmed.",
  };
}

/** Diagrams for a step: one per envelope or drawn LFO shape the step sets up. */
export function diagramsFor(step: Step, modules: Map<string, ModuleNode>): Diagram[] {
  const out: Diagram[] = [];
  for (const id of step.moduleIds) {
    const node = modules.get(id);
    if (!node) continue;
    if (node.type === "Env" && Object.keys(node.params).some((k) => /Attack|Hold|Decay|Sustain|Release/.test(k))) out.push(envelope(node));
    if (node.type === "LFO") {
      const s = shape(node);
      if (s) out.push(s);
    }
  }
  return out;
}
