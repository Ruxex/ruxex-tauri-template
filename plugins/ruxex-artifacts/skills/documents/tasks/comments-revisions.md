# Comments and Tracked Revisions

Use the local Rust DOCX helpers to inspect comments and revision markup, add
paragraph comments, and accept or reject simple tracked changes. The commands
write a new output document for edits and preserve the input.

Inspect comments or revisions:

```sh
ruxex-artifacts docx helper inspect-review-markup \
  --input "/absolute/path/review.docx" \
  --kind comments --json

ruxex-artifacts docx helper inspect-review-markup \
  --input "/absolute/path/review.docx" \
  --kind revisions --json
```

The report includes classic comment text and anchors, or insertion, deletion,
and move wrapper metadata. It is not a complete threaded-comment model or a
semantic review of revision order.

Add a comment to a zero-based paragraph index:

```sh
ruxex-artifacts docx helper comments-add \
  --input "/absolute/path/review.docx" \
  --output "/absolute/path/review-commented.docx" \
  --paragraph-index 4 \
  --text "Please verify this paragraph." \
  --author "Reviewer" --json
```

For substring matching, repeat `--add contains=comment text`. `--ignore-case`
makes matching case-insensitive, and `--require-all` fails if any requested
substring is missing:

```sh
ruxex-artifacts docx helper comments-add \
  --input "/absolute/path/review.docx" \
  --output "/absolute/path/review-commented.docx" \
  --add "Risk table=Please double-check these values." \
  --ignore-case --require-all --json
```

Update, resolve, or strip classic comments with `comments-manage`:

```sh
ruxex-artifacts docx helper comments-manage \
  --input "/absolute/path/review.docx" \
  --output "/absolute/path/review-updated.docx" \
  --operation update --id 0 --text "Please verify the date." --json
```

Use `--operation resolve --id 0 --resolved true` to mark a comment resolved,
or `--operation strip` to remove classic comment anchors and entries. Resolved
state round-tripping can vary across Word versions. New comments are anchored
to a whole paragraph; arbitrary sub-paragraph ranges and modern threaded
comments are not fully managed.

Extract classic comment text and paragraph anchors to JSON:

```sh
ruxex-artifacts docx helper comments-extract \
  --input "/absolute/path/review.docx" \
  --output-json "/absolute/path/review-comments.json" --json
```

To append, replace, or change the resolved state of existing classic comments,
write a JSON patch file keyed by comment id:

```json
{"ops":[{"id":0,"append":"Follow-up"},{"id":1,"replace":"Updated"},{"id":1,"resolved":true}]}
```

```sh
ruxex-artifacts docx helper comments-apply-patches \
  --input "/absolute/path/review.docx" \
  --patch-json "/absolute/path/comment-patches.json" \
  --output "/absolute/path/review-patched.docx" --json
```

Anchor extraction reports paragraph and marker positions, not exact character
spans.

Accept or reject simple tracked-change wrappers into a separate output:

```sh
ruxex-artifacts docx helper tracked-process \
  --input "/absolute/path/review.docx" \
  --output "/absolute/path/review-accepted.docx" \
  --operation accept --json
```

By default, processing also removes `w:trackRevisions` from
`word/settings.xml`; use `--keep-tracking-on` to preserve it. Use
`--operation reject` to keep deleted or moved-from text and remove inserted or
moved-to text. The helper handles `w:ins`, `w:del`, `w:moveFrom`, and `w:moveTo`
wrappers; it is not a complete Word revision engine.

To add tracked text replacements, pass one or more `OLD=NEW` values:

```sh
ruxex-artifacts docx helper tracked-add-replacements \
  --input "/absolute/path/review.docx" \
  --output "/absolute/path/review-with-changes.docx" \
  --replace "draft=final" --author "Reviewer" --json
```

Each match must fit inside one simple `w:t` text node. Matches across multiple
runs or inside runs containing other inline content are skipped and reported.
Validate and render the result, and keep the original for review.
