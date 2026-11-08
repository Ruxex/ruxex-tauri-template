import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { ArtifactOutput, FileBlob } from "../src/file-blob.mjs";
import { PresentationFile, SpreadsheetFile, Workbook, Presentation } from "../src/index.mjs";

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

test("PresentationFile exposes Codex-shaped slide, shape, and table collections", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-presentation-file-"));
  const outputPath = join(directory, "nested", "review.pptx");
  const presentation = Presentation.create({ title: "Project Review" });
  const slide = presentation.slides.add();

  slide.shapes.add({
    geometry: "textbox",
    position: { left: 72, top: 64, width: 800, height: 80 },
    text: "Project Review",
  });
  slide.tables.add({
    position: { left: 72, top: 180, width: 640, height: 180 },
    rows: [["Area", "Status"], ["PPTX", "Ready"]],
  });
  slide.shapes.add({
    geometry: "rect",
    position: { left: 80, top: 400, width: 120, height: 60 },
  });

  assert.equal(presentation.slides.items.length, 1);
  assert.deepEqual(slide.objects[0], {
    kind: "text",
    text: "Project Review",
    options: { x: 72, y: 64, w: 800, h: 80 },
  });
  assert.deepEqual(slide.objects[1], {
    kind: "table",
    rows: [["Area", "Status"], ["PPTX", "Ready"]],
    options: { x: 72, y: 180, w: 640, h: 180 },
  });
  assert.deepEqual(slide.objects[2], {
    kind: "shape",
    shape: "rect",
    options: { x: 80, y: 400, w: 120, h: 60 },
  });

  const output = await PresentationFile.exportPptx(presentation);
  assert.equal(output.format, "pptx");
  await output.save(outputPath);
  assert.equal((await readFile(outputPath)).subarray(0, 2).toString(), "PK");
});

test("PresentationFile imports paths and FileBlobs as explicit shallow documents", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-presentation-import-"));
  const inputPath = join(directory, "source.pptx");
  const source = await Presentation.create();
  source.addSlide().addText("Source");
  await source.exportPptx(inputPath);

  const fromPath = await PresentationFile.importPptx(inputPath);
  const fromBlob = await PresentationFile.importPptx(await FileBlob.load(inputPath));

  assert.equal(fromPath.sourcePath, inputPath);
  assert.equal(fromBlob.sourcePath, inputPath);
  await assert.rejects(
    Promise.resolve().then(() => fromPath.slides.add()),
    (error) => error.code === "unsupported_operation",
  );
});

test("Presentation shape adapters reject unsupported geometry", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();

  assert.throws(
    () => slide.shapes.add({ geometry: "ellipse" }),
    (error) => error.code === "unsupported_shape",
  );
});
