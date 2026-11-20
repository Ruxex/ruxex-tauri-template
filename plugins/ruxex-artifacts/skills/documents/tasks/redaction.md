# Redact DOCX Text

Use this helper to mask or replace regex matches across text runs within each
Word paragraph. It reads the source and writes a separate DOCX.

```sh
"/absolute/path/to/skill/ruxex-artifacts" docx helper redact-text \
  --input "/absolute/path/source.docx" \
  --output "/absolute/path/redacted.docx" \
  --pattern "person@example.test" \
  --replacement "[REDACTED]" --json
```

By default, matches are replaced with a length-preserving `█` mask. A supplied
replacement is repeated or truncated to the matched length; use
`--no-preserve-length` to write it at its natural length. Repeat `--pattern` for
multiple rules, or use `--emails` and `--phones` for common patterns. Headers,
footers, footnotes, and endnotes are processed; comments are included only with
`--include-comments`.

The report lists match counts and changed parts. The helper does not inspect
images, charts, embedded files, or binary metadata and is not a complete
anonymization or secure-erasure tool. Review the report, validate the output,
and search/render the result before sharing it.
