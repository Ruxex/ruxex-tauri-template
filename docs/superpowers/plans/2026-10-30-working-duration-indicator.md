# Working Duration Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chat timeline's centered running spinner with a Codex-style elapsed-time indicator such as `Working for 42s`.

**Architecture:** The workspace derives the active turn's protocol id and `startedAt` and passes both to the timeline. The timeline owns the small one-second timer needed only while the thread is running, inserts the status immediately before active-turn items, and keeps pending server requests at the bottom.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Tailwind/DaisyUI.

**Spec:** `docs/superpowers/specs/2026-10-30-working-duration-indicator-design.md`

## Global Constraints

- Keep initial conversation-loading spinners unchanged.
- Keep activity-level progress indicators unchanged.
- Render the working indicator immediately before active-turn items and before pending requests.
- Show `Working for 0s` when a valid turn start is available but no full second has elapsed.
- Show `Working` without a duration when no valid start timestamp is available.
- Preserve unrelated working-tree changes.

## Review Focus

- A turn with a valid Unix-seconds `startedAt` must show the correct whole-second duration; test this with a controlled clock in `ChatActivityTimeline.test.tsx`.
- The indicator must not regress to a spinner; assert the old spinner class is absent.
- A missing or invalid start timestamp must not produce `NaNs`; assert the fallback label.
- Pending approval cards must remain after the working indicator; assert DOM order.
- Stopping the turn must remove the working indicator; assert the completed-state render.

---

### Task 1: Add failing timeline behavior tests

**Files:**
- Modify: `src/components/chats/ChatActivityTimeline.test.tsx`

**Interfaces:**
- Consumes: the existing `ChatActivityTimeline` props plus the new `workingStartedAt?: number | null` prop.
- Produces: failing tests that define the elapsed label, fallback, no-spinner, stopped-state, active-turn insertion, and pending-request ordering behavior.

- [ ] **Step 1: Write the failing tests**

  Add tests that render a running timeline with `workingStartedAt={start}` and
  a controlled current time, then assert `Working for 42s`, no
  `loading-spinner` element, the working status immediately before the active
  turn's message, and before a pending request.
  Add a missing/invalid timestamp case expecting `Working`, and a non-running
  case expecting no working status.

- [ ] **Step 2: Run the focused tests to verify they fail for the missing behavior**

  Run: `pnpm exec vitest run src/components/chats/ChatActivityTimeline.test.tsx`

  Expected: the new assertions fail because the component still renders the
  centered spinner and does not accept/render the new timestamp prop.

### Task 2: Implement the elapsed working indicator

**Files:**
- Modify: `src/components/chats/ChatActivityTimeline.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`

**Interfaces:**
- Consumes: `conversation.data.turns.data`, `liveThread.activeTurnId`, and `v2.Turn.startedAt`.
- Produces: `ChatActivityTimeline` props `workingTurnId?: string | null` and `workingStartedAt?: number | null`, plus a status element with accessible name `Working` or `Working for Ns` immediately before active-turn messages.

- [ ] **Step 1: Implement the timeline timer and label**

  Add a local elapsed-seconds hook/helper that accepts a Unix-seconds start
  timestamp, returns a non-negative whole-second duration when valid, and
  refreshes once per second while active. Replace the centered spinner with a
  divider/status block. Insert it immediately before the first item whose
  `turnId` matches `workingTurnId`, fall back to the start of the timeline
  when no matching item exists, keep it before `pendingRequests`, and include
  both new props in the memo comparison.

- [ ] **Step 2: Pass the active turn start timestamp from the workspace**

  Find the turn whose id equals `liveThread.activeTurnId`, pass that id and its
  `startedAt` value to `ChatActivityTimeline`, and pass `null` when there is no
  active turn or no usable timestamp.

- [ ] **Step 3: Run the focused tests to verify they pass**

  Run: `pnpm exec vitest run src/components/chats/ChatActivityTimeline.test.tsx`

  Expected: all tests in the file pass, including the new elapsed-duration and
  ordering assertions.

- [ ] **Step 4: Run the project verification**

  Run: `pnpm test`

  Expected: the frontend test suite passes.

  Run: `make rust-test`

  Expected: the Tauri/Rust test suite passes.

  Run: `git diff --check`

  Expected: no whitespace errors.

- [ ] **Step 5: Commit**

  Commit only the files for this feature and the associated design/plan docs
  after reviewing the final diff. Do not include unrelated existing changes.
