# Codex-local spreadsheet feature parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Ruxex's local spreadsheet authoring and analysis surface close to Codex's documented local Excel workflow, excluding Google Sheets and OpenAI backend/live-app dependencies.

**Architecture:** Keep the Ruxex-owned JS workbook facade and shared versioned runtime as the only public authoring path. Extend the Rust XLSX engine and JS model in focused modules, add focused helpers only for stable repeated workflows, and preserve unknown OOXML parts or refuse lossy export.

**Tech Stack:** Rust 2024, `calamine`, `rust_xlsxwriter`, ZIP/OOXML handling, bundled Node.js ESM, bundled Python/native runtime as needed, Node built-in tests, Rust tests, Python staging tests, Markdown Skill references.

**Spec:** `docs/superpowers/specs/2026-11-20-codex-spreadsheet-feature-parity-design.md`

## Global Constraints

- Do not redistribute or copy `@oai/artifact-tool` or its implementation.
- Do not require user-installed Python, Node.js, npm packages, Excel, or Office.
- Exclude Google Sheets, Codex live Excel control, and OpenAI-hosted/backend-only features.
- Keep a single Ruxex workbook operation model; helpers call that model instead of introducing another XLSX implementation.
- Preserve unsupported native workbook parts, or refuse a lossy export before writing.
- Report formula text, formula evaluation, cached results, and native sensitivity results as distinct states.
- Preserve all unrelated pre-existing worktree changes; do not reset or rewrite history.
- Use repository-supported Makefile verification entrypoints; do not invoke Cargo or build scripts directly.

## Review Focus

- Unsupported OOXML parts in edited workbooks: round-trip unchanged or reject export; cover with package-part preservation tests.
- Formulas with unsupported functions, errors, cycles, and cached values: do not claim successful calculation or clear valid cached values; cover with formula round-trip and recalculation tests.
- Invalid/large ranges, malformed metadata, and unsupported cell values: return bounded structured diagnostics; cover API and engine boundary tests.
- Data tables, conditional formatting, validation, drawings, and comments: reopen exported files and confirm the feature parts and references remain valid; cover real XLSX fixtures.
- Missing or mismatched bundled runtime dependencies: fail staging/launch without host fallback; cover package validation and launcher tests.

---

### Task 1: Codex-local capability inventory and API contract

**Files:**
- Create: `plugins/ruxex-artifacts/skills/spreadsheets/references/codex-parity.md`
- Create: `artifact-tool/tests/spreadsheet-capability-contract.test.mjs`
- Modify: `artifact-tool/src/index.mjs`
- Modify: `artifact-tool/src/workbook.mjs`

**Interfaces:**
- Produces a machine-readable `Workbook.capabilities()` and bounded `workbook.help(query)` surface with stable operation names, support status, and limitation text.
- The inventory explicitly separates create/read/edit/recalculate/render/export support and lists each unsupported capability.

- [ ] Add failing contract tests covering required capability identifiers and structured unsupported-feature results.
- [ ] Run the focused Node tests and confirm failures are caused by missing capability/help APIs.
- [ ] Implement the public capability/help contract without exposing private engine protocol details.
- [ ] Run focused tests and confirm the capability contract is complete for the subsequent tasks.

### Task 2: Workbook files, worksheets, ranges, and source formats

**Files:**
- Modify: `artifact-tool/src/workbook.mjs`
- Modify: `artifact-tool/src/spreadsheet-file.mjs`
- Modify: `artifact-tool/src/a1-range.mjs`
- Modify: `src-tauri/src/artifacts/xlsx.rs`
- Create: `src-tauri/src/artifacts/csv.rs` (if conversion logic is not appropriately placed in `xlsx.rs`)
- Modify: `artifact-tool/tests/workbook.test.mjs`
- Modify: `src-tauri/tests/artifact_cli.rs`

**Interfaces:**
- Add workbook/sheet selection, used-range queries, indexed ranges/cells, range resize/offset/row/column/current-region, copy, clear, fill-down, and fill-right operations.
- Add `Workbook.fromCSV` and CSV/TSV source import; support `.xls` source import through the bundled converter only when round-trip semantics are explicit.
- Keep `.xlsx` as the editable export format.

