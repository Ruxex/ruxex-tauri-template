# Rendering and export

`presentation.render({ slide, format })` creates local previews as PNG by
default, or SVG, JPEG, and WebP. It can render selected slides or a montage and
includes a layout JSON sidecar. `presentation.export({ format: "pdf" })`
creates rasterized pages from the supported source model; PDF output is a visual
handoff, not an editable deck.

Export an editable PPTX with `PresentationFile.exportPptx(presentation)` and
save it to an absolute path. The API also exports layout JSON and the Ruxex
presentation proto format. Use [rendering review](rendering-review.md) to
render the actual exported PPTX with the packaged LibreOffice and Poppler tools.

Neither model previews nor the packaged Office-compatible renderer establish
pixel identity with Microsoft PowerPoint. Do not claim that a deck was checked
in PowerPoint unless it was opened there.
