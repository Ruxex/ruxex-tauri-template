# Project Sidebar Chat Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each sidebar project independently expandable with its project threads in recency order, and ellipsize chat names that exceed the sidebar width.

**Architecture:** Keep `ChatSidebarSections` responsible for project-row presentation and local expanded state. Reuse `ThreadList` with `projectId`, which already uses `projectThreadListParams` with `recency_at` descending. Keep project navigation as a separate link and use a fixed-size disclosure button for expansion.

**Tech Stack:** React 19, TypeScript, React Testing Library, Vitest, Tailwind CSS, App Server React Query hooks.

**Spec:** `docs/superpowers/specs/2026-10-30-project-sidebar-chat-groups-design.md`

## Global Constraints

- Use the App Server as the source of truth for projects and threads.
- Reuse `ThreadList` and `projectThreadListParams`; do not client-group a global thread list.
- Keep project navigation and disclosure interaction as separate controls.
- Keep expanded state local to the current sidebar session; do not persist it.
- Preserve full accessible chat names while using CSS truncation for visual overflow.
- Do not modify unrelated untracked documentation files.

## Review Focus

- A project expansion must not expand another project; test two projects with independent `aria-expanded` values in `ChatSidebarSections.test.tsx`.
- Collapsed projects must not render or fetch their project thread list; test the hook call before and after expansion in `ChatSidebarSections.test.tsx`.
- Project thread ordering must request `recency_at` descending and render the returned order; test the exact params and link order in `ChatSidebarSections.test.tsx`.
- Long chat names must keep the status icon stable while truncating the title; test `min-w-0`, `flex-1`, and `truncate` on the title in `ChatListItem.test.tsx`.
- Existing project-page links and recent-chat navigation must remain intact; retain and extend the existing navigation assertions in `ChatSidebarSections.test.tsx`.

---

### Task 1: Add failing sidebar grouping and title truncation tests

**Files:**
- Modify: `src/components/chats/ChatSidebarSections.test.tsx`
- Modify: `src/components/chats/ChatListItem.test.tsx`

**Interfaces:**
- Consumes: current `ChatSidebarSections`, `ThreadList`, and `ChatListItem` behavior.
- Produces: regression assertions for project disclosure buttons, project-scoped thread query params/order, and truncation layout classes.

- [ ] **Step 1: Add the failing project grouping test**

Extend `ChatSidebarSections.test.tsx` with two projects and project-specific `useThreadList` mock data. Assert that both projects start with `aria-expanded="false"`, expanding Project Alpha leaves Project Beta collapsed, the Alpha thread links render in the mocked newest-to-oldest order, and the project thread query uses:

```ts
{
  projectId: "project-1",
  archived: false,
  limit: 50,
  sortKey: "recency_at",
  sortDirection: "desc",
}
```

Also assert collapsed Project Beta does not call `useThreadList` with `projectId: "project-2"`.

- [ ] **Step 2: Add the failing title truncation test**

Extend `ChatListItem.test.tsx` with a title longer than the sidebar width and assert its title span has `min-w-0`, `flex-1`, and `truncate`, while the status region remains present.

- [ ] **Step 3: Run the focused tests and verify they fail**

Run: `node_modules/.bin/vitest run src/components/chats/ChatSidebarSections.test.tsx src/components/chats/ChatListItem.test.tsx`

Expected: FAIL because projects do not yet expose per-project disclosure controls and the title span does not yet include the required flex sizing.

### Task 2: Implement project-specific expansion and title ellipsis

**Files:**
- Modify: `src/components/chats/ChatSidebarSections.tsx`
- Modify: `src/components/chats/ChatListItem.tsx`

**Interfaces:**
- Consumes: Task 1's behavior assertions and the existing `ThreadList` props `{ projectId, selectedThreadId, onSelect }`.
- Produces: independently expandable project rows with project-scoped `ThreadList` children and CSS-truncated chat titles.

- [ ] **Step 1: Add local expanded-project state and disclosure controls**

In `ChatSidebarSections.tsx`, track expanded project IDs in local state. Render each project as a row containing a fixed-size icon-only button with an accessible name such as `Expand Project Alpha` / `Collapse Project Alpha`, a rotating chevron, and the existing project link. Render `<ThreadList projectId={project.id} selectedThreadId={selectedThreadId} onSelect={onClose} />` only when that project is expanded.

- [ ] **Step 2: Make chat title layout shrinkable and truncatable**

In `ChatListItem.tsx`, keep the status icon in a non-shrinking slot and apply `min-w-0 flex-1 truncate` to the title span. Preserve the full title text and existing link destination/accessibility.

- [ ] **Step 3: Run focused tests and verify they pass**

Run: `node_modules/.bin/vitest run src/components/chats/ChatSidebarSections.test.tsx src/components/chats/ChatListItem.test.tsx`

Expected: PASS with all existing and new assertions passing.

### Task 3: Verify the complete frontend change

**Files:**
- Verify: `src/components/chats/ChatSidebarSections.tsx`
- Verify: `src/components/chats/ChatListItem.tsx`
- Verify: `src/components/chats/ChatSidebarSections.test.tsx`
- Verify: `src/components/chats/ChatListItem.test.tsx`

**Interfaces:**
- Consumes: Task 2's implemented sidebar behavior.
- Produces: verified frontend changes ready for handoff.

- [ ] **Step 1: Run type checking, linting, tests, and build**

Run the repository frontend checks with the pinned runtime, including TypeScript, Biome, ESLint, the full Vitest suite, and Vite build. The expected result is exit code 0, no lint errors, and all tests passing.

- [ ] **Step 2: Run whitespace and diff review**

Run: `git diff --check` and inspect the final diff. Expected: no whitespace errors and only the files named in this plan plus the design/plan documents are changed.
