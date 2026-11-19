# Spreadsheet verification workflow

Use verification depth that matches the scope, complexity, and risk. Report unrelated existing defects without repairing them. Keep test data and temporary input changes out of the delivered file.

## Inspect formulas and values

- After the final authoring changes, call `workbook.recalculate()` once when recalculation is safe for this workbook. Review the returned `formulas`, `evaluated`, and `unsupported` counts. A successful call can still have unsupported formulas.
- Read values and formulas in key output and input ranges through `getRange(...).values` and `getRange(...).formulas`. `Workbook.inspect()` only returns a sheet summary; it is not a cell-level formula or error scan.
- Trace important outputs to their input values, assumptions, calculation steps, units, periods, and denominators. Check that formulas are consistent across comparable periods and that a check sheet does not feed the business result.
- Inspect formulas at the first, middle, and last rows or periods of copied ranges. For a newly added record or period, verify the next period and next row are included in calculations, checks, and chart source ranges.
- Spot-check important totals and rates against the source or an independent calculation. Complete a source reconciliation using the correct aggregation for flows, stock balances, rates, and weighted averages. Apply tolerances appropriate to the unit and display precision; compare identifiers, counts, and categories exactly.
- Review formula text and computed values for error strings, missing dependencies, and blank results. Unsupported formulas can leave blank results; a blank must not silently become a valid zero or pass status.

## Check input behavior

When the formula evaluator supports the calculations, use a disposable in-memory workbook or restore every temporary value before export. Check the conditions relevant to the task:

- blank versus zero, especially for optional overrides and measured values;
- missing keys and duplicate keys;
- date and period cutoffs, including timestamps at boundaries;
- rounding, one-time adjustments, and overrides;
- the scenario selector and a later-period driver;
- dependent totals, status values, and supported chart data after an input changes.

For a new period, verify the formulas and ranges at that period rather than inferring correctness from the previous month. Confirm actuals remain unchanged when a forecast selector changes. For workflow outputs, leave one prerequisite incomplete and confirm the remaining action stays visible.

Do not run these recalculation checks on an imported workbook when doing so could clear cached formula values for unsupported formulas. Do not export a temporary test version.

## Check charts and visual output

- Check chart series names, categories, value ranges, category/series alignment, and point counts before export. Keep missing values blank and preserve relevant baselines.
- Review the chart and affected ranges in the Ruxex application preview when available. `Workbook.render()` is not supported in this runtime. If no visual preview is available, state that visual review could not be performed.
- Check titles, units, number formats, clipping, wrapping, and chart labels at a useful zoom. Fix issues within the authorized scope and supported format controls.

## Validate the saved file

- Export only if the workbook's required content can safely pass through the Ruxex import/export boundary.
- Run `"/absolute/path/to/skill/ruxex-artifacts" xlsx validate --input /absolute/path/report.xlsx --json` on the saved file.
- Treat validation as a structural file check. It does not prove that formulas calculate correctly, charts render correctly, styles or images were preserved, or the target spreadsheet application behaves as intended.
- Inspect the saved file or open it in the intended application when an affected feature or export concern requires that check. Report any engine or visual checks that could not be performed.

## Ruxex round-trip exclusions

The current importer/exporter does not preserve every native XLSX feature. It imports cell styles as style indexes without enough information to rebuild their full definitions, imports charts without their series and position, and records image metadata without the image content. Recalculating an imported workbook also clears cached values for unsupported formulas. If any of these features or cached results matter, do not re-export the workbook through Ruxex; use a preserving workflow or ask for a simpler copy.
