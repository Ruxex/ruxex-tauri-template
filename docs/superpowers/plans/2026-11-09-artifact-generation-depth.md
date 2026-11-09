# Local Artifact Generation Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a useful, bundled Excel authoring layer with formulas, bounded recalculation, formatting, merged ranges, column widths, tables, and charts while preserving the existing Ruxex artifact boundary.

**Architecture:** Keep `Workbook` and `Range` as the JavaScript authoring model, storing formulas and metadata alongside scalar values. Extend the private JS-to-Rust engine request with optional metadata and let `rust_xlsxwriter` serialize it. Keep the AppServer/protocol/Tauri command surface unchanged.

**Tech Stack:** Node.js ESM, `node:test`, Rust 2024, `rust_xlsxwriter 0.92`, `calamine 0.31`, serde/serde_json, existing bundled runtime.

**Spec:** `docs/superpowers/specs/2026-11-09-artifact-generation-depth-design.md`

## Global Constraints

- Runtime dependencies remain bundled; users must not install Office, Node.js, Python, or spreadsheet libraries.
- AppServer, generated protocol types, and Tauri command contracts are not changed.
- The private artifact engine protocol remains versioned and machine-readable.
- Formula evaluation is bounded to the documented supported subset and never executes arbitrary code.
- Unsupported values and operations return structured diagnostics instead of being silently discarded.
- Existing scalar XLSX create/read/validate behavior remains valid.

## Review Focus

- A formula write must remain a formula in the exported XLSX while exposing a deterministic cached value for supported formulas — Tasks 1 and 2.
- Updating values or formulas must not leave stale formula metadata behind — Task 2.
- Format and object references must be validated before native serialization — Task 1.
- Existing scalar rows and the current engine CLI must continue to round-trip — Task 3.
- Unsupported formulas/format fields must be reported explicitly and must not execute code — Tasks 1 and 2.

---

### Task 1: Extend the Rust XLSX engine model and serializer

**Files:**
- Modify: `src-tauri/src/artifacts.rs`
- Modify: `src-tauri/tests/artifact_cli.rs`
- Modify: `src-tauri/Cargo.toml` only if a locked dependency is truly required

**Interfaces:**
- Consumes: existing version-1 engine requests with scalar `sheets[].rows`.
- Produces: version-1 requests with optional formulas, formats, merges, column widths, tables, and charts; existing requests remain valid.

**Steps:**

- [ ] Add failing Rust tests for formula cells, basic format fields, merged ranges, column widths, table definitions, chart definitions, and invalid metadata.
- [ ] Run the focused Rust artifact tests and confirm the new assertions fail before implementation.
- [ ] Extend the serde input model with optional metadata types and strict validation helpers.
- [ ] Map values and formulas to `rust_xlsxwriter` writes, using cached formula results when supplied and enabling recalculation when they are not.
- [ ] Map the supported format subset, merged ranges, column widths, tables, and column charts to native APIs.
- [ ] Return formula counts, evaluated/unsupported counts, and created object summaries in the engine response.
- [ ] Run focused and full Rust tests; commit the engine changes.

**Expected:** New engine tests pass, old artifact CLI tests pass, and invalid metadata produces stable `invalid_*` or `unsupported_*` diagnostics.

### Task 2: Add the JavaScript workbook model and bounded formula evaluator

**Files:**
- Create: `artifact-tool/src/formula-engine.mjs`
- Modify: `artifact-tool/src/workbook.mjs`
- Modify: `artifact-tool/src/spreadsheet-file.mjs` if serialization validation needs a public-facing change
- Modify: `artifact-tool/tests/workbook.test.mjs`
- Modify: `artifact-tool/tests/compatibility-facade.test.mjs`

**Interfaces:**
- Consumes: the engine metadata contract from Task 1.
- Produces: `range.formulas`, `range.format`, `range.merge()`, column width support, worksheet tables/charts collections, and a structured `Workbook.recalculate()` result.

**Steps:**

- [ ] Add failing Node tests for supported formulas (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `IF`, cell/range references, and arithmetic), formula reads, format writes, merges, widths, tables, and charts.
- [ ] Add failing tests for stale formula clearing, circular references, unsupported functions, malformed colors, and invalid object ranges.
- [ ] Run the focused Node tests and confirm they fail for the current unsupported accessors.
- [ ] Implement a bounded tokenizer/parser/evaluator with cell and range reference resolution, recursion/cycle detection, and structured errors.
- [ ] Store formula matrices, format records, merges, widths, tables, and charts on worksheets; clear conflicting metadata when values replace formulas.
- [ ] Make `recalculate()` update cached values and return `{ ok, formulas, evaluated, unsupported }`.
- [ ] Serialize the metadata through `exportWorkbookXlsx` and preserve the current public file facade.
- [ ] Run focused and full artifact Node tests; commit the JS model and evaluator.

**Expected:** The public JS API can create and inspect supported rich workbooks without using the private engine protocol directly.

### Task 3: Update the bundled Skill, smoke builder, and verification coverage

**Files:**
- Modify: `plugins/ruxex-artifacts/skills/ruxex-artifacts/SKILL.md`
- Modify: `plugins/ruxex-artifacts/README.md`
- Modify: `artifact-tool/tests/fixtures/smoke-builder.mjs`
- Modify: `scripts/test_stage_ruxex_package.py` or skill contract tests only if the new contract requires it

**Interfaces:**
- Consumes: the public workbook API from Task 2.
- Produces: examples and smoke coverage that teach the model to recalculate, inspect, export, and validate rich XLSX artifacts.

**Steps:**

- [ ] Add a smoke workbook containing a formula, header format, merged title, column width, table, and chart.
- [ ] Update the Skill to document the supported formula subset, formatting, object APIs, recalculate result, and explicit unsupported behavior.
- [ ] Run the staged runtime smoke builder and validate the generated XLSX with the bundled CLI.
- [ ] Run artifact Node tests, staging/skill contract tests, frontend tests, typecheck, build, and Rust tests.
- [ ] Commit the Skill and smoke updates.

**Expected:** A clean bundled runtime can generate and validate a rich workbook without host dependencies.

### Task 4: Final review and integration

**Files:**
- Review only: plan-range diff and worktree state

**Steps:**

- [ ] Review the complete plan-range diff for AppServer/protocol/Tauri scope leaks, stale public API examples, unsafe formula evaluation, and metadata loss.
- [ ] Run final verification after the last commit.
- [ ] Push the committed branch to its configured remote only after the final verification is green.
- [ ] Report commit hashes, pushed branch, supported feature set, and known remaining gaps before preview work begins.

