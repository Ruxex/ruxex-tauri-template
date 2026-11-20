# Local spreadsheet API

Ruxex exposes one local workbook API. Its support list is available at runtime with `Workbook.capabilities()` and searchable with `workbook.help(query)`. Use the list before selecting a feature; unsupported features are not silently approximated.

## Import source data

```js
import { SpreadsheetFile } from "@ruxex/artifact-tool";

const workbook = await SpreadsheetFile.import("/absolute/path/source.csv");
const sheet = workbook.worksheets.getActiveWorksheet();
const used = sheet.getUsedRange();
```

`SpreadsheetFile.importCSV(path, { delimiter, sheetName })` accepts CSV/TSV text files. `SpreadsheetFile.import(path)` also reads `.xlsx` and `.xls`. Legacy `.xls` exposes cell values and dimensions as source data; its formula text, formatting, and embedded objects are not imported. Ruxex exports `.xlsx` only.

## Range operations

Ranges support `values`, `formulas`, `format`, `dataValidation`, `conditionalFormats.add("cellIs", config)`, `offset`, `resize`, `getCell`, `getRow`, `getColumn`, `getCurrentRegion`, `copyFrom`, `copyTo`, `fillDown`, `fillRight`, and `clear({applyTo: "contents" | "formats" | "all"})`. `getRangeByIndexes(row, column, rowCount, columnCount)` uses zero-based indexes. Row/column insertion and deletion, sorting and filtering, and per-cell border or row-height layout operations are not exposed.

## Data validation

List rules accept inline strings or an Excel source formula. Numeric rules accept `whole` or `decimal` values with a comparison operator.

```js
sheet.dataValidations.add({
  range: "B2:B100",
  rule: { type: "list", values: ["Not Started", "In Progress", "Done"] },
});

sheet.getRange("C2:C100").dataValidation = {
  rule: { type: "whole", operator: "between", formula1: 1, formula2: 10 },
};
```

Validation authoring is supported for inline lists, whole numbers, and decimal numbers. Rich prompt/error messages and additional Excel validation families are not exposed yet.

## Conditional formatting

Numeric cell-value rules can apply a fill and/or font differential format:

```js
sheet.getRange("C2:C100").conditionalFormats.add("cellIs", {
  operator: "greaterThanOrEqual",
  formula: 0,
  format: { fill: "#D9EAD3", font: { bold: true, color: "#38761D" } },
});
```

Other conditional-format families and import inspection are not exposed yet.

## Tables

`sheet.tables.add(range, hasHeaders, name)` creates a table. The returned table supports `getHeaderRowRange()`, `getDataRows()`, `rows.add(null, values)` to append rows, table visibility toggles, and `delete()`. Table ranges cannot overlap. The XLSX writer serializes the default `TableStyleMedium2` style; other styles fail explicitly.

## Formula recalculation and inspection

The local evaluator covers common arithmetic, aggregates, logical, text, conditional aggregate, lookup, and cross-sheet reference formulas. Check the `evaluated` and `unsupported` counts from `workbook.recalculate()`. Unsupported formulas stay in the workbook and their imported cached values are retained. `workbook.inspect({kind: "range", sheetName, range})` returns bounded cell values and formula text. `workbook.trace("Sheet1!C4")` recursively lists cell references with a node limit. Named ranges, structured references, iteration, and native What-If Data Tables are not exposed yet.

## Render previews

```js
const preview = await workbook.render({ sheetName: "Summary", scale: 1 });
```

This uses the shared bundled LibreOffice and Poppler tools. It returns the first printed page as a PNG. It does not currently accept print-area, auto-crop, or pagination settings.

## Fidelity

Ruxex imports cell values, formula text and supported sheet objects through its local engine. Export rebuilds an `.xlsx` from the supported model and does not yet preserve every unsupported OOXML package part from an imported workbook. If the source relies on macros, uncommon drawings, PivotTables, comments, conditional formatting, sparklines, or other unsupported features, preserve the original and do not treat a round trip as lossless.
