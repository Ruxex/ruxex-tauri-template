# Workbook structure, formulas, and calculation flow

Keep the workbook simple, especially for a focused question or workflow. A focused workbook needs one main answer supported by relevant inputs and calculations. It may use one sheet or several; use a separate sheet only when it serves a distinct source, calculation, reader, refresh boundary, or workflow.

## Calculation flow

Use this logical flow:

**Sources and assumptions → build calculations → outputs**

These roles can share a sheet. The flow describes dependencies, not mandatory tab order.

- **Sources** contain original data with its source meaning intact. Keep cleaning, mapping, and derived fields separate from the original values, with clear labels and provenance.
- **Assumptions** contain editable drivers. Keep one authoritative selector when a scenario is required. Label each case and show the active selection clearly.
- **Builds** bring relevant source inputs and active assumptions together. Show meaningful steps, subtotals, and totals in chronological periods. Avoid repeating the assumptions grid or hiding the calculation in one dense formula.
- **Outputs** present the main answer first and link to finished build results. Do not repeat business calculations in the summary.
- **Checks** can review source data and calculations, but they should not drive business assumptions, calculations, or outputs.
- Use a cover only for a complex workbook that needs a separate front page. Add a ReadMe only when sources, joins, scoring, or refresh steps need more explanation than nearby notes.

For a focused task, prefer one output sheet and a source sheet only when the original data needs to remain separate. Preserve a supplied template and existing design during narrow edits.

## Tabs and layout

- Use concise tab names that describe their contents. Preserve established names during unrelated edits.
- For a multi-sheet workbook, use Outputs → Assumptions → Builds → Sources/Internal as the default left-to-right order. Keep assumptions easy to reach near the main output. Preserve intentional template order.
- On a single sheet, put the main answer before supporting detail when that fits the task. Keep raw source tables intact and clearly labeled.
- Do not add a sheet for every role or a separate tab for a small block that fits naturally on an existing sheet.
- Make each row and column purpose clear. Keep periods aligned and chronological, and preserve the source's time grain.
- Use concise names such as `Summary`, `Revenue build`, or `Source data`. For recurring or complex shared workflows, use a cover only when it adds orientation; use a ReadMe only when the source, joins, or refresh method cannot be explained near the data.

For detailed formula choices, dates, missing inputs, lookups, overrides, and supported calculations, also read [formula guidance](formula_guidance.md).

## Formula construction

- Use clear references to source and assumption cells. Show calculation steps that help a reader follow the result.
- Check formula references in representative cells at the beginning, middle, and end of copied ranges. When Ruxex recalculation is required, use only plain A1 references supported by its evaluator. `$A$1`-style anchored references and cross-sheet references are not currently evaluated; if they are needed for the target spreadsheet application, verify them there and report that Ruxex did not calculate them.
- Use blank cells for missing inputs when blank has a distinct meaning from zero. Do not make missing values appear as successful zero results.
- Checks and audits are terminal review outputs. No assumption, build, summary, displayed status, or output gate may depend on a check result, directly or through another formula. Keep diagnostics separate from the logic they review.
- Avoid circular references unless the user's requirements and a supported calculation engine explicitly require them. Ruxex's evaluator does not support circular references.
- Do not claim a formula is correct because it was written or exported. Check the computed result against an independent calculation or source where possible.

## Scenario selection

For scenarios, maintain one editable case selector. Group each driver's active selection with its labeled case inputs, and link the build to the active value for each period. A selector should change the assumptions used by the build and its outputs. Keep historical actuals separate from forecast assumptions.

When simultaneous case comparisons are requested, each case must have correctly evaluated results. If the supported Ruxex workflow cannot calculate the requested comparison, explain the limit and agree on a calculation or refresh method. Do not show duplicate copies of the active result as if they represented different cases.

## Formula and runtime limits

The Ruxex evaluator supports a limited subset, including arithmetic, comparisons, plain A1 cell/range references on the current sheet, `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, and `IF`. It does not currently evaluate `$A$1`-style references, cross-sheet references, names, dynamic arrays, spreadsheet data tables, iterative calculation, or other functions. Check the current implementation and capabilities before relying on a formula. When Ruxex recalculation is required, keep the formula and its inputs on the same sheet; cross-sheet calculation flow is a target-application-only design and is not verified by Ruxex.

`Workbook.recalculate()` reports formulas evaluated and unsupported. A successful recalculation call does not mean every formula produced a result. Treat nonzero unsupported counts as a review requirement. Verify important results in an available target application when Ruxex cannot evaluate them.

Unsupported formulas can leave their computed values blank. Do not interpret a blank result as zero or as a successful check. Read both formula text and calculated values in the affected ranges when supported.
