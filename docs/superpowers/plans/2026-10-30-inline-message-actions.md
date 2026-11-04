# Inline Message Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add compact user message bubbles, hover/focus actions, and inline correction editing.

**Architecture:** Keep edit state local to `ConversationItem`. Extend the conversation view model with an optional turn timestamp, pass turn metadata from `ConversationWorkspace`, and let the workspace callback perform the existing revert-then-send correction flow.

**Tech Stack:** React, TypeScript, Tailwind/DaisyUI, Heroicons, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-30-inline-message-actions-design.md`

## Global Constraints

- User action space remains reserved below each user bubble even when controls are visually hidden.
- Copy and edit controls are icon-only and have accessible labels.
- Send must revert before starting the edited message; Cancel must not call the App Server.
- Existing assistant/activity rendering and bottom Composer behavior remain unchanged.

## Review Focus

- User message with no timestamp still reserves and renders its action area without an invalid date.
- Canceling an inline edit leaves the original text and server state unchanged.
- Sending edited text preserves the revert-before-send request ordering.
- Copying a message does not enter edit mode.
- Non-user and non-editable user items do not expose the controls.

### Task 1: Extend conversation item metadata

**Files:**
- Modify: `src/components/conversation/conversation-model.ts`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Test: `src/components/conversation/ConversationWorkspace.test.tsx`

**Interfaces:**
- Consumes: existing authoritative turns and item entries.
- Produces: `ConversationViewItem.timestamp?: number | null` and a merge call that associates each item with its containing turn's `startedAt`.

- [ ] Write a failing test for the timestamp carried from a containing turn.
- [ ] Run the focused model test and verify it fails.
- [ ] Implement the optional timestamp and turn-to-item mapping.
- [ ] Run the focused test and verify it passes.

### Task 2: Add inline user message actions

**Files:**
- Modify: `src/components/conversation/ConversationItem.tsx`
- Test: `src/components/conversation/ConversationItem.test.tsx`

**Interfaces:**
- Consumes: `ConversationViewItem.timestamp` and an edit callback `(item, editedText) => void | Promise<void>`.
- Produces: compact user bubble, reserved action row, copy action, and local inline edit form.

- [ ] Write failing tests for variants, action visibility structure, copy, cancel, and edit form submission.
- [ ] Run the focused component test and verify it fails.
- [ ] Implement the local editing state and icon-only controls.
- [ ] Run the focused test and verify it passes.

### Task 3: Connect revert-then-send correction flow

**Files:**
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.ui.test.tsx`

**Interfaces:**
- Consumes: `ConversationItem`'s `(item, editedText)` callback.
- Produces: ordered `thread/revert` then `turn/start` requests using the edited text and current thread settings.

- [ ] Write a failing UI test for the ordered revert/send flow.
- [ ] Run it and verify it fails.
- [ ] Add the send mutation and callback wiring; remove the old bottom-Composer draft behavior for message edits.
- [ ] Run the focused UI test and the full suite.

### Task 4: Verify and integrate

- [ ] Run TypeScript, Biome, ESLint, production build, and runtime staging tests.
- [ ] Review the diff and commit as `feat(desktop): add inline message actions`.
