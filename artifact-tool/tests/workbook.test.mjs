import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FileBlob, SpreadsheetFile, Workbook } from "../src/index.mjs";

test("Workbook exposes Codex-shaped worksheet and range operations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-artifact-sdk-"));
  const output = join(directory, "report.xlsx");
  const workbook = Workbook.create();
  assert.equal(workbook instanceof Promise, false);
  assert.equal(typeof workbook.load, "undefined");
  assert.equal(typeof workbook.exportXlsx, "undefined");
  const sheet = workbook.worksheets.add("Summary");
  const range = sheet.getRange("A1:B2");

  range.values = [
    ["Name", "Count"],
    ["Ada", 3],
  ];

  assert.deepEqual(range.values, [
    ["Name", "Count"],
    ["Ada", 3],
  ]);
  workbook.recalculate();
  const workbookFile = SpreadsheetFile.exportXlsx(workbook);
  await workbookFile.save(output);
  assert.equal((await readFile(output)).subarray(0, 2).toString(), "PK");

  const loaded = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  assert.deepEqual(loaded.worksheets.getItem("Summary").getRange("A1:B2").values, [
    ["Name", "Count"],
    ["Ada", 3],
  ]);
});

test("Workbook inspection reports sheet dimensions", async () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Summary");
  sheet.getRange("A1:C2").values = [[1, 2, 3], [4, 5, 6]];

  const inspection = await workbook.inspect({ kind: "sheet", sheetName: "Summary" });

  assert.equal(inspection.sheets[0].name, "Summary");
  assert.equal(inspection.sheets[0].rows, 2);
  assert.equal(inspection.sheets[0].columns, 3);
});

test("Workbook inspection can return bounded range values and formulas", async () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Summary");
  sheet.getRange("A1:B2").values = [["Item", 2], ["Total", null]];
  sheet.getRange("B2").formulas = [["=B1*2"]];

  const inspection = await workbook.inspect({ kind: "range", sheetName: "Summary", range: "A1:B2" });
  assert.deepEqual(inspection.values, [["Item", 2], ["Total", null]]);
  assert.deepEqual(inspection.formulas, [[null, null], [null, "=B1*2"]]);
});

test("Workbook.trace expands formula range precedents", () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Summary");
  sheet.getRange("A1:B1").values = [[2, 3]];
  sheet.getRange("C1").formulas = [["=SUM(A1:B1)*2"]];

  const trace = workbook.trace("Summary!C1");
  assert.equal(trace.cell, "Summary!C1");
  assert.deepEqual(trace.precedents.map((node) => node.cell), ["Summary!A1", "Summary!B1"]);
});

test("Range rejects unsupported A1 addresses explicitly", async () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Summary");

  assert.throws(() => sheet.getRange("A0:B2"), (error) => error.code === "invalid_range");
  assert.throws(() => sheet.getRange("not-a-range"), (error) => error.code === "invalid_range");
});

test("render reports a structured unsupported-operation error when unavailable", async () => {
  const workbook = Workbook.create();

  await assert.rejects(
    workbook.render({ sheetName: "Summary" }),
    (error) => error.code === "missing_runtime_resource",
  );
});

