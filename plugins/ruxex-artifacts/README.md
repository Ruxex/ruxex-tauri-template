# Ruxex Artifacts

This plugin provides four agent-facing Skills — `documents`, `presentations`,
`spreadsheets`, and `pdf` — backed by the shared bundled `ruxex-artifacts`
runtime helper. The helper exposes Ruxex-owned JavaScript APIs for DOCX, PPTX,
XLSX, and PDF creation and inspection, plus Codex-shaped `FileBlob`,
`SpreadsheetFile`, `PresentationFile`, and `PdfDocument` facades for local file
workflows. It also provides JSON read and validation commands for each format.

The helper is staged beside each Skill so the Skill can invoke it by absolute
path without relying on the managed command environment. The desktop syncs the
shared JS API and artifact runtime once beside the vendored Skill directories.
The plugin contains the workflow contract; the runtime resources ship with the
desktop package.

The runtime layout, build inputs, manifest, and install location are defined in
[`skills/RUNTIME.md`](skills/RUNTIME.md). Presentation tooling uses the bundled
Node.js runtime, a lock-built Python environment, and target-native LibreOffice
and Poppler assets. Skills invoke these through the sibling `ruxex-artifacts`
launcher and do not resolve tools from the host `PATH`.
The documents Skill routes local DOCX reading and review, creation and editing,
focused structure and accessibility audits, and core-properties metadata
cleanup. It also includes local workflows for page rendering and comparison,
styles and templates, comments and revisions, fields and navigation, redaction,
and constrained document merging. DOCX validation confirms package parts; the
structure audit reports a limited set of heading, image-alt, link-text, and
table-header findings. Neither is a complete Word or WCAG validator. The
desktop's DOCX SVG preview is content-oriented and does not reproduce Word
pagination or exact page layout.

The file facades are the canonical local file boundaries. Imports are bounded
and loss-aware: supported workbook, document, and presentation elements are
reconstructed, while unsupported content is retained as diagnostics instead of
being silently discarded. PDF imports are inspection-only and PDF generation
supports bounded text, tables, and local PNG/JPEG images.

For desktop conversations, printing the JSON result of `ArtifactOutput.save()`
lets the Tauri client offer bounded, paged local SVG previews for generated
XLSX, DOCX, PPTX, and PDF files. Preview rendering is native and does not
require Office, Python, Node, or a cloud service. The viewer can open the
source artifact or save a user-selected copy.
