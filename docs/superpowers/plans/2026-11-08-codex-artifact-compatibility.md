# Codex Artifact Compatibility Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-breaking Codex-shaped compatibility facade for local XLSX and PPTX workflows while preserving the existing Ruxex APIs and runtime boundary.

**Architecture:** Keep `Workbook`, `Presentation`, and the Rust artifact engine as the implementation layer. Add small JavaScript facade modules for local file inputs and saveable outputs, and add collection/accessor adapters to `Presentation`. Imports remain explicit shallow imports until later parity work adds full object-graph editing.

**Tech Stack:** Node.js ESM, existing Ruxex artifact-tool facade, bundled Rust XLSX/OOXML engine, Node test runner, Python Skill contract tests.

**Spec:** `docs/superpowers/specs/2026-11-08-codex-artifact-compatibility-design.md`

## Global Constraints

- No AppServer or protocol changes.
- No cloud, Office add-in, Connected App, or hosted sandbox behavior.
- Keep existing Ruxex APIs working, including `Workbook.load()`, `Workbook.exportXlsx(path)`, `Presentation.addSlide()`, and `Presentation.exportPptx(path)`.
- Resolve dependencies only from the bundled runtime; do not add user-install requirements.
- Do not claim imported XLSX/PPTX content is fully editable when the importer only provides scalar values or source metadata.
- Unsupported operations must return structured `ArtifactToolError` diagnostics.

## Review Focus

- A missing, non-file, or unsupported input path must fail with a stable structured error rather than a raw filesystem exception. Test in Task 1.
- A saveable output must create missing parent directories and preserve the existing format-specific export behavior. Test in Task 1 and Task 2.
- Passing a string path and passing a `FileBlob` must select the same importer behavior. Test in Task 2 and Task 3.
- PPTX position objects must map from Codex pixel-style fields to the existing PptxGenJS coordinate options without silently dropping dimensions. Test in Task 3.
- Shallow PPTX imports must expose their source path and reject edits that require parsed slide objects instead of pretending they are editable. Test in Task 3.

## File Map

- Create `artifact-tool/src/file-blob.mjs`: lazy local-file input and saveable output helpers.
- Create `artifact-tool/src/spreadsheet-file.mjs`: `SpreadsheetFile` XLSX facade.
- Create `artifact-tool/src/presentation-file.mjs`: `PresentationFile` PPTX facade.
- Modify `artifact-tool/src/index.mjs`: export compatibility facades.
- Modify `artifact-tool/src/presentation.mjs`: add Codex-shaped `slides`, `shapes`, and `tables` adapters while preserving old methods.
- Modify `artifact-tool/tests/document-presentation.test.mjs` or create `artifact-tool/tests/compatibility-facade.test.mjs`: compatibility contract tests.
- Modify `plugins/ruxex-artifacts/skills/ruxex-artifacts/SKILL.md`: preferred facade examples and shallow-import disclosure.
- Modify `plugins/ruxex-artifacts/README.md`: public capability summary.

### Task 1: File input and saveable output primitives

**Files:**
- Create: `artifact-tool/src/file-blob.mjs`
- Test: `artifact-tool/tests/compatibility-facade.test.mjs`

**Interfaces:**
- Produces `FileBlob.load(inputPath)`, `fileBlob.path`, `fileBlob.name`, `fileBlob.type`, and `fileBlob.arrayBuffer()`.
- Produces `ArtifactOutput.save(outputPath)`, `ArtifactOutput.format`,
  `ArtifactOutput.fromBytes(bytes, format)`, and
  `ArtifactOutput.fromSaver(format, saver)`.
- Consumes `ArtifactToolError` from `artifact-tool/src/a1-range.mjs`.

- [ ] **Step 1: Write failing tests**

  Add tests for loading an existing temporary file, detecting the extension,
  reading bytes lazily, rejecting a missing path, and saving bytes into a
  nested directory through `ArtifactOutput.fromBytes()`.

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run:

  ```sh
  node --test artifact-tool/tests/compatibility-facade.test.mjs
  ```

  Expected: FAIL because the new module and methods do not exist.

