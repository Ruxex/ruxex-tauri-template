# Desktop Hooks Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Hooks settings page that exposes the AppServer hook catalog and trust state without adding hook editing or mutation controls.

**Architecture:** Add a React Query wrapper for the existing `hooks/list` request, render a dedicated settings page that groups entries by `cwd`, and reuse the existing settings panel/accordion styling. The page displays all metadata already supplied by the generated protocol and preserves per-directory warnings/errors.

**Tech Stack:** React 19, TypeScript, React Router, TanStack Query, Heroicons, Tailwind/DaisyUI, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-hooks-browser-design.md`

## Global Constraints

- Do not add hook editing, trust, disable, delete, or execution actions.
- Use the existing `hooks/list` AppServer method and generated protocol types.
- Keep hook execution in AppServer; the Tauri client only reads and renders metadata.
- Match existing Settings page, SettingsSidebar, and collapsible component patterns.

## Review Focus

- AppServer unavailable: the query must remain disabled until the existing AppServer status is ready; the page must not issue a request prematurely. Test in Task 1.
- Multiple working directories: every returned directory group must remain visible and warnings/errors must stay with the group. Test in Task 2.
- Trust states: managed, trusted, untrusted, and modified must have distinct accessible labels, with review-required states obvious. Test in Task 2.
- Handler variants: command, MCP tool, prompt, and agent metadata must render without unsafe assumptions about discriminated fields. Test in Task 2.
- Empty and failed responses: the page must show an understandable empty state and query error. Test in Task 2.

---

### Task 1: Add the Hooks list query

**Files:**
- Modify: `src/app-server/query-keys.ts`
- Modify: `src/app-server/hooks/useCapabilityQueries.ts`
- Test: `src/app-server/hooks/useCapabilityQueries.test.tsx`

**Interfaces:**
- Consumes: generated `v2.HooksListParams` and `v2.HooksListResponse`, plus `useAppServerStatus()`.
- Produces: `useHooksList(params: v2.HooksListParams = {})` returning a React Query result keyed under `appServerQueryKeys.hooks` and calling `hooks/list`.

- [ ] **Step 1: Write the failing test**

  Add `useHooksList` to the query mapping table and assert it calls `requestAppServerMethod("hooks/list", {})` and resolves the server payload.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `pnpm vitest run src/app-server/hooks/useCapabilityQueries.test.tsx -t useHooksList`
  Expected: FAIL because `useHooksList` is not exported.

- [ ] **Step 3: Implement the query**

  Add the `hooks` query key and implement `useHooksList` using the same status-gated `useQuery` pattern as `useSkillsList` and `usePluginList`.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `pnpm vitest run src/app-server/hooks/useCapabilityQueries.test.tsx -t useHooksList`
  Expected: PASS.

### Task 2: Build the read-only Hooks settings page

**Files:**
- Create: `src/pages/HooksPage.tsx`
- Create: `src/pages/HooksPage.test.tsx`
- Modify: `src/components/settings/SettingsCards.tsx`

**Interfaces:**
- Consumes: `useHooksList()` from Task 1 and generated `v2.HooksListEntry`/`v2.HookMetadata` types.
- Produces: `HooksPage`, a settings page with accessible expandable hook rows and no mutation controls.

- [ ] **Step 1: Write failing component tests**

  Cover a populated response with two working directories, all four handler variants, managed/trusted/untrusted/modified states, enabled/disabled states, and directory warnings/errors. Assert event/source/handler labels and expandable command/MCP/source details.

  Also cover empty data and query error states.

- [ ] **Step 2: Run the focused component tests to verify they fail**

  Run: `pnpm vitest run src/pages/HooksPage.test.tsx`
  Expected: FAIL because `HooksPage` is not implemented.

- [ ] **Step 3: Implement the page**

  Render a page heading and read-only notice, group each `HooksListEntry` in a `SettingsPanel` titled by `cwd`, render each hook as a native `details/summary` row, and expose:

  - Event and matcher.
  - Handler type, command or MCP target.
  - Source and source path.
  - Plugin id when present.
  - Enabled/disabled and managed badges.
  - Trust labels: Managed, Trusted, Review required, or Modified — review required.
  - Timeout, status message, current hash, and async marker when available.
  - Directory warnings/errors.

  Use text truncation/overflow-safe classes for long commands and paths. Keep details collapsed by default and do not add buttons that imply unsupported mutations.

- [ ] **Step 4: Run the focused component tests to verify they pass**

  Run: `pnpm vitest run src/pages/HooksPage.test.tsx`
  Expected: PASS.

### Task 3: Add Hooks to Settings navigation and routing

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/components/sidebar/SettingsSidebar.tsx`
- Modify: `src/components/layout/BrowserNavigationBar.tsx`
- Modify: `src/pages/AppServerPage.test.tsx`
- Modify: `src/app/router.test.tsx`

**Interfaces:**
- Consumes: `HooksPage` from Task 2.
- Produces: `/settings/hooks` route, sidebar link, and `Hooks` breadcrumb.

- [ ] **Step 1: Write failing navigation tests**

  Assert the sidebar has a `Hooks` link to `/settings/hooks`, the router resolves the route, and the browser breadcrumb labels it `Hooks`.

- [ ] **Step 2: Run focused navigation tests to verify they fail**

  Run: `pnpm vitest run src/pages/AppServerPage.test.tsx src/app/router.test.tsx src/components/layout/BrowserNavigationBar.test.tsx`
  Expected: FAIL because the new link, route, and breadcrumb do not exist.

- [ ] **Step 3: Implement route and navigation**

  Add the Hooks route/page and a System sidebar item using an existing outline icon. Add the breadcrumb label mapping.

- [ ] **Step 4: Run focused navigation tests to verify they pass**

  Run: `pnpm vitest run src/pages/AppServerPage.test.tsx src/app/router.test.tsx src/components/layout/BrowserNavigationBar.test.tsx`
  Expected: PASS.

### Task 4: Verify the complete change

**Files:**
- No new files.

- [ ] **Step 1: Run formatting and type checks**

  Run: `pnpm format:check && pnpm typecheck`
  Expected: exit 0.

- [ ] **Step 2: Run the full frontend test suite**

  Run: `pnpm test`
  Expected: all tests pass.

- [ ] **Step 3: Run lint**

  Run: `pnpm lint`
  Expected: exit 0 with no warnings treated as errors.

- [ ] **Step 4: Inspect the final diff**

  Run: `git diff --check && git status --short`
  Expected: no whitespace errors; only the Hooks UI/query/docs changes are present.
