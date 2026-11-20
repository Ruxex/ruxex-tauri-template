# Use supplied presentations and references

First determine whether the user wants to edit the supplied deck, match its
design, take inspiration from it, or use only its text, data, or images. A deck
provided as source material is not automatically a design template.

Before matching a design, inspect the relevant slides and render previews where
the file type and local tools allow it. Check canvas size, title and body
placement, fonts, colors, logos, image crops, and repeated elements such as
footers. For a whole-deck adaptation, review every source slide before choosing
layouts. Do not assume a 16:9 canvas.

Use `pptx helper inspect-template` to list source layouts, shape types,
text, tables, and charts. Record the intended output slide, source slide, and
action in a JSON plan, then check its references with
`pptx helper validate-template-plan`. The accepted actions are `reuse`,
`adapt`, `rebuild`, `new`, and `omit`. Output numbers are unique and contiguous
from one. Reuse/adapt/omit actions require a source slide, but omit entries have
no output number. Slide numbers are 1-based. After export,
`pptx helper check-template-fidelity` reports slide count, canvas, layout, and
shape-count changes. These structural comparisons do not prove visual fidelity.

Example mapping:

```json
{
  "slides": [
    {"sourceSlide": 1, "outputSlide": 1, "action": "reuse"},
    {"sourceSlide": 3, "outputSlide": 2, "action": "adapt"},
    {"outputSlide": 3, "action": "new"},
    {"sourceSlide": 2, "action": "omit"}
  ]
}
```

The Ruxex importer extracts editable text and basic run styles, shape geometry
and positions, simple tables, supported embedded images and their crop/mask
settings, speaker notes, and deck dimensions. It reconstructs common cached
line/bar/pie/doughnut/area charts, named layouts and placeholders, simple
inherited rectangle/line/text artwork from masters and layouts, supported
custom paths, and gradient fills. It does not reconstruct inherited images,
complex master artwork, arbitrary chart types, or full rich-text range
semantics. Diagnostics identify some losses and may not list every loss. Do
not claim a faithful round-trip when unsupported content is present.

When the requested match depends on unsupported parts, use the source deck as a
visual reference and rebuild the needed content with supported local elements.
Explain any material differences in fidelity. If the user requires those
unsupported parts to remain editable and intact, describe the limitation before
replacing or exporting the deck.

For a content-only read, use the CLI's `pptx read` command. For package
diagnostics, run `pptx helper inspect-package-integrity`; this
checks the ZIP entries and internal relationships but does not certify that
PowerPoint will open every feature. Run `pptx helper inspect-layout-geometry`
to list out-of-bounds objects. Intersections are optional review signals and
may be intentional.

For a new presentation without a template or visual direction, select a visual
system that suits the audience, evidence, and purpose. State the chosen
direction briefly when it materially affects the result. Continue without a
template when none is supplied. Ruxex does not provide Codex's hosted template
picker or template catalog; do not imply that an external template search was
performed.
