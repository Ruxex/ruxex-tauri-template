# Conversation Load Recovery

## Intent

Opening a newly created or persisted conversation must not end in a generic
load error when the app-server resume path races with the first query wave or
when a completed-turn preview refresh cancels an initial metadata read.

## Required behavior

- A thread returned by `thread/start` or `thread/fork` is treated as already
  started for every concurrent read-only query that belongs to its initial
  load. One query must not consume the startup exemption for the other
  queries.
- Operations that require a live thread, such as `turn/start` and
  `thread/revert`, still resume the thread when the startup exemption has been
  consumed.
- A `turn/completed` preview refresh may cancel an obsolete metadata request,
  but it must leave the active metadata query with usable data or trigger a
  replacement read. It must not leave an enabled query in `pending/idle` with
  no data and no error.
- The conversation workspace shows a loading state while an enabled query is
  pending without data, and shows the load error only when a query actually
  fails or recovery has ended without data.
- `thread/resume` must not fail solely because optional paginated-history
  cursor discovery is unsupported. The response may omit the affected opaque
  cursor, while unrelated resume failures remain errors.

## Scope

- Desktop TypeScript session coordination, conversation queries, preview
  synchronization, and workspace state handling.
- One retry-compatible `thread/resume` fallback for servers that reject the
  paginated-history form, matching the existing TUI behavior.
- Removal of the temporary persistent conversation debug logger after the
  regression tests cover the failure path.

## Non-goals

- Changing thread eviction or retention policy.
- Persisting server-backed thread state in the frontend.
- Changing the App Server implementation or the meaning of opaque cursors.
