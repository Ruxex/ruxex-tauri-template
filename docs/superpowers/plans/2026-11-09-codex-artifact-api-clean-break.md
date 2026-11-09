# Codex-shaped Artifact API Clean-break Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local artifact runtime use `SpreadsheetFile` and `PresentationFile` as the only XLSX/PPTX file boundaries while keeping the object models focused on in-memory editing.

**Architecture:** Extract workbook serialization/import into a dedicated workbook module and expose only `Workbook` from the package root. Keep serialization helpers module-private to the public package surface and let `SpreadsheetFile` create `ArtifactOutput` objects around them. Apply the same boundary to `Presentation`, retaining the existing shallow-import guard.

**Tech Stack:** Node.js ESM, `node:test`, existing Rust-backed artifact engine, PptxGenJS, bundled Ruxex artifact skill.

**Spec:** `docs/superpowers/specs/2026-11-09-codex-artifact-api-clean-break-design.md`

## Global Constraints

- Runtime dependencies remain bundled; users must not install Excel, Word, PowerPoint, or additional JavaScript packages.
- The implementation remains JavaScript plus the existing Rust-backed artifact engine where already used.
- Public methods must fail with structured `ArtifactToolError` diagnostics.
- Existing source files and tests outside the artifact runtime are preserved.
- AppServer, protocol, Tauri command, and UI files are not changed.
- The removed direct file-I/O aliases are not retained for backward compatibility.

## Review Focus

- `Workbook.create()` must return an object immediately, while import/export remain asynchronous at the file facade boundary — test in Task 1.
- The spreadsheet facade must still accept both paths and `FileBlob` values and preserve scalar cell data — test in Task 1.
- Invalid workbook/presentation values must fail through the same structured error codes after method removal — test in Tasks 1 and 3.
- Shallow PPTX imports must remain non-editable and non-exportable, preventing silent data loss — test in Task 3.
- No old direct API usage may remain in runtime, smoke builders, or skill docs — verify in Task 4.

---

### Task 1: Rewrite artifact tests around the canonical API

**Files:**
- Modify: `artifact-tool/tests/workbook.test.mjs`
- Modify: `artifact-tool/tests/document-presentation.test.mjs`
- Modify: `artifact-tool/tests/compatibility-facade.test.mjs`

**Interfaces:**
- Consumes: current `Workbook`, `SpreadsheetFile`, `Presentation`, and `PresentationFile` exports.
- Produces: failing tests that define synchronous workbook creation, facade-only XLSX/PPTX file I/O, and removal of direct aliases.

**Steps:**

- [ ] Change workbook tests to import `FileBlob`/`SpreadsheetFile`, call `Workbook.create()` without `await`, export through `SpreadsheetFile.exportXlsx()`, and re-import through `SpreadsheetFile.importXlsx()`.
- [ ] Change presentation tests to create slides through `presentation.slides.add()` and save through `PresentationFile.exportPptx()`; keep document tests unchanged except for imports needed by the shared file.
- [ ] Add assertions that a new workbook has no `load`/`exportXlsx` methods and a new presentation has no `addSlide`/`exportPptx` methods.
- [ ] Run `node --test artifact-tool/tests/workbook.test.mjs artifact-tool/tests/document-presentation.test.mjs artifact-tool/tests/compatibility-facade.test.mjs` and confirm the new tests fail because production still exposes the old boundary.
- [ ] Commit the test-only API contract change.

**Expected:** The test run fails with direct-method or missing-internal-boundary errors, not with syntax errors.

### Task 2: Extract and normalize the workbook implementation

**Files:**
- Create: `artifact-tool/src/workbook.mjs`
- Modify: `artifact-tool/src/index.mjs`
- Modify: `artifact-tool/src/spreadsheet-file.mjs`
- Test: `artifact-tool/tests/workbook.test.mjs`
- Test: `artifact-tool/tests/compatibility-facade.test.mjs`

**Interfaces:**
- Consumes: the failing canonical workbook tests from Task 1.
- Produces: `Workbook.create()` as a synchronous factory, plus internal `loadWorkbook(inputPath)` and `exportWorkbookXlsx(workbook, outputPath)` helpers used only by `SpreadsheetFile`.

**Steps:**

