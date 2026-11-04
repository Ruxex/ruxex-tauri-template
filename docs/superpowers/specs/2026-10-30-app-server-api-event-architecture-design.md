# App Server API and Event Architecture

## Goal

Make the desktop frontend consistent about which source owns thread data:
React Query provides initial and explicitly recovered server state, while the
App Server event stream provides normal turn progress and completion updates.
Avoid duplicate API calls, stale event overlays, and event-driven UI paths
that silently ignore protocol changes.

## Requirements

- A React Query key must have one query function and one resume policy.
- Normal turn progress, completion, interrupt, and steer updates must not
  refetch full thread history or the global thread list.
- Full conversation resync is allowed only after an event gap or reconnect,
  and must reconcile event-derived state with authoritative server data.
- Desktop notifications must process each newly received event once, not
  replay the event history on every update.
- Thread list consumers must share the same active-thread query parameters
  where they represent the same list.
- Conversation history pagination must not silently drop server pages.
- Protocol notifications that affect visible thread state must either update
  the event model/cache or be explicitly classified as unsupported with a
  recovery path.
- Unused query keys, invalidation helpers, and mutation wrappers must be
  removed only after production call-site verification.

## Non-goals

- Do not add client persistence for server-backed thread data.
- Do not change generated protocol files manually.
- Do not add a completion-time history fetch for normal successful turns.
