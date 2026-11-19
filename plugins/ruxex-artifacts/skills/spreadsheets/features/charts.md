# Charts

Use a chart when it makes a requested trend, comparison, or composition easier to understand. Follow the workbook's existing chart style during edits.

## Choose and prepare

- Choose the chart type that matches the question: line for ordered time trends, column or bar for category comparisons, and pie or doughnut only for a small number of parts that sum to a meaningful whole.
- For distributions, use formula-prepared bins with a bar or column chart only when the bins preserve the source meaning. For relationships between two numeric variables, the current Ruxex API does not support scatter charts; use a clearly labeled table or another target-application workflow when that chart is required.
- Use the supported Ruxex chart types: `line`, `column`, `bar`, `pie`, and `doughnut`.
- Keep source values in labeled worksheet ranges. Use `categories` and `values` ranges for every series and a clear series name when appropriate.
- Keep period grain and units consistent. Do not combine incomparable scales without making the distinction clear.
- Keep each series' category and value ranges aligned, with the same number of points. Exclude headers from values and check that categories were not interpreted as additional series.
- Keep missing observations blank. Do not convert them to zero to make a line or column look continuous. Disclose omitted records and aggregation that changes the comparison.
- Show relevant baselines and the full comparison period. Use common scales and units for comparable charts; do not select periods or bounds that exaggerate a change.

## Review

- Keep category labels readable and the chart close to its supporting data or output.
- Avoid a separate dashboard or chart tab when an inline chart answers the request.
- Put units in a clear nearby title or label. Keep titles factual and specific. For bar or column comparisons, include zero in the value range when the runtime allows axis settings. Use a narrower line-chart range only when it improves reading and is clearly understood.
- Match colors to the workbook's meaning and preserve the same category color across related charts. Avoid decorative effects, heavy borders, and unnecessary gridlines.
- Before and after a change, check series names, categories, values, and point counts. Confirm that an added period appears once and that no stale or disconnected range remains.
- After export, inspect the chart in the Ruxex application preview when available. The current `Workbook.render()` API is unavailable, and XLSX validation alone does not establish that a chart appears or behaves as intended in Excel.
- The current chart API accepts only type, position, and series ranges/names. It does not expose chart titles, axis titles or bounds, line styles, data labels, or legends. Put essential title and unit context in nearby cells and use a target application to verify features Ruxex cannot set.
- When editing a chart, preserve unrelated chart ranges and formatting as far as supported by the Ruxex API. Report any native chart feature that cannot be represented or verified.
