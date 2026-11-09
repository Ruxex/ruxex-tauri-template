# Local Artifact Parity Design

**Date:** 2026-11-09

## Intent

Close the remaining local artifact gap between Ruxex and the practical,
desktop-visible portion of Codex artifact workflows. Ruxex should be able to
create, inspect, edit within its supported model, and visually review local
XLSX, DOCX, PPTX, and PDF files without requiring Office, a system converter,
cloud execution, or changes to the AppServer/protocol.

The target is local workflow parity, not undocumented proprietary Office
compatibility. Unsupported constructs must be reported explicitly rather than
silently discarded.

## Current state

- The bundled artifact runtime creates XLSX, DOCX, and PPTX files.
- XLSX, DOCX, and PPTX have bounded native SVG previews in the conversation.
- XLSX has formulas, formatting, tables, merges, and charts in the local model.
- DOCX/PPTX imports are currently shallow and their previews are text/layout
  snapshots.
- PDF generation, inspection, and preview are not implemented.
- The conversation has an inline preview block, but not a dedicated artifact
  viewer with page/slide/sheet navigation.

## Goals

1. Add a bundled local PDF model with deterministic creation, validation, text
   inspection, and page-image preview.
2. Expand DOCX/PPTX/XLSX extraction and preview to include supported styles,
   tables, merges, charts, notes, and embedded local images.
3. Make supported DOCX/PPTX imports editable instead of always shallow.
4. Add a dedicated artifact viewer with thumbnails, navigation, zoom, format
   metadata, and an explicit open/download action.
5. Keep all output and preview work local, bounded, deterministic, and safe.

## Non-goals

- Codex Cloud, hosted artifacts, cross-device continuation, or remote workers.
- Changes to AppServer messages, generated protocol types, or provider APIs.
- Executing Office, LibreOffice, browser automation, macros, external links,
  embedded objects, or arbitrary document relationships.
- Claiming pixel-perfect compatibility with every Office feature.
- Replacing the existing artifact Skill contract with provider-specific APIs.

## Approaches considered

### A. Rust-native format engines — selected

Keep the JavaScript API as the agent-facing facade, but move format parsing,
validation, preview extraction, and PDF support into bounded Rust modules. The
Tauri app and the bundled artifact engine share the same native implementation
where practical.

This adds implementation work for layout and images, but preserves the key
product constraint: users do not install or configure Office, Python, Node, or
another converter. It also gives Ruxex deterministic limits and testable
failure behavior.

### B. Bundle LibreOffice or a browser converter

This would improve Office rendering fidelity, but adds large platform-specific
runtime assets, process lifecycle and sandboxing issues, and a second source of
format behavior. It conflicts with the chosen native-only direction.

### C. Keep text-only previews and add only PDF output

This is smaller, but leaves the main user-visible gap in DOCX/PPTX review and
does not provide a useful artifact workspace. It is insufficient for the
requested parity target.

## Selected architecture

### 1. Shared normalized artifact model

Introduce a bounded native representation for preview and inspection:

- `ArtifactDocument`: format, title, dimensions, and ordered pages/sections.
- `ArtifactSection`: sheet, document page, or presentation slide metadata.
- `ArtifactElement`: text, table, shape, chart, image, or unsupported marker.
- `ArtifactAsset`: validated local image bytes with format and size limits.

The model is deliberately loss-aware. Every unsupported feature is either
represented as a visible marker or returned as a structured diagnostic.

### 2. Format modules

- XLSX: retain the existing `calamine` reader and native writer; add style,
  merge, table, chart, and image extraction to the preview model.
- DOCX/PPTX: read OOXML ZIP parts directly with bounded XML extraction; parse
  supported paragraph, table, shape, image, chart, note, and layout data.
  Never follow external relationships or execute package content.
- PDF: add a Rust-native writer for the supported document model and a bounded
  reader for page metadata/text and renderable drawing/image primitives. PDF
  pages are previewed as SVG or raster data URLs without spawning a converter.

The exact Rust crates are selected in the implementation plan after checking
the existing locked dependency set. New crates must be pure Rust or ship as
part of the application; no system library may be required at runtime.

### 3. Agent-facing API

Extend the existing `@ruxex/artifact-tool` facade rather than exposing native
details to builders:

- `FileBlob` recognizes PDF and reports bounded file metadata.
- `Document` supports styled paragraphs, tables, and local image assets.
- `Presentation` supports slide layout, styled text, shapes, tables, charts,
  notes, and local image assets.
- `SpreadsheetFile.importXlsx()` preserves the supported workbook model,
  including formats, merges, tables, charts, and images.
- `PdfDocument` supports pages, text blocks, tables, and local images.
- Every import exposes `inspect()` diagnostics and every save returns explicit
  `{ ok, format, output }` metadata for the existing conversation flow.

### 4. Preview and viewer

Replace the single-image assumption with a paged preview payload containing
format metadata and an ordered list of page/slide/sheet image data URLs. The
existing inline preview remains as the first-page compact view.

Add a dedicated `ArtifactViewer` component that provides:

- thumbnail list and previous/next navigation;
- fit-width and zoom controls;
- page/slide/sheet labels and truncation/unsupported-feature diagnostics;
- format, size, and source path metadata;
- explicit local open/download actions guarded by the existing path policy.

The viewer is driven entirely by the local artifact path and explicit output
metadata already carried by the conversation model; no protocol changes are
needed.

### 5. Safety limits

- Allow only absolute files under the Ruxex or workspace roots.
- Cap compressed and decompressed package sizes, XML parts, assets, sections,
  rendered dimensions, and generated output.
- Reject symlinks, external URLs, external relationships, macros, embedded
  executables, and unsupported image formats.
- Escape all text before SVG insertion and never interpret document markup as
  executable content.
- Return structured errors for malformed or partially unsupported files.

## Acceptance criteria

- A local builder can create valid XLSX, DOCX, PPTX, and PDF files using only
  bundled Ruxex resources.
- Existing supported XLSX/DOCX/PPTX files can be inspected and previewed as
  multiple navigable images; supported edits preserve the parsed content.
- PDF output can be created, inspected, and previewed without an external
  converter.
- Tables, styles, charts, notes, and local images appear in previews wherever
  the selected format model supports them; otherwise a visible diagnostic is
  produced.
- All malformed, oversized, out-of-root, or externally linked inputs fail
  safely and deterministically.
- AppServer and generated protocol files remain unchanged.
- Rust, JavaScript, UI, package-boundary, and artifact fixture tests pass.

## Open implementation choices

The implementation plan must settle the concrete PDF parser/writer crates,
the normalized JSON shape between the JS facade and native engine, the asset
size limits, and the viewer's open/download bridge. These are implementation
choices, not user-facing behavior changes.
