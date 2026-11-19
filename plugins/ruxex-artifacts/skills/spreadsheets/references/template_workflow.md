# Template and reference workflow

Treat a supplied workbook, template, or visual reference as the source of truth for structure, terminology, periods, and intentional formatting unless the user requests a change.

## Before authoring

- Identify the task, role, audience, decision, target application, expected output, source data, calculations, and required checks.
- For an existing workbook, review the sheets and directly affected values, formulas, and supported objects before editing. Use the existing design and workbook architecture; keep the change targeted.
- For a template or screenshot, distinguish required content and layout from incidental styling. Preserve intentional conventions such as actual/forecast boundaries, units, and source labels.
- If there is no template, choose the simplest layout that answers the request. Ask for clarification only when the audience, decision, or required output would materially change the workbook structure.
- Use only documented Ruxex capabilities. If a reference relies on a feature Ruxex cannot create or preserve, identify that limitation before using a substitute.

## Screenshot and image references

- Use number and date formats that fit the workbook's purpose, audience, and source data. Preserve numeric and date values; do not recreate locale punctuation or currency symbols by turning the data into text.
- Before copying a numeric table as fixed values, identify ranges that appear formula-derived. Compare adjacent rows and columns for exact repeated sums, differences, products, ratios, or constant multiples. Keep source inputs as values and derived ranges as formulas when they can be represented correctly.
- Match visible styling only when it is clear. Do not infer font weight, borders, or emphasis from image zoom, antialiasing, compression, or other ambiguous artifacts.
- If the image does not reveal the formula, source definition, or period basis, keep the uncertainty visible and ask only when it changes the result. Do not invent missing calculations from appearance alone.

## During edits

- Preserve sheet names, order, source records, formulas, terminology, and formatting outside the requested scope.
- Extend nearby formulas and ranges only when they are valid for the new data and supported by the target workflow. Verify the new row or period, including checks and chart source ranges.
- Do not broadly restyle an existing template to match general defaults. Match existing fonts, fills, number formats, and navigation cues where those details are available.
- Keep the original file unchanged. Save to a new output path unless the user explicitly requests an overwrite.
