# Presentation API compatibility

The Ruxex facade follows the common config-first JavaScript shape used by the
Codex presentation API while keeping its own local runtime and PPTX exporter.
Import from `@ruxex/artifact-tool`; do not substitute the Codex package name.

## Supported authoring surface

```js
import { Presentation, PresentationFile } from "@ruxex/artifact-tool";

const presentation = Presentation.create({
  title: "Review",
  slideSize: { width: 1280, height: 720 },
});
const slide = presentation.slides.add();
const { slide: inserted, index } = presentation.slides.insert({ after: 0, layout: "title" });
const byIndex = presentation.slides.getItem(0);
slide.background.fill = "#FFFFFF";

const title = slide.shapes.add({
  geometry: "textbox",
  position: { left: 72, top: 64, width: 720, height: 96 },
  fill: "none",
  line: { style: "solid", fill: "none", width: 0 },
});
title.text = "Editable title";
title.text.style = { fontSize: 44, bold: true, color: "#172033" };

slide.shapes.add({
  geometry: "rect",
  position: { left: 72, top: 188, width: 520, height: 180 },
  fill: "#E8EEF7",
  line: { style: "solid", fill: "#CBD5E1", width: 1 },
});
slide.tables.add({
  position: { left: 72, top: 400, width: 720, height: 180 },
  rows: [["Area", "Status"], ["Schedule", "On track"]],
});
slide.images.add({
  src: "/absolute/path/mark.png",
  position: { left: 840, top: 64, width: 120, height: 120 },
  fit: "contain",
});
slide.charts.add("bar", {
  position: { left: 840, top: 220, width: 368, height: 360 },
  series: [{ name: "Revenue", labels: ["Q1", "Q2"], values: [12, 18] }],
});
slide.addNotes("Source: supplied project report.");

presentation.comments.setSelf({ displayName: "Reviewer", initials: "RV" });
const thread = presentation.comments.addThread(
  { textMatch: { element: title, query: "Q4" } },
  "Confirm the reporting period.",
);
thread.addReply("Confirmed.").toggleReaction("👍");
thread.resolve();

slide.autoLayout([title], {
  direction: "horizontal",
  frame: { left: 72, top: 120, width: 1120, height: 160 },
  horizontalGap: "auto",
  align: "center",
});

const overview = await presentation.inspect();
const slideContent = await presentation.inspect({
  select: "$.slides[*]",
  include: [
    "id",
    "index",
    "title",
    "elements.id",
    "elements.kind",
    "elements.text",
    "elements.position",
    "notes.text",
  ],
});
const output = PresentationFile.exportPptx(presentation);
const result = await output.save("/absolute/path/review.pptx");
console.log(JSON.stringify(result));
```

### Structured layouts and JSX trees

`slide.compose(nodeOrJsx, { frame })` creates editable slide objects from layout
nodes. It accepts `row`, `column`, `grid`, `layers`, `box`, `paragraph`,
`run`, `shape`, `rule`, `image`, `table`, `chart`, `slide`, and `background`
nodes, including React-shaped elements with those node types. Layout nodes
support pixel dimensions, `fill`/`hug` sizing in row and column flows, gaps,
alignment, padding, weighted `fr`/fixed grid tracks, and row/column spans.
Grid and layer nodes also accept `alignItems` and `justifyItems` with
`start`, `center`, `end`, or `stretch`. Chart nodes accept nested chart-family,
series, marker, point, data-label, trendline, and error-bar nodes, as well as
axis/gridline, legend, data-table, and 3D-view configuration. Paragraph style
accepts common
`className` tokens and the Codex compact text-style properties: font shorthand,
size/family/weight/style, color/fill, leading, alignment, wrap, underline,
insets/padding, and auto-fit. These values are normalized and mapped into
editable model properties and PPTX text options. Ordinary CSS layout, custom
Compose invokes stateless React function components. It does not implement
React hook/context semantics, general CSS layout, or a full React renderer.
The return value is an array of editable
shape, image, table, and chart handles.

