# Left sidebar resizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task.

**Goal:** Let users resize the expanded left sidebar while preserving the existing Home routing behavior.

**Architecture:** Keep the presentation width state and resize handle in `ProjectSidebar`, because that component owns the left pane boundary and already distinguishes expanded from collapsed states. Use the existing sidebar width transition, clamp the session-local width to 240–480px, and leave the collapsed rail at 64px. Also tighten the Home route predicate so `/chat/new` is not treated as an existing chat.

**Tech Stack:** React, TypeScript, React Router, Tailwind/DaisyUI utility classes, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-home-button-chat-sidebar-design.md`

## Global Constraints

- Existing chat routes keep their current conversation visible when Home is clicked.
- `/chat/new` keeps normal Home navigation behavior.
- Expanded sidebar width defaults to 320px and is clamped between 240px and 480px.
- Collapsed sidebar remains 64px wide and has no resize handle.
- Width is session-local and is not added to persisted UI preferences.

## Review Focus

- Route predicate: `/chat/new` must navigate normally while `/chat/thread-1` stays in place.
- Width boundaries: keyboard and pointer resizing cannot move below 240px or above 480px.
- Collapsed layout: the rail remains 64px and the resize handle is absent.
- Accessibility: the resize affordance exposes `Resize left pane` and keyboard arrows adjust it.

### Task 1: Fix the Home route edge case

**Files:**
- Modify: `src/components/sidebar/ProjectSidebar.tsx`
- Modify: `src/components/sidebar/ProjectSidebar.test.tsx`

- [x] Add a failing test for Home on `/chat/new`, asserting `onPanelChange("home")` and navigation to `/`.
- [x] Run the focused test and confirm the current broad `/chat/` guard fails it.
- [x] Update the guard to skip navigation only for `/chat/<threadId>` routes, excluding `/chat/new`.
- [x] Run both chat-preserving and `/chat/new` tests and confirm they pass.

### Task 2: Add resize behavior to the expanded left sidebar

**Files:**
- Modify: `src/components/sidebar/ProjectSidebar.tsx`
- Modify: `src/components/sidebar/ProjectSidebar.test.tsx`

- [x] Add failing tests for the 320px initial width, keyboard resizing, pointer resizing, 240–480px clamping, and the collapsed rail without a handle.
- [x] Run the focused resize tests and confirm they fail because no handle or width state exists.
- [x] Add session-local `sidebarWidth` state, a clamp helper, pointer drag handlers, ArrowLeft/ArrowRight handlers, and an accessible boundary button. Render the handle only when the context panel is visible and apply the width inline to the expanded sidebar.
- [x] Run the focused resize tests and confirm they pass.
- [x] Run `make check-tests` and `git diff --check`.
- [x] Inspect the final diff for scope and preserve unrelated changes.

