# Audit DOCX Features

Use the read-only helper to inspect common OOXML features before editing or
sharing a document:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper audit-features \
  --input "/absolute/path/document.docx" --json
```

The JSON report lists section geometry and header/footer references, image
alternative text, simple and complex field instructions, comment/note counts,
table geometry (row cell widths, grid agreement, margins, and indent), section
start types and header/footer linkage indicators, note reference/definition
consistency with text snippets, VML text watermarks, and editing protection
settings. Header/footer linkage is inferred from the absence of an explicit
reference after the first section. It also reports heading skips, missing image
alt text, unmarked table headers, and weak/raw-URL links across the main
document, headers, and footers. Use `docx audit` for package validation and
unsupported-content diagnostics.

This is a focused inspection of common OOXML parts, not a full accessibility,
security, or Word compatibility audit. It does not change the document.

To set or clear a non-password editing restriction on a separate copy:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper protection-set \
  --input "/absolute/path/document.docx" \
  --mode readOnly \
  --output "/absolute/path/document-read-only.docx" --json
```

`--mode` accepts `off`, `readOnly`, `comments`, `trackedChanges`, or `forms`.
These are editing restrictions, not password protection or encryption.

To add a classic VML text watermark to an existing referenced header:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper watermark-add \
  --input "/absolute/path/document.docx" \
  --output "/absolute/path/document-watermarked.docx" \
  --text "CONFIDENTIAL" \
  --header-part "word/header1.xml" --json
```

Omit `--header-part` only when exactly one header part is referenced by the
main document. Select a path reported by the feature audit, including the
`word/` prefix. Missing, external, unreferenced, or malformed header targets
are rejected. The helper does not create headers, add section references, or
change other header parts. A shared header affects every section using it;
first-page, even-page, and other section headers may need separate copies and
explicit operations. An existing watermark is retained; adding appends another.

This writes a separate DOCX, refuses existing outputs, and changes only the
selected header XML payload. Other ZIP entry payloads, metadata, order, and
archive comment are retained; the ZIP container is rebuilt. VML text rendering
varies between Word and LibreOffice. Audit the result and render every page to
verify appearance and coverage.

To remove detected VML text watermarks or editing protection from a separate
copy, use:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper publishing-controls-remove \
  --input "/absolute/path/document.docx" \
  --output "/absolute/path/document-without-watermark.docx" \
  --kind watermark --json
```

Use `--kind protection` to remove the editing restriction. Neither operation
removes encryption or other forms of document protection, and watermark
removal handles classic VML text watermarks only. Audit and render the output.