```js
const [heading, card] = slide.compose({
  type: "column",
  props: { gap: 16 },
  children: [
    { type: "paragraph", props: { width: "fill", height: 48, className: "text-2xl font-bold" }, children: "Quarterly review" },
    { type: "box", props: { width: "fill", height: 220, fill: "slate-100", padding: 20 }, children: "Key results" },
  ],
}, { frame: { left: 72, top: 64, width: 1100, height: 560 } });
heading.text = "Quarterly review";
```

Custom layouts can define named, editable text placeholders. The exporter
creates a PowerPoint slide master/layout hierarchy and matching slide
placeholders for those definitions. Placeholder text is stored in slide-owned
objects. Named layouts, their placeholder geometry and basic styles, and
simple inherited rectangle, line, and text artwork are imported. Inherited
images and complex master objects are reported as unsupported.

```js
const layout = presentation.layouts.add("Title Body");
layout.placeholders.add({ type: "title", index: 0, geometry: "textbox",
  position: { left: 72, top: 64, width: 900, height: 80 } });
const slide = presentation.slides.add({ layout: "Title Body" });
slide.placeholders.getItem("title").text = "Market overview";

const nextStep = slide.shapes.add({ geometry: "rect", position: { left: 900, top: 240, width: 240, height: 100 } });
slide.shapes.connect(title, nextStep, { kind: "straight", fromSide: "right", toSide: "left", line: { fill: "#64748B", width: 2 }, head: { type: "arrow" } });

const master = presentation.masters.add("Brand Master");
master.setColorMap({ bg1: "bg2", tx1: "tx2", accent1: "accent2" });
master.background.ref = "bg1";
layout.setParentLayoutId(master.id);
slide.setLayout(layout);
```

Masters are editable local model records. Layouts keep their parent master ID;
the exporter writes the master color map and inherited background/artwork into
the generated PowerPoint master layer. `presentation.layouts.getById(master.id)`
resolves a master using the Codex-shaped lookup path.

## Editing by inspected ID

Slides and editable elements receive stable IDs for the lifetime of the model.
Use IDs from inspection results with `presentation.resolve()` and
`presentation.delete()`. `slides.keep()` accepts zero-based indexes or slide
IDs, `slides.reorder()` accepts every current slide ID in the new order, and
`slides.addCopy(slide)` duplicates an existing slide from the same deck.

```js
const selected = await presentation.inspect({
  select: "$.slides[*].elements[?(@.name == 'old-heading')]",
  include: ["id", "name", "text"],
});
const [heading] = presentation.resolve(selected.records.map((record) => record.id));
heading.text = "Updated heading";
presentation.delete(heading.id);
```

`slides.insert({ after, layout })` returns `{ slide, index }`. `after` accepts a
slide facade, a zero-based index, or `null`/omission to append. The local
selector supports slide and element selection, index lists, slices, recursive
descent, boolean comparison filters, and the `search`, `match`, `length`,
`count`, and `value` filter functions. It does not implement every RFC 9535
JSONPath construct.

`slide.autoLayout(shapes, options)` repositions existing editable shapes using
horizontal or vertical flow, a slide/shape/explicit frame, nine alignment
positions, pixel gaps, and horizontal/vertical padding. `"auto"` distributes
remaining main-axis space between items. The method returns the resulting
positions. All shapes must belong to the target slide.

`presentation.comments.setSelf()` and `comments.addThread()` create local review
threads targeting a slide, an editable element, a text range, or a text match.
Threads support replies, emoji reactions, resolve/reopen, `presentation.resolve`
by thread id, and `presentation.inspect({ kind: "thread" })`. For text-anchored
threads, `target: { id, beforeLines, afterLines }` adds matching text lines and
the requested surrounding lines to each result's `context` field. Comment data
is stored in Ruxex proto; it is not written to PPTX comment parts.

