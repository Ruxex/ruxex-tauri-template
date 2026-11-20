import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";

import { Document, Presentation, PresentationFile, fixed, fr } from "../src/index.mjs";

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
    images: 0,
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

test("Document writes explicit table geometry", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-document-table-geometry-"));
  const output = join(directory, "table.docx");
  const document = await Document.create();
  document.addTable([["Label", "Details"], ["Status", "Ready"]], {
    columnWidths: [2, 3],
    width: 5,
    indent: 0.25,
    layout: "fixed",
  });
  await document.exportDocx(output);
  const zip = await JSZip.loadAsync(await readFile(output));
  const xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /<w:gridCol w:w="2880"\/>/);
  assert.match(xml, /<w:gridCol w:w="4320"\/>/);
  assert.match(xml, /<w:tblLayout w:type="fixed"\/>/);
  assert.match(xml, /<w:tblInd[^>]*w:w="360"/);
});

test("Document writes Codex-style title hierarchy and rich paragraph formatting", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-document-style-"));
  const output = join(directory, "styled.docx");
  const document = await Document.create({
    pageSize: "a4",
    orientation: "landscape",
    margins: { top: 0.5, right: 0.75, bottom: 0.5, left: 0.75 },
  });

  document.addTitle("Quarterly Report");
  document.addSubtitle("Operations review");
  document.addHeading("Summary", 1);
  document.addParagraph("The project is ready.", {
    alignment: "center",
    spacingAfter: 8,
    fontFace: "Arial",
    fontSize: 11,
    color: "334455",
    bold: true,
    italic: true,
    keepWithNext: true,
  });
  assert.deepEqual(await document.inspect(), {
    ok: true,
    valid: true,
    paragraphs: 4,
    tables: 0,
    images: 0,
  });
  await document.exportDocx(output);

  const zip = await JSZip.loadAsync(await readFile(output));
  const xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /w:pStyle w:val="Title"/);
  assert.match(xml, /w:pStyle w:val="Subtitle"/);
  assert.match(xml, /w:rFonts[^>]*w:ascii="Arial"/);
  assert.match(xml, /w:sz w:val="22"/);
  assert.match(xml, /w:color w:val="334455"/);
  assert.match(xml, /w:keepNext/);
  assert.match(xml, /w:orient="landscape"/);
  assert.match(xml, /w:pgSz[^>]*w:w="16838"[^>]*w:h="11906"/);
});

test("Document creates numbered items and accessible inline images", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-document-media-"));
  const output = join(directory, "media.docx");
  const document = await Document.create();
  document.addListItem("First step", { type: "numbered" });
  document.addImage(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xWQAAAAASUVORK5CYII=", "base64"), {
    type: "png",
    width: 24,
    height: 24,
    altText: "A small status chart",
  });
  await document.exportDocx(output);

  const zip = await JSZip.loadAsync(await readFile(output));
  const xml = await zip.file("word/document.xml").async("string");
  const numbering = await zip.file("word/numbering.xml").async("string");
  assert.match(xml, /w:numPr/);
  assert.match(xml, /wp:docPr[^>]*descr="A small status chart"/);
  assert.ok(zip.file("word/media/image1.png"));
  assert.match(numbering, /w:numFmt w:val="decimal"/);
});

test("Document requires alternative text for informative images", async () => {
  const document = await Document.create();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xWQAAAAASUVORK5CYII=", "base64");

  assert.throws(
    () => document.addImage(png, { type: "png", width: 24, height: 24 }),
    (error) => error.code === "invalid_document_options",
  );
});

test("Document exports anchored comments and tracked replacements", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-document-review-"));
  const output = join(directory, "review.docx");
  const document = await Document.create();
  document.addParagraph("Approve this wording.");
  document.addComment(0, "Please verify this claim.", {
    author: "Editor",
    initials: "ED",
    date: new Date("2026-11-19T00:00:00Z"),
  });
  document.addTrackedReplacement("Old wording", "New wording", {
    author: "Editor",
    date: new Date("2026-11-19T00:00:00Z"),
  });
  await document.exportDocx(output);

  const zip = await JSZip.loadAsync(await readFile(output));
  const xml = await zip.file("word/document.xml").async("string");
  const comments = await zip.file("word/comments.xml").async("string");
  const settings = await zip.file("word/settings.xml").async("string");
  assert.match(xml, /w:commentRangeStart w:id="0"/);
  assert.match(xml, /w:ins[^>]*w:author="Editor"/);
  assert.match(xml, /w:del[^>]*w:author="Editor"/);
  assert.match(comments, /Please verify this claim\./);
  assert.match(settings, /w:trackRevisions/);
});

test("Document creates internal and external links with footnotes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-document-links-"));
  const output = join(directory, "links.docx");
  const document = await Document.create();
  document.addBookmark("summary", "Summary");
  document.addInternalLink("Go to summary", "summary");
  document.addExternalLink("Source", "https://example.test/source");
  document.addParagraph("A sourced claim.");
  document.addFootnote(3, "Primary source, checked 2026-11-19.");
  await document.exportDocx(output);

  const zip = await JSZip.loadAsync(await readFile(output));
  const xml = await zip.file("word/document.xml").async("string");
  const relationships = await zip.file("word/_rels/document.xml.rels").async("string");
  const footnotes = await zip.file("word/footnotes.xml").async("string");
  assert.match(xml, /w:bookmarkStart[^>]*w:name="summary"/);
  assert.match(xml, /w:hyperlink[^>]*w:anchor="summary"/);
  assert.match(xml, /w:footnoteReference/);
  assert.match(relationships, /Target="https:\/\/example\.test\/source"/);
  assert.match(footnotes, /Primary source, checked 2026-11-19\./);
});

test("Document creates sections with page layout, headers, and numbered footers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-document-sections-"));
  const output = join(directory, "sections.docx");
  const document = await Document.create();
  document.addTitle("Proposal");
  document.setFooter("Confidential", { pageNumber: true });
  document.addSection({
    pageSize: "a4",
    orientation: "landscape",
    margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
  });
  document.setHeader("Appendix");
  document.addParagraph("Appendix content.");
  await document.exportDocx(output);

  const zip = await JSZip.loadAsync(await readFile(output));
  const xml = await zip.file("word/document.xml").async("string");
  const header = await zip.file("word/header1.xml").async("string");
  const footer = await zip.file("word/footer1.xml").async("string");
  assert.match(xml, /w:orient="landscape"/);
  assert.match(xml, /w:w="16838" w:h="11906"/);
  assert.match(header, /Appendix/);
  assert.match(footer, /Confidential/);
  assert.match(footer, /w:instrText[^>]*>PAGE<\/w:instrText/);
});

test("Document adds a Word-compatible text watermark", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-document-watermark-"));
  const output = join(directory, "watermarked.docx");
  const document = await Document.create();
  document.setWatermark("DRAFT", { color: "888888", opacity: 0.25, layout: "horizontal" });
  document.addParagraph("Review copy.");
  await document.exportDocx(output);

  const zip = await JSZip.loadAsync(await readFile(output));
  const header = await zip.file("word/header1.xml").async("string");
  assert.match(header, /DRAFT/);
  assert.match(header, /v:shape/);
  assert.throws(
    () => document.setWatermark("Draft", { opacity: 2 }),
    (error) => error.code === "invalid_document_options",
  );
});

test("Document writes editing protection settings", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-document-protection-"));
  const output = join(directory, "protected.docx");
  const document = await Document.create();
  document.setProtection({ type: "readOnly", password: "review" });
  document.addParagraph("Read-only review copy.");
  await document.exportDocx(output);

  const zip = await JSZip.loadAsync(await readFile(output));
  const settings = await zip.file("word/settings.xml").async("string");
  assert.match(settings, /w:documentProtection[^>]*w:edit="readOnly"/);
  assert.match(settings, /w:documentProtection[^>]*w:enforcement="true"/);
  assert.throws(
    () => document.setProtection({ type: "readOnly", password: "this-is-too-long" }),
    (error) => error.code === "invalid_document_options",
  );
});

test("Document adds a heading-based table of contents field", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-document-toc-"));
  const output = join(directory, "contents.docx");
  const document = await Document.create();
  document.addTableOfContents({ title: "Contents", headingStyleRange: "1-2" });
  document.addHeading("Summary", 1);
  document.addParagraph("Document overview.");
  await document.exportDocx(output);

  const zip = await JSZip.loadAsync(await readFile(output));
  const xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /TOC[^<]*\\o/);
  assert.match(xml, /Summary/);
  assert.match(xml, /Contents/);
});

test("Document adds bookmark reference and page-reference fields", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-document-fields-"));
  const output = join(directory, "fields.docx");
  const document = await Document.create();
  document.addBookmark("summary", "Summary");
  document.addReferenceField("summary", { cachedText: "Summary" });
  document.addReferenceField("summary", { pageNumber: true, cachedText: "1" });
  document.addSequenceField("Figure", { cachedText: "2" });
  await document.exportDocx(output);

  const zip = await JSZip.loadAsync(await readFile(output));
  const xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /w:instr="REF summary/);
  assert.match(xml, /w:instr="PAGEREF summary/);
  assert.match(xml, /w:instr="SEQ Figure/);
  assert.throws(
    () => document.addReferenceField("unknown"),
    (error) => error.code === "invalid_document_options",
  );
});

test("Document rejects invalid typography options", async () => {
  const document = await Document.create();

  assert.throws(
    () => document.addParagraph("Not readable", { fontSize: 0 }),
    (error) => error.code === "invalid_document_options",
  );
  assert.throws(
    () => document.addParagraph("Bad color", { color: "red" }),
    (error) => error.code === "invalid_document_options",
  );
});

test("Presentation creates editable slides with text, tables, and shapes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-presentation-sdk-"));
  const output = join(directory, "nested", "review.pptx");
  const presentation = Presentation.create({ title: "Project Review" });
  assert.equal(typeof presentation.addSlide, "undefined");
  assert.equal(typeof presentation.exportPptx, "undefined");
  const slide = presentation.slides.add({ layout: "title" });

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
  const presentationFile = PresentationFile.exportPptx(presentation);
  await presentationFile.save(output);
  assert.equal((await readFile(output)).subarray(0, 2).toString(), "PK");
});

