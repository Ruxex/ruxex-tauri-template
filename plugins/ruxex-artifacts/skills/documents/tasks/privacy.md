# DOCX Privacy

Use `docx privacy-scrub` to remove listed document-level metadata. To mask
specific text, use the separate [text redaction helper](redaction.md) and review
its documented scope.

Use metadata scrubbing when a DOCX is leaving a private working context and its
standard document properties should not identify the author or editing history.

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx privacy-scrub \
  --input /absolute/input.docx \
  --output /absolute/output.docx \
  --json
```

The operation removes author, last-modifier, creation, modification, and
last-printed values from the DOCX core properties. It writes a separate output
file and retains other package parts. It does not inspect or remove names,
emails, comments, revision authors, hidden text, image metadata, or other
personal information embedded in document content.

Validate the result and run the structure audit. Review the source and output
paths before sharing the scrubbed copy.

To remove Word revision-session IDs (`w:rsid*` attributes) from the main
document, headers, footers, footnotes, and endnotes, make a separate copy with:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper rsid-strip \
  --input "/absolute/input.docx" \
  --output "/absolute/without-rsid.docx" --json
```

This handles the local OOXML parts inspected by the matching Codex helper. It
does not redact personal information from document text, custom properties,
comments, or embedded files.
