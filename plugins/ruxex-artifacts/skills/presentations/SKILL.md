---
name: presentations
description: Create, inspect, edit, validate, and preview local PowerPoint presentations with the bundled Ruxex APIs.
---

# Presentations

Use the bundled `ruxex-artifacts` command and Ruxex JavaScript API for local
PowerPoint work. Do not install packages or depend on a system office
application. Use the absolute path to this `SKILL.md` supplied by the active
Skill context to locate the sibling `ruxex-artifacts` executable. Invoke it by
its full path; do not rely on command lookup through `PATH`. Read the shared
[runtime rules](../RUNTIME.md) before using packaged runtime paths.

Run JavaScript builders with `ruxex-artifacts run`. Use `ruxex-artifacts pptx
helper` for local presentation inspection, quality gates, and Office preview
rendering. Helpers return JSON; rendering uses only packaged LibreOffice and
Poppler tools.

## Choose the workflow

- For read-only questions about a supplied deck, inspect it and answer without
  changing the file.
- For content review, read the deck and report the useful findings, gaps, or
  unsupported objects. Do not make edits unless requested.
- For an existing deck or template, read it first. The importer extracts text
  and basic run styles, shape positions, simple tables, supported embedded
  images and crops, common cached line/bar/pie/doughnut/area charts, Ruxex
  named layouts and placeholders, supported custom paths and gradient fills,
  speaker notes, and deck dimensions. It retains simple rectangle, line, and
  text artwork inherited from layouts and masters. It reports unsupported
  inherited objects and some other losses through diagnostics. It does not
  reconstruct inherited images, complex artwork, other chart types, or full
  text semantics, and diagnostics may not enumerate every loss. Treat imported
  decks as content references when unsupported content matters; do not claim a
  faithful round-trip.
- For a new deck, create only the requested number of slides, including a
  cover if one is requested. Do not add a cover to a one-slide request by
  default.

Before authoring or editing, read the [API reference map](references/api-reference-map.md)
and [API compatibility](references/api-compatibility.md); use only operations
listed as supported there. For a minimal builder, use the
[API quick start](references/api-quick-start.md). When using a supplied deck
or matching a reference, read [template workflow](references/template-workflow.md).
When creating or changing layouts, read [slide design and review](references/design-guidance.md).
When creating or redesigning a cover, read [cover guidance](references/cover-guidance.md).
For editable tables and charts, read [native evidence](references/native-evidence.md).
For slide rendering and visual review, read [rendering review](references/rendering-review.md).
For concise slide copy, read [writing guidance](references/writing-guidance.md).
For a focused accessibility pass, read [accessibility review](references/accessibility-review.md).
For financial reporting, planning, valuation, or investment decisions, also read
[finance guidance](domain-guidance/finance.md).
Before handoff, follow [finalization](references/finalization.md). If the request
depends on an unsupported feature, explain the limitation and offer the closest
editable local alternative.

## Template and review helpers

Use these helpers through the bundled Rust CLI. File paths must be absolute.
Read-only operations leave the supplied deck unchanged.

```sh
"/absolute/path/to/skill/ruxex-artifacts" pptx helper inspect-template \
  --input "/absolute/path/to/source.pptx"
```

- `inspect-template` lists slide layouts, shape types, text, tables,
  and charts before choosing what to reuse.
- `validate-template-plan` checks a slide mapping JSON against the source
  deck. Output slide numbers must be unique, positive, and contiguous. Use an
  `action` of `reuse`, `adapt`, `rebuild`, `new`, or `omit`. Reuse/adapt and
  omit actions require a valid source slide. Omitted slides have no
  `outputSlide`; output slide numbers are 1-based.
- `check-template-fidelity` compares slide count, canvas size, per-slide
  shape count, and layout names. These structural signals do not establish
  pixel fidelity.
- `prepare-template-starter-deck` creates a separate copy with slide-owned
  content cleared while retaining placeholders by default. It never edits the
  source deck.
- `render-slides` renders the exported PPTX with the packaged office tools;
  `make-contact-sheet` combines rendered images for deck-level review. Pass
  each image with a repeated `--image` flag.
- `inspect-package-integrity` checks package entries and internal
  relationships. `inspect-layout-geometry` reports
  objects outside slide bounds and can list intersections. Overlaps may be
  intentional.
- `native-chart-title-gate` and `native-quantitative-chart-gate` check
  only charts declared in their JSON contracts.
  `native-table-arithmetic-gate` checks declared table totals and respects
  blanks and displayed rounding. Neither gate establishes factual correctness.

Use `"/absolute/path/to/skill/ruxex-artifacts" pptx helper list` to see all
helper operations.

For examples of the template map, evidence contracts, rendering, and review
limits, read [template workflow](references/template-workflow.md),
[native evidence](references/native-evidence.md), and
[rendering review](references/rendering-review.md).

## Content and writing

- Base factual claims on supplied material or sources gathered for the task.
  Do not invent facts, numbers, or citations. Preserve units, comparisons,
  assumptions, and caveats that affect the conclusion.
- When supplied sources conflict, identify which source and reporting period
  supports each claim. Do not silently combine incompatible figures. Before
  delivery, compare chart categories, series, dates, positive and negative
  values, and displayed precision with the source data. Recalculate table
  totals, subtotals, percentages, and rounded values when they affect the
  conclusion; correct discrepancies or describe unresolved ones.
- Put external source citations and image credits in the relevant slide's
  speaker notes. Keep a citation on the slide when the audience needs to see
  it.
