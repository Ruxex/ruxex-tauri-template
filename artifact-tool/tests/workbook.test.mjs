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
    (error) => error.code === "unsupported_operation",
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
