# The owner's Claude Code widgets ("mods")

Two small panes the owner uses beside the chat in Claude Code. They live only in a session's own folder, so a
new session does not have them. These are the source files, kept here so they can be put back.

- `patchwalk-todo`: a pane showing `docs/TODO.md` with boxes you can tick (the `/todo` pane).
- `patchwalk-usage`: a pane showing how much of the session has been used.

## Putting them back in a new session (for the assistant)

1. Load the `plugin-authoring` skill and follow it: it says where a session's mods folder is and how a mod
   is scaffolded there (the scaffold also makes the generated `types` folders that are not kept here).
2. Make a mod of the same name for each, then copy this folder's `hooks/register.tsx`, `hooks/hooks.json`
   and `.claude-plugin/plugin.json` over the scaffold's. Mods reload by themselves when their files change.
3. Check the pane opens and shows `docs/TODO.md`. If the mod interface has changed since Nov 2026, fix the
   code against the new types rather than forcing the old file in.

Not secret; no keys or personal details are in these files.
