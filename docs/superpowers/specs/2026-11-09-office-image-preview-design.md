# Local Office Image Preview Extension Design

## Intent

Extend the existing local image-preview path from XLSX to generated DOCX and
PPTX artifacts without adding Office, Python, Node.js, or a cloud renderer.

## Approach

The native Tauri renderer continues to read the local ZIP package directly. For
DOCX it extracts text runs from `word/document.xml`; for PPTX it extracts text
runs from each `ppt/slides/slide*.xml`. The extracted content is escaped and
laid out as bounded SVG page/slide cards. No package is extracted to disk, no
macros/relationships/media are executed, and external resources are ignored.

The existing React image component and explicit `ArtifactOutput.save()` output
metadata are reused. PDF remains a separate phase because this checkout has no
bundled PDF rasterizer and a browser PDF viewer is not an image renderer.

## Limits

- Supported formats in this phase: `.xlsx`, `.docx`, `.pptx`.
- DOCX/PPTX preview is text/layout-oriented, not pixel-perfect Office output.
- Keep the existing 16 MiB file and bounded SVG limits.
- Preserve AppServer/protocol boundaries.