## Units and supported elements

- Slide dimensions, positions, line widths, and text `fontSize` use CSS pixels
  at 96 DPI. The exporter converts them to PowerPoint units.
- A new presentation defaults to 1280 × 720 px. Supply another positive
  `slideSize` for a custom canvas.
- `presentation.theme.defaultFont` sets the deck's default font, and assigning
  `presentation.theme.colorScheme = { name, themeColors }` defines named colors
  such as `accent1`, `bg1`, and `tx1`. Shapes, text, tables, backgrounds, and
  local previews resolve those tokens. The PPTX exporter writes the theme
  palette and imported presentations retain the basic theme font and color
  scheme; theme style inheritance is not reconstructed.
- Editable shape geometry includes `textbox`, the preset names exposed by
  PptxGenJS, and the aliases `roundRect`, `ellipse`, and `line`. The local SVG
  renderer draws `rect`, `roundRect`, `ellipse`, `line`, common polygons,
  arrows, and a five-point star; other preset previews fall back to a rectangle.
- Text can be assigned when creating a textbox or preset shape. Preset-shape
  text is written inside the PPTX shape and stays part of that editable object.
  `shape.text` accepts strings, string arrays, and structured run/paragraph
  arrays with basic bold, italic, underline, font, color, and hyperlink data.
  Handles expose
  `.text.style`, common whole-shape style setters, `.text.get(search)`,
  `.text.set(value)`, `.text.getRange(start, length)`, and
  `.text.replace(search, replacement)`. Text ranges from `.text.get(search)` or
  `.text.getRange(start, length)` support replacement and run styling for bold, italic,
  color, fill, and hyperlinks. Per-paragraph bullet, margin, indent, and spacing
  settings export and import. Internal slide-jump links use
  `{ uri: "slide:N", isExternal: false, action: "ppaction://hlinksldjump" }`.
  Other PowerPoint action types are not reconstructed.
  Imported run styles are retained for basic font, color, bold, italic, and
  underline attributes; external run hyperlinks are retained.
- `slide.tables.add({ rows, position })` (or `{ values, position }`) creates an editable rectangular table.
  Cell values may be strings, finite numbers, booleans, or `null`.
  Resolved tables support `getCell`, `cells.set`, `merge`, `unmerge`, and row
  and column insertion/deletion. `cells.block({ row, column, rowCount,
  columnCount })` exposes fill, mutable text style, per-edge borders, margins,
  vertical anchor, and horizontal overflow; `assign()` applies supported cell
  settings to the selected cells. `table.columns.get(index).width`,
  `table.rows[index].height`, `columnTracks` (`fr(2)`, `fixed(120)`, or
  `{ mode: "fr" | "fixed", value }`; import `fr` and `fixed` from the package),
  and `table.styleOptions` support editable sizing and common header/total/banding
  fills. `table.style` accepts a PowerPoint style identifier. Exact layout
  behavior for horizontal overflow is not implemented.
- `slide.images.add()` accepts `src`, `path`, `dataUrl`, inline `svg`, or
  `{ blob, contentType }` bytes with `position` and `alt`/`altText`. It embeds a
  local image file or data URI; HTTP URLs are not fetched. It also accepts
  `prompt`, external `hyperlink`, `rotation`, and horizontal/vertical flip
  options. PPTX import retains image geometry masks, crop, rotation, flip, alt
  text, and external hyperlink. `fit: "fill"`
  stretches into the box (the default);
  `fit: "contain"` preserves aspect ratio and centers the image in the box;
  `fit: "cover"` crops to fill the box. Numeric fractional, percentage, and
  pixel `crop` insets are supported.
  Cropped/cover exports keep the original picture object editable. `geometry`
  accepts PowerPoint preset shape names and clips the image to that shape;
  `borderRadius` accepts a pixel number or common rounded tokens for the local
  preview and PPTX roundRect adjustment. Other preset masks use the matching
  PowerPoint preset geometry. Prompt-only images can be regenerated with
  `image.regenerate({ kind })` when `Presentation.create({ imageGenerator })`
  receives a host callback. The callback receives the prompt plus `{ kind,
  position }` and returns local bytes or a data URL; the runtime does not
  provide Codex's built-in image generation service.
