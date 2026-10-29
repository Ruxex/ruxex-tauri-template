# Thread Resume on Open

## Intent

When the desktop chat opens a persisted thread, it must restore that thread's
live App Server runtime before allowing a new turn. This prevents
`turn/start` from targeting a thread that was unloaded after an app restart or
idle timeout.

## Scope

- Resume the selected thread when `ConversationWorkspace` loads it.
- Keep history loading and Composer readiness behind the resume result.
- Add a send-path guard so a race or reconnect cannot send directly to an
  unloaded thread.
- Do not resume threads merely because they appear in a sidebar/list.

## Approach

Use the existing `thread/resume` protocol operation directly from the
conversation query before reading the thread, turns, and items. The existing
query loading state naturally keeps the Composer behind the initial load, and
the normal-send mutation resumes once more immediately before `turn/start` as
a race/reconnect guard. Existing idle unloading remains responsible for
releasing threads that no longer have subscribers.

## Non-goals

- Changing App Server thread eviction policy.
- Loading every persisted thread at desktop startup.
- Persisting client-side runtime state.
