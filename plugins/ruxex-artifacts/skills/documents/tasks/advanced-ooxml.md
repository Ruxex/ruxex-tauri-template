# Advanced OOXML Support

Ruxex provides a bounded local authoring and inspection surface, not a full
Word editor. Keep the original DOCX intact when a task depends on features that
the Ruxex model does not expose.

| Feature | Current handling |
| --- | --- |
| Paragraphs, title styles, headings, lists, and tables | Create; shallow read and rebuild of supported paragraphs/headings/tables. Imported formatting is not preserved. |
| Page, section, paragraph, run, and table formatting | Create with the documented `Document` options. Section breaks, page size/orientation/margins, headers/footers, and page numbers are supported for new files. |
| Images and hyperlinks | Create inline raster images with alternative text, bookmarks, internal links, and `http`/`https`/`mailto` links. Imported media and relationships are not preserved. |
| Comments and tracked changes | Create and inspect comments/revisions; update/resolve/strip classic comments and accept/reject common revision wrappers. The local helper anchors new classic comments to whole existing body paragraphs selected by index or substring; arbitrary character ranges, threaded comments, and full revision semantics are not implemented. |
| Footnotes and endnotes | Create notes anchored to an existing builder paragraph. Existing note parts are not preserved by shallow import. |
| Fields and TOC | Create TOC, `REF`/`PAGEREF`, and `SEQ`; inspect, update simple REF/SEQ cached values, and flatten fields. Page-number refresh and arbitrary/complex fields remain unsupported. |
| Content controls | Create tagged plain-text controls from exact `{{TAG}}` markers in ordinary top-level body paragraphs; list and fill plain-text controls with the local helper. Creation rejects split/nested markers and duplicate tags; other control types are not authored. See [Forms and content controls](forms-content-controls.md). |
| Template style transplant | Distill style/theme/page setup to Markdown and apply styles by ID; merge common numbering definitions with remapped IDs for imported styles. Picture bullets are refused; content-specific style references are not rewritten. See [Template styles](template-styles.md). |
| Watermarks | Create for new documents; add to one existing referenced header with the local helper, inspect, and remove classic VML text watermarks. Multiple headers require explicit selection; missing headers are not created. Other image/shape-based watermarks are not handled. See [Feature audit](feature-audit.md). |
| Protection | New documents can set edit-restriction modes and the helper can remove the documentProtection flag; neither operation encrypts the file. |
| Equations | Native OMML authoring is unavailable; image-based equations are supported through the image API and must include alternative text. |
| Accessibility and structure audits | Check heading-level skips, image alternative text, repeating table header rows, and unsupported OOXML diagnostics. This is not a complete WCAG audit. |
| Style audit | Reports direct paragraph/run formatting and explicit fonts; a separate helper clears selected direct overrides. |
| Exact Word pagination and floating layout | Not provided by the SVG content preview. Use the local page-image renderer for visual QA; verify Word-specific behavior in Word. |
| Version comparison | The local helper compares rendered page pixels and extracted main-document text; it is not a semantic OOXML diff. |
| DOCX table export | Extracts visible table cell text to CSV; spreadsheet styling and structure are not retained. |
| Merge | Append simple text, or copy body OOXML including tables with `merge_docx_append.py`, optionally after the first top-level paragraph containing `--after-marker`. Retains base package parts and final section properties; refuses relationship-backed content and does not reconcile styles, numbering, bookmarks, or fields. See [Merge documents](merge-documents.md). |
| XLSX-to-DOCX table import | Spreadsheet reader values can feed the DOCX table builder; formulas and spreadsheet formatting/features do not round-trip. |
| Full style synchronization | Not implemented; template application merges common numbering and remaps imported-style numbering IDs, but does not fully reconcile content-specific style references or cross-document dependencies. |

The local renderer helper uses LibreOffice and Poppler already available on
`PATH`; it does not install dependencies or call a hosted service. It may differ
from Microsoft Word. See [Render and verify](render-verify.md).

Do not export a loaded document with unsupported-content diagnostics unless the
user explicitly accepts the risk of losing unsupported structures. Do not
claim preservation of an unsupported feature. For exact rendering, verify the
file with a compatible Word renderer.