- [ ] **Step 3: Implement the primitives**

  Use `fs.stat`, `fs.readFile`, and `mkdir` from `node:fs/promises`. Normalize
  input paths with `resolve`, reject directories as `invalid_input_path`, and
  infer MIME-like format labels from `.xlsx`, `.docx`, and `.pptx` extensions.
  `ArtifactOutput.fromBytes(bytes, format)` must write bytes only when
  `save(path)` is called. `ArtifactOutput.fromSaver(format, saver)` must call
  `saver(outputPath)` only from `save()`, so existing Rust/JS exporters can be
  delegated to without an unnecessary in-memory round trip. Keep the output
  object format-only and avoid exposing internal buffers after construction.

- [ ] **Step 4: Run the focused test and confirm it passes**

  Run the same Node test command. Expected: all Task 1 tests pass.

- [ ] **Step 5: Commit**

  ```sh
  git add artifact-tool/src/file-blob.mjs artifact-tool/tests/compatibility-facade.test.mjs
  git commit -m "feat: add artifact file facade primitives"
  ```

### Task 2: SpreadsheetFile facade

**Files:**
- Create: `artifact-tool/src/spreadsheet-file.mjs`
- Modify: `artifact-tool/src/index.mjs`
- Test: `artifact-tool/tests/compatibility-facade.test.mjs`

**Interfaces:**
- Consumes `FileBlob` and `ArtifactOutput` from Task 1.
- Consumes `Workbook.load(inputPath)` and `Workbook.exportXlsx(outputPath)` from `artifact-tool/src/index.mjs`.
- Produces `SpreadsheetFile.importXlsx(input)` and `SpreadsheetFile.exportXlsx(workbook)`.

- [ ] **Step 1: Add failing import/export contract tests**

  Use the existing workbook test fixture to create an XLSX, import it through
  both a string path and `FileBlob`, assert the sheet name and scalar values,
  export through `SpreadsheetFile.exportXlsx()`, save it to a nested path, and
  validate the saved file with the existing Rust engine. Add an assertion that
  a non-workbook object is rejected with `invalid_workbook`.

- [ ] **Step 2: Run the focused tests and confirm they fail**

  Run the Node compatibility test with the bundled Node loader and the debug
  artifact engine. Expected: FAIL because `SpreadsheetFile` is not exported.

- [ ] **Step 3: Implement `SpreadsheetFile`**

  Normalize a string or `FileBlob` to a path, delegate import to
  `Workbook.load()`, and return `ArtifactOutput` whose `save()` delegates to
  `workbook.exportXlsx(path)`. Keep `Workbook.exportXlsx(path)` unchanged for
  backward compatibility. Export the facade from `index.mjs`.

- [ ] **Step 4: Run the focused tests and existing workbook tests**

  Run:

  ```sh
  node --test artifact-tool/tests/compatibility-facade.test.mjs artifact-tool/tests/workbook.test.mjs
  ```

  Expected: all compatibility and existing workbook tests pass.

- [ ] **Step 5: Commit**

  ```sh
  git add artifact-tool/src/spreadsheet-file.mjs artifact-tool/src/index.mjs artifact-tool/tests/compatibility-facade.test.mjs
  git commit -m "feat: add Codex-shaped spreadsheet file facade"
  ```

### Task 3: PresentationFile and slide collection adapters

**Files:**
- Create: `artifact-tool/src/presentation-file.mjs`
- Modify: `artifact-tool/src/index.mjs`
- Modify: `artifact-tool/src/presentation.mjs`
- Test: `artifact-tool/tests/compatibility-facade.test.mjs`

**Interfaces:**
- Consumes `FileBlob` and `ArtifactOutput` from Task 1.
- Consumes `Presentation.load(inputPath)`, `Presentation.exportPptx(outputPath)`, and the existing slide object model.
- Produces `PresentationFile.importPptx(input)` and `PresentationFile.exportPptx(presentation)`.
- Produces `presentation.slides.add(options)` as the preferred alias for `presentation.addSlide(options)`.
- Produces `slide.shapes.add(config)` for `textbox` and `rect`, and `slide.tables.add(config)` for rectangular cell matrices.

