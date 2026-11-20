---
name: documents
description: Use when creating, reading, inspecting, validating, previewing, or editing local Word DOCX files with the bundled Ruxex APIs.
---

# Documents

Use the bundled `ruxex-artifacts` command and the Ruxex-owned JavaScript API
for local DOCX work. Use the absolute path to this `SKILL.md` supplied by the active
Skill context to locate the sibling `ruxex-artifacts` executable. Invoke it by
its full path; do not rely on command lookup through `PATH`. DOCX transformations
run through the bundled Rust CLI. Page rendering uses the managed LibreOffice
and Poppler tools described in [the runtime contract](../RUNTIME.md).

## Choose a workflow

| Task | Workflow |
| --- | --- |
| Read or review a DOCX | [Read and review](tasks/read-review.md) |
| Create a DOCX or edit existing text | [Create and edit](tasks/create-edit.md) |
| Render pages for visual review | [Render and verify](tasks/render-verify.md) |
| Inspect direct styles and fonts | [Style audit](tasks/style-audit.md) |
| Compare two DOCX versions | [Compare versions](tasks/compare-versions.md) |
| Export Word tables to CSV | [Tables and CSV](tasks/tables-interchange.md) |
| Import spreadsheet tables or repair Word table geometry | [Tables and CSV](tasks/tables-interchange.md) |
| Fill basic Word forms | [Forms and content controls](tasks/forms-content-controls.md) |
| Inspect comments or tracked changes | [Comments and revisions](tasks/comments-revisions.md) |
| Mask text and scrub metadata | [Privacy](tasks/privacy.md) · [Text redaction](tasks/redaction.md) |
| Merge DOCX documents | [Merge documents](tasks/merge-documents.md) |
| Distill or apply a DOCX template | [Template styles](tasks/template-styles.md) |
| Create from a retained DOCX template | [Template fidelity](tasks/template-fidelity.md) |
| Inspect sections, fields, images, and protection | [Feature audit](tasks/feature-audit.md) |
| Add math to Word documents | [Equations](tasks/equations.md) |
| Create, inspect, or flatten Word fields | [Fields and navigation](tasks/fields-navigation.md) |
| Insert captions and cross-reference fields | [Fields and navigation](tasks/fields-navigation.md) |
| Insert or prepare a table of contents | [Fields and navigation](tasks/fields-navigation.md) |
| Add footnotes or endnotes | [Fields and navigation](tasks/fields-navigation.md) |
| Check document structure and accessibility | [Accessibility audit](tasks/accessibility-audit.md) |
| Remove document properties | [Privacy](tasks/privacy.md) |
| Work with advanced Word features | [Advanced OOXML support](tasks/advanced-ooxml.md) |

## Shared rules

- Identify the reader and the document's purpose. Lead with its conclusion,
  decision, or request, and preserve the source's meaning and uncertainty.
- Give the document a plain, descriptive title that names its subject and
  purpose. Use Word's `Title` paragraph style, keep it black, and remove
  underlining, paragraph borders, and decorative lines beneath it. Prefer
  words, numbers, and spaces in titles and section headings.
- Make the opening explain what the document covers, why it matters to this
  reader, and the main conclusion, decision, or task. Give enough scope and
  context for the sections that follow. Read the title and headings as an
  outline before polishing body text.
- Match the author's voice and audience. Keep claims grounded in the supplied
  facts, and keep conditions, dates, uncertainty, and qualifications intact.
- For a supplied DOCX template, retain its structure and formatting. Inspect it
  before editing and make local changes where possible.
- Report unsupported-content diagnostics before editing an imported document.
  Do not export a lossy import unless the user accepts those diagnostics.
- Validate each generated or transformed DOCX with the bundled command.
- Ruxex's SVG preview is a content preview. It does not reproduce Word layout,
  page breaks, or exact pagination. Use the local renderer workflow for page
  images and review each page before making visual-fidelity claims.
- Page rendering uses the bundled LibreOffice and Poppler tools through the
  shared local runtime. If that runtime is incomplete, report the missing
  bundled resource; do not switch to a host runtime or renderer.

## Quick workflow

1. Check available CLI operations and document API options with
   `"/absolute/path/to/skill/ruxex-artifacts" capabilities --json`.
2. Read the matching task guide and inspect existing input files before editing.
3. Use `Document.create()` for a new document or `Document.load(path)` for a
   supported shallow import.
4. Run builders with `"/absolute/path/to/skill/ruxex-artifacts" run /absolute/path/build.mjs`.
5. Run `"/absolute/path/to/skill/ruxex-artifacts" docx validate --input /absolute/path/report.docx --json`.
6. Run `"/absolute/path/to/skill/ruxex-artifacts" docx audit --input /absolute/path/report.docx --json` and render pages using [Render and verify](tasks/render-verify.md).
7. Report the output path and any remaining diagnostics.

## Example

```js
import { Document } from "@ruxex/artifact-tool";

const document = await Document.create({
  title: "Project Report",
  pageSize: "letter",
  margins: { top: 1, right: 1, bottom: 1, left: 1 },
});
document.addHeading("Project Report", 1);
document.addParagraph("This report summarizes the project status.", {
  spacingAfter: 8,
});
document.addTable(
  [["Area", "Status"], ["Documents", "Ready"]],
  { headerRow: true, cellPadding: 6 },
);
await document.inspect();
await document.exportDocx("/absolute/path/report.docx");
```
