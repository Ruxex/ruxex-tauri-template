# Equations

The Ruxex DOCX authoring API does not generate native Word OMML equations. For
simple formulas, use editable text and Unicode symbols when that remains clear
to the reader. For complex notation, use an approved local equation editor to
create a high-resolution PNG and insert it with `Document.addImage`, supplying
alternative text that states the equation in words.

The API accepts PNG, JPEG, GIF, and BMP images; SVG is not accepted directly.
Keep the source equation alongside the DOCX when future edits are likely.
Inspect the rendered page at normal reading size to confirm symbols and
subscripts remain legible. Do not claim that a raster equation is editable
mathematical text.
