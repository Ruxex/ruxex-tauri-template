# Ruxex Artifacts

This plugin provides an agent-facing Skill for the bundled
`ruxex-artifacts` runtime helper. The helper exposes a Ruxex-owned JavaScript
workbook API for XLSX creation and inspection, plus a JSON validation command.

The helper is staged under `ruxex-path`, so the existing managed command
environment exposes it as a normal shell command. The plugin contains the
workflow contract; the JS API and format engine ship with the desktop runtime.
