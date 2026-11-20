# Ruxex proto and layout export

presentation.toProto() returns the local ruxex.presentation.proto/v1 model
format. Presentation.load(proto) restores it. Use proto when a local workflow
needs to save and reload the editable Ruxex model; it is not a PowerPoint file.

slide.export({ format: "layout" }) produces a JSON view of slide bounds,
element IDs, paragraph metadata, and table-cell formatting. Imported master
and layout layers are reported separately when supported. This view does not
include every inherited image, complex master object, or PowerPoint-computed
text layout.

Use PPTX export for a deck intended for PowerPoint. Use layout JSON or proto
only when a workflow needs the corresponding structured representation.
