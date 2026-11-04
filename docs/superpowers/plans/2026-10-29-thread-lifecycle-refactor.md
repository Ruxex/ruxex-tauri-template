# Thread Lifecycle Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize thread resume coordination, make App Server query invalidation scoped, and bound inactive renderer-side event state for the desktop app.

**Architecture:** Add a small `thread-session` client module that deduplicates concurrent `thread/resume` calls without assuming permanent server readiness. Replace broad thread invalidation with named scope helpers, then add retention and eviction to the existing event store so only relevant live execution state remains in memory. The App Server protocol and generated types remain unchanged.

**Tech Stack:** React, TanStack Query, TypeScript, Vitest, existing App Server request/event abstractions.

**Spec:** `docs/superpowers/specs/2026-10-29-thread-lifecycle-refactor-design.md`

## Global Constraints

- The App Server remains the source of truth for thread history and execution state.
- The coordinator deduplicates in-flight resumes but does not cache readiness permanently.
- Renderer-side eviction must not remove visible, running, resynchronizing, or approval-blocked thread state.
- Do not edit generated protocol files or change the App Server protocol.
- Do not delete server-side threads or change App Server idle-unload behavior.

## Review Focus

- Open and send concurrently for a cold thread: exactly one resume is in flight and the turn starts after it settles. Test in Task 1.
- Resume failure: the failed in-flight entry is cleared so a later operation can retry. Test in Task 1.
- Revert/edit after a broad invalidation: conversation data refreshes, while unrelated mutations do not refetch it. Test in Task 2.
- Event-state eviction: idle states are removed, but running/resynchronizing/pending-request/current states remain. Test in Task 3.
- Reconnect or a late event after eviction: the thread state can be recreated without corrupting the global store. Test in Task 3.

## File Map

- Create `src/app-server/thread-session.ts`: in-flight resume coordination and test reset hooks.
- Modify `src/app-server/hooks/useThreadQueries.ts`: use the coordinator before conversation reads.
- Modify `src/app-server/hooks/useTurns.ts`: use the coordinator before turn start.
- Modify `src/app-server/hooks/useThreadMutations.ts`: use the coordinator before revert and any other thread operation that requires a loaded thread.
- Create or modify `src/app-server/thread-session.test.ts`: coordinator ordering, deduplication, and retry tests.
- Modify `src/app-server/query-keys.ts`: add scoped prefix keys for conversation, metadata, queue, and attachments where needed.
- Modify `src/app-server/query-invalidation.ts`: expose scoped invalidation helpers and retain a clearly named full-thread helper.
- Modify thread mutation tests and `src/app-server/query-invalidation.test.ts`: assert the new invalidation policy.
- Modify `src/app-server/event-reducer.ts`: represent activity/eviction eligibility and expose a pure pruning operation.
- Modify `src/app-server/event-store.ts`: retain visible thread IDs, schedule or trigger bounded pruning, and apply reducer pruning without resetting the store.
- Modify `src/app-server/hooks/useAppServerEvents.ts` and the conversation workspace: register/unregister the currently displayed thread for retention.
- Modify `src/app-server/event-reducer.test.ts` and `src/app-server/event-store.test.ts`: eviction and retention coverage.
- Modify `src/components/conversation/ConversationWorkspace.ui.test.tsx` if the retention lifecycle is tested at the component boundary.

### Task 1: Centralize in-flight thread resume

**Files:**
- Create: `src/app-server/thread-session.ts`
- Create: `src/app-server/thread-session.test.ts`
- Modify: `src/app-server/hooks/useThreadQueries.ts:184`
- Modify: `src/app-server/hooks/useTurns.ts:1-20`
- Modify: `src/app-server/hooks/useThreadMutations.ts:74-87`

**Interfaces:**
- Produces `ensureThreadResumed(threadId: string): Promise<void>`.
- Produces `resetThreadSessionState(): void` for isolated tests and App Server lifecycle reset.
- Consumes `requestAppServerMethod("thread/resume", { threadId, excludeTurns: true })`.

- [ ] **Step 1: Write failing coordinator tests**

  Add tests for: concurrent calls with one App Server request; a caller resolving only after resume resolves; a failed resume clearing the in-flight entry; and a later call retrying after failure.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run: `pnpm exec vitest run src/app-server/thread-session.test.ts`
  Expected: FAIL because the coordinator does not yet exist.

- [ ] **Step 3: Implement the coordinator**

  Keep a `Map<string, Promise<void>>` of in-flight resumes. Return the existing promise for concurrent calls, delete the map entry in both success and failure paths, and do not maintain a permanent ready set.

- [ ] **Step 4: Update thread operations to use the coordinator**

  Replace direct resume boilerplate in conversation loading, `useSendMessage`, and `useRevertThread`. Preserve the existing request parameters and operation order.

- [ ] **Step 5: Run focused tests**

  Run: `pnpm exec vitest run src/app-server/thread-session.test.ts src/app-server/hooks/useTurns.test.tsx src/app-server/hooks/useThreadMutations.test.tsx src/app-server/hooks/useThreadQueries.test.tsx`
  Expected: PASS.

- [ ] **Step 6: Commit the independently working coordinator**

  Commit message: `refactor(desktop): centralize thread resume coordination`

### Task 2: Scope query invalidation