- `slide.charts.add(type, { categories, series, position, ...chartOptions })` creates an editable native
  chart using a PptxGenJS chart type. Series may share chart-level categories or
  provide their own labels, and values accept finite numbers or `null`. Common
  chart options pass through to PptxGenJS; per-series fills map to the chart's
  series palette.
  The resolved chart exposes `title`, `xAxis`, `yAxis`, `legend`, `dataLabels`,
  and `series.getItemAt(index)`; series values and labels can be edited. Global
  data-label settings inherit into series, and series settings override them;
  `series.dataLabelOverrides` can override individual point labels. Those
  settings apply to local bar/line previews and PPTX export. The local preview draws basic bar,
  line, and pie geometry, plus chart titles, basic category/value axes, ticks,
  gridlines, and legends. It does not reproduce native chart styling, complex
  chart families, or every axis/label option. Full typed chart option validation
  is not implemented.
- `slide.background.fill` accepts a FillConfig, including solid, pattern, and
  linear/path gradient fills. Fill configs can also be used as shape line fills;
  chart series and text styling currently accept solid color values only.
- `presentation.view` exposes `show/hide/toggleGridlines`, `show/hide/toggleGuides`,
  and `show/hide/togglePlaceholders`, plus grid-spacing fields. These values
  round-trip through Ruxex proto; guide visibility and grid spacing are written
  to PPTX view properties. Visible gridlines appear in the local preview.
  Hiding placeholders suppresses empty placeholder objects in the local preview
  and PPTX export; filled placeholders remain visible. They are materialized
  slide content, not inherited PowerPoint master placeholders.
- `slide.addNotes(string)` stores speaker notes in the PPTX.
- Shape fill, line fill, and text color accept six-digit hex colors, Ruxex theme
  colors, and Tailwind v4 color tokens such as `sky-500` or `slate-800`. Use
  `"none"` for no fill, or `"transparent"` for an editable transparent solid.
  Fill configs support `{type:"none"}`, structured rgb/theme colors with
  opacity/lighten/darken transforms, solid pattern fills, gradient colors, and
  image fills that reference an image element on the same slide. Pattern and
  image fills render in local previews and export to PPTX. Common local SVG
  pattern previews distinguish horizontal/vertical, diagonal, cross, grid, and
  dot-grid patterns; other pattern names use a diagonal-cross preview. Pattern
  fills are reconstructed by the PPTX importer. Imported image fill data and
  the shape's image reference are retained on reimport.
  Rectangular shapes also accept
  `borderRadius` and shadow tokens (`shadow-sm` through `shadow-2xl`) or custom
  shadows such as `2px 7px 19px #000000/17` are exported and basic shape radius
  and outer shadow metadata is imported. Position rotation/flip values are
  exported. Custom Bézier paths (`geometry: "custom"` with `customPaths`) and
  linear/path gradient shape and slide-background fills, including
  `linear(...)` and `radial(...)` strings with explicit or evenly distributed
  stop offsets, are editable in the local model and round trip through supported
  DrawingML path commands and sRGB color stops, including stop opacity. Color tokens support slash opacity and `+`/`-`
  lightness adjustments such as `sky-500/80` and `accent1+18/90`. `compose()`
  supports the structured node subset described above. Connectors accept `straight`, `elbow`,
  `elbow2` through `elbow5`, and `curved` routes, side anchors, and cardinal
  `fromIdx`/`toIdx` connection sites. Local previews route elbows and curves;
  PPTX export writes editable PowerPoint connection shapes with endpoint
  attachments and arrowheads. PowerPoint can route those connectors
  differently from the local preview. Connection indexes use four cardinal
  sites for each shape geometry, not PowerPoint's full preset-specific site
  list.