- [ ] Move workbook collections, worksheet/range validation, inspection, and rendering behavior from `index.mjs` to `workbook.mjs` without changing existing supported cell semantics.
- [ ] Change `Workbook.create()` to return `new Workbook()` synchronously and remove `Workbook.load()` and `Workbook.exportXlsx()` from the class.
- [ ] Add module-level workbook import/export helpers that preserve the current engine request format and temporary-directory cleanup.
- [ ] Update `index.mjs` to export `Workbook` from `workbook.mjs` and remove the moved implementation dependencies.
- [ ] Update `SpreadsheetFile` to use the internal helpers, validate `instanceof Workbook`, and continue returning `ArtifactOutput` for exports.
- [ ] Run the focused workbook/facade tests and confirm they pass.
- [ ] Run the full artifact Node test suite and commit the workbook normalization.

**Expected:** Workbook and spreadsheet-facade tests pass; no root export exposes a legacy workbook file method.

### Task 3: Normalize the presentation implementation and file facade

**Files:**
- Modify: `artifact-tool/src/presentation.mjs`
- Modify: `artifact-tool/src/presentation-file.mjs`
- Modify: `artifact-tool/tests/document-presentation.test.mjs`
- Modify: `artifact-tool/tests/compatibility-facade.test.mjs`

**Interfaces:**
- Consumes: canonical presentation tests from Task 1 and the existing shallow-import behavior.
- Produces: `Presentation` with collection-based slide creation only, plus an internal `exportPresentationPptx(presentation, outputPath)` helper used by `PresentationFile`.

**Steps:**

- [ ] Remove `Presentation.addSlide()` and `Presentation.exportPptx()` from the public class while keeping `Presentation.create()`, `Presentation.load()`, `slides.add()`, inspection, and shallow guards.
- [ ] Move PPTX serialization into a module-level helper and make its slide-object conversion use the PptxGenJS presentation object directly.
- [ ] Update `PresentationFile` to validate `Presentation` instances and call the internal serializer when constructing `ArtifactOutput`.
- [ ] Update the shallow-import fixture setup to create and export source decks through `slides.add()` and `PresentationFile.exportPptx()`.
- [ ] Run the focused presentation tests and confirm they pass, including rejection of shallow import editing/export.
- [ ] Commit the presentation normalization.

**Expected:** PPTX creation/export works only through the canonical facade, while shallow imports still reject editing and export with `unsupported_operation`.

### Task 4: Migrate runtime examples and perform whole-branch verification

**Files:**
- Modify: `artifact-tool/tests/fixtures/smoke-builder.mjs`
- Modify: `plugins/ruxex-artifacts/skills/ruxex-artifacts/SKILL.md`
- Modify: `plugins/ruxex-artifacts/README.md` if old direct API wording is present

**Interfaces:**
- Consumes: normalized public exports from Tasks 2 and 3.
- Produces: a consistent bundled skill contract and a clean artifact runtime surface.

**Steps:**

- [ ] Update the smoke builder to use synchronous `Workbook.create()`, `SpreadsheetFile` for XLSX import/export, `presentation.slides.add()`, and `PresentationFile` for PPTX export.
- [ ] Remove documentation statements that recommend direct workbook/presentation file methods; document that file I/O is facade-only and that `Document` remains the current Word creation facade.
- [ ] Run `rg -n "Workbook\\.load|\\.exportXlsx\\(|\\.addSlide\\(|\\.exportPptx\\("` over the artifact runtime, tests, plugin, and docs; allow only internal PptxGenJS `addSlide()` usage if it is clearly not the Ruxex public model.
- [ ] Run `node --test artifact-tool/tests/*.mjs`.
- [ ] Run `python3 -m unittest scripts/test_stage_ruxex_package.py plugins/ruxex-artifacts/tests/skill_contract_test.py -v`.
- [ ] Run `pnpm typecheck` and `pnpm build`.
- [ ] Run `make rust-test` to confirm no native boundary changed.
- [ ] Record any unrelated UI-only failures without modifying those files, then commit the documentation/smoke migration.

**Expected:** Artifact tests, packaging contract tests, typecheck, build, and Rust tests pass; any UI check failures are identified as pre-existing and outside this plan.

