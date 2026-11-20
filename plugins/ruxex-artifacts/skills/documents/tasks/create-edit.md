# Create and Edit a DOCX

Use the bundled JavaScript facade for new documents and supported local edits.

## Create

1. Identify the reader, purpose, expected action, and any supplied reference
   document.
2. If a template or reference DOCX controls the result, inspect it first and
   preserve its structure and style where supported. Do not silently rebuild a
   template-based document from generic defaults.
3. Check available operations and formatting options with
   `"/absolute/path/to/skill/ruxex-artifacts" capabilities --json` and write a
   builder that imports `Document` from `@ruxex/artifact-tool`.
4. Add a descriptive title and an opening that explains scope and purpose,
   followed by connected paragraphs and tables only where
   readers need to compare repeated values. Lead with the conclusion, decision,
   or request. Avoid inventing facts or commitments.
5. Export, validate, run the DOCX audit, and inspect the Ruxex content
   preview. For page-level layout correctness, use a compatible Word renderer.

```js
import { Document } from "@ruxex/artifact-tool";

const document = await Document.create({
  title: "Project Report",
  pageSize: "letter",
  orientation: "portrait",
  margins: { top: 1, right: 1, bottom: 1, left: 1 },
});
document.addTitle("Project Report");
document.addSubtitle("Delivery status and next steps");
document.addHeading("Summary", 1);
document.addParagraph("The project is ready for review.", {
  alignment: "left",
  spacingAfter: 8,
  fontFace: "Arial",
  fontSize: 11,
  color: "000000",
});
document.addListItem("Review the package", { type: "bullet" });
document.addListItem("Approve delivery", { type: "numbered" });
document.addBookmark("summary", "Summary");
document.addInternalLink("Jump to summary", "summary");
document.addExternalLink("Project source", "https://example.test/project");
document.addTable(
  [["Area", "Status"], ["Documents", "Ready"]],
  { headerRow: true, borders: true, cellPadding: 6 },
);
document.addParagraph("The project is ready for review.");
document.addComment(10, "Confirm the approval date before delivery.");
document.addFootnote(10, "Status source: project tracker.");
document.addTrackedReplacement("draft wording", "approved wording");
document.addSection({ pageSize: "a4", orientation: "landscape" });
document.setHeader("Appendix");
document.setFooter("Internal", { pageNumber: true });
document.setWatermark("DRAFT", { color: "888888", opacity: 0.25 });
document.setProtection({ type: "readOnly", password: "review" });
document.addPageBreak();
document.addImage(imageBytes, {
  type: "png",
  width: 320,
  height: 180,
  altText: "Status chart showing completion by workstream",
});
await document.exportDocx("/absolute/path/report.docx");
```

The methods above author new content. `addComment(paragraphIndex, text)` and
`addFootnote(paragraphIndex, text)` anchor to an existing `addParagraph` item;
indices are zero-based in `document.items`. `addEndnote` uses the same anchor
rule. `addTrackedReplacement(oldText, newText)` creates one tracked deletion and
insertion as a new paragraph. These helpers do not locate and patch arbitrary
text in an imported DOCX.

## Edit an existing document

Load with `Document.load(path)` and inspect the result before changing it. The
current model covers supported text, headings, and tables. If `editable` is
false or diagnostics report unsupported content, preserve the source and do not
export a replacement unless the user accepts the possible loss. Keep edits
local and retain the original structure when practical.

For text substitutions that should preserve the original DOCX package and run
formatting, use the targeted OOXML replacement helper:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper text-replace \
  --input "/absolute/path/source.docx" \
  --output "/absolute/path/source-edited.docx" \
  --replace "draft=final" --json
```

Each replacement spans one paragraph at most. It preserves the starting run's
format for the replacement and retains surrounding run boundaries. Paragraphs
containing fields, comments, tracked changes, bookmarks, links, drawings, tabs,
or line breaks are skipped when the requested text occurs there; inspect the
reported `skippedMatches` entries. Use `--all` to replace every eligible non-overlapping
match. For structural additions, create supported content with `Document` and
append body paragraphs or tables with [Merge documents](merge-documents.md), or
use the focused helper for that Word feature.

For local formatting changes and simple table-cell edits while keeping the
existing DOCX package, pass a JSON operation list to the Python helper:

```json
[
  {"op":"format_paragraph","contains":"Executive summary","style":"Heading 1","alignment":"left","spacingAfter":160,"keepWithNext":true},
  {"op":"format_run","contains":"decision-ready","bold":true,"color":"2E5D8A"},
  {"op":"format_paragraph","part":"header1","contains":"Project report","alignment":"right"},
  {"op":"format_run","part":"footer1","contains":"Internal","italic":true},
  {"op":"replace_table_cell_text","tableIndex":0,"row":1,"column":2,"text":"Ready","alignment":"center"},
  {"op":"replace_table_rows","tableIndex":1,"rows":[["Item","Status"],["Review","Ready"]]},
  {"op":"append_table_row","tableIndex":1,"values":["Delivery","Pending"]},
  {"op":"insert_paragraph_after","contains":"Next steps","text":"The review is complete.","style":"Normal"},
  {"op":"insert_table_after","contains":"Appendix","rows":[["Item","Status"],["Review","Ready"]],"headerRow":true,"columnWidthsDxa":[4000,5000],"style":"TableGrid"},
  {"op":"set_section_layout","sectionIndex":0,"orientation":"landscape","marginsDxa":{"top":1440,"bottom":1440,"left":1440,"right":1440}}
]
```

```sh
"/absolute/path/to/skill/documents/ruxex-artifacts" python "/absolute/path/to/skill/documents/scripts/edit_docx_content.py" \
  "/absolute/path/source.docx" \
  --out "/absolute/path/source-edited.docx" \
  --operations-file "/absolute/path/operations.json"
