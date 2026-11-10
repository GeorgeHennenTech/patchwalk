export type PresetErrorCode =
  | "serum1-fxp"
  | "bad-magic"
  | "truncated"
  | "bad-header"
  | "unsupported-flag"
  | "too-large"
  | "bad-zstd"
  | "size-mismatch"
  | "bad-cbor"
  | "schema";

/** A decode failure with a message that is safe to show the user as-is. */
export class PresetError extends Error {
  constructor(
    readonly code: PresetErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PresetError";
  }
}
