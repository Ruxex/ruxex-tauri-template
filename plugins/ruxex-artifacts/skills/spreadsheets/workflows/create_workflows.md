# Create a spreadsheet

## Plan the workbook

- Identify the reader, decision or workflow, output, input data, assumptions, calculations, and checks before populating cells.
- Follow a supplied template, workbook, or visual reference when it exists. When no reference is supplied, use the simplest layout that answers the request; ask only when an unresolved audience or layout choice would materially change the workbook.
- Read [template workflow](../references/template_workflow.md) when a template, existing workbook, or visual reference is supplied.
- Follow [workbook design](../references/workbook_design.md). Roles do not require separate tabs. Combine compatible areas and add tabs only for distinct source data, calculations, readers, refresh needs, or explicit requirements.
- Keep the workbook simple and easy to update. Make the main output easy to find and trace to labeled inputs and useful calculation steps.
- Keep source facts separate from prepared data and business calculations. Preserve the meaning and provenance of source rows.
- Cite real sources beside the input data when source material exists. Do not create a citation-only sheet. Use cell notes only when a source cannot be placed beside the input and the supported workflow can preserve notes.
- Put requested insights once near the relevant results. Support statements with visible figures or rules from the workbook. Avoid invented scores, unsupported recommendations, and long formula-generated narrative.
- For triage or action lists, show the affected records and reasons. Include owners, actions, or deadlines only when relevant and supported by the source.

## Build and check

- Use typed numbers, dates, and percentages rather than formatted text. Keep identifiers such as ZIP codes, account IDs, and SKUs as text.
- Write formulas that expose meaningful calculation steps. Avoid hiding an entire analysis in a dense expression or duplicating the same calculation in multiple places.
- Use only documented Ruxex API features and formulas supported by the bundled evaluator when a calculated result is required. An XLSX may contain formulas the Ruxex evaluator cannot calculate; identify those results and verify them through an available target application when possible.
- Do not add a separate Checks tab for a simple workbook. Add review areas only when they clarify an important reconciliation or validation need.
- Follow [verification workflow](verification.md) after the final changes. Independently spot-check important totals or ratios against the source data. Export and validate the saved XLSX using the Ruxex command only when its content can safely pass through the Ruxex import/export boundary.
