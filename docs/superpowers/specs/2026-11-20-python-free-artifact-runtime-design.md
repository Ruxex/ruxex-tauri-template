# Python-free artifact runtime design

## Goal

Remove CPython and all Python packages from Ruxex's shipped shared artifact
runtime while preserving the current skill workflows. Move the Skills' Python
helpers into the existing `ruxex-artifacts` Rust CLI. Keep LibreOffice and
Poppler as shared native resources for Office-file page previews.

The Python runtime stays in the package only while an installed Skill still
needs it. Remove that runtime foundation after Documents and Presentations no
longer invoke Python and all four Skills pass the no-Python contract.

## User intent

- The installed Ruxex application should not bundle a Python interpreter or
  Python libraries.
- DOCX, presentation, spreadsheet, and PDF workflows should be considered
  together so a remaining Skill does not keep the shared Python runtime alive.
- Excel implementation work is in progress. Its implementation files are out
  of scope until that work is complete; this design only records and later
  verifies the existing no-Python boundary.

## Current state

- `runtime/python/` pins CPython 3.12.14, uv 0.13.5, and
  `lxml`, `numpy`, Pillow, `pdf2image`, and `python-pptx`.
- Documents has 35 Python helper files. The OOXML helpers primarily use the
  Python standard library. `render_docx.py` uses `pdf2image`; `compare_docx.py`
  uses Pillow.
- Presentations has 12 Python helper files. Shared helper code imports
  `python-pptx`; contact-sheet generation uses Pillow. Slide rendering calls
  the native tools directly.
- Spreadsheets has no Python helper files. Its JavaScript preview path invokes
  LibreOffice to convert XLSX to PDF and Poppler to rasterize the page.
- PDF has no Python helper files and uses the JavaScript PDF API.
- LibreOffice is used by DOCX, PPTX, and XLSX preview rendering. Poppler turns
  their intermediate PDFs into page images. Neither tool is a Python library.
- The Rust artifact CLI already supports DOCX, PPTX, XLSX, and PDF commands and
  uses ZIP/OOXML and image crates. DOCX command support is partial, so migration
  must add helper parity rather than remove the Python path prematurely.

## Approaches considered

1. **Embed Python and its packages in the Rust executable.** This changes how
   assets are packaged but retains CPython and third-party package dependencies
   and still needs target-specific builds. It does not meet the goal.
2. **Move helper behavior to the existing Node runtime.** This avoids Python,
   but duplicates document-package and image handling across runtimes and may
   add JavaScript dependencies.
3. **Move helper behavior to the existing Rust CLI (selected).** This uses the
   package/OOXML and image infrastructure already present in Ruxex, gives the
   Skills one native helper entry point, and removes the Python runtime instead
   of concealing it. It requires careful feature-by-feature OOXML fidelity
   tests.

## Per-skill migration plan

### Documents

- Port the 35 Python helper commands to typed Rust CLI subcommands. Preserve
  their documented input/output behavior, JSON reports, overwrite protections,
  validation, and package-preservation guarantees.
- Group work into OOXML inspection/audits, comments and revisions, fields and
  navigation, content and table editing, privacy/protection, template fidelity,
  and rendering/image comparison.
- Replace `pdf2image` with the already-bundled `pdftoppm` command after
  LibreOffice produces the intermediate PDF. Replace Pillow image comparison
  with the Rust image crate.
- Add golden and adversarial DOCX fixtures for unknown parts, relationships,
  malformed ZIP/XML, and failed writes before removing each Python helper.

### Presentations

- Port the 12 Python helpers to `ruxex-artifacts pptx` subcommands while
  preserving JSON output and existing quality-gate semantics.
- Replace `python-pptx` inspection and starter-deck edits with Rust OOXML
  operations. Preserve slide layouts, placeholders, notes, charts, tables,
  relationships, and unsupported parts unless a command explicitly edits them.
- Replace Pillow contact-sheet generation with the Rust image crate.
- Keep `render_slides` behavior by exposing the current LibreOffice/Poppler
  preview path through the Rust CLI or retaining its equivalent JavaScript
  implementation without Python.

### Spreadsheets

- Do not modify in-progress Excel implementation files as part of this work.
- After the active Excel work is complete, add contract tests proving its
  workflows call only the existing JavaScript/Rust runtime and native preview
  tools, with no Python executable, helper, or package dependency.
- LibreOffice and Poppler remain required for workbook page previews.

### PDF

- No helper migration is needed: the Skill has no Python scripts today.
- Add a contract test confirming PDF create/read/validate workflows stay on the
  JavaScript/Rust path and do not require CPython or LibreOffice.

## Shared runtime removal gate

Remove the Python bundle only after all of these are true:

1. Documents and Presentations no longer have packaged Python scripts or
   `ruxex-artifacts python` invocations.
2. Spreadsheets and PDF no-Python contract tests pass after Excel work is
   complete.
3. Skill capability registries, guides, package staging, desktop sync, and
   release manifests contain no shipped Python runtime paths or package
   requirements.
4. Release integration tests exercise migrated helpers and Office preview
   rendering with host Python removed from `PATH`.
5. CI passes on Linux x64, Linux arm64, macOS Intel, and macOS Apple Silicon.

Then remove `runtime/python/`, its uv lock/pins, the Python runtime assembler
and launcher path, package manifest Python fields/hashes, Python-only runtime
tests, and bundled-Python license entries. Keep developer-only Python scripts
that are not part of the installed application unless separately migrated.
Keep Node.js, LibreOffice, Poppler, their target-specific checks, and their
license notices.

## Non-goals

- Do not remove LibreOffice or Poppler as part of Python-runtime removal.
- Do not remove the shared Node runtime.
- Do not change Excel feature implementation while that work is active.
- Do not claim that Rust migration removes OS/CPU-specific native runtime
  builds; LibreOffice, Poppler, and the Rust executable remain target-specific.

## Verification

- Preserve each helper's CLI, JSON schema, output collision behavior, and error
  codes with Rust CLI contract tests.
- Compare input and output DOCX/PPTX package parts and relationships for
  no-op/read-only and narrow-edit fixtures.
- Render real DOCX, PPTX, and XLSX fixtures with the shared native tools and
  inspect the produced page images.
- Verify the final staged package has no `python/` tree, Python executable,
  Python package metadata, or Python launcher command.
- Run the full native target matrix before removing the runtime foundation.
