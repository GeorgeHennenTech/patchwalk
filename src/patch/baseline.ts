// Default values learned from the owner's Init preset (a table of numbers, not the preset file).
import data from "./init-baseline.json";
import type { Baseline } from "./diff";

export const INIT_BASELINE = data as unknown as Baseline;
