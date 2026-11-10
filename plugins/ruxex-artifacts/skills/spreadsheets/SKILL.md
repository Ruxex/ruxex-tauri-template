---
name: spreadsheets
description: Create, inspect, validate, and preview local spreadsheet artifacts with the bundled Ruxex APIs.
---

# Spreadsheets

Use the bundled `ruxex-artifacts` command and the Ruxex-owned JavaScript API
for local spreadsheet work. Do not install a package or depend on a system
office application. The command and its runtimes are available through the
managed runtime PATH.

## Workflow

1. Check support with `ruxex-artifacts capabilities --json`.
2. Write one `.mjs` builder that imports `@ruxex/artifact-tool`.
3. Create or import a `Workbook` and populate worksheets, formulas, formatting,
   tables, and charts.
4. Recalculate and inspect the workbook before exporting it.
5. Run the builder with `ruxex-artifacts run /absolute/path/build.mjs`.
6. Run `ruxex-artifacts xlsx validate --input /absolute/path/report.xlsx --json`.
7. Report the absolute output path and validation result.

## Example

```js
import { SpreadsheetFile, Workbook } from "@ruxex/artifact-tool";

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Summary");
sheet.getRange("A1:B3").values = [["Area", "Status"], ["Spreadsheets", "Ready"], ["Total", 1]];
sheet.getRange("A1:B1").format = { font: { bold: true } };
const calculation = workbook.recalculate();
if (!calculation.ok) throw new Error("formula calculation failed");
await workbook.inspect();
const file = SpreadsheetFile.exportXlsx(workbook);
await file.save("/absolute/path/report.xlsx");
```
