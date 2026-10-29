# Chat Auto-Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the chat timeline at the latest content for sends and bottom-following replies without disrupting users reading older history.

**Architecture:** `TaskActivityTimeline` owns the scroll container, a ref recording whether it was at the bottom before content changes, and a layout effect that scrolls after committed updates. New user messages always trigger the scroll; reply/activity changes only trigger it when the previous position was at the bottom.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-10-29-chat-auto-scroll-design.md`

## Global Constraints

- Change only the native Tauri repository.
- Do not force existing conversations to the bottom on initial render.
- Preserve the user's scroll position when they are reading older history.
- Treat a small distance from the bottom as being at the bottom.

## Review Focus

- Existing history on first render: no automatic scroll.
- New user message while scrolled up: scroll anyway.
- New reply while scrolled up: do not scroll.
- New reply while at the bottom: scroll.
- Streaming updates to an existing reply: continue following only when the user was at the bottom.

### Task 1: Add failing timeline scroll tests

**Files:**
- Modify: `src/components/tasks/TaskActivityTimeline.test.tsx`
- Test: `src/components/tasks/TaskActivityTimeline.test.tsx`

**Interfaces:**
- Consumes the existing `TaskActivityTimeline` props and jsdom scroll metrics.
- Produces executable expectations for the scroll behavior described in the spec.

- [ ] **Step 1: Write focused tests** for no initial scroll, unconditional scroll for a new user message, conditional scroll for replies, and continuing reply updates while at the bottom.
- [ ] **Step 2: Run the focused test file** and confirm the new tests fail because the component has no scroll behavior.

### Task 2: Implement timeline-owned auto-scroll

**Files:**
- Modify: `src/components/tasks/TaskActivityTimeline.tsx`
- Test: `src/components/tasks/TaskActivityTimeline.test.tsx`

**Interfaces:**
- `TaskActivityTimeline` keeps its existing props and rendered accessibility structure.
- Internal helpers track item identity/content signatures and bottom tolerance; no public API changes.

- [ ] **Step 1: Add a scroll ref and scroll-position listener** that records whether the timeline is within the bottom tolerance.
- [ ] **Step 2: Add a layout effect** that skips the initial render, identifies new user-message items, and scrolls to `scrollHeight` for sends or for other content changes only when the previous bottom state was true.
- [ ] **Step 3: Run the focused tests** and confirm all new and existing timeline tests pass.
- [ ] **Step 4: Run the full verification suite**: Vitest, TypeScript, Biome, ESLint, and `git diff --check`.
- [ ] **Step 5: Commit** the spec, plan, implementation, and tests with `feat(desktop): follow chat activity at the bottom`.

