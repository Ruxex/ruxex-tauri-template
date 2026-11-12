# Home button chat sidebar behavior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task.

**Goal:** Keep the current conversation visible while opening the Home chat sidebar when Home is pressed from a chat route.

**Architecture:** Make `ProjectSidebar` inspect the current location when handling a rail action. It will always notify `onPanelChange`, but it will skip the existing `navigate("/")` call only for the Home panel while the pathname starts with `/chat/`; all other panel actions and Home navigation keep their current behavior.

**Tech Stack:** React, TypeScript, React Router, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-home-button-chat-sidebar-design.md`

## Global Constraints

- On `/chat/:threadId`, Home opens the Home/chat sidebar without navigating.
- On other routes, Home keeps its current navigation behavior to `/`.
- Preserve the existing sidebar toggle behavior when Home is already the active panel and the sidebar is open.
- Do not change the NewChat route, chat history loading, or persisted UI preferences.

## Review Focus

- Chat route detection: a `/chat/<threadId>` pathname must not be replaced by `/` after Home is clicked; cover this in the chat-route regression test.
- Normal Home navigation: a non-chat pathname must still navigate to `/`; cover this in a separate navigation test.
- Panel state handoff: both cases must call `onPanelChange("home")` so `AppLayout` remains responsible for opening or toggling the sidebar; assert this in each test.

### Task 1: Preserve chat route when opening Home sidebar

**Files:**
- Modify: `src/components/sidebar/ProjectSidebar.tsx`
- Modify: `src/components/sidebar/ProjectSidebar.test.tsx`

**Interfaces:**
- Consumes: existing `ProjectSidebar` props, `useNavigate`, and the current `SidebarPanelDefinition` passed to `selectPanel`.
- Produces: the same `ProjectSidebar` API; Home rail clicks on chat routes call `onPanelChange("home")` without changing the router location.

- [x] **Step 1: Write the failing chat-route regression test**

  Add a small `LocationProbe` test helper using `useLocation`, then render `ProjectSidebar` in a `MemoryRouter` at `/chat/thread-1` with `collapsed` set to `true`. Click the Home rail button and assert that `onPanelChange` received `"home"` and the probe still shows `/chat/thread-1`.

- [x] **Step 2: Run the focused test to verify it fails for the current behavior**

  Run: `pnpm vitest run src/components/sidebar/ProjectSidebar.test.tsx -t "keeps the chat route when Home opens the sidebar"`

  Expected: FAIL because the current Home handler navigates to `/`.

- [x] **Step 3: Add the minimal route-aware guard in `ProjectSidebar.tsx`**

  Import `useLocation`, read `location.pathname`, and in `selectPanel` call `onPanelChange(panel.id)` first. Return before `navigate(panel.route)` only when `panel.id === "home"` and `location.pathname.startsWith("/chat/")`; otherwise preserve the existing navigation call.

- [x] **Step 4: Run the focused test to verify it passes**

  Run: `pnpm vitest run src/components/sidebar/ProjectSidebar.test.tsx -t "keeps the chat route when Home opens the sidebar"`

  Expected: PASS.

- [x] **Step 5: Add the normal-route regression test**

  Render the same sidebar at `/settings`, click Home, and assert `onPanelChange("home")` plus a location of `/`. This pins the non-chat behavior that must remain unchanged.

- [x] **Step 6: Run both focused navigation tests**

  Run: `pnpm vitest run src/components/sidebar/ProjectSidebar.test.tsx -t "Home"`

  Expected: PASS for both chat-preserving and normal-navigation cases.

- [x] **Step 7: Run repository verification**

  Run: `make check-tests` and `git diff --check` from `ruxex-tauri-template`.

  Expected: the frontend test suite exits successfully and `git diff --check` reports no whitespace errors.

- [x] **Step 8: Inspect the final diff**

  Confirm only the design/plan docs and the two intended sidebar files changed, with no route or preference API changes.

