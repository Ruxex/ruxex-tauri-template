# Python-free Documents implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every Documents Skill Python helper with equivalent commands in the existing Rust `ruxex-artifacts docx` CLI, preserving the Skill's document behavior without shipping Python.

**Architecture:** Keep `docx` command routing in `src-tauri/src/artifacts/docx.rs`, with focused Rust modules for read-only analysis, package edits, and rendering as the implementation grows. Use existing ZIP/XML and image crates; call the already-bundled `soffice` and `pdftoppm` only for preview rendering. Preserve each public helper's flags and JSON result fields where practical, but make the Rust CLI operation name the public entry point.

**Tech Stack:** Rust, `zip`, existing OOXML utilities, `image`, LibreOffice, Poppler.

**Spec:** `docs/superpowers/specs/2026-11-20-python-free-artifact-runtime-design.md`

## Global Constraints

- Do not edit Spreadsheets Skill or workbook implementation files; Excel work is active.
- Do not edit PowerPoint helper implementation; another agent owns that migration.
- Keep the shared Python runtime until Documents and Presentations no longer depend on it.
- Preserve unsupported DOCX parts, relationships, binary payloads, and existing non-target parts when editing.
- Never overwrite a source DOCX or an existing output unless a command's current contract explicitly permits it.
- DOCX page previews still use bundled LibreOffice followed by bundled Poppler; no host-tool fallback.
- Keep helper errors as structured `ArtifactError` JSON, and test command exit status as well as output.

## Review Focus

- Unknown ZIP parts or relationships changing during a narrow edit: test package part names, bytes, and relationships before/after.
- Malformed ZIP/XML or oversized parts causing panic or partial output: test bounded errors and absence of output.
- Duplicate, merged, or structurally complex tables producing wrong edits: port the existing refusal cases and assert source preservation.
- Comments, revisions, and fields spanning multiple runs or package parts: use split-run and header/footer fixtures.
- Rendering tools or image conversion failing halfway: assert no partial page set is left behind.

## File Map

- `src-tauri/src/artifacts/docx.rs`: public DOCX command dispatcher and existing read/audit/privacy operations.
- `src-tauri/src/artifacts/docx_helpers.rs` (create): Rust helper routing and shared flag/result adapters.
- `src-tauri/src/artifacts/docx_*.rs` (create as needed): focused implementations for audits, comments/revisions, fields/navigation, package edits, and rendering.
- `src-tauri/tests/docx_helpers.rs` (create): black-box CLI tests and DOCX fixture assertions.
- `src-tauri/src/artifacts/cli.rs`: DOCX capabilities and supported helper list; leave PowerPoint capability entries intact.
- `plugins/ruxex-artifacts/skills/documents/SKILL.md` and `tasks/*.md`: switch public examples from Python script paths to Rust CLI operations.
- `plugins/ruxex-artifacts/skills/documents/scripts/*.py`: remove only after each replacement command and its tests pass.
- `plugins/ruxex-artifacts/tests/docx_*_test.py`: port behavioral coverage to Rust, then remove Python-only helper tests once no Python helper remains.

## Tasks

### Task 1: Add a Rust helper command contract

**Files:**

- Create: `src-tauri/tests/docx_helpers.rs`
- Modify: `src-tauri/src/artifacts/docx.rs`
- Modify: `src-tauri/src/artifacts/cli.rs`

**Interfaces:**

- Add `docx helper <operation> [flags]` dispatch without changing existing `docx read`, `validate`, `audit`, or `privacy-scrub` behavior.
- Use lowercase kebab-case operation names matching helper filenames (for example `style-lint`, `inspect-review-markup`, `render`, `compare`).
- Return the operation's current JSON fields; unknown operations return `invalid_arguments`.

- [ ] Add a CLI test that `docx helper style-lint --input <fixture>` reaches the dispatcher and currently returns `invalid_arguments` for the unimplemented operation.
- [ ] Run `cargo test --locked --manifest-path src-tauri/Cargo.toml --test docx_helpers`; confirm the new test fails because the command is not registered.
- [ ] Implement the dispatcher and operation registry in `docx_helpers.rs`; route from `docx.rs`.
- [ ] Add a CLI test for unknown helper names and assert structured error code plus non-zero exit status.
- [ ] Re-run the focused Rust test and the existing DOCX CLI tests; expect all to pass.

### Task 2: Port read-only inspection and audit helpers

**Files:**