- [ ] Add failing JS and Rust tests for each newly exposed range/file operation and boundary error.
- [ ] Run focused JS and Rust test entrypoints and confirm intended failures.
- [ ] Implement operations by extending the existing facade/engine contracts and existing XLSX crates.
- [ ] Run focused tests and confirm import/export and range operations.

### Task 3: Formatting, worksheet layout, validation, and conditional formats

**Files:**
- Modify: `artifact-tool/src/workbook.mjs`
- Modify: `src-tauri/src/artifacts/xlsx.rs`
- Modify: `src-tauri/src/artifacts/ooxml.rs`
- Modify: `artifact-tool/tests/workbook.test.mjs`
- Modify: `src-tauri/tests/artifact_cli.rs`

**Interfaces:**
- Support the documented Codex-local formatting surface needed for font/fill/borders/alignment/number formats, row/column sizing and autofit, freeze panes, gridlines, and worksheet tab colors.
- Support data validation rules and conditional-format rule families using validated typed inputs.
- Invalid rules fail before export with structured diagnostics.

- [ ] Add failing tests for persisted formatting, worksheet layout, validation, and conditional-format parts.
- [ ] Run focused tests and confirm missing behavior.
- [ ] Implement model, validation, Rust XLSX serialization/import, and stable inspection metadata.
- [ ] Run tests and reopen generated workbooks through the engine to verify persisted rules.

### Task 4: Tables, PivotTables, charts, images, shapes, comments, notes, and sparklines

**Files:**
- Modify: `artifact-tool/src/workbook.mjs`
- Modify: `src-tauri/src/artifacts/xlsx.rs`
- Modify: `src-tauri/src/artifacts/ooxml.rs`
- Modify: `artifact-tool/tests/workbook.test.mjs`
- Modify: `src-tauri/tests/artifact_cli.rs`

**Interfaces:**
- Expand chart types/options to the Codex-local documented exportable subset; explicitly reject chart types that the selected writer cannot serialize.
- Add drawing APIs for embedded images/shapes, single-cell notes and threaded comments with an explicit author, and sparklines. Expose PivotTable operations only with clear export warnings where the Rust writer cannot preserve them reliably.
- Preserve and inspect table metadata and drawing bindings on import.

- [ ] Add failing round-trip tests for each object family and unsupported-object diagnostics.
- [ ] Run focused tests and confirm feature gaps.
- [ ] Implement objects through existing writer capabilities and bounded OOXML parts where required.
- [ ] Reopen outputs and verify relationships, positions, anchors, content, and data ranges.

### Task 5: Formula calculation, tracing, sensitivity, and iteration behavior

**Files:**
- Modify: `artifact-tool/src/formula-engine.mjs`
- Modify: `artifact-tool/src/workbook.mjs`
- Modify: `src-tauri/src/artifacts/xlsx.rs`
- Modify: `src-tauri/src/artifacts/ooxml.rs`
- Modify: `artifact-tool/tests/formula-engine.test.mjs`
- Modify: `artifact-tool/tests/workbook.test.mjs`
- Modify: `src-tauri/tests/artifact_cli.rs`

**Interfaces:**
- Add Codex-local formula coverage by category, including lookup/reference, math, statistical, text, date/time, logical, and financial families where supported by the local calculation engine.
- Add dependency tracing and two-variable What-If Data Tables with input validation and explicit iteration settings when the local engine can verify them.
- Keep unsupported formulas in the workbook while reporting their calculation state accurately.

- [ ] Add failing tests for formula families, cross-sheet/absolute references, lookup edge cases, error propagation, tracing, data tables, and iterative convergence.
- [ ] Run focused formula tests and confirm intended unsupported cases.
- [ ] Implement using the bundled local calculation engine or bounded formula evaluator; do not use a hosted backend or system Office.
- [ ] Verify input changes, boundaries, blank versus zero, errors, recalculation, and serialized cached values.

### Task 6: Safe import/edit/export fidelity