- [ ] **Step 1: Add failing PPTX compatibility tests**

  Assert that `PresentationFile.importPptx()` accepts a string and a `FileBlob`,
  that a shallow imported presentation reports `sourcePath`, and that adding a
  slide through `slides.add()` creates text, a table, and a rectangle through
  the `shapes` and `tables` collections. Assert that position fields
  `{left, top, width, height}` reach the generated deck as the expected
  PptxGenJS `{x, y, w, h}` values through the in-memory model. Assert that
  unsupported geometry returns `unsupported_shape` and that editing a shallow
  import returns `unsupported_operation` when parsed content is required.

- [ ] **Step 2: Run the focused tests and confirm they fail**

  Run the Node compatibility test with the bundled loader. Expected: FAIL
  because `PresentationFile`, `slides`, `shapes`, and `tables` adapters do not
  exist.

- [ ] **Step 3: Implement the adapters**

  Add a `SlideCollection.add()` method that delegates to the existing internal
  slide creation. Add `shapes.add()` mappings for `textbox` and `rect`; a
  textbox with `text` delegates to `addText`, and a rect delegates to
  `addShape("rect")`. Convert `position` keys to the existing PptxGenJS option
  keys without changing already-supported direct options. Add `tables.add()`
  with the same position conversion. Add `PresentationFile` import/export
  wrappers and export it from `index.mjs`. Keep the shallow-import marker
  explicit so unsupported edits produce a structured error.

- [ ] **Step 4: Run compatibility and existing document/presentation tests**

  Run:

  ```sh
  node --test artifact-tool/tests/compatibility-facade.test.mjs artifact-tool/tests/document-presentation.test.mjs
  ```

  Expected: all tests pass and generated PPTX validation remains valid.

- [ ] **Step 5: Commit**

  ```sh
  git add artifact-tool/src/presentation-file.mjs artifact-tool/src/presentation.mjs artifact-tool/src/index.mjs artifact-tool/tests/compatibility-facade.test.mjs
  git commit -m "feat: add Codex-shaped presentation facade"
  ```

### Task 4: Skill documentation and full verification

**Files:**
- Modify: `plugins/ruxex-artifacts/skills/ruxex-artifacts/SKILL.md`
- Modify: `plugins/ruxex-artifacts/README.md`
- Test: existing staging and Skill contract tests

**Interfaces:**
- Consumes the public exports from Tasks 1–3.
- Produces documented examples that use the compatibility facade and clearly
  state the current shallow-import limits.

- [ ] **Step 1: Update the Skill examples**

  Make `FileBlob`, `SpreadsheetFile`, and `PresentationFile` the preferred
  examples for file-based XLSX/PPTX workflows. Keep the direct Ruxex methods
  documented as compatibility aliases. Document that Word remains on the
  existing `Document` facade and that imported PPTX/XLSX content is not yet a
  full-fidelity editable object graph.

- [ ] **Step 2: Run documentation contract tests**

  Run:

  ```sh
  python3 -m unittest scripts/test_stage_ruxex_package.py plugins/ruxex-artifacts/tests/skill_contract_test.py -v
  ```

  Expected: all staging and Skill contract tests pass.

- [ ] **Step 3: Run the full focused verification**

  Run:

  ```sh
  make rust-test
  PATH=/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH make check-tests
  make build
  ```

  Also run the Node artifact suite with the bundled loader and the staged
  three-format smoke builder. Expected: all relevant tests pass; any existing
  unrelated package-test failure is reported separately and not changed here.

- [ ] **Step 4: Review the diff and protocol boundary**

  Confirm `git diff --check` passes, only the planned artifact-tool and Skill
  paths changed, and no AppServer/protocol files were modified.

- [ ] **Step 5: Commit**

  ```sh
  git add docs/superpowers/specs/2026-11-08-codex-artifact-compatibility-design.md docs/superpowers/plans/2026-11-08-codex-artifact-compatibility.md plugins/ruxex-artifacts/skills/ruxex-artifacts/SKILL.md plugins/ruxex-artifacts/README.md
  git commit -m "docs: document Codex-shaped artifact APIs"
  ```