test("Presentation themes resolve named colors and round trip through proto", async () => {
  const presentation = Presentation.create({ theme: { defaultFont: "Aptos" } });
  presentation.theme.colorScheme = {
    name: "Review",
    themeColors: {
      accent1: "#123456", accent2: "#234567", accent3: "#345678", accent4: "#456789", accent5: "#56789A", accent6: "#6789AB",
      bg1: "#FFFFFF", bg2: "#EEEEEE", tx1: "#111111", tx2: "#222222", dk1: "#000000", dk2: "#333333",
      lt1: "#FFFFFF", lt2: "#DDDDDD", hlink: "#0000FF", folHlink: "#800080",
    },
  };
  const slide = presentation.slides.add();
  slide.shapes.add({ geometry: "rect", fill: "accent1", position: { left: 20, top: 20, width: 100, height: 80 } });
  slide.addText("Token text", { x: 20, y: 120, w: 300, h: 40, color: "tx1" });
  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svg, /#123456/);
  const file = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(xml, /val="123456"/);
  const loaded = await Presentation.load(presentation.toProto());
  assert.equal(loaded.theme.defaultFont, "Aptos");
  assert.equal(loaded.theme.hexColorMap.accent1, "#123456");
});

test("Presentation exports its theme color scheme into PPTX theme metadata", async () => {
  const presentation = Presentation.create();
  const themeColors = presentation.theme.colorScheme.themeColors;
  themeColors.accent1 = "#2563EB";
  presentation.theme.colorScheme = { name: "Product Editorial", themeColors };
  const slide = presentation.slides.add();
  slide.shapes.add({ geometry: "rect", position: { left: 0, top: 0, width: 100, height: 100 }, fill: "accent1" });
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const themeXml = await zip.file("ppt/theme/theme1.xml").async("string");
  assert.match(themeXml, /clrScheme name="Product Editorial"/);
  assert.match(themeXml, /<a:accent1><a:srgbClr val="2563EB"\/><\/a:accent1>/);
  const directory = await mkdtemp(join(tmpdir(), "ruxex-theme-import-"));
  const inputPath = join(directory, "theme.pptx");
  await writeFile(inputPath, Buffer.from(await pptx.arrayBuffer()));
  const imported = await PresentationFile.importPptx(inputPath);
  assert.equal(imported.theme.colorScheme.name, "Product Editorial");
  assert.equal(imported.theme.hexColorMap.accent1.toLowerCase(), "#2563eb");
});

test("Presentation supports structured color, transparent solid, and pattern fills", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.shapes.add({ geometry: "rect", position: { left: 10, top: 10, width: 80, height: 80 }, fill: {
    type: "solid",
    color: { type: "rgb", value: "FF0000", transform: { opacity: 0.5 } },
    pattern: { type: "diagonalCross", color: "#0000FF" },
  } });
  slide.shapes.add({ geometry: "rect", position: { left: 100, top: 10, width: 80, height: 80 }, fill: "transparent" });
  slide.shapes.add({ geometry: "rect", position: { left: 190, top: 10, width: 80, height: 80 }, fill: "linear(135deg, #ffffff 0%, sky-100 100%)" });
  slide.shapes.add({ geometry: "rect", position: { left: 280, top: 10, width: 80, height: 80 }, fill: "radial(white/80 0%, emerald-700/0 100%)" });
  slide.shapes.add({ geometry: "rect", position: { left: 370, top: 10, width: 80, height: 80 }, fill: { type: "solid", color: "#FFFFFF", pattern: { type: "dotGrid", color: "#111111" } } });
  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svg, /pattern/);
  assert.match(svg, /<circle cx="1" cy="1" r="0\.8"/);
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /<a:pattFill prst="diagCross"/);
  assert.match(slideXml, /<a:alpha val="50000"/);
  assert.match(slideXml, /<a:solidFill><a:srgbClr val="000000"><a:alpha val="0"/);
  assert.equal((slideXml.match(/<a:gradFill/g) ?? []).length, 2);
  const inputPath = join(await mkdtemp(join(tmpdir(), "ruxex-pattern-import-")), "pattern.pptx");
  await writeFile(inputPath, Buffer.from(await pptx.arrayBuffer()));
  const imported = await PresentationFile.importPptx(inputPath);
  assert.equal(imported.slides.items[0].objects[0].options.fill.pattern.type, "diagonalCross");
});

test("Presentation parses optional CSS gradient stops and RGB color syntax", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const shape = slide.shapes.add({ geometry: "rect", position: { left: 0, top: 0, width: 300, height: 100 }, fill: "linear(135deg, rgb(15 23 42 / 12%), sky-100, #ffffff)" });
  assert.deepEqual(shape.fill.stops.map((stop) => stop.offset), [0, 50000, 100000]);
  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svg, /stop-color="#0F172A" stop-opacity="0\.12"/);
  assert.match(svg, /stop offset="50%"/);
});

test("Presentation path gradient previews honor path shape and fill rectangle", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.shapes.add({ geometry: "rect", position: { left: 10, top: 20, width: 200, height: 100 }, fill: {
    type: "gradient", gradientKind: "path", pathType: "rect", fillRect: { l: 10000, t: 20000, r: 30000, b: 10000 },
    stops: [{ offset: 0, color: "#FFFFFF" }, { offset: 100000, color: "#000000" }],
  } });
  slide.shapes.add({ geometry: "rect", position: { left: 250, top: 20, width: 200, height: 100 }, fill: {
    type: "gradient", gradientKind: "path", pathType: "circle", fillRect: { l: 10000, t: 20000, r: 30000, b: 10000 },
    stops: [{ offset: 0, color: "#FFFFFF" }, { offset: 100000, color: "#000000" }],
  } });
  slide.shapes.add({ geometry: "ellipse", position: { left: 500, top: 20, width: 200, height: 100 }, fill: {
    type: "gradient", gradientKind: "path", pathType: "shape", fillRect: { l: 10000, t: 20000, r: 30000, b: 10000 },
    stops: [{ offset: 0, color: "#FFFFFF" }, { offset: 100000, color: "#000000" }],
  } });
  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svg, /gradientTransform="translate\(90 75\) scale\(120 70\)"/);
  assert.match(svg, /gradientTransform="translate\(330 75\) scale\(70 70\)"/);
  assert.match(svg, /gradientTransform="translate\(580 75\) scale\(70 70\)"/);
});

test("Presentation renders and exports gradient slide backgrounds", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.background.fill = "linear(90deg, #ffffff, #000000)";
  slide.shapes.add({ geometry: "rect", position: { left: 10, top: 10, width: 200, height: 80 }, fill: "none", line: { fill: "linear(#ff0000, #0000ff)", width: 3 } });
  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svg, /<linearGradient id="fill-background-/);
  assert.match(svg, /stroke="url\(#fill-[^\"]*-stroke\)"/);
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /<p:bgPr><a:gradFill/);
  assert.match(slideXml, /<a:ln[^>]*>\s*<a:gradFill/);
  const inputPath = join(await mkdtemp(join(tmpdir(), "ruxex-gradient-background-import-")), "gradient.pptx");
  await writeFile(inputPath, Buffer.from(await pptx.arrayBuffer()));
  const imported = await PresentationFile.importPptx(inputPath);
  assert.equal(imported.slides.items[0].background.fill.type, "gradient");
  assert.equal(imported.slides.items[0].objects[0].options.line.fill.type, "gradient");
});

test("Presentation supports image-reference shape fills in previews and PPTX", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const source = slide.images.add({
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="2"><rect width="4" height="2" fill="#06B6D4"/></svg>',
    position: { left: 0, top: 0, width: 4, height: 2 },
  });
  slide.shapes.add({ geometry: "rect", position: { left: 20, top: 20, width: 180, height: 100 }, fill: {
    type: "image", imageReference: { id: source.id }, srcRect: { l: 1000, r: 1000 }, fillRect: { l: 0, t: 0, r: 0, b: 0 },
  } });
  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svg, /<pattern id="image-fill-/);
  assert.match(svg, /href="data:image\//);
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /<a:blipFill><a:srcRect[^>]*\/><a:blip r:embed="rId\d+"/);
  assert.match(slideXml, /<a:srcRect l="1000" r="1000"\/>/);
  const inputPath = join(await mkdtemp(join(tmpdir(), "ruxex-image-fill-import-")), "image-fill.pptx");
  await writeFile(inputPath, Buffer.from(await pptx.arrayBuffer()));
  const imported = await PresentationFile.importPptx(inputPath);
  const importedSlide = imported.slides.items[0];
  const importedFill = importedSlide.objects.find((object) => object.kind === "shape").options.fill;
  assert.equal(importedFill.type, "image");
  const fillSource = importedSlide.objects.find((object) => object.kind === "image" && object.fillSourceOnly);
  assert.ok(fillSource);
  assert.equal(importedFill.imageReference.id, fillSource.id);
  const inspected = await imported.inspect({ kind: "image" });
  assert.equal(inspected.recordCount, 1);
  const reexported = await imported.export({ format: "pptx" });
  const reexportZip = await JSZip.loadAsync(Buffer.from(await reexported.arrayBuffer()));
  const reexportSlide = await reexportZip.file("ppt/slides/slide1.xml").async("string");
  assert.match(reexportSlide, /<a:blipFill><a:srcRect[^>]*\/><a:blip r:embed="rId\d+"/);
});

test("Presentation accepts Codex Tailwind color tokens in shapes, text, and previews", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.shapes.add({ geometry: "rect", position: { left: 20, top: 20, width: 120, height: 80 }, fill: "sky-500", line: { fill: "slate-200", width: 1 } });
  slide.shapes.add({ geometry: "rect", position: { left: 160, top: 20, width: 120, height: 80 }, fill: "sky-500/80" });
  slide.shapes.add({ geometry: "rect", position: { left: 300, top: 20, width: 120, height: 80 }, fill: "accent1+18/90" });
  slide.addText("Readable label", { x: 20, y: 120, w: 300, h: 48, textStyle: { color: "slate-800" } });
  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svg, /fill="#00A6F4"/);
  assert.match(svg, /rgba\(0,166,244,0\.8\)/);
  assert.match(svg, /rgba\(\d+,\d+,\d+,0\.9\)/);
  assert.doesNotMatch(svg, /fill="#4472C4"/);
  assert.match(svg, /fill="#1D293D"/);
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /val="00A6F4"/);
  assert.match(slideXml, /val="1D293D"/);
  assert.match(slideXml, /alpha val="80000"/);
  assert.match(slideXml, /alpha val="90000"/);
  assert.doesNotMatch(slideXml, /val="4472C4"/);
});

