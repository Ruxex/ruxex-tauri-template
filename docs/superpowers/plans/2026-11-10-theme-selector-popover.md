# Theme selector popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Appearance theme selector a stable overlay that remains usable above an open workspace side panel.

**Architecture:** Keep the native `details` disclosure in `UiPreferencesCard`, but position its option panel absolutely and raise the selector stacking context above the existing sidebar layers. Add an opt-in overflow-visible mode to `SettingsPanel` so the popover is not clipped by the Interface card.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-theme-selector-popover-design.md`

## Global Constraints

- Preserve native disclosure semantics and keyboard interaction.
- Keep the side panel open/closed behavior unchanged.
- Keep the current theme preview outside the selector and in the same flex row.
- Use a stacking level above the workspace sidebar (`z-40`) and backdrop (`z-10`).

## Review Focus

- Opening the selector must not place the current preview inside the selector or move it in normal flow.
- The option panel must remain above the side panel and backdrop at compact widths.
- Selecting a preset must still call the existing callback and close the selector.
- Other `SettingsPanel` consumers must retain their existing overflow behavior.

### Task 1: Convert the theme choices to an overlay

**Files:**
- Modify: `src/components/settings/UiPreferencesCard.tsx`
- Modify: `src/components/settings/SettingsPanel.tsx`
- Modify: `src/components/settings/SettingsLayout.test.tsx`
- Modify: `src/pages/AppearancePage.test.tsx` if shared assertions need adjustment

**Interfaces:**
- `SettingsPanel` gains an opt-in overflow prop for panels containing overlays; the default remains unchanged.
- `UiPreferencesCard` keeps `onThemePresetChange(preset)` unchanged and renders the option panel with absolute positioning and a stacking level above `z-40`.

- [x] Add failing tests asserting the option panel is positioned as an overlay, has a higher stacking class than the sidebar, leaves the preview outside the selector, and closes after selection.
- [x] Run the focused settings tests and confirm the new assertions fail against the normal-flow panel.
- [x] Add the opt-in overflow behavior to `SettingsPanel` and convert the theme choices to an absolute popover with the required stacking level.
- [x] Close the `details` element after a preset is selected while preserving the existing callback.
- [x] Run the focused settings tests and the full frontend verification suite.

### Task 2: Verify the branch

**Files:**
- Modify: `.superpowers/sdd/2026-11-10-theme-selector-popover/progress.md`

- [x] Run `make verify`, `make fmt-check`, and `git diff --check`.
- [x] Review the final diff for unchanged side-panel behavior and no unintended overflow changes.
