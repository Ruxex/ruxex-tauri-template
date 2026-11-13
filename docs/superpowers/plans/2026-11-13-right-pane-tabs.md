# Right Pane Tabs Implementation Plan

> **For agentic workers:** Use the native inline execution method for this plan. Steps use checkbox syntax for tracking.

**Goal:** Add browser-like tabs to the global right pane, initially for Git diff reviews, and close the pane when the last tab closes.

**Architecture:** `AppLayout` owns typed right-pane tab state and renders a tab strip above the selected tab's content. Git diff targets remain the existing content model and are deduplicated by thread/workspace.

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-13-right-pane-tabs-design.md`

## Global Constraints

- Reuse the existing global right pane and its resize controls.
- Keep the header toggle behavior and existing Git diff view.
- Do not persist tabs across launches.

## Review Focus

- Duplicate opens select the existing matching Git diff tab.
- Closing an inactive tab does not change the active tab.
- Closing the active tab chooses a remaining tab deterministically.
- Closing the final tab closes the pane.
- Hiding and reopening the pane preserves tabs.

---

### Task 1: Git diff tabs in the existing right pane

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/components/layout/AppLayout.test.tsx`
- Modify: `src/app/app-outlet-context.ts` only if the callback contract needs a change.

**Interfaces:**
- Consume `GitDiffReviewTarget { threadId: string; workspace: string }`.
- Store right-pane tab records with `id`, `kind: "git-diff"`, and `target`.

- [x] Add behavior tests for opening, selecting, closing, duplicate targets, final close, and header hide/reopen.
- [x] Run the focused test and confirm the new behavior fails before implementation.
- [x] Implement tab state, tab strip, active content selection, and close behavior.
- [x] Run the focused test and the full relevant test suite.
