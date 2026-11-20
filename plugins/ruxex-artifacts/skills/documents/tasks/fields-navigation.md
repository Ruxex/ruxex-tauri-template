# Fields and Navigation

Ruxex authoring supports bookmarks, internal hyperlinks, heading-based TOCs,
`REF`/`PAGEREF` references, `SEQ` caption numbers, and footer page numbers. To
inspect or process existing simple and common complex fields, use:

```sh
ruxex-artifacts docx helper fields-process \
  --input "/absolute/path/document.docx" --operation inspect --json

ruxex-artifacts docx helper fields-process \
  --input "/absolute/path/document.docx" \
  --output "/absolute/path/document-updated.docx" \
  --operation update
```

`update` refreshes cached values for simple and complex `REF` and `SEQ` fields
in the main document, headers, and footers, using document order within each
part. It cannot recalculate page locations, so cached `PAGEREF` values stay
unchanged. To
flatten field codes and keep their current cached display text, use
`--operation flatten` with a separate output path.

To add captions to existing body tables and images, insert SEQ fields and
optional caption-number bookmarks:

```sh
ruxex-artifacts docx helper captions-insert \
  --input "/absolute/path/document.docx" \
  --output "/absolute/path/document-captioned.docx" \
  --tables --figures --bookmarks --json
```

SEQ fields begin with a cached value of `0`. Run `fields-process --operation
update` on the captioned file to calculate SEQ values in document order. The
helper targets top-level body tables and image paragraphs and skips captions
already immediately following the relevant item. To turn `[[REF:tbl1]]` markers
into cross-reference fields, add caption bookmarks and then run:

```sh
ruxex-artifacts docx helper reference-fields-insert \
  --input "/absolute/path/document-with-markers.docx" \
  --output "/absolute/path/document-with-refs.docx" --json
```

The marker must be within one `w:t` text node, and its bookmark must already
exist. Run `fields-process --operation update` afterward to refresh REF and
SEQ cached values. For static, page-number-free navigation, use:

```sh
ruxex-artifacts docx helper internal-nav \
  --input "/absolute/path/document.docx" \
  --output "/absolute/path/document-with-navigation.docx" \
  --levels 1 2 3 --toc-title "Table of Contents" --json
```

The navigation helper adds a static TOC, heading bookmarks, top/bottom anchors,
and Back to TOC links. It does not create a Word TOC field or page numbers.
To insert a dynamic Word TOC field at a placeholder paragraph containing only
`[[TOC]]`, use:

```sh
ruxex-artifacts docx helper toc-insert \
  --input "/absolute/path/document-with-toc-placeholder.docx" \
  --output "/absolute/path/document-with-toc-field.docx" \
  --levels 1-3 --json
```

The field requests an update when opened, but Word or a compatible editor must
rebuild its entries and page numbers.
To add a classic footnote or endnote to an existing DOCX, put a marker such as
`[[NOTE]]` at the desired location and use:

```sh
ruxex-artifacts docx helper note-insert \
  --input "/absolute/path/document.docx" \
  --kind footnote \
  --text "Source details." \
  --marker "[[NOTE]]" \
  --output "/absolute/path/document-with-note.docx" --json
```

Use `--kind endnote` for an endnote. If the marker is absent, the helper puts
the reference in a new paragraph at the end of the body. Only classic
footnote/endnote parts are handled.
Formulas, mail merge, and arbitrary Word field instructions are not recalculated.
Inspect and render the result before delivery; use Word for field types that
depend on pagination or external data.
