import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import PptxGenJS from "pptxgenjs";

import { ArtifactToolError } from "./a1-range.mjs";

const supportedShapes = new Set(["rect"]);

function validateCell(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  throw new ArtifactToolError(
    "unsupported_cell_value",
    "presentation tables support strings, numbers, booleans, and null",
  );
}

function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.every(Array.isArray) || rows.length === 0) {
    throw new ArtifactToolError("invalid_table", "presentation tables must be a non-empty matrix");
  }
  const width = rows[0].length;
  if (width === 0 || rows.some((row) => row.length !== width)) {
    throw new ArtifactToolError("invalid_table", "presentation tables must be rectangular");
  }
  rows.flat().forEach(validateCell);
}

function displayCell(value) {
  return value === null ? "" : String(value);
}

function textOptions(options = {}) {
  const { role, ...rest } = options;
  const defaults = role === "title"
    ? { x: 0.7, y: 0.5, w: 12, h: 0.7, fontSize: 28, bold: true }
    : { x: 0.7, y: 1.4, w: 12, h: 0.6, fontSize: 18 };
  return { ...defaults, ...rest };
}

class Slide {
  constructor(presentation, options = {}) {
    this.presentation = presentation;
    this.layout = options.layout ?? "wide";
    this.objects = [];
  }

  addText(text, options = {}) {
    if (typeof text !== "string") {
      throw new ArtifactToolError("invalid_text", "slide text must be a string");
    }
    this.objects.push({ kind: "text", text, options: { ...options } });
    return this;
  }

  addTable(rows, options = {}) {
    validateRows(rows);
    this.objects.push({ kind: "table", rows: rows.map((row) => row.map(displayCell)), options: { ...options } });
    return this;
  }

  addShape(shape, options = {}) {
    if (!supportedShapes.has(shape)) {
      throw new ArtifactToolError("unsupported_shape", `unsupported presentation shape: ${shape}`);
    }
    this.objects.push({ kind: "shape", shape, options: { ...options } });
    return this;
  }
}

function addSlideObjects(presentation, slideModel) {
  const slide = presentation.addSlide();
  for (const object of slideModel.objects) {
    if (object.kind === "text") slide.addText(object.text, textOptions(object.options));
    if (object.kind === "table") slide.addTable(object.rows, object.options);
    if (object.kind === "shape") {
      slide.addShape(presentation.ShapeType[object.shape], object.options);
    }
  }
}

export class Presentation {
  constructor(options = {}) {
    this.title = options.title ?? "";
    this.slides = [];
    this.sourcePath = options.sourcePath;
  }

  static async create(options = {}) {
    return new Presentation(options);
  }

  static async load(inputPath) {
    const bytes = await readFile(inputPath);
    if (bytes.subarray(0, 2).toString() !== "PK") {
      throw new ArtifactToolError("invalid_ooxml_package", `not a PPTX package: ${inputPath}`);
    }
    return new Presentation({ sourcePath: inputPath });
  }

  addSlide(options = {}) {
    const slide = new Slide(this, options);
    this.slides.push(slide);
    return slide;
  }

  async inspect() {
    return {
      ok: true,
      valid: true,
      slides: this.slides.length,
      objects: this.slides.reduce((total, slide) => total + slide.objects.length, 0),
      ...(this.sourcePath ? { sourcePath: this.sourcePath } : {}),
    };
  }

  async exportPptx(outputPath) {
    const presentation = new PptxGenJS();
    presentation.layout = "LAYOUT_WIDE";
    presentation.author = "Ruxex";
    presentation.subject = this.title;
    for (const slide of this.slides) addSlideObjects(presentation, slide);
    await mkdir(dirname(outputPath), { recursive: true });
    await presentation.writeFile({ fileName: outputPath });
    return { ok: true, format: "pptx", output: outputPath };
  }
}
