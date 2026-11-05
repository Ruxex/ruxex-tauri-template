# Conversation Load Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended for this repository) to implement this plan task-by-task.

**Goal:** Make conversation opening recover correctly from the observed `thread/resume` race and from metadata cancellation during `turn/completed` preview refreshes.

**Architecture:** Keep session coordination in `thread-session.ts`, but distinguish read-only initial hydration from operations that must consume the newly-started-thread exemption. Make preview refresh restore the active metadata query after cancellation, and expose a pending aggregate state so the workspace does not convert an in-progress recovery into a false load error. Add a single compatibility retry for servers that reject the paginated-history form of `thread/resume`.

**Tech Stack:** React, TanStack Query, TypeScript, Vitest, Testing Library, Rust, Tokio, App Server integration tests.

**Spec:** `docs/superpowers/specs/2026-11-05-conversation-load-recovery-design.md`

## Global Constraints

- Preserve the App Server as the source of truth for thread history and runtime state.
- Keep `thread/resume` required for operations that need a live session; do not make the frontend persist runtime state.
- Treat paginated cursors as opaque; the client must not fabricate or interpret them.
- Preserve unrelated user changes already present in the working tree.
- Use repository Makefile verification for the desktop checkout and the repository-supported Rust test entrypoint for the App Server checkout.
- Remove temporary conversation debug logging once the automated regression coverage replaces it.

## Review Focus

- Three concurrent read queries after `thread/start`: all must share the startup exemption instead of one query triggering `thread/resume`.
- First and second sends on a newly created thread: the first uses the started runtime, while a later live operation can resume again.
- Resume failure: the failed promise must be retryable and must not poison later attempts.
- `turn/completed` during initial hydration: metadata cancellation must not strand an enabled query in `pending/idle` with no data.
- Unsupported paginated resume: retry once without `excludeTurns`; unrelated resume errors still fail.

---

### Task 1: Lock the desktop session-coordination regression

**Files:**
- Modify: `src/app-server/thread-session.test.ts`
- Modify: `src/app-server/hooks/useThreadQueries.test.tsx`
- Modify: `src/app-server/hooks/useTurns.test.tsx`

**Interfaces:**
- Consumes: `markThreadStarted` and `ensureThreadResumed` from `src/app-server/thread-session.ts`.
- Produces: failing tests that define the startup-exemption API for read-only queries and live operations.

- [ ] **Step 1: Add a failing test for multiple read consumers.** Mark `thread-new` as started, call `ensureThreadResumed("thread-new", { consumeStarted: false })` from three concurrent consumers, and assert that no `thread/resume` request is issued.
- [ ] **Step 2: Run the targeted test and verify it fails for the current one-shot skip behavior.**

  Run: `pnpm exec vitest run src/app-server/thread-session.test.ts src/app-server/hooks/useThreadQueries.test.tsx`

  Expected: the new test fails because the current startup exemption is consumed by one caller.
- [ ] **Step 3: Add a test for the live-operation boundary.** Assert that the first consuming call after startup still avoids resume, while the next consuming call issues `thread/resume`; retain the existing failure-then-retry assertion.
- [ ] **Step 4: Update the query-hook test expectations.** The initial conversation read wave may call `thread/read`, `thread/turns/list`, and `thread/items/list` without consuming the startup exemption, while `useSendMessage` continues to guard `turn/start`.

### Task 2: Implement session coordination without reintroducing the resume race

**Files:**
- Modify: `src/app-server/thread-session.ts`
- Modify: `src/app-server/hooks/useThreadQueries.ts`
- Modify: `src/app-server/hooks/useTurns.ts` only if needed to make the consuming call explicit
- Modify: `src/app-server/hooks/useThreadMutations.ts` only if needed to make revert consume the exemption
- Test: files from Task 1

**Interfaces:**
- Consumes: `ensureThreadResumed(threadId, options?)`.
- Produces: `ensureThreadResumed(threadId, { consumeStarted: false })` for read-only metadata/turn/item queries and the default consuming behavior for sends/reverts.

- [ ] **Step 1: Implement the smallest API change.** Add an options object with `consumeStarted` defaulting to `true`; read-only query callers pass `false`, so every initial query consumer can observe the startup exemption without deleting it.
- [ ] **Step 2: Preserve retry semantics.** Keep the in-flight resume map cleared on both success and failure; a rejected resume must not be cached as a permanent session state.
- [ ] **Step 3: Run the Task 1 targeted tests and verify they pass.**

  Run: `pnpm exec vitest run src/app-server/thread-session.test.ts src/app-server/hooks/useThreadQueries.test.tsx src/app-server/hooks/useTurns.test.tsx`

- [ ] **Step 4: Run the full frontend test suite.**

  Run: `pnpm exec vitest run`

  Expected: all existing tests and the new startup-race tests pass.

### Task 3: Make preview refresh restore canceled metadata reads

**Files:**
- Modify: `src/app-server/event-query-sync.ts`
- Test: `src/app-server/event-query-sync.test.ts`

**Interfaces:**
- Consumes: the existing `refreshThreadPreview` flow and `appServerQueryKeys.threadMetadata(threadId)`.
- Produces: a completed-turn refresh that cannot leave the active `{ includeTurns: false }` metadata query without data.