**Files:**
- Modify: `src-tauri/src/artifacts/xlsx.rs`
- Modify: `src-tauri/src/artifacts/ooxml.rs`
- Modify: `artifact-tool/src/spreadsheet-file.mjs`
- Modify: `artifact-tool/tests/workbook.test.mjs`
- Modify: `src-tauri/tests/artifact_cli.rs`

**Interfaces:**
- Imported workbooks retain raw unsupported OOXML parts and relationships for unchanged portions.
- Before export, the engine determines whether changes can be merged without invalidating preserved parts; unsafe edits return `lossy_export_refused` with affected feature names.
- Validate package integrity, references, and unsupported feature counts.

- [ ] Add failing fixtures containing unsupported OOXML parts, charts, images, styles, validations, and formula caches; assert preservation or pre-write refusal.
- [ ] Run focused round-trip tests and confirm current loss is detected.
- [ ] Implement preservation/merge behavior or precise refusal for each fixture class.
- [ ] Reopen exported files and compare untouched package parts and supported workbook state.

### Task 7: Inspection, rendering, read-only Q&A, and verification workflow

**Files:**
- Modify: `artifact-tool/src/workbook.mjs`
- Modify: `artifact-tool/src/engine-client.mjs`
- Modify: `src-tauri/src/artifacts/cli.rs`
- Modify: `src-tauri/src/artifacts/engine.rs`
- Modify: `plugins/ruxex-artifacts/skills/spreadsheets/workflows/verification.md`
- Modify: `plugins/ruxex-artifacts/skills/spreadsheets/references/read_only_qna.md`
- Create or modify: focused renderer/helper modules and their tests

**Interfaces:**
- Add bounded cell/range/formula/object inspection, formula error scans, trace output, and local rendered previews through bundled runtime resources.
- Preserve read-only behavior for Q&A requests and never export unless requested.
- Rendering errors and unavailable capabilities are reported explicitly.

- [ ] Add failing tests for bounded inspection, trace, formula scans, render output, and read-only no-write behavior.
- [ ] Run focused tests and confirm missing behavior.
- [ ] Implement local inspection/rendering via bundled resources and update workflow guidance.
- [ ] Verify previews and diagnostics against exported workbook fixtures.

### Task 8: Skill guidance and bundled package integration

**Files:**
- Modify: `plugins/ruxex-artifacts/skills/spreadsheets/SKILL.md`
- Modify/create focused spreadsheet references and feature guides.
- Modify: `plugins/ruxex-artifacts/tests/skill_contract_test.py`
- Modify: `scripts/stage-ruxex-package.py`
- Modify: `scripts/test_stage_ruxex_package.py`
- Modify: `plugins/ruxex-artifacts/skills/RUNTIME.md`
- Modify dependency locks only for a selected required package absent from the current shared runtime.

**Interfaces:**
- Route each Codex-local use case to a focused Ruxex guide and a supported API surface.
- Stage and validate every required executable/library with hashes and licenses; never fall back to user/system tools.
- Keep Google Sheets/OpenAI-only instructions out of Ruxex spreadsheet guidance.

- [ ] Add failing contract/staging tests for every capability mapping, runtime dependency, and excluded feature.
- [ ] Run focused tests and confirm intended failures.
- [ ] Update guides, runtime manifest validation, packaging, and third-party notices as needed.
- [ ] Run focused contract and package tests and inspect staged package contents.

### Task 9: Full verification and independent parity audit

**Files:**
- Modify: this plan to record verification evidence and any accepted limitations.

- [ ] Run `make rust-test`, the bundled Node artifact-tool suite, `make package-test`, and `git diff --check` using repository-supported commands.
- [ ] Stage a release-shaped runtime and exercise create, import, edit, recalculate, inspect, render, export, reopen, and validate without host runtime fallbacks.
- [ ] Spawn one independent subagent with this spec and the Codex-local capability inventory; request a read-only gap, regression, and packaging review.
- [ ] Verify every subagent finding against the actual diff and tests; fix confirmed in-scope defects, then rerun affected verification.
- [ ] Report verified support and any documented limitations; do not claim parity where the checklist or evaluator finds a gap.
