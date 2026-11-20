# Import and fidelity limits

`PresentationFile.importPptx(path)` reads supported text, basic run styles,
shape geometry, simple tables, common cached chart types, embedded images and
crops, notes, deck size, named layouts, placeholders, and simple inherited
master artwork. Unsupported features produce diagnostics, but diagnostics may
not enumerate every loss.

The importer does not reconstruct inherited images, complex master artwork,
arbitrary chart types, or full rich-text range semantics. If importing reports
losses, exporting requires explicit diagnostic acceptance and may discard
unsupported content. Treat such imports as content references unless the task
accepts that loss. Rebuild unsupported visual elements with editable local
objects when needed.

Use `pptx helper inspect-template` and `pptx helper inspect-package-integrity` for read-only
inventory and structure checks. Do not describe a PPTX export as a faithful
round-trip when unsupported content was present.
