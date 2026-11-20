# Managed document runtime implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for implementation when independent tasks can run in parallel; otherwise follow this plan sequentially and use superpowers:verification-before-completion before claiming completion.

**Goal:** Ship a version-pinned Python environment and document rendering tools outside skill directories, and run document helpers against those managed resources.

**Architecture:** The shared uv project at `runtime/python/` owns the Python patch version and dependency lock. The existing runtime assembler creates the locked environment plus target-native LibreOffice and Poppler assets under shared `ruxex-resources`; staging validates them, desktop sync copies them, and the Rust artifacts executable launches scripts with the staged interpreter. The renderer uses locked `pdf2image` against bundled Poppler tools.

**Tech Stack:** Rust, Python 3.12, uv, Pillow, `pdf2image`, LibreOffice, Poppler.

## Tasks

1. **Verify shared runtime version and lock contracts**
   - Check the existing `.python-version`, `.uv-version`, `pyproject.toml`, and `uv.lock` inputs.
   - Strengthen the assembler smoke check to import required modules, not only read distribution metadata.
   - Add a Make target that runs artifact Python tests under the pinned uv project.

2. **Launch document helpers using the managed runtime**
   - Use the existing Rust `ruxex-artifacts python` launcher and shared runtime root.
   - Update helper invocations in the document skill guides to use that launcher.
   - Add regression tests proving helpers do not discover host Python or rendering tools.

3. **Use bundled rendering dependencies**
   - Update `render_docx.py` to use `RUXEX_RUNTIME_BIN_DIR` for LibreOffice and locked `pdf2image` with bundled Poppler.
   - Require locked Pillow for rendered page comparisons instead of silently disabling image diffs.
   - Add renderer tests covering multi-page output, invalid input, missing runtime, path mismatch, and conversion failures.
   - Keep direct OOXML editing semantics unless a library migration has a tested preservation benefit.

4. **Verify assembly and package installation**
   - Run Python tests and helpers through the managed dev runtime, and assemble/validate the complete runtime in native CI for Linux x64, Linux arm64, macOS Intel, and macOS Apple Silicon.
   - Run stage/package/desktop sync tests and a real DOCX render integration test with host renderer directories removed from PATH; verify LibreOffice and Poppler dependencies resolve from the assembled bundle on Linux and macOS.
   - Exercise native package checks for all supported targets; report CI results and any unavailable target verification explicitly.
   - Use an independent subagent to audit the goal against the design and tests before marking the goal complete.