- Modify: `src-tauri/src/artifacts/docx_helpers.rs`
- Create as needed: `src-tauri/src/artifacts/docx_inspect.rs`
- Test: `src-tauri/tests/docx_helpers.rs`
- Source behavior: `audit_docx_features.py`, `style_lint.py`, `inspect_review_markup.py`, `template_fidelity.py`, `docx_tables_to_csv.py`, `distill_template.py`

**Interfaces:**

- Implement `docx helper audit-features`, `style-lint`, `inspect-review-markup`, `template-fidelity`, `tables-to-csv`, and `distill-template`.
- Keep one-based indexes, part paths, warning codes, and JSON key names from the Python helpers.

- [ ] Add failing tests for heading gaps, missing image alt text, style warnings, comments/revisions in separate package parts, fidelity mismatch, table CSV output, and extracted template content.
- [ ] Run the new Rust tests and confirm the operations fail as unknown.
- [ ] Port parsing to bounded ZIP reads and the existing XML utilities; do not deserialize/reserialize untouched parts.
- [ ] Add malformed and oversized package tests that assert a structured error and no output file.
- [ ] Run `cargo test --locked --manifest-path src-tauri/Cargo.toml --test docx_helpers`; expect all inspection tests to pass.

### Task 3: Port comments and tracked revisions

**Files:**

- Modify: `src-tauri/src/artifacts/docx_helpers.rs`
- Create as needed: `src-tauri/src/artifacts/docx_review.rs`
- Test: `src-tauri/tests/docx_helpers.rs`
- Source behavior: `add_comment.py`, `extract_comments.py`, `manage_comments.py`, `apply_comment_patches.py`, `add_tracked_replacements.py`, `process_tracked_changes.py`

**Interfaces:**

- Implement `comments-add`, `comments-extract`, `comments-manage`, `comments-apply-patches`, `tracked-add-replacements`, and `tracked-process`.
- Preserve existing revision defaults, comment IDs/authors, and header/footer target selection.

- [ ] Port current Python regression cases as Rust integration tests, including split runs, duplicate IDs, ambiguous comments, and `--keep-tracking-on`.
- [ ] Verify each test fails at the unimplemented command boundary.
- [ ] Implement the commands with explicit preflight over all affected package parts before writing output.
- [ ] Assert unrelated part hashes and relationships remain unchanged after each edit.
- [ ] Run the focused Rust test suite; expect all comment/revision cases to pass.

### Task 4: Port fields, captions, and navigation

**Files:**

- Modify: `src-tauri/src/artifacts/docx_helpers.rs`
- Create as needed: `src-tauri/src/artifacts/docx_fields.rs`
- Test: `src-tauri/tests/docx_helpers.rs`
- Source behavior: `process_fields.py`, `insert_captions.py`, `insert_ref_fields.py`, `internal_nav.py`, `insert_toc.py`, `insert_note.py`

**Interfaces:**

- Implement `fields-process`, `captions-insert`, `reference-fields-insert`, `internal-nav`, `toc-insert`, and `note-insert`.
- Preserve field instruction text, bookmark targets, section-aware numbering, and existing CLI flags.

- [ ] Add failing tests for field accept/reject behavior, numbering continuity, bookmarks, cross-part internal links, TOC placeholders, and footnote/endnote relationships.
- [ ] Run the focused tests and confirm the commands are unimplemented.
- [ ] Implement XML edits with relationship/content-type updates in the same transaction as document XML changes.
- [ ] Test rollback behavior: invalid targets must leave no output and the input hash must remain unchanged.
- [ ] Run the focused Rust test suite; expect all field/navigation tests to pass.

### Task 5: Port content editing, privacy, and formatting helpers

**Files:**

- Modify: `src-tauri/src/artifacts/docx_helpers.rs`
- Create as needed: `src-tauri/src/artifacts/docx_edit.rs`
- Test: `src-tauri/tests/docx_helpers.rs`
- Source behavior: `a11y_fixes.py`, `content_controls.py`, `edit_docx_content.py`, `merge_docx_append.py`, `merge_docx_text.py`, `redact_docx_text.py`, `remove_publishing_controls.py`, `set_protection.py`, `set_table_geometry.py`, `strip_rsid_attributes.py`, `style_normalize.py`, `apply_template_styles.py`, `watermark_add.py`, `replace_docx_text.py`

**Interfaces:**

