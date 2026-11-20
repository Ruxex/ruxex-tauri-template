# Local PowerPoint API quick start

Create editable local PPTX files with `@ruxex/artifact-tool`. Use CSS pixels at
96 DPI for positions and font sizes. Run the builder through the bundled
`ruxex-artifacts run` command.

```js
import { Presentation, PresentationFile } from "@ruxex/artifact-tool";

const presentation = Presentation.create({
  title: "Quarterly review",
  slideSize: { width: 1280, height: 720 },
});
const slide = presentation.slides.add();
slide.background.fill = "#FFFFFF";
const title = slide.shapes.add({
  geometry: "textbox",
  position: { left: 72, top: 64, width: 1100, height: 72 },
  fill: "none",
  line: { style: "solid", fill: "none", width: 0 },
});
title.text = "Revenue increased in the second half";
title.text.style = { fontSize: 44, bold: true, color: "#172033" };
slide.addNotes("Source: supplied quarterly report.");

const file = PresentationFile.exportPptx(presentation);
const result = await file.save("/absolute/path/review.pptx");
console.log(JSON.stringify(result));
```

Read [the API reference map](api-reference-map.md) for a topic index and
[API compatibility](api-compatibility.md) for the supported surface and
import/export limits. These APIs create local files; no hosted artifact session
is created.
