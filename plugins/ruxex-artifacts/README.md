# Ruxex Artifacts

This plugin provides an agent-facing Skill for the bundled
`ruxex-artifacts` runtime helper. The helper exposes Ruxex-owned JavaScript
APIs for XLSX, DOCX, and PPTX creation and inspection, plus Codex-shaped
`FileBlob`, `SpreadsheetFile`, and `PresentationFile` facades for local file
workflows. It also provides JSON validation commands for each format.

The helper is staged under `ruxex-path`, so the existing managed command
environment exposes it as a normal shell command. The plugin contains the
workflow contract; the JS API and format engine ship with the desktop runtime.
The file facades are the canonical XLSX/PPTX file boundaries. They currently
make shallow XLSX/PPTX imports explicit rather than claiming full-fidelity
editing; the `Workbook` and `Presentation` objects stay focused on in-memory
editing.

For desktop conversations, printing the JSON result of `ArtifactOutput.save()`
lets the Tauri client offer a bounded local SVG preview for generated XLSX
files. Preview rendering is native and does not require Office, Python, Node,
or a cloud service; it reads scalar worksheet values only.
