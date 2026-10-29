# Shared Chat Sidebar on Home, Account, and Project Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the same chat-oriented left pane on home, account, and project routes while removing the visible `Home` heading.

**Architecture:** Reuse `HomeSidebar` as the shared chat sidebar and make its accessible region route-neutral. Route-panel selection will map `home`, `account`, and `projects` to that component; the project route will no longer suppress the context pane or its overlay.

**Tech Stack:** React, React Router, Testing Library, Vitest, TypeScript, Tailwind/DaisyUI.

**Spec:** `docs/superpowers/specs/2026-10-29-chat-sidebar-on-shared-routes-design.md`

## Global Constraints

- Work directly on the `main` branch.
- Preserve existing route paths and chat sidebar behavior.
- Do not duplicate `ChatSidebarSections` markup for individual routes.
- Keep accessible labels meaningful after removing the visible `Home` heading.

## Review Focus

- Project route with an expanded sidebar: the chat pane and overlay must be visible, not just the icon rail. Test in `ProjectSidebar.test.tsx` and `AppLayout.test.tsx`.
- Account route with an expanded sidebar: it must use the same recent chats/search/projects pane as home. Test in `ProjectSidebar.test.tsx`.
- Home route: the pane must still contain recent chats and must not render visible `Home` heading text. Test in `ProjectSidebar.test.tsx`.
- Collapsed sidebar on every route: the icon rail must remain available and project pages must still be collapsible. Keep existing collapsed-rail coverage and update any project-specific expectation.
- Existing route-specific sidebars: plugins and settings must remain unchanged. Keep existing plugin/settings coverage green.

### Task 1: Add failing shared-sidebar regression tests

**Files:**
- Modify: `src/components/sidebar/ProjectSidebar.test.tsx`
- Modify: `src/components/layout/AppLayout.test.tsx`

**Interfaces:**
- Consumes: current `ProjectSidebar` and `AppLayout` public props and route behavior.
- Produces: regression coverage for the shared `Chat sidebar` region on home, account, and project routes.

- [ ] **Step 1: Write the failing tests**

  Add assertions that `activePanel="account"` and `activePanel="projects"` render a complementary region named `Chat sidebar` containing `Recent chats`, `Projects`, and the existing thread/project links. Assert that the home version also uses `Chat sidebar` and does not render the visible `Home` heading.

  Update the project-route layout test to expect the sidebar overlay when the sidebar is expanded.

- [ ] **Step 2: Run the focused tests to verify they fail for the missing behavior**

  Run:

  ```bash
  /home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run --reporter=dot src/components/sidebar/ProjectSidebar.test.tsx src/components/layout/AppLayout.test.tsx
  ```

  Expected: failures show that account/projects do not render the chat sidebar, the region is still named `Home sidebar`, and the project overlay is absent.

### Task 2: Implement the shared chat sidebar behavior

**Files:**
- Modify: `src/components/sidebar/HomeSidebar.tsx`
- Modify: `src/components/sidebar/RouteSidebar.tsx`
- Modify: `src/components/sidebar/ProjectSidebar.tsx`
- Modify: `src/components/layout/AppLayout.tsx`

**Interfaces:**
- Consumes: `ChatSidebarSections`, `SidebarPanel`, and existing sidebar state/route selection.
- Produces: the same `ChatSidebarSections`-backed pane for `home`, `account`, and `projects`.

- [ ] **Step 1: Implement the minimum changes to pass the new tests**

  Remove `SidebarHeader` from `HomeSidebar`, rename its complementary region to `Chat sidebar`, and keep `ChatSidebarSections` as the sole pane content. In `SidebarContextPanel`, route `home`, `account`, and `projects` through `HomeSidebar`; leave plugins/settings and generic route panels unchanged. Remove the project-specific collapsed/pane suppression from `ProjectSidebar` and the project-specific overlay suppression from `AppLayout`.

- [ ] **Step 2: Run the focused tests to verify they pass**

  Run the same Vitest command from Task 1. Expected: all focused tests pass.

- [ ] **Step 3: Run the full test suite**

  Run:

  ```bash
  /home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run --reporter=dot
  ```

  Expected: zero failed test files and zero failed tests.

### Task 3: Verify, document, and commit

**Files:**
- Include: `docs/superpowers/specs/2026-10-29-chat-sidebar-on-shared-routes-design.md`
- Include: `docs/superpowers/plans/2026-10-29-shared-chat-sidebar.md`
- Include: implementation and test files from Tasks 1–2.

- [ ] **Step 1: Run static checks and build**

  Run TypeScript, Biome, ESLint, Vite build, and `git diff --check` using the repository's direct binary paths. Expected: all commands exit successfully; existing bundle-size warnings are allowed if no build error occurs.

- [ ] **Step 2: Review the diff and working tree**

  Confirm only the shared-sidebar implementation, regression tests, and the two superpowers documents are changed; confirm no unintended untracked files remain.

- [ ] **Step 3: Commit the completed change**

  ```bash
  git add docs/superpowers/specs/2026-10-29-chat-sidebar-on-shared-routes-design.md docs/superpowers/plans/2026-10-29-shared-chat-sidebar.md src/components/sidebar/HomeSidebar.tsx src/components/sidebar/RouteSidebar.tsx src/components/sidebar/ProjectSidebar.tsx src/components/sidebar/ProjectSidebar.test.tsx src/components/layout/AppLayout.tsx src/components/layout/AppLayout.test.tsx
  git commit -m "refactor(desktop): share chat sidebar across routes"
  ```
