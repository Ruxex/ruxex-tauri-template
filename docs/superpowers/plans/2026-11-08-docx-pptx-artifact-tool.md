# Local Word and PowerPoint Artifact Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the local Ruxex artifact runtime from XLSX to editable DOCX and PPTX generation without requiring user-installed runtimes or office applications.

**Architecture:** Keep `ruxex-artifacts run` and the existing versioned Rust engine boundary. The Ruxex JavaScript SDK will wrap bundled MIT-licensed `docx` and `pptxgenjs` packages for authoring, while Rust will provide lightweight package validation and read metadata for the public CLI. The staging script will require those packages to exist inside the selected bundled Node runtime.

**Tech Stack:** Rust 2024, `zip` crate for OOXML package inspection, bundled Node.js ESM, `docx` 9.x, `pptxgenjs` 4.x, JavaScript tests with Node's built-in test runner, Rust integration tests, Python staging and Skill contract tests.

**Spec:** `docs/superpowers/specs/2026-11-08-docx-pptx-artifact-tool-design.md`

## Global Constraints

- App Server and protocol files remain unchanged.
- The public artifact command remains `ruxex-artifacts`.
- Users do not install Node packages, Python packages, Microsoft Office, or desktop automation tools.
- The SDK import remains `@ruxex/artifact-tool`.
- The staged package contains the exact resolved `docx` and `pptxgenjs` runtime packages through the bundled Node runtime.
- Existing XLSX behavior and protocol version 1 remain compatible.
- Use the repository Makefile for Rust and frontend verification as required by `AGENTS.md`.
- New production behavior is implemented only after a test has failed for the intended missing behavior.

## Review Focus

- A staged Node runtime missing `docx` or `pptxgenjs` must fail during package validation with a clear missing-resource diagnostic; Task 3 tests this.
- A builder using `@ruxex/artifact-tool` must resolve both third-party packages from the staged runtime rather than the host environment; Task 2 and Task 4 test this.
- DOCX and PPTX output must remain editable OOXML packages with required parts present; Task 1 tests CLI validation and Task 4 tests real generated files.
- Text/table inputs containing unsupported values must fail with structured SDK errors instead of producing silently incomplete output; Task 2 and Task 3 test this.
- Existing XLSX capabilities and launcher behavior must remain unchanged; Task 1 and Task 5 rerun the existing suites.

---

### Task 1: Add DOCX and PPTX package validation to the Rust CLI

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `Cargo.lock`
- Modify: `src-tauri/src/artifacts.rs`
- Modify: `src-tauri/tests/artifact_cli.rs`

**Interfaces:**
- Consumes: existing `run_cli`, `capabilities`, and `ruxex-artifacts xlsx` command dispatch.
- Produces: `capabilities --json` entries for `docx` and `pptx`; `ruxex-artifacts docx|pptx {read,validate}` with structured JSON diagnostics.

- [ ] **Step 1: Write failing Rust integration tests**

Add tests that assert:

- `capabilities --json` lists `docx` and `pptx` with `create`, `read`, and `validate`.
- A minimal valid DOCX package returns `{ "valid": true, "format": "docx" }`.
- A minimal valid PPTX package returns `{ "valid": true, "format": "pptx" }`.
- A ZIP without the required package parts returns a structured invalid-package diagnostic.

- [ ] **Step 2: Run the focused Rust tests and verify the intended failure**

Run: `make rust-test`

Expected: the new tests fail because the CLI does not yet expose DOCX/PPTX operations.

- [ ] **Step 3: Implement format validation in `src-tauri/src/artifacts.rs`**

Add the smallest ZIP inspection helper needed to check required OOXML parts and return format, validity, package parts, and a stable error code. Extend command dispatch and flag validation without changing XLSX behavior. Add the direct `zip` dependency with the existing project lockfile.

- [ ] **Step 4: Run the Rust suite and verify it passes**

Run: `make rust-test`

Expected: all existing tests plus the new DOCX/PPTX tests pass.

### Task 2: Add the Ruxex JavaScript Document and Presentation facades

**Files:**
- Modify: `artifact-tool/src/index.mjs`
- Modify: `artifact-tool/src/loader.mjs`
- Create: `artifact-tool/src/document.mjs`
- Create: `artifact-tool/src/presentation.mjs`
- Modify: `artifact-tool/tests/workbook.test.mjs` or create `artifact-tool/tests/document-presentation.test.mjs`

**Interfaces:**
- Consumes: `ArtifactToolError`, the existing runtime environment variables, and the package loader.
- Produces: `Document.create`, `Document.load`, `Document.addParagraph`, `Document.addHeading`, `Document.addTable`, `Document.inspect`, `Document.exportDocx`; `Presentation.create`, `Presentation.load`, `Presentation.addSlide`, `Presentation.inspect`, `Presentation.exportPptx`; slide methods `addText`, `addTable`, and `addShape`.

- [ ] **Step 1: Write failing Node tests for the document API**

Test that a document can add a title, paragraph, and two-dimensional table, inspect their counts, export a `.docx`, and reject a table containing unsupported nested values with `unsupported_cell_value`.

- [ ] **Step 2: Run the document tests and verify the intended failure**

Run: `RUXEX_ARTIFACT_ENGINE="$PWD/target/debug/ruxex-artifacts-engine" /home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test artifact-tool/tests/document-presentation.test.mjs`

Expected: the document API is missing.

- [ ] **Step 3: Implement the minimal `Document` facade**

Keep an in-memory document model and translate it to `docx` objects only during export. Support plain text paragraphs, heading levels, and rectangular string/number/boolean/null tables. Use the bundled `Packer` to write an editable DOCX. `load` and `inspect` may expose package metadata and supported extracted counts without pretending to support arbitrary Word editing.

