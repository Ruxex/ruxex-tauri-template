# Read and Review a DOCX

Use this workflow before editing an existing Word document or when reviewing
its content and structure.

## Workflow

1. Validate the package:

   ```sh
   "/absolute/path/to/skill/ruxex-artifacts" docx validate --input /absolute/input.docx --json
   ```

2. Read supported text and tables:

   ```sh
   "/absolute/path/to/skill/ruxex-artifacts" docx read --input /absolute/input.docx --json
   ```

   Or use the JavaScript facade:

   ```js
   import { Document } from "@ruxex/artifact-tool";

   const document = await Document.load("/absolute/input.docx");
   const inspection = await document.inspect();
   console.log(JSON.stringify(inspection));
   ```

3. Review the `diagnostics` and `editable` fields before making changes. A
   successful package validation only confirms required OOXML package parts; it
   does not prove that every Word feature is editable or visually correct.
4. When working in the Ruxex desktop, inspect the generated artifact's local
   SVG preview for readable extracted content and table order.
5. Render the DOCX to page images with [Render and verify](render-verify.md),
   then inspect every page. The Ruxex content preview is not a substitute for
   page-level review.

## Review criteria

- Confirm the title, opening, section order, and tables match the intended
  reader and purpose.
- Preserve dates, figures, qualifications, uncertainty, and source meaning.
- Distinguish extracted content from unsupported elements listed in diagnostics.
- Do not treat a missing preview element as proof that it is absent from the
  original DOCX.

## Limits

The Ruxex reader reconstructs supported paragraphs, headings, and tables.
Images, fields and hyperlinks, headers and footers, comments, notes, and other
advanced OOXML may be reported as diagnostics and are not guaranteed to survive
a load-edit-export round trip. See [Advanced OOXML support](advanced-ooxml.md).
