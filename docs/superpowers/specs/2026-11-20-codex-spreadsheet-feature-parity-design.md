# Codex-local spreadsheet feature parity

## Intent

Bring Ruxex's local spreadsheet workflow close to the installed Codex
Spreadsheets skill's supported local-file capabilities. The user has delegated
implementation choices and requests an independent subagent evaluation before
completion.

## Goals

- Cover local workbook creation, reading, editing, analysis, calculation,
  inspection, rendering, and validation at a level close to Codex's documented
  `@oai/artifact-tool` workflow.
- Support Excel workbook objects and interactions exposed by the Codex local
  API, including formulas, formatting, tables, PivotTables, charts, drawings,
  data validation, conditional formatting, comments/notes, sparklines, and
  native sensitivity tables where safe and verifiable.
- Provide safe import/edit/export behavior that preserves unsupported native
  OOXML content or reports a concrete limitation before destructive export.
- Keep all runtimes and dependencies bundled with Ruxex; never require a
  user-installed Python, Node.js, Office application, or package manager.
- Keep guidance split into concise feature/workflow/domain references and
  document the actual Ruxex capability and verification boundaries.
- Evaluate the finished changes with an independent subagent against this
  specification and the Codex-local capability inventory.

## Exclusions

- Google Sheets and its hosted APIs or routing.
- Codex live Excel control and OpenAI-hosted/backend-only services, tools,
  operation markers, and response citation directives.
- Copying or redistributing OpenAI's implementation or private artifacts.
- Claiming compatibility with every Excel feature beyond the documented Codex
  local surface and its documented limitations.

## Current state and baseline

- Ruxex uses its own `@ruxex/artifact-tool` JavaScript facade and a bundled Rust
  engine. The engine uses `calamine` for reading and `rust_xlsxwriter` for
  writing; this is not a from-scratch XLSX implementation.
- Current Ruxex calculation supports arithmetic, same-sheet A1 references,
  comparisons, and a small set of aggregate/logical functions. The current
  importer does not round-trip all styles, chart bindings, image content, or
  formula caches.
- Current Ruxex API exposes scalar ranges, basic formatting, merges, tables,
  and five basic chart types. `Workbook.render()` is unavailable.
- Codex local spreadsheet guidance is modular Markdown plus a JavaScript API
  guide. The installed skill contains no Python helper files; its single
  `.mjs` helper records an authoring operation. Python packages are optional
  analysis dependencies, not a collection of workbook-specific scripts.
- Ruxex already has modular domain, formula, chart, style, create, edit,
  read-only, and verification guidance. Preserve and extend this structure.

## Product behavior

1. Agents create a task-specific `.mjs` builder using the documented Ruxex API.
   The builder runs through the bundled `ruxex-artifacts` entrypoint and shared
   versioned runtime. The same API and engine back any focused reusable helper
   scripts; helpers must not implement a parallel XLSX stack.
2. The public API supplies the locally available workbook/range/worksheet,
   formula, formatting, table, drawing, inspection, trace, and file operations.
   Unsupported operations return structured errors/capability information.
3. `.xlsx` is the native editable format. CSV/TSV are importable source formats;
   `.xls` is supported as an import/source format where the bundled local
   converter can read it. Export remains `.xlsx` unless a Codex-local workflow
   explicitly supports another output.
4. Existing workbook edits preserve unsupported parts byte-for-byte when the
   edited workbook model can safely patch around them. Otherwise, import/export
   must fail with a structured explanation before writing a lossy replacement.
5. Formula text, formula evaluation, cached results, iterative calculation,
   and native data-table results are reported separately. An unevaluated
   formula is never represented as a successfully calculated zero.
6. Inspection covers workbook/sheet/range/formula/object state. Rendering uses
   the packaged local runtime and has a documented fidelity boundary.

## Approaches

1. **One generic CLI with guides only.** Smallest package surface, but it leaves
   repeated complex operations to model-generated code and cannot provide a
   useful programmable workbook API on its own.
2. **Many standalone Python utilities.** Reuses the shared Python runtime and
   suits bounded conversions, but duplicates workbook semantics and creates
   parallel import/export and dependency paths.
3. **Selected: shared Ruxex API/engine, modular implementation and guides,
   focused helpers only for stable workflows.** Reuse Rust XLSX crates and the
   managed Node/Python/native runtime. Keep one public operation model; add a
   focused helper only where it materially improves a repeatable workflow.

## Acceptance criteria

- A capability inventory maps every in-scope Codex local API/workflow surface
  to Ruxex support, an explicit documented limitation, or an excluded item.
- Automated tests cover the new API and engine behavior using real XLSX
  fixtures, including save/reopen behavior and meaningful failure cases.
- Core locally available operations have API contract tests; existing-workbook
  tests prove preservation or a pre-export refusal for unsupported features.
- The staged runtime contains and validates every new dependency; invoking the
  workflow does not use host `PATH` dependencies.
- Skill guidance routes users to focused references and never claims an
  unsupported feature is available or verified.
- `make rust-test`, Node artifact-tool tests, artifact runtime/package tests,
  and `git diff --check` pass. The installed/staged package is exercised.
- A subagent performs a read-only, line-by-line parity audit at the end. Any
  unmet in-scope capability is reported; completion is not claimed while a
  required feature remains unimplemented or unjustifiably excluded.
