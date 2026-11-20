import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ArtifactToolError, parseRange } from "./a1-range.mjs";
import { evaluateFormula, FormulaEvaluationError, translateFormula } from "./formula-engine.mjs";
import { runEngine } from "./engine-client.mjs";
import { searchSpreadsheetCapabilities, spreadsheetCapabilities } from "./spreadsheet-capabilities.mjs";
import { parseCsv } from "./csv.mjs";

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

  getItemAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.workbook.sheets.size) {
      throw new ArtifactToolError("worksheet_not_found", `worksheet index is out of range: ${index}`);
    }
    return this.items[index];
  }

  getActiveWorksheet() {
    const sheet = this.items[0];
    if (!sheet) throw new ArtifactToolError("worksheet_not_found", "workbook has no worksheets");
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

  add(options, hasHeaders = true, name = undefined) {
    const input = typeof options === "string" ? { range: options, hasHeaders, name } : options;
    if (!input || typeof input !== "object") {
      throw new ArtifactToolError("invalid_table", "table options must be a range string or object");
    }
    if (typeof input.name !== "string" || !input.name.trim()) {
      throw new ArtifactToolError("invalid_table", "table name must be a non-empty string");
    }
    const bounds = parseRange(input.range);
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(input.name) || /^[A-Za-z]{1,3}[1-9][0-9]*$/.test(input.name)) {
      throw new ArtifactToolError("invalid_table", `invalid Excel table name: ${input.name}`);
    }
    if (this.worksheet._tableData.some((table) => table.name === input.name)) throw new ArtifactToolError("duplicate_table_name", `duplicate table name: ${input.name}`);
    for (const table of this.worksheet._tableData) {
      const other = parseRange(table.range);
      const overlaps = bounds.start.row <= other.end.row && bounds.end.row >= other.start.row && bounds.start.column <= other.end.column && bounds.end.column >= other.start.column;
      if (overlaps) throw new ArtifactToolError("overlapping_table", `table range overlaps ${table.name}`);
    }
    const table = {
      name: input.name,
      range: bounds.reference,
      hasHeaders: input.hasHeaders ?? true,
      style: input.style ?? "TableStyleMedium2",
      showTotals: input.showTotals ?? false,
      showBandedColumns: input.showBandedColumns ?? false,
      showBandedRows: input.showBandedRows ?? true,
      showFilterButton: input.showFilterButton ?? true,
    };
    this.worksheet._tableData.push(table);
    return new WorksheetTable(this.worksheet, table);
  }

  getItem(name) {
    const table = this.worksheet._tableData.find((item) => item.name === name);
    if (!table) throw new ArtifactToolError("table_not_found", `table not found: ${name}`);
    return new WorksheetTable(this.worksheet, table);
  }

  get items() {
    return this.worksheet._tableData.map((table) => new WorksheetTable(this.worksheet, table));
  }
}

class WorksheetTable {
  constructor(worksheet, data) {
    this.worksheet = worksheet;
    this.data = data;
    this.rows = { add: (index, values) => this.addRows(index, values) };
  }

  get name() { return this.data.name; }
  set name(value) { this.data.name = value; }
  get range() { return this.data.range; }
  get style() { return this.data.style; }
  set style(value) { this.data.style = value; }
  get showHeaders() { return this.data.hasHeaders; }
  set showHeaders(value) { this.data.hasHeaders = Boolean(value); }
  get showTotals() { return this.data.showTotals; }
  set showTotals(value) { this.data.showTotals = Boolean(value); }
  get showBandedColumns() { return this.data.showBandedColumns; }
  set showBandedColumns(value) { this.data.showBandedColumns = Boolean(value); }
  get showBandedRows() { return this.data.showBandedRows; }
  set showBandedRows(value) { this.data.showBandedRows = Boolean(value); }
  get showFilterButton() { return this.data.showFilterButton; }
  set showFilterButton(value) { this.data.showFilterButton = Boolean(value); }

