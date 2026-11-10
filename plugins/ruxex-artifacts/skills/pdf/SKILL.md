---
name: pdf
description: Create, inspect, validate, and preview local PDF artifacts with the bundled Ruxex APIs.
---

# PDF

Use the bundled `ruxex-artifacts` command and the Ruxex-owned JavaScript API
for local PDF work. Do not install a package or depend on a system PDF
application. The command and its runtimes are available through the managed
runtime PATH.

## Workflow

1. Check support with `ruxex-artifacts capabilities --json`.
2. Write one `.mjs` builder that imports `@ruxex/artifact-tool`.
3. Create a `PdfDocument` with bounded text, tables, and local images.
4. Run the builder with `ruxex-artifacts run /absolute/path/build.mjs`.
5. Run `ruxex-artifacts pdf validate --input /absolute/path/review.pdf --json`.
6. Report the absolute output path and validation result.

## Example

```js
import { PdfDocument } from "@ruxex/artifact-tool";

const pdf = PdfDocument.create({ title: "Project Review" });
pdf.addPage({ width: 595, height: 842 }).addText("Generated locally by Ruxex.");
await pdf.inspect();
await pdf.exportPdf("/absolute/path/review.pdf");
```
