# Desktop Hooks Browser Design

## Intent

Add the minimum desktop UI needed to inspect lifecycle hooks without adding a
hook editor. The page should let a user answer “what hooks are active here,
where did they come from, and can they run?” before changing configuration in
an external editor.

## Goals

- Add a Hooks section under Settings.
- Load hook metadata from the existing `hooks/list` AppServer method.
- Show the working directory, event, matcher, handler type, source/scope,
  enabled state, managed state, and trust state.
- Make the exact command or handler details and source path expandable.
- Surface AppServer warnings/errors and the empty state.

## Non-goals

- Editing hook definitions.
- Trusting, disabling, or deleting hooks from the desktop UI; the current
  protocol exposes listing only.
- Executing hooks in the Tauri process.
- Adding live hook-run history; the existing notification types are not yet
  reduced into a dedicated client query/state model.

## Approaches

1. Add a dedicated Hooks settings page (chosen). This keeps the read-only
   browser discoverable beside AppServer, MCP, and plugin settings while
   keeping the page focused.
2. Add hooks to the AppServer settings card. This is smaller, but it makes a
   potentially long, per-project list difficult to scan and mixes runtime
   health with configuration inspection.
3. Add a global navigation item. This gives hooks more prominence than the
   current capability warrants and creates a new top-level concept.

## UI behavior

The page renders one collapsible row per hook, grouped by the working directory
returned by `hooks/list`. Each row has a compact event/handler title and badges
for source, enabled/disabled, managed, and trust status. Expanding a row shows
the matcher, source path, plugin id when available, hash, timeout, status
message, and the command or MCP target. Warnings and errors are shown above the
list. Untrusted and modified hooks carry an explicit “Review required” status;
there is no misleading action button until the AppServer exposes a mutation.

## Data flow

`useHooksList()` calls `hooks/list` with the default parameters and is enabled
when the AppServer is available. The page flattens the returned working
directory entries only for rendering; warnings and errors remain associated
with their directory group.
