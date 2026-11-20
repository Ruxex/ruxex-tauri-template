# Forms and Content Controls

The local helper creates, lists, and fills tagged plain-text Word content
controls. Writing operations produce a new DOCX and leave the original unchanged.

Create a fillable template by authoring visible markers such as `{{ClientName}}`
in ordinary main-body paragraphs, then wrap them:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper content-controls --action wrap-placeholders --json \
  --input "/absolute/path/template.docx" \
  --output "/absolute/path/form.docx"
```

Each marker becomes an inline plain-text control with its exact marker text
still visible. Its tag and alias are the marker name (`ClientName`), and its
numeric ID is allocated deterministically without colliding with existing
control IDs. Surrounding text and run formatting are preserved. Tags must be
unique across the package; repeated names and existing tags are rejected.

Names accept only ASCII letters, digits, underscores, and hyphens. Keep each
complete marker inside a single text-only run; multiple text nodes within that
run are supported. Split, malformed, nested-brace, or non-text markers fail
preflight without creating an output. Markers in hyperlinks or other containers
inside a main-body paragraph also fail. Retype these markers in an ordinary text
run before retrying.

Creation is limited to paragraphs directly under `word/document.xml`'s body.
Table cells, headers, footers, text boxes, footnotes, comments, and existing
controls are left unchanged. If there are no supported markers, creation fails.

List controls:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper content-controls --action list --json \
  --input "/absolute/path/form.docx"
```

Fill all plain-text controls with an exact tag:

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper content-controls --action fill --json \
  --input "/absolute/path/form.docx" \
  --output "/absolute/path/form-filled.docx" \
  --tag "ClientName" \
  --value "A. Example"
```

The helper refuses to overwrite its input or an existing output. Filling
preserves the control tag and existing Word package parts. It only supports
plain-text controls; date, checkbox, dropdown, rich-text, and repeating-section
controls require a compatible Word editor. Validate and render the output after
creation and filling, and confirm the visible control value before delivery.
