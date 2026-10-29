# User Message Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add text user-message editing to the desktop chat by reverting the selected turn and restoring its text to the Composer.

**Architecture:** Add a typed `useRevertThread` mutation that calls `thread/revert` and invalidates the selected thread. Thread items expose an Edit action only for non-empty user text; the workspace owns the revert flow and passes the resulting draft to the Composer.

**Tech Stack:** React, TanStack Query, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-29-message-edit-design.md`

## Global Constraints

- Edit only completed, non-empty text user messages.
- Do not alter local files when reverting conversation history.
- Keep App Server as the source of truth.
- Do not modify generated protocol files.

## Review Focus

- Edit action is absent for assistant and activity items.
- Empty/image-only user inputs cannot produce an empty replacement prompt.
- Revert failure leaves the existing transcript and Composer unchanged.
- The selected `turnId` is sent, not the message item ID.
- After successful revert, the original text is restored and later turns are refreshed away.

---

### Task 1: Add the revert mutation

**Files:**
- Modify: `src/app-server/hooks/useThreadMutations.ts`
- Test: `src/app-server/hooks/useThreadMutations.test.tsx`

- [ ] Add a failing mapping test for `useRevertThread`.
- [ ] Run the targeted test and verify it fails because the hook is absent.
- [ ] Implement the mutation and invalidate the selected thread/list on success.
- [ ] Run the targeted test and verify it passes.

### Task 2: Add the Edit action and Composer restoration flow

**Files:**
- Modify: `src/components/conversation/ConversationItem.tsx`
- Modify: `src/components/chats/ChatActivityTimeline.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/components/conversation/Composer.tsx`
- Test: `src/components/conversation/ConversationItem.test.tsx`
- Test: `src/components/chats/ChatActivityTimeline.test.tsx`
- Test: `src/components/conversation/ConversationWorkspace.ui.test.tsx`

- [ ] Add failing tests for the user-message Edit action and successful draft restoration.
- [ ] Run the targeted tests and verify they fail.
- [ ] Implement the callback flow and Composer draft synchronization.
- [ ] Run targeted tests and verify they pass.

### Task 3: Final verification

- [ ] Run typecheck, Biome, ESLint, and the full Vitest suite.
- [ ] Run `git diff --check` and inspect the final diff.
