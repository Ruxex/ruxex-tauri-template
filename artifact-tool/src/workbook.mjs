import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ArtifactToolError, parseRange } from "./a1-range.mjs";
import { evaluateFormula, FormulaEvaluationError } from "./formula-engine.mjs";
import { runEngine } from "./engine-client.mjs";

function cloneRows(rows) {
  return rows.map((row) => [...row]);
}

function cloneValue(value) {
  if (value && typeof value === "object") return structuredClone(value);
  return value;
}

function validateCell(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  throw new ArtifactToolError("unsupported_cell_value", "only strings, numbers, booleans, and null are supported");
}

function validateMatrix(values, code = "invalid_values") {
  if (!Array.isArray(values) || !values.every(Array.isArray)) {
    throw new ArtifactToolError(code, "range values must be a matrix");
  }
  const width = values[0]?.length ?? 0;
  for (const row of values) {
    if (row.length !== width) throw new ArtifactToolError(code, "range values must be rectangular");
    row.forEach(validateCell);
  }
}

function validateColor(value) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new ArtifactToolError("invalid_format", "colors must use #RRGGBB");
  }
}

function validateFormat(format) {
  if (!format || typeof format !== "object" || Array.isArray(format)) {
    throw new ArtifactToolError("invalid_format", "format must be an object");
  }
  if (format.fill !== undefined) validateColor(format.fill);
  if (format.font !== undefined) {
    if (!format.font || typeof format.font !== "object" || Array.isArray(format.font)) {
      throw new ArtifactToolError("invalid_format", "font must be an object");
    }
    if (format.font.color !== undefined) validateColor(format.font.color);
    for (const key of ["bold", "italic"]) {
      if (format.font[key] !== undefined && typeof format.font[key] !== "boolean") {
        throw new ArtifactToolError("invalid_format", `${key} must be boolean`);
      }
    }
    if (format.font.size !== undefined && (!Number.isFinite(format.font.size) || format.font.size <= 0)) {
      throw new ArtifactToolError("invalid_format", "font size must be positive");
    }
  }
  for (const key of ["horizontalAlignment", "verticalAlignment", "numberFormat"]) {
    if (format[key] !== undefined && typeof format[key] !== "string") {
      throw new ArtifactToolError("invalid_format", `${key} must be a string`);
    }
  }
  if (format.wrapText !== undefined && typeof format.wrapText !== "boolean") {
    throw new ArtifactToolError("invalid_format", "wrapText must be boolean");
  }
  if (format.columnWidth !== undefined && (!Number.isFinite(format.columnWidth) || format.columnWidth <= 0)) {
    throw new ArtifactToolError("invalid_format", "columnWidth must be positive");
  }
}

function validateFormulaMatrix(formulas) {
  if (!Array.isArray(formulas) || !formulas.every(Array.isArray)) {
    throw new ArtifactToolError("invalid_formulas", "range formulas must be a matrix");
  }
  const width = formulas[0]?.length ?? 0;
  for (const row of formulas) {
    if (row.length !== width) throw new ArtifactToolError("invalid_formulas", "range formulas must be rectangular");
    for (const formula of row) {
      if (formula !== null && (typeof formula !== "string" || !formula.trim().startsWith("="))) {
        throw new ArtifactToolError("invalid_formula", "formulas must be strings beginning with '=' or null");
      }
    }
  }
}

