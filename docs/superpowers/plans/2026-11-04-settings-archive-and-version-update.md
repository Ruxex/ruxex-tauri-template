# Settings Archive and Version Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add paginated archived-chat management to Settings, outline App Server lifecycle controls, and provide a stop-then-start update action when the running and managed versions differ.

**Architecture:** Share the existing archive page between the top-level archive route and a new settings route. Extend the existing React Query thread hooks for cursor pagination and deletion, and extend the daemon hook with a composed update mutation that preserves the existing Tauri protocol. Keep all UI state and confirmation behavior in the frontend.

**Tech Stack:** React 19, React Router, TanStack React Query, Vitest/Testing Library, TypeScript, Tauri 2, Rust formatting.

**Spec:** `docs/superpowers/specs/2026-11-04-settings-archive-and-version-update-design.md`

## Global Constraints

- Preserve the existing uncommitted preview/read-state work in the checkout.
- Do not change the App Server protocol or add a daemon `update` action.
- Use `thread/list`, `thread/unarchive`, and `thread/delete`.
- Update must call daemon `stop` before daemon `start`.
- Deletion requires explicit confirmation.

## Review Focus

- Opaque archive cursors must be passed unchanged and Previous must return to the prior cursor.
- Deleting or restoring a thread must remove stale rows from the current archived list.
- A failed stop must not call start; a failed start must surface an error and avoid claiming the server is connected.
- Missing or equal versions must not render a misleading Update button.
- InProcess mode and unavailable daemon controls must not render Update.

---

### Task 1: Thread query and mutation contracts

**Files:**
- Modify: `src/app-server/hooks/useThreadQueries.ts`
- Modify: `src/app-server/hooks/useThreadMutations.ts`
- Modify: `src/app-server/hooks/useThreadQueries.test.tsx`
- Modify: `src/app-server/hooks/useThreadMutations.test.tsx`
- Modify: `src/app-server/query-invalidation.ts`
- Modify: `src/app-server/query-invalidation.test.ts`

**Interfaces:**
- Produces `archivedThreadListParams(cursor?: string | null)`, `useArchivedThreadList(cursor?: string | null)`, and `useDeleteThread()`.

- [ ] **Step 1: Write failing tests** for cursor-specific archived requests, delete request mapping, and list invalidation after deletion.
- [ ] **Step 2: Run the focused tests and verify they fail for the missing behavior.**
- [ ] **Step 3: Implement the optional cursor parameter and delete mutation using existing query invalidation.**
- [ ] **Step 4: Run the focused tests and verify they pass.**
- [ ] **Step 5: Run the complete app-server hook/query test files.**

### Task 2: Shared archived-chat settings page

**Files:**
- Modify: `src/pages/ArchivePage.tsx`
- Modify: `src/pages/ArchivePage.test.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/components/sidebar/SettingsSidebar.tsx`
- Modify: `src/components/layout/BrowserNavigationBar.tsx`
- Add or modify tests for route, navigation, and breadcrumb coverage.

**Interfaces:**
- Consumes `useArchivedThreadList(cursor)` and `useDeleteThread()` from Task 1.

- [ ] **Step 1: Write failing page tests** for Settings navigation, page-numbered Next/Previous pagination, Open, Restore, Delete confirmation, empty state, and error state.
- [ ] **Step 2: Run the page tests and verify they fail for the missing UI.**
- [ ] **Step 3: Implement the shared page with cursor history, action buttons, and a confirmation dialog for permanent deletion.**
- [ ] **Step 4: Add `/settings/archive` and the Settings sidebar entry while preserving `/archive`.**
- [ ] **Step 5: Update breadcrumb labels and run the focused page/navigation tests.**

### Task 3: App Server update mutation and version mismatch UI

**Files:**
- Modify: `src/app-server/hooks/useAppServerDaemon.ts`
- Modify: `src/app-server/hooks/useAppServerDaemon.test.tsx`
- Modify: `src/pages/AppServerPage.tsx`
- Modify: `src/components/settings/SettingsCards.tsx`
- Modify: `src/pages/AppServerPage.test.tsx`
- Modify: `src/components/settings/SettingsSections.test.tsx`

**Interfaces:**
- Produces a daemon-hook `update` mutation that executes `stop` then `start` and refreshes the App Server status.
- `AppServerCard` consumes `onUpdate` and `isUpdatePending` and renders Update only for a differing running/managed version pair.

- [ ] **Step 1: Write failing hook and card tests** for stop-before-start ordering, failed-stop short-circuiting, mismatch visibility, missing/equal-version hiding, and outline controls.
- [ ] **Step 2: Run focused tests and verify they fail for the missing behavior.**
- [ ] **Step 3: Implement the composed update mutation and pass it to `AppServerCard`.**
- [ ] **Step 4: Change Start, Restart, and Stop to `btn-outline` while retaining semantic colors.**
- [ ] **Step 5: Run focused App Server tests and verify they pass.**

### Task 4: Full verification and review preparation

**Files:**
- No new production files.
- Modify documentation only if implementation decisions differ from the spec.

- [ ] **Step 1: Run TypeScript typecheck, Biome, ESLint, Vitest, Rust fmt check, and `git diff --check`.**
- [ ] **Step 2: Inspect the final diff for accidental changes to the prior uncommitted work.**
- [ ] **Step 3: Run a fresh whole-change review before claiming completion.**
