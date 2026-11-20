# Render and Verify a DOCX

Use page images to review pagination, tables, headers and footers, image
placement, and visual hierarchy after creating or editing a document.

## Render

The helper uses the shared bundled Python, LibreOffice, and Poppler runtime.
It writes PNGs without changing the source DOCX and does not call a hosted
service. Invoke it through the skill's sibling `ruxex-artifacts` executable so
it receives the managed runtime paths.

```sh
"/absolute/path/to/skill/documents/ruxex-artifacts" python \
  "/absolute/path/to/skill/documents/scripts/render_docx.py" \
  --input "/absolute/path/report.docx" \
  --output-dir "/absolute/path/rendered-report" \
  --dpi 150
```

The command prints one path per page. `--dpi` accepts 72–600 and defaults to
150. Add `--keep-pdf` to retain the intermediate PDF. The output directory may
exist, but page images with colliding names are not overwritten. The helper
renders a temporary copy and normalizes legacy backslash ZIP entry names when
needed; it never rewrites the source DOCX.

The helper resolves `soffice`, `pdfinfo`, and `pdftoppm` from
`RUXEX_RUNTIME_BIN_DIR`; it never searches the host `PATH`. If a bundled tool is
missing, report that visual pagination could not be checked and identify the
missing runtime asset.

If conversion fails, first run `docx validate` and inspect the converter error.
If page rasterization times out, retry at a lower DPI. A conversion timeout or
unsupported feature may require a compatible Word editor; report the limit
instead of claiming the page layout was verified.

## Review every page

- Inspect every page at readable scale, including the first and last pages.
- Check for clipped or orphaned text, blank pages, broken table rows, headers
  or footers colliding with body content, missing image descriptions, and
  inconsistent spacing or heading hierarchy.
- Compare the page images with the source/template when one was supplied.
- Re-render after layout changes. Keep the generated images with the review
  artifacts when they help explain a decision.

LibreOffice rendering is a local approximation of Microsoft Word. Verify in
Word when a deliverable depends on Word-specific fields, fonts, pagination, or
floating-object behavior.
