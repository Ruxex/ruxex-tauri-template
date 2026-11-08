# Codex Artifact Compatibility Layer Design

## Intent

Move the local Ruxex artifact runtime toward the public shape used by the
Codex artifact workflows without changing the AppServer or protocol. The first
increment is an API compatibility layer, not a claim of full feature parity.
It should let builders use Codex-shaped file loading and export calls while
keeping the existing Ruxex APIs working.

## Goals

- Add a shared `FileBlob` input abstraction for local artifact files.
- Add `SpreadsheetFile.importXlsx()` and `SpreadsheetFile.exportXlsx()`.
- Add `PresentationFile.importPptx()` and `PresentationFile.exportPptx()`.
- Return saveable output objects with an async `save(path)` method.
- Add a Codex-shaped `presentation.slides` collection while preserving
  `presentation.addSlide()`.
- Preserve structured Ruxex errors and the bundled-runtime-only dependency
  boundary.
- Make imports and exports explicit about the current shallow-import limits.

## Non-goals for this increment

- No AppServer or protocol changes.
- No cloud, Office add-in, Connected App, or hosted sandbox behavior.
- No attempt to implement all Excel formulas, formatting, charts, or
  recalculation yet.
- No full PPTX object graph import, stable object IDs, image/chart support, or
  rendering yet.
- No Word API redesign; `Document` remains the Ruxex authoring facade until a
  separate Word editing design exists.
- No silent preservation claim for unsupported content in imported files.

## Approaches considered

### A. Rename the existing Ruxex APIs to match Codex

This would make examples look similar quickly, but would break existing
Ruxex builders and would conflate naming compatibility with implementation
parity. Rejected because the runtime is already consumed by the Skill and
existing tests.

### B. Add a compatibility facade over the existing engines

Expose the Codex-shaped file/blob names and collection accessors as thin
wrappers over the existing Ruxex models. Keep old methods as aliases and make
unsupported operations fail with structured diagnostics. This gives builders a
stable migration path and leaves the backend boundary unchanged. Selected.

### C. Replace the runtime with the full Codex artifact SDK

This is not available as a distributable dependency for Ruxex and would violate
the requirement to implement the equivalent locally without bundling OpenAI's
proprietary runtime. Rejected.

## API shape

### Shared file blob

```js
const input = await FileBlob.load("/absolute/input.xlsx");
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save("/absolute/output.xlsx");
```

`FileBlob` is a local-file reference with a `path`, `name`, `type`, and
`arrayBuffer()` method. It must read only when requested by the importer or
save operation.

### Spreadsheet facade

```js
const workbook = await SpreadsheetFile.importXlsx(input);
const output = await SpreadsheetFile.exportXlsx(workbook);
```

The importer delegates to the existing Rust reader and currently imports scalar
cell values and sheet names. The exporter delegates to `Workbook.exportXlsx()`.
The existing `Workbook.create()`, `Workbook.load()`, and `exportXlsx(path)`
methods remain supported.

### Presentation facade

```js
const presentation = await PresentationFile.importPptx(input);
const slide = presentation.slides.add();
slide.shapes.add({
  geometry: "textbox",
  position: { left: 72, top: 64, width: 800, height: 80 },
  text: "Review",
});
const output = await PresentationFile.exportPptx(presentation);
await output.save("/absolute/review.pptx");
```

The first facade maps textbox and rectangle additions to the existing
PptxGenJS-backed model. The `slides` collection is the preferred API;
`addSlide()` remains an alias. PPTX import is intentionally shallow in this
increment and records the source path for validation/diagnostics rather than
pretending that existing slide objects are editable.

### Word facade

Keep the current `Document.create()`, `Document.load()`,
`addParagraph()`, `addHeading()`, `addTable()`, `inspect()`, and
`exportDocx()` API. Add only output-save compatibility if it can be done
without inventing a Codex API that does not exist in the installed Word Skill.

## Error behavior

- Invalid or missing paths return `ArtifactToolError` with stable codes.
- Unsupported operations return `unsupported_operation`.
- Unsupported imported content is reported as a shallow-import diagnostic; it
  is never silently represented as editable content.
- Output objects validate that their target is a local path before writing.

## Files

- `artifact-tool/src/file-blob.mjs`: local file/blob facade and saveable output
  object.
- `artifact-tool/src/spreadsheet-file.mjs`: XLSX import/export facade.
- `artifact-tool/src/presentation-file.mjs`: PPTX import/export facade.
- `artifact-tool/src/index.mjs`: public exports and compatibility wiring.
- `artifact-tool/src/presentation.mjs`: `slides` and `shapes` compatibility
  accessors.
- `artifact-tool/tests/compatibility-facade.test.mjs`: red/green contract tests.
- `plugins/ruxex-artifacts/skills/ruxex-artifacts/SKILL.md`: preferred API
  examples and shallow-import disclosure.

## Verification

- Node compatibility tests cover file loading, saveable outputs, XLSX round
  trip of scalar values, PPTX authoring through `slides.add()`, and structured
  errors for unsupported imported editing.
- Existing Rust, frontend, staging, and artifact smoke tests remain green.
- The test suite must confirm that no AppServer/protocol files change.
