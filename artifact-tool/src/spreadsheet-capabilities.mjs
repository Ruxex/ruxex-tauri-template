const CAPABILITIES = [
  { id: "xlsx.create", status: "supported", description: "Create local XLSX workbooks." },
  { id: "xlsx.import", status: "partial", description: "Import local XLSX cell values, formula text, and supported object metadata.", limitation: "Import does not preserve every OOXML package part for a later edit/export round trip." },
  { id: "xlsx.export", status: "partial", description: "Export a workbook as XLSX with the supported local model.", limitation: "Unsupported OOXML package parts from imported files are not preserved." },
  { id: "csv.import", status: "supported", description: "Import CSV or TSV source data into a local workbook." },
  { id: "xls.import", status: "partial", description: "Read legacy XLS values and sheet dimensions through bundled Calamine support.", limitation: "Legacy XLS formulas, formatting, and embedded objects are not exposed; export remains XLSX-only." },
  { id: "range.operations", status: "partial", description: "Read, write, select, offset, resize, copy, fill, and clear cell ranges.", limitation: "Row/column insertion, deletion, sort, and filter operations are not exposed." },
  { id: "formulas.evaluate", status: "partial", description: "Evaluate common math, text, logical, conditional aggregation, lookup, range, and cross-sheet formulas; unsupported formulas are reported and cached values are retained.", limitation: "The evaluator does not yet cover the full Excel formula catalog, named ranges, or structured references." },
  { id: "formatting", status: "partial", description: "Apply basic font, fill, alignment, number format, and column width formats.", limitation: "Borders, row heights, autofit, freeze panes, and gridline/tab layout are not exposed." },
  { id: "data-validation", status: "partial", description: "Write inline list, whole-number, and decimal input validation rules.", limitation: "Validation rules are not imported and prompt/error messages are not exposed." },
  { id: "conditional-formatting", status: "partial", description: "Add numeric cell-value rules with a fill or font differential format.", limitation: "Only numeric cell-value rules are authored; other rule families and import inspection are not exposed." },
  { id: "tables.create", status: "partial", description: "Create, inspect, append rows, and delete basic Excel tables.", limitation: "Only the default table style is serialized; structured references and totals formulas are not recalculated." },
  { id: "pivot-tables", status: "unsupported", description: "Create and inspect PivotTables." },
  { id: "chart.create", status: "partial", description: "Create basic column, bar, line, pie, and doughnut charts." },
  { id: "chart.inspect", status: "partial", description: "Inspect supported chart type, position, and series bindings." },
  { id: "chart.edit", status: "partial", description: "Create new charts; editing imported chart properties is limited." },
  { id: "images.create", status: "unsupported", description: "Embed and inspect worksheet images." },
  { id: "shapes.create", status: "unsupported", description: "Create worksheet drawing shapes." },
  { id: "comments.create", status: "unsupported", description: "Create threaded workbook comments." },
  { id: "notes.create", status: "unsupported", description: "Create cell notes." },
  { id: "sparklines.create", status: "unsupported", description: "Create worksheet sparklines." },
  { id: "data-tables.create", status: "unsupported", description: "Create native two-variable sensitivity tables." },
  { id: "workbook.inspect", status: "partial", description: "Inspect sheet dimensions and bounded range values/formulas; trace referenced cells.", limitation: "Object, cell error, PivotTable, and drawing property inspection remains limited." },
  { id: "workbook.trace", status: "partial", description: "Trace formula dependencies recursively with bounded same-sheet and cross-sheet reference expansion.", limitation: "The trace shows formula references; named ranges, structured references, and external links are not resolved." },
  { id: "workbook.render", status: "partial", description: "Render a selected worksheet as a local PNG using bundled LibreOffice and Poppler.", limitation: "The first printed page is rendered; print layout options and full-sheet auto-cropping are not exposed." },
  { id: "workbook.help", status: "supported", description: "Search documented local workbook capabilities." },
  { id: "google-sheets", status: "excluded", description: "Google Sheets integration is outside the local workbook scope." },
  { id: "openai-backend", status: "excluded", description: "OpenAI-hosted and backend-only operations are outside the local workbook scope." },
];

export function spreadsheetCapabilities() {
  return CAPABILITIES.map((capability) => ({ ...capability }));
}

export function searchSpreadsheetCapabilities(query, options = {}) {
  if (typeof query !== "string" || !query.trim()) {
    throw new TypeError("help query must be a non-empty string");
  }
  const maxResults = options.maxResults ?? 20;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 100) {
    throw new TypeError("maxResults must be an integer from 1 through 100");
  }

  const needle = query.trim().toLocaleLowerCase("en-US");
  const matching = CAPABILITIES.filter((capability) =>
    `${capability.id} ${capability.description}`.toLocaleLowerCase("en-US").includes(needle));
  return {
    results: matching.slice(0, maxResults).map((capability) => ({ ...capability })),
    truncated: matching.length > maxResults,
  };
}
