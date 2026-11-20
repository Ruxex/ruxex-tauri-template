# Distill and Apply DOCX Template Styles

Use a supplied DOCX or DOTX to capture its reusable visual rules, then apply
its style definitions to a separate target document. When the reference controls
the complete new document, follow [Retained template fidelity](template-fidelity.md)
to edit a copy and verify package preservation.

Create a style inventory without copying personal document properties:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper distill-template \
  --input "/absolute/path/reference.dotx" \
  --output "/absolute/path/template-style-guide.md" --json
```

Apply template styles and theme assets to a DOCX copy:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper template-styles-apply \
  --template "/absolute/path/reference.dotx" \
  --input "/absolute/path/draft.docx" \
  --output "/absolute/path/draft-styled.docx" --json
```

The apply helper copies style definitions by style ID, document defaults, theme,
and font table. It merges common numbering definitions and remaps numbering IDs
used by imported styles. It refuses picture bullets because their related media
parts are not imported. It does not rewrite content-specific paragraph or
character style references. Review the style inventory first, then render every
page and check headings, lists, tables, headers, and footers before delivery.
