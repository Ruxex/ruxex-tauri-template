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
3. Create the requested `Workbook`, `Document`, or `Presentation`.
4. Use the format-specific API to add values, text, headings, tables, slides,
   and supported editable shapes.
5. Call `inspect()` and export to an explicit absolute output path.
6. Always run the matching `xlsx validate`, `docx validate`, or `pptx validate`
   command on the generated file.
7. Report the absolute output path and validation result.

## API examples

```js
import {
  Document,
  Presentation,
  Workbook,
} from "@ruxex/artifact-tool";

const workbook = await Workbook.create();
const sheet = workbook.worksheets.add("Summary");
sheet.getRange("A1:B2").values = [["Name", "Count"], ["Ada", 3]];
workbook.recalculate();
await workbook.exportXlsx("/absolute/path/report.xlsx");

const document = await Document.create({ title: "Project Report" });
document.addHeading("Project Report", 1);
document.addParagraph("Generated locally by Ruxex.");
document.addTable([["Area", "Status"], ["Artifacts", "Ready"]]);
await document.inspect();
await document.exportDocx("/absolute/path/report.docx");

const presentation = await Presentation.create({ title: "Project Review" });
const slide = presentation.addSlide({ layout: "title" });
slide.addText("Project Review", { role: "title" });
slide.addText("Local artifact generation", { role: "body" });
slide.addTable([["Area", "Status"], ["DOCX", "Ready"]]);
slide.addShape("rect", { x: 1, y: 1, w: 2, h: 1 });
await presentation.inspect();
await presentation.exportPptx("/absolute/path/review.pptx");
```

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
