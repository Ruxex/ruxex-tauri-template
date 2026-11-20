# Compare DOCX Versions

Use the local helper to compare extracted main-document text and corresponding
rendered page images. The source files are read-only.

```sh
"/absolute/path/to/skill/documents/ruxex-artifacts" python "/absolute/path/to/skill/documents/scripts/compare_docx.py" \
  --before "/absolute/path/before.docx" \
  --after "/absolute/path/after.docx" \
  --output-dir "/absolute/path/comparison" \
  --dpi 120
```

The output directory must be empty. It receives `comparison.json`, a unified `text.diff`, both
sets of page PNGs, and one difference PNG per page present in both versions.
No existing output is overwritten. The JSON records page counts, whether extracted paragraph text changed, and
mean absolute pixel differences. Install nothing: the helper uses the local
LibreOffice/Poppler renderer and uses Pillow for pixel differences when it is
already available.

This is a visual and plain-text comparison, not a semantic OOXML diff. It does
not compare comments, revision metadata, field instructions, styles, embedded
objects, or relationships. Review the actual pages and source structure before
concluding that the documents are equivalent.
