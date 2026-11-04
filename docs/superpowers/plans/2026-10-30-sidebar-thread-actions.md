# Sidebar Thread Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-edge archive icon to sidebar thread rows and a slow hover-to-end title animation for titles that overflow.

**Architecture:** `ThreadList` owns one `useArchiveThread` mutation and passes an archive callback plus pending state to each `ChatListItem`. `ChatListItem` renders the link and archive button as sibling controls and uses a small measured title component to animate only when the title is wider than its available space.

**Tech Stack:** React 19, TypeScript, React Testing Library, Vitest, Heroicons, Tailwind CSS, App Server React Query hooks.

**Spec:** `docs/superpowers/specs/2026-10-30-sidebar-thread-actions-design.md`

## Global Constraints

- Use the existing `useArchiveThread` hook and App Server `thread/archive` method.
- Keep the archive button outside the chat link; archive clicks must not navigate.
- Reuse the same behavior for recent chats and project-scoped `ThreadList` rows.
- Keep the full title text accessible and disable the marquee for non-overflowing titles.
- Keep status icon and archive button fixed while the title moves.
- Do not modify archived-page behavior or add persistent client state.
- Preserve unrelated untracked files and the already pushed page-container commit.

## Review Focus

- Archive clicks must not activate the chat link; test `preventDefault`/`stopPropagation` behavior through the row callback.
- Pending archive state must disable the row's archive control without changing the link destination.
- Short titles must not get slide styles; test the measured overflow branch separately from long titles.
- A title with an archive button must still shrink in the available row width and preserve its status icon.
- Both recent and project thread lists must receive the same archive behavior; test the shared `ThreadList` row path.

---

### Task 1: Add failing archive and title-animation tests

**Files:**
- Modify: `src/components/chats/ChatListItem.test.tsx`
- Modify: `src/components/chats/ChatSidebarSections.test.tsx`
- Modify: `src/components/sidebar/ProjectSidebar.test.tsx`

**Interfaces:**
- Consumes: current `ChatListItem`, `ThreadList`, and sidebar hook mocks.
- Produces: regression assertions for archive controls, click isolation, shared list behavior, and overflow title presentation.

- [ ] **Step 1: Add ChatListItem archive-control tests**

Render a `ChatListItem` with an `onArchive` callback and assert the right-edge button has an accessible name `Archive Build the sidebar`, renders an SVG, and leaves the `/chat/thread-1` link intact. Fire the button click and assert the callback receives the event path without activating the link callback. Assert `isArchiving` disables the button.

- [ ] **Step 2: Add measured-title animation tests**

Add tests that mock element measurements so a short title has no marquee transition and a long title gets an overflow-dependent transform/transition structure on hover while retaining the full title text.

- [ ] **Step 3: Extend sidebar hook mocks and shared-list tests**

Add `useArchiveThread` to the existing hook mocks in `ChatSidebarSections.test.tsx` and `ProjectSidebar.test.tsx`. Assert the recent and project-scoped rendered rows expose archive buttons and the shared mutation is invoked with the correct `threadId`.

- [ ] **Step 4: Run focused tests and verify they fail**

Run: `node_modules/.bin/vitest run src/components/chats/ChatListItem.test.tsx src/components/chats/ChatSidebarSections.test.tsx src/components/sidebar/ProjectSidebar.test.tsx`

Expected: FAIL because `ChatListItem` has no archive control or measured title animation and `ThreadList` does not yet provide the archive hook.

### Task 2: Implement archive action and hover title slide

**Files:**
- Modify: `src/components/chats/ChatListItem.tsx`
- Modify: `src/components/sidebar/ThreadList.tsx`
- Modify: `src/components/chats/ChatSidebarSections.test.tsx`
- Modify: `src/components/sidebar/ProjectSidebar.test.tsx`

**Interfaces:**
- Consumes: Task 1's failing behavior assertions and `useArchiveThread`'s `mutateAsync({ threadId })` interface.
- Produces: `ChatListItem` props `onArchive?: () => void` and `isArchiving?: boolean`, with `ThreadList` supplying them for every sidebar row.

- [ ] **Step 1: Add the shared archive mutation to ThreadList**

Call `useArchiveThread()` once in `ThreadList`, pass `onArchive={() => void archive.mutateAsync({ threadId: thread.id })}` and `isArchiving={archive.isPending}` to each `ChatListItem`, and keep the existing query/status behavior unchanged.

- [ ] **Step 2: Render the sibling archive icon control**

Refactor `ChatListItem` to render the chat link and archive button as sibling controls in a shrinkable row. Use `ArchiveBoxIcon`, an accessible label based on the title, `type="button"`, and opacity/focus classes that reveal the icon on row hover or keyboard focus. Prevent default and stop propagation in the button handler.

- [ ] **Step 3: Implement measured overflow title presentation**

Add a focused title component that measures its wrapper and title widths with `ResizeObserver` when available. Keep a normal ellipsized title for short or idle states; for overflowing titles, render a non-interactive full-title layer that transitions from `translateX(0)` to the negative overflow distance while hovered, with a slow ease-in-out duration. Keep the wrapper `min-w-0 flex-1 overflow-hidden` and preserve the full title via the link accessible name and `title` attribute.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `node_modules/.bin/vitest run src/components/chats/ChatListItem.test.tsx src/components/chats/ChatSidebarSections.test.tsx src/components/sidebar/ProjectSidebar.test.tsx`

Expected: PASS with archive controls, click isolation, shared mutation calls, and title animation assertions passing.

### Task 3: Verify the complete frontend change

**Files:**
- Verify: `src/components/chats/ChatListItem.tsx`
- Verify: `src/components/sidebar/ThreadList.tsx`
- Verify: `src/components/chats/ChatListItem.test.tsx`
- Verify: `src/components/chats/ChatSidebarSections.test.tsx`
- Verify: `src/components/sidebar/ProjectSidebar.test.tsx`

**Interfaces:**
- Consumes: Task 2's sidebar thread actions implementation.
- Produces: verified frontend changes ready for integration.

- [ ] **Step 1: Run type checking, linting, full tests, and build**

Run the pinned-runtime TypeScript check, Biome, ESLint, full Vitest suite, and Vite build. Expected: exit code 0, no lint errors, and all tests passing.

- [ ] **Step 2: Run whitespace and diff review**

Run: `git diff --check` and inspect the final diff. Expected: only the sidebar action implementation, its tests, and the design/plan documents are changed.
