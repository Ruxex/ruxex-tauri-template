# Editable tables and charts

Use editable PowerPoint tables and native charts when the audience needs to
read or revise the evidence. Keep categories, periods, units, signs, and
displayed precision aligned with the source data. Do not replace evidence with
decorative graphics.

## Tables

- Keep headers clear and put units in the header or a nearby label.
- Recalculate displayed totals and ratios from the displayed inputs. Preserve
  blanks as blanks; a missing value does not mean zero.
- Compare repeated values across the table, chart, title, body copy, and notes.
- For an explicit arithmetic check, write a small JSON contract and run
  `pptx helper native-table-arithmetic-gate`. Its zero-based table, row, and column
  indexes are scoped to the selected slide. A blank or non-numeric input is
  reported as skipped rather than treated as zero. Add `tolerance` only when
  displayed rounding justifies it.

Example contract:

```json
{
  "checks": [
    {"slide": 2, "table": 0, "row": 5, "column": 2, "sumRows": [2, 3, 4], "tolerance": 0.01}
  ]
}
```

## Charts

- Use native charts for quantitative comparisons. Confirm category order,
  series, date coverage, units, signs, and labels against the source.
- Declare expected native chart series and minimum point counts in a JSON
  contract for `pptx helper native-quantitative-chart-gate`. This gate can catch a
  missing chart or incomplete series, but it does not validate source lineage,
  labels, or the chart's conclusion.
- Give each chart a title that states the measure and period or comparison.
- Declare charts that require titles in a JSON contract and run
  `pptx helper native-chart-title-gate`. The gate checks only declared slides or chart
  indexes; it does not judge whether a title communicates the right result.
- Inspect the embedded data and the rendered chart. A valid chart package does
  not prove that its source data or conclusion is correct.

Chart contract example:

```json
{"requiredTitles": [{"slide": 2}, {"slide": 5, "chart": 0}]}
```

The slide number is 1-based. Omitting `chart` requires a title for every native
chart on that slide.
