# Automation Card Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify individual automation cards by removing redundant labels/icons and grouping icon-only actions beside the Enabled toggle.

**Architecture:** Keep the existing `ScheduleCard` component and action callbacks. Change only its DOM layout, visible copy, and Tailwind classes; preserve accessible labels for all controls.

**Tech Stack:** React, TypeScript, Tailwind/daisyUI, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-automation-card-layout-design.md`

## Global Constraints

- Preserve the existing schedule actions and callbacks.
- Preserve accessible names for the Enable/Disable, Run now, Delete, and Edit controls.
- Keep the schedule details as two lines: title first, Next run second.
- Do not change schedule data, API calls, or modal behavior.

## Review Focus

- Disabled schedule: the toggle remains identifiable by its `Enable schedule:` accessible name after visible status text is removed; covered in Task 1.
- Run-now and delete actions: icon-only buttons retain their accessible names and existing callback behavior; covered in Task 1.
- Long schedule names: title and action labels remain usable without changing card data; covered by existing accessible-name assertions and layout classes in Task 1.
- Last-run status: existing success/failure content remains below the two-line schedule summary; covered by the existing schedule fixture test in Task 1.

---

### Task 1: Simplify the individual automation card

**Files:**
- Modify: `src/pages/schedules/ScheduleCard.tsx`
- Test: `src/pages/SchedulesPage.test.tsx`

**Interfaces:**
- Consumes: existing `ScheduleCard` props and `ScheduleRecord` data.
- Produces: unchanged callbacks and accessible control names, with the revised card layout.

- [ ] **Step 1: Write the failing test**

  Extend `shows persisted schedules and confirms run-now/delete actions` to assert:
  - visible `Automation`, `Enabled`, and `Schedule` text are absent;
  - the schedule title remains visible;
  - `Next run:` appears beneath the schedule title;
  - the run-now and delete buttons remain discoverable by their existing accessible names and have no visible text content.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `pnpm vitest run src/pages/SchedulesPage.test.tsx`

  Expected: FAIL because the current card still renders the three visible labels and text in the Run now button.

- [ ] **Step 3: Implement the minimal card layout change**

  In `ScheduleCard.tsx`, remove the visible eyebrow/status/schedule labels and the schedule-detail calendar icon. Put the cadence/title and `Next run` in the card's two-line summary. Move the icon-only Run now and Delete buttons beside the Enabled toggle, keeping `aria-label`, `title`, disabled states, and callbacks unchanged.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `pnpm vitest run src/pages/SchedulesPage.test.tsx`

  Expected: PASS with all tests in the file passing.

- [ ] **Step 5: Run broader verification**

  Run: `pnpm lint && pnpm typecheck && git diff --check`

  Expected: all commands exit 0.