- [ ] **Step 1: Add a failing real-`QueryClient` test.** Start an enabled metadata query whose request is still pending, deliver `turn/completed`, resolve the preview `thread/read`, and assert that the metadata query has data and is no longer pending/idle after synchronization.
- [ ] **Step 2: Run the targeted event-sync test and verify it fails with the metadata query stranded after cancellation.**

  Run: `pnpm exec vitest run src/app-server/event-query-sync.test.ts`

- [ ] **Step 3: Make cancellation awaitable.** Have `cancelThreadReads` return a promise and await metadata cancellation before issuing the preview read, so the refresh order is deterministic.
- [ ] **Step 4: Restore the exact active metadata cache after `thread/read`.** Set the query key `[...appServerQueryKeys.threadMetadata(threadId), { includeTurns: false }]` to the successful `thread/read` response before applying the existing preview patch to list and metadata caches. Keep the `onlyIfNewer` protection for older responses.
- [ ] **Step 5: Run the targeted event-sync tests and the full frontend suite.**

  Run: `pnpm exec vitest run src/app-server/event-query-sync.test.ts && pnpm exec vitest run`

  Expected: the new recovery test, the older-preview protection test, and all existing tests pass.

### Task 4: Expose pending recovery state instead of showing a false load error

**Files:**
- Modify: `src/app-server/hooks/useThreadQueries.ts`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Test: `src/app-server/hooks/useThreadQueries.test.tsx`
- Test: `src/components/conversation/ConversationWorkspace.ui.test.tsx`

**Interfaces:**
- Consumes: the three underlying TanStack Query states.
- Produces: an aggregate `isPending`/loading result that is true when an enabled subquery has no data and is pending, even if `fetchStatus` is idle after cancellation.

- [ ] **Step 1: Add a failing hook test.** Model metadata as `isPending: true`, `fetchStatus: "idle"`, with turns/items still loading, and assert that `useThreadConversation` reports pending rather than an error.
- [ ] **Step 2: Add a failing workspace test.** With `data: null`, `isError: false`, and `isPending: true`, assert that the centered spinner is shown and `Unable to load this conversation.` is absent.
- [ ] **Step 3: Implement the aggregate pending state.** Keep `isError` tied to actual query errors; do not treat `!data` alone as an error while an enabled query is pending.
- [ ] **Step 4: Update the workspace render guards.** Render loading while the aggregate is loading/pending, and render the error state only when recovery is no longer pending and a query has failed or data is unavailable.
- [ ] **Step 5: Run the targeted UI/query tests and the full frontend suite.**

  Run: `pnpm exec vitest run src/app-server/hooks/useThreadQueries.test.tsx src/components/conversation/ConversationWorkspace.ui.test.tsx && pnpm exec vitest run`

### Task 5: Add the App Server history-pagination compatibility retry

**Files:**
- Modify: `src/app-server/thread-session.ts`
- Test: `src/app-server/thread-session.test.ts`

**Interfaces:**
- Consumes: the App Server error returned by `thread/resume` with code `-32601` and a message matching `list_turns is not supported yet` or `list_items is not supported yet`.
- Produces: one fallback request with `{ threadId, excludeTurns: false }`; all other errors remain failures.

- [ ] **Step 1: Add a failing session test.** Reject the first resume with the exact `-32601` history-pagination error, resolve the second request, and assert that the second request uses `excludeTurns: false` and the caller resolves.
- [ ] **Step 2: Run the focused test and verify it fails because the current coordinator propagates the first error.**

  Run: `pnpm exec vitest run src/app-server/thread-session.test.ts`

  Expected: the new test fails before the compatibility retry is implemented.
- [ ] **Step 3: Implement a narrowly scoped retry helper.** Detect only the known history-pagination unsupported error, retry once with `excludeTurns: false`, and do not retry arbitrary `-32601` errors or other server failures.
- [ ] **Step 4: Run the session tests and the full frontend suite.**

  Run: `pnpm exec vitest run src/app-server/thread-session.test.ts && pnpm exec vitest run`

  Expected: the fallback test and all existing query/mutation tests pass.

### Task 6: Remove temporary diagnostics and verify the complete fix

**Files:**
- Delete: `src/app-server/debug-logging.ts`
- Modify: `src/app-server/hooks/useThreadQueries.ts`
- Modify: `src/app-server/thread-session.ts`
- Modify: `src/app-server/event-query-sync.ts`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src-tauri/src/app_server.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: all regression tests from Tasks 1–5.
- Produces: no production debug log command or temporary `conversation-debug.log` writes after the permanent tests are in place.

- [ ] **Step 1: Remove the temporary TypeScript logging calls and helper.** Preserve unrelated user changes in the touched files.
- [ ] **Step 2: Remove the temporary Tauri `conversation_debug_log` command, its registration, and related imports.**
- [ ] **Step 3: Run the supported desktop checks.**

  Run: `make check-tests`, `make rust-test`, and `git diff --check` from the desktop checkout. If the package-manager build-script restriction still blocks `make check-tests`, report it explicitly and run the already-validated direct Vitest/type checks as a fallback.
- [ ] **Step 4: Reproduce the original workflow manually.** Create a new chat, switch away and back during/after the first turn, and confirm the conversation loads without `Unable to load this conversation`; also verify an existing persisted chat opens and a second turn still resumes correctly.
- [ ] **Step 5: Inspect the final diff for unrelated changes and record the exact verification results.**
