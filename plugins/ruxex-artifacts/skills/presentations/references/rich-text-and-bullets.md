# Rich text and bullets

`shape.text` accepts a string, string array, or structured paragraphs and runs.
Use structured paragraphs for native bullet characters, paragraph spacing,
indents, and mixed emphasis. This keeps list semantics editable in PowerPoint.

```js
shape.text = [
  { runs: [{ run: "Revenue", style: { bold: true } }, " increased"], bulletCharacter: "•", marginLeft: 24, indent: -12, spaceAfter: 8 },
  { runs: ["Costs stayed flat"], bulletCharacter: "•", marginLeft: 24, indent: -12 },
];
```

Text styles support common font, size, color, bold, italic, underline, wrapping,
vertical alignment, and fit properties. `shape.text.get(search)` and
`getRange(start, length)` return editable text ranges; use `replace()` or the
supported run style setters. Imported rich text preserves basic font, color,
bold, italic, and underline attributes. Full PowerPoint text semantics and
layout are not reconstructed.
