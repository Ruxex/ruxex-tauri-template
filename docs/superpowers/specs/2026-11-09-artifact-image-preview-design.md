# Local Artifact Image Preview Design

## Intent

Show locally generated Excel artifacts as images inside the Ruxex desktop
conversation without requiring Office, Python, Node.js, or a cloud renderer.
The preview is a visual artifact, not a textual dump of workbook cells.

## Goals

- Render a safe, deterministic XLSX preview as an SVG image from the native
  Rust side of the desktop app.
- Display the preview in the existing conversation activity UI when an
  artifact path is present in activity metadata.
- Keep AppServer, generated protocol types, and server-side artifact contracts
  unchanged.
- Restrict preview reads to Ruxex/workspace roots and supported local files.
- Preserve a readable fallback when the file is unsupported or the renderer
  cannot interpret it.

## Non-goals

- Pixel-perfect Excel layout or full Office rendering.
- Executing workbook formulas, macros, links, embedded objects, or external
  resources during preview.
- DOCX/PPTX/PDF image rendering in this slice; the renderer boundary is
  intentionally reusable for those later formats.
- Adding artifact fields to the AppServer protocol.

## Approach

### Selected: native safe SVG renderer plus a Tauri command

The Tauri side reads scalar XLSX values with the already bundled `calamine`
reader and creates a bounded SVG grid. Cell contents are XML-escaped, clipped
to fixed dimensions, and rendered without loading external resources. The
frontend receives a `data:image/svg+xml` payload through a Tauri command and
uses the existing image presentation pattern.

The conversation model carries an optional local `artifactPath` metadata value
when an activity explicitly identifies one. This keeps the AppServer/protocol
unchanged and avoids guessing arbitrary paths from assistant prose.

### Alternatives considered

1. **Structured text/table output:** easy, but does not meet the visual preview
   expectation and loses the spatial relationship between cells.
2. **Bundle LibreOffice or a browser screenshot renderer:** higher fidelity,
   but adds a large platform-specific runtime and unsafe/external rendering
   surface.
3. **Pure frontend XLSX parsing:** would duplicate the native reader and put
   file access and archive parsing in the webview; the native boundary is safer.

## Security and limits

- Require absolute paths and canonicalize before reading.
- Allow only `.xlsx` files under the Ruxex home or current workspace roots.
- Cap input size and preview dimensions/cell count.
- Render only scalar values obtained from the workbook reader.
- Escape `&`, `<`, `>`, `"`, and `'` before inserting text into SVG.
- Return structured Tauri errors; do not expose raw file contents on failure.

## Public/UI shape

```ts
type ArtifactPreview = {
  mimeType: "image/svg+xml";
  dataUrl: string;
  format: "xlsx";
  sheets: number;
  rows: number;
  columns: number;
};

previewArtifact(path: string): Promise<ArtifactPreview>
```

The existing conversation item metadata may include `artifactPath` and
`artifactFormat`. `ActivityItem` renders an `ArtifactPreview` block for that
metadata; absent metadata leaves existing activity rendering unchanged.
