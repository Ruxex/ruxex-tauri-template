# Managed document runtime design

## Goal

Bundle the Python runtime and libraries used by Ruxex artifact helpers outside
the skill directories. Bundle LibreOffice for DOCX-to-PDF conversion and use a
Python PDF rendering library for PDF-to-image conversion. Helper execution must
use these managed assets instead of a host `python3`, `soffice`, or
`pdftoppm` found through `PATH`.

## Constraints

- Keep skills as instructions and helper scripts; keep versioned runtimes under
  the shared `ruxex-resources` tree.
- Pin the Python patch release, uv tool version, and every Python dependency.
  `uv.lock` is the dependency source of truth and runtime assembly must reject a
  stale lock.
- Build native runtime resources for the current supported release target
  (Linux or macOS); do not silently stage host tools for a different target.
- Preserve the existing package structure and skill sync lifecycle.
- Keep helper DOCX edits based on direct OOXML package edits where that better
  preserves unsupported Word parts. Adopt libraries where they directly
  replace fragile or externally installed tooling.
- Include third-party license notices with the bundled runtime assets.

## Design

1. Use the shared Python project under `runtime/python/`, with an exact
   `.python-version`, pinned uv version, `pyproject.toml`, and committed
   `uv.lock`. The uv version is pinned both for the project and the release
   assembler, and tests detect drift between those pins. Its existing
   dependency set includes Pillow and `pdf2image`.
   Document helpers add requirements to this common environment rather than
   creating a skill-specific virtual environment.
2. Use the shared runtime assembler and package staging. They install pinned
   standalone CPython with uv, install the exact lock export, and place it at
   `ruxex-resources/python/`; they stage target-native LibreOffice and Poppler
   under `ruxex-resources/native/`, stable wrappers under
   `ruxex-resources/bin/override/`, plus a version/hash manifest and license
   notices.
3. Use the existing Rust `ruxex-artifacts python` launcher and desktop resource
   synchronization. The launcher invokes shared `python/bin/python3` and
   passes `RUXEX_RUNTIME_ROOT` and related paths. It does not fall back to
   system Python.
4. Update DOCX rendering to select bundled LibreOffice and use the pinned
   `pdf2image` package with the shared Poppler path, removing host `PATH`
   discovery. Keep private LibreOffice profiles and conversion timeouts.
   Leave package-preserving OOXML helpers in place unless a library improves an
   individual operation without losing unknown DOCX package parts.

## Verification

- Unit-test runtime staging validation, target/version manifest checks, and
  launcher path discovery in both packaged and installed skill layouts.
- Check the uv version, `.python-version`, and lock freshness; use the locked
  dev environment for all Python tests.
- Run Python helper unit tests and smoke-test every public helper's `--help`
  using the assembled interpreter with a restricted `PATH`.
- Run an offline DOCX render integration test using bundled LibreOffice and
  Poppler, confirming the resulting pages are readable images.
- Run package staging and desktop resource sync tests to prove the runtime is
  present after installation and independent of host Python/LibreOffice.
- Test Linux x64, Linux arm64, macOS Intel, and macOS Apple Silicon in native
  CI. Each job assembles the complete runtime from that runner's LibreOffice
  and Poppler binaries, validates the staged runtime manifest and hashes, then
  renders a real DOCX with host renderer commands removed from `PATH`. Verify
  LibreOffice and Poppler non-base shared-library dependencies resolve from the
  assembled bundle using `ldd` on Linux and dyld load diagnostics on macOS. A
  fixture-only package check does not establish cross-platform binary
  compatibility.

## Trade-offs

- Packages become significantly larger, especially from LibreOffice. The
  runtime remains shared rather than duplicated per skill.
- LibreOffice still uses the target's base C runtime and desktop libraries.
  Native packaging bundles its non-system shared libraries and validates the
  resulting runtime on each supported target; bundling does not imply a static,
  libc-independent binary.
- `pdf2image` provides the Python interface while Poppler remains the bundled
  native page rasterizer required by that library.
- python-docx is not a default rewrite target for low-level editors because
  saving through an object model can drop unsupported OOXML package parts.
