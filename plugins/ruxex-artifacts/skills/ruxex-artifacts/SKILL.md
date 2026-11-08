---
name: ruxex-artifacts
description: Create, inspect, and validate local XLSX files with the bundled Ruxex workbook API. Use when a user asks for a spreadsheet file or asks to inspect one.
---

# Ruxex Artifacts

Use the bundled `ruxex-artifacts` command and the Ruxex-owned workbook API for
local spreadsheet work. Do not install a package or depend on a system
application. The command is available to agent shell sessions through the
managed runtime PATH.

## Workflow

1. Check support with `ruxex-artifacts capabilities --json`.
2. Write one `.mjs` builder that imports `@ruxex/artifact-tool`.
3. Create or load a `Workbook`, add worksheets, and assign `Range.values`.
4. Call `workbook.recalculate()` and `workbook.inspect(...)`.
5. Export with `workbook.exportXlsx(absoluteOutputPath)`.
6. Always run `ruxex-artifacts xlsx validate` on the generated file.
7. Report the absolute output path and the validation result.

## Builder example

```js
import { Workbook } from "@ruxex/artifact-tool";

const workbook = await Workbook.create();
const sheet = workbook.worksheets.add("Summary");
sheet.getRange("A1:B2").values = [
  ["Name", "Count"],
  ["Ada", 3],
];

workbook.recalculate();
await workbook.inspect({ kind: "sheet", sheetName: "Summary" });
await workbook.exportXlsx("/absolute/path/report.xlsx");
```

## Commands

```sh
ruxex-artifacts capabilities --json
ruxex-artifacts run /absolute/path/build.mjs
ruxex-artifacts xlsx read --input /absolute/path/report.xlsx --json
ruxex-artifacts xlsx validate --input /absolute/path/report.xlsx --json
```

Successful commands emit JSON on stdout. Failures emit a structured JSON
diagnostic on stderr and return a non-zero status. Treat the output path as an
explicit user-scoped file path and do not execute workbook content.