test("Workbook supports formulas, formatting, merges, tables, and charts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-rich-workbook-sdk-"));
  const output = join(directory, "rich.xlsx");
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Summary");

  sheet.getRange("A1:B3").values = [
    ["Name", "Count"],
    ["Ada", 3],
    ["Grace", 5],
  ];
  sheet.getRange("B4").formulas = [["=SUM(B2:B3)"]];

  assert.deepEqual(sheet.getRange("B4").formulas, [["=SUM(B2:B3)"]]);
  const recalculated = workbook.recalculate();
  assert.deepEqual(recalculated, { ok: true, formulas: 1, evaluated: 1, unsupported: 0 });
  assert.deepEqual(sheet.getRange("B4").values, [[8]]);

  sheet.getRange("A1:B1").format = {
    font: { bold: true, color: "#ffffff" },
    fill: "#1f4e78",
    horizontalAlignment: "center",
    wrapText: true,
  };
  sheet.getRange("A1:B1").merge();
  sheet.getRange("A1:A4").format = { columnWidth: 18 };
  sheet.tables.add({ name: "SummaryTable", range: "A1:B3", hasHeaders: true });
  sheet.charts.add({
    type: "column",
    position: "D2:J16",
    series: [{ name: "Count", categories: "A2:A3", values: "B2:B3" }],
  });

  await SpreadsheetFile.exportXlsx(workbook).save(output);
  assert.equal((await readFile(output)).subarray(0, 2).toString(), "PK");
  const imported = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  const importedSheet = imported.worksheets.getItem("Summary");
  assert.equal(importedSheet.tables.items[0].name, "SummaryTable");
  assert.equal(importedSheet.charts.items[0].type, "column");
  assert.equal(importedSheet.merges[0].range, "A1:B1");
});

test("Workbook tables support Codex-shaped add, row access, append, toggles, and delete", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-table-sdk-"));
  const output = join(directory, "table.xlsx");
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Summary");
  sheet.getRange("A1:B2").values = [["Name", "Count"], ["Ada", 3]];
  const table = sheet.tables.add("A1:B2", true, "SummaryTable");

  assert.equal(table.name, "SummaryTable");
  assert.equal(table.getHeaderRowRange().values[0][0], "Name");
  assert.deepEqual(table.getDataRows().values, [["Ada", 3]]);
  table.rows.add(null, [["Grace", 5]]);
  assert.equal(sheet.getRange("A3:B3").values[0][0], "Grace");
  table.showTotals = true;
  table.showBandedColumns = true;
  assert.equal(table.showTotals, true);
  assert.equal(table.showBandedColumns, true);
  await SpreadsheetFile.exportXlsx(workbook).save(output);
  const importedTable = (await SpreadsheetFile.importXlsx(await FileBlob.load(output))).worksheets.getItem("Summary").tables.items[0];
  assert.equal(importedTable.showTotals, true);
  assert.equal(importedTable.showBandedColumns, true);
  table.delete();
  assert.equal(sheet.tables.items.length, 0);
});

test("Workbook clears stale formulas when values replace them", () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Summary");

  sheet.getRange("A1").formulas = [["=1+1"]];
  sheet.getRange("A1").values = [[7]];

  assert.deepEqual(sheet.getRange("A1").formulas, [[null]]);
  assert.deepEqual(sheet.getRange("A1").values, [[7]]);
});

test("Workbook reports unsupported and circular formulas without executing them", () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Summary");

  sheet.getRange("A1:A3").formulas = [["=UNKNOWN(1)"], ["=A3"], ["=A2"]];

  const result = workbook.recalculate();
  assert.equal(result.formulas, 3);
  assert.equal(result.evaluated, 0);
  assert.equal(result.unsupported, 3);
  assert.deepEqual(sheet.getRange("A1:A3").formulas, [["=UNKNOWN(1)"], ["=A3"], ["=A2"]]);
});

test("Workbook evaluates common math, text, logical, conditional aggregation, and lookup formulas", () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Summary");
  sheet.getRange("A1:B4").values = [["North", 10], ["South", 20], ["North", 30], ["South", 40]];
  sheet.getRange("D1:D8").formulas = [
    ["=ROUND(2.345,2)"], ["=ABS(-5)"], ["=LEFT(\"Ruxex\",3)"], ["=LEN(\"Excel\")"],
    ["=AND(TRUE,1>0)"], ["=COUNTIF(A1:A4,\"North\")"], ["=SUMIF(A1:A4,\"South\",B1:B4)"], ["=VLOOKUP(\"North\",A1:B4,2,FALSE)"],
  ];

  const result = workbook.recalculate();
  assert.equal(result.evaluated, 8);
  assert.equal(result.unsupported, 0);
  assert.deepEqual(sheet.getRange("D1:D8").values, [[2.35], [5], ["Rux"], [5], [true], [2], [60], [10]]);
});

