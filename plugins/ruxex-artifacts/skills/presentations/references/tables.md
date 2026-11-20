# Tables

Create an editable rectangular table with `slide.tables.add({ rows, position })`.
Cells accept strings, finite numbers, booleans, or null. Use `table.getCell()`
or `table.cells` to edit values and styles; tables also support merge/unmerge,
row and column insertion/deletion, widths, heights, fill, borders, margins, and
vertical anchoring for supported properties.

```js
const table = slide.tables.add({
  position: { left: 72, top: 220, width: 720, height: 220 },
  rows: [["Region", "Revenue"], ["East", 42], ["West", 38]],
});
table.getCell(1, 1).text = "42";
```

Use `fr()` or `fixed()` from the package for supported column tracks. Exact
PowerPoint behavior for some horizontal overflow and complex merged-cell
imports is limited. For displayed totals, use the
[native evidence guide](native-evidence.md) and check source values separately.
