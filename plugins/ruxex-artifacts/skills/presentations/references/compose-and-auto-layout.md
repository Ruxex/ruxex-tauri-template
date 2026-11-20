# Compose and auto layout

`slide.compose(tree, { frame })` turns supported row, column, grid, layer, box,
paragraph, run, shape, rule, image, table, chart, slide, and background nodes
into editable slide objects. Row and column flows support fixed or fill sizing,
gaps, alignment, padding, and weighted grid tracks.

```js
const [heading, summary] = slide.compose({
  type: "column",
  props: { gap: 16 },
  children: [
    { type: "paragraph", props: { width: "fill", height: 48 }, children: "Quarterly review" },
    { type: "box", props: { width: "fill", height: 180, fill: "slate-100", padding: 20 }, children: "Key results" },
  ],
}, { frame: { left: 72, top: 64, width: 1100, height: 560 } });
```

`slide.autoLayout(shapes, options)` positions existing shapes in horizontal or
vertical flow with a frame, gap, padding, and alignment. Compose supports a
structured layout subset, not general CSS, React hooks, or context semantics.
