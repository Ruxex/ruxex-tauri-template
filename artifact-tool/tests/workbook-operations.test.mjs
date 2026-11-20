import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FileBlob, SpreadsheetFile, Workbook } from "../src/index.mjs";

test("Workbook.fromCSV parses quoted fields and infers numeric values without stripping identifier zeros", () => {
  const workbook = Workbook.fromCSV('Name,Note,Value,Code\r\nAda,"said ""hello"", yes",2.5,00123\r\nGrace,ready,0,00001', {
    sheetName: "Imported",
  });

  assert.deepEqual(workbook.worksheets.getItem("Imported").getUsedRange().values, [
    ["Name", "Note", "Value", "Code"],
    ["Ada", 'said "hello", yes', 2.5, "00123"],
    ["Grace", "ready", 0, "00001"],
  ]);
});

test("worksheet range helpers select by index, cell, used extent, and item index", () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Data");
  sheet.getRange("B2:C3").values = [[1, 2], [3, 4]];

  assert.equal(workbook.worksheets.getItemAt(0), sheet);
  assert.equal(workbook.worksheets.getActiveWorksheet(), sheet);
  assert.deepEqual(sheet.getRangeByIndexes(1, 1, 2, 2).values, [[1, 2], [3, 4]]);
  assert.deepEqual(sheet.getCell(2, 2).values, [[4]]);
  assert.deepEqual(sheet.getUsedRange().values, [[null, null, null], [null, 1, 2], [null, 3, 4]]);
});

test("ranges resize, offset, select rows and columns, copy, fill, and clear contents", () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Data");
  sheet.getRange("A1:B2").values = [[1, 2], [3, 4]];

  const source = sheet.getRange("A1:B1");
  assert.deepEqual(sheet.getRange("A1:B2").getRow(1).values, [[3, 4]]);
  assert.deepEqual(sheet.getRange("A1:B2").getColumn(1).values, [[2], [4]]);
  source.copyTo(sheet.getRange("A2:B2"), "values");
  assert.deepEqual(sheet.getRange("A2:B2").values, [[1, 2]]);
  assert.deepEqual(source.offset(1, 0).resize(1, 2).values, [[1, 2]]);

  sheet.getRange("A1:B2").clear({ applyTo: "contents" });
  assert.deepEqual(sheet.getRange("A1:B2").values, [[null, null], [null, null]]);
});

test("getCurrentRegion stops at blank rows and columns and treats an empty cell as a one-cell region", () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Data");
  sheet.getRange("A1:B2").values = [[1, 2], [3, 4]];
  sheet.getRange("D1:E2").values = [[5, 6], [7, 8]];
  sheet.getRange("A4:B4").values = [[9, 10]];

  assert.equal(sheet.getRange("B2").getCurrentRegion().bounds.reference, "A1:B2");
  assert.equal(sheet.getRange("E1").getCurrentRegion().bounds.reference, "D1:E2");
  assert.equal(sheet.getRange("C3").getCurrentRegion().bounds.reference, "C3");
});

test("fillDown and fillRight translate relative A1 references and retain anchored references", () => {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Calc");
  sheet.getRange("A1:C3").values = [[2, null, null], [3, null, null], [4, null, null]];
  sheet.getRange("B1").formulas = [['=A1+$A$1+"A1"']];
  sheet.getRange("B1:B3").fillDown();
  assert.deepEqual(sheet.getRange("B1:B3").formulas, [['=A1+$A$1+"A1"'], ['=A2+$A$1+"A1"'], ['=A3+$A$1+"A1"']]);

  sheet.getRange("A1").formulas = [["=1"]];
  sheet.getRange("A1:C1").fillRight();
  assert.deepEqual(sheet.getRange("A1:C1").formulas, [["=1", "=1", "=1"]]);
});

test("CSV parser rejects an unterminated quoted field", () => {
  assert.throws(() => Workbook.fromCSV('a,"broken'), (error) => error.code === "invalid_csv");
});

test("SpreadsheetFile imports CSV and TSV paths through the local workbook API", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-spreadsheet-csv-"));
  const csvPath = join(directory, "source.csv");
  const tsvPath = join(directory, "source.tsv");
  await writeFile(csvPath, "Account,Amount\n00123,4.5\n", "utf8");
  await writeFile(tsvPath, "Account\tAmount\n00008\t12\n", "utf8");

  const csv = await SpreadsheetFile.import(await FileBlob.load(csvPath));
  const tsv = await SpreadsheetFile.import(tsvPath);
  assert.deepEqual(csv.worksheets.getActiveWorksheet().getUsedRange().values, [["Account", "Amount"], ["00123", 4.5]]);
  assert.deepEqual(tsv.worksheets.getActiveWorksheet().getUsedRange().values, [["Account", "Amount"], ["00008", 12]]);
});