**Files:**
- Modify: `src/app-server/query-keys.ts`
- Modify: `src/app-server/query-invalidation.ts`
- Modify: `src/app-server/hooks/useTurns.ts`
- Modify: `src/app-server/hooks/useThreadMutations.ts`
- Modify: `src/app-server/query-invalidation.test.ts`
- Modify: `src/app-server/hooks/useTurns.test.tsx`
- Modify: `src/app-server/hooks/useThreadMutations.test.tsx`

**Interfaces:**
- Produces `invalidateThreadConversation(queryClient, threadId)`.
- Produces `invalidateThreadMetadata(queryClient, threadId)`.
- Produces `invalidateThreadQueue(queryClient, threadId)`.
- Produces `invalidateThreadList(queryClient)`.
- Produces `invalidateThreadQueries(queryClient, threadId)` only as an explicitly broad/full-thread helper.

- [ ] **Step 1: Add failing invalidation-policy tests**

  Assert that conversation mutations invalidate conversation and list data; metadata mutations invalidate metadata and only the list when the list displays that metadata; queue mutations invalidate queue data; and full-thread operations invalidate all thread-scoped data.

- [ ] **Step 2: Run focused tests and verify the new assertions fail**

  Run: `pnpm exec vitest run src/app-server/query-invalidation.test.ts src/app-server/hooks/useTurns.test.tsx src/app-server/hooks/useThreadMutations.test.tsx`
  Expected: FAIL against the current broad invalidation behavior.

- [ ] **Step 3: Add query-key prefixes and scoped invalidation helpers**

  Ensure parameterized conversation/turn/item queries can be invalidated by a stable thread-scoped prefix without invalidating unrelated metadata queries.

- [ ] **Step 4: Classify each existing thread mutation**

  Assign turn start/interrupt/steer and revert to conversation scope; settings/name/goal changes to metadata scope; queue operations to queue scope; and fork/delete operations to list scope. Use full scope only where the mutation changes multiple server-backed resources.

- [ ] **Step 5: Run focused and existing App Server tests**

  Run: `pnpm exec vitest run src/app-server/query-invalidation.test.ts src/app-server/hooks/useTurns.test.tsx src/app-server/hooks/useThreadMutations.test.tsx src/app-server/hooks/useThreadQueries.test.tsx`
  Expected: PASS.

- [ ] **Step 6: Commit the scoped invalidation change**

  Commit message: `refactor(desktop): scope thread query invalidation`

### Task 3: Bound renderer-side event state

**Files:**
- Modify: `src/app-server/event-reducer.ts`
- Modify: `src/app-server/event-store.ts`
- Modify: `src/app-server/hooks/useAppServerEvents.ts`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/app-server/event-reducer.test.ts`
- Modify: `src/app-server/event-store.test.ts`
- Modify: `src/components/conversation/ConversationWorkspace.ui.test.tsx`

**Interfaces:**
- Produces a pure reducer operation such as `pruneIdleThreadStates(state, options): EventState`.
- Produces `retainThreadState(threadId: string): () => void` from the event-store module.
- Consumes the existing `ThreadExecutionState` and pending server request state.

- [ ] **Step 1: Write failing pruning tests**

  Cover: idle state removal after the configured TTL/max-count threshold; preservation of running state; preservation of resynchronizing state; preservation of threads with pending server requests; preservation of the retained visible thread; and recreation after a later event.

- [ ] **Step 2: Run focused tests and verify they fail**

  Run: `pnpm exec vitest run src/app-server/event-reducer.test.ts src/app-server/event-store.test.ts`
  Expected: FAIL because no thread-state pruning exists.

- [ ] **Step 3: Add eviction metadata and a pure pruning operation**

  Track last activity in a testable way. Keep the policy constants in one place. The pruning operation must not touch App Server data, query cache data, event history, or pending requests.

- [ ] **Step 4: Add store-level retention and pruning**

  Make the store retain the currently displayed thread and invoke pruning on event updates and a bounded lifecycle timer. Avoid starting timers when the store is stopped; clear retention and timer state in `stopAppServerEventStore`.

- [ ] **Step 5: Register the visible conversation thread**

  In `ConversationWorkspace`, retain `threadId` while mounted and release it on unmount. Do not retain every thread visited during the app lifetime.

- [ ] **Step 6: Run event-store and UI tests**

  Run: `pnpm exec vitest run src/app-server/event-reducer.test.ts src/app-server/event-store.test.ts src/app-server/event-store-react.test.tsx src/components/conversation/ConversationWorkspace.ui.test.tsx`
  Expected: PASS.

- [ ] **Step 7: Commit the bounded event-state change**

  Commit message: `refactor(desktop): bound inactive thread event state`

### Task 4: Full verification and regression review

**Files:**
- Modify: only tests or documentation if verification exposes a regression.

- [ ] **Step 1: Run the complete frontend checks**

  Run: `make check-tests`
  Expected: all frontend tests, typecheck, lint, and formatting checks pass according to the repository target.

- [ ] **Step 2: Run the desktop verification target**

  Run: `make verify`
  Expected: the complete desktop verification succeeds without changing generated protocol files or staged runtime artifacts.

- [ ] **Step 3: Review the diff for lifecycle safety**

  Confirm that no server-side delete operation was introduced, no running/approval/current thread can be evicted, every direct resume call in the targeted flows uses the coordinator, and every mutation has an intentional invalidation scope.

- [ ] **Step 4: Commit any required test-only corrections**

  Use a separate test or fix commit rather than folding unrelated changes into the three refactor commits.