test("Presentation inspection selects slides and includes requested content and positions", async () => {
  const presentation = Presentation.create({ title: "Cost Review" });
  const slide = presentation.slides.add();
  slide.addText("Operating costs", {
    role: "title",
    x: 72,
    y: 64,
    w: 640,
    h: 80,
    textStyle: { fontSize: 40, bold: true, color: "#112233" },
  });
  slide.addTable([["Year", "Cost"], ["2025", 120]], {
    x: 72,
    y: 180,
    w: 640,
    h: 160,
  });
  slide.addNotes("Source: supplied finance report.");

  const inspection = await presentation.inspect({
    select: "$.slides[*]",
    include: [
      "id",
      "index",
      "title",
      "elements.id",
      "elements.kind",
      "elements.text",
      "elements.position",
      "elements.style",
      "elements.rows",
      "notes.text",
    ],
  });

  assert.equal(inspection.recordCount, 1);
  assert.equal(inspection.records[0].title, "Operating costs");
  assert.equal(inspection.records[0].elements[0].text, "Operating costs");
  assert.deepEqual(inspection.records[0].elements[0].position, {
    left: 72,
    top: 64,
    width: 640,
    height: 80,
  });
  assert.deepEqual(inspection.records[0].elements[0].style, {
    fontSize: 40,
    bold: true,
    color: "#112233",
  });
  assert.deepEqual(inspection.records[0].elements[1].rows, [
    ["Year", "Cost"],
    ["2025", "120"],
  ]);
  assert.equal(inspection.records[0].notes.text, "Source: supplied finance report.");
  assert.equal(inspection.ndjson.split("\n").length, 1);

  const inspectionPath = join(tmpdir(), `ruxex-presentation-inspect-${process.pid}.ndjson`);
  const savedInspection = await presentation.inspect({
    select: "$.slides[0].elements[*]",
    include: ["id", "kind", "text", "position"],
    fileName: inspectionPath,
  });
  assert.equal(savedInspection.status, "saved");
  assert.equal(savedInspection.path, inspectionPath);
  assert.equal(
    JSON.parse((await readFile(inspectionPath, "utf8")).trim().split("\n")[0]).text,
    "Operating costs",
  );
  await assert.rejects(
    presentation.inspect({ select: "not-a-jsonpath" }),
    (error) => error.code === "invalid_inspect_query",
  );
  await assert.rejects(
    presentation.inspect({ select: "$.slides[" }),
    (error) => error.code === "invalid_inspect_query",
  );
});

test("Presentation accepts Codex chart categories and shape radius and shadow config", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const frame = slide.shapes.add({
    geometry: "rect",
    position: { left: 20, top: 30, width: 320, height: 180 },
    fill: "#FFFFFF",
    borderRadius: "rounded-2xl",
    shadow: "shadow-sm",
  });
  const customShadow = slide.shapes.add({
    geometry: "ellipse",
    position: { left: 40, top: 220, width: 80, height: 80 },
    shadow: "2px 7px 19px #000000/17",
  });
  slide.shapes.add({ geometry: "triangle", position: { left: 40, top: 320, width: 80, height: 80 }, fill: "#FF0000" });
  assert.equal(frame.borderRadius, "rounded-2xl");
  assert.equal(frame.shadow, "shadow-sm");
  assert.equal(customShadow.shadow, "2px 7px 19px #000000/17");
  const chart = slide.charts.add("bar", {
    position: { left: 360, top: 30, width: 360, height: 240 },
    categories: ["Q1", "Q2"],
    series: [{ name: "Revenue", values: [12, 18], fill: "accent1", dataLabelOverrides: [{ idx: 1, text: "Target" }] }],
    hasLegend: false,
    dataLabels: { showValue: true, position: "outEnd" },
  });
  assert.deepEqual(chart.categories, ["Q1", "Q2"]);
  assert.deepEqual(chart.series[0].labels, ["Q1", "Q2"]);
  const series = chart.series.getItemAt(0);
  series.apply({ name: "Revenue actual", points: [{ idx: 1, fill: "#22C55E" }], categories: ["Q1", "Q2"], xValues: [1, 2], categoryPaths: [["FY25", "Q1"], ["FY25", "Q2"]], bubbleSizes: [4, 6], explosion: 5, smooth: true, marker: { symbol: "diamond", size: 8 }, dataLabelOverrides: [{ idx: 1, text: "Plan" }] });
  series.dataLabelOverrides.add(0).text = "First";
  assert.equal(series.name, "Revenue actual");
  assert.deepEqual(series.points, [{ idx: 1, fill: "#22C55E" }]);
  assert.deepEqual(series.xValues, [1, 2]);
  assert.deepEqual(series.categoryPaths, [["FY25", "Q1"], ["FY25", "Q2"]]);
  assert.equal(series.smooth, true);
  assert.equal(series.marker.symbol, "diamond");
  assert.equal(series.dataLabelOverrides.find((entry) => entry.idx === 0).text, "First");
  assert.equal(series.dataLabelOverrides.find((entry) => entry.idx === 1).text, "Plan");
  assert.throws(() => series.apply({ marker: { symbol: "bad" } }), (error) => error.code === "invalid_chart_series");
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /prst="roundRect"/);
  assert.match(slideXml, /<a:outerShdw/);
  const chartXml = await zip.file("ppt/charts/chart1.xml").async("string");
  assert.match(chartXml, /<c:cat>/);
  const previewSvg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(previewSvg, /M 50 0 L 100 100 L 0 100 Z/);
  assert.match(previewSvg, />12<|>18</);
  assert.match(previewSvg, />Plan</);
});

test("Presentation imports shape border radius and custom shadow metadata", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.shapes.add({
    geometry: "rect",
    position: { left: 20, top: 30, width: 300, height: 180 },
    fill: "#FFFFFF",
    borderRadius: 24,
    shadow: "2px 7px 19px #000000/17",
  });
  const directory = await mkdtemp(join(tmpdir(), "ruxex-shape-effect-import-"));
  const path = join(directory, "effects.pptx");
  await (await presentation.export({ format: "pptx" })).arrayBuffer().then((bytes) => writeFile(path, Buffer.from(bytes)));
  const imported = await PresentationFile.importPptx(path);
  const [shape] = imported.slides.items[0].objects;
  assert.ok(Math.abs(shape.options.borderRadius - 24) <= 2);
  assert.match(shape.options.shadow, /#000000\/17$/);
});

test("Presentation custom geometry exports editable bezier paths and previews them", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const shape = slide.shapes.add({
    geometry: "custom",
    position: { left: 40, top: 50, width: 240, height: 120 },
    fill: "#2463EB",
    line: { fill: "#111827", width: 2 },
    customPaths: [{
      width: 240,
      height: 120,
      commands: [
        { moveTo: { x: 0, y: 100 } },
        { cubicBezTo: { x1: 40, y1: 0, x2: 180, y2: 0, x: 240, y: 100 } },
        { lineTo: { x: 0, y: 100 } },
        { close: {} },
      ],
    }],
  });
  slide.shapes.add({
    geometry: "rect",
    position: { left: 300, top: 50, width: 120, height: 80 },
    fill: { type: "gradient", gradientKind: "linear", angleDeg: 45, stops: [{ offset: 0, color: "#FF0000" }, { offset: 100000, color: "#0000FF/50" }] },
  });
  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svg, /C 40 0 180 0 240 100/);
  assert.match(svg, /<linearGradient/);
  assert.equal(shape.customPaths[0].commands.length, 4);
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /<a:custGeom>/);
  assert.match(slideXml, /<a:cubicBezTo>/);
  assert.match(slideXml, /<a:gradFill/);
  const directory = await mkdtemp(join(tmpdir(), "ruxex-custom-path-roundtrip-"));
  const path = join(directory, "custom.pptx");
  await writeFile(path, Buffer.from(await pptx.arrayBuffer()));
  const imported = await PresentationFile.importPptx(path);
  assert.ok(imported.slides.items[0].objects.some((item) => item.shape === "custom" && item.options.customPaths?.[0]?.commands.some((command) => command.cubicBezTo)));
  assert.ok(imported.slides.items[0].objects.some((item) => item.options.fill?.type === "gradient"));
  assert.ok(imported.slides.items[0].objects.some((item) => item.options.fill?.stops?.some((stop) => stop.color === "#0000FF/0.5")));
});

test("Presentation slide autoLayout positions existing shapes within an aligned frame", () => {
  const presentation = Presentation.create({ slideSize: { width: 800, height: 600 } });
  const slide = presentation.slides.add();
  const a = slide.shapes.add({ geometry: "rect", position: { width: 100, height: 40 } });
  const b = slide.shapes.add({ geometry: "rect", position: { width: 200, height: 60 } });
  const positions = slide.autoLayout([a, b], {
    direction: "horizontal",
    frame: { left: 100, top: 120, width: 500, height: 200 },
    horizontalGap: 20,
    align: "center",
  });
  assert.deepEqual(positions, [
    { left: 190, top: 200, width: 100, height: 40 },
    { left: 310, top: 190, width: 200, height: 60 },
  ]);
  assert.deepEqual(a.position, positions[0]);
  assert.deepEqual(b.position, positions[1]);
});

test("Presentation slide compose materializes JSX-style row and paragraph nodes", () => {
  const presentation = Presentation.create({ slideSize: { width: 800, height: 600 } });
  const slide = presentation.slides.add();
  const composed = slide.compose({
    type: "row",
    props: { gap: 20, align: "center" },
    children: [
      { type: "paragraph", props: { width: "fill", height: 80, name: "first", style: { fontSize: 24, bold: true } }, children: "First column" },
      { type: "box", props: { width: "fill", height: 80, padding: 8, fill: "sky-100", borderRadius: 8 }, children: { type: "paragraph", props: { style: { fontSize: 18 } }, children: "Second column" } },
    ],
  }, { frame: { left: 40, top: 60, width: 720, height: 100 } });
  assert.equal(composed.length, 3);
  assert.deepEqual(slide.objects.filter((object) => object.kind === "text").map((object) => object.text), ["First column", "Second column"]);
  assert.equal(slide.objects.find((object) => object.options.name === "first").options.x, 40);
  assert.equal(slide.objects.find((object) => object.shape === "rect").options.x, 410);
});

test("Presentation slide compose accepts React-shaped JSX elements", () => {
  const presentation = Presentation.create({ slideSize: { width: 800, height: 600 } });
  const slide = presentation.slides.add();
  const jsx = (type, props = {}, children) => ({
    $$typeof: Symbol.for("react.transitional.element"),
    type,
    key: null,
    props: { ...props, ...(children === undefined ? {} : { children }) },
  });
  const handles = slide.compose(jsx("column", { gap: 12 }, [
    jsx("paragraph", { width: "fill", height: 40, className: "text-xl font-bold italic leading-tight" }, "JSX title"),
    jsx("shape", { width: "fill", height: 80, geometry: "rect", fill: "sky-100" }),
    jsx("paragraph", { width: "fill", height: 40, style: "font: 700 28px Inter; color: #0f172a; leading: 1.1" }, "Styled detail"),
  ]), { frame: { left: 32, top: 48, width: 736, height: 480 } });

  assert.equal(handles.length, 3);
  assert.equal(slide.objects[0].text, "JSX title");
  assert.equal(slide.objects[0].options.textStyle.fontSize, 20);
  assert.equal(slide.objects[0].options.textStyle.italic, true);
  assert.equal(slide.objects[0].options.textStyle.lineSpacingMultiple, 1.25);
  assert.equal(slide.objects[1].shape, "rect");
  assert.equal(slide.objects[1].options.y, 100);
  assert.equal(slide.objects[2].options.textStyle.fontSize, 28);
  assert.equal(slide.objects[2].options.textStyle.fontFace, "Inter");
  assert.equal(slide.objects[2].options.textStyle.color, "#0f172a");
  const Badge = (props) => jsx("shape", { ...props, geometry: "rect" });
  slide.compose(jsx(Badge, { name: "component-badge", width: 80, height: 32, fill: "teal-100" }), {
    frame: { left: 32, top: 540, width: 80, height: 32 },
  });
  assert.equal(slide.objects.find((object) => object.options.name === "component-badge").shape, "rect");
});

