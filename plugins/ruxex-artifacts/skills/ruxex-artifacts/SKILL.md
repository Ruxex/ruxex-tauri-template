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
4. Use the format-specific API to add values, text, headings, tables, slides,
   and supported editable shapes.
5. Call `inspect()` and save the file-facade output to an explicit absolute
   output path.
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

const workbook = await Workbook.create();
const sheet = workbook.worksheets.add("Summary");
sheet.getRange("A1:B2").values = [["Name", "Count"], ["Ada", 3]];
workbook.recalculate();
const workbookFile = await SpreadsheetFile.exportXlsx(workbook);
await workbookFile.save("/absolute/path/report.xlsx");

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
const presentationFile = await PresentationFile.exportPptx(presentation);
await presentationFile.save("/absolute/path/review.pptx");
```

`SpreadsheetFile.importXlsx()` currently imports sheet names and scalar cell
values. `PresentationFile.importPptx()` is a shallow import for validation and
source tracking; it does not yet expose existing slide objects for editing.
Use the direct `Workbook`, `Presentation`, and `Document` methods when a
compatibility facade is not needed. The Word `Document` facade currently
creates new documents and performs structural validation; full existing-file
editing is not yet available.

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
