# Local Word and PowerPoint Artifact Tool Design

## Intent

Extend Ruxex's local artifact generation foundation from XLSX to editable DOCX
and PPTX files. The LLM should see one Ruxex-owned JavaScript API and one
bundled command, while users should not need to install Node packages, Python,
Microsoft Office, or desktop automation tools.

The first release is a dependable local authoring surface for common
document and presentation outputs. It is not intended to reproduce every
feature of Word or PowerPoint in the first phase.

## Goals

- Add local DOCX creation through a Ruxex-owned JavaScript API.
- Add local PPTX creation through a Ruxex-owned JavaScript API.
- Keep the existing `ruxex-artifacts run` builder workflow.
- Reuse the already bundled Node runtime and keep App Server/protocol unchanged.
- Bundle the MIT-licensed `docx` and `pptxgenjs` implementations and their
  runtime dependencies as package resources; do not require user installs.
- Produce editable OOXML files rather than rendered PDFs or images.
- Provide capabilities and validation diagnostics for all three artifact types.

## Non-goals for this phase

- Live control of Microsoft Word or PowerPoint.
- Cloud storage, Google Docs, Google Slides, or Microsoft Graph integration.
- Full Word style/template fidelity or tracked changes/comments.
- Full PowerPoint theme/master/layout fidelity or animation support.
- Formula evaluation, advanced formatting, and rendering for the existing
  spreadsheet API.
- Redistributing OpenAI's private artifact tooling.

## Anti-goals

- Do not make users install `docx`, `pptxgenjs`, Python, or office software.
- Do not add a second user-facing runtime command for each file format.
- Do not expose the private Rust engine protocol as a public LLM API.
- Do not modify the App Server or its protocol.

## Approaches considered

### 1. Bundled Node authoring libraries and Ruxex facade

Use the MIT-licensed `docx` and `pptxgenjs` packages already available in the
workspace runtime. The Ruxex SDK wraps them behind stable `Document` and
`Presentation` classes, while `ruxex-artifacts run` launches the bundled Node
runtime and resolves the package-local dependencies.

This keeps the Excel, Word, and PowerPoint authoring model in one language and
one launcher. It also gives the project a practical path to add richer APIs
without expanding Rust's OOXML implementation.

### 2. Rust-native OOXML generation

Generate DOCX and PPTX ZIP/XML packages directly from Rust. This minimizes
runtime resources but requires implementing document relationships, styles,
slide layouts, themes, and media handling in Ruxex. It would be smaller only
after a substantial amount of feature work and would provide less library
compatibility in the first release.

### 3. Bundled Python authoring libraries

Bundle a Python runtime with `python-docx` and `python-pptx`. This has familiar
APIs but adds a second scripting runtime and a second dependency distribution
path. It does not fit the existing Node SDK boundary.

### Decision

Use approach 1. The user selected the bundled Node-library approach because it
preserves the existing Ruxex artifact architecture and avoids user-managed
dependencies.

## Public JavaScript API

The SDK remains imported as `@ruxex/artifact-tool`.

### Documents

```js
import { Document } from "@ruxex/artifact-tool";

const document = await Document.create({ title: "Project Report" });
document.addHeading("Project Report", 1);
document.addParagraph("The report is generated locally by Ruxex.");
document.addTable([
  ["Name", "Status"],
  ["Artifact runtime", "Ready"],
]);
await document.inspect();
await document.exportDocx("/absolute/path/report.docx");
```

The initial `Document` API supports:

- `Document.create(options?)`
- `Document.load(path)` for basic text/table extraction when supported
- `addParagraph(text, options?)`
- `addHeading(text, level?)`
- `addTable(rows, options?)`
- `inspect()`
- `exportDocx(path)`

The facade owns input validation and returns structured
`ArtifactToolError` diagnostics. Unsupported advanced Word features fail
explicitly rather than being silently discarded.

### Presentations

```js
import { Presentation } from "@ruxex/artifact-tool";

const presentation = await Presentation.create({ title: "Project Review" });
const slide = presentation.addSlide({ layout: "title" });
slide.addText("Project Review", { role: "title" });
slide.addText("Local artifact generation", { role: "body" });
slide.addTable([
  ["Area", "Status"],
  ["DOCX", "Ready"],
]);
await presentation.inspect();
await presentation.exportPptx("/absolute/path/review.pptx");
```

The initial `Presentation` API supports:

- `Presentation.create(options?)`
- `addSlide(options?)`
- `Slide.addText(text, options?)`
- `Slide.addTable(rows, options?)`
- `Slide.addShape(shape, options?)` for a small editable shape set
- `inspect()`
- `exportPptx(path)`

The facade translates Ruxex-friendly roles and options into `pptxgenjs`
objects. The underlying library remains an implementation detail.

## Runtime and packaging

The existing launcher remains the only public entry point:

```text
ruxex-artifacts run /absolute/path/build.mjs
```

The staged package adds the following resources under
`ruxex-resources/ruxex-artifact-tool`:

- Ruxex SDK source and loader
- `docx` and its required runtime packages
- `pptxgenjs` and its required runtime packages
- package metadata and license notices for the bundled MIT dependencies

The launcher sets `NODE_PATH` only if the chosen Node runtime needs a package
lookup path; otherwise the SDK uses explicit package-relative imports. The
staging script receives the dependency source directory explicitly so the
build environment, not the end user, chooses the runtime contents.

## Validation

The CLI capabilities response expands to:

```json
{
  "ok": true,
  "commands": {
    "xlsx": ["create", "read", "validate"],
    "docx": ["create", "read", "validate"],
    "pptx": ["create", "read", "validate"]
  }
}
```

Validation is format-specific:

- DOCX: the generated ZIP contains the required Word package parts and can be
  rendered by the bundled document renderer in test fixtures.
- PPTX: the generated ZIP contains the required presentation parts, slide
  relationships, and can be opened by the bundled presentation inspection
  path in test fixtures.
- XLSX: preserve the existing Rust create/read/validate behavior.

The SDK tests exercise a real builder for each format, use the staged package,
and verify that the output file exists and returns a valid validation response.
The public Skill documents the common workflow and requires validation after
export.

## Compatibility boundary

The private JSON protocol between the JS SDK and the Rust engine remains
versioned. New format operations are additive and do not change existing XLSX
requests. App Server and protocol files remain untouched.

## Open implementation calls

- Use `docx` and `pptxgenjs` version ranges resolved from the selected bundled
  runtime, but copy the exact package versions into the staged package.
- Keep read operations intentionally shallow in the first release: extract
  supported text/tables or return a structured unsupported diagnostic.
- Prefer package-level ZIP validation over requiring desktop applications in
  CI.
