# Codex-compatible Artifact Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current LLM-facing JSON-only spreadsheet command with a Ruxex-owned JavaScript workbook API backed by the bundled Rust XLSX engine, closely matching Codex's Spreadsheet authoring experience without redistributing OpenAI artifacts.

**Architecture:** `ruxex-artifacts` remains the stable agent command but becomes a Rust launcher for a bundled Node.js runtime and Ruxex-owned JS SDK. The SDK exposes `Workbook`, `Worksheet`, and `Range` concepts and communicates with a private versioned JSON protocol to `ruxex-artifacts-engine`, which owns local XLSX I/O and diagnostics. The App Server and generated protocol remain untouched.

**Tech Stack:** JavaScript ESM, bundled Node.js, Node built-in test runner, Rust, `rust_xlsxwriter`, `calamine`, `serde_json`, Python staging tests, Markdown Skill.

**Spec:** `docs/superpowers/specs/2026-11-08-codex-compatible-artifact-tool-design.md`

## Global Constraints

- Do not redistribute `@oai/artifact-tool` or copy its implementation.
- The user must not install Node.js, npm packages, Excel, or spreadsheet libraries.
- The stable agent-facing command is `ruxex-artifacts` in `ruxex-path`.
- The JS API is Ruxex-owned and may expose only supported operations.
- The private engine protocol is versioned JSON and is not an App Server protocol.
- All file paths are explicit and remain under the existing sandbox/approval model.
- Unsupported workbook operations must fail with structured diagnostics; never silently discard them.
- Do not modify App Server code, generated protocol types, or host process contracts.

## Review Focus

- A staged package missing Node.js, the JS SDK, or the private engine must fail validation rather than fall back to host tools — owned by staging tests.
- A builder attempting to import a host-installed package must fail or be prevented by the launcher — owned by launcher/Skill contract tests.
- A malformed or version-mismatched engine request must return a structured error and non-zero status — owned by engine protocol tests.
- A range outside the supported A1 syntax must fail explicitly — owned by JS SDK tests.
- A generated workbook must be inspected and validated after export, with the output path reported — owned by the Skill integration test.

### Task 1: Split the Rust engine from the agent launcher

**Files:**
- Create: `src-tauri/src/bin/ruxex-artifacts-engine.rs`
- Modify: `src-tauri/src/bin/ruxex-artifacts.rs`
- Modify: `src-tauri/src/artifacts.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tests/artifact_cli.rs`

**Interfaces:**
- Produces a private engine binary named `ruxex-artifacts-engine`.
- The engine accepts `--json-stdio` and reads one JSON request from stdin:
  `{"version":1,"operation":"create|read|validate","input":...,"output":...}`.
- The engine writes one JSON response to stdout and diagnostics to stderr, then exits non-zero on failure.
- The public `ruxex-artifacts` binary resolves package-relative resources and launches the bundled Node runtime for `run <builder.mjs>`.
- Existing `capabilities` and direct XLSX commands remain available as compatibility/development commands until the JS facade owns the Skill path.

- [ ] **Step 1: Write failing Rust tests** for the versioned JSON-stdio engine protocol, launcher resource resolution, and the missing bundled-runtime diagnostic.
- [ ] **Step 2: Run the focused Rust tests** and confirm they fail because the engine binary and launcher mode do not exist.
- [ ] **Step 3: Implement the engine protocol** by extracting the current XLSX operations behind `run_engine_stdio` and preserving structured error codes.
- [ ] **Step 4: Implement the launcher** so it uses only package-relative `ruxex-resources/node` and `ruxex-resources/ruxex-artifact-tool`; never invoke host `node` or `npm`.
- [ ] **Step 5: Run `cargo test --locked --manifest-path src-tauri/Cargo.toml --test artifact_cli`** and confirm the protocol and compatibility tests pass.
- [ ] **Step 6: Run `cargo fmt --all -- --check`**.

### Task 2: Add the Ruxex-owned JavaScript workbook facade

**Files:**
- Create: `artifact-tool/package.json`
- Create: `artifact-tool/src/index.mjs`
- Create: `artifact-tool/src/engine-client.mjs`
- Create: `artifact-tool/src/a1-range.mjs`
- Create: `artifact-tool/tests/workbook.test.mjs`
- Modify: `src-tauri/src/artifacts.rs`

