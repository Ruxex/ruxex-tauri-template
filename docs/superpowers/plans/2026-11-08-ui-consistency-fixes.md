# UI Consistency Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task.

**Goal:** Improve the screenshot-visible UI states identified in the design review while preserving existing app behavior.

**Architecture:** Add presentation-only helpers for capability navigation, MCP status summaries, dialog layout, and empty states. Migrate the existing pages to those helpers and add focused component tests plus the existing full suite.

**Tech Stack:** React, TypeScript, Tailwind/DaisyUI, React Testing Library, Vitest, WebdriverIO.

**Spec:** `docs/superpowers/specs/2026-11-08-ui-consistency-fixes-design.md`

## Global Constraints

- Keep marketplace image fallback behavior unchanged.
- Do not change MCP or App Server protocol semantics.
- Use real UI behavior in fixtures; do not write fixture database records directly.
- Do not commit generated homes or screenshots.

## Review Focus

- Capability route/query changes must update the selected navigation item.
- MCP status combinations must remain understandable when runtime status is null but resources exist.
- Dialog refactors must preserve accessible names and submit/cancel behavior.
- Empty-state actions must remain keyboard-accessible.
- A single schedule must not occupy a two-column grid slot.

### Task 1: Add failing component tests for navigation, MCP status, common dialog layout, empty state, and schedule width

**Files:**
- Create: `src/components/sidebar/PluginsSidebar.test.tsx`
- Create: `src/components/mcp/McpStatusSummary.test.tsx`
- Create: `src/components/common/DialogParts.test.tsx`
- Modify: `src/components/common/AsyncState.test.tsx`
- Modify: `src/pages/SchedulesPage.test.tsx`

- [ ] Write tests that fail before the presentation changes.
- [ ] Run the focused tests and confirm failures are due to missing behavior.

### Task 2: Implement navigation, terminology, MCP status, and responsive list changes

**Files:**
- Modify: `src/components/sidebar/PluginsSidebar.tsx`
- Modify: `src/components/sidebar/SettingsSidebar.tsx`
- Modify: `src/pages/AppServerPage.tsx`
- Modify: `src/components/layout/BrowserNavigationBar.tsx`
- Create: `src/components/mcp/McpStatusSummary.tsx`
- Modify: `src/pages/CapabilitiesPage.tsx`
- Modify: `src/pages/McpServersPage.tsx`
- Modify: `src/pages/SchedulesPage.tsx`

- [ ] Implement the smallest UI changes that make Task 1 pass.
- [ ] Update route and screenshot selectors for the App Server label.
- [ ] Run focused tests and typecheck.

### Task 3: Implement shared dialog and empty-state presentation

**Files:**
- Create: `src/components/common/DialogParts.tsx`
- Modify: `src/pages/schedules/ScheduleActionDialog.tsx`
- Modify: `src/pages/schedules/ScheduleEditorDialog.tsx`
- Modify: `src/pages/mcp-servers/McpServerDialog.tsx`
- Modify: `src/components/projects/NewProjectDialog.tsx`
- Modify: `src/components/common/AsyncState.tsx`
- Modify: `src/pages/ArchivePage.tsx`
- Modify: `src/pages/ProjectHomePage.tsx`
- Modify: `src/pages/ProjectsPage.tsx`
- Modify: `src/pages/ThreadsPage.tsx`
- Modify: `src/pages/schedules/ScheduleCard.tsx`

- [ ] Add shared dialog primitives and migrate the affected dialogs.
- [ ] Add the common empty-state shape and migrate the highest-visibility empty pages.
- [ ] Run the focused tests and the full Vitest suite.

### Task 4: Stabilize the Home screenshot and verify

**Files:**
- Modify: `fixtures/dummy-home/support.ts`
- Modify: `fixtures/dummy-home/pages.spec.ts`

- [ ] Add a semantic wait for Home project loading to settle.
- [ ] Run formatting, typecheck, lint, and the relevant fixture checks.
- [ ] Confirm the working tree contains no generated screenshot or home files.