- Write for the audience in direct, natural language. Remove vague claims,
  filler, slogans, inflated wording, and presenter narration. Prefer specific
  findings over promotional labels such as “A New Era” and “Unlocking Potential.”
- Avoid formulaic three-part lists and unnecessary hyphenated compounds.
  Prefer active sentences where they read naturally. Remove passive claims,
  slogans, and unsupported promotional phrasing. Avoid em dashes, semicolons,
  decorative dot bullets, vertical-bar chains, and arrow chains in slide copy.
- Review wording for five common failures: unnatural phrasing, inflated claims,
  vague labels, redundant words, and claims whose logic is unclear. Replace
  each with a specific, plain statement that preserves the supported meaning.
  Avoid slogan patterns such as "It's not a plan, it's a mindset," default
  imperative titles, and repeated three-part action lists. Keep technical terms
  and official names when they are needed.
- Use a concise subject title for setup, process, and background slides. Use
  a takeaway title when the slide supports a specific finding. Avoid generic
  narrative frames such as “From X to Y” when the actual subject is clearer.
  Choose the form that describes the slide best; do not force every title to
  sound like a takeaway or a noun phrase. Keep short titles and headings free
  of trailing periods.
- Keep commentary about creating or checking the deck out of the slides,
  speaker notes, and requested explanation.

## Design and editable content

- Follow the user's requested design, supplied branding, and reference deck
  before applying defaults. A deck supplied only as a source of text or data
  is not automatically a design template.
- Give each slide one clear purpose. Prefer a single canvas composition over
  repeated card grids or interface-like panels.
- Keep text readable and avoid overflow. The API uses CSS pixels at 96 DPI:
  use about 56 px for a 42 pt deck title, 43 px for a 32 pt slide title, and
  at least 23 px for 17 pt body text. Cut content before reducing type size.
- Keep tables and shapes editable. Use original logos and supplied artwork
  through `slide.images.add` when their aspect ratio can be preserved. Use
  native charts for quantitative evidence. Do not replace evidence with
  decorative elements.
- For simple editable lists, use structured text paragraphs with a native
  `bulletCharacter` rather than typing bullet symbols into repeated text boxes.
  Check the exported paragraph indents and spacing when list geometry matters.
- For decorative visual assets, use image search or image generation rather
  than drawing them with code. Fit the image box to the source aspect ratio.
- Keep the title slide simple and limited to the information needed to
  introduce the deck.
- When creating or redesigning a cover, keep an existing cover unless the task
  requires changing it. Count the cover toward the requested slide total and
  add one only when useful. Keep the title readable over images, preserve logo
  proportions, and do not use a miniature webpage or slide as the cover design.

## Local authoring workflow

1. Check available operations with
   `"/absolute/path/to/skill/ruxex-artifacts" capabilities --json`.
2. For an existing PPTX, inspect its text and limitations with
   `"/absolute/path/to/skill/ruxex-artifacts" pptx read --input /absolute/path/source.pptx --json`.
   For an output or source file, also check structure with
   `"/absolute/path/to/skill/ruxex-artifacts" pptx validate --input /absolute/path/file.pptx --json`.
3. Write one `.mjs` builder importing `Presentation` and
   `PresentationFile` from `@ruxex/artifact-tool`.
4. Create the requested slides with supported editable text, shapes, tables,
   local images, native charts, backgrounds, and speaker notes. Keep positions
   and font sizes in CSS pixels.
5. Run the builder with
   `"/absolute/path/to/skill/ruxex-artifacts" run /absolute/path/build.mjs`.
6. Export with `PresentationFile.exportPptx(presentation)`, save to an
   absolute path, and print the save result as JSON so Ruxex can offer its
   local preview.
7. Validate the exported PPTX. This check confirms package structure; it does
   not check content accuracy, slide layout, text overflow, or visual quality.
8. Use `presentation.inspect({ select, include })` to review slide content and
   positions. Use `presentation.render({ slide })` to inspect the supported
   source model as a PNG preview with a layout JSON sidecar; request SVG when
   vector output is useful. `presentation.export({ format: "pdf" })` creates
   rasterized pages from the source model. For an exported PPTX, run
   `pptx helper render-slides` and inspect each rendered page; use
   `pptx helper make-contact-sheet` only for deck-level flow. These local renderers can
   differ from PowerPoint and do not cover every imported object. The desktop
   file preview shows text and annotations, not pixel-accurate slide rendering
   of the PPTX package.
   Fix content coverage, slide count, visible position conflicts, and factual
   issues supported by the available evidence.
9. Report the absolute output path and material limitations. Do not deliver
   temporary builder files unless requested.

## Example

```js
import { Presentation, PresentationFile } from "@ruxex/artifact-tool";

const presentation = Presentation.create({
  title: "Project Review",
  slideSize: { width: 1280, height: 720 },
});
const slide = presentation.slides.add();
slide.background.fill = "#F8FAFC";

const title = slide.shapes.add({
  geometry: "textbox",
  position: { left: 72, top: 64, width: 1136, height: 96 },
  fill: "none",
  line: { style: "solid", fill: "none", width: 0 },
});
title.text = "Project Review";
title.text.style = { fontSize: 56, bold: true, color: "#0F172A" };

slide.tables.add({
  position: { left: 72, top: 200, width: 800, height: 180 },
  rows: [["Area", "Status"], ["Schedule", "On track"]],
});
slide.addNotes("Source: supplied project report.");

await presentation.inspect();
const file = PresentationFile.exportPptx(presentation);
const result = await file.save("/absolute/path/review.pptx");
console.log(JSON.stringify(result));
```
