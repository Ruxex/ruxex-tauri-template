# Inspection and editing

`presentation.inspect()` reports slide and object counts. Its query form accepts
`select` and `include` fields; IDs from results can be resolved back to editable
objects. `presentation.resolve(ids)` returns handles and `presentation.delete(id)`
removes selected content. Slide collection methods also accept indexes or IDs
where documented.

```js
const found = await presentation.inspect({
  select: "$.slides[*].elements[?(@.name == 'old-heading')]",
  include: ["id", "name", "text", "position"],
});
const [heading] = presentation.resolve(found.records.map((item) => item.id));
heading.text = "Updated heading";
```

The selector supports common JSONPath constructs and helper functions, not the
complete RFC 9535 standard. Inspection reports model content and geometry; it
does not calculate PowerPoint text overflow. Run the package and layout helpers
for additional PPTX-level checks.
