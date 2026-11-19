# Edit an existing spreadsheet

Treat the workbook as the reference for its structure, formulas, formatting, terminology, and navigation. Follow its conventions unless the user requests a change. The user request takes precedence over defaults in this guide.
Follow [template workflow](../references/template_workflow.md) when using a supplied template or reference.

## Before editing

- Import the workbook with `SpreadsheetFile.importXlsx` and use `Workbook.inspect()` for sheet names, dimensions, and object counts. Read values and formulas with `getRange`; inspect table, chart, and exact-range format details only where the documented API exposes them.
- Read the values and formulas in the requested area and the directly affected dependencies. If the user requests a visual change, use the application preview when available.
- The importer does not report every unsupported native feature. It stores original cell styles as style indexes rather than complete style definitions, imports charts without their position or series data, and imports images as metadata without image contents. An exported round-trip can lose styles or images, and may fail when an imported chart has no series. If those features matter, do not round-trip the workbook through Ruxex; use a workflow that preserves them or ask the user for a simpler copy.
- Recalculation mutates cached formula result values in memory. If an imported workbook contains unsupported formulas, recalculation may clear its cached formula results. These cached formula results can be important when the output is reopened. Do not recalculate and re-export if they must be preserved; use a preserving workflow or verify the exported copy in the target spreadsheet application.
- Confirm that the values, formulas, styles, charts, and other content needed for the edit are visible through the supported API. Do not infer that a feature is absent merely because the importer does not report it.

## Preserve scope

- Do not add, remove, rename, reorder, or split sheets unless requested or required by the requested change.
- Change only requested cells and directly affected formulas, charts, tables, or formats. Preserve unrelated sheets and workbook content.
- Preserve valid formula conventions and references. Look at nearby examples before adding formulas.
- Extend relevant existing ranges, tables, and chart source ranges when the user's change requires it and the Ruxex API supports it.
- Do not replace an established format with a default style. Keep existing annotations and source records intact when supported.
- Do not fix unrelated errors or change unrelated content. Report unrelated issues that could affect the requested result.
- Keep the original file unchanged unless the user requests overwriting. Save edits to a new output path by default.

## Verify the edit

- Follow [verification workflow](verification.md). Recalculate only when the workbook's required formulas are supported or when the cached-result effects are understood and acceptable.
- Inspect the affected sheet summary and read the requested cells, values, and formulas from the workbook through supported APIs.
- Spot-check the changed result against its source and trace dependencies that the edit could affect.
- Export and validate the saved file only when the workbook's required content can survive the Ruxex import/export boundary. Review it in the Ruxex application preview when available. Validation does not prove formula correctness or target-application behavior.
