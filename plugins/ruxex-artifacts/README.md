# Ruxex Artifacts

This plugin provides four agent-facing Skills — `documents`, `presentations`,
`spreadsheets`, and `pdf` — backed by the shared bundled `ruxex-artifacts`
runtime helper. The helper exposes Ruxex-owned JavaScript APIs for DOCX, PPTX,
XLSX, and PDF creation and inspection, plus Codex-shaped `FileBlob`,
`SpreadsheetFile`, `PresentationFile`, and `PdfDocument` facades for local file
workflows. It also provides JSON read and validation commands for each format.

The helper is staged under `ruxex-path`, so the existing managed command
environment exposes it as a normal shell command. The plugin contains the
workflow contract; the JS API and format engine ship with the desktop runtime.
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
