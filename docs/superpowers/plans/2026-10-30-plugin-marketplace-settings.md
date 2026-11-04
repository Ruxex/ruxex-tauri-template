# Plugin Marketplace Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the plugin marketplace settings page so it follows the existing settings-page visual language without changing its behavior.

**Architecture:** Keep marketplace state, hooks, and handlers in `MarketplaceSettingsPage`. Replace the page's generic cards with the shared `SettingsPanel` structure and small local layout helpers for aligned form rows and marketplace management rows.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Tailwind/DaisyUI, Heroicons.

**Spec:** `docs/superpowers/specs/2026-10-30-plugin-marketplace-settings-design.md`

## Global Constraints

- Preserve marketplace API payloads and query behavior.
- Preserve loading, error, validation, confirmation, mutation, and empty-state behavior.
- Use the existing settings-page width, heading, `SettingsPanel`, and divided-row visual language.
- Keep the page responsive on narrow screens.
- Do not change the separate capabilities page.
- Preserve unrelated working-tree changes.

## Review Focus

- Blank source validation must still prevent the mutation; covered by the existing validation test.
- Existing add payload parsing for ref and sparse paths must remain unchanged; covered by the existing add test.
- Update and Remove actions must keep their request payloads and confirmation behavior; covered by the existing list/action test.
- Loading, error, and empty states must remain represented after the layout change; add or retain focused assertions in the page test.
- Narrow layout must allow form controls and action buttons to wrap rather than overflow; use responsive utility classes in the implementation.

---

### Task 1: Define the settings-page structure in tests

**Files:**
- Modify: `src/pages/MarketplaceSettingsPage.test.tsx`

**Interfaces:**
- Consumes: the existing mocked marketplace hooks and `MarketplaceSettingsPage` component.
- Produces: failing assertions for shared settings-panel headings, aligned settings sections, and preserved marketplace actions/states.

- [ ] **Step 1: Write the failing tests**

  Assert that the page exposes `Plugin marketplaces` as the page heading and
  `Add marketplace` plus `Configured marketplaces` as settings section
  headings. Add an assertion for the configured marketplace row's visible
  plugin count and grouped controls while retaining the existing mutation
  payload assertions.

- [ ] **Step 2: Run the focused test to verify the new structure fails**

  Run: `pnpm exec vitest run src/pages/MarketplaceSettingsPage.test.tsx`

  Expected: the new structure assertion fails because the current page uses
  generic card headings and does not yet follow the shared settings-panel
  structure.

### Task 2: Restyle the marketplace settings page

**Files:**
- Modify: `src/pages/MarketplaceSettingsPage.tsx`

**Interfaces:**
- Consumes: the existing marketplace hooks, handlers, and error formatter.
- Produces: a responsive page using `SettingsPanel`, divided form rows, and
  divided marketplace rows with the existing accessible action names.

- [ ] **Step 1: Implement the shared settings layout**

  Use the same `space-y-5` page layout and `text-3xl font-semibold
  tracking-tight` heading as other settings pages. Render Add and Configured
  sections through `SettingsPanel`, preserving all current conditional
  content and handlers.

- [ ] **Step 2: Align form and marketplace rows**

  Replace nested card-body spacing with two-column responsive rows matching
  `SettingRow`: labels and controls align on wide screens, then stack on
  narrow screens. Render marketplace identity and plugin count on the left,
  and Update/Remove actions in a wrapping group on the right.

- [ ] **Step 3: Run the focused test to verify the layout and behavior pass**

  Run: `pnpm exec vitest run src/pages/MarketplaceSettingsPage.test.tsx`

  Expected: all marketplace settings tests pass.

- [ ] **Step 4: Run project verification**

  Run: `pnpm test`

  Expected: the frontend test suite passes.

  Run: `pnpm typecheck`

  Expected: TypeScript compilation succeeds.

  Run: `git diff --check`

  Expected: no whitespace errors.

- [ ] **Step 5: Review the final diff**

  Confirm that only the marketplace page, its tests, and this task's design
  and plan documents are included; do not commit unrelated existing changes
  unless explicitly requested.
