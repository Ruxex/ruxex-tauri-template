---
name: ruxex-artifacts
description: Create, inspect, and validate local spreadsheet, document, and presentation artifacts with the bundled Ruxex APIs.
---

# Ruxex Artifacts

Use the bundled `ruxex-artifacts` command and the Ruxex-owned JavaScript API
for local artifact work. Do not install a package or depend on a system office
application. The command and its runtimes are available to agent shell sessions
through the managed runtime PATH.

## Workflow

1. Check support with `ruxex-artifacts capabilities --json`.
2. Write one `.mjs` builder that imports `@ruxex/artifact-tool`.
3. Create the requested `Workbook`, `Document`, or `Presentation`, or import
   an existing workbook/deck with `FileBlob` and the matching file facade.
4. Use the format-specific API to add values, formulas, formatting, merges,
   tables, charts, text, headings, slides, and supported editable shapes.
5. Call `inspect()` and save the file-facade output to an explicit absolute
   output path. Keep the returned JSON result available; the desktop preview
   recognizes its explicit `format` and `output` fields.
6. Always run the matching `xlsx validate`, `docx validate`, or `pptx validate`
   command on the generated file.
7. Report the absolute output path and validation result.

## API examples

```js
import {
  FileBlob,
  Document,
  Presentation,
  PresentationFile,
  SpreadsheetFile,
  Workbook,
} from "@ruxex/artifact-tool";

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Summary");
sheet.getRange("A1:B3").values = [["Name", "Count"], ["Ada", 3], ["Grace", 5]];
sheet.getRange("B4").formulas = [["=SUM(B2:B3)"]];
sheet.getRange("A1:B1").format = {
  font: { bold: true, color: "#ffffff" },
  fill: "#1f4e78",
  horizontalAlignment: "center",
};
sheet.getRange("A1:B1").merge();
sheet.getRange("A1:A4").format = { columnWidth: 18 };
sheet.tables.add({ name: "SummaryTable", range: "A1:B3", hasHeaders: true });
sheet.charts.add({
  type: "column",
  position: "D2:J16",
  series: [{ name: "Count", categories: "A2:A3", values: "B2:B3" }],
});
const calculation = workbook.recalculate();
if (!calculation.ok || calculation.unsupported !== 0) throw new Error("formula calculation failed");
const workbookFile = SpreadsheetFile.exportXlsx(workbook);
const saved = await workbookFile.save("/absolute/path/report.xlsx");
console.log(JSON.stringify(saved));

const existingWorkbook = await SpreadsheetFile.importXlsx(
  await FileBlob.load("/absolute/path/input.xlsx"),
);
await existingWorkbook.inspect();

const document = await Document.create({ title: "Project Report" });
document.addHeading("Project Report", 1);
document.addParagraph("Generated locally by Ruxex.");
document.addTable([["Area", "Status"], ["Artifacts", "Ready"]]);
await document.inspect();
await document.exportDocx("/absolute/path/report.docx");

const presentation = Presentation.create({ title: "Project Review" });
const slide = presentation.slides.add({ layout: "title" });
slide.shapes.add({
  geometry: "textbox",
  position: { left: 72, top: 64, width: 800, height: 80 },
  text: "Project Review",
});
slide.tables.add({
  position: { left: 72, top: 180, width: 640, height: 180 },
  rows: [["Area", "Status"], ["PPTX", "Ready"]],
});
slide.shapes.add({
  geometry: "rect",
  position: { left: 80, top: 400, width: 120, height: 60 },
});
await presentation.inspect();
const presentationFile = PresentationFile.exportPptx(presentation);
await presentationFile.save("/absolute/path/review.pptx");
```

`SpreadsheetFile.importXlsx()` currently imports sheet names and scalar cell
values. `PresentationFile.importPptx()` is a shallow import for validation and
source tracking; it does not yet expose existing slide objects for editing.
Workbook and presentation file I/O is facade-only: use `Workbook` and
`Presentation` for in-memory editing, then use the matching `*File` facade to
import or export a file. The Word `Document` facade currently creates new
documents and performs structural validation; full existing-file editing is
not yet available.

## Workbook generation support

The bundled workbook runtime evaluates formulas locally before export. Supported
functions are `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, and `IF`, along
with cell/range references, arithmetic, and comparisons. `recalculate()` returns
`{ ok, formulas, evaluated, unsupported }`; unsupported or circular formulas are
reported and do not execute.

Range formatting supports font bold/italic/size/color, fill color, horizontal
and vertical alignment, wrapping, number formats, and column widths. Ranges can
be merged, and worksheets can add tables plus column, bar, line, pie, or doughnut
charts. These features are serialized by the bundled native engine, so no
system Office tooling, Node package, or external office runtime is required.

When the builder prints the JSON returned by `ArtifactOutput.save()`, the
desktop conversation can show an in-app image preview for generated XLSX files.
The current preview is a bounded SVG rendering of scalar worksheet values; it
does not execute formulas, macros, external links, or embedded content. DOCX,
PPTX, and PDF image rendering are separate future renderer phases.

## Commands

```sh
ruxex-artifacts capabilities --json
ruxex-artifacts run /absolute/path/build.mjs
ruxex-artifacts xlsx validate --input /absolute/path/report.xlsx --json
ruxex-artifacts docx read --input /absolute/path/report.docx --json
ruxex-artifacts docx validate --input /absolute/path/report.docx --json
ruxex-artifacts pptx read --input /absolute/path/review.pptx --json
ruxex-artifacts pptx validate --input /absolute/path/review.pptx --json
```

Successful commands emit JSON on stdout. Failures emit a structured JSON
diagnostic on stderr and return a non-zero status. Treat output paths as
explicit user-scoped file paths and do not execute artifact content.
