import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Workbook } from "../src/index.mjs";

test("Workbook exposes Codex-shaped worksheet and range operations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-artifact-sdk-"));
  const output = join(directory, "report.xlsx");
  const workbook = await Workbook.create();
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
  await workbook.exportXlsx(output);
  assert.equal((await readFile(output)).subarray(0, 2).toString(), "PK");

  const loaded = await Workbook.load(output);
  assert.deepEqual(loaded.worksheets.getItem("Summary").getRange("A1:B2").values, [
    ["Name", "Count"],
    ["Ada", 3],
  ]);
});

test("Workbook inspection reports sheet dimensions", async () => {
  const workbook = await Workbook.create();
  const sheet = workbook.worksheets.add("Summary");
  sheet.getRange("A1:C2").values = [[1, 2, 3], [4, 5, 6]];

  const inspection = await workbook.inspect({ kind: "sheet", sheetName: "Summary" });

  assert.equal(inspection.sheets[0].name, "Summary");
  assert.equal(inspection.sheets[0].rows, 2);
  assert.equal(inspection.sheets[0].columns, 3);
});

test("Range rejects unsupported A1 addresses explicitly", async () => {
  const workbook = await Workbook.create();
  const sheet = workbook.worksheets.add("Summary");

  assert.throws(() => sheet.getRange("A0:B2"), (error) => error.code === "invalid_range");
  assert.throws(() => sheet.getRange("not-a-range"), (error) => error.code === "invalid_range");
});

test("render reports a structured unsupported-operation error when unavailable", async () => {
  const workbook = await Workbook.create();

  await assert.rejects(
    workbook.render({ sheetName: "Summary" }),
    (error) => error.code === "unsupported_operation",
  );
});
