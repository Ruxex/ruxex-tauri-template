# Automation Appearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each automation schedule select and display a project-style icon and color.

**Architecture:** Reuse the project icon and color catalogs, metadata picker, and icon renderer in the automation editor. Persist both values as required schedule fields through the Tauri scheduler JSON model, then render them in schedule cards and the automation sidebar.

**Tech Stack:** React, TypeScript, Tailwind/daisyUI, Tauri, Rust, serde JSON.

**Spec:** `docs/superpowers/specs/2026-11-14-automation-icons-design.md`

## Global Constraints

- Use the 16 existing project icon choices and renderer.
- Schedule icon and color are required; no old schedule file migration or defaulting.
- Do not add custom images or a separate automation-only appearance catalog.

## Review Focus

- Creating a schedule preserves the chosen icon and color in its input and persisted record.
- Editing a schedule opens with its current icon and color and saves changed values.
- One-time, daily, and weekly schedule form behavior remains intact when appearance fields are added.
- Schedule enable/disable and run operations retain the chosen appearance.
- Recent automation entries and disabled schedule cards render the selected icon and color with their existing state styling.

---

### Task 1: Reuse the project appearance picker and types

**Files:**
- Modify: `src/components/projects/ProjectMetadataFields.tsx`

**Interfaces:**
- `ProjectMetadataFields` accepts an entity label while preserving its default project labels and existing behavior.
- The schedule form uses `ProjectMetadata` (`icon`, `color`) from the shared project metadata module.

- [ ] Reuse project metadata fields in the schedule editor with automation-specific accessible labels.

### Task 2: Persist the required schedule appearance

**Files:**
- Modify: `src/platform/schedules.ts`
- Modify: `src/pages/schedules/schedule-form.ts`
- Modify: `crates/ruxex-scheduler/src/lib.rs`
- Test: `src/pages/schedules/schedule-form.test.ts`
- Test: `crates/ruxex-scheduler/src/lib.rs`

**Interfaces:**
- Add `icon: ProjectIcon` and `color: ProjectColor` to TypeScript `ScheduleInput` and `ScheduleRecord`.
- Add the equivalent required string fields to Rust `ScheduleInput` and `ScheduleRecord`.
- Add `metadata: ProjectMetadata` to `ScheduleFormState` and a metadata-change reducer action; default to project metadata defaults.

- [ ] Verify form conversion includes both appearance values and editing initialization copies them.
- [ ] Verify Rust schedule create/update/JSON serialization retains both fields.
- [ ] Advance the schedule file schema version to `2`; do not add a migration for files missing appearance fields.

### Task 3: Select and display schedule appearance

**Files:**
- Modify: `src/pages/schedules/ScheduleEditorDialog.tsx`
- Modify: `src/pages/schedules/ScheduleCard.tsx`
- Modify: `src/components/sidebar/AutomationSidebar.tsx`
- Test: `src/pages/schedules/ScheduleEditorDialog.test.tsx`
- Test: `src/pages/SchedulesPage.test.tsx`
- Test: `src/components/sidebar/AutomationSidebar.test.tsx`

**Interfaces:**
- Schedule editor consumes `form.metadata` and displays the selected icon and color preview.
- Schedule cards and recent automation sidebar entries consume `schedule.icon`/`schedule.color` and render `ProjectIcon` with the project color tile.

- [ ] Verify the editor picker changes both appearance values and shows the selected preview.
- [ ] Verify schedule cards and recent automation items render their configured icon and color.
- [ ] Run `make build` and `git diff --check`.
