# Thread Lifecycle Refactor Design

## Intent

Make the desktop client's App Server integration predictable when a thread is cold, resumed, edited, or invalidated. The refactor should reduce duplicated `thread/resume` logic, avoid unnecessary conversation refetches, and bound renderer-side live event state without deleting server-side threads.

## Goals

- Centralize the prerequisite that a thread must be resumed before thread operations.
- Deduplicate concurrent resume requests for the same thread.
- Make query invalidation explicit by data scope instead of invalidating every thread query.
- Evict inactive renderer-side event state while retaining visible, running, resynchronizing, and approval-blocked threads.
- Preserve the existing App Server protocol and generated protocol types.
- Add tests for cold-thread, concurrent-resume, invalidation, and eviction behavior.

## Non-goals

- Do not delete or mutate threads stored by the App Server.
- Do not change App Server idle-unload policy.
- Do not rewrite the generated protocol.
- Do not redesign the conversation UI or Composer in this change.
- Do not replace TanStack Query or the event reducer.

## Constraints

- The App Server remains the source of truth for thread history and execution state.
- `thread/resume` is safe to call before each operation; readiness caching must not assume a server-side thread stays loaded forever.
- Running, resynchronizing, approval-blocked, and currently displayed threads must not be evicted from live renderer state.
- Existing desktop, browser, and in-process App Server modes must continue to work.

## Approaches

1. Keep adding `thread/resume` to individual hooks. Rejected: it duplicates ordering and retry behavior and permits races between opening, sending, and reverting.
2. Add a small client-side thread session coordinator, scoped query invalidation, and bounded event-state retention. Selected: it addresses the three lifecycle problems without changing the App Server protocol or UI architecture.
3. Make the event store the sole source of truth for all conversation data. Rejected: it would duplicate server history handling and substantially expand the change.

## Design decisions

- The session coordinator deduplicates only in-flight resumes. It does not keep a permanent ready flag, because the App Server may unload an idle thread independently of the desktop client.
- Query invalidation is expressed as conversation, metadata, queue, list, or full-thread scope. Revert and turn mutations use the broadest scope they actually require.
- Event-state eviction is renderer-only. The state can be reconstructed by reopening/resuming the thread and refetching the authoritative history.
- Initial eviction policy should retain the current thread and any thread that is running, resynchronizing, or has a pending server request; inactive state is eligible for TTL/max-count eviction. The exact TTL and maximum are implementation constants covered by tests and easy to tune.

## Success criteria

- Opening a cold thread, sending immediately, and editing a message remain ordered and reliable.
- Concurrent operations for one thread produce one in-flight resume request.
- Metadata-only mutations do not refetch conversation items and turns.
- Long-running sessions do not retain unbounded per-thread live event state.
- `make check-tests` and `make verify` pass.
