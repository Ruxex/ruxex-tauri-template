# Formula and calculation guidance

Use this guidance for newly added formulas and the affected cells. Follow the user's request and template first. Keep calculations understandable, traceable, and correct for the workbook's actual data and periods.

## Formula construction

- Use direct references and a small number of meaningful intermediate steps. Calculate each shared result once and reuse it when period, units, rounding, and overrides match. Keep independent reconciliations separate.
- Keep raw data, editable assumptions, mappings, and business rules in labeled cells or tables. Mathematical constants from the request can stay in formulas when the output label states their meaning. Use an editable assumption cell for a value that can change or is shared across calculations.
- Use consistent formulas across comparable rows and periods while preserving deliberate differences such as actual versus forecast logic, one-time adjustments, and overrides.
- Use ranges that match the intended records. Avoid including both detail and its subtotal. Do not make the formula's complexity obscure the calculation.
- Keep business calculations in their owning build. Do not make calculations, statuses, or output gates depend on check or audit results. Checks are terminal review outputs.
- Do not add validation gates without a business rule. Do not use formula errors or generic error labels to hide missing prerequisites.

## Periods, dates, and aggregation

- Use the source or user-specified fiscal calendar, cutoff, horizon, time grain, and date. Label actual, forecast, and as-of periods. Do not invent a missing year or silently change a week-start/week-end convention.
- Store dates as numeric serial values and use number formats for display; do not pass JavaScript `Date` objects or date strings as calculated date values. Keep one shared period header for an aligned schedule and derive period logic from it in the target spreadsheet engine.
- Match each period to its own data and assumptions. For a monthly summary of daily transactions, include the complete month boundary and handle timestamps consistently.
- Sum additive flows over time. For stock measures and balances, use the appropriate ending balance. Calculate ratios and weighted averages from their components. Do not add monthly percentages or double-count records that cross period boundaries.
- Preserve units and the numerator, denominator, population, and time period of rates. A zero or missing denominator means a rate is unavailable unless the user's definition states otherwise.
- When source and destination row order can differ, use a stable business key. Do not assume matching row positions establish matching records.

## Lookups, keys, and missing values

- Make lookup matching exact or approximate intentionally. Define how duplicate keys are handled: reject them, aggregate them, or apply a user-specified rule. Never silently take the first match when several records qualify.
- Check both key presence and required source-value presence. A found row with a blank value is not automatically a measured zero.
- Preserve missing data as missing. Do not invent a value or substitute another metric. State the specific missing input near the affected result.
- Distinguish blank versus zero, unavailable, and not applicable. Do not make a missing input appear as a healthy zero or a passing check.
- The current Ruxex evaluator does not support lookup functions such as `XLOOKUP`, `INDEX/MATCH`, or `VLOOKUP`. If a builder performs deterministic key matching in JavaScript, first resolve duplicates and missing values, preserve the raw input, and document how the output refreshes. A builder-produced fixed value is not a live spreadsheet formula.

## Missing inputs, errors, and overrides

- Do not blanket-wrap calculations in `IFERROR(...,0)` or `IFERROR(...,"")`. That can hide broken references, unsupported formulas, and bad inputs. The current Ruxex evaluator does not support `IFERROR`; use only supported formula logic or verify unsupported formulas in the target application.
- Keep expected missing-data behavior specific. Preserve a genuine zero. For rates, do not replace an unavailable denominator with zero or another population.
- Add manual overrides only when requested or established by the template. Keep an override beside the calculation it affects and label its scope and period.
- Define blank optional override behavior separately from zero. A blank may mean “use the base value”; a deliberate zero may mean “set the result to zero.” Do not treat them as the same input.
- Keep one-time adjustments tied to their period or stable record key. Do not carry a one-time zero or adjustment into later periods unless the source or user requires it.
- Preserve meaningful rounding. Keep stored values precise and use number formats for display unless the business rule requires rounding the calculation itself.

## Supported calculations and references

The bundled evaluator supports arithmetic, comparisons, plain A1 cell/range references on the current sheet, and `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, and `IF`. Check the current runtime before relying on any other function.

- Plain relative A1 references are the supported cell-reference form. `$A$1`-style anchored references and cross-sheet references are not evaluated by Ruxex.
- `SUMIFS`, lookup functions, `IFERROR`, date functions, named ranges, dynamic arrays, `INDIRECT`, `OFFSET`, spreadsheet data tables, and iterative calculations are not part of the current evaluator's supported subset.
- The current evaluator evaluates both branches of `IF` before choosing a result. Do not use `IF` to hide division by zero, missing references, or unsupported formulas; the unused branch may still make the calculation unsupported.
- When one of these features is required, preserve the requested formula for the target application only if the Ruxex import/export path can safely carry the workbook. Verify it in that application and report that Ruxex did not calculate it.
- For a narrow template edit, do not replace an unsupported formula with a static value or a different formula merely to make Ruxex recalculate. Explain the limitation and use a preserving workflow when the existing workbook's cached results or native features matter.

## Scenarios and recurring updates

- Use one authoritative scenario selector when the task needs cases. Show the active case and have each driver feed the calculation that owns it. A selector must change the assumptions used in the result, not only change a label.
- Preserve actuals separately from forecast assumptions. A missing input in the selected case should be visible. A blank input in an unselected case should not block a valid active case when all selector formulas are supported; because Ruxex evaluates both `IF` branches, an unsupported or error-producing formula in the unselected branch can still make recalculation unsupported.
- For a requested simultaneous comparison, calculate each case correctly. Do not duplicate the active result under multiple case names. If the supported Ruxex workflow cannot calculate the comparison, explain the limit and agree on a refresh or calculation method.
- For recurring monthly source tabs, a single source table with a Month field is usually simpler than a tab per month. If the template requires monthly sheets, keep a visible registry and written refresh steps. The Ruxex evaluator does not support `INDIRECT`; do not imply that a new tab will automatically flow through formulas.
- When a new period is added, check formulas, check ranges, source coverage, formats, and chart bindings together. Confirm that one-time overrides were not copied into the new period unintentionally.

## Examples using supported formulas

These examples use plain same-sheet A1 references and the currently supported evaluator:

```text
Revenue = Units × Price:       =B2*C2
Total detail:                  =SUM(C4:C15)
Selected value for two cases:  =IF(B1="Base",B2,B3)
```

Calculate a rate only after confirming that its denominator is nonzero, or use a formula verified in the intended target application. Check the units, range, missing-input rules, and zero behavior for the actual workbook. A formula example does not establish support for other spreadsheet functions or target-application behavior.