```

`part` defaults to `"document"`. `format_paragraph`, `format_run`, and
`replace_table_cell_text` also accept an existing `"headerN"` or `"footerN"`
part (N starts at 1), such as `"header1"`. These select ZIP parts
`word/header1.xml` and `word/footer1.xml`, not section numbers. Inspect section
relationships first when multiple sections share a header or footer; editing
that part changes every section that references it. Missing parts are rejected;
this helper does not create headers, footers, or their relationships. Other
operations target the main document only.

Paragraph targets must match exactly once among the selected part's top-level
paragraphs. `format_run` requires its text
to occur exactly once inside one simple run. Table edits are limited to simple
unmerged cells without fields, comments, revisions, links, drawings, or nested
tables. The helper preserves paragraph properties and the first run's
formatting when replacing a simple cell value; it rejects unsupported cells.
`tableIndex`, `row`, `column`, and `sectionIndex` are zero-based. Table indexes
refer to direct tables in the selected part, excluding nested tables.

For existing simple body tables, `replace_table_rows` accepts a nonempty
rectangular `rows` array of string cells. It replaces all rows, allowing row
insertion, deletion, and reordering through the supplied complete values.
`append_table_row` accepts one `values` array of strings. Both require exactly
the existing column count and an explicit matching `tblGrid`; they preserve
the table properties, column grid, and cell widths. Column insertion/deletion
and merged tables are unsupported. Existing row positions retain their row,
cell, first paragraph, and first run formatting; extra rows clone the last
existing row, removing its repeating-header flag. Cell text becomes one plain
paragraph. Use `replace_table_cell_text` for a narrower change.

Structural table operations reject relationships, foreign XML, merges, fields,
comments, bookmarks, revisions, links, drawings, nested tables, content
controls, row grid offsets, numbering, section properties, and non-text run
content. They never silently rebuild complex tables. Section dimensions and
margins use DXA units. Operations run in list order against isolated in-memory
parts; every operation and serialization must succeed before output is
written. On failure the source stays unchanged and no output is created.
Unedited ZIP parts retain their original bytes. Existing outputs are never
overwritten.

## Formatting options

- `Document.create({ pageSize, orientation, margins })`: `pageSize` accepts
  `"letter"` or `"a4"`; `orientation` accepts `"portrait"` or `"landscape"`;
  `margins` uses 0-3 inches for `top`, `right`, `bottom`, and `left`.
- `addParagraph(text, options)`: `alignment` accepts `"left"`, `"center"`,
  `"right"`, or `"justify"`; `spacingBefore` and `spacingAfter` use 0-1000
  points; `fontFace` is a font name; `fontSize` uses 1-96 points; `color` is a
  six-digit hex color; `bold`, `italic`, `keepWithNext`, and `pageBreakBefore`
  are booleans.
- `addTitle(text)` and `addSubtitle(text)` apply Word's built-in title styles.
  `addListItem(text, { type })` supports single-level `"bullet"` and
  `"numbered"` items. `addPageBreak()` starts a new page before following
  content.
- `addImage(data, options)` accepts PNG, JPEG, GIF, or BMP bytes up to 16 MiB,
  dimensions from 1 to 4000 pixels, and requires non-empty `altText` unless
  `decorative: true` is set.
- `addSection({ pageSize, orientation, margins, type })` starts a section.
  `type` supports `nextPage`, `nextColumn`, `continuous`, `evenPage`, and
  `oddPage`. `setHeader(text)` and `setFooter(text, { pageNumber })` affect the
  current section.
- `setWatermark(text, options)` adds a repeating Word-compatible text
  watermark to the current section. Options include font, size, color, opacity,
  layout, and rotation. It does not edit or remove watermarks in imported files.
- `setProtection({ type, password })` adds document editing protection to a
  newly created file. Types are `readOnly`, `comments`, `trackedChanges`, and
  `forms`. The optional password is limited to 15 characters. This is an editing
  restriction, not encryption; it does not prevent other tools from reading or
  changing the DOCX.
- `addBookmark(name, text)`, `addInternalLink(text, bookmark)`, and
  `addExternalLink(text, URL)` create basic navigation. External links are
  limited to `http`, `https`, and `mailto`.
- `addTableOfContents({ title, headingStyleRange, hyperlink })` inserts a Word
  TOC field based on heading styles. Word may need to update the field to refresh
  page numbers after layout changes.
- `addReferenceField(bookmark, { pageNumber, cachedText })` inserts a `REF` or
  `PAGEREF` field for a bookmark created earlier in the builder. Word may need
  to refresh field results after editing or pagination changes.
- `addSequenceField(label, { cachedText })` inserts a `SEQ` field for a caption
  label such as `Figure` or `Table`. Word recalculates the sequence when fields
  are updated.
- `addComment(paragraphIndex, text, { author, initials, date })` anchors a
  comment to the complete paragraph. `addTrackedReplacement(oldText, newText,
  { author, date })` creates an insertion/deletion pair in a new paragraph.
- `addFootnote(paragraphIndex, text)` and `addEndnote(paragraphIndex, text)`
  attach notes to an existing paragraph item.
- `addTable(rows, options)`: `headerRow` and `borders` are booleans;
  `cellPadding` uses 0-72 points. `columnWidths`, `width`, and `indent` use
  inches (`columnWidths` must match the table's column count); `layout` accepts
  `"fixed"` or `"autofit"`.

Unsupported option names and invalid values should return a structured error.
The underlying DOCX library's defaults apply when an option is omitted.

## Finish

Run package validation and the DOCX audit. Inspect the local content preview
where available, then report the output path and any unsupported-content or
audit findings. Do not claim Word-accurate pagination from the Ruxex preview.
