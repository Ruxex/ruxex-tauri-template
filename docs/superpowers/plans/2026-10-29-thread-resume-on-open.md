# Thread Resume on Open Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resume a persisted App Server thread when its desktop chat view opens, so subsequent turns work after restart or idle unloading.

**Architecture:** Make the conversation query perform `thread/resume` before the existing history reads. Keep the Composer behind the existing query loading state and make the normal-send mutation resume immediately before `turn/start` as a send-time guard. Keep list/sidebar queries read-only.

**Tech Stack:** React, TanStack Query, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-29-thread-resume-on-open-design.md`

## Global Constraints

- Resume only the selected thread, not all threads in the sidebar.
- Do not change App Server eviction policy.
- Do not persist server-backed runtime state in the frontend.
- Use the existing `thread/resume` protocol and mutation hook.

## Review Focus

- Resume failure: the workspace must show an error and must not enable sending.
- Repeated query refetch: it must not create an unnecessary second resume race.
- Send before readiness: the send path must await resume before `turn/start`.
- Empty or invalid thread IDs: existing query gating must remain intact.
- Existing completed-turn refetch behavior: it must continue to work.

---

### Task 1: Resume persisted conversations before history reads

**Files:**
- Modify: `src/app-server/hooks/useThreadQueries.ts`
- Test: `src/app-server/hooks/useThreadQueries.test.tsx`

**Interfaces:**
- Consumes: existing `useResumeThread` mutation and `requestAppServerMethod`.
- Produces: `useThreadConversation` waits for `thread/resume` before its three history requests and exposes the existing React Query loading/error state.

- [ ] Write a failing test asserting the request order is `thread/resume`, then `thread/read`, `thread/turns/list`, and `thread/items/list`.
- [ ] Run the targeted Vitest test and verify it fails because `thread/resume` is absent.
- [ ] Implement the resume-before-read sequence using the existing query API.
- [ ] Run the targeted test and verify it passes.
- [ ] Run `make check-tests`.

### Task 2: Guard normal sends until the selected thread is resumed

**Files:**
- Modify: `src/app-server/hooks/useTurns.ts`
- Test: `src/app-server/hooks/useTurns.test.tsx`

**Interfaces:**
- Consumes: the selected `threadId` in `v2.TurnStartParams`.
- Produces: `useSendMessage` awaits `thread/resume({ threadId, excludeTurns: true })` before `turn/start`.

- [ ] Write a failing hook test asserting the send request order is `thread/resume`, then `turn/start`.
- [ ] Run the targeted tests and verify the new assertions fail.
- [ ] Implement the minimal send-time resume guard.
- [ ] Run the targeted tests and verify they pass.
- [ ] Run `make check-tests`.

### Task 3: Final verification

**Files:**
- Inspect: all changed files and final diff.

- [ ] Run `make check-tests` from a clean command invocation.
- [ ] Inspect `git diff --check` and the full diff for unrelated changes.
- [ ] Report the exact verification result and any remaining limitations.
