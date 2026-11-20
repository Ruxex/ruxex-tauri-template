# Merge Simple DOCX Text

Append text paragraphs from one document to the end of a base DOCX:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper merge-text \
  --base "/absolute/path/base.docx" \
  --append "/absolute/path/appendix.docx" \
  --output "/absolute/path/combined.docx" --json
```

The helper writes a new file, keeps the base document's section properties and
package parts, and appends simple paragraphs from the second document. For
paragraph and table body elements with no relationship-backed content, use the
OOXML append helper:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper merge-append \
  --base "/absolute/path/base.docx" \
  --append "/absolute/path/appendix.docx" \
  --output "/absolute/path/combined.docx" --json
```

It keeps the base document's final section properties and appends the other
document's body elements. It refuses images and other relationship-backed
content because their package dependencies and cross-document style, numbering,
bookmark, and field references are not reconciled. Review the order and render
the combined file before delivery.

To place the appended body after a specific top-level paragraph, add
`--after-marker "text in the paragraph"`. If the marker is not found, the helper
fails without creating the output file.
