# Python-Free Presentations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Python execution and packaged Python helper scripts from the Presentations Skill while preserving its helper workflows through the Rust artifact CLI.

**Architecture:** Add presentation helper operations behind the existing `ruxex-artifacts pptx` command, using the Rust OOXML and image support. Update the Skill and its presentation-only references to document the Rust command contract, then remove Python helpers and their package/test registrations.

**Tech Stack:** Rust artifact CLI, serde_json, ZIP/OOXML utilities, image crate, Markdown skill docs.

**Spec:** `docs/superpowers/specs/2026-11-20-python-free-artifact-runtime-design.md` (Presentations and Shared runtime removal gate sections)

## Global Constraints

- Port all 12 helpers to `ruxex-artifacts pptx` subcommands while preserving JSON output and existing quality-gate semantics.
- Preserve unsupported PPTX package parts and relationships unless a command explicitly edits them.
- Replace Pillow contact-sheet generation with the Rust image crate.
- Keep slide rendering on the packaged LibreOffice/Poppler preview path.
- Do not edit Documents/Word Skill files or shared Python-runtime removal work in this task.

## Review Focus

- Malformed or incomplete PPTX ZIP/XML input returns a structured error and never modifies the source.
- Starter-deck output refuses overwrite and retains placeholders and unrelated package parts.
- Quality-gate JSON contracts preserve 1-based slide and zero-based object indexing, blanks, and tolerance semantics.
- Rendering and contact sheets use packaged native tools and preserve deterministic output ordering.
- Presentation Skill docs and package registrations contain no Python launcher command or Python helper path.

---

### Task 1: Rust presentation helper command contract

**Files:**
- Modify: `src-tauri/src/artifacts/cli.rs` (PPTX command dispatch only)
- Create: `src-tauri/src/artifacts/presentation_helpers.rs`
- Modify: `src-tauri/src/artifacts/mod.rs` (module registration only)
- Test: Rust artifact CLI unit/integration tests

**Interfaces:**
- Consumes: existing OOXML PPTX read/validation functions and packaged native runtime paths.
- Produces: `pptx helper <name> --...` operations for all 12 current helper behaviors, each returning the existing JSON report shape.

- [ ] Write CLI contract tests for all helper names, required flags, JSON output, invalid input, and overwrite behavior.
- [ ] Run the focused artifact CLI tests and confirm the new operations fail before implementation.
- [x] Implement helper dispatch and port template inventory/plan/fidelity, integrity/geometry reports, three declared quality gates, starter-deck editing, rendering, and contact-sheet generation.
- [ ] Run focused CLI tests and compare report fields with existing helper contracts.

### Task 2: Presentation Skill documentation and contracts

**Files:**
- Modify: `plugins/ruxex-artifacts/skills/presentations/SKILL.md`
- Modify: presentation references that currently name `.py` scripts or the Python launcher
- Test: presentation Skill contract tests

- [ ] Add a failing contract assertion that the Skill and its references describe only Rust helper commands and preserve the 12 workflow mappings.
- [ ] Run the contract test and confirm it fails against the existing Python instructions.
- [x] Update command examples, helper names, and limitations to match Task 1's CLI output and flags.
- [ ] Run the presentation Skill contract test.

### Task 3: Remove packaged Python helper files and registration

**Files:**
- Delete: `plugins/ruxex-artifacts/skills/presentations/scripts/*.py`
- Modify: presentation-specific package allowlists and tests
- Test: presentation helper CLI contracts, skill package staging contract

- [ ] Add a failing package contract asserting no presentation `.py` helper is staged and each documented Rust helper is available.
- [ ] Run the package contract and confirm it fails before removal/registration updates.
- [x] Remove the presentation Python helpers and update presentation package/tests without changing Documents-owned registrations.
- [ ] Run presentation CLI and package contract tests, then inspect staged presentation files for Python paths.
