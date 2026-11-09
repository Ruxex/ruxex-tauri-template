# Local Artifact Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Ruxex's local artifact workflow to practical Codex-level parity for XLSX, DOCX, PPTX, and PDF without Cloud, Office, or AppServer/protocol changes.

**Architecture:** Keep the existing JavaScript facade as the agent-facing API, add a shared bounded Rust artifact model for parsing and previews, and expose a paged preview payload to a dedicated Tauri viewer. PDF creation/inspection and image decoding are bundled Rust capabilities; Office package parsing remains direct ZIP/XML parsing with explicit loss diagnostics.

**Tech Stack:** Rust 2024, Tauri 2, `zip`, `quick-xml`, `image`, `lopdf`, `pdf-writer`, `calamine`, `rust_xlsxwriter`, React 19, Vitest, bundled JavaScript artifact runtime.

**Spec:** `docs/superpowers/specs/2026-11-09-local-artifact-parity-design.md`

## Global Constraints

- No Cloud, hosted artifact, remote worker, Office, LibreOffice, browser converter, or user-installed runtime dependency.
- No AppServer, provider, generated protocol, or server message changes.
- Only absolute regular files under the Ruxex/workspace roots may be read for preview or edit.
- Never execute macros, external relationships, external URLs, embedded executables, or document markup.
- Enforce compressed/decompressed package, XML, asset, section, rendered-size, and output limits.
- Preserve unsupported content explicitly as diagnostics; never silently claim full-fidelity editing.
- Keep existing parallel UI changes out of artifact commits.

## Review Focus

- A malformed or hostile ZIP/XML/PDF must fail before unbounded allocation or external access; cover with native limit and relationship tests.
- A document containing images, charts, merged cells, notes, and styled text must preserve supported elements in both inspection and preview; cover with fixture packages.
- An imported DOCX/PPTX must not be reported editable when unsupported elements would be lost; cover with loss diagnostics and round-trip tests.
- A multi-page preview must remain bounded and navigable without loading every large image into the DOM at once; cover with viewer pagination tests.
- Artifact output metadata must continue to drive the existing conversation preview without protocol changes; cover with explicit JSON-line and UI tests.

---

### Task 1: Establish the normalized artifact model and paged preview contract

**Files:**
- Create: `src-tauri/src/artifact_model.rs`
- Modify: `src-tauri/src/lib.rs`, `src-tauri/src/artifact_preview.rs`
- Modify: `src/platform/native.ts`, `src/components/conversation/conversation-model.ts`
- Test: `src-tauri/src/artifact_model.rs`, `src-tauri/src/artifact_preview.rs`, `src/components/conversation/ArtifactPreview.test.tsx`

**Interfaces:**
- Produces `ArtifactDocument`, `ArtifactSection`, `ArtifactElement`, `ArtifactAsset`, and bounded `ArtifactPreviewPage` Rust types.
- `preview_artifact(path)` returns `{ format, pages, diagnostics, byteSize }` with ordered page data URLs; the first page remains available to compact inline rendering.

- [x] Write failing native tests for section/page ordering, diagnostics, size caps, and unsupported-element markers.
- [x] Run the focused Rust tests and confirm the new types/fields are absent.
- [x] Implement the model and paged preview serialization without changing AppServer or protocol types.
- [x] Write failing frontend tests for a paged payload and the existing single-page compatibility presentation.
- [x] Implement the TypeScript payload types and normalization.
- [x] Run focused Rust and Vitest tests; commit `feat: add normalized local artifact preview model`.

### Task 2: Add Rust-native PDF generation, inspection, and preview

**Files:**
- Create: `src-tauri/src/artifact_pdf.rs`
- Modify: `src-tauri/src/lib.rs`, `src-tauri/src/artifacts.rs`, `src-tauri/Cargo.toml`, `Cargo.lock`
- Modify: `artifact-tool/src/file-blob.mjs`, `artifact-tool/src/index.mjs`
- Test: `src-tauri/src/artifact_pdf.rs`, `src-tauri/tests/artifact_cli.rs`, `artifact-tool/tests/pdf.test.mjs`

**Interfaces:**
- CLI supports `pdf create`, `pdf read`, and `pdf validate` with the same JSON error envelope and engine protocol version.
- `PdfDocument.create()` supports bounded pages, text blocks, tables, and local PNG/JPEG assets; `PdfDocument.load()` returns an inspectable model with loss diagnostics.
- `FileBlob` recognizes `.pdf`; `ArtifactOutput.save()` returns `{ ok, format: "pdf", output }`.

- [x] Add failing tests for creating a multi-page PDF, validating it, extracting text, rejecting out-of-root/external assets, and producing preview pages.
- [x] Add the pinned pure-Rust PDF/image dependencies and run the focused tests to observe the expected missing-operation failures.
- [x] Implement PDF writing with `pdf-writer`, bounded reading with `lopdf`, and PNG/JPEG validation/normalization with `image`.
- [x] Connect PDF previews to the normalized model and Tauri command.
- [x] Implement the JS `PdfDocument` facade and engine/CLI dispatch.
- [x] Run native, CLI, and Artifact SDK PDF tests; commit `feat: add local pdf artifact support`.

