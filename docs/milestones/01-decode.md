# M1 — Drop a preset, see decoded JSON

## Facts (container layout confirmed on the Init fixture; see CLAUDE.md)
- Container: `XferJson\0` · u64 header length · JSON · u32 decompressed size · u32 flag (2) · one zstd frame of CBOR.
- All three integers are little-endian (confirmed). Init: 283-byte header, 7834 bytes of CBOR, 175 root keys.
- A Serum 1 `.fxp` (`CcnK`/`FPCh`/`XfsX`) must get its own "not supported yet" message.
- `version` may be a float or `{"value": n}`; -0 occurs; embedded samples can be large.

## Acceptance
- Dropping a file shows header JSON and the CBOR tree, collapsible, with file never leaving the tab (no network request).
- Bad magic, truncated file, flag other than 2, and oversize payload each give a specific readable error.
- Decompression stops at a hard cap, and at the declared size if smaller.
- One Vitest loop decodes every file in `fixtures/` and asserts: schema passes, declared size equals actual size.
- -0 survives decode and display.

## Sources
- node-serum2-preset-packager (MIT), serum2-preset-loader (MIT) — for layout only.
- Owner fixtures.
