# Plugin Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display App Server marketplace/plugin data and manage additional marketplaces from Settings.

**Architecture:** Extend the existing capability query hooks with marketplace mutations, keep the App Server authoritative, and invalidate the plugin query after every mutation. Render marketplace cards in CapabilitiesPage and add a focused MarketplaceSettingsPage linked from SettingsSidebar.

**Tech Stack:** React, TypeScript, TanStack Query, React Router, Vitest, Testing Library, generated Ruxex App Server protocol types.

**Spec:** `docs/superpowers/specs/2026-10-29-plugin-marketplace-design.md`

## Global Constraints

- Do not add a direct public marketplace HTTP client.
- Do not read or write the host Codex cache.
- Use existing generated protocol methods and invalidate `appServerQueryKeys.plugins` after marketplace/plugin mutations.
- Preserve existing Plugins, Skills, MCP, and Settings behavior.

## Review Focus

- Empty marketplace response: show a useful empty state rather than a blank panel.
- Marketplace load errors: keep successful marketplaces visible while showing the error count/details.
- Remote-only marketplace path: show metadata but disable installation with an explanation.
- Invalid/blank marketplace source: prevent submission before calling the server.
- Mutation failure: keep the form/list usable and show the server error.

### Task 1: App Server marketplace/plugin mutations

**Files:**
- Modify: `src/app-server/hooks/useCapabilityQueries.ts`
- Test: `src/app-server/hooks/useCapabilityQueries.test.tsx`

- [ ] Add failing tests for add, upgrade, remove, and install method mapping plus plugin-list invalidation.
- [ ] Run the focused hook test and confirm the new tests fail.
- [ ] Implement the four mutations with shared plugin-query invalidation.
- [ ] Run the focused hook test and confirm it passes.

### Task 2: Browse and install marketplace plugins

**Files:**
- Modify: `src/pages/CapabilitiesPage.tsx`
- Test: `src/pages/CapabilitiesPage.test.tsx`

- [ ] Add failing tests for marketplace display names, plugin metadata/status, install action, empty state, and remote-only install disabling.
- [ ] Run the page test and confirm it fails for the missing UI.
- [ ] Render marketplace cards and plugin rows using `PluginSummary` metadata; wire refresh and install mutations.
- [ ] Run the page test and confirm it passes.

### Task 3: Marketplace Settings page and navigation

**Files:**
- Create: `src/pages/MarketplaceSettingsPage.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/components/sidebar/SettingsSidebar.tsx`
- Test: `src/pages/MarketplaceSettingsPage.test.tsx`

- [ ] Add failing tests for source validation, add form submission, marketplace listing, upgrade, and remove actions.
- [ ] Run the new page test and confirm it fails for the missing route/page.
- [ ] Implement the page with source/ref/sparse-path fields and server mutation states.
- [ ] Add the `/settings/marketplaces` route and sidebar entry.
- [ ] Run the page test and confirm it passes.

### Task 4: Regression verification

- [ ] Run focused tests for hooks, capabilities, marketplace settings, router/sidebar coverage.
- [ ] Run the complete frontend test suite with the bundled Node runtime.
- [ ] Run TypeScript checking/build validation if available.
- [ ] Review the diff and confirm no unrelated files changed.
