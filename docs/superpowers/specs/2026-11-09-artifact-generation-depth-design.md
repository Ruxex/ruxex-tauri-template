# Local Artifact Generation Depth Design

## Intent

Close the largest local-feature gap between Ruxex and Codex-style artifact
workflows without requiring users to install Office, Node.js, Python, or any
format library. Ruxex already has a bundled JavaScript artifact facade and a
Rust XLSX engine, but the current workbook model only carries sheet names and
scalar cell values. The next phase makes that model useful for real reports,
while preserving the later plan for PPTX, DOCX, PDF, and an in-app preview.

The work is deliberately local-first. Cloud execution, hosted sandboxes,
cross-device continuation, and OpenAI's private artifact implementation are
out of scope.

## Goals

- Extend the existing bundled artifact runtime rather than introducing a user
  installation requirement.
- Make Excel authoring support formulas, cached formula results, basic cell
  formatting, merged ranges, column widths, tables, and charts in a validated
  incremental surface.
- Preserve the public JavaScript boundary:
  `Workbook`/`Worksheet`/`Range` for in-memory editing and
  `SpreadsheetFile` for XLSX import/export.
- Keep unsupported operations explicit and structured; never silently drop a
  requested feature.
- Make the internal engine request rich enough that the later preview stage
  can inspect values, formulas, styles, and object bounds.
- Keep AppServer, generated protocol types, and Tauri command contracts
  unchanged.

## Non-goals for the first implementation slice

- Full Excel formula compatibility or a general-purpose formula evaluator.
- Lossless round-trip preservation of every existing XLSX feature.
- PPTX/DOCX/PDF implementation in the same change.
- In-app preview, annotation, or artifact viewer UI; that follows generation.
- Macros, external links, embedded executables, or executing workbook content.

## Constraints

- All runtime dependencies are bundled in the staged Ruxex package.
- The existing Rust engine remains the only native artifact engine.
- The private JS-to-Rust engine protocol may change because it is not the
  AppServer/protocol contract, but it remains versioned and machine-readable.
- Formula evaluation is deterministic and bounded. Unsupported functions or
  references return a structured diagnostic rather than executing arbitrary
  code.
- Existing XLSX read/validate/create behavior remains valid for scalar data.

## Approach

### Selected: format-native Rust engine plus a small JavaScript facade

The JS model stores workbook intent and delegates serialization to the existing
Rust engine. `rust_xlsxwriter` already provides native support for formula
writing, formatting, merged cells, tables, and charts; the engine will map a
validated JSON model onto those APIs. A small bounded evaluator will calculate
the initial supported formula subset and provide cached values for export and
inspection. `calamine` remains the reader for scalar values, with richer import
metadata added only where the locked version supports it safely.

This keeps the public API stable and the native package self-contained. It also
avoids pretending that writing formulas is the same as calculating formulas:
the engine will report the supported function set and whether a formula was
evaluated or merely marked for spreadsheet recalculation.

### Alternatives considered

1. **Add only JavaScript-side metadata.** Fast to prototype, but the Rust
   writer would discard styles, formulas, and objects on export.
2. **Bundle a full office application.** Broad compatibility, but creates a
   large platform-specific dependency and complicates sandboxing, licensing,
   startup, and packaging.
3. **Replace the engine with a new pure-JS spreadsheet stack.** Could provide
   richer object semantics, but duplicates the native writer already bundled
   and makes the desktop package heavier.

The selected approach gives the best local feature depth per implementation
cost while retaining a controlled dependency boundary.

## Public API shape

The current file facade remains canonical:

```js
const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Summary");

sheet.getRange("A1:B3").values = [
  ["Name", "Count"],
  ["Ada", 3],
  ["Grace", 5],
];
sheet.getRange("B4").formulas = [["=SUM(B2:B3)"]];
sheet.getRange("A1:B1").format = {
  font: { bold: true, color: "#ffffff" },
  fill: "#1f4e78",
  horizontalAlignment: "center",
};
sheet.getRange("A1:B1").merge();
sheet.getRange("A:A").format.columnWidth = 18;

const result = workbook.recalculate();
const output = SpreadsheetFile.exportXlsx(workbook);
await output.save("/absolute/path/report.xlsx");
```

The first supported format fields are font bold/italic/color/size, fill color,
horizontal/vertical alignment, wrap text, number format, and column width.
Invalid colors, ranges, format values, or formula matrices fail with
`ArtifactToolError` codes.

Tables and charts are added as explicit worksheet collections after the range
foundation is stable:

```js
sheet.tables.add({ name: "SummaryTable", range: "A1:B3", hasHeaders: true });
sheet.charts.add({
  type: "column",
  position: "D2:J16",
  series: [{ name: "Count", categories: "A2:A3", values: "B2:B3" }],
});
```

## Formula policy

The first evaluator supports scalar references, range references, arithmetic,
and a bounded function set: `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`,
and `IF`. Formula strings are preserved in the XLSX even when evaluation is
not available. Unsupported functions, circular references, external links,
and malformed formulas produce structured diagnostics and leave the formula
uncalculated; they do not execute code or invoke a desktop spreadsheet app.

The exported workbook is marked for recalculation by spreadsheet applications
when a cached result is unavailable. `recalculate()` returns counts for total,
evaluated, and unsupported formulas so the Skill can report the exact state.

## Internal engine model

The private versioned request expands from scalar rows to optional metadata:

- cell values and formula matrices;
- range format records;
- merged ranges and column-width records;
- table definitions;
- chart definitions and series references;
- recalculation and inspection options.

Every field is optional so the existing scalar create/read/validate fixtures
continue to work. The engine validates row/column limits, sheet names, object
references, formula limits, and output paths before writing the workbook.

## Later artifact phases

After the Excel foundation:

1. PPTX: images, charts, richer text, themes/layouts, and full existing-deck
   import/editing.
2. DOCX: styles, lists, images, headers/footers, and full existing-document
   editing.
3. PDF: bundled creation, extraction, and rendering/validation.
4. Preview: render generated artifacts into a local viewer and connect output
   metadata to the Tauri workspace without changing AppServer/protocol.

Each format keeps explicit support boundaries and validation tests rather than
claiming full Office compatibility prematurely.

## Acceptance criteria for the first slice

- Builders can write and export formulas, basic formatting, merged ranges, and
  column widths through the public JS API.
- Supported formulas have deterministic cached results; unsupported formulas
  are reported with counts and remain preserved in the XLSX.
- Exported files validate with the existing bundled CLI and can be read back by
  the artifact runtime without losing supported metadata.
- Existing scalar workbook tests, DOCX/PPTX tests, staging tests, frontend
  tests, and Rust tests remain green.
- No AppServer, generated protocol, or Tauri command files change.