- `presentation.inspect()` with no options reports slide and object counts.
  The Codex-shaped query form accepts `select`, `include`, and `fileName`; the
  kind/search form accepts comma-separated object kinds, a case-insensitive
  text search, and a `maxChars` limit for its NDJSON output.
  Supported selectors include slide lists, slide fields, element collections,
  indexed elements, slices, recursive descent, and common filters. `include`
  accepts paths such as `elements.text` and `notes.text`; `fileName` writes
  selected records as NDJSON. IDs can be resolved back to editable objects.
  Standard JSONPath selection uses JSONPath-Plus, with local support for the
  Codex search/match/length/count/value filter helpers. This does not guarantee
  complete RFC 9535 conformance.
- `presentation.help(query, { search, include, maxChars })` searches a local API
  index and the built-in `title-slide`, `two-up`, and `agenda` templates.
  `presentation.template(name)` returns a cloned local template patch;
  `presentation.apply(template)` appends its editable starter slide. The local
  catalog does not load remote or user-specific templates.
- Inspection reports source-model content and geometry. It does not render
  text overflow. `presentation.render({ slide, format })` creates local PNG
  previews by default and supports SVG, JPEG, and WebP previews with a
  `.layout` JSON Blob. It supports slide selection or a montage.
  `presentation.export({ format: "pdf" })` creates a
  PDF with one rasterized page per selected slide; the PDF is a visual handoff,
  not an editable deck. The renderer
  covers the supported local text, basic shapes, tables, images, and chart
  models; it does not reproduce unsupported imported PPTX content.
  `slide.export({ format: "layout" })` returns the `openai.presentation.layout/v5`
  full view with slide bounds, editable element IDs, paragraph metadata, and
  table-cell formatting. It reports imported master and layout layers
  separately, with named layout placeholders and simple inherited rectangle,
  line, and text artwork as non-editable elements. It does not expose all
  inherited images, complex master artwork,
  or PowerPoint-computed text layout.
  `presentation.export({ format: "pptx" })` returns a PPTX Blob and
  `presentation.export({ format: "layout" })` returns layout JSON.
  `presentation.toProto()` and `Presentation.load(proto)` support the local
  `ruxex.presentation.proto/v1` format. Per-slide dimensions are retained in the model,
  but PPTX export requires all slides to match the deck size.

## Import and edit limits

`PresentationFile.importPptx(pathOrFileBlob)` and `Presentation.load(path)`
read text, basic run styles, external hyperlinks, and internal slide-jump links, shape geometry and
positions, simple tables with cell fills/borders, basic bullet/spacing metadata,
embedded PNG, JPEG, GIF, BMP, and SVG image assets, image placement/masks/crops,
speaker notes, and deck size, and return loss diagnostics for unsupported
content. Uneven table rows produced by merged-cell OOXML are padded for editing
and reported as a loss diagnostic. The diagnostic list is not a complete inventory of lost formatting.
They reconstruct common cached line, bar, pie, doughnut, and area charts, named
layouts and their placeholders, simple inherited rectangle, line, and text
objects from layouts and masters, supported custom paths, and sRGB gradient
fills. They do not reconstruct inherited images or complex master artwork,
arbitrary chart types, or arbitrary rich-text range semantics. When diagnostics are present, exporting requires
`{ acceptDiagnostics: true }` and can discard unsupported content. Treat
imports as content references unless the task explicitly accepts that loss.

The local command provides `pptx read` and `pptx validate`; use those for
read-only text inspection and package-structure checks. Printing the JSON save
result allows the Ruxex desktop to show its text-and-annotation preview, which
is not a pixel-accurate slide rendering. This facade does not create live
hosted artifacts.