test("Workbook retains imported cached values when a formula is unsupported", () => {
  const workbook = new Workbook([{ name: "Summary", rows: [[42]], formulas: [["=UNSUPPORTED(1)"]] }]);
  const result = workbook.recalculate();

  assert.equal(result.unsupported, 1);
  assert.deepEqual(workbook.worksheets.getItem("Summary").getRange("A1").values, [[42]]);
});

test("Workbook evaluates quoted and unquoted cross-sheet cell and range references", () => {
  const workbook = Workbook.create();
  const inputs = workbook.worksheets.add("Input Data");
  inputs.getRange("A1:A2").values = [[4], [6]];
  const summary = workbook.worksheets.add("Summary");
  summary.getRange("A1:A2").formulas = [["='Input Data'!A1+2"], ["=SUM('Input Data'!A1:A2)"]];

  const result = workbook.recalculate();
  assert.equal(result.evaluated, 2);
  assert.deepEqual(summary.getRange("A1:A2").values, [[6], [10]]);
});

test("Workbook rejects malformed rich metadata", () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Summary");

  assert.throws(
    () => {
      sheet.getRange("A1").format = { fill: "not-a-color" };
    },
    (error) => error.code === "invalid_format",
  );
  assert.throws(
    () => sheet.tables.add({ name: "Broken", range: "A0:B2" }),
    (error) => error.code === "invalid_range",
  );
});

test("Workbook writes list and numeric data validation rules through the local XLSX engine", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-validation-sdk-"));
  const output = join(directory, "validation.xlsx");
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Inputs");
  sheet.getRange("A1:A2").values = [["Status"], ["Ready"]];
  sheet.dataValidations.add({ range: "A2:A20", rule: { type: "list", values: ["Ready", "Blocked"] } });
  sheet.getRange("B2:B10").dataValidation = { rule: { type: "whole", operator: "between", formula1: 1, formula2: 5 } };

  assert.equal(sheet.dataValidations.items.length, 2);
  await SpreadsheetFile.exportXlsx(workbook).save(output);
  assert.ok((await readFile(output)).length > 1000);
});

test("Workbook writes numeric conditional formatting rules through the local XLSX engine", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-cf-sdk-"));
  const output = join(directory, "conditional.xlsx");
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Summary");
  sheet.getRange("A1:A3").values = [[1], [2], [3]];
  sheet.getRange("A1:A3").conditionalFormats.add("cellIs", {
    operator: "greaterThanOrEqual",
    formula: 2,
    format: { fill: "#D9EAD3", font: { bold: true, color: "#38761D" } },
  });

  assert.equal(sheet.getRange("A1:A3").conditionalFormats.items.length, 1);
  await SpreadsheetFile.exportXlsx(workbook).save(output);
  assert.ok((await readFile(output)).length > 1000);
});

test("Workbook writes worksheet images and cell notes through the local XLSX engine", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-drawing-sdk-"));
  const output = join(directory, "drawing.xlsx");
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Summary");
  sheet.getRange("A1").values = [["Result"]];
  sheet.images.add({
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII=",
    anchor: { from: { row: 1, col: 1 }, extent: { widthPx: 32, heightPx: 24 } },
  });
  workbook.notes.add({
    target: { cell: { sheetName: "Summary", address: "A1" } },
    authorId: "Analyst",
    body: { plainText: "Imported from the local source file." },
  });

  assert.equal(sheet.images.items.length, 1);
  assert.equal(workbook.notes.items.length, 1);
  await SpreadsheetFile.exportXlsx(workbook).save(output);
  assert.ok((await readFile(output)).length > 1000);
});
