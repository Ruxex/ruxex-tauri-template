import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import PptxGenJS from "pptxgenjs";

import { ArtifactToolError } from "./a1-range.mjs";
import { runEngine } from "./engine-client.mjs";

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
    this.shapes = new ShapeCollection(this);
    this.tables = new TableCollection(this);
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

function mapPosition(options = {}) {
  const { position, ...rest } = options;
  if (!position) return { ...rest };
  return {
    ...rest,
    ...(position.left !== undefined ? { x: position.left } : {}),
    ...(position.top !== undefined ? { y: position.top } : {}),
    ...(position.width !== undefined ? { w: position.width } : {}),
    ...(position.height !== undefined ? { h: position.height } : {}),
  };
}

class ShapeCollection {
  constructor(slide) {
    this.slide = slide;
  }

  add(config = {}) {
    const { geometry, text, ...options } = config;
    const mappedOptions = mapPosition(options);
    if (geometry === "textbox") {
      this.slide.addText(text ?? "", mappedOptions);
      return this.slide.objects.at(-1);
    }
    if (geometry === "rect") {
      this.slide.addShape("rect", mappedOptions);
      return this.slide.objects.at(-1);
    }
    throw new ArtifactToolError(
      "unsupported_shape",
      `unsupported presentation shape: ${geometry}`,
    );
  }
}

class TableCollection {
  constructor(slide) {
    this.slide = slide;
  }

  add(config = {}) {
    const { rows, ...options } = config;
    this.slide.addTable(rows, mapPosition(options));
    return this.slide.objects.at(-1);
  }
}

function createSlide(presentation, options = {}) {
  if (presentation.shallowImport) {
    throw new ArtifactToolError(
      "unsupported_operation",
      "shallow PPTX imports cannot be edited until slide content is parsed",
    );
  }
  const slide = new Slide(presentation, options);
  presentation.slides.items.push(slide);
  return slide;
}

class SlideCollection {
  constructor(presentation) {
    this.presentation = presentation;
    this.items = [];
  }

  add(options = {}) {
    return createSlide(this.presentation, options);
  }

  get length() {
    return this.items.length;
  }

  [Symbol.iterator]() {
    return this.items[Symbol.iterator]();
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
    this.slides = new SlideCollection(this);
    this.sourcePath = options.sourcePath;
    this.shallowImport = options.shallowImport === true;
    this.lossDiagnostics = options.lossDiagnostics ? [...options.lossDiagnostics] : [];
  }

  static create(options = {}) {
    return new Presentation(options);
  }

  static async load(inputPath) {
    const bytes = await readFile(inputPath);
    if (bytes.subarray(0, 2).toString() !== "PK") {
      throw new ArtifactToolError("invalid_ooxml_package", `not a PPTX package: ${inputPath}`);
    }
    const response = await runEngine({ version: 1, operation: "pptx_read", input_path: inputPath });
    const presentation = new Presentation({
      sourcePath: inputPath,
      shallowImport: false,
      lossDiagnostics: response.diagnostics ?? [],
    });
    for (const slideModel of response.slides ?? []) {
      const slide = presentation.addSlide();
      for (const object of slideModel.objects ?? []) {
        if (object.kind === "text") slide.addText(object.text);
      }
    }
    return presentation;
  }

  async inspect() {
    return {
      ok: true,
      valid: true,
      slides: this.slides.length,
      objects: this.slides.items.reduce((total, slide) => total + slide.objects.length, 0),
      diagnostics: this.lossDiagnostics,
      editable: this.lossDiagnostics.length === 0,
      ...(this.sourcePath ? { sourcePath: this.sourcePath } : {}),
    };
  }

}

export async function exportPresentationPptx(presentationModel, outputPath, options = {}) {
  if (presentationModel.shallowImport) {
    throw new ArtifactToolError(
      "unsupported_operation",
      "shallow PPTX imports cannot be exported until slide content is parsed",
    );
  }
  if (presentationModel.lossDiagnostics.length > 0 && options.acceptDiagnostics !== true) {
    throw new ArtifactToolError(
      "lossy_import",
      "loaded PPTX contains unsupported content; pass acceptDiagnostics to export",
    );
  }
  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_WIDE";
  presentation.author = "Ruxex";
  presentation.subject = presentationModel.title;
  for (const slide of presentationModel.slides.items) addSlideObjects(presentation, slide);
  await mkdir(dirname(outputPath), { recursive: true });
  await presentation.writeFile({ fileName: outputPath });
  return { ok: true, format: "pptx", output: outputPath };
}
