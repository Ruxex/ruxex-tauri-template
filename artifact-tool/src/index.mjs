import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ArtifactToolError, parseRange } from "./a1-range.mjs";
import { runEngine } from "./engine-client.mjs";

function cloneRows(rows) {
  return rows.map((row) => [...row]);
}

function validateCell(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  throw new ArtifactToolError(
    "unsupported_cell_value",
    "only strings, numbers, booleans, and null are supported",
  );
}

function validateMatrix(values) {
  if (!Array.isArray(values) || !values.every(Array.isArray)) {
    throw new ArtifactToolError("invalid_values", "range values must be a matrix");
  }
  const width = values[0]?.length ?? 0;
  for (const row of values) {
    if (row.length !== width) {
      throw new ArtifactToolError("invalid_values", "range values must be rectangular");
    }
    row.forEach(validateCell);
  }
}

class WorksheetCollection {
  constructor(workbook) {
    this.workbook = workbook;
  }

  add(name) {
    if (this.workbook.sheets.has(name)) {
      throw new ArtifactToolError("duplicate_sheet_name", `duplicate sheet name: ${name}`);
    }
    const sheet = new Worksheet(this.workbook, name, []);
    this.workbook.sheets.set(name, sheet);
    return sheet;
  }

  getItem(name) {
    const sheet = this.workbook.sheets.get(name);
    if (!sheet) throw new ArtifactToolError("worksheet_not_found", `worksheet not found: ${name}`);
    return sheet;
  }

  get items() {
    return [...this.workbook.sheets.values()];
  }
}

class Worksheet {
  constructor(workbook, name, rows) {
    this.workbook = workbook;
    this.name = name;
    this.rows = cloneRows(rows);
  }

  getRange(reference) {
    return new Range(this, parseRange(reference));
  }

  dimensions() {
    let columns = 0;
    for (const row of this.rows) columns = Math.max(columns, row.length);
    return { rows: this.rows.length, columns };
  }
}

class Range {
  constructor(worksheet, bounds) {
    this.worksheet = worksheet;
    this.bounds = bounds;
  }

  get values() {
    const result = [];
    for (let row = this.bounds.start.row; row <= this.bounds.end.row; row += 1) {
      const values = [];
      for (let column = this.bounds.start.column; column <= this.bounds.end.column; column += 1) {
        values.push(this.worksheet.rows[row]?.[column] ?? null);
      }
      result.push(values);
    }
    return result;
  }

  set values(values) {
    validateMatrix(values);
    for (let row = this.bounds.start.row; row <= this.bounds.end.row; row += 1) {
      if (!this.worksheet.rows[row]) this.worksheet.rows[row] = [];
      for (let column = this.bounds.start.column; column <= this.bounds.end.column; column += 1) {
        const value = values[row - this.bounds.start.row]?.[column - this.bounds.start.column] ?? null;
        this.worksheet.rows[row][column] = value;
      }
    }
  }

  get formulas() {
    throw new ArtifactToolError("unsupported_operation", "formula reads are not supported yet");
  }

  set formulas(_formulas) {
    throw new ArtifactToolError("unsupported_operation", "formula writes are not supported yet");
  }

  get format() {
    throw new ArtifactToolError("unsupported_operation", "range formatting is not supported yet");
  }

  set format(_format) {
    throw new ArtifactToolError("unsupported_operation", "range formatting is not supported yet");
  }
}

export class Workbook {
  constructor(sheets = []) {
    this.sheets = new Map(sheets.map(({ name, rows }) => [name, new Worksheet(this, name, rows)]));
    this.worksheets = new WorksheetCollection(this);
  }

  static async create() {
    return new Workbook();
  }

  static async load(inputPath) {
    const response = await runEngine({ version: 1, operation: "read", input_path: inputPath });
    return new Workbook(response.sheets);
  }

  recalculate() {
    return { ok: true, formulas: 0, recalculated: false };
  }

  async inspect(options = {}) {
    if (options.kind && options.kind !== "sheet") {
      throw new ArtifactToolError("unsupported_operation", `unsupported inspection kind: ${options.kind}`);
    }
    const sheets = this.worksheets.items
      .filter((sheet) => !options.sheetName || sheet.name === options.sheetName)
      .map((sheet) => ({ name: sheet.name, ...sheet.dimensions() }));
    return { ok: true, valid: true, sheets };
  }

  async render(_options = {}) {
    throw new ArtifactToolError("unsupported_operation", "rendering is not available in this runtime");
  }

  async exportXlsx(outputPath) {
    const directory = await mkdtemp(join(tmpdir(), "ruxex-artifact-input-"));
    const inputPath = join(directory, "workbook.json");
    try {
      await writeFile(
        inputPath,
        JSON.stringify({
          sheets: this.worksheets.items.map((sheet) => ({ name: sheet.name, rows: sheet.rows })),
        }),
      );
      return await runEngine({
        version: 1,
        operation: "create",
        input_path: inputPath,
        output_path: outputPath,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

export { ArtifactToolError };
