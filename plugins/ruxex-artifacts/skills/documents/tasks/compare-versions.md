# Compare DOCX Versions

Use the Rust helper to compare extracted main-document text and corresponding
rendered page images. The source files are read-only.

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper compare \
  --before "/absolute/path/before.docx" \
  --after "/absolute/path/after.docx" \
  --output-dir "/absolute/path/comparison" \
  --dpi 120 --json
```

The output directory must be empty. It receives `comparison.json`, a unified `text.diff`, both
sets of page PNGs, and one difference PNG per page present in both versions.
No existing output is overwritten. The JSON records page counts, whether extracted paragraph text changed, and
mean absolute pixel differences. The helper uses the local LibreOffice/Poppler
renderer and the Rust `image` crate for pixel differences.

This is a visual and plain-text comparison, not a semantic OOXML diff. It does
not compare comments, revision metadata, field instructions, styles, embedded
objects, or relationships. Review the actual pages and source structure before
concluding that the documents are equivalent.
