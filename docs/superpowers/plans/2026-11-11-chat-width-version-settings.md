# Chat Width and Version Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the conversation workspace cap to 800px and add a read-only Version tab under Settings.

**Architecture:** Keep the existing conversation shell and settings routing structure. Add a focused `VersionPage` that reads the frontend version from `package.json` and runtime versions from the existing App Server hooks, then expose it through the existing SettingsSidebar.

**Tech Stack:** React, TypeScript, React Router, Tailwind CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-chat-width-version-settings-design.md`

## Global Constraints

- The conversation workspace maximum width is exactly `800px`.
- Version information is read-only and uses `Unavailable` when absent.
- Existing settings navigation and responsive layout patterns remain intact.

## Review Focus

- Small viewport: the chat remains `w-full` despite the smaller maximum width; covered by the ConversationWorkspace class assertion.
- Missing runtime data: the Version page renders stable fallbacks; covered by VersionPage tests.
- Daemon unavailable: the Version page still renders frontend and App Server values; covered by VersionPage tests.
- Direct Version route: the router exposes `/settings/version`; covered by router tests.
- Sidebar navigation: the Version link has the expected href and label; covered by SettingsSidebar tests.

### Task 1: Conversation width

**Files:**
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Test: `src/components/conversation/ConversationWorkspace.test.tsx` (create if needed)

- [x] **Step 1: Write a failing test** asserting the rendered conversation shell retains `w-full` and uses `max-w-[800px]`.
- [x] **Step 2: Run the focused test and verify it fails because the shell still uses `max-w-[980px]`.
- [x] **Step 3: Change the shell class to `max-w-[800px]`.
- [x] **Step 4: Run the focused test and verify it passes.

### Task 2: Version settings page and navigation

**Files:**
- Create: `src/pages/VersionPage.tsx`
- Test: `src/pages/VersionPage.test.tsx`
- Modify: `src/components/sidebar/SettingsSidebar.tsx`
- Modify: `src/app/router.tsx`
- Test: `src/app/router.test.tsx`
- Test: `src/pages/AppServerPage.test.tsx`

- [x] **Step 1: Write failing tests** for VersionPage content/fallbacks, the `/settings/version` route, and the sidebar link.
- [x] **Step 2: Run the focused tests and verify they fail because the page, route, and link do not exist.
- [x] **Step 3: Implement VersionPage using `package.json` plus `useAppServerStatus` and `useAppServerDaemon`, rendering `Unavailable` for missing values.
- [x] **Step 4: Add the Version route and a sidebar entry with a suitable outline icon.
- [x] **Step 5: Run the focused tests and verify they pass.

### Task 3: Full verification

- [x] **Step 1: Run formatting, typechecking, linting, and the full test suite used by the repository.
- [x] **Step 2: Run `git diff --check` and inspect the final diff for scope.