  getDataRows() {
    const bounds = parseRange(this.data.range);
    const startRow = bounds.start.row + (this.data.hasHeaders ? 1 : 0);
    const endRow = bounds.end.row - (this.data.showTotals ? 1 : 0);
    if (endRow < startRow) return this.worksheet.getRangeByIndexes(startRow, bounds.start.column, 1, bounds.columns);
    return this.worksheet.getRangeByIndexes(startRow, bounds.start.column, endRow - startRow + 1, bounds.columns);
  }

  getHeaderRowRange() {
    const bounds = parseRange(this.data.range);
    if (!this.data.hasHeaders) throw new ArtifactToolError("table_has_no_headers", `table ${this.name} has no header row`);
    return this.worksheet.getRangeByIndexes(bounds.start.row, bounds.start.column, 1, bounds.columns);
  }

  addRows(index, values) {
    validateMatrix(values);
    const bounds = parseRange(this.data.range);
    if (values.some((row) => row.length !== bounds.columns)) throw new ArtifactToolError("invalid_table_rows", "table rows must match the table column count");
    if (index !== null && index !== undefined && index !== this.getDataRows().bounds.rows) {
      throw new ArtifactToolError("unsupported_table_row_position", "rows can currently be appended to the end of a table");
    }
    const insertion = this.data.showTotals ? bounds.end.row : bounds.end.row + 1;
    this.worksheet.getRangeByIndexes(insertion, bounds.start.column, values.length, bounds.columns).values = values;
    this.data.range = rangeAddress(bounds.start.row, bounds.start.column, bounds.end.row + values.length, bounds.end.column);
    return this.getDataRows();
  }

