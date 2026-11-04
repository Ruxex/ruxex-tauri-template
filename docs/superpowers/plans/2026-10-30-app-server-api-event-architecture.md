# App Server API and Event Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make App Server API calls, React Query cache ownership, and event-driven thread rendering consistent without refetching normal conversation history after every turn.

**Architecture:** React Query owns initial server snapshots and recovery snapshots. The event store owns live turn state and exposes narrow subscriptions for thread activity. Event notifications update the live model or invalidate only the affected non-streaming resource; a lagged or reconnected stream performs one explicit authoritative resync and then discards stale live overlays.

**Tech Stack:** React 19, TanStack React Query 5, Vitest, TypeScript, Tauri App Server protocol, Makefile verification recipes.

**Spec:** `docs/superpowers/specs/2026-10-30-app-server-api-event-architecture-design.md`

## Global Constraints

- The App Server protocol remains authoritative for thread history, projects, goals, attachments, queued turns, approvals, model selection, and runtime state.
- Normal turn rendering uses App Server events; authoritative history fetches are recovery-only after event gaps or reconnects.
- Do not edit generated protocol files manually.
- Keep provider-specific HTTP, credentials, wire formats, and errors behind the existing provider/App Server boundary.
- Use `make check-tests` for frontend verification, `make build` for the frontend build, and `make verify` for the complete desktop verification.
- Preserve unrelated untracked files and do not commit the existing private planning/spec files unless explicitly requested.

## Review Focus

- Two observers for the same metadata key must not disagree about resume behavior; test both observers mounted together.
- A successful recovery must not let stale event items overwrite server items; test incomplete and completed live overlays.
- Repeated stream events must produce one notification per actionable event; test delayed notification sends.
- Existing-thread sends, interrupt, and steer must not call `thread/list` or full history queries; test each mutation independently.
- Long conversation responses with `nextCursor` must be fully represented; test multi-page turns and items.

### Task 1: Unify thread query definitions and active-list parameters

**Files:**
- Modify: `src/app-server/hooks/useThreadQueries.ts`
- Modify: `src/components/layout/AppLayout.tsx` only if the shared query options require a consumer change
- Modify: `src/components/sidebar/ThreadList.tsx`
- Modify: `src/pages/ThreadsPage.tsx`
- Test: `src/app-server/hooks/useThreadQueries.test.tsx`
- Test: `src/components/sidebar/ProjectSidebar.test.tsx` or a new focused query-options test

**Interfaces:**
- Produce `threadMetadataQueryOptions(threadId: string, includeTurns?: boolean)` so `useThread` and `useThreadConversation` use the same query key, `ensureThreadResumed` policy, and query function.
- Produce `activeThreadListParams(): v2.ThreadListParams` for the non-archived recency-sorted list used by both the sidebar and `ThreadsPage`.

- [ ] Write a failing test mounting the metadata consumer used by the layout and conversation together; assert one metadata request and one shared resume coordination path.
- [ ] Write a failing test asserting the sidebar and `/threads` page use equal active-list parameters.
- [ ] Run the focused query tests and confirm the new assertions fail against the current divergent definitions.
- [ ] Implement the shared metadata query options and active-list parameter helper without changing generated protocol types.
- [ ] Run the focused tests and confirm the duplicate-key and duplicate-list cases pass.

### Task 2: Make turn mutations event-first

**Files:**
- Modify: `src/app-server/hooks/useTurns.ts`
- Modify: `src/app-server/hooks/useTurns.test.tsx`
- Modify: `src/app-server/query-invalidation.ts` only if a turn-specific invalidation helper becomes unused

**Interfaces:**
- `useSendMessage`, `useInterruptTurn`, and `useSteerTurn` remain mutation hooks but do not invalidate `thread/list` or the conversation history on success.
- Explicit structural mutations such as archive, rename, revert, fork, and queue updates retain their resource-scoped invalidation.

- [ ] Add/adjust failing tests proving send, interrupt, and steer success do not call `invalidateQueries` for thread list or conversation history.
- [ ] Run `src/app-server/hooks/useTurns.test.tsx` and confirm the old invalidation behavior fails the new assertions.
- [ ] Remove only the turn-success invalidations; leave revert and structural mutations unchanged.
- [ ] Run the turn mutation and query invalidation tests.

### Task 3: Add explicit event reconciliation for recovery

