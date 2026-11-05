# Quick Panel Settings and Plugin Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the quick panel discoverable and configurable from General settings, improve the plugin marketplace layout, and show an intentional placeholder for missing plugin images.

**Architecture:** Rust owns the quick-panel shortcut's persisted value and native registration lifecycle. React calls typed Tauri commands from the General settings page. Plugin layout stays in the existing Capabilities page, using DaisyUI disclosure classes and the existing safe marketplace image loader.

**Tech Stack:** Tauri 2 / Rust, React 19, TypeScript, Vitest, Testing Library, Tailwind/DaisyUI, existing Tauri global-shortcut plugin.

**Spec:** `docs/superpowers/specs/2026-11-05-settings-quick-panel-plugin-layout-design.md`

## Constraints

- Do not change the App Server or generated protocol.
- Do not add a second persisted shortcut source to `ui-preferences.ts`.
- Preserve existing user modifications in `README.md` and untracked documentation/assets.
- Use `make rust-test` for Rust tests and `make check-tests`/direct equivalent for frontend checks.
- Use `apply_patch` for source edits.

## File Map

- `src-tauri/src/quick_panel.rs`: persisted shortcut model, native read/update commands, registration helpers, rollback tests.
- `src-tauri/src/lib.rs`: startup registration and command registration; handler uses active shortcut.
- `src/platform/native.ts`: frontend wrappers for read/update shortcut commands.
- `src/pages/SettingsOverviewPage.tsx`: load and edit quick-panel shortcut in General.
- `src/components/settings/SettingsCards.tsx`: reusable QuickPanelCard presentation.
- `src/pages/SettingsOverviewPage.test.tsx` / `src/components/settings/SettingsCards.test.tsx`: settings behavior and card rendering tests.
- `src/pages/CapabilitiesPage.tsx`: two-column plugin cards and DaisyUI collapse disclosures.
- `src/pages/CapabilitiesPage.test.tsx`: layout/disclosure and null-image integration coverage.
- `src/components/plugins/MarketplaceAssetImage.tsx`: image-placeholder rendering.
- `src/components/plugins/MarketplaceAssetImage.test.tsx`: loading, success, and missing-source placeholder coverage.

## Task 1: Native shortcut persistence and registration

1. Add failing Rust tests for default shortcut, persisted read fallback, update success, and update rollback when registration fails.
2. Run the focused Rust tests and verify they fail because the native preference commands do not exist.
3. Implement a small JSON preference document in the Tauri app data directory, with a default fallback and atomic-ish write through a temporary file/rename or the existing safe filesystem pattern.
4. Implement helpers to read the current shortcut, unregister/register through `GlobalShortcutExt`, and preserve the old registration/value if a new registration fails.
5. Add `quick_panel_shortcut_read` and `quick_panel_shortcut_update` commands and register them in `lib.rs`.
6. Change startup and the global shortcut handler to use the stored shortcut while retaining `CmdOrCtrl+Shift+Space` as the default.
7. Run `make rust-test` and `git diff --check`.
8. Commit as `feat(desktop): persist quick panel shortcut`.

## Task 2: General settings UI

1. Add failing frontend tests for loading the native shortcut, saving a new shortcut, resetting to the default, disabling controls while pending, and displaying native command errors.
2. Run the focused tests and verify they fail.
3. Add `readQuickPanelShortcut` and `updateQuickPanelShortcut` wrappers in `src/platform/native.ts`.
4. Add a `QuickPanelCard` to the General page. Keep the value local to the form, call the native update command only on Save/Reset, refresh after success, and show errors inline.
5. Keep `SettingsOverviewPage` test setup compatible with existing provider/UI preference tests.
6. Run focused tests, TypeScript, Biome, ESLint, and `git diff --check`.
7. Commit as `feat(settings): configure quick panel shortcut`.

## Task 3: Plugin layout and disclosure controls

1. Add failing capability tests asserting plugin cards gain a wide-screen two-column grid and marketplace/category disclosures use DaisyUI `collapse` classes with independent toggles.
2. Run the focused capability tests and verify they fail.
3. Replace the plugin marketplace/category `<details>` presentation with DaisyUI-compatible collapse markup while keeping native disclosure semantics and independent open state.
4. Add a responsive `lg:grid-cols-2` grid around each category's plugin cards.
5. Run focused tests, TypeScript, Biome, ESLint, and `git diff --check`.
6. Commit as `feat(ui): improve plugin marketplace layout`.

## Task 4: Missing plugin image placeholder

1. Add failing image-component tests for null source and complete asset-load failure, asserting a non-spinner accessible image placeholder is rendered.
2. Run the focused image tests and verify they fail.
3. Add a Heroicons image icon placeholder with an accessible label and keep the spinner only while a supplied source is being resolved.
4. Preserve the existing light/dark source selection and safe native asset-loading boundary.
5. Add/adjust Capabilities integration coverage for plugins whose App Server interface has no image fields.
6. Run the full frontend suite, TypeScript, Biome, ESLint, Vite build, `make rust-test`, and `git diff --check`.
7. Commit as `fix(ui): show plugin image placeholders`.

## Final Verification

- Run the supported checks, including `make verify` where the environment permits it.
- If the pnpm wrapper fails before tests because of the pre-existing ignored `esbuild` build script, run and report the direct pinned-tool equivalents.
- Inspect `git status --short` and ensure unrelated user changes remain untouched.
- Perform a read-only final code review against the spec and plan before reporting completion.