**Interfaces:**
- `Workbook.create()` returns an in-memory workbook facade.
- `Workbook.load(inputPath)` loads supported scalar workbook data through the engine.
- `workbook.worksheets.add(name)` returns a `Worksheet`.
- `workbook.worksheets.getItem(name)` returns a `Worksheet` or throws a structured not-found error.
- `worksheet.getRange("A1:C4")` returns a `Range`.
- `range.values` reads/writes scalar matrices; `range.formulas` is reserved for the explicitly supported formula subset.
- `workbook.recalculate()` returns a deterministic result and rejects unsupported formulas rather than claiming recalculation.
- `workbook.inspect(options)` returns structured sheet/dimension diagnostics.
- `workbook.exportXlsx(outputPath)` invokes the private engine and writes the requested file.
- `workbook.render(options)` is exposed only when the bundled renderer is present; otherwise it returns a structured `unsupported_operation` diagnostic.

- [ ] **Step 1: Write failing Node tests** for workbook creation, worksheet/range value assignment, A1 validation, export/read round-trip through the Rust engine, inspection, and explicit unsupported-operation errors.
- [ ] **Step 2: Run `node --test artifact-tool/tests/workbook.test.mjs`** with the repository's bundled Node path and confirm the tests fail because the SDK modules do not exist.
- [ ] **Step 3: Implement the A1 parser** with bounded row/column indices and deterministic invalid-range errors.
- [ ] **Step 4: Implement the workbook facade** as an operation model that converts JS mutations into the versioned engine request without exposing the private protocol to Skill authors.
- [ ] **Step 5: Implement engine-client process handling** with package-relative executable discovery, bounded stdout/stderr, exit-code propagation, and JSON diagnostics.
- [ ] **Step 6: Run the Node tests** and confirm all facade behavior passes against the real Rust engine.

### Task 3: Package the runtime and rewrite the Spreadsheet Skill

**Files:**
- Modify: `scripts/stage-ruxex-package.py`
- Modify: `scripts/test_stage_ruxex_package.py`
- Modify: `plugins/ruxex-artifacts/skills/ruxex-artifacts/SKILL.md`
- Modify: `plugins/ruxex-artifacts/tests/skill_contract_test.py`
- Modify: `plugins/ruxex-artifacts/README.md`
- Modify: `README.md`

**Interfaces:**
- Staging accepts `--node-runtime`, `--artifact-sdk`, and `--artifact-engine`.
- Staging copies the runtime to `ruxex-resources/node`, the SDK to `ruxex-resources/ruxex-artifact-tool`, and the engine to `ruxex-path/ruxex-artifacts-engine`.
- Package validation requires the launcher, engine, Node executable, SDK entrypoint, and existing `rg`/sandbox files.
- The Skill tells the model to create a `.mjs` builder using `Workbook`, call `recalculate`, call `inspect`, export the workbook, then validate/report the output path.
- The Skill does not mention or require `@oai/artifact-tool`, host Node/npm, or user-installed spreadsheet libraries.

- [ ] **Step 1: Extend staging and Skill contract tests first** for the new runtime layout, missing-resource failures, JS API examples, inspect/export workflow, and absence of host dependency instructions.
- [ ] **Step 2: Run `python3 -m unittest scripts/test_stage_ruxex_package.py plugins/ruxex-artifacts/tests/skill_contract_test.py -v`** and confirm the new assertions fail.
- [ ] **Step 3: Update staging** to copy and validate the runtime directory, SDK files, private engine, and platform-specific Node executable while preserving the existing manifest semantics.
- [ ] **Step 4: Rewrite the Skill and README** around the Ruxex-owned workbook API and explicit create/recalculate/inspect/export/validate workflow.
- [ ] **Step 5: Run the focused Python tests** and confirm all staging and Skill tests pass.

### Task 4: Integrated verification and boundary review

**Files:**
- Modify: `docs/superpowers/specs/2026-11-08-codex-compatible-artifact-tool-design.md` only if implementation decisions materially change the approved design.
- Modify: `docs/superpowers/plans/2026-11-08-codex-compatible-artifact-tool.md` to record verified task results.

**Interfaces:**
- The shipped command remains discoverable through `ruxex-path`.
- No changed file may be under App Server or generated protocol implementation paths.

- [ ] **Step 1: Build both Rust binaries** with `cargo build --locked --manifest-path src-tauri/Cargo.toml --bin ruxex-artifacts --bin ruxex-artifacts-engine`.
- [ ] **Step 2: Run `make rust-test` and the Node facade test suite** with the bundled Node executable.
- [ ] **Step 3: Run the focused staging and Skill tests, then `git diff --check`.**
- [ ] **Step 4: Run `make package-test` and record any unrelated pre-existing failures without changing them.**
- [ ] **Step 5: Inspect all tracked and untracked changed paths for App Server/protocol modifications and document the result.**
