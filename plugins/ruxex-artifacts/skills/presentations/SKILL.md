---
name: presentations
description: Create, inspect, validate, and preview local presentation artifacts with the bundled Ruxex APIs.
---

# Presentations

Use the bundled `ruxex-artifacts` command and the Ruxex-owned JavaScript API
for local presentation work. Do not install a package or depend on a system
office application. The command and its runtimes are available through the
managed runtime PATH.

## Workflow

1. Check support with `ruxex-artifacts capabilities --json`.
2. Write one `.mjs` builder that imports `@ruxex/artifact-tool`.
3. Create a `Presentation` and add slides, text, tables, and supported shapes.
4. Run the builder with `ruxex-artifacts run /absolute/path/build.mjs`.
5. Run `ruxex-artifacts pptx validate --input /absolute/path/review.pptx --json`.
6. Report the absolute output path and validation result.

## Example

```js
import { Presentation, PresentationFile } from "@ruxex/artifact-tool";

const presentation = Presentation.create({ title: "Project Review" });
const slide = presentation.slides.add({ layout: "title" });
slide.shapes.add({
  geometry: "textbox",
  position: { left: 72, top: 64, width: 800, height: 80 },
  text: "Project Review",
});
await presentation.inspect();
const file = PresentationFile.exportPptx(presentation);
await file.save("/absolute/path/review.pptx");
```