test("Presentation slide compose parses and exports the complete compact text style string", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.compose({
    type: "paragraph",
    props: {
      style: "font: italic 600 28px Inter; color: #123456; leading: 1.25; align: center; wrap: none; underline: sng; inset: 4px; autofit: shrinkText",
    },
    children: "Compact style",
  }, { frame: { left: 0, top: 0, width: 200, height: 60 } });

  const style = slide.objects[0].options.textStyle;
  assert.equal(style.italic, true);
  assert.equal(style.bold, true);
  assert.equal(style.fontSize, 28);
  assert.equal(style.fontFace, "Inter");
  assert.equal(style.color, "#123456");
  assert.equal(style.lineSpacingMultiple, 1.25);
  assert.equal(style.align, "center");
  assert.equal(style.wrap, "none");
  assert.equal(style.underline, "sng");
  assert.equal(style.insets, 4);
  assert.equal(style.autoFit, "shrinkText");

  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /<a:spcPct val="125000"\/>/);
  assert.match(slideXml, /<a:bodyPr[^>]*wrap="none"/);
  assert.match(slideXml, /<a:normAutofit\/>/);
  assert.match(slideXml, /<a:bodyPr[^>]*lIns="38100"[^>]*rIns="38100"/);
  assert.match(slideXml, /u="sng"/);
});

test("Presentation slide compose honors textStyle on nested run nodes", () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.compose({
    type: "paragraph",
    children: {
      type: "run",
      props: { textStyle: { typeface: "Arial", underline: "sng", alignment: "center" } },
      children: "Inline",
    },
  }, { frame: { left: 0, top: 0, width: 200, height: 60 } });

  const style = slide.objects[0].textRuns[0].style;
  assert.equal(style.fontFace, "Arial");
  assert.equal(style.underline, "sng");
  assert.equal(style.align, "center");
});

test("Presentation slide compose sizes weighted grid tracks and spans", () => {
  const presentation = Presentation.create({ slideSize: { width: 800, height: 600 } });
  const slide = presentation.slides.add();
  const nodes = [
    { type: "shape", props: { name: "wide", geometry: "rect", rowSpan: 1, columnSpan: 2, height: "fill" } },
    { type: "shape", props: { name: "narrow", geometry: "rect" } },
  ];
  slide.compose({ type: "grid", props: { columns: [{ mode: "fr", value: 1 }, { mode: "fr", value: 2 }], rows: [{ mode: "fixed", value: 120 }, { mode: "fr", value: 1 }], columnGap: 20, rowGap: 10 }, children: nodes }, {
    frame: { left: 30, top: 40, width: 740, height: 500 },
  });
  const wide = slide.objects.find((object) => object.options.name === "wide");
  const narrow = slide.objects.find((object) => object.options.name === "narrow");
  assert.deepEqual([wide.options.x, wide.options.y, wide.options.w, wide.options.h], [30, 40, 740, 120]);
  assert.deepEqual([narrow.options.x, narrow.options.y, narrow.options.w, narrow.options.h], [30, 170, 240, 370]);
});

test("Presentation slide compose aligns grid and layer children", () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.compose({
    type: "grid",
    props: { columns: 2, rows: 1, alignItems: "center", justifyItems: "end" },
    children: [
      { type: "shape", props: { name: "grid-item", geometry: "rect", width: 50, height: 40 } },
      { type: "shape", props: { name: "second-grid-item", geometry: "rect", width: 50, height: 40 } },
    ],
  }, { frame: { left: 0, top: 0, width: 200, height: 100 } });
  slide.compose({
    type: "layers",
    props: { alignItems: "center", justifyItems: "end" },
    children: { type: "shape", props: { name: "layer-item", geometry: "rect", width: 50, height: 40 } },
  }, { frame: { left: 300, top: 0, width: 200, height: 100 } });

  const position = (name) => {
    const shape = slide.objects.find((object) => object.options.name === name);
    return [shape.options.x, shape.options.y, shape.options.w, shape.options.h];
  };
  assert.deepEqual(position("grid-item"), [50, 30, 50, 40]);
  assert.deepEqual(position("second-grid-item"), [150, 30, 50, 40]);
  assert.deepEqual(position("layer-item"), [450, 30, 50, 40]);
});

test("Presentation slide compose materializes chart family and nested series nodes", () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const [chart] = slide.compose({
    type: "chart",
    props: { title: "Quarterly sales", categories: ["Q1", "Q2"] },
    children: {
      type: "bar",
      props: { barDir: "col", hasLegend: false },
      children: [{ type: "series", props: { name: "Actual", labels: ["Q1", "Q2"], values: [12, 18] } }],
    },
  }, { frame: { left: 10, top: 20, width: 400, height: 240 } });
  assert.equal(chart.chartType, "bar");
  assert.equal(chart.title, "Quarterly sales");
  assert.deepEqual(chart.series[0].values, [12, 18]);
  assert.deepEqual(chart.position, { left: 10, top: 20, width: 400, height: 240 });
});

test("Presentation slide compose maps chart chrome and series child nodes", () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const [chart] = slide.compose({
    type: "chart",
    children: {
      type: "bar",
      children: [
        { type: "major-gridlines", props: { axis: "y", color: "#DDDDDD" } },
        { type: "view-3d", props: { rotationX: 18, rotationY: 24 } },
        {
          type: "series",
          props: { name: "Revenue", labels: ["Q1", "Q2"], values: [20, 28] },
          children: [
            { type: "marker", props: { symbol: "diamond", size: 9 } },
            { type: "data-label", props: { showValue: true } },
            { type: "error-bars", props: { type: "percentage", value: 5 } },
            { type: "point", props: { idx: 0, fill: "#00AAFF" }, children: { type: "data-label", props: { showValue: true, showCategoryName: true } } },
            { type: "trendline", props: { type: "linear", displayEquation: true }, children: { type: "trendline-label", props: { text: "Trend" } } },
          ],
        },
      ],
    },
  }, { frame: { left: 0, top: 0, width: 400, height: 240 } });

  const model = slide.objects.find((object) => object.kind === "chart");
  assert.deepEqual(model.options.yAxis.majorGridlines, { axis: "y", color: "#DDDDDD" });
  assert.deepEqual(model.options.view3D, { rotationX: 18, rotationY: 24 });
  assert.deepEqual(model.series[0].marker, { symbol: "diamond", size: 9 });
  assert.deepEqual(model.series[0].dataLabels, { showValue: true });
  assert.deepEqual(model.series[0].errorBars, { type: "percentage", value: 5 });
  assert.deepEqual(model.series[0].points, [{ idx: 0, fill: "#00AAFF", dataLabels: { showValue: true, showCategoryName: true } }]);
  assert.deepEqual(model.series[0].trendlines, [{ type: "linear", displayEquation: true, label: { text: "Trend" } }]);
});

test("Presentation comments support slide, element, and text-match threads with replies and state", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const title = slide.shapes.add({ geometry: "textbox", text: "Q4 outlook", position: { left: 1, top: 2, width: 300, height: 40 } });
  const self = presentation.comments.setSelf({ displayName: "Reviewer", initials: "RV", email: "reviewer@example.com" });
  const thread = presentation.comments.addThread({ textMatch: { element: title, query: "Q4" } }, "Confirm the reporting period.", { position: { x: 4, y: 5 } });
  assert.equal(thread.target.start, 0);
  assert.equal(thread.author.id, self.id);
  const reply = thread.addReply("It is Q4.");
  reply.toggleReaction("👍");
  assert.equal(reply.reactions[0].emoji, "👍");
  thread.resolve();
  assert.equal(thread.resolved, true);
  thread.reopen();
  assert.equal(thread.resolved, false);
  assert.equal(presentation.resolve(thread.id).body, "Confirm the reporting period.");
  assert.equal((await presentation.inspect({ kind: "thread", target: { id: thread.id }, include: ["id", "body", "resolved"] })).records[0].body, "Confirm the reporting period.");
  const roundTrip = Presentation.fromProto(presentation.toProto());
  assert.equal(roundTrip.comments.getItem(thread.id).replies[0].body, "It is Q4.");
});

test("Presentation thread inspection includes requested before and after text context", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const title = slide.shapes.add({ geometry: "textbox", text: "Q4 outlook\nRevenue is up\nRisks remain", position: { left: 0, top: 0, width: 300, height: 120 } });
  const thread = presentation.comments.addThread({ textMatch: { element: title, query: "Revenue" } }, "Verify this claim.");
  const result = await presentation.inspect({ kind: "thread", target: { id: thread.id, beforeLines: 1, afterLines: 1 } });
  assert.deepEqual(result.records[0].context, { before: ["Q4 outlook"], match: ["Revenue is up"], after: ["Risks remain"] });
});

test("Presentation connectors follow their shape endpoints in preview and PPTX", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const source = slide.shapes.add({ geometry: "rect", position: { left: 20, top: 40, width: 100, height: 60 }, fill: "#FFFFFF" });
  const target = slide.shapes.add({ geometry: "ellipse", position: { left: 260, top: 40, width: 100, height: 60 }, fill: "#FFFFFF" });
  const connector = slide.shapes.connect(source, target, {
    kind: "straight",
    fromSide: "right",
    toSide: "left",
    line: { fill: "#334155", width: 2 },
    head: { type: "arrow" },
  });
  target.position = { left: 320, top: 80, width: 100, height: 60 };
  assert.equal(connector.connector.fromId, source.id);
  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svg, /<line x1="120" y1="70" x2="320" y2="110"/);
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /<p:cxnSp>/);
  assert.match(slideXml, /<a:stCxn id="\d+" idx="1"\/>/);
  assert.match(slideXml, /<a:endCxn id="\d+" idx="3"\/>/);
  assert.match(slideXml, /<a:tailEnd type="triangle"/);
  const path = join(await mkdtemp(join(tmpdir(), "ruxex-connector-import-")), "connected.pptx");
  await writeFile(path, Buffer.from(await pptx.arrayBuffer()));
  const imported = await PresentationFile.importPptx(path);
  const importedConnector = imported.slides.items[0].objects.find((object) => object.options.connector);
  const importedSource = imported.slides.items[0].objects.find((object) => object.shape === "rect" && object.options.x === 20);
  const importedTarget = imported.slides.items[0].objects.find((object) => object.shape === "ellipse" && object.options.x === 320);
  assert.equal(importedConnector.options.connector.kind, "straight");
  assert.equal(importedConnector.options.connector.fromId, importedSource.id);
  assert.equal(importedConnector.options.connector.toId, importedTarget.id);
  assert.equal(importedConnector.options.connector.toIdx, 3);
  const reexported = await imported.export({ format: "pptx" });
  const reexportedZip = await JSZip.loadAsync(Buffer.from(await reexported.arrayBuffer()));
  assert.match(await reexportedZip.file("ppt/slides/slide1.xml").async("string"), /<p:cxnSp>/);
});

