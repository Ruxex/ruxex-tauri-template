import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { PdfDocument } from "../src/pdf.mjs";

test("PdfDocument creates a local multi-page text PDF", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-pdf-sdk-"));
  const output = join(directory, "nested", "report.pdf");
  const imagePath = join(directory, "mark.png");
  await writeFile(imagePath, Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ));
  const document = PdfDocument.create({ title: "Project Report", allowedRoots: [directory] });
  const page = document.addPage();
  page.addText("Page one", { x: 48, y: 780, size: 18 });
  page.addTable([["Name", "Value"], ["Ada", 3]], { x: 48, y: 700 });
  page.addImage(imagePath, { x: 48, y: 500, width: 72, height: 72 });
  document.addPage().addText("Page two", { x: 48, y: 780, size: 18 });

  assert.deepEqual(await document.inspect(), {
    ok: true,
    valid: true,
    pages: 2,
    textBlocks: 4,
  });
  await document.exportPdf(output);
  assert.equal((await readFile(output)).subarray(0, 5).toString(), "%PDF-");
});
