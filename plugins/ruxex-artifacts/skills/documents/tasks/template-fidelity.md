# Create from a Retained DOCX Template

Use this workflow when a supplied DOCX controls the design or the user expects
the existing template's structure to survive. Use [Template styles](template-styles.md)
when the request is specifically to transplant styles into another document.

## Distill the reference

1. Retain the original DOCX unchanged at an absolute path. Render it with
   [Render and verify](render-verify.md), inspect every page, and record the
   page count, section count, render paths, and visible repeating components.
2. Capture the package inventory before authoring:

   ```sh
   "/absolute/path/to/skill/ruxex-artifacts" docx helper template-fidelity snapshot \
     --reference "/absolute/path/reference.docx" \
     --manifest "/absolute/path/reference-manifest.json" --json
   ```

   The manifest records the source path and SHA-256; each package part's size,
   hash, Word feature counts, and relationship records. Store it beside a
   task-local `artifact.md`. Keep both available throughout editing.
3. Run the style inventory and relevant feature, accessibility, field, comment,
   and section audits. Inspect source XML when the high-level evidence leaves
   a structural question unresolved. Record the exact styles, numbering,
   fields, bookmarks, SDT tags, images, header/footer references and page setup
   that control this template.
4. Write `artifact.md` as an editing contract. Include:

   | Contract | Required evidence |
   | --- | --- |
   | Reference | Retained path, SHA-256 from manifest, render paths, page and section counts |
   | Design | Real style IDs, fonts, spacing, table geometry, recurring page furniture, source components to clone |
   | Editable slots | Exact paragraph text, bookmark, SDT tag or relationship ID; allowed text/structure changes; length constraints |
   | Preserve-only | Package parts and structures outside the approved slots, including relationships and embedded media |
   | Verification | Expected content changes, allowed pagination changes, feature audits and visual checks |

   Give each slot a stable source locator. Mark unsupported features as
   preserve-only. Do not invent content to fill an optional slot. Resolve
   ambiguous slot ownership before changing that source component.

## Build from the retained reference

Make a separate working copy of the retained DOCX. Edit the copied elements in
place with the targeted package helpers in [Create and edit](create-edit.md).
Use its real styles and source components. Keep untouched package parts
byte-for-byte; do not rebuild the template through a shallow `Document.load`
export when it would discard formatting or unsupported structures.

Map the user's content to the approved slots. When it exceeds a slot, shorten
it or clone a source pattern permitted by `artifact.md`. Preserve drawings,
rich controls, numbering, bookmarks and relationships outside the slot. A
plain-text SDT fill may reconstruct its content: use it only when that exact
control's reconstruction is allowed. Otherwise patch only its intended text
nodes and retain its paragraph/run properties and other children.

For fields whose cached values cannot be reliably refreshed locally, preserve
the instructions and set `w:updateFields` in settings through a targeted patch.
Record that Word must refresh them. Avoid a LibreOffice save solely to refresh
fields when it would rewrite preserve-only package parts.

## Verify structural and visual fidelity

Confirm the retained source still matches the manifest, and check the output's
package preservation:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper template-fidelity verify \
  --reference "/absolute/path/reference.docx" \
  --manifest "/absolute/path/reference-manifest.json" \
  --input "/absolute/path/final.docx" \
  --editable-part "word/document.xml" --json
```

List each editable package part explicitly and only when approved in
`artifact.md`. The helper fails on changed preserve-only parts or added/removed
parts. An intentional package addition needs a reviewed contract change and a
manual relationship/content-type check; do not replace the reference baseline
to hide a difference.

An editable-part hash is allowed to change, so this check alone does not prove
that unrelated elements inside `word/document.xml` survived. Review the XML
changes against slot locators and compare the feature counts reported by the
helper. Rerun every relevant audit from distillation and confirm section count,
geometry, styles, numbering, relationships, bookmarks, controls, notes and
fields obey the contract. Investigate every unexplained structural change.

Run [Compare versions](compare-versions.md) in a fresh output directory for
the reference and final DOCX. Inspect every final page. Content differences are
expected; unexplained movement outside the slots, changed recurring page
furniture, broken tables, clipping, missing glyphs or unexpected pagination
require another edit and render. Check that every slot is filled, deliberately
blank, or removed as permitted. Deliver after structural and visual checks
pass, with deferred field refresh or unavailable rendering reported clearly.