test("Presentation connectors support one attached endpoint plus cap and join styles", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const source = slide.shapes.add({ geometry: "rect", position: { left: 20, top: 20, width: 100, height: 60 } });
  const connector = slide.shapes.add({
    geometry: "connector",
    from: source,
    fromIdx: slide.shapes.getConnectionSiteIndex(source, "right"),
    position: { left: 120, top: 50, width: 180, height: 0 },
    line: { style: "solid", fill: "#334155", width: 2 },
    tail: { type: "arrow" },
    cap: "round",
    join: "bevel",
  });
  assert.equal(connector.model.options.connector.fromId, source.id);
  assert.equal(connector.model.options.connector.toId, undefined);
  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svg, /<line x1="120" y1="50" x2="300" y2="50"/);
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /<p:cxnSp/);
  assert.match(slideXml, /<a:stCxn id="3" idx="1"\/>/);
  assert.doesNotMatch(slideXml, /<a:endCxn/);
  assert.match(slideXml, /cap="rnd"/);
  assert.match(slideXml, /<a:bevel\/>/);
  const path = join(await mkdtemp(join(tmpdir(), "ruxex-one-ended-connector-")), "one-ended.pptx");
  await writeFile(path, Buffer.from(await pptx.arrayBuffer()));
  const imported = await PresentationFile.importPptx(path);
  const reloaded = imported.slides.items[0].objects.find((object) => object.options.connector);
  assert.ok(reloaded?.options.connector.fromId);
  assert.equal(reloaded?.options.connector.toId, undefined);
  assert.equal(reloaded?.options.connector.cap, "round");
  assert.equal(reloaded?.options.connector.join, "bevel");
});

test("Presentation connectors support route kinds and indexed cardinal anchors in previews", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const source = slide.shapes.add({ geometry: "rect", position: { left: 20, top: 40, width: 100, height: 60 } });
  const target = slide.shapes.add({ geometry: "rect", position: { left: 260, top: 220, width: 100, height: 60 } });
  const fromIdx = slide.shapes.getConnectionSiteIndex(source, "right");
  const toIdx = slide.shapes.getConnectionSiteIndex(target, "left");
  assert.equal(fromIdx, 1);
  assert.equal(toIdx, 3);
  const elbow = slide.shapes.connect(source, target, { fromIdx, toIdx });
  const curved = slide.shapes.connect(source, target, { kind: "curved", fromSide: "bottom", toSide: "top" });
  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svg, /<polyline points=/);
  assert.match(svg, /<path d="M [^\"]+ C /);
  assert.equal(elbow.connector.kind, "elbow");
  assert.equal(curved.connector.kind, "curved");
});

test("Presentation imports cached native chart categories and values as editable series", async () => {
  const presentation = Presentation.create();
  presentation.slides.add().charts.add("line", {
    categories: ["Q1", "Q2", "Q3"],
    series: [{ name: "Revenue", values: [12, 18, 16] }],
    position: { left: 40, top: 50, width: 480, height: 300 },
    title: "Quarterly revenue",
  });
  const directory = await mkdtemp(join(tmpdir(), "ruxex-chart-import-"));
  const path = join(directory, "chart.pptx");
  const pptx = await presentation.export({ format: "pptx" });
  await writeFile(path, Buffer.from(await pptx.arrayBuffer()));
  const imported = await PresentationFile.importPptx(path);
  const chart = imported.slides.items[0].objects.find((object) => object.kind === "chart");
  assert.equal(chart.type, "line");
  assert.equal(chart.options.title, "Quarterly revenue");
  assert.deepEqual(chart.series[0].labels, ["Q1", "Q2", "Q3"]);
  assert.deepEqual(chart.series[0].values, [12, 18, 16]);
});

test("Presentation inspection supports kind and search filters with a character limit", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.addText("Quarterly revenue", { role: "title" });
  slide.shapes.add({ geometry: "rect", text: "Revenue marker" });
  slide.addNotes("Source note about revenue.");

  const result = await presentation.inspect({
    kind: "shape,textbox",
    search: "revenue",
    maxChars: 1500,
  });

  assert.equal(result.recordCount, 2);
  assert.deepEqual(result.records.map((record) => record.kind), ["textbox", "shape"]);
  assert.ok(result.ndjson.length <= 1500);
});

test("Presentation layout export exposes full paragraph and cell formatting detail", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.addText([{ bulletCharacter: "•", marginLeft: 18, runs: [{ run: "First" }] }]);
  const table = slide.tables.add({ rows: [["Header"]] });
  table.getCell(0, 0).borders = { bottom: { fill: "#334155", width: 2 } };
  table.getCell(0, 0).margins = { top: 4, right: 8, bottom: 4, left: 8 };
  const layout = JSON.parse(await (await slide.export({ format: "layout", detail: "full" })).text());
  assert.deepEqual(layout.elements[0].paragraphs, [{ bulletCharacter: "•", marginLeft: 18 }]);
  assert.deepEqual(layout.elements[1].cells[0][0].borders, { bottom: { fill: "#334155", width: 2 } });
  assert.deepEqual(layout.elements[1].cells[0][0].margins, { top: 4, right: 8, bottom: 4, left: 8 });
});

test("Presentation tables expose editable cell values and basic formatting", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const table = slide.tables.add({
    rows: [["Area", "Status"], ["Schedule", "On track"]],
    position: { left: 20, top: 30, width: 480, height: 120 },
  });

  table.getCell(1, 1).value = "At risk";
  table.getCell(0, 1).fill = "#DCEAFE";
  table.getCell(0, 1).text.style = { bold: true, color: "#123456" };
  table.cells.set(1, 0, "Delivery");
  const cellRange = table.cells.block({ row: 1, column: 0, rowCount: 1, columnCount: 2 });
  cellRange.assign({
    fill: "#F1F5F9",
    textStyle: { fontSize: 18 },
    borders: { bottom: { fill: "#334155", width: 2 } },
  });
  cellRange.textStyle.bold = true;

  assert.equal(table.rows[1][1], "At risk");
  assert.equal(table.rows[1][0], "Delivery");
  assert.equal(table.getCell(0, 1).fill, "#DCEAFE");
  assert.deepEqual(table.getCell(0, 1).text.style, { bold: true, color: "#123456" });
  assert.equal(table.getCell(1, 0).fill, "#F1F5F9");
  assert.deepEqual(table.getCell(1, 1).borders, { bottom: { fill: "#334155", width: 2 } });
  assert.equal(table.getCell(1, 0).text.style.bold, true);
  assert.equal(table.getCell(1, 1).text.style.bold, true);
  const tablePreview = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(tablePreview, /stroke="#334155"/);
  table.insertRows({ index: 2 });
  table.deleteRows({ index: 2 });
  table.insertColumns({ index: 2 });
  table.deleteColumns({ index: 2 });
  table.merge({ startRow: 0, endRow: 1, startColumn: 0, endColumn: 1 });
  const inspected = await presentation.inspect({
    select: "$.slides[0].elements[0]",
    include: ["cells"],
  });
  assert.equal(inspected.records[0].cells[0][1].fill, "#DCEAFE");
  assert.deepEqual(inspected.records[0].cells[0][1].style, { bold: true, color: "#123456" });
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /val="DCEAFE"/);
  assert.match(slideXml, /val="123456"/);
  assert.match(slideXml, /val="334155"/);
  assert.match(slideXml, /gridSpan="2"/);
  const directory = await mkdtemp(join(tmpdir(), "ruxex-table-import-roundtrip-"));
  const mergedPath = join(directory, "merged-table.pptx");
  await writeFile(mergedPath, Buffer.from(await pptx.arrayBuffer()));
  const mergedImport = await PresentationFile.importPptx(mergedPath);
  assert.ok(mergedImport.lossDiagnostics.some((item) => item.code === "unsupported_table_merge_structure"));
  const roundTrip = Presentation.create();
  const roundTripSlide = roundTrip.slides.add();
  const roundTripTable = roundTripSlide.tables.add({ rows: [["Header", "Value"], ["Forecast", 12]] });
  roundTripTable.getCell(0, 0).fill = "#DCEAFE";
  roundTripTable.getCell(1, 1).borders = { bottom: { fill: "#334155", width: 2 } };
  const path = join(directory, "styled-table.pptx");
  await writeFile(path, Buffer.from(await (await roundTrip.export({ format: "pptx" })).arrayBuffer()));
  const imported = await PresentationFile.importPptx(path);
  assert.equal(imported.slides.items[0].objects[0].cellOptions[0][0].fill, "#DCEAFE");
  assert.deepEqual(imported.slides.items[0].objects[0].cellOptions[1][1].borders.bottom, { fill: "#334155", width: 2 });
});

test("Presentation tables expose Codex-style tracks, row sizing, and cell layout controls", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const table = slide.tables.add({
    values: [["Metric", "Value"], ["Revenue", "$12M"]],
    position: { left: 20, top: 30, width: 400, height: 120 },
  });
  table.columnTracks = [fr(2), fr(1)];
  table.style = "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}";
  table.styleOptions = { headerRow: true, bandedRows: true };
  table.rows[0].height = 48;
  table.columns.get(1).width = 140;
  table.cells.block({ row: 0, column: 0, rowCount: 1, columnCount: 2 }).assign({
    margins: { top: 4, right: 8, bottom: 4, left: 8 },
    anchor: "middle",
  });
  assert.equal(table.rows[0].height, 48);
  assert.equal(table.columns.get(1).width, 140);
  assert.deepEqual(fixed(140), { mode: "fixed", value: 140 });
  assert.deepEqual(table.getCell(0, 0).margins, { top: 4, right: 8, bottom: 4, left: 8 });
  assert.equal(table.getCell(0, 1).anchor, "middle");
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /marL="76200"/);
  assert.match(slideXml, /anchor="ctr"/);
  assert.match(slideXml, /val="4472C4"/);
  assert.match(slideXml, /tableStyleId val="\{5C22544A-7EE6-4342-B048-85BDC9FD1C3A\}"/);
});

