# Masters, layouts, and placeholders

Create named masters and layouts with `presentation.masters.add()` and
`presentation.layouts.add()`. Layouts can define editable text placeholders
with type, index, geometry, and position. Assign a layout to a slide, then set
placeholder text with `slide.placeholders.getItem(type)`.

```js
const layout = presentation.layouts.add("Title Body");
layout.placeholders.add({
  type: "title", index: 0, geometry: "textbox",
  position: { left: 72, top: 64, width: 900, height: 80 },
});
const slide = presentation.slides.add({ layout: "Title Body" });
slide.placeholders.getItem("title").text = "Market overview";
```

The exporter writes a PowerPoint master/layout hierarchy for supported model
records. Import retains named layouts, placeholders, and simple inherited
rectangle, line, and text artwork. Inherited images and complex master artwork
are not reconstructed; use diagnostics before editing a supplied deck.
