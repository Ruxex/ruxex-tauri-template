# Helper command contracts

Presentation helpers are subcommands of `ruxex-artifacts pptx helper`. They
accept absolute file paths and print JSON. Read-only operations leave the deck
unchanged. `prepare-template-starter-deck` writes a separate output and refuses
to overwrite an existing file.

Quality gates take explicit JSON contracts so they check only the slides and
values the task declares. A gate failure means the declared requirement did
not pass; it does not prove the deck is wrong in every context. Read diagnostic
messages and compare them with the requested output before changing a deck.

- `native-chart-title-gate` uses 1-based slide, optional zero-based chart,
  and required title entries.
- `native-quantitative-chart-gate` uses 1-based slide, zero-based chart,
  expected `seriesCount`, and `minPointsPerSeries`.
- `native-table-arithmetic-gate` uses 1-based slide and zero-based table, row,
  column, and `sumRows`. `tolerance` is a non-negative displayed-value
  allowance. Blank inputs are skipped, not zero-filled.
- Template plans use a contiguous sequence of unique positive 1-based
  `outputSlide` numbers. Reuse/adapt/omit require `sourceSlide`; omit entries
  have no `outputSlide`. Actions are reuse, adapt, rebuild, new, or omit.

Helper command names and current options are listed with
`ruxex-artifacts pptx helper list`.
