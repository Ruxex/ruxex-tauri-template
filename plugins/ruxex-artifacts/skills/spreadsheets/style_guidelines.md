# Spreadsheet style guidance

Follow user instructions, then the supplied template or intentional reference, then relevant domain conventions. Defaults apply to new sheets or authorized restyling. For existing workbooks, preserve unrelated layout, formats, and features.

## Layout

- Make the main result easy to find. Use concise titles, compact spacing, and clear grouping.
- Distinguish inputs, calculations, outputs, and notes consistently. Use restrained fills and borders; avoid boxing every cell.
- Align titles, headers, and tables to a consistent content edge. Keep genuine spacer columns blank.
- Use merged cells sparingly. Do not merge working headers, input areas, or distinct table columns.
- Use freeze panes only if supported by the target workflow and useful for long tables. Preserve existing panes during unrelated edits.
- Format only populated or intentionally reserved areas. Avoid oversized banners, arbitrary KPI cards, redundant summaries, and text shrunk to force a fit.
- For multi-sheet workbooks, put outputs first, assumptions near the output, builds after them, and sources/internal sheets toward the right. Use a divider only for a substantial group of source or internal sheets. Preserve a deliberate template order.
- For complex, shared workbooks, use a restrained output sheet tab color and a lighter assumptions color where the target format supports tab colors. Do not add dividers or colors just to decorate a focused workbook.

## Text and numbers

- Use direct, factual labels. Preserve the subject, population, units, time period, comparison, and uncertainty needed to interpret a value.
- Write for the intended reader. Keep only text needed to understand the data or use the workbook. Do not put authoring notes, internal file paths, plans, or instructions to the requester in the workbook unless requested.
- Keep clear existing text unchanged. Rewrite unclear text only when it helps the reader. Remove filler instead of replacing it with a polished but equally unnecessary sentence.
- Avoid internal jargon, vague status labels, slogans, buzzwords, synthetic contrasts, and formulaic promotional language. State a specific result, driver, issue, or action. Keep business claims factual and supported by the workbook.
- Avoid decorative bullets, icons, emoji, arrows, pipe-delimited headings, self-rating banners, motivational wording, and generic disclaimers. Preserve specific warnings and business statuses when they are required.
- Keep numbers, percentages, currency, and dates as typed values. Use text for identifiers and labels.
- Use Excel-invariant format codes such as `#,##0`, `0.0%`, `0.00%`, and `"$"#,##0.00`. Do not change decimal and grouping separators to imitate a locale; the display locale controls separators.
- Match precision to the meaning and source. Use whole units for counts, one decimal for most analytical percentages, zero decimals for dashboard outputs when appropriate, and more precision when small differences matter. Use whole currency units unless cents are meaningful.
- Keep dates numeric and sortable. In Ruxex, enter date serial numbers and apply a number format; `Date` objects and date strings are not supported as typed cell values. Choose a short format that fits the workbook's language and location. A display format does not change the period represented.
- Align text left and numbers right by default. Keep units and definitions close to the relevant value.

## Visual hierarchy and conditional meaning

- Use a restrained type scale and consistent font choices across sheets. Emphasize headers and totals without excessive bolding or color.
- Use input colors only when the inputs are editable. Use warning colors for actual errors or missing requirements, not decorative status paint.
- When a status depends on an input, use a formula or supported dynamic feature so it updates with the input. Never make a static PASS or error color stand in for a check.
- Do not rely on color alone to communicate status; include a clear label or value.
- Avoid unnecessary icons, emoji, slogans, decorative badges, and generic disclaimers.
- For scenario workbooks, show the selected case near the top of each output and build view. Keep a single editable selector; label the active assumption row before other cases. Where the layout supports it, distinguish editable inputs from calculated values using a small consistent palette.
- Use one blank top row and a concise, unfilled title for a new reader-facing sheet unless the template requires another layout. Keep titles, working headers, and calculation areas unmerged. Center headers over their own columns, not across populated neighboring cells.
- Use consistent table row heights and modest spacing where supported. Size rows and columns to fit their contents; do not shrink the type to force a fit. Keep body type and title sizes consistent.
- Use a dark, high-contrast header with clear text. Prefer light structural lines and no full body-cell grid. Keep real spacer columns blank and unfilled.

## Sources and annotations

- Keep source citations in one place, preferably beside the input table or at the top of its source area. Include enough detail to identify the organization, document, period, page or section, and URL when available.
- If no suitable place exists in the workbook, report the source in the chat instead of adding a citation-only sheet.
- Do not add citations to presentation-only output regions unless requested. Do not create a separate source tab when the citations fit beside the inputs.
- Do not add cell comments unless requested. Preserve existing comments or notes when supported by the import/export workflow.

## Required user actions

When a requested workflow needs a human input, provide an obvious editable field separate from the source notes. A calculated status or action should reflect every required prerequisite. Do not show completion while another required action remains open. Keep calculated warnings distinct from editable-input cues.

## Existing workbooks

Match established styles for narrow edits. Change only requested cells and directly affected ranges. Do not apply sheet-wide autofit, wrapping, or restyling unless requested. Preserve source formats and native features to the extent the Ruxex import/export workflow supports them, and report fidelity limits that affect the result.

## Supported Ruxex formatting controls

The current Ruxex range API supports font bold/italic/color/size, fill color, horizontal/vertical alignment, text wrapping, number formats, and column width. It does not currently expose font family, borders, row height, sheet tab colors, gridline visibility, freeze panes, conditional formatting, or cell notes/comments. Apply the related guidance only when the target application or a supported workflow provides the feature. Do not imply that a static fill will update dynamically.
