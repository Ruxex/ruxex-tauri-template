# Tables and CSV Interchange

Ruxex can create basic rectangular Word tables with `Document.addTable(rows,
options)`. Cells support strings, finite numbers, booleans, and `null`. Options
include a repeating first-row header, borders, cell padding, fixed/autofit
layout, and column widths. Spreadsheet formatting is not imported.

To bring used cell values from an XLSX workbook into a DOCX, use the local
spreadsheet reader and document builder:

```js
import { Document, SpreadsheetFile } from "@ruxex/artifact-tool";

function columnName(number) {
  let value = number;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

const workbook = await SpreadsheetFile.importXlsx("/absolute/path/data.xlsx");
const document = await Document.create({ title: "Workbook data" });
for (const sheet of workbook.worksheets.items) {
  const { rows, columns } = sheet.dimensions();
  if (!rows || !columns) continue;
  const values = sheet.getRange(`A1:${columnName(columns)}${rows}`).values;
  document.addHeading(sheet.name, 1);
  document.addTable(values, { headerRow: true, layout: "autofit" });
}
await document.exportDocx("/absolute/path/workbook-data.docx");
```

This copies supported cell values and assumes the first row is a header. It does
not preserve formulas, charts, merged cells, conditional formatting, or source
cell styling.

To repair the geometry of existing unmerged top-level body tables, set the
column widths in DXA (twentieths of a point). For example, this sets a two-column
table to 4000 and 5000 DXA, with a total width of 9000 DXA:

```sh
ruxex-artifacts docx helper table-geometry-set \
  --input "/absolute/path/report.docx" \
  --output "/absolute/path/report-table-fixed.docx" \
  --table-index 0 \
  --column-widths-dxa 4000 5000
```

Omit `--table-index` to apply the same widths to every top-level table. The
helper synchronizes table width, grid columns, and each cell width, then applies
fixed layout, indentation, and consistent cell margins. It refuses merged cells
and rows whose cell count differs from the requested columns.

To extract Word table text as separate CSV files:

```sh
ruxex-artifacts docx helper tables-to-csv \
  --input "/absolute/path/report.docx" \
  --output-dir "/absolute/path/tables"
```

The helper writes one UTF-8 CSV file per top-level table in the main document
body. It exports visible cell text only; tables inside headers/footers, nested
table structure, formulas, formatting, merged cells, and embedded objects are
not retained. Review the CSV before using it as data.