test("Presentation help searches the local API index and returns selected fields", () => {
  const presentation = Presentation.create();
  const result = presentation.help("slide.shapes.add", {
    include: ["index", "examples", "notes"],
    maxChars: 4000,
  });

  assert.equal(result.recordCount, 1);
  assert.equal(result.records[0].name, "slide.shapes.add");
  assert.match(result.records[0].examples[0].code, /geometry/);
  assert.ok(result.ndjson.length <= 4000);
});

test("Presentation exposes local template help, lookup, and editable application", async () => {
  const presentation = Presentation.create();
  const templates = presentation.help("template*", { include: ["index", "examples"] });
  assert.deepEqual(templates.records.map((record) => record.name), ["title-slide", "two-up", "agenda"]);
  assert.ok(templates.records.every((record) => record.kind === "template"));
  assert.match(templates.records[2].examples[0].code, /presentation\.apply/);

  const agenda = presentation.template("agenda");
  agenda.elements[0].text = "Today";
  const slide = presentation.apply(agenda);
  assert.equal(slide.objects.length, 2);
  assert.equal(slide.objects[0].text, "Today");
  assert.equal(presentation.slides.length, 1);
  assert.throws(() => presentation.template("unknown"), (error) => error.code === "invalid_template");
});

test("Presentation resolves inspected IDs and deletes selected slide elements", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const title = slide.shapes.add({
    geometry: "textbox",
    position: { left: 72, top: 64, width: 640, height: 80 },
    text: "Review",
  });
  slide.addShape("rect", { x: 72, y: 180, w: 200, h: 120 });

  const slideId = slide.id;
  const titleId = title.model.id;
  const first = await presentation.inspect({ select: "$.slides[*]", include: ["id", "elements.id"] });
  const second = await presentation.inspect({ select: "$.slides[*]", include: ["id", "elements.id"] });

  assert.match(slideId, /^sl\//);
  assert.equal(first.records[0].id, slideId);
  assert.deepEqual(first.records, second.records);
  assert.equal(presentation.resolve(slideId), slide);
  const resolvedTitle = presentation.resolve(titleId);
  assert.equal(String(resolvedTitle.text), "Review");
  resolvedTitle.text = "Updated review";
  assert.equal(String(presentation.resolve(titleId).text), "Updated review");
  resolvedTitle.text.get("Updated").replace("Updated", "Revised");
  assert.equal(String(presentation.resolve(titleId).text), "Revised review");
  resolvedTitle.text.fontSize = 36;
  assert.equal(resolvedTitle.text.style.fontSize, 36);

  presentation.delete(titleId);
  assert.equal(slide.objects.length, 1);
  assert.throws(
    () => presentation.resolve(titleId),
    (error) => error.code === "invalid_presentation_id",
  );
  presentation.slides.delete(slideId);
  assert.equal(presentation.slides.length, 0);
});

test("Presentation slide collection supports Codex-shaped insert, keep, reorder, and copy flows", async () => {
  const presentation = Presentation.create();
  const first = presentation.slides.add();
  first.addText("First");
  const second = presentation.slides.add();
  second.addText("Second");
  const inserted = presentation.slides.insert({ after: 0, layout: "title" });
  inserted.slide.addText("Inserted");

  assert.equal(inserted.index, 1);
  assert.deepEqual(presentation.slides.items.map((slide) => slide.objects[0]?.text), ["First", "Inserted", "Second"]);
  const copy = presentation.slides.addCopy(first);
  assert.notEqual(copy.id, first.id);
  assert.equal(copy.objects[0].text, "First");
  assert.throws(
    () => Presentation.create().slides.addCopy(first),
    (error) => error.code === "invalid_slide_copy",
  );

  presentation.slides.reorder([copy.id, second.id, inserted.slide.id, first.id]);
  assert.deepEqual(presentation.slides.items.map((slide) => slide.id), [copy.id, second.id, inserted.slide.id, first.id]);
  presentation.slides.keep([0, 2]);
  assert.deepEqual(presentation.slides.items.map((slide) => slide.id), [copy.id, inserted.slide.id]);
});

test("Presentation masters expose color maps, background references, and layout links", async () => {
  const presentation = Presentation.create();
  const master = presentation.masters.add("Brand Master");
  master.setColorMap({ bg1: "bg2", tx1: "tx2", accent1: "accent2" });
  master.background.ref = "bg1";
  const layout = presentation.layouts.add("Brand Title");
  layout.setParentLayoutId(master.id);
  const slide = presentation.slides.add();
  slide.setLayout(layout);
  assert.equal(presentation.layouts.getById(master.id).name, "Brand Master");
  assert.equal(slide.layoutId, layout.id);
  assert.deepEqual(master.colorMap.accent1, "accent2");
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const masterPath = Object.keys(zip.files).find((path) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path));
  const masterXml = await zip.file(masterPath).async("string");
  assert.match(masterXml, /bg1="bg2"/);
  const restored = Presentation.fromProto(presentation.toProto());
  assert.equal(restored.masters.getById(master.id).background.ref, "bg1");
  assert.equal(restored.layouts.getById(layout.id).parentMasterId, master.id);
});

test("Presentation layouts create editable named placeholders", async () => {
  const presentation = Presentation.create();
  const layout = presentation.layouts.add("Title Body");
  layout.placeholders.add({ type: "title", index: 0, geometry: "textbox", position: { left: 40, top: 30, width: 500, height: 60 }, fontSize: 42, bold: true });
  layout.placeholders.add({ type: "body", index: 0, geometry: "textbox", position: { left: 40, top: 110, width: 700, height: 400 } });
  layout.placeholders.add({ type: "body", index: 1, geometry: "textbox", position: { left: 760, top: 110, width: 400, height: 400 } });
  layout.placeholders.add({ type: "picture", index: 0, geometry: "ellipse", position: { left: 1040, top: 28, width: 160, height: 160 }, fill: "#E8EEF7" });
  const slide = presentation.slides.add({ layout: "Title Body" });
  slide.placeholders.getItem("title").text = "Quarterly Review";
  slide.placeholders.getItem("body").text = "Three findings";
  assert.equal(slide.layoutId, layout.id);
  assert.equal(presentation.layouts.getById(layout.id), layout);
  assert.equal(layout.placeholders.summary().length, 4);
  const layoutPreview = await layout.export({ format: "svg", scale: 0.25 });
  assert.match(await layoutPreview.text(), /<svg/);
  const fullLayout = JSON.parse(await (await slide.export({ format: "layout", detail: "full" })).text());
  assert.equal(fullLayout.inheritedLayers.find((layer) => layer.kind === "layout").elements.length, 4);
  assert.equal(slide.placeholders.items.length, 4);
  assert.equal((await presentation.inspect({ kind: "textbox" })).recordCount, 3);
  const restored = await Presentation.load(presentation.toProto());
  assert.equal(restored.layouts.getItem("Title Body").placeholders.items.length, 4);
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  assert.ok(zip.file("ppt/slideMasters/slideMaster1.xml"));
  assert.ok(zip.file("ppt/slideLayouts/slideLayout1.xml"));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /<p:ph[^>]*idx="0"[^>]*type="title"/);
  assert.match(slideXml, /<p:ph[^>]*idx="0"[^>]*type="body"/);
  assert.match(slideXml, /<p:ph[^>]*idx="1"[^>]*type="body"/);
  assert.match(slideXml, /<p:ph(?=[^>]*idx="0")(?=[^>]*type="pic")/);
  const layoutXml = await zip.file("ppt/slideLayouts/slideLayout2.xml").async("string");
  assert.match(layoutXml, /prst="ellipse"/);
  const pptxPath = join(await mkdtemp(join(tmpdir(), "ruxex-layout-import-")), "layout.pptx");
  await writeFile(pptxPath, Buffer.from(await pptx.arrayBuffer()));
  const imported = await PresentationFile.importPptx(pptxPath);
  const importedLayout = imported.layouts.getItem("Title Body");
  assert.equal(importedLayout.placeholders.items.length, 4);
  assert.deepEqual(importedLayout.placeholders.items.map((item) => item.index), [0, 0, 1, 0]);
  assert.equal(importedLayout.placeholders.items.find((item) => item.type === "picture").geometry, "ellipse");
  assert.equal(importedLayout.placeholders.items[0].style.fontSize, 42);
  assert.equal(importedLayout.placeholders.items[0].style.bold, true);
  assert.equal(imported.slides.items[0].layout, "Title Body");
  assert.ok(imported.slides.items[0].objects.some((object) => object.text === "Quarterly Review"));
});

test("Presentation imports and reexports supported inherited layout artwork", async () => {
  const source = new PptxGenJS();
  source.defineSlideMaster({
    title: "Brand Layout",
    objects: [
      { rect: { x: 0, y: 0, w: 13.333, h: 0.22, fill: { color: "0F4C81" }, line: { color: "0F4C81", transparency: 100 } } },
      { rect: { x: 0, y: 7.28, w: 13.333, h: 0.22, fill: { color: "125AA0" }, line: { color: "125AA0", transparency: 100 } } },
    ],
  });
  source.addSlide({ masterName: "Brand Layout" }).addText("Overview", { x: 1, y: 1, w: 8, h: 1 });
  const inputPath = join(await mkdtemp(join(tmpdir(), "ruxex-master-artwork-")), "source.pptx");
  const sourceZip = await JSZip.loadAsync(Buffer.from(await source.write({ outputType: "nodebuffer" })));
  const slideLayoutFiles = sourceZip.file(/ppt\/slideLayouts\/slideLayout\d+\.xml/);
  const artworkLayout = (await Promise.all(slideLayoutFiles.map(async (file) => ({ file, xml: await file.async("string") }))))
    .find(({ xml }) => xml.includes("125AA0"));
  const movedArtwork = artworkLayout.xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g)?.find((shape) => shape.includes("125AA0"));
  assert.ok(movedArtwork);
  sourceZip.file(artworkLayout.file.name, artworkLayout.xml.replace(movedArtwork, ""));
  const masterFile = sourceZip.file("ppt/slideMasters/slideMaster1.xml");
  const masterXml = await masterFile.async("string");
  sourceZip.file(masterFile.name, masterXml.replace("</p:spTree>", `${movedArtwork}</p:spTree>`));
  await writeFile(inputPath, await sourceZip.generateAsync({ type: "nodebuffer" }));

  const imported = await PresentationFile.importPptx(inputPath);
  const layout = imported.layouts.getItem("Brand Layout");
  assert.equal(imported.masters.items.length, 1);
  assert.equal(layout.parentMasterId, imported.masters.items[0].id);
  assert.ok(imported.masters.items[0].colorMap);
  assert.equal(layout._objects.length, 1);
  assert.equal(layout._masterObjects.length, 1);
  assert.equal(layout._objects[0].shape, "rect");
  assert.equal(layout._masterObjects[0].shape, "rect");
  assert.equal(imported.lossDiagnostics.some((item) => item.code === "unsupported_layout_content"), false);
  const preview = await layout.export({ format: "svg" });
  assert.match(await preview.text(), /#0F4C81/i);
  assert.match(await preview.text(), /#125AA0/i);
  const slidePreview = await imported.render({ slide: 0, format: "svg" });
  assert.match(await slidePreview.text(), /#0F4C81/i);
  const fullLayout = JSON.parse(await (await imported.slides.items[0].export({ format: "layout", detail: "full" })).text());
  assert.ok(fullLayout.inheritedLayers.some((layer) => layer.kind === "master" && layer.elements.some((element) => element.geometry === "rect")));
  assert.ok(fullLayout.inheritedLayers.some((layer) => layer.kind === "layout" && layer.elements.some((element) => element.geometry === "rect")));

  const restored = await Presentation.load(imported.toProto());
  assert.equal(restored.layouts.getItem("Brand Layout")._objects.length, 1);
  assert.equal(restored.layouts.getItem("Brand Layout")._masterObjects.length, 1);
  const exported = await restored.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await exported.arrayBuffer()));
  const layoutXml = (await Promise.all(zip.file(/ppt\/slideLayouts\/slideLayout\d+\.xml/).map((file) => file.async("string")))).join("\n");
  assert.match(layoutXml, /0F4C81/);
});