**Files:**
- Modify: `src/app-server/event-store.ts`
- Modify: `src/app-server/event-store.test.ts`
- Modify: `src/app-server/event-store-react.test.tsx`
- Modify: `src/app-server/hooks/useThreadQueries.ts`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/components/conversation/conversation-model.ts`
- Test: `src/components/conversation/ConversationWorkspace.ui.test.tsx`
- Test: `src/components/conversation/conversation-model.test.ts`

**Interfaces:**
- Add `clearThreadLiveItems(threadId: string): void` to remove stale event-derived item overlays after a successful authoritative resync while preserving current execution metadata.
- Keep `useThreadConversation().resync(): Promise<void>` as the explicit recovery operation; the workspace clears live overlays only after all three conversation queries succeed.
- `mergeConversationItems` must support a recovery state where authoritative items win over pre-recovery live items, while active post-recovery events still append/update normally.

- [ ] Add a failing reducer/store test showing a recovered thread can discard stale live items without losing its active turn metadata.
- [ ] Add a failing model test showing an authoritative item replaces an incomplete pre-recovery live version.
- [ ] Add a failing workspace test showing ordinary `turn/completed` does not resync, while lagged/reconnect recovery does and clears overlays after success.
- [ ] Implement the store reconciliation operation and wire it into the workspace recovery path.
- [ ] Run event-store, conversation-model, and workspace tests.

### Task 4: Process each App Server event exactly once for notifications

**Files:**
- Modify: `src/app-server/event-store.ts`
- Modify: `src/app-server/hooks/useAppServerEvents.ts`
- Modify: `src/platform/notifications.ts` only if the dispatcher needs in-flight deduplication
- Test: `src/app-server/event-store-react.test.tsx`
- Test: `src/platform/notifications.test.ts`

**Interfaces:**
- Add an event-store subscription such as `subscribeToAppServerEvents(listener: (event: AppServerEvent) => void): () => void` for new events only.
- `useAppServerNotifications` subscribes to that stream rather than iterating `events.history` on every snapshot update.
- The dispatcher marks actionable event IDs as pending before awaiting native notification delivery, preventing concurrent duplicates.

- [ ] Add a failing hook/store test proving one incoming event invokes one notification dispatch, even after the event history grows.
- [ ] Add a failing dispatcher test with a delayed `send` proving concurrent duplicate dispatches are suppressed.
- [ ] Implement new-event subscription and in-flight deduplication.
- [ ] Run notification and event-store tests.

### Task 5: Cover visible protocol notifications and query synchronization

**Files:**
- Modify: `src/app-server/event-reducer.ts`
- Modify: `src/app-server/hooks/useAppServerEvents.ts` or add `src/app-server/event-query-sync.ts` for query-cache synchronization
- Modify: `src/components/sidebar/ThreadList.tsx`
- Modify: `src/pages/ThreadsPage.tsx`
- Test: `src/app-server/event-reducer.test.ts`
- Test: `src/app-server/query-invalidation.test.ts`
- Test: affected sidebar/page tests

**Interfaces:**
- Extend `ThreadExecutionState` with server-backed thread status data separately from turn execution status.
- Handle `thread/status/changed`, `thread/name/updated`, `thread/archived`, `thread/unarchived`, `thread/reverted`, queue changes, and supported item delta variants.
- Update cached thread metadata/list entries directly when the notification contains enough data; invalidate only when the event lacks the authoritative fields required for a safe patch.

- [ ] Add reducer tests for thread status changes and all visible structural notification cases.
- [ ] Add tests proving a normal turn completion updates live status without invalidating history/list queries.
- [ ] Add tests proving rename/archive/revert/queue notifications update only their affected caches.
- [ ] Implement event-to-state and event-to-query synchronization, keeping unknown notifications in collapsed/unsupported handling rather than guessing.
- [ ] Run the reducer, invalidation, and affected UI tests.

### Task 6: Make conversation pagination explicit

**Files:**
- Modify: `src/app-server/hooks/useThreadQueries.ts`
- Modify: `src/app-server/hooks/useThreadQueries.test.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.tsx` only if the response shape changes

**Interfaces:**
- Add internal `fetchAllThreadTurns(threadId, params)` and `fetchAllThreadItems(threadId, params)` helpers that follow `nextCursor` until `null` and preserve the response cursor metadata.
- Keep list/search page sizes bounded unless a UI “load more” flow is added; this task covers conversation history completeness.

- [ ] Add multi-page mock responses and failing tests proving all turn/item pages are combined.
- [ ] Run the focused query tests and confirm the current first-page-only behavior fails.
- [ ] Implement cursor walking with resume coordination performed once per aggregate fetch.
- [ ] Run the query and conversation tests, including an error on a later page.

### Task 7: Remove obsolete API/query abstractions

**Files:**
- Modify: `src/app-server/query-keys.ts`
- Modify: `src/app-server/query-invalidation.ts`
- Modify: `src/app-server/hooks/useThreadMutations.ts`
- Modify: `src/app-server/hooks/useThreadQueries.ts`
- Modify: corresponding unit tests

**Interfaces:**
- Remove only symbols with no production call sites after Tasks 1–6: legacy conversation key, unused broad thread invalidator, and unused mutation wrappers.
- Keep exported hooks that are part of an intentional future UI contract; document the reason if they remain unused.

- [ ] Run `rg`/knip-style call-site checks and record the exact symbols eligible for deletion.
- [ ] Delete obsolete symbols and their stale tests.
- [ ] Run the full frontend test suite and type/lint checks.

### Task 8: Full verification and review

**Files:**
- No source changes unless verification exposes a regression.

- [ ] Run `make check-tests`.
- [ ] Run `make build`.
- [ ] Run `make verify` because the change crosses the Tauri event bridge and frontend runtime.
- [ ] Run `git diff --check` and inspect the final diff for unrelated files.
- [ ] Commit each completed task separately or in logically grouped commits, then report the verification results.