function columnLabel(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function rangeKey(row, column) {
  return `${row}:${column}`;
}

class WorksheetCollection {
  constructor(workbook) {
    this.workbook = workbook;
  }

  add(name) {
    if (typeof name !== "string" || !name.trim()) {
      throw new ArtifactToolError("invalid_sheet_name", "worksheet name must be a non-empty string");
    }
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

class TableCollection {
  constructor(worksheet) {
    this.worksheet = worksheet;
  }

  add(options) {
    if (!options || typeof options !== "object") {
      throw new ArtifactToolError("invalid_table", "table options must be an object");
    }
    if (typeof options.name !== "string" || !options.name.trim()) {
      throw new ArtifactToolError("invalid_table", "table name must be a non-empty string");
    }
    const bounds = parseRange(options.range);
    if (this.worksheet._tableData.some((table) => table.name === options.name)) {
      throw new ArtifactToolError("duplicate_table_name", `duplicate table name: ${options.name}`);
    }
    const table = {
      name: options.name,
      range: bounds.reference,
      hasHeaders: options.hasHeaders ?? true,
    };
    this.worksheet._tableData.push(table);
    return table;
  }

  get items() {
    return [...this.worksheet._tableData];
  }
}

class ChartCollection {
  constructor(worksheet) {
    this.worksheet = worksheet;
  }

  add(options) {
    if (!options || typeof options !== "object") {
      throw new ArtifactToolError("invalid_chart", "chart options must be an object");
    }
    const allowed = ["column", "bar", "line", "pie", "doughnut"];
    if (!allowed.includes(options.type)) {
      throw new ArtifactToolError("invalid_chart", `unsupported chart type: ${options.type}`);
    }
    const position = parseRange(options.position);
    if (!Array.isArray(options.series) || options.series.length === 0) {
      throw new ArtifactToolError("invalid_chart", "chart requires at least one series");
    }
    const series = options.series.map((item) => {
      if (!item || typeof item !== "object") throw new ArtifactToolError("invalid_chart", "chart series must be objects");
      parseRange(item.categories);
      parseRange(item.values);
      return {
        name: item.name ?? null,
        categories: item.categories,
        values: item.values,
      };
    });
    const chart = { type: options.type, position: position.reference, series };
    this.worksheet._chartData.push(chart);
    return chart;
  }

  get items() {
    return [...this.worksheet._chartData];
  }
}

class Worksheet {
  constructor(workbook, name, input = {}) {
    this.workbook = workbook;
    this.name = name;
    this.rows = cloneRows(input.rows ?? []);
    this.formulaRows = cloneRows(input.formulas ?? []).map((row) => row.map((value) => value ?? null));
    this.formats = new Map((input.formats ?? []).map((format) => [format.range, format]));
    this.merges = [...(input.merges ?? [])];
    this.columnWidths = new Map((input.columnWidths ?? []).map((item) => [item.column, item.width]));
    this._tableData = [...(input.tables ?? [])];
    this._chartData = [...(input.charts ?? [])];
    this.tablesCollection = new TableCollection(this);
    this.chartsCollection = new ChartCollection(this);
  }

  getRange(reference) {
    return new Range(this, parseRange(reference));
  }

  get tables() {
    return this.tablesCollection;
  }

  get charts() {
    return this.chartsCollection;
  }

  dimensions() {
    let columns = 0;
    for (const row of this.rows) columns = Math.max(columns, row.length);
    for (const row of this.formulaRows) columns = Math.max(columns, row.length);
    return { rows: Math.max(this.rows.length, this.formulaRows.length), columns };
  }

  rawTables() {
    return this._tableData;
  }

  rawCharts() {
    return this._chartData;
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
      if (!this.worksheet.formulaRows[row]) this.worksheet.formulaRows[row] = [];
      for (let column = this.bounds.start.column; column <= this.bounds.end.column; column += 1) {
        const value = values[row - this.bounds.start.row]?.[column - this.bounds.start.column] ?? null;
        this.worksheet.rows[row][column] = cloneValue(value);
        this.worksheet.formulaRows[row][column] = null;
      }
    }
  }

  get formulas() {
    const result = [];
    for (let row = this.bounds.start.row; row <= this.bounds.end.row; row += 1) {
      const values = [];
      for (let column = this.bounds.start.column; column <= this.bounds.end.column; column += 1) {
        values.push(this.worksheet.formulaRows[row]?.[column] ?? null);
      }
      result.push(values);
    }
    return result;
  }

  set formulas(formulas) {
    validateFormulaMatrix(formulas);
    for (let row = this.bounds.start.row; row <= this.bounds.end.row; row += 1) {
      if (!this.worksheet.rows[row]) this.worksheet.rows[row] = [];
      if (!this.worksheet.formulaRows[row]) this.worksheet.formulaRows[row] = [];
      for (let column = this.bounds.start.column; column <= this.bounds.end.column; column += 1) {
        const formula = formulas[row - this.bounds.start.row]?.[column - this.bounds.start.column] ?? null;
        this.worksheet.formulaRows[row][column] = formula;
        if (formula === null) this.worksheet.rows[row][column] = null;
      }
    }
  }

  get format() {
    return this.worksheet.formats.get(this.bounds.reference) ?? {};
  }

  set format(format) {
    validateFormat(format);
    this.worksheet.formats.set(this.bounds.reference, { range: this.bounds.reference, ...structuredClone(format) });
    if (format.columnWidth !== undefined) {
      for (let column = this.bounds.start.column; column <= this.bounds.end.column; column += 1) {
        this.worksheet.columnWidths.set(columnLabel(column), format.columnWidth);
      }
    }
  }

  merge() {
    if (!this.worksheet.merges.some((merge) => merge.range === this.bounds.reference)) {
      this.worksheet.merges.push({ range: this.bounds.reference });
    }
    return this;
  }
}

function valueAt(sheet, row, column) {
  return sheet.rows[row]?.[column] ?? null;
}

function formulaAt(sheet, row, column) {
  return sheet.formulaRows[row]?.[column] ?? null;
}

function formatForEngine(format) {
  return {
    range: format.range,
    font: format.font,
    fill: format.fill,
    horizontal_alignment: format.horizontalAlignment,
    vertical_alignment: format.verticalAlignment,
    wrap_text: format.wrapText,
    number_format: format.numberFormat,
  };
}

function sheetForEngine(sheet) {
  const formats = [...sheet.formats.values()].map(formatForEngine);
  const columnWidths = [...sheet.columnWidths.entries()].map(([column, width]) => ({ column, width }));
  return {
    name: sheet.name,
    rows: sheet.rows,
    formulas: sheet.formulaRows,
    formats,
    merges: sheet.merges,
    column_widths: columnWidths,
    tables: sheet._tableData.map((table) => ({
      name: table.name,
      range: table.range,
      has_headers: table.hasHeaders,
    })),
    charts: [...sheet._chartData],
  };
}

export class Workbook {
  constructor(sheets = []) {
    this.sheets = new Map();
    this.worksheets = new WorksheetCollection(this);
    for (const input of sheets) {
      this.sheets.set(input.name, new Worksheet(this, input.name, input));
    }
  }

  static create() {
    return new Workbook();
  }

  recalculate() {
    let formulas = 0;
    let evaluated = 0;
    let unsupported = 0;
    const evaluating = new Set();

    for (const sheet of this.worksheets.items) {
      for (let row = 0; row < sheet.formulaRows.length; row += 1) {
        for (let column = 0; column < (sheet.formulaRows[row]?.length ?? 0); column += 1) {
          if (formulaAt(sheet, row, column) !== null) formulas += 1;
        }
      }
    }

    const evaluateCell = (sheet, row, column) => {
      const formula = formulaAt(sheet, row, column);
      if (formula === null) return valueAt(sheet, row, column);
      const key = `${sheet.name}!${row}:${column}`;
      if (evaluating.has(key)) throw new FormulaEvaluationError("unsupported_formula", "circular formula reference");
      evaluating.add(key);
      try {
        const value = evaluateFormula(formula, {
          getCell: (reference) => {
            const bounds = parseRange(reference);
            return evaluateCell(sheet, bounds.start.row, bounds.start.column);
          },
          getRange: (startReference, endReference) => {
            const bounds = parseRange(`${startReference}:${endReference}`);
            const values = [];
            for (let currentRow = bounds.start.row; currentRow <= bounds.end.row; currentRow += 1) {
              const rowValues = [];
              for (let currentColumn = bounds.start.column; currentColumn <= bounds.end.column; currentColumn += 1) {
                rowValues.push(evaluateCell(sheet, currentRow, currentColumn));
              }
              values.push(rowValues);
            }
            return values;
          },
        });
        validateCell(value);
        sheet.rows[row] ??= [];
        sheet.rows[row][column] = value;
        evaluated += 1;
        return value;
      } finally {
        evaluating.delete(key);
      }
    };

    for (const sheet of this.worksheets.items) {
      for (let row = 0; row < sheet.formulaRows.length; row += 1) {
        for (let column = 0; column < (sheet.formulaRows[row]?.length ?? 0); column += 1) {
          if (formulaAt(sheet, row, column) === null) continue;
          try {
            evaluateCell(sheet, row, column);
          } catch (error) {
            if (error instanceof FormulaEvaluationError || error?.code === "unsupported_formula") {
              unsupported += 1;
              sheet.rows[row] ??= [];
              sheet.rows[row][column] = null;
            } else {
              throw error;
            }
          }
        }
      }
    }
    return { ok: true, formulas, evaluated, unsupported };
  }

  async inspect(options = {}) {
    if (options.kind && options.kind !== "sheet") {
      throw new ArtifactToolError("unsupported_operation", `unsupported inspection kind: ${options.kind}`);
    }
    const sheets = this.worksheets.items
      .filter((sheet) => !options.sheetName || sheet.name === options.sheetName)
      .map((sheet) => ({
        name: sheet.name,
        ...sheet.dimensions(),
        formulas: sheet.formulaRows.flat().filter((formula) => formula !== null).length,
        merges: sheet.merges.length,
        tables: sheet._tableData.length,
        charts: sheet._chartData.length,
      }));
    return { ok: true, valid: true, sheets };
  }

  async render(_options = {}) {
    throw new ArtifactToolError("unsupported_operation", "rendering is not available in this runtime");
  }
}

export async function loadWorkbook(inputPath) {
  const response = await runEngine({ version: 1, operation: "read", input_path: inputPath });
  return new Workbook(response.sheets);
}

export async function exportWorkbookXlsx(workbook, outputPath) {
  const directory = await mkdtemp(join(tmpdir(), "ruxex-artifact-input-"));
  const inputPath = join(directory, "workbook.json");
  try {
    await writeFile(inputPath, JSON.stringify({ sheets: workbook.worksheets.items.map(sheetForEngine) }));
    return await runEngine({ version: 1, operation: "create", input_path: inputPath, output_path: outputPath });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
