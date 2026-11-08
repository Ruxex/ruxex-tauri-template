# Ruxex Artifacts

This plugin provides an agent-facing Skill for the bundled
`ruxex-artifacts` runtime helper. The helper exposes Ruxex-owned JavaScript
APIs for XLSX, DOCX, and PPTX creation and inspection, plus Codex-shaped
`FileBlob`, `SpreadsheetFile`, and `PresentationFile` facades for local file
workflows. It also provides JSON validation commands for each format.

The helper is staged under `ruxex-path`, so the existing managed command
environment exposes it as a normal shell command. The plugin contains the
workflow contract; the JS API and format engine ship with the desktop runtime.
The compatibility facades preserve the existing Ruxex methods and currently
make shallow XLSX/PPTX imports explicit rather than claiming full-fidelity
editing.
