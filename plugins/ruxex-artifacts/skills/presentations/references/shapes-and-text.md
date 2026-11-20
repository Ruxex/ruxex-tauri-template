# Shapes and text

Add editable elements with `slide.shapes.add({ geometry, position, fill, line })`.
Positions use CSS pixels at 96 DPI. Geometry accepts `textbox`, PowerPoint
preset shape names supported by PptxGenJS, and aliases including `rect`,
`roundRect`, `ellipse`, and `line`. `custom` geometry supports the documented
editable custom path subset.

```js
const label = slide.shapes.add({
  geometry: "textbox",
  position: { left: 72, top: 100, width: 560, height: 70 },
  fill: "none",
  line: { fill: "none", width: 0 },
});
label.text = "A specific finding";
label.text.style = { fontSize: 36, bold: true, color: "slate-900" };
```

Shape positions can include rotation and flips. Text boxes and preset shapes
retain editable text in the exported PPTX. The local renderer draws a supported
subset of preset geometries; unsupported preset previews may fall back to a
rectangle. See [rich text and bullets](rich-text-and-bullets.md) for paragraphs
and text ranges.
