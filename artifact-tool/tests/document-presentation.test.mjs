import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Document, Presentation } from "../src/index.mjs";

test("Document creates editable paragraphs and tables", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-document-sdk-"));
  const output = join(directory, "nested", "report.docx");
  const document = await Document.create({ title: "Project Report" });

  document.addHeading("Project Report", 1);
  document.addParagraph("Generated locally by Ruxex.");
  document.addTable([
    ["Area", "Status"],
    ["Artifacts", "Ready"],
  ]);

  assert.deepEqual(await document.inspect(), {
    ok: true,
    valid: true,
    paragraphs: 2,
    tables: 1,
  });
  await document.exportDocx(output);
  assert.equal((await readFile(output)).subarray(0, 2).toString(), "PK");
});

test("Document rejects unsupported table cell values", async () => {
  const document = await Document.create();

  assert.throws(
    () => document.addTable([["Area"], [{ nested: true }]]),
    (error) => error.code === "unsupported_cell_value",
  );
});

test("Presentation creates editable slides with text, tables, and shapes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-presentation-sdk-"));
  const output = join(directory, "nested", "review.pptx");
  const presentation = await Presentation.create({ title: "Project Review" });
  const slide = presentation.addSlide({ layout: "title" });

  slide.addText("Project Review", { role: "title" });
  slide.addText("Local artifact generation", { role: "body" });
  slide.addTable([["Area", "Status"], ["DOCX", "Ready"]]);
  slide.addShape("rect", { x: 1, y: 1, w: 2, h: 1 });

  assert.deepEqual(await presentation.inspect(), {
    ok: true,
    valid: true,
    slides: 1,
    objects: 4,
  });
  await presentation.exportPptx(output);
  assert.equal((await readFile(output)).subarray(0, 2).toString(), "PK");
});

test("Presentation rejects unsupported shapes", async () => {
  const presentation = await Presentation.create();
  const slide = presentation.addSlide();

  assert.throws(
    () => slide.addShape("unsupported-shape"),
    (error) => error.code === "unsupported_shape",
  );
});
