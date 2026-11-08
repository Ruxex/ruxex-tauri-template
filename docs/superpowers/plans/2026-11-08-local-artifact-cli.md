# Local Artifact CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle a Rust `ruxex-artifacts` CLI that an agent can invoke from a Skill to create, read, and validate XLSX files without user-installed libraries.

**Architecture:** The CLI is a Tauri-side Rust binary. The runtime staging script places it in `ruxex-path`, which the existing agent command environment prepends to `PATH`. A portable plugin Skill documents the command contract; App Server and protocol code remain unchanged.

**Tech Stack:** Rust, `rust_xlsxwriter`, `calamine`, `serde`, `serde_json`, Python staging tests, Markdown Skill package.

**Spec:** `docs/superpowers/specs/2026-11-08-artifact-cli-design.md`

## Global Constraints

- Do not modify App Server code or generated protocol types.
- Do not require Python, Excel, or user-installed format libraries.
- Keep stdout machine-readable JSON for supported commands.
- Use the existing `ruxex-path` runtime PATH prepend.
- Do not add an in-app artifact viewer in this change.

## Review Focus

- Malformed input JSON must fail with a non-zero exit code and structured stderr diagnostics — owned by the CLI parser tests.
- Unsupported cell values must not be silently coerced — owned by XLSX conversion tests.
- Existing XLSX files with multiple sheets must be readable and report dimensions — owned by read/validate tests.
- A staged runtime missing the helper must fail package validation — owned by staging tests.
- The Skill must tell the agent to validate generated files and must not assume Python is installed — owned by Skill fixture checks.

### Task 1: Rust artifact command core

**Files:**
- Create: `src-tauri/src/artifacts.rs`
- Create: `src-tauri/src/bin/ruxex-artifacts.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `Cargo.lock`

**Interfaces:**
- Produces `ruxex_desktop_lib::artifacts::run_cli(args: impl IntoIterator<Item = OsString>) -> ExitCode`.
- Supports `capabilities`, `xlsx create`, `xlsx read`, and `xlsx validate`.
- Uses JSON input `{ "sheets": [{ "name": string, "rows": [[scalar|null]] }] }`.

- [ ] **Step 1: Write failing unit tests** for capabilities output, malformed JSON, XLSX create/read round-trip, validation dimensions, and unsupported values.
- [ ] **Step 2: Run the focused Rust tests** and confirm they fail because the artifact module and binary do not exist.
- [ ] **Step 3: Add the minimal Rust implementation** with explicit argument parsing, structured JSON stdout/stderr, XLSX writing via `rust_xlsxwriter`, and XLSX reading via `calamine`.
- [ ] **Step 4: Run the focused Rust tests** and confirm they pass.
- [ ] **Step 5: Run `cargo fmt --check` for changed Rust files** and fix formatting without changing behavior.

### Task 2: Runtime package staging

**Files:**
- Modify: `scripts/stage-ruxex-package.py`
- Modify: `scripts/test_stage_ruxex_package.py`
- Modify: `README.md`

**Interfaces:**
- `stage-ruxex-package.py --artifact-tools <path>` copies the executable to `ruxex-path/ruxex-artifacts`.
- Package validation requires the helper alongside `rg`.

- [ ] **Step 1: Extend staging tests first** to require the artifact helper in the staged layout and to reject packages that omit it.
- [ ] **Step 2: Run `python3 -m unittest scripts/test_stage_ruxex_package.py -v`** and confirm the new assertions fail.
- [ ] **Step 3: Update staging and validation** to copy and require `ruxex-artifacts`, preserving existing manifest semantics.
- [ ] **Step 4: Update README staging instructions** with the new argument and PATH-visible command.
- [ ] **Step 5: Run the staging test suite** and confirm all tests pass.

### Task 3: Agent-facing Skill package

**Files:**
- Create: `plugins/ruxex-artifacts/.ruxex-plugin/plugin.json`
- Create: `plugins/ruxex-artifacts/skills/ruxex-artifacts/SKILL.md`
- Create: `plugins/ruxex-artifacts/README.md`
- Create: `plugins/ruxex-artifacts/tests/skill_contract_test.py`

**Interfaces:**
- The Skill invokes only the stable `ruxex-artifacts` command.
- The Skill requires a post-generation `xlsx validate` call.
- The Skill does not invoke `python`, `pip`, `npm`, or Excel.

- [ ] **Step 1: Write failing Skill contract tests** for the manifest, command name, validation step, and absence of user-runtime installation instructions.
- [ ] **Step 2: Run the Skill contract tests** and confirm they fail because the package does not exist.
- [ ] **Step 3: Add the plugin manifest, Skill instructions, and package README** with the XLSX input schema and command examples.
- [ ] **Step 4: Run the Skill contract tests** and confirm they pass.

### Task 4: Integrated verification

**Files:**
- Modify: `Makefile` only if a dedicated helper build/test target is needed.

- [ ] **Step 1: Build the CLI with `cargo build --locked --manifest-path src-tauri/Cargo.toml --bin ruxex-artifacts`**.
- [ ] **Step 2: Run `make rust-test` and `make package-test`**.
- [ ] **Step 3: Run `make check-tests`** to verify the frontend remains unaffected.
- [ ] **Step 4: Run `git diff --check` and inspect the final diff for protocol/App Server changes.
