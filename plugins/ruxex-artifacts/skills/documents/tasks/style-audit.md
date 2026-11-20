# Audit DOCX Styles

Use the local helper to find paragraph/run-level formatting overrides, review
heading style usage, and inventory explicitly assigned fonts before applying a
template or normalizing a document.

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper style-lint \
  --input "/absolute/path/report.docx" --json
```

The command prints a JSON summary. It reads `word/document.xml` and does not
modify the package. `paragraphsWithDirectFormatting` counts paragraphs with
paragraph properties beyond a paragraph style; `paragraphsWithRunOverrides`
counts paragraphs with run formatting beyond a character style. Font inventory
counts explicit font assignments, not inherited theme fonts.

Use the report to locate likely inconsistencies, then review the rendered pages
and apply deliberate corrections with a compatible Word editor or recreate the
document using Ruxex's supported authoring options.

To clear direct run formatting overrides, write a separate copy:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper style-normalize \
  --input "/absolute/path/report.docx" \
  --output "/absolute/path/report-normalized.docx" --json
```

Add `--clear-paragraph-formatting` to also remove direct paragraph spacing,
indentation, alignment, and pagination controls while retaining paragraph
styles and numbering. Review and render the result; explicit formatting may
have been intentional. The helper does not copy template styles or normalize
inherited style definitions.
