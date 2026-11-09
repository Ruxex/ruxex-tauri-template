# Codex-shaped Artifact API Clean-break Design

## Intent

Ruxex's bundled artifact runtime should expose one clear, Codex-shaped public
API for creating and moving spreadsheet and presentation files. The project is
not released yet, so keeping legacy aliases is less valuable than making the
API internally coherent before formula, formatting, and deeper import support
are added.

The change is limited to the local artifact runtime and its skill contract.
Tauri/AppServer/protocol behavior is unchanged, and unrelated UI work is out
of scope.

## Goals

- Make `Workbook.create()` synchronous, matching the in-memory object model.
- Make `SpreadsheetFile.importXlsx()` and `SpreadsheetFile.exportXlsx()` the
  only public XLSX file-boundary APIs.
- Make `PresentationFile.importPptx()` and `PresentationFile.exportPptx()` the
  only public PPTX file-boundary APIs.
- Keep `Workbook`, `Presentation`, and `Document` focused on editable object
  models rather than file-path I/O.
- Preserve the current `FileBlob` input and `ArtifactOutput` save contract.
- Keep existing behavior for supported scalar cells, slides, tables, shapes,
  inspection, and shallow PPTX-import guards.
- Update tests, smoke builders, and the bundled skill documentation to show
  only the canonical API.

## Non-goals

- Full XLSX formula evaluation or formatting in this change.
- Full PPTX object import/editing in this change.
- Full existing DOCX editing or a new unified document-file facade.
- Changes to the AppServer, protocol, Tauri command surface, or UI.
- Backward-compatible aliases for the removed direct file I/O methods.

## Constraints

- Runtime dependencies remain bundled; users must not install Excel, Word,
  PowerPoint, or additional JavaScript packages.
- The implementation remains JavaScript plus the existing Rust-backed artifact
  engine where already used.
- Public methods must fail with structured `ArtifactToolError` diagnostics.
- Existing source files and tests outside the artifact runtime are preserved.

## Public API

### Spreadsheet

```js
const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Summary");
sheet.getRange("A1:B2").values = [["Name", "Count"], ["Ada", 3]];

const output = SpreadsheetFile.exportXlsx(workbook);
await output.save("/absolute/path/report.xlsx");

const imported = await SpreadsheetFile.importXlsx(
  await FileBlob.load("/absolute/path/input.xlsx"),
);
```

`Workbook` no longer exposes `load()` or `exportXlsx(path)`. The internal
serialization needed by `SpreadsheetFile` lives outside the public workbook
object.

### Presentation

```js
const presentation = Presentation.create({ title: "Project Review" });
const slide = presentation.slides.add();
slide.shapes.add({ geometry: "textbox", text: "Project Review" });

const output = PresentationFile.exportPptx(presentation);
await output.save("/absolute/path/review.pptx");
```

`Presentation` no longer exposes `addSlide()` or `exportPptx(path)`. Slides are
created through `presentation.slides.add()`, and file output goes through
`PresentationFile`.

### Word

`Document` remains the current creation/validation facade in this phase. Its
existing `Document.create()` and `document.exportDocx(path)` API is not
reshaped until a concrete Codex-compatible Word file facade is designed.

## Approaches considered

1. **Direct clean-break normalization (selected).** Move file-boundary work to
   module-level internal functions, remove public aliases, and update all
   callers at once. This has the smallest long-term surface and makes future
   formula/style work attach to the object model without another compatibility
   layer.
2. **Deprecation aliases.** Keep the direct methods as wrappers around the
   file facades. This would reduce immediate migration work but retain two ways
   to perform the same operation and make the pre-release API harder to reason
   about.
3. **Unified `ArtifactFile` abstraction.** Create one generic file facade for
   XLSX, DOCX, and PPTX now. This could be elegant later, but would introduce
   an abstraction before the three formats share import/edit capabilities and
   would delay the requested Excel/PPTX improvements.

The selected approach follows the user's priority: no release compatibility
burden, and the smoothest implementation path for the next artifact features.

## Implementation shape

- Extract workbook serialization/import helpers from `index.mjs` into the
  workbook implementation module without changing the current engine wire
  format.
- Change `Workbook.create()` to a synchronous constructor-style factory.
- Make `SpreadsheetFile` call the internal workbook helpers and validate the
  workbook object without relying on removed public methods.
- Keep `Presentation` as the in-memory model, remove its direct file methods,
  and expose internal presentation serialization for `PresentationFile`.
- Update tests first to assert the canonical API and remove old direct-method
  usage.
- Update the smoke builder and `ruxex-artifacts` skill text to match.

## Acceptance criteria

- No production or documentation example uses `Workbook.load`,
  `Workbook.exportXlsx`, `Presentation.addSlide`, or
  `Presentation.exportPptx`.
- Canonical create/export/import tests pass for XLSX and PPTX.
- Shallow PPTX imports still reject editing and export with structured errors.
- The artifact Node test suite, typecheck, Rust tests, and production build
  pass, subject only to unrelated pre-existing UI checks.
- No AppServer/protocol/Tauri command files are changed.
