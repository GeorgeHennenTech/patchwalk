// Keeps src/patch/init-baseline.json in step with the Init fixture.
// Regenerate with: UPDATE_BASELINE=1 npx vitest run tests/baseline.test.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { decodePreset } from "../src/format";
import { toBaseline } from "../src/patch/diff";
import { collectModules } from "../src/patch/model";

const out = join(__dirname, "..", "src", "patch", "init-baseline.json");

it("init-baseline.json matches the Init fixture", () => {
  const init = decodePreset(new Uint8Array(readFileSync(join(__dirname, "..", "fixtures", "init", "Initial_Preset.SerumPreset"))));
  const baseline = toBaseline(collectModules(init.root));
  if (process.env.UPDATE_BASELINE) writeFileSync(out, JSON.stringify(baseline) + "\n");
  expect(JSON.parse(readFileSync(out, "utf8"))).toEqual(JSON.parse(JSON.stringify(baseline)));
});
