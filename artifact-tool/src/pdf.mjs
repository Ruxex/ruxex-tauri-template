import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { ArtifactToolError } from "./a1-range.mjs";
import { runEngine } from "./engine-client.mjs";

const DEFAULT_PAGE = { width: 595, height: 842 };

function validateText(text) {
  if (typeof text !== "string") {
    throw new ArtifactToolError("invalid_text", "PDF text must be a string");
  }
}

function normalizePageOptions(options = {}) {
  const width = Number(options.width ?? DEFAULT_PAGE.width);
  const height = Number(options.height ?? DEFAULT_PAGE.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ArtifactToolError("invalid_page", "PDF page dimensions must be positive numbers");
  }
  return { width, height };
}

class PdfPage {
  constructor(document, options = {}) {
    this.document = document;
    const { width, height } = normalizePageOptions(options);
    this.width = width;
    this.height = height;
    this.blocks = [];
  }

  addText(text, options = {}) {
    validateText(text);
    const x = Number(options.x ?? 48);
    const y = Number(options.y ?? this.height - 62);
    const size = Number(options.size ?? 12);
    if (![x, y, size].every(Number.isFinite) || size <= 0) {
      throw new ArtifactToolError("invalid_text", "PDF text coordinates and size must be finite");
    }
    this.blocks.push({ text, x, y, size });
    return this;
  }

  addTable(rows, options = {}) {
    if (!Array.isArray(rows) || rows.length === 0 || !rows.every(Array.isArray)) {
      throw new ArtifactToolError("invalid_table", "PDF tables must be a non-empty matrix");
    }
    const width = rows[0].length;
    if (width === 0 || rows.some((row) => row.length !== width)) {
      throw new ArtifactToolError("invalid_table", "PDF table rows must be rectangular");
    }
    const rowOptions = {
      x: Number(options.x ?? 48),
      y: Number(options.y ?? this.height - 120),
      row_height: Number(options.rowHeight ?? 24),
      font_size: Number(options.fontSize ?? 10),
      column_widths: options.columnWidths?.map(Number) ?? [],
    };
    this.blocks.push({
      kind: "table",
      rows: rows.map((row) => row.map((value) => String(value ?? ""))),
      ...rowOptions,
    });
    return this;
  }

  addImage(inputPath, options = {}) {
    if (typeof inputPath !== "string" || inputPath.trim() === "") {
      throw new ArtifactToolError("invalid_image", "PDF image path is required");
    }
    const width = Number(options.width ?? 240);
    const height = Number(options.height ?? 180);
    if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      throw new ArtifactToolError("invalid_image", "PDF image dimensions must be positive numbers");
    }
    this.blocks.push({
      kind: "image",
      path: resolve(inputPath),
      x: Number(options.x ?? 48),
      y: Number(options.y ?? this.height - height - 80),
      width,
      height,
    });
    return this;
  }
}

export class PdfDocument {
  constructor(options = {}) {
    this.title = options.title ?? "";
    this.sourcePath = options.sourcePath;
    this.allowedRoots = options.allowedRoots?.map((root) => resolve(root)) ?? [process.cwd()];
    this.pages = [];
  }

  static create(options = {}) {
    return new PdfDocument(options);
  }

  static async load(inputPath) {
    const bytes = await readFile(inputPath);
    if (bytes.subarray(0, 5).toString() !== "%PDF-") {
      throw new ArtifactToolError("invalid_pdf", `not a PDF file: ${inputPath}`);
    }
    return new PdfDocument({ sourcePath: inputPath });
  }

  addPage(options = {}) {
    if (this.sourcePath) {
      throw new ArtifactToolError("unsupported_operation", "loaded PDFs cannot be edited yet");
    }
    const page = new PdfPage(this, options);
    this.pages.push(page);
    return page;
  }

  async inspect() {
    if (this.sourcePath) {
      const response = await runEngine({
        version: 1,
        operation: "pdf_read",
        input_path: this.sourcePath,
      });
      return {
        ok: response.ok === true,
        valid: response.valid === true,
        pages: response.pages,
        textBlocks: (response.text ?? []).reduce(
          (count, pageText) => count + (pageText ? pageText.split("\n").length : 0),
          0,
        ),
        sourcePath: this.sourcePath,
      };
    }
    return {
      ok: true,
      valid: this.pages.length > 0,
      pages: this.pages.length,
      textBlocks: this.pages.reduce((count, page) => count + page.blocks.length, 0),
    };
  }

  async exportPdf(outputPath) {
    if (this.sourcePath) {
      throw new ArtifactToolError("unsupported_operation", "loaded PDFs cannot be exported yet");
    }
    if (this.pages.length === 0) {
      throw new ArtifactToolError("invalid_pdf", "PDF must contain at least one page");
    }
    const directory = await mkdtemp(join(tmpdir(), "ruxex-pdf-input-"));
    const inputPath = join(directory, "input.json");
    await mkdir(dirname(outputPath), { recursive: true });
    try {
      await writeFile(inputPath, JSON.stringify({
        allowed_roots: this.allowedRoots,
        pages: this.pages.map((page) => ({
          width: page.width,
          height: page.height,
          blocks: page.blocks.filter((block) => block.kind !== "table" && block.kind !== "image"),
          tables: page.blocks
            .filter((block) => block.kind === "table")
            .map(({ kind: _kind, ...table }) => table),
          images: page.blocks
            .filter((block) => block.kind === "image")
            .map(({ kind: _kind, ...image }) => image),
        })),
      }));
      return await runEngine({
        version: 1,
        operation: "pdf_create",
        input_path: inputPath,
        output_path: outputPath,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