  delete() {
    const index = this.worksheet._tableData.indexOf(this.data);
    if (index >= 0) this.worksheet._tableData.splice(index, 1);
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

class DataValidationCollection {
  constructor(worksheet) {
    this.worksheet = worksheet;
  }

  add(options) {
    if (!options || typeof options !== "object" || typeof options.range !== "string" || !options.rule) {
      throw new ArtifactToolError("invalid_data_validation", "data validation requires a target range and rule");
    }
    const range = parseRange(options.range).reference;
    const rule = structuredClone(options.rule);
    if (!new Set(["list", "whole", "decimal"]).has(rule.type)) {
      throw new ArtifactToolError("invalid_data_validation", `unsupported validation type: ${rule.type}`);
    }
    if (rule.type === "list" && !((Array.isArray(rule.values) && rule.values.length > 0) || (typeof rule.formula1 === "string" && rule.formula1.trim()))) {
      throw new ArtifactToolError("invalid_data_validation", "list validation requires values or a source formula");
    }
    if (rule.type !== "list") {
      if (!new Set(["between", "notBetween", "equal", "notEqual", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"]).has(rule.operator)) {
        throw new ArtifactToolError("invalid_data_validation", `unsupported validation operator: ${rule.operator}`);
      }
      if (!Number.isFinite(Number(rule.formula1)) || ((rule.operator === "between" || rule.operator === "notBetween") && !Number.isFinite(Number(rule.formula2)))) {
        throw new ArtifactToolError("invalid_data_validation", "numeric validation requires finite formula values");
      }
      if (rule.type === "whole" && (!Number.isInteger(Number(rule.formula1)) || ((rule.operator === "between" || rule.operator === "notBetween") && !Number.isInteger(Number(rule.formula2))))) {
        throw new ArtifactToolError("invalid_data_validation", "whole-number validation requires integer formula values");
      }
    }
    const validation = { range, rule };
    this.worksheet._dataValidationData.push(validation);
    return validation;
  }

  get items() {
    return this.worksheet._dataValidationData.map((item) => structuredClone(item));
  }
}

class ConditionalFormatCollection {
  constructor(worksheet, range = null) {
    this.worksheet = worksheet;
    this.range = range;
  }

  add(ruleType, options) {
    if (ruleType !== "cellIs" && ruleType !== "CellValue") {
      throw new ArtifactToolError("unsupported_conditional_format", `unsupported conditional format type: ${ruleType}`);
    }
    if (!this.range) throw new ArtifactToolError("invalid_conditional_format", "conditional format range is required");
    const allowedOperators = ["greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual", "equal", "notEqual", "between", "notBetween"];
    if (!options || !allowedOperators.includes(options.operator) || !Number.isFinite(Number(options.formula))) {
      throw new ArtifactToolError("invalid_conditional_format", "cell value rule requires a supported operator and numeric formula");
    }
    if (["between", "notBetween"].includes(options.operator) && !Number.isFinite(Number(options.formula2))) {
      throw new ArtifactToolError("invalid_conditional_format", "between rules require a second numeric formula");
    }
    const format = options.format ?? {};
    if (Object.keys(format).some((key) => !["fill", "font"].includes(key))) {
      throw new ArtifactToolError("invalid_conditional_format", "conditional formats support fill and font formatting only");
    }
    validateFormat({ ...format, range: this.range });
    const rule = { range: this.range, ruleType: "cellIs", operator: options.operator, formula: Number(options.formula), format: structuredClone(format) };
    if (options.formula2 !== undefined) rule.formula2 = Number(options.formula2);
    this.worksheet._conditionalFormatData.push(rule);
    return structuredClone(rule);
  }

  addCustom(expression, format) {
    throw new ArtifactToolError("unsupported_conditional_format", "custom expression conditional formats are not exposed yet");
  }

  deleteAll() {
    this.worksheet._conditionalFormatData = this.worksheet._conditionalFormatData.filter((item) => item.range !== this.range);
  }

  clear() { this.deleteAll(); }

  get items() {
    return this.worksheet._conditionalFormatData.filter((item) => !this.range || item.range === this.range).map((item) => structuredClone(item));
  }
}

class ImageCollection {
  constructor(worksheet) { this.worksheet = worksheet; }

  add(options) {
    if (typeof options?.dataUrl !== "string" || !/^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/i.test(options.dataUrl)) {
      throw new ArtifactToolError("invalid_image", "image data must be a base64 PNG or JPEG data URL");
    }
    const { row, col } = options.anchor?.from ?? {};
    const { widthPx, heightPx } = options.anchor?.extent ?? {};
    if (![row, col].every((value) => Number.isInteger(value) && value >= 0)
      || ![widthPx, heightPx].every((value) => Number.isFinite(value) && value > 0)) {
      throw new ArtifactToolError("invalid_image", "image anchor requires non-negative row/column and positive pixel dimensions");
    }
    if (Buffer.byteLength(options.dataUrl, "utf8") > 12 * 1024 * 1024) throw new ArtifactToolError("image_size_limit", "base64 image data exceeds 12 MiB");
    const image = structuredClone(options);
    this.worksheet._imageData.push(image);
    return image;
  }

  get items() { return this.worksheet._imageData.map((image) => structuredClone(image)); }
  get length() { return this.worksheet._imageData.length; }
}

class WorkbookNoteCollection {
  constructor(workbook) { this.workbook = workbook; }

  add(options) {
    const cell = options?.target?.cell;
    if (typeof cell?.sheetName !== "string" || typeof cell?.address !== "string" || typeof options?.body?.plainText !== "string") {
      throw new ArtifactToolError("invalid_note", "note requires a sheet, cell address, and plain text body");
    }
    parseRange(cell.address);
    if (cell.address.includes(":")) throw new ArtifactToolError("invalid_note", "a note target must be a single cell");
    const note = { cell: parseRange(cell.address).reference, text: options.body.plainText, author: options.authorId || "" };
    this.workbook.worksheets.getItem(cell.sheetName)._noteData.push(note);
    return structuredClone(note);
  }

  get items() {
    return this.workbook.worksheets.items.flatMap((sheet) => sheet._noteData.map((note) => ({ ...structuredClone(note), sheetName: sheet.name })));
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
    this._imageData = [...(input.images ?? [])];
    this._noteData = [...(input.notes ?? [])];
    this.imagesCollection = new ImageCollection(this);
    this._tableData = [...(input.tables ?? [])];
    this._chartData = [...(input.charts ?? [])];
    this._dataValidationData = [...(input.dataValidations ?? [])];
    this._conditionalFormatData = [...(input.conditionalFormats ?? [])];
    this.tablesCollection = new TableCollection(this);
    this.chartsCollection = new ChartCollection(this);
    this.dataValidationsCollection = new DataValidationCollection(this);
  }

  getRange(reference) {
    return new Range(this, parseRange(reference));
  }

  getRangeByIndexes(startRow, startColumn, rowCount, columnCount) {
    for (const [name, value] of Object.entries({ startRow, startColumn, rowCount, columnCount })) {
      if (!Number.isInteger(value) || value < 0 || ((name === "rowCount" || name === "columnCount") && value === 0)) {
        throw new ArtifactToolError("invalid_range", `${name} must be a non-negative integer${name.endsWith("Count") ? " greater than zero" : ""}`);
      }
    }
    return this.getRange(rangeAddress(startRow, startColumn, startRow + rowCount - 1, startColumn + columnCount - 1));
  }

  getCell(row, column) {
    return this.getRangeByIndexes(row, column, 1, 1);
  }

  getUsedRange(valuesOnly = false) {
    let lastRow = -1;
    let lastColumn = -1;
    for (let row = 0; row < this.rows.length; row += 1) {
      for (let column = 0; column < (this.rows[row]?.length ?? 0); column += 1) {
        if (this.rows[row][column] !== null && this.rows[row][column] !== undefined && this.rows[row][column] !== "") {
          lastRow = Math.max(lastRow, row);
          lastColumn = Math.max(lastColumn, column);
        }
      }
    }
    if (!valuesOnly) {
      for (let row = 0; row < this.formulaRows.length; row += 1) {
        for (let column = 0; column < (this.formulaRows[row]?.length ?? 0); column += 1) {
          if (this.formulaRows[row][column]) {
            lastRow = Math.max(lastRow, row);
            lastColumn = Math.max(lastColumn, column);
          }
        }
      }
    }
    if (lastRow < 0 || lastColumn < 0) return this.getRange("A1");
    return this.getRange(rangeAddress(0, 0, lastRow, lastColumn));
  }

  get tables() {
    return this.tablesCollection;
  }

  get images() { return this.imagesCollection; }

  get charts() {
    return this.chartsCollection;
  }

  get dataValidations() {
    return this.dataValidationsCollection;
  }

  get conditionalFormats() {
    return new ConditionalFormatCollection(this);
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

  get dataValidation() {
    return this.worksheet._dataValidationData.find((item) => item.range === this.bounds.reference) ?? null;
  }

  get conditionalFormats() {
    return new ConditionalFormatCollection(this.worksheet, this.bounds.reference);
  }

  set dataValidation(value) {
    this.worksheet.dataValidations.add({ range: this.bounds.reference, ...value });
  }

  set formulas(formulas) {
    validateFormulaMatrix(formulas);
    for (let row = this.bounds.start.row; row <= this.bounds.end.row; row += 1) {
      if (!this.worksheet.rows[row]) this.worksheet.rows[row] = [];
      if (!this.worksheet.formulaRows[row]) this.worksheet.formulaRows[row] = [];
      for (let column = this.bounds.start.column; column <= this.bounds.end.column; column += 1) {
        const formula = formulas[row - this.bounds.start.row]?.[column - this.bounds.start.column] ?? null;
        this.worksheet.formulaRows[row][column] = formula;
        this.worksheet.rows[row][column] = null;
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

  offset(rowOffset, columnOffset) {
    if (!Number.isInteger(rowOffset) || !Number.isInteger(columnOffset)) {
      throw new ArtifactToolError("invalid_range", "range offsets must be integers");
    }
    const startRow = this.bounds.start.row + rowOffset;
    const startColumn = this.bounds.start.column + columnOffset;
    if (startRow < 0 || startColumn < 0) throw new ArtifactToolError("invalid_range", "range offset is before the first cell");
    return this.worksheet.getRangeByIndexes(startRow, startColumn, this.bounds.rows, this.bounds.columns);
  }

  resize(rowCount, columnCount) {
    return this.worksheet.getRangeByIndexes(this.bounds.start.row, this.bounds.start.column, rowCount, columnCount);
  }

  getRow(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.bounds.rows) throw new ArtifactToolError("invalid_range", "row index is outside the range");
    return this.worksheet.getRangeByIndexes(this.bounds.start.row + index, this.bounds.start.column, 1, this.bounds.columns);
  }

  getColumn(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.bounds.columns) throw new ArtifactToolError("invalid_range", "column index is outside the range");
    return this.worksheet.getRangeByIndexes(this.bounds.start.row, this.bounds.start.column + index, this.bounds.rows, 1);
  }

  getCurrentRegion() {
    let { start: { row: top, column: left }, end: { row: bottom, column: right } } = this.bounds;
    const containsValue = (row, column) => {
      const value = this.worksheet.rows[row]?.[column];
      return (value !== null && value !== undefined && value !== "") || Boolean(this.worksheet.formulaRows[row]?.[column]);
    };
    let changed = true;
    while (changed) {
      changed = false;
      if (top > 0 && Array.from({ length: right - left + 1 }, (_, index) => containsValue(top - 1, left + index)).some(Boolean)) {
        top -= 1;
        changed = true;
      }
      if (Array.from({ length: right - left + 1 }, (_, index) => containsValue(bottom + 1, left + index)).some(Boolean)) {
        bottom += 1;
        changed = true;
      }
      if (left > 0 && Array.from({ length: bottom - top + 1 }, (_, index) => containsValue(top + index, left - 1)).some(Boolean)) {
        left -= 1;
        changed = true;
      }
      if (Array.from({ length: bottom - top + 1 }, (_, index) => containsValue(top + index, right + 1)).some(Boolean)) {
        right += 1;
        changed = true;
      }
    }
    return this.worksheet.getRangeByIndexes(top, left, bottom - top + 1, right - left + 1);
  }

  clear(options = {}) {
    const applyTo = options.applyTo ?? "all";
    if (!["contents", "formats", "all"].includes(applyTo)) throw new ArtifactToolError("invalid_clear_options", `unsupported clear mode: ${applyTo}`);
    if (applyTo === "contents" || applyTo === "all") {
      for (let row = this.bounds.start.row; row <= this.bounds.end.row; row += 1) {
        for (let column = this.bounds.start.column; column <= this.bounds.end.column; column += 1) {
          if (this.worksheet.rows[row]) this.worksheet.rows[row][column] = null;
          if (this.worksheet.formulaRows[row]) this.worksheet.formulaRows[row][column] = null;
        }
      }
    }
    if (applyTo === "formats" || applyTo === "all") this.worksheet.formats.delete(this.bounds.reference);
    return this;
  }

  copyFrom(source, mode = "all") {
    if (!(source instanceof Range) || source.worksheet.workbook !== this.worksheet.workbook) throw new ArtifactToolError("invalid_copy_source", "copy source must be a range in the same workbook");
    if (!["values", "formulas", "all"].includes(mode)) throw new ArtifactToolError("invalid_copy_mode", `unsupported copy mode: ${mode}`);
    const rows = source.bounds.rows;
    const columns = source.bounds.columns;
    const sameShape = rows === this.bounds.rows && columns === this.bounds.columns;
    const scalarBroadcast = rows === 1 && columns === 1;
    const rowBroadcast = rows === 1 && columns === this.bounds.columns;
    const columnBroadcast = columns === 1 && rows === this.bounds.rows;
    if (!sameShape && !scalarBroadcast && !rowBroadcast && !columnBroadcast) {
      throw new ArtifactToolError("invalid_copy_shape", "copy ranges must have matching dimensions or a single-cell source");
    }
    const sourceValues = source.values;
    const sourceFormulas = source.formulas;
    for (let row = 0; row < this.bounds.rows; row += 1) {
      for (let column = 0; column < this.bounds.columns; column += 1) {
        const sourceRow = rows === 1 ? 0 : row;
        const sourceColumn = columns === 1 ? 0 : column;
        const targetRow = this.bounds.start.row + row;
        const targetColumn = this.bounds.start.column + column;
        if (!this.worksheet.rows[targetRow]) this.worksheet.rows[targetRow] = [];
        if (!this.worksheet.formulaRows[targetRow]) this.worksheet.formulaRows[targetRow] = [];
        if (mode === "values" || mode === "all") this.worksheet.rows[targetRow][targetColumn] = cloneValue(sourceValues[sourceRow][sourceColumn]);
        if (mode === "formulas" || mode === "all") {
          const formula = sourceFormulas[sourceRow][sourceColumn];
          this.worksheet.formulaRows[targetRow][targetColumn] = formula === null
            ? null
            : translateFormula(formula, targetRow - (source.bounds.start.row + sourceRow), targetColumn - (source.bounds.start.column + sourceColumn));
        }
        if (mode === "values") this.worksheet.formulaRows[targetRow][targetColumn] = null;
        if (mode === "formulas") this.worksheet.rows[targetRow][targetColumn] = null;
      }
    }
    if (mode === "all" && source.worksheet.formats.has(source.bounds.reference)) {
      this.worksheet.formats.set(this.bounds.reference, { ...structuredClone(source.worksheet.formats.get(source.bounds.reference)), range: this.bounds.reference });
    }
    return this;
  }

  copyTo(destination, mode = "all") {
    if (!(destination instanceof Range)) throw new ArtifactToolError("invalid_copy_destination", "copy destination must be a range");
    return destination.copyFrom(this, mode);
  }

  fillDown() {
    if (this.bounds.rows < 2) return this;
    return this.worksheet.getRangeByIndexes(this.bounds.start.row + 1, this.bounds.start.column, this.bounds.rows - 1, this.bounds.columns)
      .copyFrom(this.worksheet.getRangeByIndexes(this.bounds.start.row, this.bounds.start.column, 1, this.bounds.columns), "all");
  }

  fillRight() {
    if (this.bounds.columns < 2) return this;
    return this.worksheet.getRangeByIndexes(this.bounds.start.row, this.bounds.start.column + 1, this.bounds.rows, this.bounds.columns - 1)
      .copyFrom(this.worksheet.getRangeByIndexes(this.bounds.start.row, this.bounds.start.column, this.bounds.rows, 1), "all");
  }
}

function rangeAddress(startRow, startColumn, endRow, endColumn) {
  const start = `${columnLabel(startColumn)}${startRow + 1}`;
  const end = `${columnLabel(endColumn)}${endRow + 1}`;
  return start === end ? start : `${start}:${end}`;
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
    style_index: format.styleIndex,
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
      style: table.style,
      show_totals: table.showTotals,
      show_banded_columns: table.showBandedColumns,
      show_banded_rows: table.showBandedRows,
      show_filter_button: table.showFilterButton,
    })),
    charts: [...sheet._chartData],
    images: sheet._imageData,
    notes: sheet._noteData,
    data_validations: sheet._dataValidationData,
    conditional_formats: sheet._conditionalFormatData,
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

  static fromCSV(text, options = {}) {
    const workbook = new Workbook();
    const sheet = workbook.worksheets.add(options.sheetName ?? "Sheet1");
    const rows = parseCsv(text, options);
    if (rows.length) sheet.getRangeByIndexes(0, 0, rows.length, rows[0].length).values = rows;
    return workbook;
  }

  static capabilities() {
    return spreadsheetCapabilities();
  }

  help(query, options = {}) {
    try {
      return searchSpreadsheetCapabilities(query, options);
    } catch (error) {
      throw new ArtifactToolError("invalid_help_query", error.message);
    }
  }

  get notes() {
    if (!this.notesCollection) this.notesCollection = new WorkbookNoteCollection(this);
    return this.notesCollection;
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
          getCell: (reference, sheetName = sheet.name) => {
            const bounds = parseRange(reference);
            return evaluateCell(this.worksheets.getItem(sheetName), bounds.start.row, bounds.start.column);
          },
          getRange: (startReference, endReference, sheetName = sheet.name) => {
            const bounds = parseRange(`${startReference}:${endReference}`);
            const referenceSheet = this.worksheets.getItem(sheetName);
            const values = [];
            for (let currentRow = bounds.start.row; currentRow <= bounds.end.row; currentRow += 1) {
              const rowValues = [];
              for (let currentColumn = bounds.start.column; currentColumn <= bounds.end.column; currentColumn += 1) {
                rowValues.push(evaluateCell(referenceSheet, currentRow, currentColumn));
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
    if (options.kind === "range") {
      if (typeof options.sheetName !== "string" || !options.sheetName || typeof options.range !== "string") {
        throw new ArtifactToolError("invalid_inspection", "range inspection requires sheetName and range");
      }
      const sheet = this.worksheets.getItem(options.sheetName);
      const bounds = parseRange(options.range);
      if (bounds.rows * bounds.columns > 100_000) throw new ArtifactToolError("inspection_limit", "range inspection is limited to 100,000 cells");
      const range = sheet.getRange(bounds.reference);
      return { ok: true, kind: "range", sheetName: sheet.name, range: bounds.reference, values: range.values, formulas: range.formulas };
    }
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
        formats: sheet.formats.size,
        images: sheet.images.length,
      }));
    return { ok: true, valid: true, sheets };
  }

  trace(reference, options = {}) {
    if (typeof reference !== "string" || !reference.trim()) throw new ArtifactToolError("invalid_trace_reference", "trace requires a cell reference");
    const maxNodes = options.maxNodes ?? 1000;
    if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 10_000) throw new ArtifactToolError("invalid_trace_options", "maxNodes must be from 1 through 10000");
    const split = (value, defaultSheet) => {
      const separator = value.lastIndexOf("!");
      const sheetName = separator < 0 ? defaultSheet : value.slice(0, separator).replace(/^'|'$/g, "").replaceAll("''", "'");
      const address = separator < 0 ? value : value.slice(separator + 1);
      if (!sheetName) throw new ArtifactToolError("invalid_trace_reference", "a sheet name is required when the workbook has no active worksheet");
      return { sheet: this.worksheets.getItem(sheetName), address };
    };
    const rootSheet = this.worksheets.getActiveWorksheet();
    const root = split(reference.trim(), rootSheet.name);
    const rootBounds = parseRange(root.address);
    if (rootBounds.rows !== 1 || rootBounds.columns !== 1) throw new ArtifactToolError("invalid_trace_reference", "trace target must be a single cell");
    let count = 0;
    const visit = (sheet, address, active = new Set()) => {
      const cell = `${sheet.name}!${address.replaceAll("$", "")}`;
      count += 1;
      if (count > maxNodes) throw new ArtifactToolError("trace_limit", `formula trace exceeds ${maxNodes} cells`);
      if (active.has(cell)) return { cell, cycle: true, precedents: [] };
      const formula = sheet.getRange(address).formulas[0][0];
      const node = { cell, value: sheet.getRange(address).values[0][0], formula, precedents: [] };
      if (!formula) return node;
      const nextActive = new Set(active).add(cell);
      const expression = formula.replace(/"(?:[^"]|"")*"/g, "");
      const references = new Map();
      const pattern = /((?:'[^']+'|[A-Za-z_][A-Za-z0-9_.]*)!)?(\$?[A-Z]{1,3}\$?[1-9][0-9]*)(?::(\$?[A-Z]{1,3}\$?[1-9][0-9]*))?/gi;
      for (const match of expression.matchAll(pattern)) {
        const referenceSheet = split(`${match[1] ?? ""}${match[2]}`, sheet.name).sheet;
        const bounds = parseRange(match[3] ? `${match[2]}:${match[3]}` : match[2]);
        if (bounds.rows * bounds.columns > 10_000) throw new ArtifactToolError("trace_limit", "a single formula dependency range exceeds 10,000 cells");
        for (let row = bounds.start.row; row <= bounds.end.row; row += 1) {
          for (let column = bounds.start.column; column <= bounds.end.column; column += 1) {
            const cellAddress = rangeAddress(row, column, row, column);
            references.set(`${referenceSheet.name}!${cellAddress}`, { sheet: referenceSheet, address: cellAddress });
          }
        }
      }
      node.precedents = [...references.values()].map(({ sheet: precedentSheet, address: precedentAddress }) => visit(precedentSheet, precedentAddress, nextActive));
      return node;
    };
    return visit(root.sheet, root.address);
  }

  async render(options = {}) {
    const { renderWorkbook } = await import("./workbook-render.mjs");
    return renderWorkbook(this, options);
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
