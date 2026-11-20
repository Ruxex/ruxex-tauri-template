# DOCX Structure and Accessibility Audit

Run the local structure audit on a DOCX when its heading hierarchy, images, or
tables matter to readers using assistive technology.

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx audit --input /absolute/input.docx --json
```

The audit reports findings for heading-level skips, images without alternative
text, tables without a marked header row, and generic hyperlink text such as
“click here.” Each finding identifies its code, severity, package part, and
message. Review findings in context before changing the document.

This is a focused structural check, not a complete WCAG conformance assessment
or a replacement for testing with assistive technology. The audit also reports
advanced document content it cannot evaluate, such as fields, headers and
footers, comments, tracked changes, and footnotes.

Validate the DOCX package separately. A valid OOXML package can still contain
accessibility issues or unsupported content.

For the same mechanical fixes offered by the Codex Documents helper, create a
separate copy with filename-based image alternative text and/or the first row
of each table marked as a repeating header:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper a11y-fixes \
  "/absolute/input.docx" \
  --fix_image_alt from_filename \
  --fix_table_headers first_row \
  --out "/absolute/fixed.docx" --json
```

Filename-based text is only a placeholder; review it and replace it with a
useful description when the image conveys information. Mark a first row as a
header only when it actually labels the table columns.
