import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { ArtifactOutput, FileBlob } from "../src/file-blob.mjs";
import { SpreadsheetFile, Workbook } from "../src/index.mjs";

test("FileBlob loads a local file lazily and reports its format", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-file-blob-"));
  const inputPath = join(directory, "source.xlsx");
  await writeFile(inputPath, Buffer.from("PK\x03\x04"));

  const input = await FileBlob.load(inputPath);

  assert.equal(input.path, inputPath);
  assert.equal(input.name, "source.xlsx");
  assert.equal(input.type, "xlsx");
  assert.deepEqual([...new Uint8Array(await input.arrayBuffer())], [80, 75, 3, 4]);
});

test("FileBlob rejects missing paths and directories", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-file-blob-"));

  await assert.rejects(
    FileBlob.load(join(directory, "missing.xlsx")),
    (error) => error.code === "invalid_input_path",
  );
  await assert.rejects(
    FileBlob.load(directory),
    (error) => error.code === "invalid_input_path",
  );
});

test("ArtifactOutput saves bytes and creates nested parent directories", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-artifact-output-"));
  const outputPath = join(directory, "nested", "result.pptx");
  const output = ArtifactOutput.fromBytes(Buffer.from("artifact"), "pptx");

  assert.equal(output.format, "pptx");
  assert.deepEqual(await output.save(outputPath), {
    ok: true,
    format: "pptx",
    output: outputPath,
  });
  assert.equal((await readFile(outputPath)).toString(), "artifact");
});

test("SpreadsheetFile imports from a path or FileBlob and exports a saveable workbook", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-spreadsheet-file-"));
  const inputPath = join(directory, "source.xlsx");
  const outputPath = join(directory, "nested", "result.xlsx");
  const source = await Workbook.create();
  const sheet = source.worksheets.add("Summary");
  sheet.getRange("A1:B2").values = [
    ["Name", "Count"],
    ["Ada", 3],
  ];
  await source.exportXlsx(inputPath);

  const fromPath = await SpreadsheetFile.importXlsx(inputPath);
  const fromBlob = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));

  assert.deepEqual(fromPath.worksheets.getItem("Summary").getRange("A1:B2").values, [
    ["Name", "Count"],
    ["Ada", 3],
  ]);
  assert.deepEqual(fromBlob.worksheets.getItem("Summary").getRange("A1:B2").values, [
    ["Name", "Count"],
    ["Ada", 3],
  ]);

  const output = await SpreadsheetFile.exportXlsx(fromBlob);
  assert.equal(output.format, "xlsx");
  await output.save(outputPath);
  const validated = await Workbook.load(outputPath);
  assert.deepEqual(validated.worksheets.getItem("Summary").getRange("A1:B2").values, [
    ["Name", "Count"],
    ["Ada", 3],
  ]);
});

test("SpreadsheetFile rejects non-workbook exports", async () => {
  assert.throws(
    () => SpreadsheetFile.exportXlsx({}),
    (error) => error.code === "invalid_workbook",
  );
});
