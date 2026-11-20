# Shared local artifact runtime

This document defines the runtime layout and invocation contract for local
Ruxex artifact Skills. Skills use the same versioned resource tree; they do not
ship private copies of language runtimes or install dependencies while a task
runs.

## Resource locations

The release package owns one `ruxex-resources/` directory:

| Path | Contents |
| --- | --- |
| `node/` | Bundled Node.js executable and `node_modules` for JavaScript artifact workflows. |
| `native/` | Target-native rendering libraries, including LibreOffice and Poppler. |
| `bin/override/` | Stable executable entrypoints for packaged native tools. |
| `runtime-manifest.json` | Runtime schema, target, versions, executable paths, and input hashes. |
| `licenses/` | Third-party notices and license texts for bundled runtime assets. |
| `ruxex-artifact-tool/` | Shared Ruxex JavaScript API and module loader. |

The installed desktop package does not bundle CPython or Python packages. The
Python scripts under `scripts/` are development and test utilities; they are
not part of the installed artifact runtime.

During release staging, these resources live under the package's
`ruxex-resources/`. At installation, the desktop copies them once to
`vendored/skills/ruxex-resources/`, next to the installed Skill directories.
The shared contract is installed as `vendored/skills/RUNTIME.md`; a Skill
resolves it relative to its own directory as `../RUNTIME.md`.

## Invoking the runtime

- Run JavaScript builders with the Skill's sibling `ruxex-artifacts run`
  command. It uses the packaged Node.js executable, module tree, Ruxex API, and
  artifact engine.
- Resolve native tools through `RUXEX_RUNTIME_BIN_DIR` and use only binaries
  listed by the runtime manifest. Do not fall back to host tools such as
  `soffice`, `pdftoppm`, or another executable discovered on the host `PATH`.
- Local artifact Skills must use the JavaScript or Rust helper interfaces and
  the declared native tools. They must not require a Python interpreter or
  Python packages from the installed application.

## Release and installation rules

- Build each runtime tree for the same target as the release package. Staging
  rejects target mismatches and incomplete runtime manifests.
- Stage complete runtime directories as-is. Do not download or install
  dependencies from a Skill invocation, and do not use developer-machine
  package directories as release inputs.
- Supply target-native `libreoffice/` and `poppler/` trees plus
  `licenses/THIRD_PARTY_NOTICES.md` as the `ARTIFACT_NATIVE_RUNTIME` release
  input. The notices must cover the redistributed Node.js runtime and npm
  packages, LibreOffice, Poppler, and their included third-party components.
  The release assembler rejects a different host target or missing native
  executables.
- The native input has this shape: `libreoffice/` contains its platform
  distribution with `soffice` and its non-system shared libraries; `poppler/`
  contains executable `pdfinfo` and `pdftoppm` plus the non-system shared
  libraries they need, stored within their respective trees;
  `licenses/THIRD_PARTY_NOTICES.md` identifies redistributed native components
  and their licenses; `runtime-manifest.json` records schema version 1, target,
  and exact LibreOffice and Poppler versions. Native wrappers add that tool's
  bundled library directories to the target OS loader path before starting it.
  Pass matching native versions as `LIBREOFFICE_VERSION` and `POPPLER_VERSION`;
  assembly queries the packaged `soffice` and `pdfinfo` and rejects a version
  mismatch with those values.
- `make release` runs `scripts/build_artifact_runtime.py`, then stages that
  result alongside the existing Node runtime. Before staging, it validates that
  LibreOffice and Poppler resolve all non-system shared libraries from their
  own bundled trees.
- Run runtime assembly and Skill contract tests with `make artifact-runtime-test`.
  Test-only Python libraries are pinned under `plugins/ruxex-artifacts/tests/`;
  they are not inputs to release assembly and are never copied into the app.
- The assembler writes a schema-versioned `runtime-manifest.json` with target,
  Node version, native tool versions, executable paths, and input hashes.
  Package staging adds content hashes for the bundled Node runtime/modules and
  shared artifact SDK. Package staging validates these hashes, the target,
  Node version, required files, and relative executable paths before creating
  a release package.
- Desktop sync compares the manifest and verifies the installed LibreOffice,
  Poppler, Node, and artifact SDK tree hashes. An unchanged, intact runtime is
  not recopied on every app-server reconnect; a changed manifest or
  damaged/missing resource replaces the installed shared tree.
- Desktop installation copies the shared resources once beside all artifact
  Skills. It does not copy runtimes into each individual Skill directory.
- The source-tree fallback used by an unstaged debug build contains Skill
  instructions only; it does not assemble or install this runtime. Runtime
  behavior must be exercised with a staged package.
- Skills must declare their native and JavaScript runtime needs here and must
  not assume that an unlisted library exists.

This runtime contract is local and package-backed. It does not cover Google
Slides or a hosted artifact session.

Bundling does not make native tools static. The target OS still provides the
system C runtime and platform frameworks; release validation must run on each
supported target to catch missing system libraries. Rendering fonts remain
dependent on fonts available to the packaged renderer; the current bundle does
not claim that every system font is included.
