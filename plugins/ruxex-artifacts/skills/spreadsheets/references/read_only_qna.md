# Read-only spreadsheet questions

Answer questions from workbook evidence without making edits or exporting a file.

- Locate the requested result by its row and column labels, sheet, and period. Read its value and formula when the API exposes them.
- Trace the result to relevant assumptions and source cells. Do not stop at an intermediate total when the question asks what drives a final result.
- Preserve units, period definitions, rounding, and comparison basis when explaining a displayed value.
- Do not recalculate the imported workbook for a read-only question by default. Recalculation mutates cached formula result values in memory and may clear results for unsupported formulas. If calculation is essential, import a disposable copy, recalculate only that copy, and discard it without exporting.
- Report missing inputs, unsupported formulas, ambiguous definitions, and failed reconciliations instead of repairing them.
- Use only evidence relevant to the question. Avoid exposing restricted raw values or identifiers in an architecture-only review.
- State when the workbook API cannot inspect a value, formula, dependency, or native feature. Do not infer behavior from a sheet summary or successful XLSX validation.
