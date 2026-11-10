# Codex-style artifact Skills and icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Ruxex artifact workflows into Codex-style Skills and render their optional icons throughout the Tauri UI.

**Architecture:** Keep one `ruxex-artifacts` plugin and one bundled runtime, but expose four independently named Skill directories. Add a small `SkillIcon` React component backed by the existing native local-asset boundary; all Skill surfaces reuse it and fall back to the current generic Skill icon.

**Tech Stack:** Rust/Tauri 2, React 19, TypeScript, Vitest, Python contract tests, YAML Skill metadata.

**Spec:** `docs/superpowers/specs/2026-11-10-codex-artifact-skills-icons-design.md`

## Global Constraints

- Use the exact Skill names `documents`, `presentations`, `spreadsheets`, and `pdf`.
- Keep `ruxex-artifacts` as the shared command/runtime and plugin package.
- Use `agents/ruxex.yaml` metadata; icon paths remain optional and are not
  bundled for the four artifact Skills yet.
- Read local icons through a root-constrained native boundary; never use browser `file:` URLs.
- Preserve the existing product-hidden Skill filtering and disabled-skill Composer filtering.

## Review Focus

- A Skill with only `iconLarge` still gets an icon through the fallback path (Task 2).
- A custom data-home icon path cannot escape allowed roots or bypass SVG/image validation (Task 2).
- Browser tests and browser runtime remain functional when Tauri IPC is unavailable (Task 2).
- The four Skill contracts do not accidentally retain the old combined Skill name or cross-format instructions (Task 1).
- Plugin detail `SkillSummary` and App Server `SkillMetadata` both satisfy the shared icon component contract (Task 2).

### Task 1: Split the artifact plugin Skills

**Files:**
- Create: `plugins/ruxex-artifacts/skills/{documents,presentations,spreadsheets,pdf}/SKILL.md`
- Create: `plugins/ruxex-artifacts/skills/{documents,presentations,spreadsheets,pdf}/agents/ruxex.yaml`
- Modify: `plugins/ruxex-artifacts/tests/skill_contract_test.py`
- Modify: `plugins/ruxex-artifacts/README.md`

**Interfaces:**
- Produces Skill names `documents`, `presentations`, `spreadsheets`, and `pdf`.
- Each Skill invokes the shared `ruxex-artifacts` command and documents only its format family.

- [x] Add failing contract tests for the four Skill directories, names, metadata, absence of bundled icon files, and format-specific commands.
- [x] Run the plugin contract test and confirm it fails because the four directories do not exist.
- [x] Add the four Codex-style Skill documents and metadata; remove the old combined Skill directory and bundled icon files.
- [x] Update the README to describe the plugin as a shared runtime with four Skills.
- [x] Run `python3 -m unittest plugins/ruxex-artifacts/tests/skill_contract_test.py -v` and confirm it passes.

### Task 2: Render Skill interface icons safely in the Tauri UI

**Files:**
- Create: `src/components/common/SkillIcon.tsx`
- Create: `src/components/common/SkillIcon.test.tsx`
- Modify: `src/components/conversation/SlashCommandPalette.tsx`
- Modify: `src/components/conversation/SlashCommandPalette.test.tsx`
- Modify: `src/components/conversation/Composer.tsx`
- Modify: `src/pages/CapabilitiesPage.tsx`
- Modify: `src/pages/PluginDetailPage.tsx`
- Modify: relevant component tests
- Modify: `src-tauri/src/desktop.rs` only if the existing local asset boundary needs a Skill-specific root check

**Interfaces:**
- `SkillIcon` accepts `{ name: string; interface?: v2.SkillInterface | null; className?: string }`.
- It prefers `iconSmall`, then `iconLarge`, then corresponding approved URL fields, and falls back to `SparklesIcon`.

- [x] Add failing component tests for local icon rendering, large-icon fallback, iconless fallback, and browser-safe failure behavior.
- [x] Run the focused Vitest files and confirm they fail because `SkillIcon` and its consumers are absent.
- [x] Implement the shared icon component using the existing validated local asset loader and add it to all Skill surfaces.
- [x] Add native validation only if current skill asset paths are not covered by the existing allowed roots.
- [x] Run focused Vitest and full `make check-tests`.

### Task 3: Verify and review

**Files:**
- Modify: `.superpowers/sdd/2026-11-10-codex-artifact-skills-icons/progress.md`

- [x] Run plugin contract tests, `make rust-test`, `make check-tests`, `make fmt-check`, and `make build`.
- [x] Run `git diff --check` and inspect that `.wdio` generated artifacts remain uncommitted.
- [x] Record any unrelated failures and complete a self-review of the split names, icon paths, and security boundary.