- Implement `a11y-fixes`, `content-controls`, `content-edit`, `merge-append`, `merge-text`, `redact-text`, `publishing-controls-remove`, `protection-set`, `table-geometry-set`, `rsid-strip`, `style-normalize`, `template-styles-apply`, `watermark-add`, and `text-replace`.
- Keep source/output collision checks and all current refusal conditions for merges, relationships, and unsupported structures.

- [ ] Port the existing content-control, content-edit, template-fidelity, tracked-change, and watermark regression fixtures into Rust CLI tests.
- [ ] Run each new command test against the missing implementation and confirm it fails at the operation boundary.
- [ ] Implement the edits with full-part preflight and atomic output replacement.
- [ ] Compare package part hashes and relationships to ensure only declared target parts change.
- [ ] Run the focused Rust suite; expect all edit, privacy, and formatting tests to pass.

### Task 6: Move rendering and visual comparison to Rust and Poppler

**Files:**

- Modify: `src-tauri/src/artifacts/docx_helpers.rs`
- Create as needed: `src-tauri/src/artifacts/docx_render.rs`
- Test: `src-tauri/tests/docx_helpers.rs`
- Source behavior: `render_docx.py`, `compare_docx.py`

**Interfaces:**

- Implement `docx helper render --input ... --output-dir ... [--dpi ...] [--keep-pdf]` and `docx helper compare --before ... --after ... --output-dir ...`.
- Use packaged `bin/override/soffice` and `pdftoppm`; use the Rust `image` crate for image metrics.

- [ ] Add failing tests for multi-page rendering, invalid source/output collisions, missing runtime tools, Poppler errors, and image difference metrics.
- [ ] Run the focused tests and confirm missing command behavior.
- [ ] Implement subprocess isolation, timeouts, private LibreOffice profile, no-host-PATH fallback, and cleanup on failure.
- [ ] Run the native DOCX render integration test and assert all page images are readable.
- [ ] Run the focused Rust suite; expect all rendering/comparison tests to pass.

### Task 7: Switch the Documents Skill to Rust and remove its Python helpers

**Files:**

- Modify: `plugins/ruxex-artifacts/skills/documents/SKILL.md`
- Modify: `plugins/ruxex-artifacts/skills/documents/tasks/*.md`
- Modify: `src-tauri/src/artifacts/cli.rs`
- Delete: `plugins/ruxex-artifacts/skills/documents/scripts/*.py`
- Delete/port: `plugins/ruxex-artifacts/tests/docx_*_test.py`

- [ ] Add a skill-contract test asserting the Documents Skill and task guides contain no `ruxex-artifacts python` invocation and reference only registered Rust helper operations.
- [ ] Run the contract test and confirm it fails while Python examples remain.
- [ ] Replace every Python helper invocation with its `ruxex-artifacts docx helper <operation>` equivalent; retain native preview binaries in the runtime contract.
- [ ] Delete each Python helper only after its Rust command and regression tests pass.
- [ ] Run `cargo test --locked --manifest-path src-tauri/Cargo.toml --test docx_helpers`, `make package-test`, and the DOCX native render integration test; expect all migrated Documents tests to pass.

## Execution

- Execute sequentially in the current workspace as requested; do not create a Git worktree.
- Keep the PowerPoint agent's code and Excel implementation out of this plan's edits.
- Do not remove `runtime/python/` or its package staging fields in this plan. That is gated on the other Skills reaching the no-Python contract.

## Current implementation progress

- Migrated all Documents helper workflows to the Rust `ruxex-artifacts docx helper` CLI, including `content-edit`, `render`, and `compare`; removed every Python file from `skills/documents/scripts` and the Python-only DOCX tests.
- Updated the Documents Skill, task guides, capability catalog, release recipe, and native-runtime CI to use Rust helper operations. Rendering and comparison use the managed LibreOffice/Poppler tools and the Rust `image` crate. The shared Python runtime remains in place for other Skills.
- `make rust-test` passes, including 54 DOCX helper tests. The `rust-test-docx-render-integration` release test successfully rendered and compared a real DOCX using the available managed renderer runtime. `make artifact-python-test` passes (10 runtime-builder tests and 27 artifact skill tests); `make fmt-check` and `git diff --check` pass.
- `make package-test` has one unrelated failure: `test_rejects_a_manifest_that_does_not_match_the_staged_target` cannot find the existing `requirements-planning/SKILL.md` fixture. The DOCX native integration test is wired into both `make release` and native-runtime CI.
