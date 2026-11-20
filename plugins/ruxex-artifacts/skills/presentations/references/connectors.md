# Connectors

Connect shapes with `slide.shapes.connect(from, to, options)`. Routes include
straight, elbow, and curved connectors. Set the anchor sides and line style;
arrowheads remain editable in the exported PowerPoint.

```js
slide.shapes.connect(title, outcome, {
  kind: "elbow",
  fromSide: "right",
  toSide: "left",
  line: { fill: "#64748B", width: 2 },
  head: { type: "arrow" },
});
```

Ruxex uses four cardinal connection sites for each shape geometry. PowerPoint
may route connectors differently from the local preview and can expose more
preset-specific connection sites.
