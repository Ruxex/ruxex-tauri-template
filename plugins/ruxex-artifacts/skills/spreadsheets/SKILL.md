---
name: spreadsheets
description: Use when creating, editing, analyzing, or answering questions about local spreadsheet files with the bundled Ruxex APIs.
---

# Spreadsheets

Use the bundled `ruxex-artifacts` command and the Ruxex-owned JavaScript API for local `.xlsx` work. The skill supports creating and importing `.xlsx` files. Treat other spreadsheet formats as source material only when the active runtime can read them. Do not install packages or depend on a system office application.

## Choose the workflow

- For a new workbook, follow [create workflow](workflows/create_workflows.md).
- For an existing workbook or follow-up edit, follow [edit workflow](workflows/edit_workflows.md).
- For a question or audit without requested edits, follow [read-only Q&A](references/read_only_qna.md). Do not modify or export the workbook.
- For structure, formula flow, and workbook complexity, read [workbook design](references/workbook_design.md).
- For formula design and business rules, read [formula guidance](references/formula_guidance.md).
- For templates and references, read [template workflow](references/template_workflow.md).
- For validation depth, read [verification workflow](workflows/verification.md).
- For formatting, read [style guidance](style_guidelines.md).
- For charts, read [chart guidance](features/charts.md).
- Apply [domain guidance](#domain-guidance) only when it matches the task.

## Ruxex authoring workflow

1. Find the sibling `ruxex-artifacts` executable from the absolute path to this `SKILL.md`. Invoke the executable by its full path; do not rely on `PATH`.
2. Check available operations with `"/absolute/path/to/skill/ruxex-artifacts" capabilities --json`.
3. Write one `.mjs` builder that imports `@ruxex/artifact-tool`. Use only documented Ruxex APIs and the capabilities reported by the executable. Do not inspect package internals or prototypes to discover APIs.
4. For a new file, create a `Workbook`. For an existing `.xlsx`, use `SpreadsheetFile.importXlsx`, inspect the sheet summary, and read relevant ranges before editing.
5. Populate or update values, formulas, formats, tables, and supported charts. Keep changes within the user's requested scope.
6. Recalculate only when safe for the workbook, then inspect it following [verification workflow](workflows/verification.md). For imported workbooks, follow [edit workflow](workflows/edit_workflows.md) before recalculating or exporting. Review formula and unsupported counts instead of assuming every formula was evaluated.
7. Run the builder with `"/absolute/path/to/skill/ruxex-artifacts" run /absolute/path/build.mjs`.
8. Run `"/absolute/path/to/skill/ruxex-artifacts" xlsx validate --input /absolute/path/report.xlsx --json` on the saved file.
9. Report the absolute output path, validation result, and any material limitation or unsupported calculation.

Example:

```js
import { SpreadsheetFile, Workbook } from "@ruxex/artifact-tool";

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Summary");
sheet.getRange("A1:B3").values = [["Area", "Status"], ["Spreadsheets", "Ready"], ["Total", 1]];
sheet.getRange("A1:B1").format = { font: { bold: true } };

const calculation = workbook.recalculate();
if (!calculation.ok || calculation.unsupported > 0) {
  throw new Error(`Formula review required: ${JSON.stringify(calculation)}`);
}
const inspection = await workbook.inspect();
if (!inspection.ok) throw new Error("Workbook inspection failed");

const output = SpreadsheetFile.exportXlsx(workbook);
await output.save("/absolute/path/report.xlsx");
```

`Workbook.inspect()` currently returns sheet-level dimensions and object counts. It does not inspect cell values or formulas. `Workbook.render()` is not available in this runtime. Use the Ruxex application preview when it is available, and report when visual inspection could not be performed. `xlsx validate` checks the saved file's supported structure; it does not prove formula correctness or behavior in a native spreadsheet application.

## Workbook design and writing

Apply the guidance in [workbook design](references/workbook_design.md), [formula guidance](references/formula_guidance.md), and [style guidance](style_guidelines.md). User instructions and supplied templates take precedence over defaults. Keep labels specific, factual, concise, and meaningful to the intended reader. Preserve important units, periods, populations, comparison bases, and uncertainty.

## Domain guidance

Before authoring, identify the task/function, role, audience, and industry separately. A role or industry label alone does not determine workbook structure. Use only relevant guidance:

- Finance, budgeting, forecasting, or valuation: [financial models](domain_guidance/financial_models.md).
- Healthcare records or operations: [healthcare](domain_guidance/healthcare.md).
- Campaigns and advertising: [marketing and advertising](domain_guidance/marketing_advertising.md).
- Research observations and analysis: [scientific research](domain_guidance/scientific_research.md).

Financial planning and valuation use Finance guidance in any industry. Add industry guidance only when it changes definitions, units, source handling, or workflow.

## Runtime limits

- The bundled formula evaluator supports a limited formula subset. Unsupported formulas and circular references may remain unevaluated. Check `Workbook.recalculate()` results and independently verify consequential calculations where possible.
- `Workbook.inspect()` provides sheet-level summaries only. Read values and formulas from relevant ranges in the builder when supported by the API.
- `Workbook.render()` is unavailable. Do not claim visual verification from a successful export or validation.
- Do not claim that unsupported workbook features were preserved or verified. If an import/export fidelity issue or unsupported feature affects the result, report it clearly.

## Error recovery

- On the first API or command error, read the full error and check the reported Ruxex capabilities or relevant skill guidance.
- Retry once with the smallest supported correction. Keep the existing builder and patch it instead of creating duplicate builders.
- If the error repeats or the requested feature is unsupported, stop the retry loop, preserve the original file, and report the limit and a workable alternative.
- Do not inspect package internals or alter the bundled runtime to work around a documented capability limit.

## Completion

For a create or edit request, complete the relevant inspection, recalculation, export, saved-file validation, and applicable checks in [verification workflow](workflows/verification.md). Final response should state what changed, where the file was saved, what validation was performed, and any material limits. For read-only requests, answer from workbook evidence without modifying or exporting it. Cite the supporting sheet and cell or range in plain text when workbook evidence is available; do not invent a citation if the runtime cannot inspect the source.