test("Presentation JSONPath supports field projection and common equality filters", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.shapes.add({ geometry: "textbox", text: "Confidential" }).name = "confidential-heading";
  slide.shapes.add({ geometry: "textbox", text: "Public" }).name = "public-heading";
  presentation.slides.add().addText("Next slide");

  const matches = await presentation.inspect({
    select: "$.slides[*].elements[?(@.name == 'confidential-heading')]",
    include: ["id", "name", "text"],
  });
  assert.equal(matches.recordCount, 1);
  assert.equal(matches.records[0].text, "Confidential");
  const titles = await presentation.inspect({ select: "$.slides[*].title" });
  assert.deepEqual(titles.records, []);
  const filtered = await presentation.inspect({
    select: "$.slides[*].elements[?(search(@.text, 'Confidential|Public') && @.kind == 'textbox')]",
    include: ["name", "text"],
  });
  assert.deepEqual(filtered.records.map((record) => record.text), ["Confidential", "Public"]);
  const commaPattern = await presentation.inspect({
    select: "$.slides[*].elements[?(search(@.text, 'Confidential,Public|Public'))]",
    include: ["text"],
  });
  assert.deepEqual(commaPattern.records.map((record) => record.text), ["Public"]);
  const recursive = await presentation.inspect({ select: "$..elements[*]", include: ["text"] });
  assert.equal(recursive.recordCount, 3);
  const propertyUnion = await presentation.inspect({ select: "$..elements[*]['kind','text']" });
  assert.equal(propertyUnion.recordCount, 6);
  assert.ok(propertyUnion.records.includes("textbox"));
  const slice = await presentation.inspect({ select: "$.slides[0:2]", include: ["index"] });
  assert.deepEqual(slice.records.map((record) => record.index), [0, 1]);
});

test("Presentation renders slide SVG and raster previews with a layout sidecar and montage", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const heading = slide.shapes.add({
    geometry: "textbox",
    position: { left: 40, top: 30, width: 500, height: 70 },
    text: "Quarterly review",
  });
  heading.text.style = { fontSize: 38, bold: true, color: "#123456" };
  slide.shapes.add({ geometry: "rect", position: { left: 40, top: 120, width: 180, height: 90 }, fill: "#ABCDEF" });

  const preview = await presentation.render({ slide: 0 });
  assert.equal(preview.type, "image/png");
  assert.ok(Buffer.from(await preview.arrayBuffer()).length > 20);
  assert.equal(JSON.parse(await preview.layout.text()).elements.length, 2);
  const svgPreview = await presentation.render({ slide: 0, format: "svg" });
  assert.equal(svgPreview.type, "image/svg+xml");
  assert.match(await svgPreview.text(), /Quarterly review/);
  const all = await presentation.render();
  assert.equal(all.length, 1);
  const montage = await presentation.render({ montage: true });
  assert.equal(montage.type, "image/png");
  for (const format of ["png", "jpeg", "webp"]) {
    const raster = await presentation.render({ slide: 0, format });
    assert.equal(raster.type, `image/${format}`);
    assert.ok(Buffer.from(await raster.arrayBuffer()).length > 20);
    assert.equal(JSON.parse(await raster.layout.text()).elements.length, 2);
  }
});

test("Presentation SVG preview renders chart titles, axes, gridlines, and legends", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.charts.add("bar", {
    position: { left: 40, top: 20, width: 400, height: 260 },
    title: "Quarterly revenue",
    categories: ["Q1", "Q2"],
    series: [{ name: "Revenue", values: [5, 10] }],
    xAxis: { title: "Quarter" },
    yAxis: { min: 0, max: 10, majorUnit: 5, title: "USD", majorGridlines: { fill: "#CBD5E1", width: 1 } },
    legend: { position: "bottom" },
  });
  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  for (const text of ["Quarterly revenue", "Quarter", "USD", "Q1", "Q2", "Revenue", "5", "10"]) {
    assert.ok(svg.includes(text), `expected chart preview to include ${text}`);
  }
  assert.match(svg, /stroke="#CBD5E1"/);
});

test("Presentation SVG preview draws line and pie charts with their chart geometry", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const lineChart = slide.charts.add("line", {
    position: { left: 10, top: 10, width: 300, height: 180 },
    title: "Revenue trend",
    yAxis: { numberFormatCode: "$#,##0" },
    series: [{ name: "Revenue", labels: ["Q1", "Q2", "Q3"], values: [12, 18, 15] }],
  });
  lineChart.series.getItemAt(0).values = [13, 18, 16];
  lineChart.yAxis = { minVal: 0 };
  assert.equal(lineChart.title, "Revenue trend");
  assert.deepEqual(lineChart.yAxis, { numberFormatCode: "$#,##0", minVal: 0 });
  assert.deepEqual(lineChart.series[0].values, [13, 18, 16]);
  slide.charts.add({
    type: "pie",
    position: { left: 340, top: 10, width: 180, height: 180 },
    series: [{ name: "Share", labels: ["A", "B", "C"], values: [4, 3, 3] }],
  });

  const svg = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svg, /<polyline/);
  assert.match(svg, /<path d="M/);
});

test("Presentation images support contain and cropped cover fitting", async () => {
  const presentation = Presentation.create({ slideSize: { width: 400, height: 200 } });
  const slide = presentation.slides.add();
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="2"><rect width="4" height="2" fill="#123456"/></svg>';
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  slide.images.add({ svg, fit: "contain", position: { left: 0, top: 0, width: 100, height: 100 } });
  slide.images.add({
    dataUrl: src,
    fit: "cover",
    crop: { left: "25%", top: 0, right: 0, bottom: 0 },
    position: { left: 120, top: 0, width: 100, height: 100 },
  });
  slide.images.add({
    blob: Buffer.from(svg),
    contentType: "image/svg+xml",
    alt: "Third party mark",
    geometry: "ellipse",
    position: { left: 240, top: 0, width: 100, height: 100 },
  });
  slide.images.add({
    dataUrl: src,
    crop: { left: "1px" },
    borderRadius: 8,
    position: { left: 0, top: 110, width: 100, height: 50 },
  });
  const svgPreview = await (await presentation.render({ slide: 0, format: "svg" })).text();
  assert.match(svgPreview, /x="0" y="25" width="100" height="50"/);
  assert.match(svgPreview, /x="120" y="0" width="100" height="100"/);
  assert.match(svgPreview, /x="240" y="0" width="100" height="100"/);
  assert.match(svgPreview, /clip-path="url\(#clip-im/);
  const pptx = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /<a:srcRect[^>]*l="37500"[^>]*r="12500"/);
  assert.match(slideXml, /<a:prstGeom[^>]*prst="ellipse"/);
  assert.match(slideXml, /<a:prstGeom[^>]*prst="roundRect"><a:avLst><a:gd name="adj"/);
  assert.match(slideXml, /<a:srcRect[^>]*l="25000"/);
  const path = join(await mkdtemp(join(tmpdir(), "ruxex-image-crop-roundtrip-")), "cropped.pptx");
  await writeFile(path, Buffer.from(await pptx.arrayBuffer()));
  const imported = await PresentationFile.importPptx(path);
  assert.deepEqual(imported.slides.items[0].objects[1].options.crop, {
    left: 0.375,
    top: 0,
    right: 0.125,
    bottom: 0,
  });
  assert.equal(imported.slides.items[0].objects[2].options.geometry, "ellipse");
  assert.equal(imported.slides.items[0].objects[3].options.borderRadius, 8);
});

test("Presentation prompt images regenerate through a host-provided image generator", async () => {
  const presentation = Presentation.create({
    imageGenerator: async (prompt, options) => {
      assert.equal(prompt, "a calm blue illustration");
      assert.equal(options.kind, "illustration");
      assert.deepEqual(options.position, { left: 20, top: 20, width: 100, height: 100 });
      return { dataUrl: `data:image/svg+xml;base64,${Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"8\" height=\"8\"><rect width=\"8\" height=\"8\" fill=\"blue\"/></svg>").toString("base64")}` };
    },
  });
  const image = presentation.slides.add().images.add({ prompt: "a calm blue illustration", position: { left: 20, top: 20, width: 100, height: 100 } });
  assert.equal(image.src, undefined);
  await image.regenerate({ kind: "illustration" });
  assert.match(image.src, /^data:image\/svg\+xml;base64,/);
  assert.match(await (await presentation.render({ slide: 0, format: "svg" })).text(), /image/);
});

test("PPTX import restores local image assets with their editable placement and alt text", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-presentation-image-roundtrip-"));
  const inputPath = join(directory, "image.pptx");
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.images.add({
    src: join(process.cwd(), "src-tauri/icons/icon.png"),
    altText: "Ruxex logo",
    position: { left: 40, top: 50, width: 96, height: 96 },
    hyperlink: { uri: "https://example.com", isExternal: true },
    rotation: 15,
    flipHorizontal: true,
  });
  await PresentationFile.exportPptx(presentation).save(inputPath);

  const imported = await PresentationFile.importPptx(inputPath);
  const image = imported.slides.items[0].objects[0];
  assert.equal(image.kind, "image");
  assert.match(image.src, /^data:image\/png;base64,/);
  assert.equal(image.altText, "Ruxex logo");
  assert.deepEqual(image.hyperlink, { uri: "https://example.com", isExternal: true });
  assert.equal(image.options.rotation, 15);
  assert.equal(image.options.flipHorizontal, true);
  assert.deepEqual({ x: image.options.x, y: image.options.y, w: image.options.w, h: image.options.h }, {
    x: 40,
    y: 50,
    w: 96,
    h: 96,
  });
  assert.equal(imported.lossDiagnostics.some((item) => item.code === "unsupported_images"), false);
  const preview = await imported.render({ slide: 0, format: "svg" });
  assert.match(await preview.text(), /href="data:image\/png;base64,/);
  const roundTripPath = join(directory, "image-round-trip.pptx");
  await PresentationFile.exportPptx(imported).save(roundTripPath);
  const roundTripped = await PresentationFile.importPptx(roundTripPath);
  assert.equal(roundTripped.slides.items[0].objects[0].altText, "Ruxex logo");
  assert.match(roundTripped.slides.items[0].objects[0].src, /^data:image\/png;base64,/);
});

