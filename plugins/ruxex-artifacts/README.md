# Ruxex Artifacts

This plugin provides an agent-facing Skill for the bundled
`ruxex-artifacts` runtime helper. The helper exposes Ruxex-owned JavaScript
APIs for XLSX, DOCX, and PPTX creation and inspection, plus JSON validation
commands for each format.

The helper is staged under `ruxex-path`, so the existing managed command
environment exposes it as a normal shell command. The plugin contains the
workflow contract; the JS API and format engine ship with the desktop runtime.