### Task 3: Expand XLSX extraction and preview fidelity

**Files:**
- Modify: `src-tauri/src/artifact_model.rs`, `src-tauri/src/artifact_preview.rs`, `src-tauri/src/artifacts.rs`
- Modify: `artifact-tool/src/workbook.mjs`, `artifact-tool/src/spreadsheet-file.mjs`
- Test: `src-tauri/src/artifact_preview.rs`, `src-tauri/tests/artifact_cli.rs`, `artifact-tool/tests/workbook.test.mjs`

**Interfaces:**
- XLSX inspection preserves supported formats, merges, tables, charts, column widths, and local images in the normalized model.
- SVG page rendering includes bounded cell styles, merged ranges, chart placeholders/plots, and embedded images where supported.

- [x] Add failing workbook fixtures covering styles, merges, tables, charts, images, formulas, and truncation diagnostics.
- [x] Implement native extraction and deterministic SVG layout for the supported features.
- [x] Extend `SpreadsheetFile.importXlsx()` to preserve the supported model for edit/export rather than returning only scalar cells.
- [x] Run the focused Rust and Node tests; commit `feat: deepen xlsx artifact inspection and preview`.

### Task 4: Make DOCX/PPTX imports and previews loss-aware and richer

**Files:**
- Modify: `src-tauri/src/artifact_model.rs`, `src-tauri/src/artifact_preview.rs`
- Modify: `artifact-tool/src/document.mjs`, `artifact-tool/src/presentation.mjs`, `artifact-tool/src/presentation-file.mjs`
- Test: `src-tauri/src/artifact_preview.rs`, `src-tauri/tests/artifact_cli.rs`, `artifact-tool/tests/document-presentation.test.mjs`

**Interfaces:**
- DOCX extraction supports styled paragraphs, tables, inline local images, headers/footers where present, and explicit unsupported-feature diagnostics.
- PPTX extraction supports slide dimensions, styled text, shapes, tables, charts, notes, and inline local images with slide-level diagnostics.
- `Document.load()` and `Presentation.load()` return editable supported models and refuse export when the import contains lossy unsupported content unless the caller explicitly accepts diagnostics.

- [x] Add failing minimal DOCX/PPTX ZIP fixtures for styles, tables, images, charts, notes, and unsupported relationships.
- [x] Implement bounded OOXML parsing with bounded XML extraction, asset validation, and normalized elements.
- [x] Implement supported-model reconstruction in the JS facades and preserve explicit loss diagnostics through `inspect()`.
- [x] Add native SVG rendering annotations for text, tables, shapes, and images within the defined limits.
- [x] Run focused Rust and Node syntax tests; commit `feat: add rich office artifact inspection`.

### Task 5: Build the dedicated local Artifact Viewer

**Files:**
- Create: `src/components/conversation/ArtifactViewer.tsx`
- Create: `src/components/conversation/ArtifactViewer.test.tsx`
- Create: `src/components/conversation/ArtifactViewer.stories.tsx`
- Modify: `src/components/conversation/ArtifactPreview.tsx`, `src/components/conversation/ActivityItem.tsx`
- Modify: `src/platform/native.ts`, `src-tauri/src/lib.rs`, `src-tauri/src/desktop.rs`

**Interfaces:**
- `ArtifactViewer` accepts the paged preview payload and exposes thumbnail selection, previous/next, fit-width/zoom, diagnostics, and format metadata.
- A native open action validates the path against the existing artifact policy before delegating to the platform opener; download/export uses an explicit user-selected destination.

- [x] Add failing component tests for navigation, thumbnail selection, zoom, diagnostics, keyboard access, and empty/error states.
- [x] Implement the viewer and keep `ArtifactPreview` as the compact first-page presentation.
- [x] Add native open/export commands with path validation and tests for allowed/denied targets.
- [x] Add the viewer to artifact activities and verify output JSON still triggers it without AppServer changes.
- [x] Run focused UI tests and build; commit `feat: add local artifact viewer`.

### Task 6: Update the artifact Skill, docs, fixtures, and verification

**Files:**
- Modify: `plugins/ruxex-artifacts/skills/ruxex-artifacts/SKILL.md`, `plugins/ruxex-artifacts/README.md`
- Modify: `README.md`, `docs/codex-claude-ruxex-feature-matrix.md`
- Modify: `artifact-tool/tests/fixtures/smoke-builder.mjs`
- Test: package boundary, fixture, Rust, Node, frontend, and native build suites

- [x] Document PDF APIs, supported local images, preview diagnostics, and the viewer contract without requiring user installations.
- [x] Update stale statements that artifact viewers are out of scope.
- [x] Extend smoke fixtures to create and print JSON metadata for all four formats.
- [x] Run `make rust-test`, the artifact Node suite, the full Vitest suite, `pnpm typecheck`, `pnpm lint`, `pnpm build`, package tests, and `git diff --check`.
- [x] Confirm `git diff --name-only` contains no AppServer/protocol changes.
- [x] Commit documentation/fixture updates, inspect the final diff, and push all artifact commits.
