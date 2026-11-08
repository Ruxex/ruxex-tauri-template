# Local Artifact CLI Design

## Intent

Provide a local, bundled command that an agent can call from a Skill to create
and validate office-style artifacts without requiring the user's machine to
have Python, Excel libraries, or other runtime dependencies installed.

## Goals

- Ship a `ruxex-artifacts` executable with the Tauri runtime package.
- Make it discoverable to agent shell commands through the existing
  `ruxex-path` PATH prepend.
- Implement an end-to-end first slice for XLSX creation, reading, and basic
  validation.
- Use machine-readable JSON on stdout and non-zero exit codes on failure.
- Keep the interface independent of App Server and App Server protocol types.
- Leave room for DOCX, PPTX, and PDF subcommands using the same CLI contract.

## Non-goals

- No App Server or protocol changes.
- No in-app artifact viewer in this slice.
- No runtime `pip install`, npm install, or network dependency resolution.
- No direct Excel application automation.
- No claim that every Excel feature is preserved; the initial XLSX contract
  supports portable cell data and basic workbook inspection.

## Architecture

The Tauri package contains a platform-specific `ruxex-artifacts` executable.
The agent sees it as a normal shell command because the runtime prepends
`ruxex-path` to the command environment. A Skill supplies the workflow and
invocation examples; the command owns file format generation and validation.

```text
Skill instructions
  -> agent shell command: ruxex-artifacts xlsx ...
    -> bundled Rust executable
      -> local input/output files
```

The command communicates through arguments, input JSON files, stdout JSON, and
exit status. It never emits binary artifact data through stdout.

## CLI contract

### Capabilities

`ruxex-artifacts capabilities --json` returns the supported command and format
names. This lets a Skill fail clearly when a package is incomplete.

### XLSX create

`ruxex-artifacts xlsx create --input <json> --output <xlsx> --json`

The input JSON contains a list of sheets. Each sheet has a name and a matrix
of scalar cell values: strings, numbers, booleans, or null. The command writes
the workbook to the requested output path and prints a JSON result containing
the resolved output path, format, sheet names, and row counts.

### XLSX read

`ruxex-artifacts xlsx read --input <xlsx> --json`

The command reads the supported scalar cell data and prints the same sheet and
matrix shape as JSON. Unsupported formulas or rich workbook features are
reported in diagnostics rather than silently rewritten.

### XLSX validate

`ruxex-artifacts xlsx validate --input <xlsx> --json`

The command verifies that the input is a readable XLSX workbook, reports sheet
names and dimensions, and exits non-zero with a structured diagnostic when the
file is missing, malformed, or not an XLSX workbook.

## Packaging

- Build `ruxex-artifacts` as a Tauri-side Rust binary for each supported target.
- Stage it as `ruxex-path/ruxex-artifacts` beside the existing `rg` helper.
- Extend the staging manifest and tests so a distributable runtime cannot omit
  the helper accidentally.
- Keep the Skill package independent from the binary's implementation language.

## Safety

- Treat input and output paths as explicit filesystem inputs; do not execute
  formulas, macros, or embedded code.
- Refuse missing paths and malformed JSON with non-zero exit status.
- Do not accept arbitrary command strings or dynamic package installation.
- Preserve the existing agent sandbox and approval model for file writes.

## Future extension

DOCX, PPTX, and PDF subcommands can reuse the same `capabilities`, JSON result,
diagnostic, and exit-code conventions. Their format libraries may be bundled
inside the same executable or split into additional platform helpers without
changing the Skill-facing command contract.
