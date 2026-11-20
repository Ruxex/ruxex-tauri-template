# Slide management

Create slides with `presentation.slides.add()`. Insert after a slide, index, or
at the beginning with `presentation.slides.insert({ after, layout })`. Retrieve
slides with `getItem(index)`, duplicate within a deck with `addCopy(slide)`,
change order with `reorder(slideIds)`, retain a subset with `keep(indexesOrIds)`,
and remove with `delete(idOrIndex)`.

Indexes are zero-based. Requests in the Presentation Skill usually count slides
from one; convert those values before using the API. IDs from one presentation
are stable for that model lifetime, but are not durable identifiers across
re-imports.

```js
const first = presentation.slides.add({ layout: "Title Body" });
const { slide: next, index } = presentation.slides.insert({ after: first, layout: "Title Body" });
const duplicate = presentation.slides.addCopy(first);
presentation.slides.reorder([first.id, duplicate.id, next.id]);
```

PPTX export requires all slides to use the same deck size. Use inspection after
reordering or removal to confirm the final count and order.
