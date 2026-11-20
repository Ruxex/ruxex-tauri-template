# Render and review PowerPoint slides

Use the Ruxex model preview when checking supported editable objects during
authoring. Use the `render-slides` helper after export to review the actual PPTX
package through the bundled LibreOffice and Poppler renderers.

```sh
"/absolute/path/to/skill/ruxex-artifacts" pptx helper render-slides \
  --input "/absolute/path/to/review.pptx" \
  --output-dir "/absolute/path/to/private-review"

"/absolute/path/to/skill/ruxex-artifacts" pptx helper make-contact-sheet \
  --image "/absolute/path/to/private-review/slide-001.png" \
  --image "/absolute/path/to/private-review/slide-002.png" \
  --output "/absolute/path/to/private-review/contact-sheet.png"
```

Inspect the contact sheet for deck-level rhythm, then open each slide image at
full size. Check text fit, overlap, contrast, chart labels, and template reuse.
Contact sheets help review rendered slides; they are not slide artwork.

The PPTX renderer is a separate Office-compatible rendering path. It can differ
from Microsoft PowerPoint, and neither it nor the source-model preview proves
that every embedded object renders identically in PowerPoint. Do not claim a
PowerPoint check unless PowerPoint itself was used.
