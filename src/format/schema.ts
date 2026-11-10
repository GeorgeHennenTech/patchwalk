import { z } from "zod";

/** `version` has been reported as a bare number and as `{ value: n }`. Normalise to a number. */
export const VersionSchema = z
  .union([z.number(), z.object({ value: z.number() })])
  .transform((v) => (typeof v === "number" ? v : v.value));

export const HeaderSchema = z.looseObject({
  fileType: z.literal("SerumPreset"),
  product: z.string(),
  productVersion: z.string().optional(),
  presetName: z.string().optional(),
  presetAuthor: z.string().optional(),
  presetDescription: z.string().optional(),
  tags: z.array(z.string()).optional(),
  version: VersionSchema,
});
export type Header = z.infer<typeof HeaderSchema>;

/** A param value: numbers for knobs, strings for menus (e.g. "MgL24", "kBendPos"). */
export const ParamValueSchema = z.union([z.number(), z.string(), z.boolean()]);

/** `plainParams` is the literal "default" or a map of non-default kParam* values. */
export const PlainParamsSchema = z.union([z.literal("default"), z.record(z.string(), ParamValueSchema)]);
export type PlainParams = z.infer<typeof PlainParamsSchema>;

export const RootSchema = z.record(z.string(), z.unknown());
