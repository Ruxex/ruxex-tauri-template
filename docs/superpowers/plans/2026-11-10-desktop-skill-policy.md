# Desktop Skill Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Inject provider-specific disabled Skills through `DesktopConfig` and use that same policy for App Server enforcement and Tauri UI visibility.

**Architecture:** Rust owns a deduplicated `SkillPolicy` in the Tauri composition root. The common App Server client applies one config edit per restricted Skill in both daemon and in-process modes, while a serializable UI projection is returned by a Tauri command and consumed by the Skills page.

**Tech Stack:** Rust 2024, Tauri 2, Serde, Ruxex App Server, React 19, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-desktop-skill-policy-design.md`

## Global Constraints

- The Rust `DesktopConfig` policy is the single source of product-owned Skill restrictions.
- UI visibility must be based on the Tauri command result, not `skills/list.enabled`.
- User Skill rules unrelated to the product-disabled names must remain intact.
- Use the repository Makefile for verification and preserve unrelated working-tree changes.

## Review Focus

- Duplicate policy entries: one Skill name must produce one effective disabled rule and one UI entry.
- Empty source groups: groups whose Skills are all hidden must not render as empty sections.
- Browser runtime: frontend tests and Vite must not require Tauri IPC.
- In-process parity: the same Skill override must reach in-process config loading as daemon startup.
- Existing toggles: visible Skills must retain App Server-provided enabled state and mutation behavior.

### Task 1: Add the Rust Skill policy and native bridge

**Files:**
- Modify: `src-tauri/src/desktop_config.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/app_server.rs`
- Test: `src-tauri/src/desktop_config.rs`
- Test: `src-tauri/src/app_server.rs`

**Interfaces:**
- `DesktopConfigBuilder::disable_skill(name)` adds a product restriction.
- `SkillPolicy` exposes `ui_policy()` and parsed Ruxex config overrides.
- `get_desktop_ui_policy` returns `{ hiddenSkills: string[] }` through Tauri IPC.

- [x] Write failing Rust tests for policy deduplication, UI serialization, and generated `skills.config` disable rules.
- [x] Run `make rust-test` and confirm the new tests fail because the policy and command are absent.
- [x] Implement `SkillPolicy`, add it to `DesktopConfig`, and expose its UI projection through `get_desktop_ui_policy`.
- [x] Apply the policy-generated `skills/config/write` edits through the common App Server client after connection.
- [x] Run the focused Rust tests and confirm they pass.

### Task 2: Add the frontend bridge and filter restricted Skills

**Files:**
- Create: `src/platform/skill-policy.ts`
- Create: `src/platform/skill-policy.test.ts`
- Modify: `src/pages/CapabilitiesPage.tsx`
- Modify: `src/pages/CapabilitiesPage.test.tsx`

**Interfaces:**
- `getDesktopUiPolicy(): Promise<DesktopUiPolicy>` invokes `get_desktop_ui_policy`.
- `CapabilitiesPage` hides Skill entries named in `hiddenSkills` without consulting App Server enablement as a visibility source.

- [x] Write failing TypeScript tests for the exact command, hidden Skill/group behavior, and disabled slash candidates.
- [x] Run the focused Vitest files and confirm they fail because the bridge/filter is absent.
- [x] Implement the cached bridge, filter empty source groups, and exclude disabled Skills from Composer slash candidates.
- [x] Run the focused Vitest files and confirm they pass.

### Task 3: Verify the complete change

**Files:**
- Modify: `docs/superpowers/specs/2026-11-10-desktop-skill-policy-design.md` only if implementation details require clarification.

- [x] Run `make check-tests`.
- [x] Run `make rust-test`.
- [x] Run `make verify` when supported by the environment; record unrelated failures.
- [x] Run `git diff --check` and inspect the final diff for unrelated changes.
