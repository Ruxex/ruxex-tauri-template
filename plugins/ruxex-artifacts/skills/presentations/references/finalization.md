# Check and hand off a presentation

Before handing off a deck:

1. Confirm slide count, order, required topics, units, and comparisons against
   the request and source material.
2. Check factual claims and calculations against their sources. When sources
   disagree on a conclusion-changing fact, state the disagreement and its
   effect, preserve both supported readings, or pause the conclusion and ask
   for direction. Do not silently select one source. Recalculate table totals,
   subtotals, and ratios from their displayed inputs; check denominator,
   units, and rounding. Compare repeated numbers across chart labels, tables,
   titles, body copy, and notes. Put source
   references and image credits in the relevant speaker notes. Keep citations
   on the slide when the audience needs them.
3. Run `pptx validate` to check the package structure. This does not establish
   factual accuracy, text fit, visual quality, or how PowerPoint will render
   the file.
   `pptx helper inspect-package-integrity` provides additional ZIP and
   relationship diagnostics; `pptx helper inspect-layout-geometry`
   reports geometry outside the slide bounds. Neither tool repairs the deck.
4. Use `presentation.inspect()` or its `select`/`include` form to review the
   content and positions available to the local model. Use
   `presentation.render({ slide })` for the supported source-model PNG preview.
   The preview is not a complete PPTX renderer. Do not claim to have visually
   checked unsupported imported content.
5. For every quantitative chart, compare category order, series, date coverage,
   positive and negative signs, units, and displayed precision with the source
   data. Recalculate derived values and verify that labels, titles, and notes
   describe the same comparison. Correct confirmed omissions, overlaps, crowded text, inaccurate labels,
   and unsupported claims. Do not make changes based only on an unverified
   assumption about the source.
   Use `pptx helper native-chart-title-gate` and
   `pptx helper native-table-arithmetic-gate` for explicitly declared checks.
   Read their diagnostics and verify the source data yourself; these gates do
   not establish that a chart title or conclusion is factually correct.
6. Render every final slide from the exported PPTX with
   `pptx helper render-slides`, make a contact sheet with
   `pptx helper make-contact-sheet`, and inspect each slide image at full size.
   A contact sheet is for deck flow only. The packaged renderer can differ
   from Microsoft PowerPoint.
7. Report the absolute output path, what was checked, and any material
   limitations that affect editability or visual confidence. Do not imply that
   package validation proves a visual match.
