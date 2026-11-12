# Responsive Chat Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive three-column chat workspace with a prioritized main chat column, in-flow minimap, and responsive Thread Summary column.

**Architecture:** `ConversationWorkspace` owns the responsive grid and the shared timeline ref. `ChatActivityTimeline` accepts that ref for auto-scroll, while `ConversationMinimap` renders as an in-flow grid item. CSS media queries control the minimap and summary breakpoints without changing AppServer behavior.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-responsive-chat-columns-design.md`

## Global Constraints

- Keep the summary permanently rendered when the responsive layout has room.
- Preserve the existing five-user-message minimap threshold.
- Do not modify AppServer, protocol, or persistence code.
- Keep the main column prioritized over supporting columns.
- Use one shared scroll boundary for all three columns, with the scrollbar
  after the summary; keep the minimap and summary columns fixed-height and
  sticky, and give their contents independent overflow boundaries.

## Review Focus

- Narrow viewport: supporting columns must not consume layout space.
- Medium viewport: minimap must be an in-flow column and retain marker navigation.
- Wide viewport: the always-present summary column must remain the flexible priority column's supporting column.
- Long conversation: the shared scrollbar must appear after the summary while neither supporting column moves; only overflowing side content may scroll internally.
- Timeline ref sharing: minimap jumps and auto-scroll must target the same timeline.

---

### Task 1: Lock the responsive workspace contract in tests

**Files:**
- Modify: `src/components/conversation/ConversationWorkspace.ui.test.tsx`
- Modify: `src/components/conversation/ConversationMinimap.test.tsx`
- Modify: `src/components/chats/ChatActivityTimeline.test.tsx`

**Interfaces:**
- Consumes: existing workspace, minimap, and timeline render contracts.
- Produces: assertions for responsive grid classes, in-flow minimap classes, and shared timeline ref behavior.

- [ ] **Step 1: Write failing tests** for the workspace grid variants, the minimap breakpoint class, and the timeline ref prop.
- [ ] **Step 2: Run the focused Vitest files** and verify the new assertions fail for the missing layout behavior.

### Task 2: Implement the responsive three-column workspace

**Files:**
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/components/chats/ChatActivityTimeline.tsx`
- Modify: `src/components/chats/useTimelineAutoScroll.ts`
- Modify: `src/components/conversation/ConversationMinimap.tsx`
- Modify: `src/components/thread-summary/ThreadSummaryPanel.tsx`
- Modify: `src/styles/index.css`

**Interfaces:**
- Consumes: `ConversationViewItem[]` and pending request state.
- Produces: a grid with optional `chat-minimap-column` and `chat-thread-summary-column` children, plus a shared `timelineRef`.

- [ ] **Step 1: Add an optional external timeline ref to `useTimelineAutoScroll` and `ChatActivityTimeline`.**
- [ ] **Step 2: Render the minimap in-flow and remove the fixed portal positioning.**
- [ ] **Step 3: Add workspace grid classes and responsive CSS: one column by default, minimap at 1360px, and summary at 1680px. Give the outer chat section a shared scroll boundary, keep both supporting columns fixed-height and sticky, and give their contained components independent overflow boundaries while keeping summary content content-sized.**
- [ ] **Step 4: Run the focused tests and verify they pass.**
- [ ] **Step 5: Run typecheck and lint.**

### Task 3: Re-run UI fixtures and integrate

**Files:**
- Modify: `fixtures/dummy-home/unshot.spec.ts` only if the new responsive DOM requires selector updates.

- [ ] **Step 1: Run `make ui-fixtures`.**
- [ ] **Step 2: Run `git diff --check` and inspect the final worktree.**
- [ ] **Step 3: Commit the responsive layout changes.**
- [ ] **Step 4: Push `main` and verify the remote update.**
