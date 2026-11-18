---
name: documents
description: Create, inspect, validate, and preview local document artifacts with the bundled Ruxex APIs.
---

# Documents

Use the bundled `ruxex-artifacts` command and the Ruxex-owned JavaScript API
for local document work. Do not install a package or depend on a system office
application. Use the absolute path to this `SKILL.md` supplied by the active
Skill context to locate the sibling `ruxex-artifacts` executable. Invoke it by
its full path; do not rely on command lookup through `PATH`.

## Workflow

1. Check support with `"/absolute/path/to/skill/ruxex-artifacts" capabilities --json`.
2. Write one `.mjs` builder that imports `@ruxex/artifact-tool`.
3. Create or import a `Document` using `Document.create` and `FileBlob`.
4. Add supported headings, paragraphs, tables, and document formatting.
5. Run the builder with `"/absolute/path/to/skill/ruxex-artifacts" run /absolute/path/build.mjs`.
6. Run `"/absolute/path/to/skill/ruxex-artifacts" docx validate --input /absolute/path/report.docx --json`.
7. Report the absolute output path and validation result.

## Example

```js
import { Document } from "@ruxex/artifact-tool";

const document = await Document.create({ title: "Project Report" });
document.addHeading("Project Report", 1);
document.addParagraph("Generated locally by Ruxex.");
document.addTable([["Area", "Status"], ["Documents", "Ready"]]);
await document.inspect();
await document.exportDocx("/absolute/path/report.docx");
```
