import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  Document as DocxDocument,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";

import { ArtifactToolError } from "./a1-range.mjs";
import { runEngine } from "./engine-client.mjs";

function validateCell(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  throw new ArtifactToolError(
    "unsupported_cell_value",
    "document tables support strings, numbers, booleans, and null",
  );
}

function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.every(Array.isArray) || rows.length === 0) {
    throw new ArtifactToolError("invalid_table", "document tables must be a non-empty matrix");
  }
  const width = rows[0].length;
  if (width === 0 || rows.some((row) => row.length !== width)) {
    throw new ArtifactToolError("invalid_table", "document tables must be rectangular");
  }
  rows.flat().forEach(validateCell);
}

function displayCell(value) {
  return value === null ? "" : String(value);
}

function headingLevel(level) {
  const normalized = Number(level ?? 1);
  const heading = HeadingLevel[`HEADING_${normalized}`];
  if (!heading) {
    throw new ArtifactToolError("invalid_heading_level", "document heading level must be 1-9");
  }
  return heading;
}

function paragraphFor(item) {
  if (item.kind === "heading") {
    return new Paragraph({ text: item.text, heading: headingLevel(item.level) });
  }
  return new Paragraph({ children: [new TextRun({ text: item.text })] });
}

function tableFor(rows) {
  return new Table({
    rows: rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (value) =>
              new TableCell({
                children: [new Paragraph({ text: displayCell(value) })],
              }),
          ),
        }),
    ),
  });
}

export class Document {
  constructor(options = {}) {
    this.title = options.title ?? "";
    this.items = options.items ? [...options.items] : [];
    this.sourcePath = options.sourcePath;
    this.lossDiagnostics = options.lossDiagnostics ? [...options.lossDiagnostics] : [];
  }

  static async create(options = {}) {
    return new Document(options);
  }

  static async load(inputPath) {
    const bytes = await readFile(inputPath);
    if (bytes.subarray(0, 2).toString() !== "PK") {
      throw new ArtifactToolError("invalid_ooxml_package", `not a DOCX package: ${inputPath}`);
    }
    const response = await runEngine({ version: 1, operation: "docx_read", input_path: inputPath });
    return new Document({
      sourcePath: inputPath,
      items: response.items ?? [],
      lossDiagnostics: response.diagnostics ?? [],
    });
  }

  addParagraph(text, _options = {}) {
    if (typeof text !== "string") {
      throw new ArtifactToolError("invalid_text", "document paragraph text must be a string");
    }
    this.items.push({ kind: "paragraph", text });
    return this;
  }

  addHeading(text, level = 1) {
    if (typeof text !== "string") {
      throw new ArtifactToolError("invalid_text", "document heading text must be a string");
    }
    headingLevel(level);
    this.items.push({ kind: "heading", text, level: Number(level) });
    return this;
  }

  addTable(rows, _options = {}) {
    validateRows(rows);
    this.items.push({ kind: "table", rows: rows.map((row) => [...row]) });
    return this;
  }

  async inspect() {
    const inspection = {
      ok: true,
      valid: true,
      paragraphs: this.items.filter((item) => item.kind === "paragraph" || item.kind === "heading")
        .length,
      tables: this.items.filter((item) => item.kind === "table").length,
    };
    if (this.sourcePath) {
      return {
        ...inspection,
        diagnostics: this.lossDiagnostics,
        editable: this.lossDiagnostics.length === 0,
        sourcePath: this.sourcePath,
      };
    }
    return inspection;
  }

  async exportDocx(outputPath, options = {}) {
    if (this.lossDiagnostics.length > 0 && options.acceptDiagnostics !== true) {
      throw new ArtifactToolError(
        "lossy_import",
        "loaded DOCX contains unsupported content; pass acceptDiagnostics to export",
      );
    }
    const children = this.items.map((item) =>
      item.kind === "table" ? tableFor(item.rows) : paragraphFor(item),
    );
    const document = new DocxDocument({
      title: this.title,
      sections: [{ children }],
    });
    const buffer = await Packer.toBuffer(document);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, buffer);
    return { ok: true, format: "docx", output: outputPath };
  }
}
