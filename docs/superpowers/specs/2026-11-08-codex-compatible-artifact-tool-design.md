# Codex-compatible local artifact tool

## Intent

Make Ruxex's local spreadsheet workflow feel like the Spreadsheet workflow
available to Codex without redistributing OpenAI's artifact implementation.
The LLM-facing surface should be a JavaScript workbook API and Skill; all
runtime dependencies must ship with Ruxex so users do not install Node.js,
Excel, or spreadsheet libraries.

## Current state

The first artifact slice already contains a Rust `ruxex-artifacts` binary that
creates, reads, and validates scalar XLSX data through a JSON command. It is
staged beside `rg` under `ruxex-path`. That implementation becomes the engine
layer and is not the final LLM-facing interface.

## Goals

- Provide a Codex-shaped JavaScript API owned by Ruxex.
- Keep the existing `ruxex-path` command discovery model.
- Bundle the Node.js runtime and all JS dependencies in the Tauri runtime
  package; never require user-installed Node.js or npm packages.
- Reuse the existing Rust XLSX implementation behind a private operation
  protocol.
- Preserve machine-readable diagnostics and explicit output paths.
- Let the Skill guide the model through create/edit, recalculate, inspect,
  preview, and export steps.
- Keep App Server and protocol code unchanged.

## Non-goals

- Do not copy or redistribute `@oai/artifact-tool` or its implementation.
- Do not promise byte-for-byte compatibility with Codex's private runtime.
- Do not automate a desktop Excel installation.
- Do not make the first release implement every Excel feature.
- Do not expose the private Rust operation protocol as the primary Skill API.

## Selected approach

Use a JavaScript facade over a Rust engine.

```text
Spreadsheet Skill
  -> bundled Node.js
    -> Ruxex-owned JavaScript workbook API
      -> private JSON operation protocol
        -> Rust XLSX engine
          -> local .xlsx / preview / diagnostics
```

The public API mirrors Codex concepts, not OpenAI package names:

```js
const workbook = await Workbook.create();
const sheet = workbook.worksheets.add("Summary");

sheet.getRange("A1:B2").values = [
  ["Name", "Count"],
  ["Ada", 3],
];

workbook.recalculate();
await workbook.inspect({ kind: "sheet", sheetName: "Summary" });
await workbook.exportXlsx("/absolute/path/report.xlsx");
```

The exact method names are Ruxex-owned and may differ where the underlying
engine cannot provide a safe equivalent. The Skill documents supported
operations and requires post-generation inspection and validation.

## Runtime packaging

The staged package will contain:

- `ruxex-path/ruxex-artifacts`: the stable agent-facing launcher.
- `ruxex-path/ruxex-artifacts-engine`: the private Rust engine executable.
- `ruxex-resources/node/`: a platform-specific Node.js runtime.
- `ruxex-resources/ruxex-artifact-tool/`: Ruxex-owned JS API and launcher
  scripts.

The launcher resolves resources relative to the installed package and invokes
the bundled Node executable. It must not use the host's `node`, `npm`, or
`node_modules`.

## Public API layers

### Workbook lifecycle

- `Workbook.create()` creates a workbook.
- `Workbook.load(path)` reads an existing supported workbook.
- `workbook.worksheets.add(name)` adds a worksheet.
- `workbook.worksheets.getItem(name)` retrieves a worksheet.
- `workbook.recalculate()` refreshes supported formulas.
- `workbook.inspect(options)` returns structured workbook diagnostics.
- `workbook.render(options)` returns a preview artifact when supported.
- `workbook.exportXlsx(path)` writes the final workbook.

### Worksheet and range operations

- `sheet.getRange("A1:C4")` selects a range.
- `range.values` reads or writes scalar values.
- `range.formulas` reads or writes supported formulas.
- `range.format` carries supported basic formatting.
- Unsupported operations fail explicitly with a structured diagnostic; they
  are never silently discarded.

### Private engine protocol

The JS facade sends a versioned JSON request to the Rust engine. The protocol
contains workbook operations, not arbitrary shell commands. Each response is
JSON with either `ok: true` and a result or `ok: false` and an error object.
The protocol is local to the bundled helper and is not an App Server protocol.

## Implementation phases

### Phase 1: facade and existing engine bridge

- Add a bundled-resource resolver and launcher.
- Move the current Rust implementation behind an explicit engine entrypoint.
- Implement `Workbook.create`, worksheet/range values, `inspect`,
  `recalculate` as the supported lifecycle, and `exportXlsx`.
- Keep the current JSON create/read/validate commands as engine fixtures and
  compatibility tests.
- Update the Skill to author a `.mjs` builder and run it with the bundled
  runtime.

### Phase 2: Codex-shaped workbook features

- Add formulas and supported formula evaluation.
- Add basic number formats, fonts, fills, alignment, and column widths.
- Add richer inspection for formula errors and used ranges.
- Add preview rendering with a bundled renderer or a clearly bounded fallback.

### Phase 3: broader artifact coverage

- Add tables, charts, images, and other workbook objects only after the
  operation model and validation rules are stable.
- Reuse the same Skill and launcher model for DOCX, PPTX, and PDF helpers.

## Safety and compatibility

- The Skill and launcher use only package-relative resources.
- File paths are explicit and remain subject to the existing agent sandbox and
  approval model.
- Workbook content is data; formulas and macros are not executed by a desktop
  application.
- The engine reports unsupported values and operations instead of coercing
  them silently.
- App Server, generated protocol types, and host process contracts are not
  modified.

## Alternatives considered

1. JS engine end-to-end: closest to Codex but duplicates a substantial
   spreadsheet, formula, and rendering engine and increases risk and package
   size.
2. Rust-only high-level JSON: smallest runtime, but the LLM-facing interface
   would not resemble the Codex workbook API.
3. JavaScript facade over Rust engine: selected because it preserves the
   Codex-shaped authoring experience while reusing the existing native XLSX
   implementation and keeping dependencies bundled.