- [ ] **Step 4: Write failing Node tests for the presentation API**

Test that a presentation can add a title slide, text, a table, and an editable rectangle shape, inspect slide/object counts, export a `.pptx`, and reject unsupported shape names.

- [ ] **Step 5: Run the presentation tests and verify the intended failure**

Run the same focused Node test command.

Expected: presentation API assertions fail because the facade is not implemented.

- [ ] **Step 6: Implement the minimal `Presentation` facade**

Keep a Ruxex-owned slide model and translate it to `pptxgenjs` only during export. Support title/body text roles, rectangular editable shapes, and simple tables. Map layout and text options to stable defaults; reject unsupported options with structured errors.

- [ ] **Step 7: Run focused Node tests and verify they pass**

Run the focused Node test command and the existing `artifact-tool/tests/workbook.test.mjs` command.

Expected: all document, presentation, and spreadsheet SDK tests pass.

### Task 3: Make the bundled runtime resolve and validate authoring dependencies

**Files:**
- Modify: `src-tauri/src/bin/ruxex-artifacts.rs`
- Modify: `scripts/stage-ruxex-package.py`
- Modify: `scripts/test_stage_ruxex_package.py`
- Modify: `artifact-tool/src/loader.mjs`

**Interfaces:**
- Consumes: the existing staged Node runtime and SDK loader.
- Produces: package-relative resolution for `docx` and `pptxgenjs`, plus staging validation that rejects runtimes without both packages.

- [ ] **Step 1: Extend staging tests with failing dependency fixtures**

Add fake `node_modules/docx/package.json` and `node_modules/pptxgenjs/package.json` fixtures, then add a test that omits one package and expects staging to fail with a missing dependency diagnostic.

- [ ] **Step 2: Run the focused staging tests and verify the intended failure**

Run: `python3 -m unittest scripts/test_stage_ruxex_package.py -v`

Expected: the new dependency assertions fail because staging does not check them.

- [ ] **Step 3: Implement package-relative loader resolution**

Pass `RUXEX_ARTIFACT_NODE_MODULES` from the public launcher. Extend the ESM loader to resolve `docx` and `pptxgenjs` from that exact staged directory while leaving normal Node resolution unchanged.

- [ ] **Step 4: Implement staging validation**

Require `ruxex-resources/node/node_modules/docx/package.json` and `ruxex-resources/node/node_modules/pptxgenjs/package.json`. Preserve the existing copy and executable checks.

- [ ] **Step 5: Run the focused staging tests and verify they pass**

Run: `python3 -m unittest scripts/test_stage_ruxex_package.py -v`

Expected: all staging tests pass, including the missing-dependency case.

### Task 4: Integrate the builder workflow and Skill

**Files:**
- Modify: `artifact-tool/tests/fixtures/smoke-builder.mjs`
- Modify: `plugins/ruxex-artifacts/skills/ruxex-artifacts/SKILL.md`
- Modify: `plugins/ruxex-artifacts/tests/skill_contract_test.py`
- Modify: `plugins/ruxex-artifacts/README.md`
- Modify: `README.md`
- Modify: `vite.config.ts` if new Node-only test files are discovered by Vitest

**Interfaces:**
- Consumes: the completed JS facades, public launcher, and CLI validators.
- Produces: documented local workflows for `.xlsx`, `.docx`, and `.pptx` generation and validation.

- [ ] **Step 1: Extend Skill contract tests first**

Require the Skill to mention `Document`, `Presentation`, `exportDocx`, `exportPptx`, `docx validate`, and `pptx validate`, while retaining the no-host-installation constraints.

- [ ] **Step 2: Run the Skill tests and verify the intended failure**

Run: `python3 -m unittest plugins/ruxex-artifacts/tests/skill_contract_test.py -v`

Expected: the new requirements fail because the Skill only documents XLSX.

- [ ] **Step 3: Update the Skill and package documentation**

Document one common builder pattern, format-specific APIs, required validation commands, and the staged runtime dependency contract. Keep the user-facing command as `ruxex-artifacts`.

- [ ] **Step 4: Extend the real staged smoke builder**

Generate one workbook, one DOCX, and one PPTX from the same builder. The smoke test must use `@ruxex/artifact-tool` imports and write all outputs to an explicit output directory.

- [ ] **Step 5: Run the Skill tests and staged smoke verification**

Run the Skill tests and stage a real package using the bundled Node runtime. Execute `capabilities`, the smoke builder, and all three validators. Expected: all three artifacts exist and validate successfully.

### Task 5: Full verification and self-review

**Files:**
- Modify: `docs/superpowers/sdd/2026-11-08-docx-pptx-artifact-tool/progress.md`

- [ ] **Step 1: Run focused verification**

Run:

```bash
make rust-test
PATH=/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH make check-tests
PATH=/home/minato/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH make build
python3 -m unittest scripts/test_stage_ruxex_package.py plugins/ruxex-artifacts/tests/skill_contract_test.py -v
```

- [ ] **Step 2: Run the full package test and record unrelated failures**

Run: `make package-test`

Record any pre-existing Storybook accessibility failure without expanding the scope into unrelated files.

- [ ] **Step 3: Run final diff checks**

Run: `git diff --check` and confirm no App Server/protocol paths changed.

- [ ] **Step 4: Complete a self-review**

Review the staged diff against the design and this plan, with special attention to package resolution, structured diagnostics, output-path handling, and unsupported input behavior.

- [ ] **Step 5: Update the SDD ledger**

Record each completed task and exact verification results in `.superpowers/sdd/2026-11-08-docx-pptx-artifact-tool/progress.md`.
