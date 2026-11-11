import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { decodePreset, type DecodedPreset } from "../src/format";
import { analyze } from "../src/flow/build";
import { INIT_BASELINE } from "../src/patch/baseline";

export const FIXTURES = join(__dirname, "..", "fixtures");
export const INIT = join(FIXTURES, "init", "Initial_Preset.SerumPreset");
/** Commercial pack presets live in gitignored fixtures/local; tests that need them skip when absent. */
export const PACK = {
  hype: join(FIXTURES, "local", "patches", "TSP_S2PNJ_Lead_70s_hype.SerumPreset"),
  reese: join(FIXTURES, "local", "patches", "TSP_S2UR_bass_reese_wailer.SerumPreset"),
  gfunk: join(FIXTURES, "local", "patches", "TSP_S2PNJ_Lead_g_funk.SerumPreset"),
  rando: join(FIXTURES, "local", "patches", "TSP_S290V2_Bass_rando.SerumPreset"),
};
export const has = (p: string) => existsSync(p);
export const decodeFile = (p: string) => decodePreset(new Uint8Array(readFileSync(p)));
export const analyzeFile = (p: string) => analyze(decodeFile(p), INIT_BASELINE);

/** Init with edits applied to its decoded data: a synthetic "one change from Init" probe. */
export function probe(edit: (root: Record<string, any>) => void): DecodedPreset {
  const init = decodeFile(INIT);
  const root = structuredClone(init.root) as Record<string, any>;
  edit(root);
  return { ...init, root };
}