test("Preset shapes accept editable text and export it with the shape", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const shape = slide.shapes.add({
    geometry: "roundRect",
    position: { left: 20, top: 30, width: 300, height: 100 },
    fill: "#EEEEEE",
    text: { text: "Review status", style: { fontSize: 28, bold: true } },
  });
  slide.addNotes("Source: supplied review report.");
  assert.equal(String(shape.text), "Review status");
  const inspected = await presentation.inspect({ select: "$.slides[*].elements[*]", include: ["kind", "geometry", "text"] });
  assert.deepEqual(inspected.records[0], { kind: "shape", geometry: "roundRect", text: "Review status" });
  const file = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await file.arrayBuffer()));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  const shapes = [...slideXml.matchAll(/<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g)].map(([shapeXml]) => shapeXml);
  assert.ok(shapes.some((shapeXml) =>
    shapeXml.includes('prst="roundRect"') && shapeXml.includes("Review status"),
  ));
  const directory = await mkdtemp(join(tmpdir(), "ruxex-shaped-text-roundtrip-"));
  const path = join(directory, "shape-text.pptx");
  await writeFile(path, Buffer.from(await file.arrayBuffer()));
  const imported = await PresentationFile.importPptx(path);
  assert.equal(imported.slides.items[0].objects.length, 1);
  assert.equal(imported.slides.items[0].objects[0].shape, "roundRect");
  assert.equal(imported.slides.items[0].objects[0].text, "Review status");
  assert.equal(imported.slides.items[0].objects[0].options.fill, "#EEEEEE");
  assert.equal(imported.slides.items[0].objects[0].options.textStyle.fontSize, 28);
  assert.equal(imported.slides.items[0].objects[0].options.textStyle.bold, true);
  assert.equal(imported.slides.items[0].objects[0].textRuns[0].style.bold, true);
  assert.equal(imported.slides.items[0].notes, "Source: supplied review report.");
});

test("Presentation shape text accepts styled rich runs and exports hyperlinks", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  const heading = slide.shapes.add({
    geometry: "textbox",
    position: { left: 40, top: 30, width: 500, height: 70 },
  });
  heading.text = [
    { run: "Status", style: { bold: true, color: "#123456", fontSize: "24px" } },
    { run: " review", style: { underline: "sng" }, link: { uri: "https://example.com", isExternal: true } },
  ];
  const bullets = slide.shapes.add({ geometry: "textbox", position: { left: 40, top: 120, width: 500, height: 120 } });
  bullets.text = [
    { bulletCharacter: "•", marginLeft: 18, indent: -9, spaceAfter: 8, runs: ["First item"] },
    { bulletCharacter: "•", marginLeft: 18, indent: -9, spaceAfter: 8, runs: ["Second item"] },
  ];

  assert.equal(heading.text.toString(), "Status review");
  assert.equal(heading.text.get("Status").text, "Status");
  heading.text.get("review").bold = true;
  heading.text.get("review").color = "#AA2233";
  heading.text.getRange(0, 6).italic = true;
  assert.deepEqual(heading.text.get("review").link, { uri: "https://example.com", isExternal: true });
  assert.equal(heading.text.get("review").bold, true);
  const file = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(xml, /Status/);
  assert.match(xml, /hlinkClick/);
  assert.match(xml, /AA2233/);
  assert.match(xml, /Status/);
  assert.match(xml, /buChar char="(?:&#x2022;|•)"/);
  const inspected = await presentation.inspect({ select: "$.slides[*].elements[*]", include: ["textRuns"] });
  assert.equal(inspected.records[0].textRuns[0].style.bold, true);
  const directory = await mkdtemp(join(tmpdir(), "ruxex-paragraph-import-"));
  const path = join(directory, "bullets.pptx");
  await writeFile(path, Buffer.from(await file.arrayBuffer()));
  const imported = await PresentationFile.importPptx(path);
  assert.equal(imported.slides.items[0].objects[0].textRuns[1].style.underline, "sng");
  assert.equal(imported.slides.items[0].objects[1].textParagraphs[0].bulletCharacter, "•");
  assert.equal(imported.slides.items[0].objects[1].textParagraphs[0].spaceAfter, 8);
});

test("Presentation rich text retains internal slide links through PPTX import and export", async () => {
  const presentation = Presentation.create();
  const first = presentation.slides.add();
  first.addText([{ run: "Jump to details", link: { uri: "slide:2", isExternal: false, action: "ppaction://hlinksldjump" } }], {
    position: { left: 40, top: 40, width: 400, height: 60 },
  });
  presentation.slides.add().addText("Details", { position: { left: 40, top: 40, width: 400, height: 60 } });
  const file = await presentation.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await file.arrayBuffer()));
  const relationships = await zip.file("ppt/slides/_rels/slide1.xml.rels").async("string");
  const xml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(relationships, /Type="[^"]*\/slide" Target="slide2\.xml"/);
  assert.match(xml, /action="ppaction:\/\/hlinksldjump"/);

  const path = join(await mkdtemp(join(tmpdir(), "ruxex-slide-link-")), "linked.pptx");
  await writeFile(path, Buffer.from(await file.arrayBuffer()));
  const imported = await PresentationFile.importPptx(path);
  assert.deepEqual(imported.slides.items[0].objects[0].textRuns[0].link, {
    uri: "slide:2",
    isExternal: false,
    action: "ppaction://hlinksldjump",
  });
  const exportedAgain = await imported.export({ format: "pptx" });
  const roundTripZip = await JSZip.loadAsync(Buffer.from(await exportedAgain.arrayBuffer()));
  assert.match(await roundTripZip.file("ppt/slides/_rels/slide1.xml.rels").async("string"), /Target="slide2\.xml"/);
});

test("Presentation exports and reimports mixed paragraph bullets and spacing", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();
  slide.addText([
    { bulletCharacter: "•", marginLeft: 24, indent: -12, spaceAfter: 8, runs: ["First point"] },
    { marginLeft: 48, spaceBefore: 4, runs: ["Indented detail"] },
  ], { position: { left: 20, top: 30, width: 700, height: 240 } });
  const directory = await mkdtemp(join(tmpdir(), "ruxex-paragraph-import-"));
  const path = join(directory, "paragraphs.pptx");
  await (await presentation.export({ format: "pptx" })).arrayBuffer().then((bytes) => writeFile(path, Buffer.from(bytes)));
  const zip = await JSZip.loadAsync(await readFile(path));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slideXml, /buChar char="•"/);
  assert.match(slideXml, /marL="228600"/);
  assert.match(slideXml, /indent="-114300"/);
  const imported = await PresentationFile.importPptx(path);
  const [text] = imported.slides.items[0].objects;
  assert.equal(text.textParagraphs[0].bulletCharacter, "•");
  assert.equal(text.textParagraphs[0].marginLeft, 24);
  assert.equal(text.textParagraphs[1].marginLeft, 48);
  assert.equal(text.textParagraphs[1].spaceBefore, 4);
});

test("Presentation proto round trips retain slide and element IDs", async () => {
  const presentation = Presentation.create({ title: "Proto test" });
  const slide = presentation.slides.add({ layout: "Title and Body", layoutId: "layout-title-body" });
  const shape = slide.shapes.add({ geometry: "textbox", text: ["Line one", "Line two"] });
  const table = slide.tables.add({ rows: [["Status"]] });
  table.getCell(0, 0).fill = "#DCEAFE";
  table.getCell(0, 0).text.style = { bold: true };
  slide.addNotes("Review notes");
  presentation.view.showGridlines();
  presentation.view.showGuides();
  presentation.view.hidePlaceholders();
  const proto = presentation.toProto();
  const loaded = await Presentation.load(proto);

  assert.equal(loaded.id, presentation.id);
  assert.equal(loaded.slides.items[0].id, slide.id);
  assert.equal(loaded.slides.items[0].layoutId, "layout-title-body");
  assert.equal(loaded.resolve(shape.id).text.toString(), "Line one\nLine two");
  assert.equal(loaded.resolve(table.id).getCell(0, 0).fill, "#DCEAFE");
  assert.deepEqual(loaded.resolve(table.id).getCell(0, 0).text.style, { bold: true });
  assert.equal(loaded.resolve(slide.notesId).text, "Review notes");
  assert.equal(loaded.view.gridlinesVisible, true);
  assert.equal(loaded.view.guidesVisible, true);
  assert.equal(loaded.view.placeholdersVisible, false);
  const gridPreview = await loaded.render({ slide: 0, format: "svg" });
  assert.match(await gridPreview.text(), /ruxex-grid/);
  assert.equal(loaded.view.toggleGridlines(), false);
  const pptx = await loaded.export({ format: "pptx" });
  const zip = await JSZip.loadAsync(Buffer.from(await pptx.arrayBuffer()));
  const viewXml = await zip.file("ppt/viewProps.xml").async("string");
  assert.match(viewXml, /showGuides="1"/);
});

test("Presentation export supports editable PPTX blobs and layout JSON", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-presentation-export-api-"));
  const path = join(directory, "review.pptx");
  const presentation = Presentation.create({ title: "Export API" });
  const slide = presentation.slides.add();
  slide.addText("Presentation export");

  const file = await presentation.export({ format: "pptx", fileName: path });
  assert.equal(file.type, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  assert.equal(Buffer.from(await file.arrayBuffer()).subarray(0, 2).toString(), "PK");
  assert.equal((await readFile(path)).subarray(0, 2).toString(), "PK");
  const layout = await presentation.export({ format: "layout", slide });
  assert.equal(JSON.parse(await layout.text()).slide.id, slide.id);
  const pdf = await presentation.export({ format: "pdf", fileName: join(directory, "review.pdf") });
  assert.equal(pdf.type, "application/pdf");
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
  assert.equal((await readFile(join(directory, "review.pdf"))).subarray(0, 4).toString(), "%PDF");
});

test("Presentation rejects unsupported shapes", async () => {
  const presentation = Presentation.create();
  const slide = presentation.slides.add();

  assert.throws(
    () => slide.addShape("unsupported-shape"),
    (error) => error.code === "unsupported_shape",
  );
});
