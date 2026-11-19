# Finance guidance

Use for budgeting, forecasting, financial reporting, operating models, and valuation. Finance requirements apply regardless of the employer's industry. The shared [workbook design](../references/workbook_design.md) and [style guidance](../style_guidelines.md) still apply.

## Basis and sources

- Preserve the requested accounting basis, scope, inclusions, exclusions, periods, currency, scale, and signs.
- Distinguish revenue from collections, payroll expense from cash paid, capex from depreciation, and earnings from cash flow.
- Reconcile source controls before combining extracts or comparing versions. Label estimates and material differences clearly.
- Cite source information beside relevant inputs when known. Do not invent source values or assume a currency conversion.

## Periods, assumptions, and scenarios

- Use the source fiscal calendar, cutoff, forecast horizon, and time grain. Label actual, forecast, and as-of periods.
- Use editable, date-aligned drivers. Tie notes and overrides to clear periods and source keys.
- Keep actuals distinct from forecast assumptions. Missing pay or zero FTE does not establish an implied pay rate.
- For refreshed sources, match records by appropriate business and date keys. Preserve history and exclude overlapping periods.
- Keep stationary assumptions stationary when extending periods; extend only the period-driven columns. Distinguish one-time adjustments from changes to the future run rate. Do not roll a period-specific override into later months without a source or user rule.
- Keep one scenario selector when cases are needed, and have the forecast build use the active assumption row. Do not make separate case columns that all link to the same active output.

## Operating schedules and reporting

- Revenue: preserve volume, price, mix, and recognition timing. Roll customers through additions and losses when customer cohorts are supplied. Average billable volume needs an explicit timing assumption.
- Payroll: distinguish headcount, FTE, and paid FTE. Use supported hire/exit timing and proration. Do not divide monthly pay by 12 again.
- Operating costs: distinguish units times rate, fixed fees, and one-time adjustments. Seats need not equal headcount.
- Capital and depreciation: retain cost, residual value, in-service date, useful life, and opening asset depreciation where available. Preserve partial periods and disposals. Reconcile gross assets, accumulated depreciation, and net assets. Bridge cash capex to additions and treat depreciation as noncash expense where appropriate.
- Financial statements: roll retained earnings using the supplied accounting basis. Keep working capital, principal, interest, and equity distinct. Reconcile ending cash to balance-sheet cash. Do not force a tie with an unexplained plug.
- Variances: compare matching periods and bases. Show material monetary variance as both amount and percent when the denominator is meaningful. Label expense over/under budget and its favorable/unfavorable direction. Missing or zero denominators are unavailable, not zero percent.
- Verify financial calculations independently. Ruxex may not evaluate every financial-model formula or native Excel feature.

## Valuation and presentation

- Use the requested valuation method and date. A comparable-company or LBO analysis does not imply an unrequested DCF.
- Keep metric periods, net debt, and share counts consistent. Label missing inputs and assumptions.
- A DCF should show operating drivers, taxes, depreciation and amortization, capital expenditure, working-capital changes, unlevered cash flow, discounting, terminal value, and the enterprise-to-equity bridge. State the terminal-value method and discount timing when those details are part of the request.
- IRR or XIRR requires valid cash-flow signs and dates. Do not silently substitute another return measure.
- Use plain business language and consistent accounting formats. In working model cells, use blue for editable numeric inputs, black for same-sheet formulas, and dark text for output values. The current Ruxex evaluator does not support cross-sheet formula links; do not imply that green linked formulas are verified by Ruxex.
- Avoid vague or dramatic language such as “movement,” “backbone,” “pressure point,” “pain point,” “pressure test,” “proof point,” and “durable.” Name the specific result, driver, variance, assumption, or risk. Preserve source-defined terms and exact quotations when they are required.
- Use parenthesized negatives and dash zeros where the template or domain calls for them, one decimal for most percentages, two decimals for per-share prices, and enough precision for fractional FTE or scaled amounts. Show currency symbols on key monetary rows and totals, not on counts or rates. Avoid double-scaling.
- Use real dates for monthly periods (often `mmm-yy`) and preserve fiscal-year and quarter definitions from the source. Do not label a calendar year as a fiscal year unless the source does so.
- When a stored date is the monthly period, show it as `mmm-yy`. Keep calendar years as `yyyy`. Use fiscal year and quarter labels only when the source defines the fiscal calendar and year convention; do not infer them from a date without that basis.
- Preserve formulas as formulas and keep assumptions editable. Do not claim support for Excel What-If Data Tables or iterative calculation unless Ruxex reports and verifies those features.

## Finance checks

- Reconcile financial schedules and bridges to source controls. Use the correct period aggregation and preserve the requested sign and basis.
- Set tolerances based on the units and business meaning. Show differences to meaningful precision, including a clear zero difference.
- Keep passing checks visually neutral. Show missing or untested checks as unavailable, not zero or `PASS`. Name the failed reconciliation and the relevant source or calculation cells.
- Checks are terminal diagnostics and must not feed assumptions, business calculations, summaries, or output gates.
