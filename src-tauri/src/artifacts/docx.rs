use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use zip::write::FullFileOptions;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

use super::{ArtifactError, cli, ooxml};

const MAX_DOCX_PACKAGE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_DOCX_PART_BYTES: u64 = 2 * 1024 * 1024;

#[path = "docx_content_edit.rs"]
mod content_edit;

pub(super) fn run_docx(args: &[String]) -> Result<Value, ArtifactError> {
    let Some(operation) = args.first().map(String::as_str) else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "a docx operation is required",
        ));
    };
    match operation {
        "helper" => helper_command(&args[1..]),
        "audit" => audit_command(&args[1..]),
        "privacy-scrub" => privacy_scrub_command(&args[1..]),
        "read" => read_command(&args[1..]),
        _ => ooxml::run_ooxml("docx", args),
    }
}

fn helper_command(args: &[String]) -> Result<Value, ArtifactError> {
    let Some(helper) = args.first().map(String::as_str) else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "a DOCX helper operation is required",
        ));
    };
    match helper {
        "audit-features" => audit_command(&args[1..]),
        "distill-template" => distill_template_command(&args[1..]),
        "comments-extract" => comments_extract_command(&args[1..]),
        "comments-manage" => comments_manage_command(&args[1..]),
        "comments-add" => comments_add_command(&args[1..]),
        "comments-apply-patches" => comments_apply_patches_command(&args[1..]),
        "content-controls" => content_controls_command(&args[1..]),
        "inspect-review-markup" => inspect_review_markup_command(&args[1..]),
        "publishing-controls-remove" => publishing_controls_remove_command(&args[1..]),
        "protection-set" => protection_set_command(&args[1..]),
        "rsid-strip" => rsid_strip_command(&args[1..]),
        "style-lint" => style_lint_command(&args[1..]),
        "style-normalize" => style_normalize_command(&args[1..]),
        "tables-to-csv" => tables_to_csv_command(&args[1..]),
        "text-replace" => text_replace_command(&args[1..]),
        "tracked-process" => tracked_process_command(&args[1..]),
        "tracked-add-replacements" => tracked_add_replacements_command(&args[1..]),
        "table-geometry-set" => table_geometry_set_command(&args[1..]),
        "fields-process" => fields_process_command(&args[1..]),
        "reference-fields-insert" => reference_fields_insert_command(&args[1..]),
        "captions-insert" => captions_insert_command(&args[1..]),
        "toc-insert" => toc_insert_command(&args[1..]),
        "internal-nav" => internal_nav_command(&args[1..]),
        "note-insert" => note_insert_command(&args[1..]),
        "template-styles-apply" => template_styles_apply_command(&args[1..]),
        "content-edit" => content_edit::command(&args[1..]),
        "watermark-add" => watermark_add_command(&args[1..]),
        "merge-text" => merge_text_command(&args[1..]),
        "redact-text" => redact_text_command(&args[1..]),
        "merge-append" => merge_append_command(&args[1..]),
        "template-fidelity" => template_fidelity_command(&args[1..]),
        "a11y-fixes" => a11y_fixes_command(&args[1..]),
        _ => Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown DOCX helper: {helper}"),
        )),
    }
}

fn comments_extract_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "output-json" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let input = cli::required_flag(&flags, "input")?;
    let output = cli::required_flag(&flags, "output-json")?;
    extract_docx_comments(input, output)
}

fn comments_manage_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(
            flag.as_str(),
            "input" | "output" | "operation" | "id" | "text" | "resolved" | "--json"
        ) {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let operation = cli::required_flag(&flags, "operation")?;
    if !matches!(operation, "update" | "resolve" | "strip") {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--operation must be update, resolve, or strip",
        ));
    }
    let comment_id = flags
        .iter()
        .find(|(flag, _)| flag == "id")
        .and_then(|(_, value)| value.as_deref());
    let text = flags
        .iter()
        .find(|(flag, _)| flag == "text")
        .and_then(|(_, value)| value.as_deref());
    if operation != "strip" && comment_id.is_none() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--id is required for update and resolve",
        ));
    }
    if operation == "update" && text.is_none() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--text is required for update",
        ));
    }
    let resolved = flags
        .iter()
        .find(|(flag, _)| flag == "resolved")
        .and_then(|(_, value)| value.as_deref())
        .unwrap_or("true");
    if !matches!(resolved, "true" | "false") {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--resolved must be true or false",
        ));
    }
    manage_docx_comments(
        cli::required_flag(&flags, "input")?,
        cli::required_flag(&flags, "output")?,
        operation,
        comment_id,
        text,
        resolved == "true",
    )
}

fn manage_docx_comments(
    input_path: &str,
    output_path: &str,
    operation: &str,
    comment_id: Option<&str>,
    text: Option<&str>,
    resolved: bool,
) -> Result<Value, ArtifactError> {
    let mut changes = 0usize;
    let output = rewrite_docx_package(input_path, output_path, |name, bytes| {
        if !name.starts_with("word/") || !name.ends_with(".xml") || name.starts_with("word/theme/")
        {
            return Ok(());
        }
        let xml = String::from_utf8(bytes.clone())
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        let mut updated = xml.clone();
        if operation == "strip" {
            for tag in [
                "w:commentRangeStart",
                "w:commentRangeEnd",
                "w:commentReference",
            ] {
                let count = xml_element_spans(&updated, tag)?.len();
                let (without_markers, _) = remove_xml_element(&updated, tag)?;
                updated = without_markers;
                changes += count;
            }
            if name == "word/comments.xml" {
                let count = xml_element_spans(&updated, "w:comment")?.len();
                let (without_comments, _) = remove_xml_element(&updated, "w:comment")?;
                updated = without_comments;
                changes += count;
            }
        } else if name == "word/comments.xml" {
            let requested_id = comment_id.unwrap_or_default();
            let spans = xml_element_spans(&updated, "w:comment")?;
            for span in spans.into_iter().rev() {
                let current = &updated[span.start..span.end];
                let attributes = ooxml::elements(current, "w:comment")
                    .into_iter()
                    .next()
                    .unwrap_or_default();
                if attributes.get("w:id").map(String::as_str) != Some(requested_id) {
                    continue;
                }
                let replacement = if operation == "update" {
                    replace_comment_text(current, text.unwrap_or_default())?
                } else if resolved {
                    set_unqualified_attribute_on_tag(
                        current,
                        "w:comment",
                        "w:id",
                        requested_id,
                        "w:done",
                        "1",
                    )?
                } else {
                    remove_attribute_from_tag(current, "w:comment", "w:id", requested_id, "w:done")?
                };
                updated.replace_range(span.start..span.end, &replacement);
                changes += 1;
            }
        }
        if updated != xml {
            *bytes = updated.into_bytes();
        }
        Ok(())
    })?;
    if changes == 0 {
        let _ = fs::remove_file(&output);
        return Err(ArtifactError::new(
            "invalid_arguments",
            "no matching classic comment markup was found",
        ));
    }
    Ok(json!({
        "ok": true,
        "operation": operation,
        "input": input_path,
        "output": output,
        "changes": changes,
        "limitations": [
            "classic comments only; modern threaded comment parts and interoperability are not fully handled"
        ]
    }))
}

fn replace_comment_text(comment: &str, value: &str) -> Result<String, ArtifactError> {
    let comment_open_end = find_xml_tag_end(comment, 0).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", "comment opening tag is malformed")
    })?;
    let paragraph = xml_element_spans(comment, "w:p")?
        .first()
        .map(|span| &comment[span.start..span.end]);
    let paragraph_opening = paragraph
        .and_then(|paragraph| {
            find_xml_tag_end(paragraph, 0).map(|end| paragraph[..=end].to_owned())
        })
        .unwrap_or_else(|| "<w:p>".to_owned());
    let text_opening =
        if value.starts_with(char::is_whitespace) || value.ends_with(char::is_whitespace) {
            "<w:t xml:space=\"preserve\">"
        } else {
            "<w:t>"
        };
    Ok(format!(
        "{}{}<w:r>{}{}{}{}",
        &comment[..=comment_open_end],
        paragraph_opening,
        text_opening,
        escape_xml_text(value),
        "</w:t></w:r></w:p>",
        "</w:comment>"
    ))
}

fn remove_attribute_from_tag(
    xml: &str,
    tag: &str,
    match_attribute: &str,
    match_value: &str,
    attribute: &str,
) -> Result<String, ArtifactError> {
    let opening = format!("<{tag}");
    let mut search_from = 0usize;
    while let Some(relative_start) = xml[search_from..].find(&opening) {
        let start = search_from + relative_start;
        let end = find_xml_tag_end(xml, start).ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", format!("unterminated {tag}"))
        })?;
        let attributes = crate::ooxml::parse_attributes(&xml[start + 1..end]);
        if attributes
            .get(match_attribute)
            .is_some_and(|value| value == match_value)
        {
            let Some(value) = attributes.get(attribute) else {
                return Ok(xml.to_owned());
            };
            let needle = format!("{attribute}=\"{value}\"");
            let attr_start = xml[start..=end].find(&needle).ok_or_else(|| {
                ArtifactError::new("invalid_ooxml_xml", format!("could not remove {attribute}"))
            })? + start;
            let begin = xml[start..attr_start]
                .rfind(char::is_whitespace)
                .map(|offset| start + offset)
                .unwrap_or(attr_start);
            let mut updated = xml.to_owned();
            updated.replace_range(begin..attr_start + needle.len(), "");
            return Ok(updated);
        }
        search_from = end + 1;
    }
    Err(ArtifactError::new(
        "invalid_ooxml_xml",
        format!("could not locate {tag} element"),
    ))
}

fn comments_add_command(args: &[String]) -> Result<Value, ArtifactError> {
    let mut input = None::<String>;
    let mut output = None::<String>;
    let mut paragraph_index = None::<usize>;
    let mut single_text = None::<String>;
    let mut author = "Ruxex".to_owned();
    let mut initials = None::<String>;
    let mut additions = Vec::<(String, String)>::new();
    let mut ignore_case = false;
    let mut require_all = false;
    let mut index = 0usize;
    while index < args.len() {
        let flag = args[index].as_str();
        if flag == "--json" {
            index += 1;
            continue;
        }
        if flag == "--ignore-case" {
            ignore_case = true;
            index += 1;
            continue;
        }
        if flag == "--require-all" {
            require_all = true;
            index += 1;
            continue;
        }
        let value = args.get(index + 1).ok_or_else(|| {
            ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
        })?;
        match flag {
            "--input" => input = Some(value.clone()),
            "--output" => output = Some(value.clone()),
            "--paragraph-index" => {
                paragraph_index = Some(value.parse::<usize>().map_err(|_| {
                    ArtifactError::new(
                        "invalid_arguments",
                        "paragraph index must be a non-negative integer",
                    )
                })?)
            }
            "--text" => single_text = Some(value.clone()),
            "--author" => author = value.clone(),
            "--initials" => initials = Some(value.clone()),
            "--add" => {
                let Some((needle, comment)) = value.split_once('=') else {
                    return Err(ArtifactError::new(
                        "invalid_arguments",
                        "--add must be formatted as contains=comment text",
                    ));
                };
                additions.push((needle.to_owned(), comment.to_owned()));
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
        index += 2;
    }
    let input =
        input.ok_or_else(|| ArtifactError::new("invalid_arguments", "--input is required"))?;
    let output =
        output.ok_or_else(|| ArtifactError::new("invalid_arguments", "--output is required"))?;
    let initials =
        initials.unwrap_or_else(|| author.chars().take(2).collect::<String>().to_uppercase());
    if author.trim().is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "author must not be empty",
        ));
    }
    let has_index = paragraph_index.is_some();
    let has_additions = !additions.is_empty();
    let pattern_mode = !has_index;
    if has_index == has_additions {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "provide either --paragraph-index with --text or one or more --add patterns",
        ));
    }
    let mut unmatched_patterns = Vec::new();
    let requests = if let Some(paragraph_index) = paragraph_index {
        let text = single_text.ok_or_else(|| {
            ArtifactError::new(
                "invalid_arguments",
                "--text is required with --paragraph-index",
            )
        })?;
        if text.trim().is_empty() {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "comment text must be non-empty",
            ));
        }
        vec![(paragraph_index, text)]
    } else {
        if single_text.is_some() {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "--text is only used with --paragraph-index",
            ));
        }
        let paragraphs = read_docx_body_paragraph_texts(&input)?;
        let mut requests = Vec::new();
        for (needle, comment) in additions {
            if needle.is_empty() {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    "comment match patterns must not be empty",
                ));
            }
            if comment.trim().is_empty() {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    "comment text must be non-empty",
                ));
            }
            let target = paragraphs.iter().position(|visible| {
                if ignore_case {
                    visible.to_lowercase().contains(&needle.to_lowercase())
                } else {
                    visible.contains(&needle)
                }
            });
            if let Some(target) = target {
                requests.push((target, comment));
            } else {
                unmatched_patterns.push(needle);
            }
        }
        if require_all && !unmatched_patterns.is_empty() {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!(
                    "{} patterns were not matched: {:?}",
                    unmatched_patterns.len(),
                    unmatched_patterns
                ),
            ));
        }
        requests
    };
    if requests.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("no paragraphs matched the requested patterns: {unmatched_patterns:?}"),
        ));
    }
    let additions = write_docx_comments(&input, &output, &requests, &author, &initials)?;
    let mut result = additions;
    if pattern_mode {
        result["unmatchedPatterns"] = json!(unmatched_patterns);
    }
    Ok(result)
}

fn comments_apply_patches_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "patch-json" | "output" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    apply_docx_comment_patches(
        cli::required_flag(&flags, "input")?,
        cli::required_flag(&flags, "patch-json")?,
        cli::required_flag(&flags, "output")?,
    )
}

fn apply_docx_comment_patches(
    input_path: &str,
    patch_path: &str,
    output_path: &str,
) -> Result<Value, ArtifactError> {
    let patch_source = Path::new(patch_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("patch_read_error", error.to_string()))?;
    if !patch_source.is_file() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "patch JSON must be a regular file",
        ));
    }
    let patch_text = fs::read_to_string(&patch_source)
        .map_err(|error| ArtifactError::new("patch_read_error", error.to_string()))?;
    let patch: Value = serde_json::from_str(&patch_text)
        .map_err(|error| ArtifactError::new("invalid_json", error.to_string()))?;
    let operations = patch.get("ops").and_then(Value::as_array).ok_or_else(|| {
        ArtifactError::new(
            "invalid_arguments",
            "patch JSON must contain an 'ops' array",
        )
    })?;
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    validate_docx_package(source.to_string_lossy().as_ref())?;
    let mut source_archive = ZipArchive::new(
        File::open(&source)
            .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?,
    )
    .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    if !source_archive
        .file_names()
        .any(|name| name == "word/comments.xml")
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "word/comments.xml not found",
        ));
    }
    let comments_xml = read_docx_part(&mut source_archive, "word/comments.xml")?;
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
    let mut updated_comments = comments_xml.clone();
    let mut applied = 0usize;
    let mut touched_ids = std::collections::BTreeSet::<String>::new();
    let mut warnings = Vec::new();
    for (index, operation) in operations.iter().enumerate() {
        let Some(operation) = operation.as_object() else {
            warnings.push(format!("operation {index}: missing comment id"));
            continue;
        };
        let Some(id_value) = operation.get("id").filter(|value| !value.is_null()) else {
            warnings.push(format!("operation {index}: missing comment id"));
            continue;
        };
        let id = json_value_to_python_string(id_value);
        let Some(span) = find_comment_span_by_id(&updated_comments, &id)? else {
            warnings.push(format!("comment id {id} not found"));
            continue;
        };
        let original = &updated_comments[span.start..span.end];
        let mut comment = original.to_owned();
        let mut changed = false;
        if let Some(value) = operation.get("replace").filter(|value| !value.is_null()) {
            comment = replace_comment_paragraphs(&comment, &json_value_to_python_string(value))?;
            changed = true;
        }
        if let Some(value) = operation.get("append").filter(|value| !value.is_null()) {
            for line in split_patch_lines(&json_value_to_python_string(value)) {
                comment = append_comment_paragraph(&comment, &line)?;
            }
            changed = true;
        }
        match operation.get("resolved").and_then(Value::as_bool) {
            Some(true) => {
                comment = set_unqualified_attribute_on_tag(
                    &comment,
                    "w:comment",
                    "w:id",
                    &id,
                    "w:done",
                    "1",
                )?;
                comment = set_unqualified_attribute_on_tag(
                    &comment,
                    "w:comment",
                    "w:id",
                    &id,
                    "w:date",
                    &now,
                )?;
                changed = true;
            }
            Some(false)
                if ooxml::elements(&comment, "w:comment")
                    .first()
                    .is_some_and(|attributes| attributes.contains_key("w:done")) =>
            {
                comment = remove_attribute_from_tag(&comment, "w:comment", "w:id", &id, "w:done")?;
                comment = set_unqualified_attribute_on_tag(
                    &comment,
                    "w:comment",
                    "w:id",
                    &id,
                    "w:date",
                    &now,
                )?;
                changed = true;
            }
            _ => {}
        }
        if changed {
            updated_comments.replace_range(span.start..span.end, &comment);
            applied += 1;
            touched_ids.insert(id);
        }
    }
    if touched_ids.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "no matching comments were changed",
        ));
    }
    let output = rewrite_docx_package(input_path, output_path, |name, bytes| {
        if name == "word/comments.xml" {
            *bytes = updated_comments.as_bytes().to_vec();
        }
        Ok(())
    })?;
    Ok(json!({
        "ok": true,
        "input": source,
        "output": output,
        "comments_touched": touched_ids.len(),
        "ops_applied": applied,
        "warnings": warnings,
        "limitations": ["classic comments only; modern threaded comments are not handled"]
    }))
}

fn json_value_to_python_string(value: &Value) -> String {
    match value {
        Value::String(value) => value.clone(),
        Value::Null => "None".to_owned(),
        Value::Bool(true) => "True".to_owned(),
        Value::Bool(false) => "False".to_owned(),
        Value::Number(value) => value.to_string(),
        _ => value.to_string(),
    }
}

fn split_patch_lines(value: &str) -> Vec<String> {
    value
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_owned)
        .collect()
}

fn find_comment_span_by_id(xml: &str, id: &str) -> Result<Option<BodyChildSpan>, ArtifactError> {
    for span in xml_element_spans(xml, "w:comment")?.into_iter().rev() {
        let comment = &xml[span.start..span.end];
        if ooxml::elements(comment, "w:comment")
            .first()
            .and_then(|attributes| attributes.get("w:id"))
            .is_some_and(|value| value == id)
        {
            return Ok(Some(span));
        }
    }
    Ok(None)
}

fn replace_comment_paragraphs(comment: &str, value: &str) -> Result<String, ArtifactError> {
    let open_end = find_xml_tag_end(comment, 0).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", "comment opening tag is malformed")
    })?;
    let closing = "</w:comment>";
    if !comment.ends_with(closing) {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "comment element is missing its closing tag",
        ));
    }
    let mut preserved_children = String::new();
    for child in direct_child_spans(comment)? {
        if child.name != "w:p" {
            preserved_children.push_str(&comment[child.start..child.end]);
        }
    }
    let lines = split_patch_lines(value);
    let lines = if lines.is_empty() {
        vec![String::new()]
    } else {
        lines
    };
    let paragraphs = lines
        .iter()
        .map(|line| comment_paragraph(line))
        .collect::<String>();
    Ok(format!(
        "{}{}{}{}",
        &comment[..=open_end],
        preserved_children,
        paragraphs,
        closing
    ))
}

fn append_comment_paragraph(comment: &str, value: &str) -> Result<String, ArtifactError> {
    insert_before_root_close(comment, "w:comment", &comment_paragraph(value))
}

fn comment_paragraph(value: &str) -> String {
    let space = if value.starts_with(char::is_whitespace) || value.ends_with(char::is_whitespace) {
        " xml:space=\"preserve\""
    } else {
        ""
    };
    format!(
        "<w:p><w:r><w:t{space}>{}</w:t></w:r></w:p>",
        escape_xml_text(value)
    )
}

fn read_docx_body_paragraph_texts(input_path: &str) -> Result<Vec<String>, ArtifactError> {
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !source.is_file()
        || !source
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular .docx file",
        ));
    }
    validate_docx_package(source.to_string_lossy().as_ref())?;
    let file = File::open(source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let document = read_docx_part(&mut archive, "word/document.xml")?;
    Ok(ordered_docx_blocks(&document, "w:p")
        .into_iter()
        .map(|(_, paragraph)| {
            ooxml::text_values(&paragraph, "w:t")
                .into_iter()
                .chain(ooxml::text_values(&paragraph, "w:delText"))
                .collect()
        })
        .collect())
}

fn write_docx_comments(
    input_path: &str,
    output_path: &str,
    requests: &[(usize, String)],
    author: &str,
    initials: &str,
) -> Result<Value, ArtifactError> {
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !source.is_file() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular .docx file",
        ));
    }
    let source_file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut source_archive = ZipArchive::new(source_file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let document = read_docx_part(&mut source_archive, "word/document.xml")?;
    let paragraph_spans = ordered_docx_blocks(&document, "w:p");
    for (index, _) in requests {
        if *index >= paragraph_spans.len() {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("paragraph index {index} is outside the document body"),
            ));
        }
    }
    let existing_comment_xml = match read_docx_part(&mut source_archive, "word/comments.xml") {
        Ok(xml) => Some(xml),
        Err(error) if error.code == "invalid_ooxml_package" => None,
        Err(error) => return Err(error),
    };
    let next_comment_id = existing_comment_xml
        .as_deref()
        .map(|xml| {
            ooxml::elements(xml, "w:comment")
                .into_iter()
                .filter_map(|attributes| {
                    attributes.get("w:id").and_then(|id| id.parse::<u64>().ok())
                })
                .max()
        })
        .flatten()
        .map(|maximum| maximum.saturating_add(1))
        .unwrap_or(0);
    let mut next_id = next_comment_id;
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
    let mut ids = Vec::with_capacity(requests.len());
    let mut by_paragraph = BTreeMap::<usize, Vec<(u64, String)>>::new();
    let mut comment_fragments = String::new();
    for (paragraph_index, text) in requests {
        if text.trim().is_empty() {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "comment text must be non-empty",
            ));
        }
        let id = next_id;
        next_id = next_id
            .checked_add(1)
            .ok_or_else(|| ArtifactError::new("invalid_arguments", "comment IDs are exhausted"))?;
        ids.push(id);
        by_paragraph
            .entry(*paragraph_index)
            .or_default()
            .push((id, text.clone()));
        comment_fragments.push_str(&format!(
            "<w:comment w:id=\"{id}\" w:author=\"{}\" w:initials=\"{}\" w:date=\"{}\"><w:p><w:pPr><w:pStyle w:val=\"CommentText\"/></w:pPr><w:r><w:t>{}</w:t></w:r></w:p></w:comment>",
            escape_xml_attribute(author),
            escape_xml_attribute(initials),
            escape_xml_attribute(&now),
            escape_xml_text(text),
        ));
    }
    let mut updated_document = document.clone();
    for (paragraph_index, (offset, paragraph)) in paragraph_spans.iter().enumerate().rev() {
        let Some(paragraph_comments) = by_paragraph.get(&paragraph_index) else {
            continue;
        };
        let replacement = insert_comment_markers(paragraph, paragraph_comments)?;
        updated_document.replace_range(*offset..*offset + paragraph.len(), &replacement);
    }
    let mut additional_parts = Vec::new();
    let names = source_archive
        .file_names()
        .map(str::to_owned)
        .collect::<std::collections::HashSet<_>>();
    let comments_xml = if let Some(xml) = existing_comment_xml.as_ref() {
        insert_before_root_close(xml, "w:comments", &comment_fragments)?
    } else {
        format!(
            "<w:comments xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">{comment_fragments}</w:comments>"
        )
    };
    if !names.contains("word/comments.xml") {
        additional_parts.push((
            "word/comments.xml".to_owned(),
            comments_xml.clone().into_bytes(),
        ));
    }
    let relationship_type =
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";
    let relationship_xml = if names.contains("word/_rels/document.xml.rels") {
        None
    } else {
        Some(format!(
            "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"{relationship_type}\" Target=\"comments.xml\"/></Relationships>"
        ))
    };
    if let Some(xml) = relationship_xml {
        additional_parts.push(("word/_rels/document.xml.rels".to_owned(), xml.into_bytes()));
    }
    let output = rewrite_docx_package_with_additional_parts(
        input_path,
        output_path,
        additional_parts,
        |name, bytes| {
            if name == "word/document.xml" {
                *bytes = updated_document.as_bytes().to_vec();
            } else if name == "word/comments.xml" {
                *bytes = comments_xml.as_bytes().to_vec();
            } else if name == "word/_rels/document.xml.rels" {
                let xml = String::from_utf8(bytes.clone())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                let (updated, added) = ensure_comments_relationship(&xml)?;
                if added {
                    *bytes = updated.into_bytes();
                }
            } else if name == "[Content_Types].xml" {
                let xml = String::from_utf8(bytes.clone())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                let (updated, added) = ensure_comments_content_type(&xml)?;
                if added {
                    *bytes = updated.into_bytes();
                }
            }
            Ok(())
        },
    )?;
    Ok(json!({
        "ok": true,
        "output": output,
        "commentIds": ids,
        "paragraphIndexes": requests.iter().map(|(index, _)| index).collect::<Vec<_>>(),
        "addedComments": requests.len(),
        "limitations": ["anchors to an entire body paragraph; classic comments only"]
    }))
}

fn insert_comment_markers(
    paragraph: &str,
    comments: &[(u64, String)],
) -> Result<String, ArtifactError> {
    let children = direct_child_spans(paragraph)?;
    let insertion = children
        .iter()
        .find(|child| child.name == "w:pPr")
        .map(|child| child.end)
        .unwrap_or(0);
    let mut starts = String::new();
    for (id, _) in comments.iter().rev() {
        starts.push_str(&format!("<w:commentRangeStart w:id=\"{id}\"/>"));
    }
    let mut updated = paragraph.to_owned();
    updated.insert_str(insertion, &starts);
    let close = updated.rfind("</w:p>").ok_or_else(|| {
        ArtifactError::new(
            "invalid_ooxml_xml",
            "target paragraph has no closing w:p tag",
        )
    })?;
    let mut endings = String::new();
    for (id, _) in comments {
        endings.push_str(&format!(
            "<w:commentRangeEnd w:id=\"{id}\"/><w:r><w:rPr><w:rStyle w:val=\"CommentReference\"/></w:rPr><w:commentReference w:id=\"{id}\"/></w:r>"
        ));
    }
    updated.insert_str(close, &endings);
    Ok(updated)
}

fn ensure_comments_content_type(xml: &str) -> Result<(String, bool), ArtifactError> {
    const CONTENT_TYPE: &str =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml";
    let matches = ooxml::elements(xml, "Override")
        .into_iter()
        .filter(|attributes| {
            attributes
                .get("PartName")
                .is_some_and(|value| value == "/word/comments.xml")
        })
        .collect::<Vec<_>>();
    if matches.len() > 1 {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "[Content_Types].xml contains duplicate comments overrides",
        ));
    }
    if let Some(attributes) = matches.first() {
        if attributes
            .get("ContentType")
            .is_some_and(|value| value == CONTENT_TYPE)
        {
            return Ok((xml.to_owned(), false));
        }
        return set_unqualified_attribute_on_tag(
            xml,
            "Override",
            "PartName",
            "/word/comments.xml",
            "ContentType",
            CONTENT_TYPE,
        )
        .map(|updated| (updated, true));
    }
    let fragment =
        format!("<Override PartName=\"/word/comments.xml\" ContentType=\"{CONTENT_TYPE}\"/>");
    insert_before_root_close(xml, "Types", &fragment).map(|updated| (updated, true))
}

fn ensure_comments_relationship(xml: &str) -> Result<(String, bool), ArtifactError> {
    const REL_TYPE: &str =
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";
    let matches = ooxml::elements(xml, "Relationship")
        .into_iter()
        .filter(|attributes| {
            attributes
                .get("Type")
                .is_some_and(|value| value == REL_TYPE)
        })
        .collect::<Vec<_>>();
    if matches.len() > 1 {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "document relationships contain duplicate comments relationships",
        ));
    }
    if let Some(attributes) = matches.first() {
        let target = attributes
            .get("Target")
            .map(String::as_str)
            .unwrap_or("")
            .replace('\\', "/");
        let resolved = if target.starts_with('/') {
            target.trim_start_matches('/').to_owned()
        } else {
            format!("word/{target}")
        };
        if resolved != "word/comments.xml" {
            return Err(ArtifactError::new(
                "invalid_ooxml_xml",
                "existing comments relationship does not target word/comments.xml",
            ));
        }
        return Ok((xml.to_owned(), false));
    }
    let used_ids = ooxml::elements(xml, "Relationship")
        .into_iter()
        .filter_map(|attributes| attributes.get("Id").cloned())
        .collect::<std::collections::HashSet<_>>();
    let mut number = 1usize;
    while used_ids.contains(&format!("rId{number}")) {
        number += 1;
    }
    let fragment =
        format!("<Relationship Id=\"rId{number}\" Type=\"{REL_TYPE}\" Target=\"comments.xml\"/>");
    insert_before_root_close(xml, "Relationships", &fragment).map(|updated| (updated, true))
}

fn extract_docx_comments(input_path: &str, output_path: &str) -> Result<Value, ArtifactError> {
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !source.is_file()
        || !source
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular .docx file",
        ));
    }
    validate_docx_package(source.to_string_lossy().as_ref())?;
    let file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let mut comments = BTreeMap::<String, Value>::new();
    if archive.file_names().any(|name| name == "word/comments.xml") {
        let xml = read_docx_part(&mut archive, "word/comments.xml")?;
        for comment in ooxml::blocks(&xml, "w:comment") {
            let attributes = ooxml::elements(&comment, "w:comment")
                .into_iter()
                .next()
                .unwrap_or_default();
            let Some(id) = attributes.get("w:id").cloned() else {
                continue;
            };
            let paragraphs = ooxml::blocks(&comment, "w:p")
                .iter()
                .map(|paragraph| docx_paragraph_text(paragraph))
                .collect::<Result<Vec<_>, _>>()?
                .into_iter()
                .filter(|text| !text.is_empty())
                .collect::<Vec<_>>();
            let text = if paragraphs.is_empty() {
                ooxml::text_values(&comment, "w:t")
                    .join("")
                    .trim()
                    .to_owned()
            } else {
                paragraphs.join("\n")
            };
            comments.insert(
                id.clone(),
                json!({
                    "id": id,
                    "author": attributes.get("w:author"),
                    "date": attributes.get("w:date"),
                    "initials": attributes.get("w:initials"),
                    "resolved": attributes.get("w:done").is_some_and(|value| value == "1"),
                    "text": text,
                    "anchors": [],
                }),
            );
        }
    }

    let mut parts = archive
        .file_names()
        .filter(|name| is_docx_story_part(name))
        .map(str::to_owned)
        .collect::<Vec<_>>();
    parts.sort();
    parts.retain(|part| part != "word/document.xml");
    parts.insert(0, "word/document.xml".to_owned());
    for part in parts {
        if !archive.file_names().any(|name| name == part) {
            continue;
        }
        let xml = read_docx_part(&mut archive, &part)?;
        for paragraph in ooxml::blocks(&xml, "w:p") {
            let (text, markers) = docx_paragraph_text_and_comment_markers(&paragraph)?;
            if markers.is_empty() {
                continue;
            }
            let paragraph = text.chars().take(200).collect::<String>();
            let mut paragraph_markers = BTreeMap::<String, Vec<&str>>::new();
            for (id, marker) in markers {
                paragraph_markers.entry(id).or_default().push(marker);
            }
            for (id, markers) in paragraph_markers {
                if let Some(comment) = comments.get_mut(&id)
                    && let Some(anchors) = comment.get_mut("anchors").and_then(Value::as_array_mut)
                {
                    anchors.push(json!({
                        "part": part,
                        "markers": markers,
                        "paragraph": paragraph,
                    }));
                }
            }
        }
    }

    let mut ids = comments.keys().cloned().collect::<Vec<_>>();
    ids.sort_by(
        |left, right| match (left.parse::<u64>(), right.parse::<u64>()) {
            (Ok(left), Ok(right)) => left.cmp(&right),
            (Ok(_), Err(_)) => std::cmp::Ordering::Less,
            (Err(_), Ok(_)) => std::cmp::Ordering::Greater,
            (Err(_), Err(_)) => left.cmp(right),
        },
    );
    let comment_values = ids
        .into_iter()
        .filter_map(|id| comments.remove(&id))
        .collect::<Vec<_>>();
    let report = json!({
        "file": source.to_string_lossy(),
        "comment_count": comment_values.len(),
        "comments": comment_values,
        "limitations": [
            "classic comments only; modern threaded comment parts are not handled",
            "anchors report containing paragraphs, not exact character spans",
            "comments in shapes and textboxes are not handled",
        ],
    });
    let destination = Path::new(output_path);
    let parent = destination
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(parent)
        .map_err(|error| ArtifactError::new("output_error", error.to_string()))?;
    let destination = parent
        .canonicalize()
        .map_err(|error| ArtifactError::new("output_error", error.to_string()))?
        .join(destination.file_name().ok_or_else(|| {
            ArtifactError::new("invalid_arguments", "output path must include a file name")
        })?);
    let bytes = serde_json::to_vec_pretty(&report)
        .map_err(|error| ArtifactError::new("json_write_error", error.to_string()))?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&destination)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                ArtifactError::new(
                    "output_exists",
                    format!("output already exists: {}", destination.display()),
                )
            } else {
                ArtifactError::new("json_write_error", error.to_string())
            }
        })?;
    if let Err(error) = file.write_all(&[bytes, b"\n".to_vec()].concat()) {
        let _ = fs::remove_file(&destination);
        return Err(ArtifactError::new("json_write_error", error.to_string()));
    }
    Ok(json!({
        "ok": true,
        "output": destination.to_string_lossy(),
        "comment_count": report["comment_count"],
    }))
}

fn is_docx_story_part(part: &str) -> bool {
    if part == "word/document.xml" {
        return true;
    }
    let Some(file_name) = part.strip_prefix("word/") else {
        return false;
    };
    ["header", "footer"].iter().any(|prefix| {
        file_name
            .strip_prefix(prefix)
            .and_then(|rest| rest.strip_suffix(".xml"))
            .is_some_and(|number| {
                !number.is_empty() && number.chars().all(|ch| ch.is_ascii_digit())
            })
    })
}

fn docx_paragraph_text(paragraph: &str) -> Result<String, ArtifactError> {
    Ok(docx_paragraph_text_and_comment_markers(paragraph)?.0)
}

fn docx_paragraph_text_and_comment_markers(
    paragraph: &str,
) -> Result<(String, Vec<(String, &'static str)>), ArtifactError> {
    let mut reader = quick_xml::Reader::from_str(paragraph);
    reader.config_mut().check_end_names = true;
    let mut text = String::new();
    let mut in_text = false;
    let mut markers = Vec::new();
    loop {
        let event = reader
            .read_event()
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        match event {
            quick_xml::events::Event::Start(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if name == "w:t" {
                    in_text = true;
                }
                if name == "w:tab" {
                    text.push('\t');
                } else if name == "w:br" || name == "w:cr" {
                    text.push('\n');
                } else if name == "w:commentRangeStart" || name == "w:commentRangeEnd" {
                    let id = event
                        .attributes()
                        .with_checks(true)
                        .find_map(|attribute| {
                            attribute
                                .ok()
                                .filter(|attribute| attribute.key.as_ref() == b"w:id")
                        })
                        .and_then(|attribute| {
                            attribute.decode_and_unescape_value(reader.decoder()).ok()
                        })
                        .map(|value| value.into_owned());
                    if let Some(id) = id {
                        markers.push((
                            id,
                            if name == "w:commentRangeStart" {
                                "start"
                            } else {
                                "end"
                            },
                        ));
                    }
                }
            }
            quick_xml::events::Event::Empty(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if name == "w:tab" {
                    text.push('\t');
                } else if name == "w:br" || name == "w:cr" {
                    text.push('\n');
                } else if name == "w:commentRangeStart" || name == "w:commentRangeEnd" {
                    for attribute in event.attributes().with_checks(true) {
                        let attribute = attribute.map_err(|error| {
                            ArtifactError::new("invalid_ooxml_xml", error.to_string())
                        })?;
                        if attribute.key.as_ref() == b"w:id" {
                            let id = attribute
                                .decode_and_unescape_value(reader.decoder())
                                .map_err(|error| {
                                    ArtifactError::new("invalid_ooxml_xml", error.to_string())
                                })?
                                .into_owned();
                            markers.push((
                                id,
                                if name == "w:commentRangeStart" {
                                    "start"
                                } else {
                                    "end"
                                },
                            ));
                        }
                    }
                }
            }
            quick_xml::events::Event::Text(event) if in_text => {
                let decoded = event
                    .xml_content()
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                text.push_str(
                    &quick_xml::escape::unescape(&decoded).map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?,
                );
            }
            quick_xml::events::Event::CData(event) if in_text => {
                text.push_str(
                    &event.xml_content().map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?,
                );
            }
            quick_xml::events::Event::End(event) => {
                if event.name().as_ref() == b"w:t" {
                    in_text = false;
                }
            }
            quick_xml::events::Event::Eof => break,
            _ => {}
        }
    }
    Ok((text.trim().to_owned(), markers))
}

fn content_controls_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(
            flag.as_str(),
            "action" | "input" | "output" | "tag" | "value" | "--json"
        ) {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let action = cli::required_flag(&flags, "action")?;
    let input = cli::required_flag(&flags, "input")?;
    match action {
        "list" => list_docx_content_controls(input),
        "wrap-placeholders" => {
            wrap_docx_content_control_placeholders(input, cli::required_flag(&flags, "output")?)
        }
        "fill" => fill_docx_content_control(
            input,
            cli::required_flag(&flags, "output")?,
            cli::required_flag(&flags, "tag")?,
            cli::required_flag(&flags, "value")?,
        ),
        _ => Err(ArtifactError::new(
            "invalid_arguments",
            "--action must be list, wrap-placeholders, or fill",
        )),
    }
}

fn list_docx_content_controls(input_path: &str) -> Result<Value, ArtifactError> {
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !source.is_file()
        || !source
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular .docx file",
        ));
    }
    validate_docx_package(source.to_string_lossy().as_ref())?;
    let file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let parts = archive
        .file_names()
        .filter(|name| {
            name.starts_with("word/") && name.ends_with(".xml") && !name.starts_with("word/theme/")
        })
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let mut controls = Vec::new();
    for part in parts {
        let xml = read_docx_part(&mut archive, &part)?;
        for control in ooxml::blocks(&xml, "w:sdt") {
            let properties = ooxml::blocks(&control, "w:sdtPr")
                .into_iter()
                .next()
                .unwrap_or_default();
            let tag = ooxml::elements(&properties, "w:tag")
                .first()
                .and_then(|attributes| attributes.get("w:val"))
                .cloned()
                .unwrap_or_default();
            let alias = ooxml::elements(&properties, "w:alias")
                .first()
                .and_then(|attributes| attributes.get("w:val"))
                .cloned()
                .unwrap_or_default();
            let content = ooxml::blocks(&control, "w:sdtContent")
                .into_iter()
                .next()
                .unwrap_or_default();
            controls.push(json!({
                "part": part,
                "tag": tag,
                "alias": alias,
                "type": if ooxml::elements(&properties, "w:text").is_empty() { "other" } else { "plainText" },
                "text": ooxml::text_values(&content, "w:t").join(""),
            }));
        }
    }
    Ok(json!({"ok": true, "controls": controls}))
}

fn wrap_docx_content_control_placeholders(
    input_path: &str,
    output_path: &str,
) -> Result<Value, ArtifactError> {
    let (mut tags, mut ids) = read_content_control_metadata(input_path)?;
    let mut created_tags = Vec::new();
    let output = rewrite_docx_package(input_path, output_path, |name, bytes| {
        if name == "word/document.xml" {
            let xml = String::from_utf8(bytes.clone())
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
            let (updated, tags_created) = wrap_docx_placeholder_xml(&xml, &mut tags, &mut ids)?;
            *bytes = updated.into_bytes();
            created_tags = tags_created;
        }
        Ok(())
    })?;
    if created_tags.is_empty() {
        let _ = fs::remove_file(&output);
        return Err(ArtifactError::new(
            "invalid_arguments",
            "no {{TAG}} placeholders found in supported main-body paragraphs",
        ));
    }
    Ok(json!({
        "ok": true,
        "output": output,
        "matches": created_tags.len(),
        "tags": created_tags,
        "parts": ["word/document.xml"],
    }))
}

fn read_content_control_metadata(
    input_path: &str,
) -> Result<
    (
        std::collections::HashSet<String>,
        std::collections::HashSet<i64>,
    ),
    ArtifactError,
> {
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !source.is_file()
        || !source
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular .docx file",
        ));
    }
    validate_docx_package(source.to_string_lossy().as_ref())?;
    let file = File::open(source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let names = archive.file_names().map(str::to_owned).collect::<Vec<_>>();
    let mut tags = std::collections::HashSet::new();
    let mut ids = std::collections::HashSet::new();
    for name in names.into_iter().filter(|name| {
        name.starts_with("word/") && name.ends_with(".xml") && !name.starts_with("word/theme/")
    }) {
        let xml = read_docx_part(&mut archive, &name)?;
        for control in ooxml::blocks(&xml, "w:sdt") {
            let properties = ooxml::blocks(&control, "w:sdtPr")
                .into_iter()
                .next()
                .unwrap_or_default();
            if let Some(tag) = ooxml::elements(&properties, "w:tag")
                .first()
                .and_then(|attributes| attributes.get("w:val"))
            {
                tags.insert(tag.clone());
            }
            if let Some(id) = ooxml::elements(&properties, "w:id")
                .first()
                .and_then(|attributes| attributes.get("w:val"))
            {
                ids.insert(id.parse::<i64>().map_err(|_| {
                    ArtifactError::new(
                        "invalid_ooxml_xml",
                        "existing content-control ID must be an integer",
                    )
                })?);
            }
        }
    }
    Ok((tags, ids))
}

fn wrap_docx_placeholder_xml(
    xml: &str,
    tags: &mut std::collections::HashSet<String>,
    ids: &mut std::collections::HashSet<i64>,
) -> Result<(String, Vec<String>), ArtifactError> {
    let paragraphs = direct_body_children(xml)?
        .into_iter()
        .filter(|child| child.name == "w:p")
        .collect::<Vec<_>>();
    let mut paragraph_edits = Vec::new();
    let mut created = Vec::new();
    let mut next_id = 1i64;
    for paragraph_span in paragraphs {
        let paragraph = &xml[paragraph_span.start..paragraph_span.end];
        let children = direct_child_spans(paragraph)?;
        let full_text = children
            .iter()
            .filter(|child| child.name != "w:sdt")
            .map(|child| ooxml::text_values(&paragraph[child.start..child.end], "w:t").join(""))
            .collect::<String>();
        let matches = placeholder_matches(&full_text)?;
        if matches.is_empty() {
            continue;
        }
        let mut found = 0usize;
        let mut edits = Vec::<(usize, usize, String)>::new();
        for child in children.iter().filter(|child| child.name != "w:sdt") {
            let child_xml = &paragraph[child.start..child.end];
            let child_text = ooxml::text_values(child_xml, "w:t").join("");
            let tokens = placeholder_matches(&child_text)?;
            if tokens.is_empty() {
                continue;
            }
            if child.name != "w:r" {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    "markers must be in a direct paragraph run containing only text and run properties",
                ));
            }
            if direct_child_spans(child_xml)?
                .iter()
                .any(|node| node.name != "w:rPr" && node.name != "w:t")
            {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    "markers require a direct paragraph run containing only text and run properties",
                ));
            }
            let mut token_ids = Vec::with_capacity(tokens.len());
            for (_, _, tag) in &tokens {
                if !tags.insert(tag.clone()) {
                    return Err(ArtifactError::new(
                        "invalid_arguments",
                        format!("duplicate or existing content-control tag: {tag:?}"),
                    ));
                }
                while ids.contains(&next_id) {
                    next_id = next_id.checked_add(1).ok_or_else(|| {
                        ArtifactError::new("invalid_arguments", "content-control IDs are exhausted")
                    })?;
                }
                ids.insert(next_id);
                token_ids.push(next_id);
                next_id = next_id.checked_add(1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", "content-control IDs are exhausted")
                })?;
                created.push(tag.clone());
            }
            found += tokens.len();
            edits.push((
                child.start,
                child.end,
                wrap_placeholder_run(child_xml, &child_text, &tokens, &token_ids)?,
            ));
        }
        if found != matches.len() {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "markers split across runs or unsupported containers must be retyped in a single text run",
            ));
        }
        let mut updated = paragraph.to_owned();
        for (start, end, replacement) in edits.into_iter().rev() {
            updated.replace_range(start..end, &replacement);
        }
        paragraph_edits.push((paragraph_span.start, paragraph_span.end, updated));
    }
    if created.is_empty() {
        return Ok((xml.to_owned(), created));
    }
    let mut updated = xml.to_owned();
    for (start, end, paragraph) in paragraph_edits.into_iter().rev() {
        updated.replace_range(start..end, &paragraph);
    }
    Ok((updated, created))
}

fn placeholder_matches(text: &str) -> Result<Vec<(usize, usize, String)>, ArtifactError> {
    let expression = regex::Regex::new(r"\{\{([A-Za-z0-9_-]+)\}\}")
        .map_err(|error| ArtifactError::new("invalid_arguments", error.to_string()))?;
    let mut tokens = Vec::new();
    let mut remainder = String::new();
    let mut cursor = 0usize;
    for captures in expression.captures_iter(text) {
        let whole = captures
            .get(0)
            .expect("placeholder match has a full capture");
        if text[..whole.start()].ends_with('{') || text[whole.end()..].starts_with('}') {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "malformed or unsupported {{TAG}} marker in main-body paragraph",
            ));
        }
        remainder.push_str(&text[cursor..whole.start()]);
        cursor = whole.end();
        tokens.push((whole.start(), whole.end(), captures[1].to_owned()));
    }
    remainder.push_str(&text[cursor..]);
    if remainder.contains("{{") || remainder.contains("}}") {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "malformed or unsupported {{TAG}} marker in main-body paragraph",
        ));
    }
    Ok(tokens)
}

fn wrap_placeholder_run(
    run: &str,
    text: &str,
    tokens: &[(usize, usize, String)],
    token_ids: &[i64],
) -> Result<String, ArtifactError> {
    let open_end = find_xml_tag_end(run, 0).ok_or_else(|| {
        ArtifactError::new(
            "invalid_ooxml_xml",
            "content-control run opening tag is malformed",
        )
    })?;
    let opening = &run[..=open_end];
    let properties = direct_child_spans(run)?
        .into_iter()
        .find(|child| child.name == "w:rPr")
        .map(|child| run[child.start..child.end].to_owned())
        .unwrap_or_default();
    let mut output = String::new();
    let mut cursor = 0usize;
    for (index, (start, end, tag)) in tokens.iter().enumerate() {
        if *start > cursor {
            output.push_str(&content_control_text_run(
                opening,
                &properties,
                &text[cursor..*start],
            ));
        }
        let id = token_ids[index];
        output.push_str(&format!(
            "<w:sdt><w:sdtPr><w:tag w:val=\"{}\"/><w:alias w:val=\"{}\"/><w:id w:val=\"{id}\"/><w:text/></w:sdtPr><w:sdtContent>{}</w:sdtContent></w:sdt>",
            escape_xml_attribute(tag),
            escape_xml_attribute(tag),
            content_control_text_run(opening, &properties, &text[*start..*end])
        ));
        cursor = *end;
    }
    if cursor < text.len() {
        output.push_str(&content_control_text_run(
            opening,
            &properties,
            &text[cursor..],
        ));
    }
    Ok(output)
}

fn content_control_text_run(opening: &str, properties: &str, text: &str) -> String {
    let text_opening =
        if text.starts_with(char::is_whitespace) || text.ends_with(char::is_whitespace) {
            "<w:t xml:space=\"preserve\">"
        } else {
            "<w:t>"
        };
    format!(
        "{}{}{}{}{}",
        opening,
        properties,
        text_opening,
        escape_xml_text(text),
        "</w:t></w:r>"
    )
}

fn direct_child_spans(xml: &str) -> Result<Vec<BodyChildSpan>, ArtifactError> {
    let mut reader = quick_xml::Reader::from_str(xml);
    reader.config_mut().check_end_names = true;
    let mut stack = Vec::<String>::new();
    let mut direct_child = None::<(String, usize, usize)>;
    let mut children = Vec::new();
    loop {
        let event_start = reader.buffer_position() as usize;
        let event = reader
            .read_event()
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        let event_end = reader.buffer_position() as usize;
        match event {
            quick_xml::events::Event::Start(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if stack.len() == 1 {
                    direct_child = Some((name.clone(), event_start, stack.len() + 1));
                }
                stack.push(name);
            }
            quick_xml::events::Event::Empty(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if stack.len() == 1 {
                    children.push(BodyChildSpan {
                        name,
                        start: event_start,
                        end: event_end,
                    });
                }
            }
            quick_xml::events::Event::End(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if let Some((child_name, start, depth)) = direct_child.as_ref()
                    && *child_name == name
                    && stack.len() == *depth
                {
                    children.push(BodyChildSpan {
                        name: child_name.clone(),
                        start: *start,
                        end: event_end,
                    });
                    direct_child = None;
                }
                stack.pop();
            }
            quick_xml::events::Event::Eof => break,
            _ => {}
        }
    }
    Ok(children)
}

fn fill_docx_content_control(
    input_path: &str,
    output_path: &str,
    requested_tag: &str,
    value: &str,
) -> Result<Value, ArtifactError> {
    if requested_tag.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "tag must be non-empty",
        ));
    }
    let mut modified_parts = Vec::new();
    let output = rewrite_docx_package(input_path, output_path, |name, bytes| {
        if !name.starts_with("word/") || !name.ends_with(".xml") || name.starts_with("word/theme/")
        {
            return Ok(());
        }
        let xml = String::from_utf8(bytes.clone())
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        let mut updated = xml.clone();
        let mut control_starts = xml_element_spans(&xml, "w:sdt")?
            .into_iter()
            .map(|span| span.start)
            .collect::<Vec<_>>();
        control_starts.reverse();
        let mut part_matches = 0usize;
        for start in control_starts {
            let Some(control_span) = xml_element_spans(&updated, "w:sdt")?
                .into_iter()
                .find(|span| span.start == start)
            else {
                continue;
            };
            let control = &updated[control_span.start..control_span.end];
            let properties = xml_element_spans(control, "w:sdtPr")?
                .into_iter()
                .next()
                .map(|span| control[span.start..span.end].to_owned())
                .unwrap_or_default();
            let tag_attributes = ooxml::elements(&properties, "w:tag");
            let tag = tag_attributes
                .first()
                .and_then(|attributes| attributes.get("w:val"));
            if tag.map(String::as_str) != Some(requested_tag) {
                continue;
            }
            if ooxml::elements(&properties, "w:text").is_empty() {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("tag {requested_tag:?} is not a plain-text content control"),
                ));
            }
            let replaced = replace_content_control_text(control, value)?;
            updated.replace_range(control_span.start..control_span.end, &replaced);
            part_matches += 1;
        }
        if part_matches > 0 {
            *bytes = updated.into_bytes();
            modified_parts.extend(std::iter::repeat_n(name.to_owned(), part_matches));
        }
        Ok(())
    })?;
    let matches = modified_parts.len();
    if matches == 0 {
        let _ = fs::remove_file(&output);
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("no plain-text content control found with tag {requested_tag:?}"),
        ));
    }
    Ok(json!({
        "ok": true,
        "output": output,
        "tag": requested_tag,
        "value": value,
        "matches": matches,
        "parts": modified_parts,
    }))
}

fn replace_content_control_text(control: &str, value: &str) -> Result<String, ArtifactError> {
    let content_span = xml_element_spans(control, "w:sdtContent")?
        .into_iter()
        .next()
        .ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", "content control has no sdtContent")
        })?;
    let content = &control[content_span.start..content_span.end];
    let text_spans = xml_element_spans(content, "w:t")?;
    let mut updated_content = content.to_owned();
    if let Some(first) = text_spans.first() {
        for (index, span) in text_spans.iter().enumerate().rev() {
            let replacement = if index == 0 {
                set_xml_text_element(&content[span.start..span.end], "w:t", value)?
            } else {
                set_xml_text_element(&content[span.start..span.end], "w:t", "")?
            };
            updated_content.replace_range(span.start..span.end, &replacement);
        }
        let _ = first;
    } else {
        let run = format!(
            "<w:r>{}</w:r>",
            set_xml_text_element("<w:t></w:t>", "w:t", value)?
        );
        let paragraphs = xml_element_spans(content, "w:p")?;
        if let Some(paragraph) = paragraphs.first() {
            let closing = content[..paragraph.end].rfind("</w:p>").ok_or_else(|| {
                ArtifactError::new("invalid_ooxml_xml", "paragraph is unterminated")
            })?;
            updated_content.insert_str(closing, &run);
        } else if let Some(existing_run) = xml_element_spans(content, "w:r")?.first() {
            let closing = content[..existing_run.end]
                .rfind("</w:r>")
                .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "run is unterminated"))?;
            updated_content
                .insert_str(closing, &set_xml_text_element("<w:t></w:t>", "w:t", value)?);
        } else {
            let content_close = content.rfind("</w:sdtContent>").ok_or_else(|| {
                ArtifactError::new(
                    "invalid_ooxml_xml",
                    "content control content is unterminated",
                )
            })?;
            updated_content.insert_str(content_close, &format!("<w:p>{run}</w:p>"));
        }
    }
    let mut updated = control.to_owned();
    updated.replace_range(content_span.start..content_span.end, &updated_content);
    Ok(updated)
}

fn set_xml_text_element(block: &str, tag: &str, value: &str) -> Result<String, ArtifactError> {
    let open_end = find_xml_tag_end(block, 0).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", "text node opening tag is malformed")
    })?;
    let mut opening = block[..=open_end].to_owned();
    opening = set_xml_space_attribute(
        &opening,
        value.starts_with(char::is_whitespace) || value.ends_with(char::is_whitespace),
    );
    if opening.trim_end().ends_with("/>") {
        let slash = opening.rfind('/').ok_or_else(|| {
            ArtifactError::new(
                "invalid_ooxml_xml",
                "empty text node opening tag is malformed",
            )
        })?;
        opening.replace_range(slash..slash + 1, "");
        return Ok(format!("{}{}</{}>", opening, escape_xml_text(value), tag));
    }
    let closing = format!("</{tag}>");
    let close_start = block.rfind(&closing).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", "text node closing tag is missing")
    })?;
    Ok(format!(
        "{}{}{}",
        opening,
        escape_xml_text(value),
        &block[close_start..]
    ))
}

fn set_xml_space_attribute(opening: &str, preserve: bool) -> String {
    let Some(start) = opening.find("xml:space") else {
        if !preserve {
            return opening.to_owned();
        }
        let insertion = if opening.trim_end().ends_with("/>") {
            opening.rfind('/').unwrap_or(opening.len() - 1)
        } else {
            opening.rfind('>').unwrap_or(opening.len())
        };
        let mut updated = opening.to_owned();
        updated.insert_str(insertion, " xml:space=\"preserve\"");
        return updated;
    };
    let Some(equal) = opening[start..].find('=') else {
        return opening.to_owned();
    };
    let value_start = start + equal + 1;
    let quote_start = opening[value_start..]
        .find(['"', '\''])
        .map(|offset| value_start + offset);
    let Some(quote_start) = quote_start else {
        return opening.to_owned();
    };
    let quote = opening.as_bytes()[quote_start] as char;
    let Some(value_end_offset) = opening[quote_start + 1..].find(quote) else {
        return opening.to_owned();
    };
    let value_end = quote_start + 1 + value_end_offset;
    if preserve {
        let mut updated = opening.to_owned();
        updated.replace_range(quote_start + 1..value_end, "preserve");
        updated
    } else {
        let attribute_start = opening[..start].rfind(char::is_whitespace).unwrap_or(start);
        let mut updated = opening.to_owned();
        updated.replace_range(attribute_start..value_end + 1, "");
        updated
    }
}

fn xml_element_spans(xml: &str, target: &str) -> Result<Vec<BodyChildSpan>, ArtifactError> {
    let mut reader = quick_xml::Reader::from_str(xml);
    reader.config_mut().check_end_names = true;
    let mut stack = Vec::<(String, usize)>::new();
    let mut spans = Vec::new();
    loop {
        let start = reader.buffer_position() as usize;
        let event = reader
            .read_event()
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        let end = reader.buffer_position() as usize;
        match event {
            quick_xml::events::Event::Start(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                stack.push((name, start));
            }
            quick_xml::events::Event::Empty(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if name == target {
                    spans.push(BodyChildSpan {
                        name: name.to_owned(),
                        start,
                        end,
                    });
                }
            }
            quick_xml::events::Event::End(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if let Some((opened, opened_at)) = stack.pop()
                    && opened == name
                    && name == target
                {
                    spans.push(BodyChildSpan {
                        name: opened,
                        start: opened_at,
                        end,
                    });
                }
            }
            quick_xml::events::Event::Eof => break,
            _ => {}
        }
    }
    spans.sort_by_key(|span| span.start);
    Ok(spans)
}

fn watermark_add_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(
            flag.as_str(),
            "input" | "output" | "text" | "header-part" | "--json"
        ) {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let input = cli::required_flag(&flags, "input")?;
    let output = cli::required_flag(&flags, "output")?;
    let text = cli::required_flag(&flags, "text")?;
    let header_part = flags
        .iter()
        .find(|(flag, _)| flag == "header-part")
        .and_then(|(_, value)| value.as_deref());
    add_docx_watermark(input, output, text, header_part)
}

fn add_docx_watermark(
    input_path: &str,
    output_path: &str,
    text: &str,
    requested_header: Option<&str>,
) -> Result<Value, ArtifactError> {
    if text.trim().is_empty() || !text.chars().all(is_valid_xml_character) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "watermark text must be non-empty valid XML text",
        ));
    }
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !source.is_file()
        || !source
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular .docx file",
        ));
    }
    let output = Path::new(output_path);
    if !output
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "output must be a different .docx file",
        ));
    }
    let output_parent = output
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(output_parent)
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
    let output = output_parent
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?
        .join(output.file_name().ok_or_else(|| {
            ArtifactError::new("invalid_arguments", "output path must include a file name")
        })?);
    if output == source {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input and output paths must be different",
        ));
    }
    if fs::metadata(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?
        .len()
        > MAX_DOCX_PACKAGE_BYTES
    {
        return Err(ArtifactError::new(
            "package_too_large",
            "DOCX exceeds the 64 MiB operation limit",
        ));
    }

    let mut archive = ZipArchive::new(
        File::open(&source)
            .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?,
    )
    .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let archive_comment = archive.comment().to_vec();
    let mut names = std::collections::HashSet::with_capacity(archive.len());
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
        if !names.insert(entry.name().to_owned()) {
            return Err(ArtifactError::new(
                "invalid_ooxml_package",
                "duplicate ZIP part names make the header target ambiguous",
            ));
        }
    }
    let document_xml = read_docx_part(&mut archive, "word/document.xml").map_err(|_| {
        ArtifactError::new(
            "invalid_ooxml_package",
            "no usable referenced header: document part is missing",
        )
    })?;
    let relationships_xml =
        read_docx_part(&mut archive, "word/_rels/document.xml.rels").map_err(|_| {
            ArtifactError::new(
                "invalid_ooxml_package",
                "no usable referenced header: relationships part is missing",
            )
        })?;
    let relationships = ooxml::elements(&relationships_xml, "Relationship");
    let mut by_id = BTreeMap::<String, (String, String, String)>::new();
    for relationship in relationships {
        let Some(id) = relationship.get("Id") else {
            continue;
        };
        let record = (
            relationship.get("Type").cloned().unwrap_or_default(),
            relationship.get("TargetMode").cloned().unwrap_or_default(),
            relationship.get("Target").cloned().unwrap_or_default(),
        );
        if by_id.insert(id.clone(), record).is_some() {
            return Err(ArtifactError::new(
                "invalid_ooxml_package",
                "duplicate relationship IDs make the header target ambiguous",
            ));
        }
    }
    let mut referenced_headers = std::collections::BTreeSet::new();
    for reference in ooxml::elements(&document_xml, "w:headerReference") {
        let relationship_id = reference.get("r:id").ok_or_else(|| {
            ArtifactError::new(
                "invalid_ooxml_package",
                "header reference has no relationship ID",
            )
        })?;
        let (kind, mode, target) = by_id.get(relationship_id).ok_or_else(|| {
            ArtifactError::new(
                "invalid_ooxml_package",
                "header reference has no matching relationship",
            )
        })?;
        if kind != "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header"
            || (!mode.is_empty() && mode != "Internal")
        {
            return Err(ArtifactError::new(
                "invalid_ooxml_package",
                "header reference must point to an internal header relationship",
            ));
        }
        let part = if let Some(target) = target.strip_prefix('/') {
            target.to_string()
        } else {
            crate::ooxml::normalize_target(target, "word")
        };
        if !part.starts_with("word/")
            || !part.ends_with(".xml")
            || !names.contains(&part)
            || part.split('/').any(|component| component == "..")
        {
            return Err(ArtifactError::new(
                "invalid_ooxml_package",
                "referenced header part is missing or outside word/*.xml",
            ));
        }
        referenced_headers.insert(part);
    }
    let selected_header = if let Some(requested) = requested_header {
        if !referenced_headers.contains(requested) {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "--header-part must name an existing referenced header part",
            ));
        }
        requested.to_owned()
    } else {
        match referenced_headers.len() {
            0 => {
                return Err(ArtifactError::new(
                    "invalid_ooxml_package",
                    "no usable referenced header; this helper does not create headers",
                ));
            }
            1 => referenced_headers.into_iter().next().unwrap_or_default(),
            _ => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    "multiple referenced headers; select one with --header-part",
                ));
            }
        }
    };
    let header_xml = read_docx_part(&mut archive, &selected_header)?;
    let xml = header_xml.as_str();
    let root_name = validate_header_root(xml)?;
    let namespace_prefix = choose_vml_prefix(xml, &root_name)?;
    let ids = ooxml::elements(xml, "v:shape")
        .into_iter()
        .filter_map(|attributes| attributes.get("id").cloned())
        .chain(
            ooxml::elements(xml, "v:shapetype")
                .into_iter()
                .filter_map(|attributes| attributes.get("id").cloned()),
        )
        .collect::<std::collections::HashSet<_>>();
    let mut number = 1usize;
    while ids.contains(&format!("RuxexWatermark{number}"))
        || ids.contains(&format!("RuxexWatermarkType{number}"))
    {
        number += 1;
    }
    let snippet = watermark_vml(&namespace_prefix, number, text);
    let patched = insert_header_watermark(xml, &root_name, &namespace_prefix, &snippet)?;
    let header_xml = patched.into_bytes();
    drop(archive);

    let output_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&output)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                ArtifactError::new(
                    "output_exists",
                    format!("output already exists: {}", output.display()),
                )
            } else {
                ArtifactError::new("ooxml_write_error", error.to_string())
            }
        })?;
    let write_result = rewrite_docx_preserving_zip(
        &source,
        output_file,
        &selected_header,
        &header_xml,
        &archive_comment,
    );
    if let Err(error) = write_result {
        let _ = fs::remove_file(&output);
        return Err(error);
    }
    Ok(json!({
        "ok": true,
        "input": source,
        "output": output,
        "modifiedParts": [selected_header],
        "limitations": [
            "adds to one existing referenced header only; other section/first-page/even-page headers are unchanged",
            "classic VML text only; renderer appearance varies; render and inspect every page"
        ]
    }))
}

fn rewrite_docx_preserving_zip(
    source: &Path,
    output: File,
    target_part: &str,
    target_xml: &[u8],
    archive_comment: &[u8],
) -> Result<(), ArtifactError> {
    let mut input = ZipArchive::new(
        File::open(source)
            .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?,
    )
    .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let mut writer = ZipWriter::new(output);
    writer.set_raw_comment(archive_comment.to_vec().into_boxed_slice());
    let mut total = 0u64;
    for index in 0..input.len() {
        let entry = input
            .by_index(index)
            .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
        let name = entry.name().to_owned();
        let is_directory = entry.is_dir();
        let comment = entry.comment().to_owned();
        let compression = entry.compression();
        let modified = entry.last_modified().unwrap_or_default();
        let mode = entry
            .unix_mode()
            .unwrap_or(if is_directory { 0o755 } else { 0o644 });
        let extra = entry.extra_data().unwrap_or_default().to_vec();
        let mut bytes = Vec::new();
        if !is_directory {
            entry
                .take(MAX_DOCX_PACKAGE_BYTES + 1)
                .read_to_end(&mut bytes)
                .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
            total += bytes.len() as u64;
            if total > MAX_DOCX_PACKAGE_BYTES {
                return Err(ArtifactError::new(
                    "package_too_large",
                    "uncompressed DOCX content exceeds the 64 MiB operation limit",
                ));
            }
        }
        let contents = if name == target_part {
            target_xml
        } else {
            &bytes
        };
        let mut options = FullFileOptions::default()
            .compression_method(compression)
            .last_modified_time(modified)
            .unix_permissions(mode & 0o777)
            .with_file_comment(comment);
        append_zip_extra_fields(&mut options, &extra)?;
        if is_directory {
            writer
                .add_directory(name, options)
                .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
        } else {
            writer
                .start_file(name, options)
                .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
            writer
                .write_all(contents)
                .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
        }
    }
    writer
        .finish()
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
    Ok(())
}

fn append_zip_extra_fields(
    options: &mut FullFileOptions<'static>,
    extra: &[u8],
) -> Result<(), ArtifactError> {
    let mut cursor = 0usize;
    while cursor + 4 <= extra.len() {
        let id = u16::from_le_bytes([extra[cursor], extra[cursor + 1]]);
        let length = u16::from_le_bytes([extra[cursor + 2], extra[cursor + 3]]) as usize;
        cursor += 4;
        let end = cursor
            .checked_add(length)
            .filter(|end| *end <= extra.len())
            .ok_or_else(|| {
                ArtifactError::new("invalid_ooxml_package", "malformed ZIP extra field")
            })?;
        if id != 0x0001 {
            options
                .add_extra_data(id, &extra[cursor..end], false)
                .map_err(|error| ArtifactError::new("archive_metadata_error", error.to_string()))?;
        }
        cursor = end;
    }
    if cursor != extra.len() {
        return Err(ArtifactError::new(
            "invalid_ooxml_package",
            "malformed ZIP extra field",
        ));
    }
    Ok(())
}

fn validate_header_root(xml: &str) -> Result<String, ArtifactError> {
    let mut reader = quick_xml::Reader::from_str(xml);
    reader.config_mut().check_end_names = true;
    let mut root = None;
    let mut depth = 0usize;
    loop {
        match reader.read_event() {
            Ok(quick_xml::events::Event::Start(event)) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if root.is_none() {
                    root = Some(name.clone());
                }
                depth += 1;
            }
            Ok(quick_xml::events::Event::Empty(event)) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if root.is_none() {
                    root = Some(name);
                }
            }
            Ok(quick_xml::events::Event::End(_)) => depth = depth.saturating_sub(1),
            Ok(quick_xml::events::Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(ArtifactError::new("invalid_ooxml_xml", error.to_string())),
        }
    }
    let root =
        root.ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "header XML is empty"))?;
    if depth != 0 {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "header XML is incomplete",
        ));
    }
    let expected_namespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    let prefix = root.split_once(':').map(|(prefix, _)| prefix);
    let expected_qname = if prefix.is_some() {
        format!("{}:hdr", prefix.unwrap_or_default())
    } else {
        "hdr".to_owned()
    };
    if root != expected_qname {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "selected header must have a w:hdr root",
        ));
    }
    let start = xml
        .find(&format!("<{root}"))
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "header root element is missing"))?;
    let end = xml[start..]
        .find('>')
        .map(|offset| start + offset)
        .ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", "header root start tag is incomplete")
        })?;
    let attributes = crate::ooxml::parse_attributes(&xml[start + root.len() + 1..end]);
    let namespace_name = prefix.map_or("xmlns".to_owned(), |prefix| format!("xmlns:{prefix}"));
    if attributes.get(&namespace_name).map(String::as_str) != Some(expected_namespace) {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "selected header must have a w:hdr root",
        ));
    }
    Ok(root)
}

fn choose_vml_prefix(xml: &str, root: &str) -> Result<String, ArtifactError> {
    let start = xml
        .find(&format!("<{root}"))
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "header root element is missing"))?;
    let end = xml[start..]
        .find('>')
        .map(|offset| start + offset)
        .ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", "header root start tag is incomplete")
        })?;
    let attributes = crate::ooxml::parse_attributes(&xml[start + root.len() + 1..end]);
    if attributes.get("xmlns:v").map(String::as_str) == Some("urn:schemas-microsoft-com:vml") {
        return Ok("v".to_owned());
    }
    let mut index = 1usize;
    loop {
        let prefix = if index == 1 {
            "ruxexv".to_owned()
        } else {
            format!("ruxexv{index}")
        };
        if !attributes.contains_key(&format!("xmlns:{prefix}")) {
            return Ok(prefix);
        }
        index += 1;
    }
}

fn insert_header_watermark(
    xml: &str,
    root: &str,
    prefix: &str,
    snippet: &str,
) -> Result<String, ArtifactError> {
    let root_start = xml
        .find(&format!("<{root}"))
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "header root element is missing"))?;
    let root_end = xml[root_start..]
        .find('>')
        .map(|offset| root_start + offset)
        .ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", "header root start tag is incomplete")
        })?;
    let root_tag = &xml[root_start..=root_end];
    let namespace_attr = if prefix == "v" {
        String::new()
    } else {
        format!(" xmlns:{prefix}=\"urn:schemas-microsoft-com:vml\"")
    };
    let mut result = String::with_capacity(xml.len() + snippet.len() + namespace_attr.len());
    if root_tag.trim_end().ends_with("/>") {
        let open_end = root_end - 1;
        result.push_str(&xml[..open_end]);
        result.push_str(&namespace_attr);
        result.push('>');
        result.push_str(snippet);
        result.push_str(&format!("</{root}>"));
        result.push_str(&xml[root_end + 1..]);
        return Ok(result);
    }
    let closing = format!("</{root}>");
    let close_start = xml
        .rfind(&closing)
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "header closing tag is missing"))?;
    result.push_str(&xml[..root_end]);
    result.push_str(&namespace_attr);
    result.push('>');
    result.push_str(&xml[root_end + 1..close_start]);
    result.push_str(snippet);
    result.push_str(&xml[close_start..]);
    Ok(result)
}

fn watermark_vml(prefix: &str, number: usize, text: &str) -> String {
    let id = format!("RuxexWatermark{number}");
    let type_id = format!("RuxexWatermarkType{number}");
    let text = escape_xml_attribute(text);
    format!(
        "<w:p><w:r><w:pict><{prefix}:shapetype id=\"{type_id}\" coordsize=\"21600,21600\" path=\"m0,0l21600,0m0,21600l21600,21600e\"><{prefix}:path textpathok=\"t\"/><{prefix}:textpath on=\"t\" fitshape=\"t\"/></{prefix}:shapetype><{prefix}:shape id=\"{id}\" type=\"#{type_id}\" style=\"position:absolute;margin-left:0;margin-top:0;width:468pt;height:117pt;rotation:315;z-index:-251654144;mso-position-horizontal:center;mso-position-horizontal-relative:page;mso-position-vertical:center;mso-position-vertical-relative:page\" fillcolor=\"#C0C0C0\" stroked=\"f\"><{prefix}:fill opacity=\"0.15\"/><{prefix}:textpath on=\"t\" style=\"font-family:&quot;Calibri&quot;;font-size:1pt\" string=\"{text}\"/></{prefix}:shape></w:pict></w:r></w:p>"
    )
}

fn is_valid_xml_character(character: char) -> bool {
    matches!(character, '\t' | '\n' | '\r')
        || ('\u{20}'..='\u{d7ff}').contains(&character)
        || ('\u{e000}'..='\u{fffd}').contains(&character)
        || ('\u{10000}'..='\u{10ffff}').contains(&character)
}

fn escape_xml_attribute(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn merge_text_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "base" | "append" | "output" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let base_path = cli::required_flag(&flags, "base")?;
    let append_path = cli::required_flag(&flags, "append")?;
    let output_path = cli::required_flag(&flags, "output")?;
    let base = Path::new(base_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let append = Path::new(append_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    for path in [&base, &append] {
        if !path.is_file()
            || !path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
        {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "both inputs must be regular .docx files",
            ));
        }
    }
    let output = Path::new(output_path);
    if !output
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "output must be a separate .docx file",
        ));
    }
    let parent = output
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(parent)
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
    let output = parent
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?
        .join(output.file_name().ok_or_else(|| {
            ArtifactError::new("invalid_arguments", "output path must include a file name")
        })?);
    if output == base || output == append {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "output must be a separate .docx file",
        ));
    }
    let mut base_archive = ZipArchive::new(
        File::open(&base)
            .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?,
    )
    .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let mut append_archive = ZipArchive::new(
        File::open(&append)
            .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?,
    )
    .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let base_xml = read_docx_part(&mut base_archive, "word/document.xml")?;
    let append_xml = read_docx_part(&mut append_archive, "word/document.xml")?;
    let base_body = direct_body_layout(&base_xml)?;
    let paragraphs = appendable_text_paragraphs(&append_xml)?;
    ensure_append_namespaces(&base_xml, &append_xml, &paragraphs)?;
    let insert_at = base_body.section_start.unwrap_or(base_body.close_start);
    let mut merged =
        String::with_capacity(base_xml.len() + paragraphs.iter().map(String::len).sum::<usize>());
    merged.push_str(&base_xml[..insert_at]);
    for paragraph in &paragraphs {
        merged.push_str(paragraph);
    }
    merged.push_str(&base_xml[insert_at..]);
    drop(base_archive);
    drop(append_archive);
    let output_string = output.to_string_lossy().to_string();
    let base_string = base.to_string_lossy().to_string();
    let appended_count = paragraphs.len();
    rewrite_docx_package(&base_string, &output_string, |name, bytes| {
        if name == "word/document.xml" {
            *bytes = merged.as_bytes().to_vec();
        }
        Ok(())
    })?;
    Ok(json!({
        "ok": true,
        "output": output,
        "appendedParagraphs": appended_count,
        "limitations": ["appends plain paragraphs only; retains base section properties and package parts"]
    }))
}

fn merge_append_command(args: &[String]) -> Result<Value, ArtifactError> {
    let mut base = None;
    let mut append = None;
    let mut output = None;
    let mut after_marker = None;
    let mut allow_drawings = false;
    let mut index = 0usize;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => index += 1,
            "--allow-drawings" => {
                allow_drawings = true;
                index += 1;
            }
            "--base" | "--append" | "--output" | "--after-marker" => {
                let flag = args[index].as_str();
                let value = args.get(index + 1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
                })?;
                match flag {
                    "--base" => base = Some(value.clone()),
                    "--append" => append = Some(value.clone()),
                    "--output" => output = Some(value.clone()),
                    _ => after_marker = Some(value.clone()),
                }
                index += 2;
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
    }
    let base_path =
        base.ok_or_else(|| ArtifactError::new("invalid_arguments", "--base is required"))?;
    let append_path =
        append.ok_or_else(|| ArtifactError::new("invalid_arguments", "--append is required"))?;
    let output_path =
        output.ok_or_else(|| ArtifactError::new("invalid_arguments", "--output is required"))?;
    if after_marker.as_deref() == Some("") {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--after-marker must not be empty",
        ));
    }
    let base_path = Path::new(&base_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let append_path = Path::new(&append_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    for path in [&base_path, &append_path] {
        if !path.is_file()
            || !path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
        {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "both inputs must be regular .docx files",
            ));
        }
    }
    let output = Path::new(&output_path);
    if !output
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "output must be a separate .docx file",
        ));
    }
    let output_parent = output
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(output_parent)
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
    let output = output_parent
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?
        .join(output.file_name().ok_or_else(|| {
            ArtifactError::new("invalid_arguments", "output path must include a file name")
        })?);
    if output == base_path || output == append_path {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "output must be a separate .docx file",
        ));
    }

    let mut base_archive = ZipArchive::new(
        File::open(&base_path)
            .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?,
    )
    .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let mut append_archive = ZipArchive::new(
        File::open(&append_path)
            .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?,
    )
    .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let base_xml = read_docx_part(&mut base_archive, "word/document.xml")?;
    let append_xml = read_docx_part(&mut append_archive, "word/document.xml")?;
    let _ = direct_body_children(&base_xml)?;
    let mut append_body = direct_body_children(&append_xml)?;
    if let Some(section_index) = append_body
        .iter()
        .position(|child| child.name == "w:sectPr")
    {
        if section_index + 1 != append_body.len() {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "w:sectPr must be the final direct child of w:body",
            ));
        }
        append_body.pop();
    }
    let mut drawings_present = false;
    let relationship_prefixes = root_namespace_bindings(&append_xml)?
        .into_iter()
        .filter_map(|(prefix, uri)| {
            (uri == "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
                .then_some(prefix)
        })
        .collect::<std::collections::HashSet<_>>();
    for child in &append_body {
        let child_xml = &append_xml[child.start..child.end];
        let (has_drawing, has_relationship) =
            inspect_merge_child(child_xml, &relationship_prefixes)?;
        drawings_present |= has_drawing;
        if has_relationship {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "append DOCX body uses relationship-backed content; its relationships and package dependencies are not imported",
            ));
        }
    }
    if drawings_present && !allow_drawings {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "append DOCX contains drawings; pass --allow-drawings to allow only self-contained drawings",
        ));
    }
    let base_xml = merge_namespace_declarations(&base_xml, &append_xml)?;
    let base_body = direct_body_children(&base_xml)?;
    let base_section_index = base_body.iter().position(|child| child.name == "w:sectPr");
    let insertion_at = if let Some(marker) = after_marker.as_deref() {
        let matched = base_body.iter().find(|child| {
            child.name == "w:p"
                && ooxml::text_values(&base_xml[child.start..child.end], "w:t")
                    .join("")
                    .contains(marker)
        });
        let child = matched.ok_or_else(|| {
            ArtifactError::new(
                "invalid_arguments",
                format!("marker was not found in a top-level base paragraph: {marker:?}"),
            )
        })?;
        child.end
    } else if let Some(section_index) = base_section_index {
        base_body[section_index].start
    } else {
        base_body
            .last()
            .map_or_else(|| body_close_start(&base_xml), |child| child.end)
    };
    let append_count = append_body.len();
    let mut merged = String::with_capacity(
        base_xml.len()
            + append_body
                .iter()
                .map(|child| child.end - child.start)
                .sum::<usize>(),
    );
    merged.push_str(&base_xml[..insertion_at]);
    for child in &append_body {
        merged.push_str(&append_xml[child.start..child.end]);
    }
    merged.push_str(&base_xml[insertion_at..]);
    drop(base_archive);
    drop(append_archive);
    let base_string = base_path.to_string_lossy().to_string();
    let output_string = output.to_string_lossy().to_string();
    rewrite_docx_package(&base_string, &output_string, |name, bytes| {
        if name == "word/document.xml" {
            *bytes = merged.as_bytes().to_vec();
        }
        Ok(())
    })?;
    Ok(json!({
        "ok": true,
        "output": output,
        "bodyChildrenAppended": append_count,
        "drawingsAllowed": allow_drawings && drawings_present,
        "afterMarker": after_marker,
        "limitations": [
            "copies body OOXML only; styles, numbering, bookmarks, and other cross-document references are not reconciled",
            "relationship-backed content is rejected because append relationships and package dependencies are not imported"
        ]
    }))
}

#[derive(Clone)]
struct BodyChildSpan {
    name: String,
    start: usize,
    end: usize,
}

fn direct_body_children(xml: &str) -> Result<Vec<BodyChildSpan>, ArtifactError> {
    let mut reader = quick_xml::Reader::from_str(xml);
    reader.config_mut().check_end_names = true;
    let mut stack = Vec::<String>::new();
    let mut body_depth = None;
    let mut body_found = false;
    let mut direct_child = None::<(String, usize, usize)>;
    let mut children = Vec::new();
    loop {
        let event_start = reader.buffer_position() as usize;
        let event = reader
            .read_event()
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        let event_end = reader.buffer_position() as usize;
        match event {
            quick_xml::events::Event::Start(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if body_depth.is_none() && name == "w:body" {
                    body_depth = Some(stack.len() + 1);
                    body_found = true;
                } else if body_depth == Some(stack.len()) {
                    direct_child = Some((name.clone(), event_start, stack.len() + 1));
                }
                stack.push(name);
            }
            quick_xml::events::Event::Empty(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if body_depth.is_none() && name == "w:body" {
                    body_depth = Some(stack.len() + 1);
                    body_found = true;
                } else if body_depth == Some(stack.len()) {
                    children.push(BodyChildSpan {
                        name,
                        start: event_start,
                        end: event_end,
                    });
                }
            }
            quick_xml::events::Event::End(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if let Some((child_name, start, depth)) = direct_child.as_ref()
                    && *child_name == name
                    && stack.len() == *depth
                {
                    children.push(BodyChildSpan {
                        name: child_name.clone(),
                        start: *start,
                        end: event_end,
                    });
                    direct_child = None;
                }
                if name == "w:body" && body_depth.is_some() {
                    body_found = true;
                }
                stack.pop();
            }
            quick_xml::events::Event::Eof => break,
            _ => {}
        }
    }
    if !body_found {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "DOCX is missing w:body",
        ));
    }
    Ok(children)
}

fn inspect_merge_child(
    xml: &str,
    relationship_prefixes: &std::collections::HashSet<String>,
) -> Result<(bool, bool), ArtifactError> {
    let mut reader = quick_xml::Reader::from_str(xml);
    reader.config_mut().check_end_names = true;
    let mut drawings = false;
    let mut relationships = false;
    loop {
        let event = reader
            .read_event()
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        match event {
            quick_xml::events::Event::Start(event) | quick_xml::events::Event::Empty(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                drawings |= matches!(
                    name.rsplit(':').next().unwrap_or(&name),
                    "drawing" | "pict" | "object"
                );
                for attribute in event.attributes().with_checks(true) {
                    let attribute = attribute.map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    let name = std::str::from_utf8(attribute.key.as_ref()).map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    relationships |= name
                        .split_once(':')
                        .is_some_and(|(prefix, _)| relationship_prefixes.contains(prefix));
                }
            }
            quick_xml::events::Event::Eof => break,
            _ => {}
        }
    }
    Ok((drawings, relationships))
}

fn root_namespace_bindings(
    xml: &str,
) -> Result<std::collections::HashMap<String, String>, ArtifactError> {
    let mut reader = quick_xml::Reader::from_str(xml);
    loop {
        let event = reader
            .read_event()
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        if let quick_xml::events::Event::Start(event) = event {
            let mut bindings = std::collections::HashMap::new();
            for attribute in event.attributes().with_checks(true) {
                let attribute = attribute
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                let name = std::str::from_utf8(attribute.key.as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                let prefix = if name == "xmlns" {
                    Some(String::new())
                } else {
                    name.strip_prefix("xmlns:").map(str::to_owned)
                };
                if let Some(prefix) = prefix {
                    let value = attribute
                        .decode_and_unescape_value(reader.decoder())
                        .map_err(|error| {
                            ArtifactError::new("invalid_ooxml_xml", error.to_string())
                        })?
                        .into_owned();
                    bindings.insert(prefix, value);
                }
            }
            return Ok(bindings);
        }
        if matches!(event, quick_xml::events::Event::Eof) {
            break;
        }
    }
    Err(ArtifactError::new(
        "invalid_ooxml_xml",
        "document root is missing",
    ))
}

fn merge_namespace_declarations(base_xml: &str, append_xml: &str) -> Result<String, ArtifactError> {
    let read_root = |xml: &str| -> Result<
        (String, usize, std::collections::HashMap<String, String>),
        ArtifactError,
    > {
        let mut reader = quick_xml::Reader::from_str(xml);
        loop {
            let event = reader
                .read_event()
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
            if let quick_xml::events::Event::Start(event) = event {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                let end = reader.buffer_position() as usize;
                let mut bindings = std::collections::HashMap::new();
                for attribute in event.attributes().with_checks(true) {
                    let attribute = attribute.map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    let key = std::str::from_utf8(attribute.key.as_ref()).map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    if key == "xmlns" {
                        bindings.insert(
                            String::new(),
                            attribute
                                .decode_and_unescape_value(reader.decoder())
                                .map_err(|error| {
                                    ArtifactError::new("invalid_ooxml_xml", error.to_string())
                                })?
                                .into_owned(),
                        );
                    } else if let Some(prefix) = key.strip_prefix("xmlns:") {
                        bindings.insert(
                            prefix.to_owned(),
                            attribute
                                .decode_and_unescape_value(reader.decoder())
                                .map_err(|error| {
                                    ArtifactError::new("invalid_ooxml_xml", error.to_string())
                                })?
                                .into_owned(),
                        );
                    }
                }
                return Ok((name, end, bindings));
            }
            if matches!(event, quick_xml::events::Event::Eof) {
                break;
            }
        }
        Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "document root is missing",
        ))
    };
    let (base_root, base_end, base_bindings) = read_root(base_xml)?;
    let (_, _, append_bindings) = read_root(append_xml)?;
    let mut additions = Vec::new();
    for (prefix, namespace) in append_bindings {
        if let Some(existing) = base_bindings.get(&prefix) {
            if existing != &namespace {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!(
                        "append document namespace prefix conflicts with base document: {prefix}"
                    ),
                ));
            }
        } else {
            let attribute = if prefix.is_empty() {
                "xmlns".to_owned()
            } else {
                format!("xmlns:{prefix}")
            };
            additions.push(format!(
                " {attribute}=\"{}\"",
                escape_xml_attribute(&namespace)
            ));
        }
    }
    if additions.is_empty() {
        return Ok(base_xml.to_owned());
    }
    let _ = base_root;
    let mut result =
        String::with_capacity(base_xml.len() + additions.iter().map(String::len).sum::<usize>());
    result.push_str(&base_xml[..base_end - 1]);
    result.push_str(&additions.join(""));
    result.push('>');
    result.push_str(&base_xml[base_end..]);
    Ok(result)
}

fn body_close_start(xml: &str) -> usize {
    xml.rfind("</w:body>").unwrap_or(xml.len())
}

struct BodyLayout {
    close_start: usize,
    section_start: Option<usize>,
}

fn direct_body_layout(xml: &str) -> Result<BodyLayout, ArtifactError> {
    let mut reader = quick_xml::Reader::from_str(xml);
    reader.config_mut().check_end_names = true;
    let mut stack = Vec::<String>::new();
    let mut body_depth = None;
    let mut body_close = None;
    let mut section_start = None;
    loop {
        let event_start = reader.buffer_position() as usize;
        let event = reader
            .read_event()
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        match event {
            quick_xml::events::Event::Start(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                let start = event_start;
                if body_depth.is_none() && name == "w:body" {
                    body_depth = Some(stack.len() + 1);
                } else if body_depth == Some(stack.len()) && name == "w:sectPr" {
                    section_start.get_or_insert(start);
                }
                stack.push(name);
            }
            quick_xml::events::Event::Empty(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                let start = event_start;
                if body_depth.is_none() && name == "w:body" {
                    body_depth = Some(stack.len() + 1);
                    body_close = Some(start);
                } else if body_depth == Some(stack.len()) && name == "w:sectPr" {
                    section_start.get_or_insert(start);
                }
            }
            quick_xml::events::Event::End(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                let start = event_start;
                if name == "w:body" && body_depth.is_some() {
                    body_close = Some(start);
                }
                stack.pop();
            }
            quick_xml::events::Event::Eof => break,
            _ => {}
        }
    }
    let close_start = body_close.ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", "DOCX body is missing or malformed")
    })?;
    Ok(BodyLayout {
        close_start,
        section_start,
    })
}

fn appendable_text_paragraphs(xml: &str) -> Result<Vec<String>, ArtifactError> {
    const BUILTIN_STYLES: &[&str] = &[
        "Normal",
        "Title",
        "Subtitle",
        "Caption",
        "Quote",
        "IntenseQuote",
        "Heading1",
        "Heading2",
        "Heading3",
        "Heading4",
        "Heading5",
        "Heading6",
        "Heading7",
        "Heading8",
        "Heading9",
    ];
    const UNSUPPORTED: &[&str] = &[
        "tbl",
        "sdt",
        "drawing",
        "pict",
        "object",
        "fldChar",
        "instrText",
        "ins",
        "del",
        "commentRangeStart",
        "commentRangeEnd",
        "commentReference",
        "footnoteReference",
        "endnoteReference",
        "bookmarkStart",
        "bookmarkEnd",
        "hyperlink",
    ];
    let mut reader = quick_xml::Reader::from_str(xml);
    reader.config_mut().check_end_names = true;
    let mut stack = Vec::<String>::new();
    let mut body_depth = None;
    let mut paragraphs = Vec::new();
    let mut current_paragraph = None::<(usize, usize)>;
    loop {
        let event_start = reader.buffer_position() as usize;
        let event = reader
            .read_event()
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        let position = reader.buffer_position() as usize;
        match event {
            event @ (quick_xml::events::Event::Start(_) | quick_xml::events::Event::Empty(_)) => {
                let (event, is_empty) = match event {
                    quick_xml::events::Event::Start(event) => (event, false),
                    quick_xml::events::Event::Empty(event) => (event, true),
                    _ => unreachable!(),
                };
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                let local = name.rsplit(':').next().unwrap_or(&name);
                if UNSUPPORTED.contains(&local) {
                    return Err(ArtifactError::new(
                        "invalid_arguments",
                        format!("source contains unsupported merge content: {local}"),
                    ));
                }
                let start = event_start;
                for attribute in event.attributes().with_checks(true) {
                    let attribute = attribute.map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    let attr_name =
                        std::str::from_utf8(attribute.key.as_ref()).map_err(|error| {
                            ArtifactError::new("invalid_ooxml_xml", error.to_string())
                        })?;
                    if attr_name.starts_with("r:") {
                        return Err(ArtifactError::new(
                            "invalid_arguments",
                            "source contains relationship-backed content such as links or images",
                        ));
                    }
                    if local == "pStyle" && attr_name.ends_with(":val") {
                        let style = attribute
                            .decode_and_unescape_value(reader.decoder())
                            .map_err(|error| {
                                ArtifactError::new("invalid_ooxml_xml", error.to_string())
                            })?;
                        if !style.is_empty() && !BUILTIN_STYLES.contains(&style.as_ref()) {
                            return Err(ArtifactError::new(
                                "invalid_arguments",
                                format!("source uses a custom paragraph style: {style}"),
                            ));
                        }
                    }
                }
                if local == "numPr" {
                    return Err(ArtifactError::new(
                        "invalid_arguments",
                        "source contains numbering whose definitions may not match",
                    ));
                }
                if body_depth.is_none() && name == "w:body" {
                    body_depth = Some(stack.len() + 1);
                } else if body_depth == Some(stack.len())
                    && !matches!(name.as_str(), "w:p" | "w:sectPr")
                {
                    return Err(ArtifactError::new(
                        "invalid_arguments",
                        "source body contains non-paragraph content",
                    ));
                } else if body_depth == Some(stack.len()) && name == "w:p" && is_empty {
                    paragraphs.push(xml[event_start..position].to_owned());
                } else if body_depth == Some(stack.len()) && name == "w:p" {
                    current_paragraph = Some((start, stack.len() + 1));
                    stack.push(name);
                    continue;
                }
                if !is_empty {
                    stack.push(name);
                }
            }
            quick_xml::events::Event::End(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                let end = position;
                if name == "w:p" && current_paragraph.is_some_and(|(_, depth)| stack.len() == depth)
                {
                    if let Some((start, _)) = current_paragraph.take() {
                        paragraphs.push(xml[start..end].to_owned());
                    }
                }
                stack.pop();
            }
            quick_xml::events::Event::Eof => break,
            _ => {}
        }
    }
    if body_depth.is_none() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "DOCX body is missing",
        ));
    }
    Ok(paragraphs)
}

fn ensure_append_namespaces(
    base_xml: &str,
    append_xml: &str,
    _paragraphs: &[String],
) -> Result<(), ArtifactError> {
    let namespaces =
        |xml: &str| -> Result<std::collections::HashMap<String, String>, ArtifactError> {
            let start = xml
                .find('<')
                .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "document XML is empty"))?;
            let end = xml[start..]
                .find('>')
                .map(|offset| start + offset)
                .ok_or_else(|| {
                    ArtifactError::new("invalid_ooxml_xml", "document root start tag is incomplete")
                })?;
            let map = crate::ooxml::parse_attributes(&xml[start + 1..end]);
            Ok(map
                .into_iter()
                .filter_map(|(name, value)| {
                    name.strip_prefix("xmlns:")
                        .map(|prefix| (prefix.to_owned(), value))
                })
                .collect())
        };
    let base = namespaces(base_xml)?;
    let append = namespaces(append_xml)?;
    for (prefix, namespace) in append {
        if base.get(&prefix) != Some(&namespace) {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!(
                    "source paragraph uses a namespace that is not available in the base DOCX: {prefix}"
                ),
            ));
        }
    }
    Ok(())
}

struct DocxRedactionRule {
    pattern: regex::Regex,
    replacement: Option<String>,
}

fn redact_text_command(args: &[String]) -> Result<Value, ArtifactError> {
    let mut input = None;
    let mut output = None;
    let mut emails = false;
    let mut phones = false;
    let mut patterns = Vec::new();
    let mut replacements = Vec::new();
    let mut preserve_length = true;
    let mut include_comments = false;
    let mut mask_char = "█".to_owned();
    let mut index = 0usize;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => index += 1,
            "--emails" => {
                emails = true;
                index += 1;
            }
            "--phones" => {
                phones = true;
                index += 1;
            }
            "--no-preserve-length" | "--no_preserve_length" => {
                preserve_length = false;
                index += 1;
            }
            "--include-comments" | "--include_comments" => {
                include_comments = true;
                index += 1;
            }
            "--input" | "--output" | "--pattern" | "--replacement" | "--mask-char"
            | "--mask_char" => {
                let flag = args[index].as_str();
                let value = args.get(index + 1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
                })?;
                match flag {
                    "--input" => input = Some(value.clone()),
                    "--output" => output = Some(value.clone()),
                    "--pattern" => patterns.push(value.clone()),
                    "--replacement" => replacements.push(value.clone()),
                    _ => mask_char = value.clone(),
                }
                index += 2;
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
    }
    let input =
        input.ok_or_else(|| ArtifactError::new("invalid_arguments", "--input is required"))?;
    let output =
        output.ok_or_else(|| ArtifactError::new("invalid_arguments", "--output is required"))?;
    if mask_char.chars().count() != 1 || !mask_char.chars().all(is_valid_xml_character) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "mask character must be exactly one valid XML character",
        ));
    }
    let mut specifications = Vec::<String>::new();
    if emails {
        specifications.push(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b".to_owned());
    }
    if phones {
        specifications
            .push(r"(?:(?:\+?\d{1,3}[\s-]?)?(?:\(\d{3}\)|\d{3})[\s-]?)\d{3}[\s-]?\d{4}".to_owned());
    }
    for pattern in &patterns {
        if pattern.is_empty() || pattern.chars().count() > 500 {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "each --pattern must contain 1 to 500 characters",
            ));
        }
        specifications.push(pattern.clone());
    }
    if specifications.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "provide --emails, --phones, or at least one --pattern",
        ));
    }
    if !replacements.is_empty()
        && replacements.len() != 1
        && replacements.len() != specifications.len()
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "provide one --replacement for all rules or one for each rule",
        ));
    }
    if preserve_length && replacements.iter().any(String::is_empty) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "length-preserving replacements must not be empty",
        ));
    }
    if replacements.len() == 1 {
        replacements.resize(specifications.len(), replacements[0].clone());
    }
    let mut rules = Vec::with_capacity(specifications.len());
    for (rule_index, pattern) in specifications.iter().enumerate() {
        let regex = regex::RegexBuilder::new(pattern)
            .case_insensitive(emails && rule_index == 0)
            .build()
            .map_err(|error| ArtifactError::new("invalid_arguments", error.to_string()))?;
        rules.push(DocxRedactionRule {
            pattern: regex,
            replacement: replacements.get(rule_index).cloned(),
        });
    }

    let mut total_matches = 0usize;
    let mut paragraphs_touched = 0usize;
    let mut modified_parts = Vec::new();
    let mut processed_parts = Vec::new();
    let output_path = rewrite_docx_package(&input, &output, |name, bytes| {
        if is_redaction_story_part(name) || (include_comments && name == "word/comments.xml") {
            processed_parts.push(name.to_owned());
            let xml = String::from_utf8(bytes.clone())
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
            let (redacted, matches, paragraphs) =
                redact_docx_story(&xml, &rules, &mask_char, preserve_length)?;
            if matches > 0 {
                *bytes = redacted.into_bytes();
                total_matches += matches;
                paragraphs_touched += paragraphs;
                modified_parts.push(name.to_owned());
            }
        }
        Ok(())
    })?;
    if total_matches == 0 {
        let _ = fs::remove_file(&output_path);
        return Err(ArtifactError::new(
            "invalid_arguments",
            "no redaction patterns matched the selected DOCX text",
        ));
    }
    Ok(json!({
        "ok": true,
        "input": input,
        "output": output_path,
        "matches": total_matches,
        "paragraphsTouched": paragraphs_touched,
        "partsProcessed": processed_parts,
        "modifiedParts": modified_parts,
        "preserveLength": preserve_length,
        "includeComments": include_comments,
        "limitations": ["images, charts, embedded files, and other non-text content are not inspected"]
    }))
}

fn is_redaction_story_part(name: &str) -> bool {
    if matches!(
        name,
        "word/document.xml" | "word/footnotes.xml" | "word/endnotes.xml"
    ) {
        return true;
    }
    let Some(stem) = name
        .strip_prefix("word/")
        .and_then(|name| name.strip_suffix(".xml"))
    else {
        return false;
    };
    ["header", "footer"].iter().any(|prefix| {
        stem.strip_prefix(prefix).is_some_and(|number| {
            !number.is_empty() && number.chars().all(|digit| digit.is_ascii_digit())
        })
    })
}

fn redact_docx_story(
    xml: &str,
    rules: &[DocxRedactionRule],
    mask_char: &str,
    preserve_length: bool,
) -> Result<(String, usize, usize), ArtifactError> {
    let mut output = String::with_capacity(xml.len());
    let mut cursor = 0usize;
    let mut matches_total = 0usize;
    let mut paragraphs_touched = 0usize;
    for (offset, original_paragraph) in ordered_docx_blocks(xml, "w:p") {
        output.push_str(&xml[cursor..offset]);
        cursor = offset + original_paragraph.len();
        let text_blocks = ordered_docx_blocks(&original_paragraph, "w:t");
        let mut segments = text_blocks
            .iter()
            .map(|(_, block)| ooxml::text_values(block, "w:t").join(""))
            .collect::<Vec<_>>();
        let full_text = segments.join("");
        if full_text.is_empty() {
            output.push_str(&original_paragraph);
            continue;
        }
        let mut spans = Vec::<(usize, usize, usize)>::new();
        for (rule_index, rule) in rules.iter().enumerate() {
            for found in rule.pattern.find_iter(&full_text) {
                if found.start() != found.end() {
                    let start = full_text[..found.start()].chars().count();
                    let end = start + full_text[found.start()..found.end()].chars().count();
                    spans.push((start, end, rule_index));
                }
            }
        }
        spans.sort_by_key(|(start, end, _)| (*start, std::cmp::Reverse(end - start)));
        let mut chosen = Vec::<(usize, usize, usize)>::new();
        let mut last_end = 0usize;
        for span in spans {
            if span.0 < last_end {
                continue;
            }
            last_end = span.1;
            chosen.push(span);
        }
        if chosen.is_empty() {
            output.push_str(&original_paragraph);
            continue;
        }
        let mut rewritten = full_text.chars().collect::<Vec<_>>();
        for (start, end, rule_index) in chosen.iter().rev() {
            let length = end - start;
            let replacement = if let Some(replacement) = &rules[*rule_index].replacement {
                if preserve_length {
                    let replacement_chars = replacement.chars().collect::<Vec<_>>();
                    let mut expanded = Vec::with_capacity(length);
                    while expanded.len() < length {
                        expanded.extend(replacement_chars.iter().copied());
                    }
                    expanded.truncate(length);
                    expanded
                } else {
                    replacement.chars().collect()
                }
            } else {
                mask_char.chars().cycle().take(length).collect()
            };
            rewritten.splice(*start..*end, replacement);
        }
        if preserve_length && rewritten.len() != full_text.chars().count() {
            return Err(ArtifactError::new(
                "ooxml_edit_error",
                "expected length-preserving redaction",
            ));
        }
        let new_text = rewritten.into_iter().collect::<String>();
        let new_chars = new_text.chars().collect::<Vec<_>>();
        let mut offset = 0usize;
        let segment_count = segments.len();
        for (segment_index, segment) in segments.iter_mut().enumerate() {
            let take = if segment_index + 1 < segment_count {
                segment.chars().count()
            } else {
                new_chars.len().saturating_sub(offset)
            };
            let start = offset.min(new_chars.len());
            let end = offset.saturating_add(take).min(new_chars.len());
            *segment = new_chars[start..end].iter().collect();
            offset += take;
        }
        let mut updated = String::with_capacity(original_paragraph.len());
        let mut paragraph_cursor = 0usize;
        for (index, (block_offset, block)) in text_blocks.iter().enumerate() {
            updated.push_str(&original_paragraph[paragraph_cursor..*block_offset]);
            updated.push_str(&replace_text_block(block, &segments[index]));
            paragraph_cursor = block_offset + block.len();
        }
        updated.push_str(&original_paragraph[paragraph_cursor..]);
        output.push_str(&updated);
        matches_total += chosen.len();
        paragraphs_touched += 1;
    }
    output.push_str(&xml[cursor..]);
    Ok((output, matches_total, paragraphs_touched))
}

fn template_fidelity_command(args: &[String]) -> Result<Value, ArtifactError> {
    let Some(action) = args.first().map(String::as_str) else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "template-fidelity requires snapshot or verify",
        ));
    };
    let mut reference = None;
    let mut manifest = None;
    let mut input = None;
    let mut editable_parts = Vec::new();
    let mut index = 1usize;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => index += 1,
            "--reference" | "--manifest" | "--input" | "--editable-part" => {
                let flag = args[index].as_str();
                let value = args.get(index + 1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
                })?;
                match flag {
                    "--reference" => reference = Some(value.clone()),
                    "--manifest" => manifest = Some(value.clone()),
                    "--input" => input = Some(value.clone()),
                    _ => editable_parts.push(value.clone()),
                }
                index += 2;
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
    }
    let reference = reference
        .ok_or_else(|| ArtifactError::new("invalid_arguments", "--reference is required"))?;
    let manifest = manifest
        .ok_or_else(|| ArtifactError::new("invalid_arguments", "--manifest is required"))?;
    match action {
        "snapshot" => {
            if input.is_some() || !editable_parts.is_empty() {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    "--input and --editable-part apply only to verify",
                ));
            }
            template_fidelity_snapshot(&reference, &manifest)
        }
        "verify" => {
            let input = input
                .ok_or_else(|| ArtifactError::new("invalid_arguments", "--input is required"))?;
            template_fidelity_verify(&reference, &input, &manifest, &editable_parts)
        }
        _ => Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown template-fidelity action: {action}"),
        )),
    }
}

fn template_fidelity_snapshot(
    reference: &str,
    manifest_path: &str,
) -> Result<Value, ArtifactError> {
    let inventory = docx_package_inventory(reference)?;
    let manifest = Path::new(manifest_path);
    if !manifest
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("json"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "manifest must be a separate JSON file",
        ));
    }
    let parent = manifest
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(parent)
        .map_err(|error| ArtifactError::new("output_error", error.to_string()))?;
    let path = parent
        .canonicalize()
        .map_err(|error| ArtifactError::new("output_error", error.to_string()))?
        .join(manifest.file_name().ok_or_else(|| {
            ArtifactError::new(
                "invalid_arguments",
                "manifest path must include a file name",
            )
        })?);
    let bytes = serde_json::to_vec_pretty(&inventory)
        .map_err(|error| ArtifactError::new("manifest_write_error", error.to_string()))?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                ArtifactError::new(
                    "output_exists",
                    format!("manifest already exists: {}", path.display()),
                )
            } else {
                ArtifactError::new("manifest_write_error", error.to_string())
            }
        })?;
    if let Err(error) = file.write_all(&[bytes, b"\n".to_vec()].concat()) {
        let _ = fs::remove_file(&path);
        return Err(ArtifactError::new(
            "manifest_write_error",
            error.to_string(),
        ));
    }
    Ok(inventory)
}

fn template_fidelity_verify(
    reference: &str,
    final_path: &str,
    manifest_path: &str,
    editable_parts: &[String],
) -> Result<Value, ArtifactError> {
    let manifest_bytes = fs::read(manifest_path)
        .map_err(|error| ArtifactError::new("manifest_read_error", error.to_string()))?;
    let baseline: Value = serde_json::from_slice(&manifest_bytes)
        .map_err(|error| ArtifactError::new("invalid_manifest", error.to_string()))?;
    if baseline.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Err(ArtifactError::new(
            "invalid_manifest",
            "unsupported template manifest version",
        ));
    }
    let source = docx_package_inventory(reference)?;
    if source.get("source") != baseline.get("source")
        || source.get("parts") != baseline.get("parts")
    {
        return Err(ArtifactError::new(
            "invalid_manifest",
            "retained reference has changed or does not match the manifest",
        ));
    }
    let parts = baseline
        .get("parts")
        .and_then(Value::as_object)
        .ok_or_else(|| {
            ArtifactError::new("invalid_manifest", "manifest parts must be an object")
        })?;
    let editable = editable_parts
        .iter()
        .cloned()
        .collect::<std::collections::HashSet<_>>();
    if editable.iter().any(|part| !parts.contains_key(part)) {
        return Err(ArtifactError::new(
            "invalid_manifest",
            "each editable part must exist in the reference manifest",
        ));
    }
    let target = docx_package_inventory(final_path)?;
    let target_parts = target
        .get("parts")
        .and_then(Value::as_object)
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_package", "target parts are missing"))?;
    let before_names = parts
        .keys()
        .cloned()
        .collect::<std::collections::BTreeSet<_>>();
    let after_names = target_parts
        .keys()
        .cloned()
        .collect::<std::collections::BTreeSet<_>>();
    let added = after_names
        .difference(&before_names)
        .cloned()
        .collect::<Vec<_>>();
    let removed = before_names
        .difference(&after_names)
        .cloned()
        .collect::<Vec<_>>();
    let changed = before_names
        .intersection(&after_names)
        .filter(|name| parts[*name].get("sha256") != target_parts[*name].get("sha256"))
        .cloned()
        .collect::<Vec<_>>();
    let changed_preserved = changed
        .iter()
        .filter(|name| !editable.contains(*name))
        .cloned()
        .collect::<Vec<_>>();
    let changed_editable = changed
        .iter()
        .filter(|name| editable.contains(*name))
        .cloned()
        .collect::<Vec<_>>();
    let mut feature_changes = serde_json::Map::new();
    for name in &changed {
        let before_features = parts[name]
            .get("features")
            .cloned()
            .unwrap_or_else(|| json!({}));
        let after_features = target_parts[name]
            .get("features")
            .cloned()
            .unwrap_or_else(|| json!({}));
        if before_features != after_features {
            feature_changes.insert(
                name.clone(),
                json!({"before": before_features, "after": after_features}),
            );
        }
    }
    let ok = added.is_empty() && removed.is_empty() && changed_preserved.is_empty();
    Ok(json!({
        "ok": ok,
        "_exitCode": if ok { 0 } else { 1 },
        "reference": source["source"],
        "output": target["source"],
        "addedParts": added,
        "removedParts": removed,
        "changedPreserveOnlyParts": changed_preserved,
        "changedEditableParts": changed_editable,
        "featureChanges": feature_changes,
        "limitations": [
            "Editable parts require slot-level structural review; their hash changes are allowed.",
            "This check does not verify layout or the meaning of edited text."
        ]
    }))
}

fn docx_package_inventory(path: &str) -> Result<Value, ArtifactError> {
    let path = Path::new(path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !path.is_file()
        || !path.extension().is_some_and(|extension| {
            extension.eq_ignore_ascii_case("docx") || extension.eq_ignore_ascii_case("dotx")
        })
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular DOCX or DOTX file",
        ));
    }
    let source_bytes = fs::read(&path)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if source_bytes.len() as u64 > MAX_DOCX_PACKAGE_BYTES {
        return Err(ArtifactError::new(
            "package_too_large",
            "DOCX exceeds the 64 MiB operation limit",
        ));
    }
    let mut archive = ZipArchive::new(
        File::open(&path)
            .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?,
    )
    .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let mut names = std::collections::HashSet::with_capacity(archive.len());
    let mut entries = Vec::with_capacity(archive.len());
    let mut total_size = 0u64;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
        let name = entry.name().to_owned();
        if !names.insert(name.clone()) {
            return Err(ArtifactError::new(
                "invalid_ooxml_package",
                "duplicate package part names are ambiguous",
            ));
        }
        if entry.is_dir() || name.ends_with('/') {
            continue;
        }
        let mut data = Vec::new();
        entry
            .by_ref()
            .take(MAX_DOCX_PACKAGE_BYTES + 1)
            .read_to_end(&mut data)
            .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
        total_size += data.len() as u64;
        if total_size > MAX_DOCX_PACKAGE_BYTES {
            return Err(ArtifactError::new(
                "package_too_large",
                "uncompressed DOCX content exceeds the 64 MiB operation limit",
            ));
        }
        entries.push((name, data));
    }
    if !names.contains("word/document.xml") {
        return Err(ArtifactError::new(
            "invalid_ooxml_package",
            "package is missing word/document.xml",
        ));
    }
    let mut parts = serde_json::Map::new();
    for (name, data) in entries {
        let mut record = json!({"size": data.len(), "sha256": sha256_hex(&data)});
        if name.ends_with(".xml") || name.ends_with(".rels") {
            let (features, relationships) = inspect_inventory_xml(&data)?;
            record["features"] = json!(features);
            if let Some(relationships) = relationships {
                record["relationships"] = json!(relationships);
            }
        }
        parts.insert(name, record);
    }
    Ok(json!({
        "schemaVersion": 1,
        "source": {"path": path, "sha256": sha256_hex(&source_bytes)},
        "parts": parts
    }))
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn inspect_inventory_xml(
    bytes: &[u8],
) -> Result<
    (
        std::collections::BTreeMap<String, usize>,
        Option<Vec<Value>>,
    ),
    ArtifactError,
> {
    const WORD_NS: &str = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const REL_NS: &str = "http://schemas.openxmlformats.org/package/2006/relationships";
    const FEATURES: &[&str] = &[
        "sectPr",
        "tbl",
        "drawing",
        "pict",
        "sdt",
        "bookmarkStart",
        "bookmarkEnd",
        "commentRangeStart",
        "commentRangeEnd",
        "commentReference",
        "footnoteReference",
        "endnoteReference",
        "fldSimple",
        "fldChar",
        "instrText",
        "numPr",
        "ins",
        "del",
    ];
    let text = std::str::from_utf8(bytes)
        .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
    let mut reader = quick_xml::Reader::from_str(text);
    reader.config_mut().check_end_names = true;
    let mut namespaces = std::collections::HashMap::<String, String>::new();
    let mut stack = Vec::<String>::new();
    let mut feature_counts = std::collections::BTreeMap::<String, usize>::new();
    let mut relationships = Vec::new();
    let mut is_relationship_root = false;
    let mut root_seen = false;
    loop {
        let event = reader
            .read_event()
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        match event {
            quick_xml::events::Event::Start(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                let depth = stack.len();
                let mut attributes = std::collections::BTreeMap::<String, String>::new();
                for attribute in event.attributes().with_checks(true) {
                    let attribute = attribute.map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    let key = std::str::from_utf8(attribute.key.as_ref())
                        .map_err(|error| {
                            ArtifactError::new("invalid_ooxml_xml", error.to_string())
                        })?
                        .to_owned();
                    let value = attribute
                        .decode_and_unescape_value(reader.decoder())
                        .map_err(|error| {
                            ArtifactError::new("invalid_ooxml_xml", error.to_string())
                        })?
                        .into_owned();
                    if key == "xmlns" {
                        namespaces.insert(String::new(), value.clone());
                    } else if let Some(prefix) = key.strip_prefix("xmlns:") {
                        namespaces.insert(prefix.to_owned(), value.clone());
                    }
                    attributes.insert(key, value);
                }
                if !root_seen {
                    root_seen = true;
                    is_relationship_root = xml_namespace(&name, &namespaces) == Some(REL_NS);
                } else if depth == 1
                    && is_relationship_root
                    && name.rsplit(':').next() == Some("Relationship")
                {
                    relationships.push(Value::Object(
                        attributes
                            .into_iter()
                            .map(|(key, value)| (key, Value::String(value)))
                            .collect(),
                    ));
                }
                if xml_namespace(&name, &namespaces) == Some(WORD_NS) {
                    let local = name.rsplit(':').next().unwrap_or(&name);
                    if FEATURES.contains(&local) {
                        *feature_counts.entry(local.to_owned()).or_default() += 1;
                    }
                }
                stack.push(name);
            }
            quick_xml::events::Event::Empty(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                let depth = stack.len();
                let mut attributes = std::collections::BTreeMap::<String, String>::new();
                for attribute in event.attributes().with_checks(true) {
                    let attribute = attribute.map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    let key = std::str::from_utf8(attribute.key.as_ref())
                        .map_err(|error| {
                            ArtifactError::new("invalid_ooxml_xml", error.to_string())
                        })?
                        .to_owned();
                    let value = attribute
                        .decode_and_unescape_value(reader.decoder())
                        .map_err(|error| {
                            ArtifactError::new("invalid_ooxml_xml", error.to_string())
                        })?
                        .into_owned();
                    if key == "xmlns" {
                        namespaces.insert(String::new(), value.clone());
                    } else if let Some(prefix) = key.strip_prefix("xmlns:") {
                        namespaces.insert(prefix.to_owned(), value.clone());
                    }
                    attributes.insert(key, value);
                }
                if !root_seen {
                    root_seen = true;
                    is_relationship_root = xml_namespace(&name, &namespaces) == Some(REL_NS);
                } else if depth == 1
                    && is_relationship_root
                    && name.rsplit(':').next() == Some("Relationship")
                {
                    relationships.push(Value::Object(
                        attributes
                            .into_iter()
                            .map(|(key, value)| (key, Value::String(value)))
                            .collect(),
                    ));
                }
                if xml_namespace(&name, &namespaces) == Some(WORD_NS) {
                    let local = name.rsplit(':').next().unwrap_or(&name);
                    if FEATURES.contains(&local) {
                        *feature_counts.entry(local.to_owned()).or_default() += 1;
                    }
                }
            }
            quick_xml::events::Event::End(_) => {
                stack.pop();
            }
            quick_xml::events::Event::Eof => break,
            _ => {}
        }
    }
    if !root_seen || !stack.is_empty() {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "XML part is incomplete",
        ));
    }
    Ok((
        feature_counts,
        is_relationship_root.then_some(relationships),
    ))
}

fn xml_namespace<'a>(
    qualified_name: &str,
    namespaces: &'a std::collections::HashMap<String, String>,
) -> Option<&'a str> {
    if let Some((prefix, _)) = qualified_name.split_once(':') {
        namespaces.get(prefix).map(String::as_str)
    } else {
        namespaces.get("").map(String::as_str)
    }
}

fn a11y_fixes_command(args: &[String]) -> Result<Value, ArtifactError> {
    let input = args
        .first()
        .filter(|argument| !argument.starts_with('-'))
        .cloned()
        .ok_or_else(|| ArtifactError::new("invalid_arguments", "input DOCX path is required"))?;
    let mut image_alt = false;
    let mut table_headers = false;
    let mut output = None;
    let mut index = 1usize;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => index += 1,
            "--fix_image_alt"
            | "--fix-table-headers"
            | "--fix_table_headers"
            | "--fix-image-alt"
            | "--out" => {
                let flag = args[index].as_str();
                let value = args.get(index + 1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
                })?;
                match flag {
                    "--fix_image_alt" | "--fix-image-alt"
                        if value == "from_filename" || value == "from-filename" =>
                    {
                        image_alt = true
                    }
                    "--fix_table_headers" | "--fix-table-headers"
                        if value == "first_row" || value == "first-row" =>
                    {
                        table_headers = true
                    }
                    "--out" => output = Some(value.clone()),
                    _ => {
                        return Err(ArtifactError::new(
                            "invalid_arguments",
                            format!("unsupported {flag} value: {value}"),
                        ));
                    }
                }
                index += 2;
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
    }
    if !image_alt && !table_headers {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "select --fix_image_alt and/or --fix_table_headers",
        ));
    }
    let output = output.ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "--out is required when applying fixes")
    })?;
    let input_path = Path::new(&input)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !input_path.is_file()
        || !input_path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input and output must use .docx extension",
        ));
    }
    let mut relations_by_part =
        std::collections::HashMap::<String, BTreeMap<String, String>>::new();
    let mut archive = ZipArchive::new(
        File::open(&input_path)
            .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?,
    )
    .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let names = (0..archive.len())
        .filter_map(|part_index| {
            archive
                .by_index(part_index)
                .ok()
                .map(|entry| entry.name().to_owned())
        })
        .collect::<std::collections::HashSet<_>>();
    for part in a11y_story_parts(&names) {
        let filename = part.rsplit('/').next().unwrap_or(&part);
        let rels_name = format!("word/_rels/{filename}.rels");
        if !names.contains(&rels_name) {
            continue;
        }
        let rels_xml = read_docx_part(&mut archive, &rels_name)?;
        let relations = ooxml::elements(&rels_xml, "Relationship")
            .into_iter()
            .filter_map(|attributes| {
                let id = attributes.get("Id")?;
                let target = attributes.get("Target")?;
                if attributes
                    .get("TargetMode")
                    .is_some_and(|mode| mode == "External")
                {
                    None
                } else {
                    Some((id.clone(), target.clone()))
                }
            })
            .collect::<BTreeMap<_, _>>();
        relations_by_part.insert(part, relations);
    }
    drop(archive);
    let mut stats = json!({"image_alt_filled": 0usize, "table_headers_set": 0usize});
    let output_path = rewrite_docx_package(&input, &output, |name, bytes| {
        if a11y_story_parts(&names).iter().any(|part| part == name) {
            let xml = String::from_utf8(bytes.clone())
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
            let relations = relations_by_part.get(name).cloned().unwrap_or_default();
            let (fixed, image_count, header_count) =
                fix_a11y_story(&xml, name, &relations, image_alt, table_headers)?;
            if fixed != xml {
                *bytes = fixed.into_bytes();
            }
            stats["image_alt_filled"] =
                Value::from(stats["image_alt_filled"].as_u64().unwrap_or(0) + image_count as u64);
            stats["table_headers_set"] =
                Value::from(stats["table_headers_set"].as_u64().unwrap_or(0) + header_count as u64);
        }
        Ok(())
    })?;
    Ok(json!({
        "ok": true,
        "output": output_path,
        "image_alt_filled": stats["image_alt_filled"],
        "table_headers_set": stats["table_headers_set"]
    }))
}

fn a11y_story_parts(names: &std::collections::HashSet<String>) -> Vec<String> {
    let mut parts = names
        .iter()
        .filter(|name| {
            *name == "word/document.xml"
                || (name.starts_with("word/")
                    && name.ends_with(".xml")
                    && !name["word/".len()..].contains('/')
                    && (name["word/".len()..].starts_with("header")
                        || name["word/".len()..].starts_with("footer")))
        })
        .cloned()
        .collect::<Vec<_>>();
    parts.sort();
    parts
}

fn fix_a11y_story(
    original: &str,
    part: &str,
    relationships: &BTreeMap<String, String>,
    fill_image_alt: bool,
    set_table_headers: bool,
) -> Result<(String, usize, usize), ArtifactError> {
    let mut xml = original.to_owned();
    let mut image_count = 0usize;
    if fill_image_alt {
        let drawing_starts = ordered_docx_blocks(&xml, "w:drawing")
            .into_iter()
            .map(|(offset, _)| offset)
            .collect::<Vec<_>>();
        for start in drawing_starts.into_iter().rev() {
            let Some((_, drawing)) = ordered_docx_blocks(&xml, "w:drawing")
                .into_iter()
                .find(|(offset, _)| *offset == start)
            else {
                continue;
            };
            let Some(docpr) = ooxml::elements(&drawing, "wp:docPr").into_iter().next() else {
                continue;
            };
            if docpr
                .get("descr")
                .is_some_and(|value| !value.trim().is_empty())
                || docpr
                    .get("title")
                    .is_some_and(|value| !value.trim().is_empty())
            {
                continue;
            }
            let rid = ooxml::elements(&drawing, "a:blip")
                .into_iter()
                .find_map(|attributes| attributes.get("r:embed").cloned());
            let filename = rid
                .and_then(|rid| relationships.get(&rid))
                .and_then(|target| {
                    let normalized = if let Some(target) = target.strip_prefix('/') {
                        target.to_owned()
                    } else {
                        crate::ooxml::normalize_target(target, "word")
                    };
                    if normalized.starts_with("../")
                        || normalized.split('/').any(|part| part == "..")
                    {
                        None
                    } else {
                        normalized.rsplit('/').next().map(str::to_owned)
                    }
                })
                .filter(|filename| !filename.is_empty());
            let description = filename.map_or_else(
                || "Image".to_owned(),
                |filename| format!("Image: {filename}"),
            );
            let updated = if let Some(id) = docpr.get("id") {
                set_unqualified_attribute_on_tag(
                    &drawing,
                    "wp:docPr",
                    "id",
                    id,
                    "descr",
                    &description,
                )?
            } else {
                set_attribute_on_first_tag(&drawing, "wp:docPr", "descr", &description)?
            };
            if updated != drawing {
                xml.replace_range(start..start + drawing.len(), &updated);
                image_count += 1;
            }
        }
    }
    let mut table_headers_count = 0usize;
    if set_table_headers {
        for row_start in first_table_row_starts(&xml)?.into_iter().rev() {
            let Some((_, row)) = ordered_docx_blocks(&xml, "w:tr")
                .into_iter()
                .find(|(offset, _)| *offset == row_start)
            else {
                continue;
            };
            let Some(updated) = mark_row_table_header(&row)? else {
                continue;
            };
            if updated != row {
                xml.replace_range(row_start..row_start + row.len(), &updated);
                table_headers_count += 1;
            }
        }
    }
    let _ = part;
    Ok((xml, image_count, table_headers_count))
}

fn set_attribute_on_first_tag(
    xml: &str,
    tag: &str,
    attribute: &str,
    value: &str,
) -> Result<String, ArtifactError> {
    let start = xml.find(&format!("<{tag}")).ok_or_else(|| {
        ArtifactError::new(
            "invalid_ooxml_xml",
            format!("could not locate {tag} element"),
        )
    })?;
    let end = find_xml_tag_end(xml, start).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", format!("unterminated {tag} element"))
    })?;
    let attributes = crate::ooxml::parse_attributes(&xml[start + 1..end]);
    if let Some(old) = attributes.get(attribute) {
        let needle = format!("{attribute}=\"{old}\"");
        let offset = xml[start..=end].find(&needle).ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", format!("could not update {attribute}"))
        })? + start;
        let mut updated = xml.to_owned();
        updated.replace_range(
            offset..offset + needle.len(),
            &format!("{attribute}=\"{}\"", escape_xml_attribute(value)),
        );
        return Ok(updated);
    }
    let insertion_at = if xml[start..=end].trim_end().ends_with("/>") {
        end.saturating_sub(1)
    } else {
        end
    };
    let mut updated = xml.to_owned();
    updated.insert_str(
        insertion_at,
        &format!(" {attribute}=\"{}\"", escape_xml_attribute(value)),
    );
    Ok(updated)
}

fn first_table_row_starts(xml: &str) -> Result<Vec<usize>, ArtifactError> {
    let mut reader = quick_xml::Reader::from_str(xml);
    reader.config_mut().check_end_names = true;
    let mut stack = Vec::<(String, bool)>::new();
    let mut starts = Vec::new();
    loop {
        let start = reader.buffer_position() as usize;
        let event = reader
            .read_event()
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        match event {
            quick_xml::events::Event::Start(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if name == "w:tr"
                    && stack
                        .last()
                        .is_some_and(|(parent, has_row)| parent == "w:tbl" && !has_row)
                {
                    if let Some((_, has_row)) = stack.last_mut() {
                        *has_row = true;
                    }
                    starts.push(start);
                }
                stack.push((name, false));
            }
            quick_xml::events::Event::Empty(event) => {
                let name = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
                    .to_owned();
                if name == "w:tr"
                    && stack
                        .last()
                        .is_some_and(|(parent, has_row)| parent == "w:tbl" && !has_row)
                {
                    if let Some((_, has_row)) = stack.last_mut() {
                        *has_row = true;
                    }
                    starts.push(start);
                }
            }
            quick_xml::events::Event::End(_) => {
                stack.pop();
            }
            quick_xml::events::Event::Eof => break,
            _ => {}
        }
    }
    Ok(starts)
}

fn mark_row_table_header(row: &str) -> Result<Option<String>, ArtifactError> {
    let trpr = ooxml::blocks(row, "w:trPr").into_iter().next();
    let Some(trpr) = trpr else {
        let start = row.find("<w:tr").ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", "table row opening tag is missing")
        })?;
        let end = find_xml_tag_end(row, start).ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", "table row opening tag is incomplete")
        })?;
        let mut updated = String::with_capacity(row.len() + 33);
        updated.push_str(&row[..end + 1]);
        updated.push_str("<w:trPr><w:tblHeader/></w:trPr>");
        updated.push_str(&row[end + 1..]);
        return Ok(Some(updated));
    };
    let header = ooxml::elements(&trpr, "w:tblHeader").into_iter().next();
    if let Some(header) = header {
        if !header.get("w:val").is_some_and(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "0" | "false" | "off" | "no"
            )
        }) {
            return Ok(None);
        }
        let (offset, _) = ordered_docx_blocks(row, "w:tblHeader")
            .into_iter()
            .next()
            .ok_or_else(|| {
                ArtifactError::new("invalid_ooxml_xml", "table header element range is missing")
            })?;
        let header_xml = ordered_docx_blocks(row, "w:tblHeader")
            .into_iter()
            .next()
            .unwrap()
            .1;
        let opening_end = find_xml_tag_end(&header_xml, 0).ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", "table header element is incomplete")
        })?;
        let attributes = crate::ooxml::parse_attributes(&header_xml[1..opening_end]);
        let Some(value) = attributes.get("w:val") else {
            return Ok(None);
        };
        let needle = format!("w:val=\"{value}\"");
        let relative = header_xml[..=opening_end].find(&needle).ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", "table header value is missing")
        })?;
        let mut updated = row.to_owned();
        updated.replace_range(offset + relative..offset + relative + needle.len(), "");
        return Ok(Some(updated));
    }
    let (offset, _) = ordered_docx_blocks(row, "w:trPr")
        .into_iter()
        .next()
        .ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", "table row properties range is missing")
        })?;
    let trpr_xml = ordered_docx_blocks(row, "w:trPr")
        .into_iter()
        .next()
        .unwrap()
        .1;
    let open_end = find_xml_tag_end(&trpr_xml, 0).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", "table row properties are incomplete")
    })?;
    let mut updated_trpr = String::new();
    if trpr_xml[..=open_end].trim_end().ends_with("/>") {
        updated_trpr.push_str(&trpr_xml[..open_end - 1]);
        updated_trpr.push('>');
        updated_trpr.push_str("<w:tblHeader/></w:trPr>");
    } else {
        updated_trpr.push_str(&trpr_xml[..=open_end]);
        updated_trpr.push_str("<w:tblHeader/>");
        updated_trpr.push_str(&trpr_xml[open_end + 1..]);
    }
    let mut updated = row.to_owned();
    updated.replace_range(offset..offset + trpr_xml.len(), &updated_trpr);
    Ok(Some(updated))
}

fn style_normalize_command(args: &[String]) -> Result<Value, ArtifactError> {
    let mut input = None;
    let mut output = None;
    let mut clear_paragraph_formatting = false;
    let mut index = 0usize;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => index += 1,
            "--clear-paragraph-formatting" => {
                clear_paragraph_formatting = true;
                index += 1;
            }
            "--input" | "--output" => {
                let flag = args[index].as_str();
                let value = args.get(index + 1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
                })?;
                if flag == "--input" {
                    input = Some(value.clone());
                } else {
                    output = Some(value.clone());
                }
                index += 2;
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
    }
    let input =
        input.ok_or_else(|| ArtifactError::new("invalid_arguments", "--input is required"))?;
    let output =
        output.ok_or_else(|| ArtifactError::new("invalid_arguments", "--output is required"))?;
    const RUN_FORMATS: &[&str] = &[
        "rFonts",
        "b",
        "bCs",
        "i",
        "iCs",
        "caps",
        "smallCaps",
        "strike",
        "dstrike",
        "outline",
        "shadow",
        "emboss",
        "imprint",
        "color",
        "spacing",
        "w",
        "kern",
        "sz",
        "szCs",
        "highlight",
        "u",
        "effect",
        "bdr",
        "shd",
        "fitText",
        "em",
    ];
    const PARAGRAPH_FORMATS: &[&str] = &[
        "keepNext",
        "keepLines",
        "pageBreakBefore",
        "framePr",
        "widowControl",
        "numFmt",
        "suppressLineNumbers",
        "pBdr",
        "shd",
        "tabs",
        "suppressAutoHyphens",
        "kinsoku",
        "wordWrap",
        "overflowPunct",
        "topLinePunct",
        "autoSpaceDE",
        "autoSpaceDN",
        "adjustRightInd",
        "snapToGrid",
        "spacing",
        "ind",
        "contextualSpacing",
        "mirrorIndents",
        "jc",
        "textAlignment",
        "textboxTightWrap",
    ];
    let mut counts = serde_json::Map::new();
    counts.insert("runFormattingProperties".into(), Value::from(0));
    counts.insert("paragraphFormattingProperties".into(), Value::from(0));
    let mut modified_parts = Vec::<String>::new();
    let output_path = rewrite_docx_package(&input, &output, |name, bytes| {
        if name == "word/document.xml" {
            let xml = String::from_utf8(bytes.clone())
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
            let (without_run_overrides, run_count) =
                remove_direct_children_from_all(&xml, "w:rPr", RUN_FORMATS)?;
            let without_empty_run_properties =
                remove_empty_xml_wrappers(&without_run_overrides, "w:rPr");
            let (cleaned, paragraph_count) = if clear_paragraph_formatting {
                remove_direct_children_from_all(
                    &without_empty_run_properties,
                    "w:pPr",
                    PARAGRAPH_FORMATS,
                )?
            } else {
                (without_empty_run_properties, 0)
            };
            if run_count > 0 || paragraph_count > 0 {
                *bytes = cleaned.into_bytes();
                counts.insert("runFormattingProperties".into(), Value::from(run_count));
                counts.insert(
                    "paragraphFormattingProperties".into(),
                    Value::from(paragraph_count),
                );
                modified_parts.push(name.to_string());
            }
        }
        Ok(())
    })?;
    let run_count = counts["runFormattingProperties"].as_u64().unwrap_or(0);
    let paragraph_count = counts["paragraphFormattingProperties"]
        .as_u64()
        .unwrap_or(0);
    if run_count == 0 && paragraph_count == 0 {
        let _ = fs::remove_file(&output_path);
        return Err(ArtifactError::new(
            "invalid_arguments",
            "no selected direct formatting was found",
        ));
    }
    Ok(json!({
        "ok": true,
        "input": input,
        "output": output_path,
        "counts": counts,
        "modifiedParts": modified_parts,
        "limitations": ["does not copy styles from a template or normalize inherited style definitions"],
    }))
}

fn remove_empty_xml_wrappers(xml: &str, tag: &str) -> String {
    let closing = format!("</{tag}>");
    let mut output = String::with_capacity(xml.len());
    let mut cursor = 0usize;
    for (offset, block) in ordered_docx_blocks(xml, tag) {
        let Some(open_end) = block.find('>') else {
            continue;
        };
        let Some(close_start) = block.rfind(&closing) else {
            continue;
        };
        if !block[open_end + 1..close_start].trim().is_empty() {
            continue;
        }
        output.push_str(&xml[cursor..offset]);
        cursor = offset + block.len();
    }
    if cursor == 0 {
        return xml.to_string();
    }
    output.push_str(&xml[cursor..]);
    output
}

fn remove_direct_children_from_all(
    xml: &str,
    parent_tag: &str,
    selected_children: &[&str],
) -> Result<(String, usize), ArtifactError> {
    let mut output = String::with_capacity(xml.len());
    let mut cursor = 0usize;
    let mut removed = 0usize;
    for (offset, block) in ordered_docx_blocks(xml, parent_tag) {
        output.push_str(&xml[cursor..offset]);
        let (cleaned, count) =
            remove_direct_children_from_block(&block, parent_tag, selected_children)?;
        output.push_str(&cleaned);
        removed += count;
        cursor = offset + block.len();
    }
    output.push_str(&xml[cursor..]);
    Ok((output, removed))
}

fn remove_direct_children_from_block(
    block: &str,
    parent_tag: &str,
    selected_children: &[&str],
) -> Result<(String, usize), ArtifactError> {
    let parent_open = format!("<{parent_tag}");
    let parent_close = format!("</{parent_tag}>");
    let start = block
        .find(&parent_open)
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", format!("missing {parent_tag}")))?;
    let open_end = find_xml_tag_end(block, start).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", format!("unterminated {parent_tag}"))
    })?;
    let content_start = open_end + 1;
    let close_start = block.rfind(&parent_close).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", format!("missing {parent_close}"))
    })?;
    let ranges = direct_child_ranges(block, content_start, close_start, selected_children)?;
    if ranges.is_empty() {
        return Ok((block.to_string(), 0));
    }
    let mut result = String::with_capacity(block.len());
    let mut cursor = 0usize;
    for (child_start, child_end) in &ranges {
        result.push_str(&block[cursor..*child_start]);
        cursor = *child_end;
    }
    result.push_str(&block[cursor..]);
    Ok((result, ranges.len()))
}

fn direct_child_ranges(
    xml: &str,
    start: usize,
    end: usize,
    selected: &[&str],
) -> Result<Vec<(usize, usize)>, ArtifactError> {
    let mut ranges = Vec::new();
    let mut depth = 0usize;
    let mut cursor = start;
    while cursor < end {
        let Some(offset) = xml[cursor..end].find('<') else {
            break;
        };
        let tag_start = cursor + offset;
        if xml[tag_start..].starts_with("<!--") {
            let Some(close) = xml[tag_start..].find("-->") else {
                break;
            };
            cursor = tag_start + close + 3;
            continue;
        }
        let tag_end = find_xml_tag_end(xml, tag_start)
            .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "unterminated child element"))?;
        if xml[tag_start..].starts_with("</") {
            depth = depth.saturating_sub(1);
            cursor = tag_end + 1;
            continue;
        }
        if xml[tag_start..].starts_with("<!") || xml[tag_start..].starts_with("<?") {
            cursor = tag_end + 1;
            continue;
        }
        let tag_name = xml[tag_start + 1..tag_end]
            .split(|character: char| character.is_ascii_whitespace() || character == '/')
            .next()
            .unwrap_or_default();
        let local_name = tag_name.rsplit(':').next().unwrap_or(tag_name);
        let self_closing = xml[tag_start..tag_end].trim_end().ends_with('/');
        if depth == 0 && selected.contains(&local_name) {
            let child_end = if self_closing {
                tag_end + 1
            } else {
                find_xml_element_end(xml, tag_start, tag_name)?
            };
            ranges.push((tag_start, child_end));
            cursor = child_end;
            continue;
        }
        if !self_closing {
            depth += 1;
        }
        cursor = tag_end + 1;
    }
    Ok(ranges)
}

fn find_xml_element_end(xml: &str, start: usize, tag: &str) -> Result<usize, ArtifactError> {
    let opening = format!("<{tag}");
    let closing = format!("</{tag}>");
    let open_end = find_xml_tag_end(xml, start)
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", format!("unterminated {tag}")))?;
    if xml[start..open_end].trim_end().ends_with('/') {
        return Ok(open_end + 1);
    }
    let mut cursor = open_end + 1;
    let mut depth = 1usize;
    while let Some(offset) = xml[cursor..].find('<') {
        let tag_start = cursor + offset;
        if xml[tag_start..].starts_with(&closing) {
            depth -= 1;
            if depth == 0 {
                return Ok(tag_start + closing.len());
            }
            cursor = tag_start + closing.len();
            continue;
        }
        if xml[tag_start..].starts_with(&opening) {
            let after_name = tag_start + opening.len();
            if xml[after_name..].chars().next().is_none_or(|character| {
                character.is_ascii_whitespace() || matches!(character, '/' | '>')
            }) {
                let nested_end = find_xml_tag_end(xml, tag_start).ok_or_else(|| {
                    ArtifactError::new("invalid_ooxml_xml", format!("unterminated {tag}"))
                })?;
                if !xml[tag_start..nested_end].trim_end().ends_with('/') {
                    depth += 1;
                }
                cursor = nested_end + 1;
                continue;
            }
        }
        cursor = tag_start + 1;
    }
    Err(ArtifactError::new(
        "invalid_ooxml_xml",
        format!("missing closing {tag}"),
    ))
}

fn protection_set_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "output" | "mode" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let input = cli::required_flag(&flags, "input")?;
    let output = cli::required_flag(&flags, "output")?;
    let mode = canonical_protection_mode(cli::required_flag(&flags, "mode")?)?;
    let source = Path::new(input)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let names = archive
        .file_names()
        .map(str::to_owned)
        .collect::<std::collections::HashSet<_>>();
    let settings_part_created = !names.contains("word/settings.xml");
    let relationship_part_created = !names.contains("word/_rels/document.xml.rels");
    let mut additional_parts = Vec::new();
    if settings_part_created {
        let settings = format!(
            "<w:settings xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">{}</w:settings>",
            protection_xml(&mode)
        );
        additional_parts.push(("word/settings.xml".to_string(), settings.into_bytes()));
    }
    let mut relationship_added = relationship_part_created;
    if relationship_part_created {
        let relationships = format!(
            "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings\" Target=\"settings.xml\"/></Relationships>"
        );
        additional_parts.push((
            "word/_rels/document.xml.rels".to_string(),
            relationships.into_bytes(),
        ));
    }
    let mut content_type_added = false;
    let output_path = rewrite_docx_package_with_additional_parts(
        input,
        output,
        additional_parts,
        |name, bytes| {
            if name == "word/settings.xml" {
                let xml = String::from_utf8(bytes.clone())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                let updated = set_protection_xml(&xml, &mode)?;
                *bytes = updated.into_bytes();
            } else if name == "[Content_Types].xml" {
                let xml = String::from_utf8(bytes.clone())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                let (updated, added) = ensure_settings_content_type(&xml)?;
                if added {
                    content_type_added = true;
                    *bytes = updated.into_bytes();
                }
            } else if name == "word/_rels/document.xml.rels" {
                let xml = String::from_utf8(bytes.clone())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                let (updated, added) = ensure_settings_relationship(&xml)?;
                if added {
                    relationship_added = true;
                    *bytes = updated.into_bytes();
                }
            }
            Ok(())
        },
    )?;
    Ok(json!({
        "ok": true,
        "input": source,
        "output": output_path,
        "mode": mode,
        "passwordProtected": false,
        "settingsPartCreated": settings_part_created,
        "settingsRelationshipAdded": relationship_added,
        "contentTypeOverrideAdded": content_type_added,
    }))
}

fn canonical_protection_mode(mode: &str) -> Result<String, ArtifactError> {
    let normalized = mode
        .trim()
        .replace('-', "_")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("_")
        .to_ascii_lowercase();
    match normalized.as_str() {
        "off" => Ok("off".into()),
        "readonly" | "read_only" => Ok("readOnly".into()),
        "comments" => Ok("comments".into()),
        "trackedchanges" | "tracked_changes" => Ok("trackedChanges".into()),
        "forms" => Ok("forms".into()),
        _ => Err(ArtifactError::new(
            "invalid_arguments",
            "mode must be off, readOnly, comments, trackedChanges, or forms",
        )),
    }
}

fn protection_xml(mode: &str) -> String {
    if mode == "off" {
        String::new()
    } else {
        format!("<w:documentProtection w:edit=\"{mode}\" w:enforcement=\"1\" w:formatting=\"0\"/>")
    }
}

fn set_protection_xml(xml: &str, mode: &str) -> Result<String, ArtifactError> {
    let (mut updated, _) = remove_xml_element(xml, "w:documentProtection")?;
    if mode == "off" {
        return Ok(updated);
    }
    let root = "w:settings";
    let opening = format!("<{root}");
    let Some(start) = updated.find(&opening) else {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "settings XML is missing its w:settings root",
        ));
    };
    let end = find_xml_tag_end(&updated, start)
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "settings root is unterminated"))?;
    if updated[start..end].trim_end().ends_with('/') {
        let open_tag = updated[start..end]
            .trim_end()
            .strip_suffix('/')
            .unwrap_or(&updated[start..end]);
        updated.replace_range(
            start..=end,
            &format!("{open_tag}>{}</{root}>", protection_xml(mode)),
        );
    } else {
        updated.insert_str(end + 1, &protection_xml(mode));
    }
    Ok(updated)
}

fn ensure_settings_content_type(xml: &str) -> Result<(String, bool), ArtifactError> {
    const CONTENT_TYPE: &str =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml";
    let mut matches = ooxml::elements(xml, "Override")
        .into_iter()
        .filter(|attributes| {
            attributes
                .get("PartName")
                .is_some_and(|value| value == "/word/settings.xml")
        })
        .collect::<Vec<_>>();
    if matches.len() > 1 {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "[Content_Types].xml contains duplicate settings overrides",
        ));
    }
    if let Some(attributes) = matches.pop() {
        if attributes
            .get("ContentType")
            .is_some_and(|value| value == CONTENT_TYPE)
        {
            return Ok((xml.to_string(), false));
        }
        return set_unqualified_attribute_on_tag(
            xml,
            "Override",
            "PartName",
            "/word/settings.xml",
            "ContentType",
            CONTENT_TYPE,
        )
        .map(|updated| (updated, true));
    }
    let fragment =
        format!("<Override PartName=\"/word/settings.xml\" ContentType=\"{CONTENT_TYPE}\"/>");
    insert_before_root_close(xml, "Types", &fragment).map(|updated| (updated, true))
}

fn ensure_settings_relationship(xml: &str) -> Result<(String, bool), ArtifactError> {
    const REL_TYPE: &str =
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings";
    let matches = ooxml::elements(xml, "Relationship")
        .into_iter()
        .filter(|attributes| {
            attributes
                .get("Type")
                .is_some_and(|value| value == REL_TYPE)
        })
        .collect::<Vec<_>>();
    if matches.len() > 1 {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "document relationships contain duplicate settings relationships",
        ));
    }
    if let Some(attributes) = matches.first() {
        let target = attributes
            .get("Target")
            .map(String::as_str)
            .unwrap_or("")
            .replace('\\', "/");
        let resolved = if target.starts_with('/') {
            target.trim_start_matches('/').to_string()
        } else {
            format!("word/{target}")
        };
        if resolved != "word/settings.xml" {
            return Err(ArtifactError::new(
                "invalid_ooxml_xml",
                "existing settings relationship does not target word/settings.xml",
            ));
        }
        return Ok((xml.to_string(), false));
    }
    let used_ids = ooxml::elements(xml, "Relationship")
        .into_iter()
        .filter_map(|attributes| attributes.get("Id").cloned())
        .collect::<std::collections::HashSet<_>>();
    let mut number = 1usize;
    while used_ids.contains(&format!("rId{number}")) {
        number += 1;
    }
    let fragment =
        format!("<Relationship Id=\"rId{number}\" Type=\"{REL_TYPE}\" Target=\"settings.xml\"/>");
    insert_before_root_close(xml, "Relationships", &fragment).map(|updated| (updated, true))
}

fn insert_before_root_close(
    xml: &str,
    root: &str,
    fragment: &str,
) -> Result<String, ArtifactError> {
    let opening = format!("<{root}");
    let Some(start) = xml.find(&opening) else {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            format!("XML is missing its {root} root"),
        ));
    };
    let open_end = find_xml_tag_end(xml, start).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", format!("{root} root is unterminated"))
    })?;
    if xml[start..open_end].trim_end().ends_with('/') {
        let open_tag = xml[start..open_end]
            .trim_end()
            .strip_suffix('/')
            .unwrap_or(&xml[start..open_end]);
        let mut updated = String::with_capacity(xml.len() + fragment.len());
        updated.push_str(&xml[..start]);
        updated.push_str(&format!("{open_tag}>{fragment}</{root}>"));
        updated.push_str(&xml[open_end + 1..]);
        return Ok(updated);
    }
    let closing = format!("</{root}>");
    let close_start = xml.rfind(&closing).ok_or_else(|| {
        ArtifactError::new(
            "invalid_ooxml_xml",
            format!("{root} root has no closing tag"),
        )
    })?;
    let mut updated = String::with_capacity(xml.len() + fragment.len());
    updated.push_str(&xml[..close_start]);
    updated.push_str(fragment);
    updated.push_str(&xml[close_start..]);
    Ok(updated)
}

fn set_unqualified_attribute_on_tag(
    xml: &str,
    tag: &str,
    match_attribute: &str,
    match_value: &str,
    attribute: &str,
    value: &str,
) -> Result<String, ArtifactError> {
    let opening = format!("<{tag}");
    let mut search_from = 0usize;
    while let Some(relative_start) = xml[search_from..].find(&opening) {
        let start = search_from + relative_start;
        let after_name = start + opening.len();
        if xml[after_name..].chars().next().is_some_and(|character| {
            !character.is_ascii_whitespace() && !matches!(character, '/' | '>')
        }) {
            search_from = after_name;
            continue;
        }
        let end = find_xml_tag_end(xml, start).ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", format!("unterminated {tag} element"))
        })?;
        let attributes = crate::ooxml::parse_attributes(&xml[start + 1..end]);
        if attributes
            .get(match_attribute)
            .is_some_and(|found| found == match_value)
        {
            if let Some(old) = attributes.get(attribute) {
                let needle = format!("{attribute}=\"{old}\"");
                let needle_start = xml[start..=end].find(&needle).ok_or_else(|| {
                    ArtifactError::new("invalid_ooxml_xml", format!("could not update {attribute}"))
                })? + start;
                let mut updated = xml.to_string();
                updated.replace_range(
                    needle_start..needle_start + needle.len(),
                    &format!("{attribute}=\"{}\"", escape_xml_attribute(value)),
                );
                return Ok(updated);
            }
            let insertion_at = if xml[start..=end].trim_end().ends_with("/>") {
                end.saturating_sub(1)
            } else {
                end
            };
            let mut updated = xml.to_string();
            updated.insert_str(
                insertion_at,
                &format!(" {attribute}=\"{}\"", escape_xml_attribute(value)),
            );
            return Ok(updated);
        }
        search_from = end + 1;
    }
    Err(ArtifactError::new(
        "invalid_ooxml_xml",
        format!("could not locate {tag} element"),
    ))
}

fn distill_template_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "output" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    distill_template(
        cli::required_flag(&flags, "input")?,
        cli::required_flag(&flags, "output")?,
    )
}

fn distill_template(input_path: &str, output_path: &str) -> Result<Value, ArtifactError> {
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !source.is_file()
        || !source.extension().is_some_and(|extension| {
            extension.eq_ignore_ascii_case("docx") || extension.eq_ignore_ascii_case("dotx")
        })
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular .docx or .dotx file",
        ));
    }
    let output = Path::new(output_path);
    if !output
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "output must be a separate .md file",
        ));
    }
    let parent = output
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(parent)
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
    let parent = parent
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
    let destination = parent.join(output.file_name().ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "output path must include a file name")
    })?);
    if source == destination {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "output must be a separate .md file",
        ));
    }
    let file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let styles = read_docx_part(&mut archive, "word/styles.xml")?;
    let document = read_docx_part(&mut archive, "word/document.xml")?;
    let theme = read_optional_docx_part(&mut archive, "word/theme/theme1.xml")?;
    let numbering = read_optional_docx_part(&mut archive, "word/numbering.xml")?;

    let default_run = ooxml::blocks(&styles, "w:docDefaults")
        .first()
        .and_then(|defaults| ooxml::blocks(defaults, "w:rPrDefault").first().cloned())
        .and_then(|default| ooxml::blocks(&default, "w:rPr").first().cloned());
    let default_font = default_run
        .as_deref()
        .and_then(|run| ooxml::elements(run, "w:rFonts").first().cloned())
        .and_then(|attrs| attrs.get("w:ascii").cloned());
    let default_size = default_run
        .as_deref()
        .and_then(|run| ooxml::elements(run, "w:sz").first().cloned())
        .and_then(|attrs| attrs.get("w:val").cloned());

    let mut styles_rows = Vec::<[String; 5]>::new();
    for style in ooxml::blocks(&styles, "w:style") {
        let attributes = ooxml::elements(&style, "w:style")
            .first()
            .cloned()
            .unwrap_or_default();
        let style_id = attributes.get("w:styleId").cloned().unwrap_or_default();
        let name = ooxml::elements(&style, "w:name")
            .first()
            .and_then(|attrs| attrs.get("w:val"))
            .cloned()
            .unwrap_or_else(|| style_id.clone());
        if name.is_empty() {
            continue;
        }
        let style_type = attributes.get("w:type").cloned().unwrap_or_default();
        let based_on = ooxml::elements(&style, "w:basedOn")
            .first()
            .and_then(|attrs| attrs.get("w:val"))
            .cloned()
            .unwrap_or_default();
        let outline = ooxml::elements(&style, "w:outlineLvl")
            .first()
            .and_then(|attrs| attrs.get("w:val"))
            .cloned()
            .unwrap_or_default();
        styles_rows.push([style_type, name, style_id, based_on, outline]);
    }

    let sections = ooxml::blocks(&document, "w:sectPr");
    let last_section = sections.last();
    let page = last_section.and_then(|section| ooxml::elements(section, "w:pgSz").last().cloned());
    let margins =
        last_section.and_then(|section| ooxml::elements(section, "w:pgMar").last().cloned());
    let mut theme_colors = Vec::new();
    let mut theme_fonts = Vec::new();
    if let Some(theme) = theme.as_deref() {
        if let Some(scheme) = ooxml::blocks(theme, "a:clrScheme").first() {
            for color_tag in [
                "a:dk1",
                "a:lt1",
                "a:dk2",
                "a:lt2",
                "a:accent1",
                "a:accent2",
                "a:accent3",
                "a:accent4",
                "a:accent5",
                "a:accent6",
                "a:hlink",
                "a:folHlink",
            ] {
                let color_blocks = ooxml::blocks(scheme, color_tag);
                let Some(color) = color_blocks.first() else {
                    continue;
                };
                let color_attrs = ooxml::elements(
                    color,
                    if color.contains("<a:srgbClr") {
                        "a:srgbClr"
                    } else {
                        "a:sysClr"
                    },
                );
                let Some(attrs) = color_attrs.first() else {
                    continue;
                };
                let value = attrs
                    .get("lastClr")
                    .or_else(|| attrs.get("val"))
                    .cloned()
                    .unwrap_or_default();
                theme_colors.push((color_tag.trim_start_matches("a:"), value));
            }
        }
        if let Some(font_scheme) = ooxml::blocks(theme, "a:fontScheme").first() {
            for role in ["a:majorFont", "a:minorFont"] {
                if let Some(latin) = ooxml::blocks(font_scheme, role)
                    .first()
                    .and_then(|font| ooxml::elements(font, "a:latin").first().cloned())
                {
                    theme_fonts.push((
                        role.trim_start_matches("a:"),
                        latin.get("typeface").cloned().unwrap_or_default(),
                    ));
                }
            }
        }
    }
    let abstract_count = numbering
        .as_deref()
        .map_or(0, |xml| count_xml_start_tags(xml, "w:abstractNum"));
    let numbering_count = numbering
        .as_deref()
        .map_or(0, |xml| count_xml_start_tags(xml, "w:num"));

    let mut lines = vec![
        "# Distilled DOCX Template Style Guide".to_string(),
        String::new(),
        format!("Source: `{}`", source.file_name().and_then(|name| name.to_str()).unwrap_or("template.docx")),
        String::new(),
        "This inventory records reusable document conventions. It does not include personal document properties.".to_string(),
        String::new(),
        "## Page setup".to_string(),
        String::new(),
    ];
    if let Some(page) = page.as_ref() {
        lines.push(format!(
            "- Page size: {} × {} twips; orientation: {}.",
            page.get("w:w").map(String::as_str).unwrap_or("?"),
            page.get("w:h").map(String::as_str).unwrap_or("?"),
            page.get("w:orient")
                .map(String::as_str)
                .unwrap_or("portrait")
        ));
    }
    if let Some(margins) = margins.as_ref() {
        lines.push(format!(
            "- Margins (twips): top={}, right={}, bottom={}, left={}.",
            margins.get("w:top").map(String::as_str).unwrap_or("?"),
            margins.get("w:right").map(String::as_str).unwrap_or("?"),
            margins.get("w:bottom").map(String::as_str).unwrap_or("?"),
            margins.get("w:left").map(String::as_str).unwrap_or("?")
        ));
    }
    if default_font.is_some() || default_size.is_some() {
        lines.push(format!(
            "- Default run: font `{}`, size `{}` half-points.",
            default_font.as_deref().unwrap_or("inherited"),
            default_size.as_deref().unwrap_or("inherited")
        ));
    }
    if !lines.iter().any(|line| line.starts_with("- ")) {
        lines.push("- No page setup or default run values found.".into());
    }
    lines.extend([String::new(), "## Theme".into(), String::new()]);
    lines.extend(
        theme_colors
            .iter()
            .map(|(name, color)| format!("- Color `{name}`: `{color}`.")),
    );
    lines.extend(
        theme_fonts
            .iter()
            .map(|(role, font)| format!("- Font `{role}`: `{font}`.")),
    );
    if theme_colors.is_empty() && theme_fonts.is_empty() {
        lines.push("- No theme color or font scheme found.".into());
    }
    lines.extend([
        String::new(),
        "## Styles".into(),
        String::new(),
        "| Type | Name | Style ID | Based on | Outline level |".into(),
        "| --- | --- | --- | --- | --- |".into(),
    ]);
    for row in styles_rows {
        let escaped = row.map(|cell| cell.replace('|', "\\|"));
        lines.push(format!(
            "| {} | {} | {} | {} | {} |",
            escaped[0], escaped[1], escaped[2], escaped[3], escaped[4]
        ));
    }
    lines.extend([
        String::new(),
        "## Numbering inventory".into(),
        String::new(),
        format!("- Abstract numbering definitions: {abstract_count}."),
        format!("- Numbering instances: {numbering_count}."),
        String::new(),
    ]);
    let contents = lines.join("\n");
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&destination)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                ArtifactError::new(
                    "output_exists",
                    format!("output already exists: {}", destination.display()),
                )
            } else {
                ArtifactError::new("ooxml_write_error", error.to_string())
            }
        })?;
    if let Err(error) = file.write_all(contents.as_bytes()) {
        let _ = fs::remove_file(&destination);
        return Err(ArtifactError::new("ooxml_write_error", error.to_string()));
    }
    Ok(json!({"ok": true, "output": destination}))
}

fn read_optional_docx_part<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    part: &str,
) -> Result<Option<String>, ArtifactError> {
    match archive.by_name(part) {
        Ok(mut entry) => {
            if entry.size() > MAX_DOCX_PART_BYTES {
                return Err(ArtifactError::new(
                    "ooxml_part_too_large",
                    format!("{part} exceeds the 2 MiB analysis limit"),
                ));
            }
            let mut bytes = Vec::new();
            entry
                .read_to_end(&mut bytes)
                .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
            String::from_utf8(bytes)
                .map(Some)
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))
        }
        Err(zip::result::ZipError::FileNotFound) => Ok(None),
        Err(error) => Err(ArtifactError::new(
            "invalid_ooxml_package",
            error.to_string(),
        )),
    }
}

fn tracked_process_command(args: &[String]) -> Result<Value, ArtifactError> {
    let mut input = None;
    let mut output = None;
    let mut operation = None;
    let mut keep_tracking_on = false;
    let mut index = 0usize;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => index += 1,
            "--keep-tracking-on" => {
                keep_tracking_on = true;
                index += 1;
            }
            "--input" | "--output" | "--operation" => {
                let flag = args[index].as_str();
                let value = args.get(index + 1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
                })?;
                match flag {
                    "--input" => input = Some(value.clone()),
                    "--output" => output = Some(value.clone()),
                    _ => operation = Some(value.clone()),
                }
                index += 2;
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
    }
    let input =
        input.ok_or_else(|| ArtifactError::new("invalid_arguments", "--input is required"))?;
    let output =
        output.ok_or_else(|| ArtifactError::new("invalid_arguments", "--output is required"))?;
    let operation = operation
        .ok_or_else(|| ArtifactError::new("invalid_arguments", "--operation is required"))?;
    if !matches!(operation.as_str(), "accept" | "reject") {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--operation must be accept or reject",
        ));
    }
    let mut count = 0usize;
    let mut tracking_disabled = false;
    let mut modified_parts = Vec::new();
    let output_path = rewrite_docx_package(&input, &output, |name, bytes| {
        if name.starts_with("word/") && name.ends_with(".xml") && !name.starts_with("word/theme/") {
            let xml = String::from_utf8(bytes.clone())
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
            let (mut updated, part_count) = resolve_revision_markup(&xml, &operation)?;
            let mut changed = part_count > 0;
            if name == "word/settings.xml" && !keep_tracking_on {
                let (cleaned, disabled) = remove_xml_element(&updated, "w:trackRevisions")?;
                if disabled {
                    updated = cleaned;
                    tracking_disabled = true;
                    changed = true;
                }
            }
            if changed {
                *bytes = updated.into_bytes();
                count += part_count;
                modified_parts.push(name.to_string());
            }
        }
        Ok(())
    })?;
    if count == 0 {
        let _ = fs::remove_file(&output_path);
        return Err(ArtifactError::new(
            "invalid_arguments",
            "no supported tracked-change markup was found",
        ));
    }
    Ok(json!({
        "ok": true,
        "operation": operation,
        "input": input,
        "output": output_path,
        "processedMarkers": count,
        "modifiedParts": modified_parts,
        "trackingDisabled": tracking_disabled,
        "keepTrackingOn": keep_tracking_on,
        "limitations": ["handles ins, del, moveFrom, and moveTo wrappers; not every Word revision construct"],
    }))
}

fn tracked_add_replacements_command(args: &[String]) -> Result<Value, ArtifactError> {
    let mut input = None;
    let mut output = None;
    let mut author = "Ruxex".to_owned();
    let mut replacements = Vec::<(String, String)>::new();
    let mut index = 0usize;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => index += 1,
            "--input" | "--output" | "--author" | "--replace" => {
                let flag = args[index].as_str();
                let value = args.get(index + 1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
                })?;
                match flag {
                    "--input" => input = Some(value.clone()),
                    "--output" => output = Some(value.clone()),
                    "--author" => author = value.clone(),
                    _ => replacements.push(parse_text_replacement(value)?),
                }
                index += 2;
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
    }
    let input =
        input.ok_or_else(|| ArtifactError::new("invalid_arguments", "--input is required"))?;
    let output =
        output.ok_or_else(|| ArtifactError::new("invalid_arguments", "--output is required"))?;
    if author.trim().is_empty() || replacements.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "author and at least one non-empty OLD replacement are required",
        ));
    }
    tracked_add_replacements(&input, &output, &author, &replacements)
}

fn tracked_add_replacements(
    input: &str,
    output: &str,
    author: &str,
    replacements: &[(String, String)],
) -> Result<Value, ArtifactError> {
    let mut applied = Vec::<Value>::new();
    let mut unmatched = Vec::<String>::new();
    let mut change_id = 1usize;
    let settings_name = "word/settings.xml";
    let empty_settings = r#"<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:trackRevisions/></w:settings>"#;
    let mut tracking_was_enabled = false;
    let output_path = rewrite_docx_package_with_additional_parts(
        input,
        output,
        vec![(settings_name.to_owned(), empty_settings.as_bytes().to_vec())],
        |name, bytes| {
            if name == "word/document.xml" {
                let xml = String::from_utf8(bytes.clone())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                change_id = next_docx_change_id(&xml)?;
                let mut updated = xml;
                for (old, new) in replacements {
                    if replace_first_simple_run(&mut updated, old, new, change_id, author)? {
                        applied.push(json!({"old": old, "new": new}));
                        change_id = change_id.saturating_add(2);
                    } else {
                        unmatched.push(old.clone());
                    }
                }
                *bytes = updated.into_bytes();
            } else if name == settings_name {
                let xml = String::from_utf8(bytes.clone())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                tracking_was_enabled = xml_element_spans(&xml, "w:trackRevisions")?.len() > 0;
                if !tracking_was_enabled {
                    *bytes = insert_before_root_close(&xml, "w:settings", "<w:trackRevisions/>")?
                        .into_bytes();
                }
            }
            Ok(())
        },
    )?;
    if applied.is_empty() {
        let _ = fs::remove_file(output_path);
        return Err(ArtifactError::new(
            "invalid_arguments",
            "no simple tracked replacement matched a single w:t node",
        ));
    }
    Ok(json!({
        "ok": true,
        "input": Path::new(input).canonicalize().unwrap_or_else(|_| PathBuf::from(input)),
        "output": output_path,
        "author": author,
        "replacements": applied.len(),
        "unmatched": unmatched,
        "trackingEnabled": true,
        "limitations": [
            "replacements are limited to one simple w:t text node",
            "matches spanning multiple runs or runs with additional inline content are not changed"
        ]
    }))
}

fn next_docx_change_id(xml: &str) -> Result<usize, ArtifactError> {
    let mut reader = quick_xml::Reader::from_str(xml);
    reader.config_mut().check_end_names = true;
    let mut max_id = 0usize;
    loop {
        match reader
            .read_event()
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
        {
            quick_xml::events::Event::Start(event) | quick_xml::events::Event::Empty(event) => {
                for attribute in event.attributes().with_checks(false) {
                    let attribute = attribute.map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    if attribute.key.as_ref() == b"w:id" {
                        let value = attribute
                            .decode_and_unescape_value(reader.decoder())
                            .map_err(|error| {
                                ArtifactError::new("invalid_ooxml_xml", error.to_string())
                            })?;
                        if let Ok(id) = value.parse::<usize>() {
                            max_id = max_id.max(id);
                        }
                    }
                }
            }
            quick_xml::events::Event::Eof => break,
            _ => {}
        }
    }
    Ok(max_id.saturating_add(1))
}

fn replace_first_simple_run(
    xml: &mut String,
    old: &str,
    new: &str,
    change_id: usize,
    author: &str,
) -> Result<bool, ArtifactError> {
    for run_span in xml_element_spans(xml, "w:r")? {
        let run = &xml[run_span.start..run_span.end];
        let children = direct_child_spans(run)?;
        let text_children = children
            .iter()
            .filter(|child| child.name == "w:t")
            .collect::<Vec<_>>();
        if text_children.len() != 1
            || children
                .iter()
                .any(|child| child.name != "w:t" && child.name != "w:rPr")
        {
            continue;
        }
        let text_span = text_children[0];
        let text_block = &run[text_span.start..text_span.end];
        let value = ooxml::text_values(text_block, "w:t").join("");
        let Some(match_at) = value.find(old) else {
            continue;
        };
        let before = &value[..match_at];
        let after = &value[match_at + old.len()..];
        let properties = children
            .iter()
            .find(|child| child.name == "w:rPr")
            .map(|child| run[child.start..child.end].to_owned())
            .unwrap_or_default();
        let mut replacement = String::new();
        if !before.is_empty() {
            replacement.push_str(&tracked_text_run(&properties, "t", before));
        }
        let safe_author = escape_xml_text(author)
            .replace('"', "&quot;")
            .replace('\'', "&apos;");
        let timestamp = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
        replacement.push_str(&format!(
            "<w:del w:id=\"{change_id}\" w:author=\"{safe_author}\" w:date=\"{timestamp}\"><w:r><w:delText{}>{}</w:delText></w:r></w:del>",
            xml_space_attribute(old), escape_xml_text(old)
        ));
        replacement.push_str(&format!(
            "<w:ins w:id=\"{}\" w:author=\"{safe_author}\" w:date=\"{timestamp}\"><w:r><w:t{}>{}</w:t></w:r></w:ins>",
            change_id.saturating_add(1), xml_space_attribute(new), escape_xml_text(new)
        ));
        if !after.is_empty() {
            replacement.push_str(&tracked_text_run(&properties, "t", after));
        }
        xml.replace_range(run_span.start..run_span.end, &replacement);
        return Ok(true);
    }
    Ok(false)
}

fn tracked_text_run(properties: &str, tag: &str, value: &str) -> String {
    format!(
        "<w:r>{properties}<w:{tag}{}>{}</w:{tag}></w:r>",
        xml_space_attribute(value),
        escape_xml_text(value)
    )
}

fn xml_space_attribute(value: &str) -> &'static str {
    if value.starts_with(char::is_whitespace) || value.ends_with(char::is_whitespace) {
        " xml:space=\"preserve\""
    } else {
        ""
    }
}

fn table_geometry_set_command(args: &[String]) -> Result<Value, ArtifactError> {
    let mut input = None::<String>;
    let mut output = None::<String>;
    let mut widths = Vec::<usize>::new();
    let mut table_indices = Vec::<usize>::new();
    let mut has_table_indices = false;
    let mut indent = 120usize;
    let mut margins = BTreeMap::from([
        ("start".to_owned(), 120usize),
        ("end".to_owned(), 120usize),
        ("top".to_owned(), 80usize),
        ("bottom".to_owned(), 80usize),
    ]);
    let mut index = 0usize;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => index += 1,
            "--input"
            | "--output"
            | "--indent-dxa"
            | "--table-index"
            | "--start-margin-dxa"
            | "--end-margin-dxa"
            | "--top-margin-dxa"
            | "--bottom-margin-dxa" => {
                let flag = args[index].as_str();
                let value = args.get(index + 1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
                })?;
                match flag {
                    "--input" => input = Some(value.clone()),
                    "--output" => output = Some(value.clone()),
                    "--indent-dxa" => indent = parse_nonnegative_dxa(value, flag)?,
                    "--table-index" => {
                        has_table_indices = true;
                        table_indices.push(value.parse::<usize>().map_err(|_| {
                            ArtifactError::new(
                                "invalid_arguments",
                                "table index must be a nonnegative integer",
                            )
                        })?);
                    }
                    _ => {
                        let side = match flag {
                            "--start-margin-dxa" => "start",
                            "--end-margin-dxa" => "end",
                            "--top-margin-dxa" => "top",
                            _ => "bottom",
                        };
                        margins.insert(side.to_owned(), parse_nonnegative_dxa(value, flag)?);
                    }
                }
                index += 2;
            }
            "--column-widths-dxa" => {
                index += 1;
                while let Some(value) = args.get(index).filter(|value| !value.starts_with("--")) {
                    let width = value.parse::<usize>().map_err(|_| {
                        ArtifactError::new(
                            "invalid_arguments",
                            "column widths must be positive DXA integers",
                        )
                    })?;
                    if width == 0 {
                        return Err(ArtifactError::new(
                            "invalid_arguments",
                            "column widths must be positive DXA integers",
                        ));
                    }
                    widths.push(width);
                    index += 1;
                }
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
    }
    let input =
        input.ok_or_else(|| ArtifactError::new("invalid_arguments", "--input is required"))?;
    let output =
        output.ok_or_else(|| ArtifactError::new("invalid_arguments", "--output is required"))?;
    if widths.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--column-widths-dxa requires at least one positive width",
        ));
    }
    if has_table_indices && table_indices.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "select at least one table, or omit --table-index to select all",
        ));
    }
    if table_indices
        .iter()
        .collect::<std::collections::HashSet<_>>()
        .len()
        != table_indices.len()
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--table-index values must not be repeated",
        ));
    }
    let mut selected_indices = Vec::<usize>::new();
    let total_width = widths.iter().sum::<usize>();
    let output_path = rewrite_docx_package(&input, &output, |name, bytes| {
        if name != "word/document.xml" {
            return Ok(());
        }
        let xml = String::from_utf8(bytes.clone())
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        let body = xml_element_spans(&xml, "w:body")?
            .into_iter()
            .next()
            .ok_or_else(|| {
                ArtifactError::new("invalid_ooxml_xml", "word/document.xml is missing w:body")
            })?;
        let body_xml = &xml[body.start..body.end];
        let tables = direct_child_spans(body_xml)?
            .into_iter()
            .filter(|child| child.name == "w:tbl")
            .collect::<Vec<_>>();
        if tables.is_empty() {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "document has no top-level body tables",
            ));
        }
        if has_table_indices {
            if table_indices
                .iter()
                .any(|table_index| *table_index >= tables.len())
            {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("table index must be between 0 and {}", tables.len() - 1),
                ));
            }
            selected_indices = table_indices.clone();
        } else {
            selected_indices = (0..tables.len()).collect();
        }
        // Preflight every selected table before editing any of them.
        for table_index in &selected_indices {
            validate_geometry_table(
                &body_xml[tables[*table_index].start..tables[*table_index].end],
                *table_index,
                widths.len(),
            )?;
        }
        let mut updated_body = body_xml.to_owned();
        for table_index in selected_indices.iter().rev() {
            let table = &tables[*table_index];
            let changed = apply_table_geometry(
                &updated_body[table.start..table.end],
                &widths,
                indent,
                &margins,
            )?;
            updated_body.replace_range(table.start..table.end, &changed);
        }
        let mut updated_xml = xml;
        updated_xml.replace_range(body.start..body.end, &updated_body);
        *bytes = updated_xml.into_bytes();
        Ok(())
    })?;
    Ok(json!({
        "ok": true,
        "input": Path::new(&input).canonicalize().unwrap_or_else(|_| PathBuf::from(&input)),
        "output": output_path,
        "tableIndices": selected_indices,
        "columnWidthsDxa": widths,
        "tableWidthDxa": total_width,
        "indentDxa": indent,
        "cellMarginsDxa": margins,
        "limitations": [
            "only top-level body tables are selected; header/footer tables are untouched",
            "merged cells, gridSpan, hMerge/vMerge, and irregular row cell counts are refused"
        ]
    }))
}

fn parse_nonnegative_dxa(value: &str, flag: &str) -> Result<usize, ArtifactError> {
    value.parse::<usize>().map_err(|_| {
        ArtifactError::new(
            "invalid_arguments",
            format!("{flag} must be a nonnegative DXA integer"),
        )
    })
}

fn validate_geometry_table(
    table: &str,
    index: usize,
    column_count: usize,
) -> Result<(), ArtifactError> {
    let rows = direct_child_spans(table)?
        .into_iter()
        .filter(|child| child.name == "w:tr")
        .collect::<Vec<_>>();
    if rows.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("table {index} has no direct body rows"),
        ));
    }
    for (row_index, row) in rows.iter().enumerate() {
        let row_xml = &table[row.start..row.end];
        let cells = direct_child_spans(row_xml)?
            .into_iter()
            .filter(|child| child.name == "w:tc")
            .collect::<Vec<_>>();
        for cell in &cells {
            let cell_xml = &row_xml[cell.start..cell.end];
            let tc_properties = direct_child_spans(cell_xml)?
                .into_iter()
                .find(|child| child.name == "w:tcPr");
            if let Some(properties) = tc_properties {
                let properties_xml = &cell_xml[properties.start..properties.end];
                if direct_child_spans(properties_xml)?.iter().any(|child| {
                    matches!(child.name.as_str(), "w:gridSpan" | "w:hMerge" | "w:vMerge")
                }) {
                    return Err(ArtifactError::new(
                        "invalid_arguments",
                        format!(
                            "table {index} contains merged cells (gridSpan, hMerge, or vMerge) and cannot be resized safely"
                        ),
                    ));
                }
            }
        }
        if cells.len() != column_count {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!(
                    "table {index}, row {row_index} has {} cells; expected {column_count} columns",
                    cells.len()
                ),
            ));
        }
    }
    Ok(())
}

fn apply_table_geometry(
    table: &str,
    widths: &[usize],
    indent: usize,
    margins: &BTreeMap<String, usize>,
) -> Result<String, ArtifactError> {
    let mut updated = table.to_owned();
    let table_properties = direct_child_spans(&updated)?
        .into_iter()
        .find(|child| child.name == "w:tblPr");
    if table_properties.is_none() {
        updated = insert_after_opening_tag(&updated, "w:tblPr", "<w:tblPr/>")?;
    }
    let properties_span = direct_child_spans(&updated)?
        .into_iter()
        .find(|child| child.name == "w:tblPr")
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "could not create w:tblPr"))?;
    let mut properties = updated[properties_span.start..properties_span.end].to_owned();
    const TBLPR_ORDER: &[&str] = &[
        "w:tblStyle",
        "w:tblpPr",
        "w:tblOverlap",
        "w:bidiVisual",
        "w:tblStyleRowBandSize",
        "w:tblStyleColBandSize",
        "w:tblW",
        "w:jc",
        "w:tblCellSpacing",
        "w:tblInd",
        "w:tblBorders",
        "w:shd",
        "w:tblLayout",
        "w:tblCellMar",
        "w:tblLook",
        "w:tblCaption",
        "w:tblDescription",
    ];
    for (tag, fragment) in [
        (
            "w:tblW",
            format!(
                "<w:tblW w:w=\"{}\" w:type=\"dxa\"/>",
                widths.iter().sum::<usize>()
            ),
        ),
        (
            "w:tblInd",
            format!("<w:tblInd w:w=\"{indent}\" w:type=\"dxa\"/>"),
        ),
        ("w:tblLayout", "<w:tblLayout w:type=\"fixed\"/>".to_owned()),
    ] {
        properties = upsert_ordered_xml_child(&properties, "w:tblPr", tag, &fragment, TBLPR_ORDER)?;
    }
    let updated_properties_span = direct_child_spans(&updated)?
        .into_iter()
        .find(|child| child.name == "w:tblPr")
        .unwrap();
    updated.replace_range(
        updated_properties_span.start..updated_properties_span.end,
        &properties,
    );

    let grid_span = direct_child_spans(&updated)?
        .into_iter()
        .find(|child| child.name == "w:tblGrid");
    let grid = format!(
        "<w:tblGrid>{}</w:tblGrid>",
        widths
            .iter()
            .map(|width| format!("<w:gridCol w:w=\"{width}\"/>"))
            .collect::<String>()
    );
    if let Some(grid_span) = grid_span {
        updated.replace_range(grid_span.start..grid_span.end, &grid);
    } else {
        let properties_span = direct_child_spans(&updated)?
            .into_iter()
            .find(|child| child.name == "w:tblPr")
            .unwrap();
        updated.insert_str(properties_span.end, &grid);
    }

    let rows = direct_child_spans(&updated)?
        .into_iter()
        .filter(|child| child.name == "w:tr")
        .collect::<Vec<_>>();
    for row in rows.iter().rev() {
        let row_xml = updated[row.start..row.end].to_owned();
        let cells = direct_child_spans(&row_xml)?
            .into_iter()
            .filter(|child| child.name == "w:tc")
            .collect::<Vec<_>>();
        for (cell_index, cell) in cells.iter().enumerate().rev() {
            let original_cell = row_xml[cell.start..cell.end].to_owned();
            let changed_cell = apply_cell_geometry(&original_cell, widths[cell_index], margins)?;
            let offset = row.start + cell.start;
            updated.replace_range(offset..offset + original_cell.len(), &changed_cell);
        }
    }
    Ok(updated)
}

fn apply_cell_geometry(
    cell: &str,
    width: usize,
    margins: &BTreeMap<String, usize>,
) -> Result<String, ArtifactError> {
    let mut updated = cell.to_owned();
    let properties_span = direct_child_spans(&updated)?
        .into_iter()
        .find(|child| child.name == "w:tcPr");
    if properties_span.is_none() {
        updated = insert_after_opening_tag(&updated, "w:tcPr", "<w:tcPr/>")?;
    }
    let properties_span = direct_child_spans(&updated)?
        .into_iter()
        .find(|child| child.name == "w:tcPr")
        .unwrap();
    let mut properties = updated[properties_span.start..properties_span.end].to_owned();
    const TCPR_ORDER: &[&str] = &[
        "w:cnfStyle",
        "w:tcW",
        "w:gridSpan",
        "w:hMerge",
        "w:vMerge",
        "w:tcBorders",
        "w:shd",
        "w:noWrap",
        "w:tcMar",
        "w:textDirection",
        "w:tcFitText",
        "w:vAlign",
        "w:hideMark",
        "w:headers",
        "w:cellIns",
        "w:cellDel",
        "w:cellMerge",
    ];
    properties = upsert_ordered_xml_child(
        &properties,
        "w:tcPr",
        "w:tcW",
        &format!("<w:tcW w:w=\"{width}\" w:type=\"dxa\"/>"),
        TCPR_ORDER,
    )?;
    let margins_span = direct_child_spans(&properties)?
        .into_iter()
        .find(|child| child.name == "w:tcMar");
    if margins_span.is_none() {
        properties =
            upsert_ordered_xml_child(&properties, "w:tcPr", "w:tcMar", "<w:tcMar/>", TCPR_ORDER)?;
    }
    let margins_span = direct_child_spans(&properties)?
        .into_iter()
        .find(|child| child.name == "w:tcMar")
        .unwrap();
    let mut cell_margins = properties[margins_span.start..margins_span.end].to_owned();
    const TCMAR_ORDER: &[&str] = &[
        "w:top",
        "w:start",
        "w:bottom",
        "w:end",
        "w:insideH",
        "w:insideV",
    ];
    for side in ["top", "start", "bottom", "end"] {
        let value = margins.get(side).copied().unwrap_or(0);
        let tag = format!("w:{side}");
        let fragment = format!("<{tag} w:w=\"{value}\" w:type=\"dxa\"/>");
        cell_margins =
            upsert_ordered_xml_child(&cell_margins, "w:tcMar", &tag, &fragment, TCMAR_ORDER)?;
    }
    let margins_span = direct_child_spans(&properties)?
        .into_iter()
        .find(|child| child.name == "w:tcMar")
        .unwrap();
    properties.replace_range(margins_span.start..margins_span.end, &cell_margins);
    let properties_span = direct_child_spans(&updated)?
        .into_iter()
        .find(|child| child.name == "w:tcPr")
        .unwrap();
    updated.replace_range(properties_span.start..properties_span.end, &properties);
    Ok(updated)
}

fn insert_after_opening_tag(
    xml: &str,
    child_tag: &str,
    child: &str,
) -> Result<String, ArtifactError> {
    let open_end = find_xml_tag_end(xml, 0).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", "element opening tag is malformed")
    })?;
    if xml[..=open_end].trim_end().ends_with("/>") {
        let parent = xml[..open_end]
            .trim_end()
            .strip_suffix("/")
            .unwrap_or(&xml[..open_end]);
        let parent_tag = parent
            .rsplit('<')
            .next()
            .and_then(|name| name.split_whitespace().next())
            .unwrap_or_default();
        let parent_tag = parent_tag.trim_end_matches('>');
        return Ok(format!(
            "{parent}>{child}</{parent_tag}>{}",
            &xml[open_end + 1..]
        ));
    }
    let _ = child_tag;
    let mut updated = xml.to_owned();
    updated.insert_str(open_end + 1, child);
    Ok(updated)
}

fn upsert_ordered_xml_child(
    parent: &str,
    parent_tag: &str,
    child_tag: &str,
    child_fragment: &str,
    order: &[&str],
) -> Result<String, ArtifactError> {
    let opening_end = find_xml_tag_end(parent, 0).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", "parent opening tag is malformed")
    })?;
    if parent[..=opening_end].trim_end().ends_with("/>") {
        let opening = parent[..opening_end]
            .trim_end()
            .strip_suffix('/')
            .unwrap_or(&parent[..opening_end]);
        let expanded = format!("{opening}></{parent_tag}>{}", &parent[opening_end + 1..]);
        return upsert_ordered_xml_child(&expanded, parent_tag, child_tag, child_fragment, order);
    }
    let children = direct_child_spans(parent)?;
    if let Some(existing) = children.iter().find(|child| child.name == child_tag) {
        let mut updated = parent.to_owned();
        updated.replace_range(existing.start..existing.end, child_fragment);
        return Ok(updated);
    }
    let target_rank = order
        .iter()
        .position(|tag| *tag == child_tag)
        .unwrap_or(order.len());
    if let Some(next) = children.iter().find(|child| {
        order
            .iter()
            .position(|tag| *tag == child.name)
            .is_some_and(|rank| rank > target_rank)
    }) {
        let mut updated = parent.to_owned();
        updated.insert_str(next.start, child_fragment);
        return Ok(updated);
    }
    let closing = format!("</{parent_tag}>");
    let close_at = parent.rfind(&closing).ok_or_else(|| {
        ArtifactError::new(
            "invalid_ooxml_xml",
            format!("{parent_tag} closing tag is missing"),
        )
    })?;
    let mut updated = parent.to_owned();
    updated.insert_str(close_at, child_fragment);
    Ok(updated)
}

#[derive(Clone)]
struct DocxFieldRecord {
    start: usize,
    instruction: String,
    result_spans: Vec<BodyChildSpan>,
    simple_span: Option<BodyChildSpan>,
}

#[derive(Default)]
struct FieldCounts {
    updated_ref: usize,
    updated_seq: usize,
    unchanged_page_fields: usize,
    unchanged_other_fields: usize,
    simple_fields_flattened: usize,
    complex_field_markers_removed: usize,
    instructions_removed: usize,
}

impl FieldCounts {
    fn json(&self, operation: &str) -> Value {
        if operation == "update" {
            json!({
                "updatedRef": self.updated_ref,
                "updatedSeq": self.updated_seq,
                "unchangedPageFields": self.unchanged_page_fields,
                "unchangedOtherFields": self.unchanged_other_fields,
            })
        } else {
            json!({
                "simpleFieldsFlattened": self.simple_fields_flattened,
                "complexFieldMarkersRemoved": self.complex_field_markers_removed,
                "instructionsRemoved": self.instructions_removed,
            })
        }
    }

    fn any(&self) -> bool {
        self.updated_ref > 0
            || self.updated_seq > 0
            || self.unchanged_page_fields > 0
            || self.unchanged_other_fields > 0
            || self.simple_fields_flattened > 0
            || self.complex_field_markers_removed > 0
            || self.instructions_removed > 0
    }
}

fn fields_process_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "output" | "operation" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let input = cli::required_flag(&flags, "input")?;
    let operation = cli::required_flag(&flags, "operation")?;
    if !matches!(operation, "inspect" | "update" | "flatten") {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--operation must be inspect, update, or flatten",
        ));
    }
    let output = flags
        .iter()
        .find(|(flag, _)| flag == "output")
        .and_then(|(_, value)| value.as_deref());
    if operation != "inspect" && output.is_none() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--output is required for update and flatten",
        ));
    }
    if operation == "inspect" {
        return inspect_docx_fields(&input);
    }
    process_docx_fields(&input, output.unwrap(), operation)
}

fn docx_story_part_names(names: &[String]) -> Vec<String> {
    let mut parts = Vec::new();
    if names.iter().any(|name| name == "word/document.xml") {
        parts.push("word/document.xml".to_owned());
    }
    let mut headers = names
        .iter()
        .filter(|name| name.starts_with("word/header") && is_docx_story_part(name))
        .cloned()
        .collect::<Vec<_>>();
    let mut footers = names
        .iter()
        .filter(|name| name.starts_with("word/footer") && is_docx_story_part(name))
        .cloned()
        .collect::<Vec<_>>();
    headers.sort();
    footers.sort();
    parts.extend(headers);
    parts.extend(footers);
    parts
}

fn inspect_docx_fields(input: &str) -> Result<Value, ArtifactError> {
    let source = Path::new(input)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let names = archive.file_names().map(str::to_owned).collect::<Vec<_>>();
    let parts = docx_story_part_names(&names);
    let mut fields = Vec::new();
    for part in parts {
        let xml = read_optional_docx_part(&mut archive, &part)?.ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_package", format!("missing {part}"))
        })?;
        for span in xml_element_spans(&xml, "w:fldSimple")? {
            let field = &xml[span.start..span.end];
            let instruction = xml_element_attribute(field, "w:fldSimple", "w:instr")?
                .unwrap_or_default()
                .trim()
                .to_owned();
            let result = xml_element_spans(field, "w:t")?
                .iter()
                .map(|text| ooxml::text_values(&field[text.start..text.end], "w:t").join(""))
                .collect::<String>();
            fields.push((
                span.start,
                json!({
                    "part": part,
                    "kind": "simple",
                    "instruction": instruction,
                    "result": result,
                }),
            ));
        }
        for span in xml_element_spans(&xml, "w:instrText")? {
            let instruction =
                ooxml::text_values(&xml[span.start..span.end], "w:instrText").join("");
            fields.push((
                span.start,
                json!({
                    "part": part,
                    "kind": "complex",
                    "instruction": instruction,
                    "result": Value::Null,
                }),
            ));
        }
    }
    let all_fields = fields
        .into_iter()
        .map(|(_, field)| field)
        .collect::<Vec<_>>();
    Ok(json!({
        "ok": true,
        "operation": "inspect",
        "input": source,
        "fields": all_fields,
    }))
}

fn xml_element_attribute(
    xml: &str,
    tag: &str,
    attribute: &str,
) -> Result<Option<String>, ArtifactError> {
    let start = xml.find(&format!("<{tag}")).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", format!("missing {tag} opening tag"))
    })?;
    let end = find_xml_tag_end(xml, start)
        .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", format!("unterminated {tag}")))?;
    let parsed = crate::ooxml::parse_attributes(&xml[start + 1..end]);
    Ok(parsed.get(attribute).cloned())
}

fn process_docx_fields(input: &str, output: &str, operation: &str) -> Result<Value, ArtifactError> {
    let mut aggregate = FieldCounts::default();
    let mut per_part = Vec::new();
    let mut modified_parts = Vec::new();
    let mut any_fields = false;
    let output_path = rewrite_docx_package(input, output, |name, bytes| {
        if !is_docx_story_part(name) {
            return Ok(());
        }
        let xml = String::from_utf8(bytes.clone())
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        let (updated, counts) = if operation == "update" {
            update_fields_in_story(&xml)?
        } else {
            flatten_fields_in_story(&xml)?
        };
        any_fields |= counts.any();
        aggregate.add(&counts);
        let mut count_json = counts.json(operation);
        count_json["part"] = json!(name);
        per_part.push(count_json);
        let changed = if operation == "update" {
            counts.updated_ref > 0 || counts.updated_seq > 0
        } else {
            counts.simple_fields_flattened > 0
                || counts.complex_field_markers_removed > 0
                || counts.instructions_removed > 0
        };
        if changed {
            *bytes = updated.into_bytes();
            modified_parts.push(name.to_owned());
        }
        Ok(())
    })?;
    if !any_fields {
        let _ = fs::remove_file(&output_path);
        return Err(ArtifactError::new(
            "invalid_arguments",
            "no supported fields were found",
        ));
    }
    let limitations = if operation == "update" && aggregate.unchanged_page_fields > 0 {
        vec!["PAGEREF page values require a pagination-aware Word-compatible renderer"]
    } else {
        Vec::new()
    };
    Ok(json!({
        "ok": true,
        "operation": operation,
        "input": Path::new(input).canonicalize().unwrap_or_else(|_| PathBuf::from(input)),
        "output": output_path,
        "counts": aggregate.json(operation),
        "partCounts": per_part,
        "modifiedParts": modified_parts,
        "limitations": limitations,
    }))
}

impl FieldCounts {
    fn add(&mut self, other: &FieldCounts) {
        self.updated_ref += other.updated_ref;
        self.updated_seq += other.updated_seq;
        self.unchanged_page_fields += other.unchanged_page_fields;
        self.unchanged_other_fields += other.unchanged_other_fields;
        self.simple_fields_flattened += other.simple_fields_flattened;
        self.complex_field_markers_removed += other.complex_field_markers_removed;
        self.instructions_removed += other.instructions_removed;
    }
}

fn flatten_fields_in_story(xml: &str) -> Result<(String, FieldCounts), ArtifactError> {
    let mut updated = xml.to_owned();
    let mut counts = FieldCounts::default();
    let simple_count = xml_element_spans(&updated, "w:fldSimple")?.len();
    for _ in 0..simple_count {
        let (unwrapped, changed) = unwrap_first_xml_element(&updated, "w:fldSimple", false)?;
        if !changed {
            break;
        }
        updated = unwrapped;
        counts.simple_fields_flattened += 1;
    }
    for (tag, instructions) in [("w:fldChar", false), ("w:instrText", true)] {
        let count = xml_element_spans(&updated, tag)?.len();
        let (cleaned, _) = remove_xml_element(&updated, tag)?;
        updated = cleaned;
        if instructions {
            counts.instructions_removed += count;
        } else {
            counts.complex_field_markers_removed += count;
        }
    }
    Ok((updated, counts))
}

fn update_fields_in_story(xml: &str) -> Result<(String, FieldCounts), ArtifactError> {
    let mut counts = FieldCounts::default();
    let (after_seq, seq_counts) = update_field_pass(xml, "SEQ", &BTreeMap::new())?;
    counts.add(&seq_counts);
    let bookmarks = docx_bookmark_text(&after_seq)?;
    let (after_ref, ref_counts) = update_field_pass(&after_seq, "REF", &bookmarks)?;
    counts.add(&ref_counts);
    Ok((after_ref, counts))
}

fn update_field_pass(
    xml: &str,
    pass_kind: &str,
    bookmarks: &BTreeMap<String, String>,
) -> Result<(String, FieldCounts), ArtifactError> {
    let records = docx_field_records(xml)?;
    let mut counts = FieldCounts::default();
    let mut sequence_numbers = BTreeMap::<String, usize>::new();
    let mut edits = Vec::<(Vec<BodyChildSpan>, Option<BodyChildSpan>, String)>::new();
    let instruction_re =
        regex::Regex::new(r"(?i)^(REF|PAGEREF|SEQ)\s+([A-Za-z][A-Za-z0-9_]{0,39})\b")
            .expect("static field instruction pattern compiles");
    for record in records {
        let instruction = record
            .instruction
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        let Some(captures) = instruction_re.captures(&instruction) else {
            if pass_kind == "REF" {
                counts.unchanged_other_fields += 1;
            }
            continue;
        };
        let kind = captures.get(1).unwrap().as_str().to_ascii_uppercase();
        let target = captures.get(2).unwrap().as_str();
        if kind == "SEQ" {
            if pass_kind != "SEQ" {
                continue;
            }
            let next = sequence_numbers.entry(target.to_owned()).or_default();
            *next += 1;
            if record.simple_span.is_some() || !record.result_spans.is_empty() {
                edits.push((record.result_spans, record.simple_span, next.to_string()));
                counts.updated_seq += 1;
            } else {
                counts.unchanged_other_fields += 1;
            }
        } else if kind == "REF" {
            if pass_kind != "REF" {
                continue;
            }
            if let Some(value) = bookmarks.get(target) {
                edits.push((record.result_spans, record.simple_span, value.clone()));
                counts.updated_ref += 1;
            } else {
                counts.unchanged_other_fields += 1;
            }
        } else if pass_kind == "REF" {
            counts.unchanged_page_fields += 1;
        }
    }
    edits.sort_by_key(|edit| {
        edit.0
            .first()
            .map(|span| span.start)
            .or_else(|| edit.1.as_ref().map(|span| span.start))
            .unwrap_or(0)
    });
    let mut updated = xml.to_owned();
    for (results, simple_span, value) in edits.into_iter().rev() {
        if results.is_empty() {
            if let Some(simple_span) = simple_span {
                let field = &updated[simple_span.start..simple_span.end];
                let insert_at = field.rfind("</w:fldSimple>").ok_or_else(|| {
                    ArtifactError::new("invalid_ooxml_xml", "w:fldSimple closing tag is missing")
                })? + simple_span.start;
                updated.insert_str(
                    insert_at,
                    &format!("<w:r><w:t>{}</w:t></w:r>", escape_xml_text(&value)),
                );
            }
            continue;
        }
        for (index, span) in results.iter().enumerate().rev() {
            let replacement_value = if index == 0 { value.as_str() } else { "" };
            let block = &updated[span.start..span.end];
            let replacement = set_xml_text_element(block, "w:t", replacement_value)?;
            updated.replace_range(span.start..span.end, &replacement);
        }
    }
    Ok((updated, counts))
}

fn docx_field_records(xml: &str) -> Result<Vec<DocxFieldRecord>, ArtifactError> {
    let mut records = Vec::new();
    for span in xml_element_spans(xml, "w:fldSimple")? {
        let field = &xml[span.start..span.end];
        records.push(DocxFieldRecord {
            start: span.start,
            instruction: xml_element_attribute(field, "w:fldSimple", "w:instr")?
                .unwrap_or_default(),
            result_spans: xml_element_spans(field, "w:t")?
                .into_iter()
                .map(|mut result| {
                    result.start += span.start;
                    result.end += span.start;
                    result
                })
                .collect(),
            simple_span: Some(span),
        });
    }
    #[derive(Default)]
    struct ComplexFieldState {
        start: usize,
        instruction: String,
        results: Vec<BodyChildSpan>,
        in_result: bool,
    }
    enum FieldEvent {
        Marker(usize, String),
        Instruction(usize, String),
        Text(usize, BodyChildSpan),
    }
    let mut events = Vec::<FieldEvent>::new();
    for span in xml_element_spans(xml, "w:fldChar")? {
        let tag = &xml[span.start..span.end];
        if let Some(marker) = xml_element_attribute(tag, "w:fldChar", "w:fldCharType")? {
            events.push(FieldEvent::Marker(span.start, marker));
        }
    }
    for span in xml_element_spans(xml, "w:instrText")? {
        events.push(FieldEvent::Instruction(
            span.start,
            ooxml::text_values(&xml[span.start..span.end], "w:instrText").join(""),
        ));
    }
    for span in xml_element_spans(xml, "w:t")? {
        events.push(FieldEvent::Text(span.start, span));
    }
    events.sort_by_key(|event| match event {
        FieldEvent::Marker(start, _)
        | FieldEvent::Instruction(start, _)
        | FieldEvent::Text(start, _) => *start,
    });
    let mut stack = Vec::<ComplexFieldState>::new();
    for event in events {
        match event {
            FieldEvent::Marker(start, marker) if marker == "begin" => {
                stack.push(ComplexFieldState {
                    start,
                    ..Default::default()
                })
            }
            FieldEvent::Marker(_, marker) if marker == "separate" => {
                if let Some(field) = stack.last_mut() {
                    field.in_result = true;
                }
            }
            FieldEvent::Marker(_, marker) if marker == "end" => {
                if let Some(field) = stack.pop() {
                    records.push(DocxFieldRecord {
                        start: field.start,
                        instruction: field.instruction,
                        result_spans: field.results,
                        simple_span: None,
                    });
                }
            }
            FieldEvent::Instruction(_, instruction) => {
                if let Some(field) = stack.last_mut().filter(|field| !field.in_result) {
                    field.instruction.push_str(&instruction);
                }
            }
            FieldEvent::Text(_, span) => {
                for field in stack.iter_mut().filter(|field| field.in_result) {
                    field.results.push(span.clone());
                }
            }
            _ => {}
        }
    }
    records.sort_by_key(|record| record.start);
    Ok(records)
}

fn docx_bookmark_text(xml: &str) -> Result<BTreeMap<String, String>, ArtifactError> {
    let mut active = Vec::<(String, String, String)>::new();
    let mut values = BTreeMap::<String, String>::new();
    for event in docx_bookmark_events(xml)? {
        match event {
            BookmarkEventOwned::Start(id, name) => active.push((id, name, String::new())),
            BookmarkEventOwned::End(id) => {
                if let Some(index) = active
                    .iter()
                    .rposition(|(active_id, _, _)| active_id == &id)
                {
                    let (_, name, text) = active.remove(index);
                    if !name.is_empty() {
                        values.insert(name, text);
                    }
                }
            }
            BookmarkEventOwned::Text(text) => {
                for (_, _, value) in &mut active {
                    value.push_str(&text);
                }
            }
        }
    }
    Ok(values)
}

enum BookmarkEventOwned {
    Start(String, String),
    End(String),
    Text(String),
}

fn docx_bookmark_events(xml: &str) -> Result<Vec<BookmarkEventOwned>, ArtifactError> {
    let mut events = Vec::<(usize, BookmarkEventOwned)>::new();
    for span in xml_element_spans(xml, "w:bookmarkStart")? {
        let block = &xml[span.start..span.end];
        events.push((
            span.start,
            BookmarkEventOwned::Start(
                xml_element_attribute(block, "w:bookmarkStart", "w:id")?.unwrap_or_default(),
                xml_element_attribute(block, "w:bookmarkStart", "w:name")?.unwrap_or_default(),
            ),
        ));
    }
    for span in xml_element_spans(xml, "w:bookmarkEnd")? {
        let block = &xml[span.start..span.end];
        events.push((
            span.start,
            BookmarkEventOwned::End(
                xml_element_attribute(block, "w:bookmarkEnd", "w:id")?.unwrap_or_default(),
            ),
        ));
    }
    for span in xml_element_spans(xml, "w:t")? {
        events.push((
            span.start,
            BookmarkEventOwned::Text(
                ooxml::text_values(&xml[span.start..span.end], "w:t").join(""),
            ),
        ));
    }
    events.sort_by_key(|(start, _)| *start);
    Ok(events.into_iter().map(|(_, event)| event).collect())
}

fn reference_fields_insert_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(
            flag.as_str(),
            "input" | "output" | "pattern" | "prefix" | "--json"
        ) {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let input = cli::required_flag(&flags, "input")?;
    let output = cli::required_flag(&flags, "output")?;
    let pattern = flags
        .iter()
        .find(|(flag, _)| flag == "pattern")
        .and_then(|(_, value)| value.as_deref())
        .unwrap_or(r"\[\[REF:(?P<bookmark>[^]s]+)\]]");
    let prefix = flags
        .iter()
        .find(|(flag, _)| flag == "prefix")
        .and_then(|(_, value)| value.as_deref())
        .unwrap_or("");
    insert_docx_reference_fields(&input, &output, pattern, prefix)
}

fn insert_docx_reference_fields(
    input: &str,
    output: &str,
    pattern: &str,
    prefix: &str,
) -> Result<Value, ArtifactError> {
    let marker_regex = regex::Regex::new(pattern).map_err(|error| {
        ArtifactError::new(
            "invalid_arguments",
            format!("invalid marker pattern: {error}"),
        )
    })?;
    if !marker_regex
        .capture_names()
        .flatten()
        .any(|name| name == "bookmark")
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "marker pattern must define a named 'bookmark' group",
        ));
    }
    let mut markers_replaced = 0usize;
    let mut modified_parts = Vec::new();
    let mut skipped_markers = Vec::new();
    let output_path = rewrite_docx_package(input, output, |name, bytes| {
        if !is_docx_field_story_part(name) {
            return Ok(());
        }
        let xml = String::from_utf8(bytes.clone())
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        let (updated, count, skipped) = replace_reference_markers(&xml, &marker_regex, prefix)?;
        if count > 0 {
            *bytes = updated.into_bytes();
            markers_replaced += count;
            modified_parts.push(name.to_owned());
        }
        skipped_markers.extend(skipped);
        Ok(())
    })?;
    Ok(json!({
        "ok": true,
        "input": Path::new(input).canonicalize().unwrap_or_else(|_| PathBuf::from(input)),
        "output": output_path,
        "markersReplaced": markers_replaced,
        "modifiedParts": modified_parts,
        "skippedMarkers": skipped_markers,
        "limitations": [
            "the complete marker must be inside one w:t text node",
            "fields are inserted in the main document, headers, and footers",
            "cached field result starts at 0; pagination-aware REF result updates may require Word-compatible rendering"
        ]
    }))
}

fn is_docx_field_story_part(name: &str) -> bool {
    if name == "word/document.xml" {
        return true;
    }
    let Some(file_name) = name.strip_prefix("word/") else {
        return false;
    };
    (file_name.starts_with("header") || file_name.starts_with("footer"))
        && file_name.ends_with(".xml")
        && !file_name.contains('/')
}

fn replace_reference_markers(
    xml: &str,
    marker_regex: &regex::Regex,
    prefix: &str,
) -> Result<(String, usize, Vec<String>), ArtifactError> {
    let mut replacements = Vec::<(BodyChildSpan, String)>::new();
    let mut replaced = 0usize;
    let mut invalid = Vec::new();
    let mut skipped = Vec::new();
    for run_span in xml_element_spans(xml, "w:r")? {
        let run = &xml[run_span.start..run_span.end];
        let children = direct_child_spans(run)?;
        let text_children = children
            .iter()
            .filter(|child| child.name == "w:t")
            .collect::<Vec<_>>();
        if text_children.len() != 1 {
            continue;
        }
        let text_span = text_children[0];
        let text_block = &run[text_span.start..text_span.end];
        let value = ooxml::text_values(text_block, "w:t").join("");
        let matches = marker_regex.captures_iter(&value).collect::<Vec<_>>();
        if matches.is_empty() {
            continue;
        }
        let simple_run = children
            .iter()
            .all(|child| child.name == "w:t" || child.name == "w:rPr");
        let run_parent_supported = run_span.name == "w:r";
        if !simple_run || !run_parent_supported {
            skipped.extend(
                matches
                    .iter()
                    .map(|matched| matched.get(0).unwrap().as_str().to_owned()),
            );
            continue;
        }
        let properties = children
            .iter()
            .find(|child| child.name == "w:rPr")
            .map(|child| run[child.start..child.end].to_owned())
            .unwrap_or_default();
        let mut fragment = String::new();
        let mut cursor = 0usize;
        for matched in &matches {
            let whole = matched.get(0).unwrap();
            let bookmark = matched
                .name("bookmark")
                .map(|value| value.as_str())
                .unwrap_or_default();
            if !valid_bookmark_name(bookmark) {
                invalid.push(bookmark.to_owned());
                continue;
            }
            let before = &value[cursor..whole.start()];
            if !before.is_empty() {
                fragment.push_str(&tracked_text_run(&properties, "t", before));
            }
            if !prefix.is_empty() {
                fragment.push_str(&tracked_text_run(&properties, "t", prefix));
            }
            fragment.push_str(&field_marker_run(
                &properties,
                "<w:fldChar w:fldCharType=\"begin\"/>",
            ));
            fragment.push_str(&field_marker_run(
                &properties,
                &format!(
                    "<w:instrText xml:space=\"preserve\"> REF {} \\h </w:instrText>",
                    escape_xml_text(bookmark)
                ),
            ));
            fragment.push_str(&field_marker_run(
                &properties,
                "<w:fldChar w:fldCharType=\"separate\"/>",
            ));
            fragment.push_str(&tracked_text_run(&properties, "t", "0"));
            fragment.push_str(&field_marker_run(
                &properties,
                "<w:fldChar w:fldCharType=\"end\"/>",
            ));
            cursor = whole.end();
            replaced += 1;
        }
        if invalid.is_empty() {
            let after = &value[cursor..];
            if !after.is_empty() {
                fragment.push_str(&tracked_text_run(&properties, "t", after));
            }
            replacements.push((run_span, fragment));
        }
    }
    if !invalid.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("invalid bookmark name(s): {}", invalid.join(", ")),
        ));
    }
    let mut updated = xml.to_owned();
    for (span, replacement) in replacements.into_iter().rev() {
        updated.replace_range(span.start..span.end, &replacement);
    }
    Ok((updated, replaced, skipped))
}

fn valid_bookmark_name(name: &str) -> bool {
    let mut chars = name.chars();
    chars
        .next()
        .is_some_and(|first| first.is_ascii_alphabetic())
        && name.len() <= 40
        && name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
}

fn field_marker_run(properties: &str, child: &str) -> String {
    format!("<w:r>{properties}{child}</w:r>")
}

fn captions_insert_command(args: &[String]) -> Result<Value, ArtifactError> {
    let mut input = None;
    let mut output = None;
    let mut caption_text = String::new();
    let mut tables = false;
    let mut figures = false;
    let mut bookmarks = false;
    let mut index = 0usize;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => index += 1,
            "--tables" => {
                tables = true;
                index += 1;
            }
            "--figures" => {
                figures = true;
                index += 1;
            }
            "--bookmarks" => {
                bookmarks = true;
                index += 1;
            }
            "--input" | "--output" | "--caption-text" => {
                let flag = args[index].as_str();
                let value = args.get(index + 1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
                })?;
                match flag {
                    "--input" => input = Some(value.clone()),
                    "--output" => output = Some(value.clone()),
                    _ => caption_text = value.clone(),
                }
                index += 2;
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
    }
    let input =
        input.ok_or_else(|| ArtifactError::new("invalid_arguments", "--input is required"))?;
    let output =
        output.ok_or_else(|| ArtifactError::new("invalid_arguments", "--output is required"))?;
    if !(tables || figures) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "select at least one of --tables or --figures",
        ));
    }
    insert_docx_captions(&input, &output, tables, figures, &caption_text, bookmarks)
}

fn insert_docx_captions(
    input: &str,
    output: &str,
    include_tables: bool,
    include_figures: bool,
    caption_text: &str,
    add_bookmarks: bool,
) -> Result<Value, ArtifactError> {
    let mut counts = BTreeMap::from([
        ("tables".to_owned(), 0usize),
        ("figures".to_owned(), 0usize),
        ("bookmarks".to_owned(), 0usize),
    ]);
    let output_path = rewrite_docx_package(input, output, |name, bytes| {
        if name != "word/document.xml" {
            return Ok(());
        }
        let xml = String::from_utf8(bytes.clone())
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        let body_span = xml_element_spans(&xml, "w:body")?
            .into_iter()
            .next()
            .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "DOCX document has no body"))?;
        let body_xml = &xml[body_span.start..body_span.end];
        let children = direct_child_spans(body_xml)?;
        let mut names = BTreeSet::<String>::new();
        let mut max_bookmark_id = 0usize;
        for tag in ["w:bookmarkStart", "w:bookmarkEnd"] {
            for span in xml_element_spans(&xml, tag)? {
                let element = &xml[span.start..span.end];
                if tag == "w:bookmarkStart" {
                    if let Some(name) = xml_element_attribute(element, tag, "w:name")? {
                        names.insert(name);
                    }
                }
                if let Some(id) = xml_element_attribute(element, tag, "w:id")?
                    .and_then(|value| value.parse::<usize>().ok())
                {
                    max_bookmark_id = max_bookmark_id.max(id);
                }
            }
        }
        let mut next_id = max_bookmark_id.saturating_add(1);
        let mut next_number =
            BTreeMap::from([("Table".to_owned(), 1usize), ("Figure".to_owned(), 1usize)]);
        for (label, prefix) in [("Table", "tbl"), ("Figure", "fig")] {
            while names.contains(&format!("{prefix}{}", next_number[label])) {
                *next_number.get_mut(label).unwrap() += 1;
            }
        }
        let mut insertions = Vec::<(BodyChildSpan, String)>::new();
        for (child_index, child) in children.iter().enumerate() {
            let child_xml = &body_xml[child.start..child.end];
            let label = if include_tables && child.name == "w:tbl" {
                Some("Table")
            } else if include_figures
                && child.name == "w:p"
                && (!xml_element_spans(child_xml, "w:drawing")?.is_empty()
                    || !xml_element_spans(child_xml, "w:pict")?.is_empty())
            {
                Some("Figure")
            } else {
                None
            };
            let Some(label) = label else {
                continue;
            };
            if children.get(child_index + 1).is_some_and(|next| {
                next.name == "w:p"
                    && docx_caption_starts_with(&body_xml[next.start..next.end], label)
            }) {
                continue;
            }
            let mut number_bookmark = None;
            if add_bookmarks {
                let prefix = if label == "Table" { "tbl" } else { "fig" };
                let number = next_number[label];
                let bookmark = format!("{prefix}{number}");
                *next_number.get_mut(label).unwrap() += 1;
                names.insert(bookmark.clone());
                number_bookmark = Some((bookmark, next_id));
                next_id = next_id.saturating_add(1);
                *counts.get_mut("bookmarks").unwrap() += 1;
            }
            insertions.push((
                child.clone(),
                docx_caption_xml(label, caption_text, number_bookmark.as_ref()),
            ));
            *counts
                .get_mut(if label == "Table" {
                    "tables"
                } else {
                    "figures"
                })
                .unwrap() += 1;
        }
        if insertions.is_empty() {
            return Ok(());
        }
        let mut updated_body = body_xml.to_owned();
        for (span, caption) in insertions.into_iter().rev() {
            updated_body.insert_str(span.end, &caption);
        }
        let mut updated_xml = xml;
        updated_xml.replace_range(body_span.start..body_span.end, &updated_body);
        *bytes = updated_xml.into_bytes();
        Ok(())
    })?;
    Ok(json!({
        "ok": true,
        "input": Path::new(input).canonicalize().unwrap_or_else(|_| PathBuf::from(input)),
        "output": output_path,
        "counts": counts,
        "limitations": [
            "only top-level body tables and paragraphs with DrawingML/VML images are targeted",
            "no REF fields are inserted; bookmarks can be referenced by a separate field workflow",
            "SEQ fields are initially cached as 0; run fields-process --operation update to materialize numbering"
        ]
    }))
}

fn docx_caption_starts_with(paragraph: &str, label: &str) -> bool {
    let Some(properties) = direct_child_spans(paragraph)
        .ok()
        .and_then(|children| children.into_iter().find(|child| child.name == "w:pPr"))
    else {
        return false;
    };
    let properties_xml = &paragraph[properties.start..properties.end];
    let caption_style = direct_child_spans(properties_xml)
        .ok()
        .and_then(|children| children.into_iter().find(|child| child.name == "w:pStyle"))
        .and_then(|style| {
            xml_element_attribute(&properties_xml[style.start..style.end], "w:pStyle", "w:val")
                .ok()
                .flatten()
        });
    if caption_style.as_deref() != Some("Caption") {
        return false;
    }
    let text = ooxml::text_values(paragraph, "w:t").join("");
    text.trim().starts_with(&format!("{label} "))
}

fn docx_caption_xml(label: &str, text: &str, bookmark: Option<&(String, usize)>) -> String {
    let mut sequence = String::from(
        "<w:r><w:fldChar w:fldCharType=\"begin\"/></w:r><w:r><w:instrText xml:space=\"preserve\"> SEQ ",
    );
    sequence.push_str(label);
    sequence.push_str(
        " \\* ARABIC </w:instrText></w:r><w:r><w:fldChar w:fldCharType=\"separate\"/></w:r>",
    );
    if let Some((name, id)) = bookmark {
        sequence.push_str(&format!(
            "<w:bookmarkStart w:id=\"{id}\" w:name=\"{}\"/>",
            escape_xml_attribute(name)
        ));
    }
    sequence.push_str("<w:r><w:t>0</w:t></w:r>");
    if let Some((_, id)) = bookmark {
        sequence.push_str(&format!("<w:bookmarkEnd w:id=\"{id}\"/>"));
    }
    sequence.push_str("<w:r><w:fldChar w:fldCharType=\"end\"/></w:r>");
    let text_run = if text.is_empty() {
        String::new()
    } else {
        format!(
            "<w:r><w:t xml:space=\"preserve\">: {}</w:t></w:r>",
            escape_xml_text(text)
        )
    };
    format!(
        "<w:p><w:pPr><w:pStyle w:val=\"Caption\"/></w:pPr><w:r><w:t xml:space=\"preserve\">{} </w:t></w:r>{sequence}{text_run}</w:p>",
        escape_xml_text(label)
    )
}

fn toc_insert_command(args: &[String]) -> Result<Value, ArtifactError> {
    let mut input = None;
    let mut output = None;
    let mut placeholder = "[[TOC]]".to_owned();
    let mut levels = "1-3".to_owned();
    let mut index = 0usize;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => index += 1,
            "--input" | "--output" | "--placeholder" | "--levels" => {
                let flag = args[index].as_str();
                let value = args.get(index + 1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
                })?;
                match flag {
                    "--input" => input = Some(value.clone()),
                    "--output" => output = Some(value.clone()),
                    "--placeholder" => placeholder = value.clone(),
                    _ => levels = value.clone(),
                }
                index += 2;
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
    }
    let input =
        input.ok_or_else(|| ArtifactError::new("invalid_arguments", "--input is required"))?;
    let output =
        output.ok_or_else(|| ArtifactError::new("invalid_arguments", "--output is required"))?;
    if placeholder.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "placeholder must not be empty",
        ));
    }
    let levels = validate_toc_levels(&levels)?;
    insert_docx_toc(&input, &output, &placeholder, &levels)
}

fn validate_toc_levels(levels: &str) -> Result<String, ArtifactError> {
    let pattern = regex::Regex::new(r"^\s*([1-9])\s*-\s*([1-9])\s*$").unwrap();
    let Some(captures) = pattern.captures(levels) else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "levels must use the form N-M, for example 1-3",
        ));
    };
    let first = captures[1].parse::<u8>().unwrap();
    let last = captures[2].parse::<u8>().unwrap();
    if first > last {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "levels range start must not exceed its end",
        ));
    }
    Ok(format!("{first}-{last}"))
}

fn insert_docx_toc(
    input: &str,
    output: &str,
    placeholder: &str,
    levels: &str,
) -> Result<Value, ArtifactError> {
    const SETTINGS_REL_TYPE: &str =
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings";
    const SETTINGS_CONTENT_TYPE: &str =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml";
    let settings_default = b"<w:settings xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:updateFields w:val=\"true\"/></w:settings>".to_vec();
    let rels_default = format!("<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"{SETTINGS_REL_TYPE}\" Target=\"settings.xml\"/></Relationships>").into_bytes();
    let output_path = rewrite_docx_package_with_additional_parts(
        input,
        output,
        vec![
            ("word/settings.xml".to_owned(), settings_default),
            ("word/_rels/document.xml.rels".to_owned(), rels_default),
        ],
        |name, bytes| {
            match name {
                "word/document.xml" => {
                    let xml = String::from_utf8(bytes.clone()).map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    let body_children = direct_body_children(&xml)?;
                    let matches = body_children
                        .iter()
                        .filter(|child| {
                            child.name == "w:p"
                                && docx_paragraph_text(&xml[child.start..child.end])
                                    .ok()
                                    .as_deref()
                                    == Some(placeholder)
                        })
                        .collect::<Vec<_>>();
                    if matches.len() != 1 {
                        return Err(ArtifactError::new(
                            "invalid_arguments",
                            format!(
                                "expected exactly one paragraph containing {placeholder:?}; found {}",
                                matches.len()
                            ),
                        ));
                    }
                    let paragraph = matches[0];
                    let old = &xml[paragraph.start..paragraph.end];
                    let updated = replace_toc_placeholder_paragraph(old, levels)?;
                    let mut new_xml = xml;
                    new_xml.replace_range(paragraph.start..paragraph.end, &updated);
                    *bytes = new_xml.into_bytes();
                }
                "word/settings.xml" => {
                    let xml = String::from_utf8(bytes.clone()).map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    let updated = enable_docx_update_fields(&xml)?;
                    *bytes = updated.into_bytes();
                }
                "word/_rels/document.xml.rels" => {
                    let xml = String::from_utf8(bytes.clone()).map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    let rels = ooxml::elements(&xml, "Relationship")
                        .into_iter()
                        .filter(|attrs| {
                            attrs
                                .get("Type")
                                .is_some_and(|value| value == SETTINGS_REL_TYPE)
                        })
                        .collect::<Vec<_>>();
                    if rels.iter().any(|attrs| {
                        attrs
                            .get("TargetMode")
                            .is_some_and(|mode| mode == "External")
                    }) {
                        return Err(ArtifactError::new(
                            "invalid_ooxml_xml",
                            "existing settings relationship is external",
                        ));
                    }
                    let (updated, _) = ensure_settings_relationship(&xml)?;
                    *bytes = updated.into_bytes();
                }
                "[Content_Types].xml" => {
                    let xml = String::from_utf8(bytes.clone()).map_err(|error| {
                        ArtifactError::new("invalid_ooxml_xml", error.to_string())
                    })?;
                    let overrides = ooxml::elements(&xml, "Override")
                        .into_iter()
                        .filter(|attrs| {
                            attrs
                                .get("PartName")
                                .is_some_and(|value| value == "/word/settings.xml")
                        })
                        .collect::<Vec<_>>();
                    if overrides.len() > 1 {
                        return Err(ArtifactError::new(
                            "invalid_ooxml_xml",
                            "[Content_Types].xml contains duplicate settings overrides",
                        ));
                    }
                    if overrides.first().is_some_and(|attrs| {
                        attrs
                            .get("ContentType")
                            .is_some_and(|value| value != SETTINGS_CONTENT_TYPE)
                    }) {
                        return Err(ArtifactError::new(
                            "invalid_ooxml_xml",
                            "settings content type override has an unexpected value",
                        ));
                    }
                    let (updated, _) = ensure_settings_content_type(&xml)?;
                    *bytes = updated.into_bytes();
                }
                _ => {}
            }
            Ok(())
        },
    )?;
    Ok(json!({
        "ok": true,
        "input": Path::new(input).canonicalize().unwrap_or_else(|_| PathBuf::from(input)),
        "output": output_path,
        "placeholder": placeholder,
        "levels": levels,
        "settingsUpdated": true,
        "limitations": [
            "Word or a Word-compatible editor must update fields to populate the TOC and calculate page numbers",
            "the cached text is a preview placeholder, not generated TOC content"
        ]
    }))
}

fn enable_docx_update_fields(xml: &str) -> Result<String, ArtifactError> {
    let settings = xml_element_spans(xml, "w:settings")?
        .into_iter()
        .next()
        .ok_or_else(|| {
            ArtifactError::new(
                "invalid_ooxml_xml",
                "word/settings.xml has an unexpected root element",
            )
        })?;
    let before_root = xml[..settings.start].trim();
    let after_root = xml[settings.end..].trim();
    if (!before_root.is_empty() && !before_root.starts_with("<?xml")) || !after_root.is_empty() {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "word/settings.xml has an unexpected root element",
        ));
    }
    let existing = xml_element_spans(xml, "w:updateFields")?;
    if existing.len() > 1 {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            "word/settings.xml contains duplicate w:updateFields elements",
        ));
    }
    if let Some(span) = existing.first() {
        let value = xml_element_attribute(&xml[span.start..span.end], "w:updateFields", "w:val")?
            .unwrap_or_default();
        if matches!(value.as_str(), "true" | "1" | "on") {
            return Ok(xml.to_owned());
        }
        set_attribute_on_first_tag(xml, "w:updateFields", "w:val", "true")
    } else {
        insert_after_opening_tag(xml, "w:updateFields", "<w:updateFields w:val=\"true\"/>")
    }
}

fn replace_toc_placeholder_paragraph(
    paragraph: &str,
    levels: &str,
) -> Result<String, ArtifactError> {
    let open_end = find_xml_tag_end(paragraph, 0).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", "paragraph opening tag is malformed")
    })?;
    let closing = paragraph.rfind("</w:p>").ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", "paragraph closing tag is missing")
    })?;
    let p_properties = direct_child_spans(paragraph)?
        .into_iter()
        .find(|child| child.name == "w:pPr")
        .map(|span| paragraph[span.start..span.end].to_owned())
        .unwrap_or_default();
    let instruction = format!(" TOC \\o \"{levels}\" \\h \\z \\u ");
    let field = format!(
        "<w:r><w:fldChar w:fldCharType=\"begin\"/></w:r><w:r><w:instrText xml:space=\"preserve\">{}</w:instrText></w:r><w:r><w:fldChar w:fldCharType=\"separate\"/></w:r><w:r><w:t>(TOC will populate after updating fields)</w:t></w:r><w:r><w:fldChar w:fldCharType=\"end\"/></w:r>",
        escape_xml_text(&instruction),
    );
    Ok(format!(
        "{}{}{}{}",
        &paragraph[..=open_end],
        p_properties,
        field,
        &paragraph[closing..]
    ))
}

fn internal_nav_command(args: &[String]) -> Result<Value, ArtifactError> {
    let mut input = None;
    let mut output = None;
    let mut toc_title = "Table of Contents".to_owned();
    let mut levels = Vec::<u8>::new();
    let mut levels_given = false;
    let mut back_to_toc = true;
    let mut top_bottom = true;
    let mut index = 0usize;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => index += 1,
            "--no-back-to-toc" => {
                back_to_toc = false;
                index += 1;
            }
            "--no-top-bottom" => {
                top_bottom = false;
                index += 1;
            }
            "--input" | "--output" | "--toc-title" => {
                let flag = args[index].as_str();
                let value = args.get(index + 1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
                })?;
                match flag {
                    "--input" => input = Some(value.clone()),
                    "--output" => output = Some(value.clone()),
                    _ => toc_title = value.clone(),
                }
                index += 2;
            }
            "--levels" => {
                levels_given = true;
                index += 1;
                while let Some(value) = args.get(index).filter(|value| !value.starts_with("--")) {
                    levels.push(value.parse::<u8>().map_err(|_| {
                        ArtifactError::new(
                            "invalid_arguments",
                            "heading levels must be between 1 and 9",
                        )
                    })?);
                    index += 1;
                }
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
    }
    let input =
        input.ok_or_else(|| ArtifactError::new("invalid_arguments", "--input is required"))?;
    let output =
        output.ok_or_else(|| ArtifactError::new("invalid_arguments", "--output is required"))?;
    if !levels_given {
        levels = vec![1, 2, 3];
    }
    if levels.is_empty() || levels.iter().any(|level| !(1..=9).contains(level)) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "heading levels must be a nonempty list of values from 1 through 9",
        ));
    }
    if toc_title.trim().is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "TOC title must not be empty",
        ));
    }
    add_docx_internal_navigation(
        &input,
        &output,
        &levels,
        &toc_title,
        back_to_toc,
        top_bottom,
    )
}

#[derive(Clone)]
struct NavHeading {
    child_index: usize,
    level: u8,
    title: String,
    bookmark: String,
    bookmark_id: usize,
}

fn add_docx_internal_navigation(
    input: &str,
    output: &str,
    levels: &[u8],
    toc_title: &str,
    back_to_toc: bool,
    top_bottom: bool,
) -> Result<Value, ArtifactError> {
    let mut headings = Vec::<NavHeading>::new();
    let mut top_name = None::<String>;
    let mut bottom_name = None::<String>;
    let output_path = rewrite_docx_package(input, output, |name, bytes| {
        if name != "word/document.xml" {
            return Ok(());
        }
        let xml = String::from_utf8(bytes.clone())
            .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
        let body_span = xml_element_spans(&xml, "w:body")?
            .into_iter()
            .next()
            .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "DOCX document has no body"))?;
        let body_xml = &xml[body_span.start..body_span.end];
        let children = direct_child_spans(body_xml)?;
        let paragraphs = children
            .iter()
            .enumerate()
            .filter_map(|(child_index, child)| (child.name == "w:p").then_some(child_index))
            .collect::<Vec<_>>();
        if paragraphs.is_empty() {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "document body has no top-level paragraph for navigation anchors",
            ));
        }
        let mut names = BTreeSet::<String>::new();
        let mut next_id = 1usize;
        for span in xml_element_spans(&xml, "w:bookmarkStart")? {
            let bookmark = &xml[span.start..span.end];
            if let Some(bookmark_name) =
                xml_element_attribute(bookmark, "w:bookmarkStart", "w:name")?
            {
                names.insert(bookmark_name.to_lowercase());
            }
        }
        for tag in ["w:bookmarkStart", "w:bookmarkEnd"] {
            for span in xml_element_spans(&xml, tag)? {
                if let Some(id) = xml_element_attribute(&xml[span.start..span.end], tag, "w:id")?
                    .and_then(|value| value.parse::<usize>().ok())
                {
                    next_id = next_id.max(id.saturating_add(1));
                }
            }
        }
        let title_folded = toc_title.trim().to_lowercase();
        if names.contains("toc")
            || paragraphs.iter().any(|child_index| {
                docx_paragraph_text(
                    &body_xml[children[*child_index].start..children[*child_index].end],
                )
                .is_ok_and(|text| text.to_lowercase() == title_folded)
            })
        {
            return Err(ArtifactError::new(
                "invalid_arguments",
                "an existing TOC bookmark or same-titled paragraph was found; refusing to add a duplicate static TOC",
            ));
        }
        if top_bottom {
            top_name = Some(unique_docx_bookmark_name("Top", &names));
            names.insert(top_name.as_ref().unwrap().to_lowercase());
            bottom_name = Some(unique_docx_bookmark_name("Bottom", &names));
            names.insert(bottom_name.as_ref().unwrap().to_lowercase());
        }
        for child_index in &paragraphs {
            let paragraph = &body_xml[children[*child_index].start..children[*child_index].end];
            let title = docx_paragraph_text(paragraph)?;
            let Some(level) = docx_heading_level(paragraph)? else {
                continue;
            };
            if !levels.contains(&level) || title.is_empty() {
                continue;
            }
            let bookmark =
                unique_docx_bookmark_name(&format!("sec{:03}", headings.len() + 1), &names);
            names.insert(bookmark.to_lowercase());
            headings.push(NavHeading {
                child_index: *child_index,
                level,
                title,
                bookmark,
                bookmark_id: next_id,
            });
            next_id = next_id.saturating_add(1);
        }
        let mut starts = BTreeMap::<usize, Vec<(String, usize)>>::new();
        let mut ends = BTreeMap::<usize, Vec<(String, usize)>>::new();
        for heading in &headings {
            starts
                .entry(heading.child_index)
                .or_default()
                .push((heading.bookmark.clone(), heading.bookmark_id));
            ends.entry(heading.child_index)
                .or_default()
                .push((heading.bookmark.clone(), heading.bookmark_id));
        }
        let first = *paragraphs.first().unwrap();
        let last = *paragraphs.last().unwrap();
        if let (Some(top), Some(bottom)) = (top_name.as_ref(), bottom_name.as_ref()) {
            if first == last {
                starts
                    .entry(first)
                    .or_default()
                    .extend([(top.clone(), next_id), (bottom.clone(), next_id + 1)]);
                let end_markers = ends.entry(last).or_default();
                end_markers.extend([(bottom.clone(), next_id + 1), (top.clone(), next_id)]);
                next_id += 2;
            } else {
                starts
                    .entry(first)
                    .or_default()
                    .push((top.clone(), next_id));
                ends.entry(first).or_default().push((top.clone(), next_id));
                next_id += 1;
                starts
                    .entry(last)
                    .or_default()
                    .push((bottom.clone(), next_id));
                ends.entry(last)
                    .or_default()
                    .push((bottom.clone(), next_id));
                next_id += 1;
            }
        }
        let mut updated_body = body_xml.to_owned();
        for child_index in paragraphs.iter().rev() {
            let child = &children[*child_index];
            let original_paragraph = &updated_body[child.start..child.end];
            let changed_paragraph = update_nav_paragraph(
                original_paragraph,
                starts
                    .get(child_index)
                    .map(Vec::as_slice)
                    .unwrap_or_default(),
                ends.get(child_index).map(Vec::as_slice).unwrap_or_default(),
                back_to_toc
                    && headings
                        .iter()
                        .any(|heading| heading.child_index == *child_index),
            )?;
            updated_body.replace_range(child.start..child.end, &changed_paragraph);
        }
        let toc_bookmark_id = next_id;
        let mut toc_section = update_nav_paragraph(
            &docx_text_paragraph(toc_title, Some("Heading1")),
            &[("TOC".to_owned(), toc_bookmark_id)],
            &[("TOC".to_owned(), toc_bookmark_id)],
            false,
        )?;
        for heading in &headings {
            let indent = "  ".repeat(usize::from(heading.level.saturating_sub(1)));
            let mut entry = String::from("<w:p>");
            if !indent.is_empty() {
                entry.push_str(&format!(
                    "<w:r><w:t xml:space=\"preserve\">{}</w:t></w:r>",
                    escape_xml_text(&indent)
                ));
            }
            entry.push_str(&docx_hyperlink(&heading.bookmark, &heading.title));
            entry.push_str("</w:p>");
            toc_section.push_str(&entry);
        }
        toc_section.push_str("<w:p><w:r><w:t/></w:r></w:p>");
        let toc_body_open = find_xml_tag_end(&updated_body, 0).ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", "w:body opening tag is malformed")
        })?;
        updated_body.insert_str(toc_body_open + 1, &toc_section);
        let mut updated_xml = xml;
        updated_xml.replace_range(body_span.start..body_span.end, &updated_body);
        *bytes = updated_xml.into_bytes();
        Ok(())
    })?;
    Ok(json!({
        "ok": true,
        "input": Path::new(input).canonicalize().unwrap_or_else(|_| PathBuf::from(input)),
        "output": output_path,
        "counts": {
            "headingsBookmarked": headings.len(),
            "tocEntries": headings.len(),
            "topBottomBookmarks": if top_bottom { 2 } else { 0 },
            "backToTocLinks": if back_to_toc { headings.len() } else { 0 }
        },
        "bookmarks": { "top": top_name, "bottom": bottom_name, "toc": "TOC" },
        "limitations": [
            "patches only word/document.xml and top-level body paragraphs",
            "static TOC links do not include page numbers and are not a Word TOC field",
            "quick-links bars for existing figure/table caption bookmarks are not generated",
            "existing same-titled TOC or TOC bookmark is rejected to avoid duplicate navigation sections"
        ]
    }))
}

fn unique_docx_bookmark_name(base: &str, names: &BTreeSet<String>) -> String {
    if !names.contains(&base.to_lowercase()) {
        return base.to_owned();
    }
    let mut suffix = 2usize;
    loop {
        let candidate = format!("{base}_{suffix}");
        if !names.contains(&candidate.to_lowercase()) {
            return candidate;
        }
        suffix += 1;
    }
}

fn docx_heading_level(paragraph: &str) -> Result<Option<u8>, ArtifactError> {
    let Some(properties) = direct_child_spans(paragraph)?
        .into_iter()
        .find(|child| child.name == "w:pPr")
    else {
        return Ok(None);
    };
    let properties_xml = &paragraph[properties.start..properties.end];
    let children = direct_child_spans(properties_xml)?;
    if let Some(outline) = children.iter().find(|child| child.name == "w:outlineLvl") {
        if let Some(value) = xml_element_attribute(
            &properties_xml[outline.start..outline.end],
            "w:outlineLvl",
            "w:val",
        )? {
            if let Ok(level) = value.parse::<u8>() {
                return Ok(Some(level.saturating_add(1)));
            }
        }
    }
    let Some(style) = children.iter().find(|child| child.name == "w:pStyle") else {
        return Ok(None);
    };
    let Some(value) =
        xml_element_attribute(&properties_xml[style.start..style.end], "w:pStyle", "w:val")?
    else {
        return Ok(None);
    };
    let pattern = regex::Regex::new(r"^(?:Heading\s*(\d+)|Heading(\d+))$").unwrap();
    Ok(pattern
        .captures(&value)
        .and_then(|captures| captures.get(1).or_else(|| captures.get(2)))
        .and_then(|level| level.as_str().parse::<u8>().ok()))
}

fn update_nav_paragraph(
    paragraph: &str,
    starts: &[(String, usize)],
    ends: &[(String, usize)],
    add_back_link: bool,
) -> Result<String, ArtifactError> {
    let open_end = find_xml_tag_end(paragraph, 0).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", "paragraph opening tag is malformed")
    })?;
    let close_start = paragraph.rfind("</w:p>").ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", "paragraph closing tag is missing")
    })?;
    let properties = direct_child_spans(paragraph)?
        .into_iter()
        .find(|child| child.name == "w:pPr");
    let insertion_at = properties
        .map(|property| property.end)
        .unwrap_or(open_end + 1);
    let starts_xml = starts
        .iter()
        .map(|(name, id)| {
            format!(
                "<w:bookmarkStart w:id=\"{id}\" w:name=\"{}\"/>",
                escape_xml_attribute(name)
            )
        })
        .collect::<String>();
    let ends_xml = ends
        .iter()
        .map(|(_, id)| format!("<w:bookmarkEnd w:id=\"{id}\"/>"))
        .collect::<String>();
    let back_link = if add_back_link {
        "<w:r><w:t xml:space=\"preserve\"> </w:t></w:r><w:hyperlink w:anchor=\"TOC\"><w:r><w:rPr><w:rStyle w:val=\"Hyperlink\"/></w:rPr><w:t>Back to TOC</w:t></w:r></w:hyperlink>"
    } else {
        ""
    };
    let mut updated = paragraph.to_owned();
    updated.insert_str(close_start, &format!("{ends_xml}{back_link}"));
    updated.insert_str(insertion_at, &starts_xml);
    Ok(updated)
}

fn docx_text_paragraph(text: &str, style: Option<&str>) -> String {
    let style_xml = style
        .map(|style| {
            format!(
                "<w:pPr><w:pStyle w:val=\"{}\"/></w:pPr>",
                escape_xml_attribute(style)
            )
        })
        .unwrap_or_default();
    format!(
        "<w:p>{style_xml}<w:r><w:t{}>{}</w:t></w:r></w:p>",
        xml_space_attribute(text),
        escape_xml_text(text)
    )
}

fn docx_hyperlink(anchor: &str, text: &str) -> String {
    format!(
        "<w:hyperlink w:anchor=\"{}\"><w:r><w:rPr><w:rStyle w:val=\"Hyperlink\"/></w:rPr><w:t{}>{}</w:t></w:r></w:hyperlink>",
        escape_xml_attribute(anchor),
        xml_space_attribute(text),
        escape_xml_text(text)
    )
}

fn note_insert_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(
            flag.as_str(),
            "input" | "output" | "kind" | "text" | "marker" | "--json"
        ) {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let input = cli::required_flag(&flags, "input")?;
    let output = cli::required_flag(&flags, "output")?;
    let kind = cli::required_flag(&flags, "kind")?;
    if !matches!(kind, "footnote" | "endnote") {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--kind must be footnote or endnote",
        ));
    }
    let text = cli::required_flag(&flags, "text")?;
    let marker = flags
        .iter()
        .find(|(flag, _)| flag == "marker")
        .and_then(|(_, value)| value.as_deref())
        .unwrap_or("[[NOTE]]");
    if marker.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--marker must not be empty",
        ));
    }
    insert_docx_note(&input, &output, &kind, marker, &text)
}

fn insert_docx_note(
    input: &str,
    output: &str,
    kind: &str,
    marker: &str,
    text: &str,
) -> Result<Value, ArtifactError> {
    let (
        root,
        note_tag,
        reference_tag,
        note_ref_tag,
        separator_tag,
        continuation_tag,
        rel_type,
        content_type,
    ) = match kind {
        "footnote" => (
            "footnotes",
            "footnote",
            "footnoteReference",
            "footnoteRef",
            "separator",
            "continuationSeparator",
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml",
        ),
        "endnote" => (
            "endnotes",
            "endnote",
            "endnoteReference",
            "endnoteRef",
            "separator",
            "continuationSeparator",
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml",
        ),
        _ => unreachable!("kind validated by the command parser"),
    };
    let note_part = format!("word/{root}.xml");
    let relationships_part = "word/_rels/document.xml.rels";
    let content_types_part = "[Content_Types].xml";
    let source = Path::new(input)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let archive_file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(archive_file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let names = archive
        .file_names()
        .map(str::to_owned)
        .collect::<BTreeSet<_>>();
    let document_xml = read_docx_part(&mut archive, "word/document.xml")?;
    let mut notes_xml = read_optional_docx_part(&mut archive, &note_part)?.unwrap_or_else(|| {
        format!("<w:{root} xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"></w:{root}>")
    });
    if xml_element_spans(&notes_xml, &format!("w:{root}"))?.is_empty() {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            format!("{note_part} has an unexpected root element"),
        ));
    }
    let mut relationships_xml = read_optional_docx_part(&mut archive, relationships_part)?
        .unwrap_or_else(|| "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"/>".to_owned());
    let mut content_types_xml = read_docx_part(&mut archive, content_types_part)?;
    drop(archive);

    let body_span = xml_element_spans(&document_xml, "w:body")?
        .into_iter()
        .next()
        .ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", "word/document.xml has no w:body")
        })?;
    let mut body_xml = document_xml[body_span.start..body_span.end].to_owned();
    let note_id = next_docx_note_id(&notes_xml, &document_xml, note_tag, reference_tag)?;
    let (updated_body, marker_found) =
        replace_docx_note_marker(&body_xml, marker, reference_tag, note_id)?;
    body_xml = updated_body;
    if !marker_found {
        let children = direct_child_spans(&body_xml)?;
        let section = children.iter().find(|child| child.name == "w:sectPr");
        let paragraph = format!("<w:p><w:r><w:{reference_tag} w:id=\"{note_id}\"/></w:r></w:p>");
        if let Some(section) = section {
            body_xml.insert_str(section.start, &paragraph);
        } else {
            let close_start = body_xml.rfind("</w:body>").ok_or_else(|| {
                ArtifactError::new("invalid_ooxml_xml", "w:body closing tag is missing")
            })?;
            body_xml.insert_str(close_start, &paragraph);
        }
    }
    let mut updated_document = document_xml;
    updated_document.replace_range(body_span.start..body_span.end, &body_xml);

    let separators_ensured = ensure_docx_note_separators(
        &mut notes_xml,
        root,
        note_tag,
        separator_tag,
        continuation_tag,
    )?;
    let note_fragment = format!(
        "<w:{note_tag} w:id=\"{note_id}\"><w:p><w:r><w:{note_ref_tag}/></w:r><w:r><w:t xml:space=\"preserve\"> {}</w:t></w:r></w:p></w:{note_tag}>",
        escape_xml_text(text)
    );
    notes_xml = insert_before_root_close(&notes_xml, &format!("w:{root}"), &note_fragment)?;
    let relationship_added = ensure_docx_note_relationship(&mut relationships_xml, rel_type, root)?;
    let content_type_changed =
        ensure_docx_note_content_type(&mut content_types_xml, root, content_type)?;

    let mut modified_parts = vec!["word/document.xml".to_owned(), note_part.clone()];
    if relationship_added || !names.contains(relationships_part) {
        modified_parts.push(relationships_part.to_owned());
    }
    if content_type_changed {
        modified_parts.push(content_types_part.to_owned());
    }
    let mut additional_parts = Vec::new();
    if !names.contains(&note_part) {
        additional_parts.push((note_part.clone(), notes_xml.as_bytes().to_vec()));
    }
    if !names.contains(relationships_part) {
        additional_parts.push((
            relationships_part.to_owned(),
            relationships_xml.as_bytes().to_vec(),
        ));
    }
    let output_path = rewrite_docx_package_with_additional_parts(
        input,
        output,
        additional_parts,
        |name, bytes| {
            let replacement = match name {
                "word/document.xml" => Some(updated_document.as_str()),
                part if part == note_part => Some(notes_xml.as_str()),
                "word/_rels/document.xml.rels" if names.contains(relationships_part) => {
                    Some(relationships_xml.as_str())
                }
                "[Content_Types].xml" => Some(content_types_xml.as_str()),
                _ => None,
            };
            if let Some(replacement) = replacement {
                *bytes = replacement.as_bytes().to_vec();
            }
            Ok(())
        },
    )?;
    Ok(json!({
        "ok": true,
        "input": source,
        "output": output_path,
        "kind": kind,
        "noteId": note_id,
        "anchor": if marker_found { "marker" } else { "appended at end of body because marker was not found" },
        "markerFound": marker_found,
        "separatorsEnsured": separators_ensured,
        "modifiedParts": modified_parts,
        "limitations": ["classic footnotes/endnotes only; marker search is limited to word/document.xml body"],
    }))
}

fn next_docx_note_id(
    notes: &str,
    document: &str,
    note_tag: &str,
    reference_tag: &str,
) -> Result<usize, ArtifactError> {
    let mut maximum = 0usize;
    for block in xml_element_spans(notes, &format!("w:{note_tag}"))? {
        if let Some(id) = xml_element_attribute(
            &notes[block.start..block.end],
            &format!("w:{note_tag}"),
            "w:id",
        )?
        .and_then(|value| value.parse::<usize>().ok())
        {
            maximum = maximum.max(id);
        }
    }
    for block in xml_element_spans(document, &format!("w:{reference_tag}"))? {
        if let Some(id) = xml_element_attribute(
            &document[block.start..block.end],
            &format!("w:{reference_tag}"),
            "w:id",
        )?
        .and_then(|value| value.parse::<usize>().ok())
        {
            maximum = maximum.max(id);
        }
    }
    Ok(maximum.saturating_add(1))
}

fn ensure_docx_note_separators(
    notes: &mut String,
    root: &str,
    note_tag_name: &str,
    separator_tag: &str,
    continuation_tag: &str,
) -> Result<bool, ArtifactError> {
    let note_tag = format!("w:{note_tag_name}");
    let mut existing = BTreeSet::<String>::new();
    for span in xml_element_spans(notes, &note_tag)? {
        let block = &notes[span.start..span.end];
        let id = xml_element_attribute(block, &note_tag, "w:id")?.unwrap_or_default();
        let kind = xml_element_attribute(block, &note_tag, "w:type")?.unwrap_or_default();
        existing.insert(format!("{id}:{kind}"));
    }
    let mut changed = false;
    if !existing.contains("-1:separator") {
        let fragment = format!(
            "<w:{note_tag_name} w:type=\"separator\" w:id=\"-1\"><w:p><w:r><w:{separator_tag}/></w:r></w:p></w:{note_tag_name}>"
        );
        *notes = insert_after_xml_root_open(notes, &format!("w:{root}"), &fragment)?;
        changed = true;
    }
    if !existing.contains("0:continuationSeparator") {
        let fragment = format!(
            "<w:{note_tag_name} w:type=\"continuationSeparator\" w:id=\"0\"><w:p><w:r><w:{continuation_tag}/></w:r></w:p></w:{note_tag_name}>"
        );
        let separator_spans = xml_element_spans(notes, &note_tag)?;
        let separator = separator_spans.iter().find(|span| {
            let block = &notes[span.start..span.end];
            xml_element_attribute(block, &note_tag, "w:id")
                .ok()
                .flatten()
                .as_deref()
                == Some("-1")
        });
        if let Some(separator) = separator {
            notes.insert_str(separator.end, &fragment);
        } else {
            *notes = insert_after_xml_root_open(notes, &format!("w:{root}"), &fragment)?;
        }
        changed = true;
    }
    Ok(changed)
}

fn insert_after_xml_root_open(
    xml: &str,
    root: &str,
    fragment: &str,
) -> Result<String, ArtifactError> {
    let start = xml.find(&format!("<{root}")).ok_or_else(|| {
        ArtifactError::new(
            "invalid_ooxml_xml",
            format!("XML is missing its {root} root"),
        )
    })?;
    let end = find_xml_tag_end(xml, start).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", format!("{root} root is unterminated"))
    })?;
    if xml[start..end].trim_end().ends_with('/') {
        return Err(ArtifactError::new(
            "invalid_ooxml_xml",
            format!("{root} root must have an explicit closing tag"),
        ));
    }
    let mut updated = xml.to_owned();
    updated.insert_str(end + 1, fragment);
    Ok(updated)
}

fn replace_docx_note_marker(
    body: &str,
    marker: &str,
    reference_tag: &str,
    note_id: usize,
) -> Result<(String, bool), ArtifactError> {
    let text_spans = xml_element_spans(body, "w:t")?;
    for text_span in text_spans {
        let text_xml = &body[text_span.start..text_span.end];
        let open_end = find_xml_tag_end(text_xml, 0).ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", "w:t opening tag is malformed")
        })?;
        let close = text_xml
            .rfind("</w:t>")
            .ok_or_else(|| ArtifactError::new("invalid_ooxml_xml", "w:t closing tag is missing"))?;
        let raw_text = &text_xml[open_end + 1..close];
        let Some(marker_at) = raw_text.find(marker) else {
            continue;
        };
        let run_span = xml_element_spans(body, "w:r")?
            .into_iter()
            .find(|span| span.start <= text_span.start && span.end >= text_span.end)
            .ok_or_else(|| {
                ArtifactError::new(
                    "invalid_arguments",
                    "note marker was found outside a run that can hold a reference",
                )
            })?;
        let run_xml = &body[run_span.start..run_span.end];
        let children = direct_child_spans(run_xml)?;
        let properties = children
            .iter()
            .find(|child| child.name == "w:rPr")
            .map(|child| run_xml[child.start..child.end].to_owned())
            .unwrap_or_default();
        let before = &raw_text[..marker_at];
        let after = &raw_text[marker_at + marker.len()..];
        let text_start = text_span.start - run_span.start;
        let text_end = text_span.end - run_span.start;
        let mut before_children = String::new();
        let mut after_children = String::new();
        for child in children.iter().filter(|child| child.name != "w:rPr") {
            let child_xml = &run_xml[child.start..child.end];
            if child.start == text_start && child.end == text_end {
                if !before.is_empty() {
                    before_children.push_str(&format!(
                        "<w:t{}>{}</w:t>",
                        xml_space_attribute(before),
                        escape_xml_text(before)
                    ));
                }
                if !after.is_empty() {
                    after_children.push_str(&format!(
                        "<w:t{}>{}</w:t>",
                        xml_space_attribute(after),
                        escape_xml_text(after)
                    ));
                }
            } else if child.end <= text_start {
                before_children.push_str(child_xml);
            } else if child.start >= text_end {
                after_children.push_str(child_xml);
            } else {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    "note marker text overlaps unsupported inline structure",
                ));
            }
        }
        let mut replacement = String::new();
        if !before_children.is_empty() {
            replacement.push_str(&format!("<w:r>{properties}{before_children}</w:r>"));
        }
        replacement.push_str(&format!(
            "<w:r><w:{reference_tag} w:id=\"{note_id}\"/></w:r>"
        ));
        if !after_children.is_empty() {
            replacement.push_str(&format!("<w:r>{properties}{after_children}</w:r>"));
        }
        let mut updated = body.to_owned();
        updated.replace_range(run_span.start..run_span.end, &replacement);
        return Ok((updated, true));
    }
    Ok((body.to_owned(), false))
}

fn ensure_docx_note_relationship(
    xml: &mut String,
    relationship_type: &str,
    target: &str,
) -> Result<bool, ArtifactError> {
    for span in xml_element_spans(xml, "Relationship")? {
        let block = &xml[span.start..span.end];
        if xml_element_attribute(block, "Relationship", "Type")?.as_deref()
            == Some(relationship_type)
        {
            return Ok(false);
        }
    }
    let mut maximum = 0usize;
    for span in xml_element_spans(xml, "Relationship")? {
        let block = &xml[span.start..span.end];
        if let Some(id) = xml_element_attribute(block, "Relationship", "Id")? {
            if let Some(number) = id
                .strip_prefix("rId")
                .and_then(|suffix| suffix.parse::<usize>().ok())
            {
                maximum = maximum.max(number);
            }
        }
    }
    let fragment = format!(
        "<Relationship Id=\"rId{}\" Type=\"{}\" Target=\"{}.xml\"/>",
        maximum + 1,
        escape_xml_attribute(relationship_type),
        target
    );
    *xml = insert_before_root_close(xml, "Relationships", &fragment)?;
    Ok(true)
}

fn ensure_docx_note_content_type(
    xml: &mut String,
    root: &str,
    content_type: &str,
) -> Result<bool, ArtifactError> {
    let part_name = format!("/word/{root}.xml");
    for span in xml_element_spans(xml, "Override")? {
        let block = &xml[span.start..span.end];
        if xml_element_attribute(block, "Override", "PartName")?.as_deref()
            == Some(part_name.as_str())
        {
            if xml_element_attribute(block, "Override", "ContentType")?.as_deref()
                == Some(content_type)
            {
                return Ok(false);
            }
            let start = span.start;
            let _end = find_xml_tag_end(xml, start).ok_or_else(|| {
                ArtifactError::new("invalid_ooxml_xml", "Override element is malformed")
            })?;
            let updated = format!(
                "<Override PartName=\"{}\" ContentType=\"{}\"/>",
                escape_xml_attribute(&part_name),
                escape_xml_attribute(content_type)
            );
            xml.replace_range(span.start..span.end, &updated);
            return Ok(true);
        }
    }
    let fragment = format!(
        "<Override PartName=\"{}\" ContentType=\"{}\"/>",
        escape_xml_attribute(&part_name),
        escape_xml_attribute(content_type)
    );
    *xml = insert_before_root_close(xml, "Types", &fragment)?;
    Ok(true)
}

fn template_styles_apply_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "template" | "input" | "output" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let template = cli::required_flag(&flags, "template")?;
    let input = cli::required_flag(&flags, "input")?;
    let output = cli::required_flag(&flags, "output")?;
    apply_docx_template_styles(template, input, output)
}

fn apply_docx_template_styles(
    template_path: &str,
    input_path: &str,
    output_path: &str,
) -> Result<Value, ArtifactError> {
    const STYLE_PART: &str = "word/styles.xml";
    const NUMBERING_PART: &str = "word/numbering.xml";
    const RELS_PART: &str = "word/_rels/document.xml.rels";
    const TYPES_PART: &str = "[Content_Types].xml";
    const NUMBERING_REL: &str =
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering";
    const NUMBERING_TYPE: &str =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml";
    const OPTIONAL_ASSETS: [(&str, &str, &str, &str); 2] = [
        (
            "word/theme/theme1.xml",
            "application/vnd.openxmlformats-officedocument.theme+xml",
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme",
            "theme/theme1.xml",
        ),
        (
            "word/fontTable.xml",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml",
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable",
            "fontTable.xml",
        ),
    ];

    let template = Path::new(template_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !template.is_file()
        || !template.extension().is_some_and(|extension| {
            extension.eq_ignore_ascii_case("docx") || extension.eq_ignore_ascii_case("dotx")
        })
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "template must be a regular .docx or .dotx file",
        ));
    }
    let template_file = File::open(&template)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut template_archive = ZipArchive::new(template_file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let template_names = template_archive
        .file_names()
        .map(str::to_owned)
        .collect::<BTreeSet<_>>();
    if !template_names.contains(STYLE_PART) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "both files must contain word/styles.xml",
        ));
    }
    let template_styles = read_docx_part(&mut template_archive, STYLE_PART)?;
    let template_numbering = read_optional_docx_part(&mut template_archive, NUMBERING_PART)?;
    let copied_theme_parts = OPTIONAL_ASSETS
        .iter()
        .filter(|(part, _, _, _)| template_names.contains(*part))
        .map(|(part, _, _, _)| (*part, read_docx_part(&mut template_archive, part)))
        .map(|(part, data)| data.map(|data| (part, data)))
        .collect::<Result<Vec<_>, _>>()?;
    drop(template_archive);

    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !source.is_file()
        || !source
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular .docx file",
        ));
    }
    let output_candidate = Path::new(output_path);
    if !output_candidate
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "output must be a separate .docx file",
        ));
    }
    let output_parent = output_candidate
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(output_parent)
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
    let output_parent = output_parent
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
    let output = output_parent.join(output_candidate.file_name().ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "output path must include a file name")
    })?);
    if output == source || output == template {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "output must be a separate .docx file",
        ));
    }
    if output.exists() {
        return Err(ArtifactError::new(
            "output_exists",
            format!("output already exists: {}", output.display()),
        ));
    }

    let source_file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut source_archive = ZipArchive::new(source_file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let source_names = source_archive
        .file_names()
        .map(str::to_owned)
        .collect::<BTreeSet<_>>();
    if !source_names.contains(STYLE_PART) {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "both files must contain word/styles.xml",
        ));
    }
    let target_styles = read_docx_part(&mut source_archive, STYLE_PART)?;
    let mut replacements = BTreeMap::<String, Vec<u8>>::new();
    let mut numbering_copied = false;
    let mut numbering_map = BTreeMap::<String, String>::new();
    if let Some(template_numbering) = template_numbering {
        let target_numbering = read_optional_docx_part(&mut source_archive, NUMBERING_PART)?;
        let (numbering, id_map) = if let Some(target_numbering) = target_numbering {
            merge_docx_numbering(&template_numbering, &target_numbering)?
        } else {
            for number in xml_element_spans(&template_numbering, "w:num")? {
                if let Some(id) = xml_element_attribute(
                    &template_numbering[number.start..number.end],
                    "w:num",
                    "w:numId",
                )? {
                    numbering_map.insert(id.clone(), id);
                }
            }
            (template_numbering, numbering_map.clone())
        };
        numbering_map = id_map;
        replacements.insert(NUMBERING_PART.to_owned(), numbering.into_bytes());
        numbering_copied = true;
    }
    let (styles, copied_styles) =
        merge_docx_styles(&template_styles, &target_styles, &numbering_map)?;
    replacements.insert(STYLE_PART.to_owned(), styles.as_bytes().to_vec());

    let copied_theme_names = copied_theme_parts
        .iter()
        .map(|(part, _)| *part)
        .collect::<Vec<_>>();
    let added_theme_parts = copied_theme_names
        .iter()
        .copied()
        .filter(|part| !source_names.contains(*part))
        .collect::<Vec<_>>();
    let mut modified_parts = vec![STYLE_PART.to_owned()];
    if numbering_copied {
        modified_parts.push(NUMBERING_PART.to_owned());
        let mut rels =
            read_optional_docx_part(&mut source_archive, RELS_PART)?.ok_or_else(|| {
                ArtifactError::new(
                    "invalid_arguments",
                    "target has no document relationships part; cannot safely add numbering",
                )
            })?;
        let mut content_types = read_docx_part(&mut source_archive, TYPES_PART)?;
        let rel_changed = ensure_numbering_relationship(&mut rels, NUMBERING_REL)?;
        let types_changed = ensure_numbering_content_type(&mut content_types, NUMBERING_TYPE)?;
        if rel_changed {
            replacements.insert(RELS_PART.to_owned(), rels.into_bytes());
            modified_parts.push(RELS_PART.to_owned());
        }
        if types_changed {
            replacements.insert(TYPES_PART.to_owned(), content_types.into_bytes());
            modified_parts.push(TYPES_PART.to_owned());
        }
    }
    if !added_theme_parts.is_empty() {
        let mut rels = if let Some(existing) = replacements.get(RELS_PART) {
            String::from_utf8(existing.clone())
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
        } else {
            read_optional_docx_part(&mut source_archive, RELS_PART)?.ok_or_else(|| {
                ArtifactError::new(
                    "invalid_arguments",
                    "target has no document relationships part; cannot safely add template assets",
                )
            })?
        };
        let mut content_types = if let Some(existing) = replacements.get(TYPES_PART) {
            String::from_utf8(existing.clone())
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?
        } else {
            read_docx_part(&mut source_archive, TYPES_PART)?
        };
        let mut rels_changed = false;
        let mut types_changed = false;
        for part in &added_theme_parts {
            let (_, content_type, relationship_type, target) = OPTIONAL_ASSETS
                .iter()
                .find(|(candidate, _, _, _)| candidate == part)
                .expect("theme parts come from the fixed metadata list");
            rels_changed |=
                ensure_optional_asset_relationship(&mut rels, relationship_type, target, part)?;
            types_changed |=
                ensure_optional_asset_content_type(&mut content_types, part, content_type)?;
        }
        if rels_changed {
            replacements.insert(RELS_PART.to_owned(), rels.into_bytes());
            if !modified_parts.iter().any(|part| part == RELS_PART) {
                modified_parts.push(RELS_PART.to_owned());
            }
        }
        if types_changed {
            replacements.insert(TYPES_PART.to_owned(), content_types.into_bytes());
            if !modified_parts.iter().any(|part| part == TYPES_PART) {
                modified_parts.push(TYPES_PART.to_owned());
            }
        }
    }
    drop(source_archive);

    for (part, data) in &copied_theme_parts {
        replacements.insert((*part).to_owned(), data.as_bytes().to_vec());
        if !modified_parts.iter().any(|modified| modified == part) {
            modified_parts.push((*part).to_owned());
        }
    }
    let additional_parts = replacements
        .iter()
        .filter(|(name, _)| !source_names.contains(*name))
        .map(|(name, bytes)| (name.clone(), bytes.clone()))
        .collect::<Vec<_>>();
    let output = output.to_string_lossy().into_owned();
    let output_path = rewrite_docx_package_with_additional_parts(
        input_path,
        &output,
        additional_parts,
        |name, bytes| {
            if let Some(replacement) = replacements.get(name) {
                *bytes = replacement.clone();
            }
            Ok(())
        },
    )?;
    Ok(json!({
        "ok": true,
        "template": template,
        "input": source,
        "output": output_path,
        "stylesCopied": copied_styles,
        "themePartsCopied": copied_theme_names,
        "numberingPartCopied": numbering_copied,
        "modifiedParts": modified_parts,
        "limitations": [
            "merges common numbering definitions with remapped IDs; templates using picture bullets are refused because related media is not imported",
            "does not rewrite content-specific paragraph or character style references",
            "replaces matching style IDs and docDefaults; review the rendered output"
        ]
    }))
}

fn merge_docx_styles(
    template: &str,
    target: &str,
    numbering_map: &BTreeMap<String, String>,
) -> Result<(String, Vec<String>), ArtifactError> {
    let template_children = direct_child_spans(template)?;
    let target_children = direct_child_spans(target)?;
    let template_defaults = template_children
        .iter()
        .find(|child| child.name == "w:docDefaults")
        .map(|child| template[child.start..child.end].to_owned());
    let mut copied_styles = Vec::<(String, String)>::new();
    let mut style_ids = Vec::<String>::new();
    for child in &template_children {
        if child.name != "w:style" {
            continue;
        }
        let block = &template[child.start..child.end];
        let Some(style_id) = xml_element_attribute(block, "w:style", "w:styleId")? else {
            continue;
        };
        let remapped = remap_style_numbering_ids(block, numbering_map)?;
        style_ids.push(style_id);
        copied_styles.push((style_ids.last().cloned().unwrap(), remapped));
    }
    let mut updated = target.to_owned();
    let mut removals = Vec::<(usize, usize)>::new();
    let target_style_ids = copied_styles
        .iter()
        .map(|(id, _)| id.to_lowercase())
        .collect::<BTreeSet<_>>();
    for child in &target_children {
        let block = &target[child.start..child.end];
        if child.name == "w:docDefaults" && template_defaults.is_some() {
            removals.push((child.start, child.end));
        } else if child.name == "w:style" {
            if let Some(style_id) = xml_element_attribute(block, "w:style", "w:styleId")? {
                if target_style_ids.contains(&style_id.to_lowercase()) {
                    removals.push((child.start, child.end));
                }
            }
        }
    }
    for (start, end) in removals.into_iter().rev() {
        updated.replace_range(start..end, "");
    }
    updated = merge_xml_root_namespaces(template, &updated, "w:styles")?;
    if let Some(defaults) = template_defaults {
        updated = insert_after_xml_root_open(&updated, "w:styles", &defaults)?;
    }
    let imported = copied_styles
        .into_iter()
        .map(|(_, block)| block)
        .collect::<String>();
    updated = insert_before_root_close(&updated, "w:styles", &imported)?;
    Ok((updated, style_ids))
}

fn merge_xml_root_namespaces(
    source: &str,
    target: &str,
    root: &str,
) -> Result<String, ArtifactError> {
    let source_start = source.find(&format!("<{root}")).ok_or_else(|| {
        ArtifactError::new(
            "invalid_ooxml_xml",
            format!("XML is missing its {root} root"),
        )
    })?;
    let source_end = find_xml_tag_end(source, source_start).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", format!("{root} root is unterminated"))
    })?;
    let target_start = target.find(&format!("<{root}")).ok_or_else(|| {
        ArtifactError::new(
            "invalid_ooxml_xml",
            format!("XML is missing its {root} root"),
        )
    })?;
    let target_end = find_xml_tag_end(target, target_start).ok_or_else(|| {
        ArtifactError::new("invalid_ooxml_xml", format!("{root} root is unterminated"))
    })?;
    let source_attrs = crate::ooxml::parse_attributes(&source[source_start + 1..source_end]);
    let target_attrs = crate::ooxml::parse_attributes(&target[target_start + 1..target_end]);
    let mut additions = String::new();
    for (name, value) in source_attrs
        .iter()
        .filter(|(name, _)| name.starts_with("xmlns:"))
    {
        if let Some(existing) = target_attrs.get(name) {
            if existing != value {
                return Err(ArtifactError::new(
                    "invalid_ooxml_xml",
                    format!("conflicting namespace binding for {name}"),
                ));
            }
        } else {
            additions.push_str(&format!(" {name}=\"{}\"", escape_xml_attribute(value)));
        }
    }
    let mut updated = target.to_owned();
    updated.insert_str(target_end, &additions);
    Ok(updated)
}

fn remap_style_numbering_ids(
    style: &str,
    numbering_map: &BTreeMap<String, String>,
) -> Result<String, ArtifactError> {
    let spans = xml_element_spans(style, "w:numId")?;
    let mut updated = style.to_owned();
    for span in spans.into_iter().rev() {
        let block = &updated[span.start..span.end];
        let Some(old_id) = xml_element_attribute(block, "w:numId", "w:val")? else {
            continue;
        };
        if let Some(new_id) = numbering_map.get(&old_id) {
            let changed = set_attribute_on_first_tag(block, "w:numId", "w:val", new_id)?;
            updated.replace_range(span.start..span.end, &changed);
        }
    }
    Ok(updated)
}

fn merge_docx_numbering(
    template: &str,
    target: &str,
) -> Result<(String, BTreeMap<String, String>), ArtifactError> {
    if !xml_element_spans(template, "w:numPicBullet")?.is_empty()
        || !xml_element_spans(target, "w:numPicBullet")?.is_empty()
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "numbering uses picture bullets, which require related media parts",
        ));
    }
    let template_children = direct_child_spans(template)?;
    let target_children = direct_child_spans(target)?;
    let next_id = |tag: &str, attr: &str| -> Result<usize, ArtifactError> {
        let mut maximum = None::<usize>;
        for child in &target_children {
            if child.name != tag {
                continue;
            }
            if let Some(value) = xml_element_attribute(&target[child.start..child.end], tag, attr)?
                .and_then(|value| value.parse::<usize>().ok())
            {
                maximum = Some(maximum.map_or(value, |current| current.max(value)));
            }
        }
        Ok(maximum.map_or(0, |maximum| maximum + 1))
    };
    let mut abstract_map = BTreeMap::<String, String>::new();
    let mut abstract_next = next_id("w:abstractNum", "w:abstractNumId")?;
    let mut abstract_blocks = BTreeMap::<usize, String>::new();
    for child in &template_children {
        if child.name != "w:abstractNum" {
            continue;
        }
        let block = &template[child.start..child.end];
        if let Some(old_id) = xml_element_attribute(block, "w:abstractNum", "w:abstractNumId")? {
            let new_id = abstract_next.to_string();
            abstract_map.insert(old_id, new_id.clone());
            let changed =
                set_attribute_on_first_tag(block, "w:abstractNum", "w:abstractNumId", &new_id)?;
            abstract_blocks.insert(child.start, changed);
            abstract_next += 1;
        }
    }
    let mut num_next = next_id("w:num", "w:numId")?;
    let mut num_map = BTreeMap::<String, String>::new();
    let mut num_blocks = BTreeMap::<usize, String>::new();
    for child in &template_children {
        if child.name != "w:num" {
            continue;
        }
        let block = &template[child.start..child.end];
        let Some(old_id) = xml_element_attribute(block, "w:num", "w:numId")? else {
            continue;
        };
        let new_id = num_next.to_string();
        num_map.insert(old_id, new_id.clone());
        let changed = set_attribute_on_first_tag(block, "w:num", "w:numId", &new_id)?;
        let mut changed = changed;
        for abstract_ref in xml_element_spans(&changed, "w:abstractNumId")?
            .into_iter()
            .rev()
        {
            let ref_xml = &changed[abstract_ref.start..abstract_ref.end];
            if let Some(old_abstract) = xml_element_attribute(ref_xml, "w:abstractNumId", "w:val")?
            {
                if let Some(new_abstract) = abstract_map.get(&old_abstract) {
                    let rewritten = set_attribute_on_first_tag(
                        ref_xml,
                        "w:abstractNumId",
                        "w:val",
                        new_abstract,
                    )?;
                    changed.replace_range(abstract_ref.start..abstract_ref.end, &rewritten);
                }
            }
        }
        num_blocks.insert(child.start, changed);
        num_next += 1;
    }
    let mut imported = String::new();
    for child in template_children {
        match child.name.as_str() {
            "w:abstractNum" => {
                if let Some(block) = abstract_blocks.get(&child.start) {
                    imported.push_str(block);
                }
            }
            "w:num" => {
                if let Some(block) = num_blocks.get(&child.start) {
                    imported.push_str(block);
                }
            }
            _ => {}
        }
    }
    let mut merged = merge_xml_root_namespaces(template, target, "w:numbering")?;
    merged = insert_before_root_close(&merged, "w:numbering", &imported)?;
    Ok((merged, num_map))
}

fn ensure_numbering_relationship(
    xml: &mut String,
    relationship_type: &str,
) -> Result<bool, ArtifactError> {
    if !xml_element_spans(xml, "Relationship")?.iter().any(|span| {
        xml_element_attribute(&xml[span.start..span.end], "Relationship", "Type")
            .ok()
            .flatten()
            .as_deref()
            == Some(relationship_type)
    }) {
        let used = relationship_ids(xml)?;
        let mut id = 1usize;
        while used.contains(&format!("rId{id}")) {
            id += 1;
        }
        let fragment = format!(
            "<Relationship Id=\"rId{id}\" Type=\"{relationship_type}\" Target=\"numbering.xml\"/>"
        );
        *xml = insert_before_root_close(xml, "Relationships", &fragment)?;
        return Ok(true);
    }
    Ok(false)
}

fn relationship_ids(xml: &str) -> Result<BTreeSet<String>, ArtifactError> {
    let mut used = BTreeSet::new();
    for span in xml_element_spans(xml, "Relationship")? {
        if let Some(id) = xml_element_attribute(&xml[span.start..span.end], "Relationship", "Id")? {
            used.insert(id);
        }
    }
    Ok(used)
}

fn ensure_numbering_content_type(
    xml: &mut String,
    content_type: &str,
) -> Result<bool, ArtifactError> {
    for span in xml_element_spans(xml, "Override")? {
        if xml_element_attribute(&xml[span.start..span.end], "Override", "PartName")?.as_deref()
            == Some("/word/numbering.xml")
        {
            if xml_element_attribute(&xml[span.start..span.end], "Override", "ContentType")?
                .as_deref()
                == Some(content_type)
            {
                return Ok(false);
            }
            let changed = set_attribute_on_first_tag(
                &xml[span.start..span.end],
                "Override",
                "ContentType",
                content_type,
            )?;
            xml.replace_range(span.start..span.end, &changed);
            return Ok(true);
        }
    }
    let fragment =
        format!("<Override PartName=\"/word/numbering.xml\" ContentType=\"{content_type}\"/>");
    *xml = insert_before_root_close(xml, "Types", &fragment)?;
    Ok(true)
}

fn ensure_optional_asset_relationship(
    xml: &mut String,
    relationship_type: &str,
    target: &str,
    part: &str,
) -> Result<bool, ArtifactError> {
    let mut matches = Vec::<(String, String)>::new();
    for span in xml_element_spans(xml, "Relationship")? {
        let block = &xml[span.start..span.end];
        if xml_element_attribute(block, "Relationship", "Type")?.as_deref()
            == Some(relationship_type)
        {
            matches.push((
                xml_element_attribute(block, "Relationship", "Target")?.unwrap_or_default(),
                xml_element_attribute(block, "Relationship", "TargetMode")?.unwrap_or_default(),
            ));
        }
    }
    if matches.len() > 1 {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("target has duplicate relationships for {part}"),
        ));
    }
    if let Some((existing_target, target_mode)) = matches.first() {
        if target_mode == "External" || existing_target.replace('\\', "/") != target {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("target has a conflicting relationship for {part}"),
            ));
        }
        return Ok(false);
    }
    let used = relationship_ids(xml)?;
    let mut id = 1usize;
    while used.contains(&format!("rId{id}")) {
        id += 1;
    }
    let fragment = format!(
        "<Relationship Id=\"rId{id}\" Type=\"{}\" Target=\"{}\"/>",
        escape_xml_attribute(relationship_type),
        escape_xml_attribute(target)
    );
    *xml = insert_before_root_close(xml, "Relationships", &fragment)?;
    Ok(true)
}

fn ensure_optional_asset_content_type(
    xml: &mut String,
    part: &str,
    content_type: &str,
) -> Result<bool, ArtifactError> {
    let part_name = format!("/{part}");
    let mut found = None;
    for span in xml_element_spans(xml, "Override")? {
        if xml_element_attribute(&xml[span.start..span.end], "Override", "PartName")?.as_deref()
            == Some(part_name.as_str())
        {
            if found.is_some() {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("target has duplicate content type overrides for {part}"),
                ));
            }
            found = Some(span);
        }
    }
    if let Some(span) = found {
        if xml_element_attribute(&xml[span.start..span.end], "Override", "ContentType")?.as_deref()
            == Some(content_type)
        {
            return Ok(false);
        }
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("target has a conflicting content type override for {part}"),
        ));
    }
    let fragment = format!(
        "<Override PartName=\"{}\" ContentType=\"{}\"/>",
        escape_xml_attribute(&part_name),
        escape_xml_attribute(content_type)
    );
    *xml = insert_before_root_close(xml, "Types", &fragment)?;
    Ok(true)
}

fn resolve_revision_markup(xml: &str, operation: &str) -> Result<(String, usize), ArtifactError> {
    let mut updated = xml.to_string();
    let mut count = 0usize;
    for kind in ["ins", "del", "moveFrom", "moveTo"] {
        let keep = match operation {
            "accept" => matches!(kind, "ins" | "moveTo"),
            _ => matches!(kind, "del" | "moveFrom"),
        };
        let tag = format!("w:{kind}");
        let found = count_xml_start_tags(&updated, &tag);
        if found == 0 {
            continue;
        }
        if keep {
            for _ in 0..found {
                let (unwrapped, changed) = unwrap_first_xml_element(
                    &updated,
                    &tag,
                    operation == "reject" && matches!(kind, "del" | "moveFrom"),
                )?;
                if !changed {
                    break;
                }
                updated = unwrapped;
            }
        } else {
            let (cleaned, _) = remove_xml_element(&updated, &tag)?;
            updated = cleaned;
        }
        count += found;
    }
    for tag in [
        "w:moveFromRangeStart",
        "w:moveFromRangeEnd",
        "w:moveToRangeStart",
        "w:moveToRangeEnd",
    ] {
        let found = count_xml_start_tags(&updated, tag);
        if found > 0 {
            let (cleaned, _) = remove_xml_element(&updated, tag)?;
            updated = cleaned;
            count += found;
        }
    }
    Ok((updated, count))
}

fn count_xml_start_tags(xml: &str, tag: &str) -> usize {
    let opening = format!("<{tag}");
    let mut cursor = 0usize;
    let mut count = 0usize;
    while let Some(offset) = xml[cursor..].find(&opening) {
        let start = cursor + offset;
        let after_name = start + opening.len();
        if xml[after_name..].chars().next().is_none_or(|character| {
            character.is_ascii_whitespace() || matches!(character, '/' | '>')
        }) {
            count += 1;
        }
        cursor = after_name;
    }
    count
}

fn unwrap_first_xml_element(
    xml: &str,
    tag: &str,
    convert_deleted_text: bool,
) -> Result<(String, bool), ArtifactError> {
    let opening = format!("<{tag}");
    let closing = format!("</{tag}>");
    let mut search_from = 0usize;
    loop {
        let Some(relative_start) = xml[search_from..].find(&opening) else {
            return Ok((xml.to_string(), false));
        };
        let start = search_from + relative_start;
        let after_name = start + opening.len();
        if xml[after_name..].chars().next().is_some_and(|character| {
            !character.is_ascii_whitespace() && !matches!(character, '/' | '>')
        }) {
            search_from = after_name;
            continue;
        }
        let open_end = find_xml_tag_end(xml, start).ok_or_else(|| {
            ArtifactError::new("invalid_ooxml_xml", format!("unterminated {tag} element"))
        })?;
        if xml[start..open_end].trim_end().ends_with('/') {
            let mut result = String::with_capacity(xml.len());
            result.push_str(&xml[..start]);
            result.push_str(&xml[open_end + 1..]);
            return Ok((result, true));
        }
        let mut cursor = open_end + 1;
        let mut depth = 1usize;
        let mut close_start = None;
        while let Some(relative_tag) = xml[cursor..].find('<') {
            let tag_start = cursor + relative_tag;
            if xml[tag_start..].starts_with(&closing) {
                depth -= 1;
                if depth == 0 {
                    close_start = Some(tag_start);
                    break;
                }
                cursor = tag_start + closing.len();
                continue;
            }
            if xml[tag_start..].starts_with(&opening) {
                let next = tag_start + opening.len();
                if xml[next..].chars().next().is_none_or(|character| {
                    character.is_ascii_whitespace() || matches!(character, '/' | '>')
                }) {
                    let nested_end = find_xml_tag_end(xml, tag_start).ok_or_else(|| {
                        ArtifactError::new(
                            "invalid_ooxml_xml",
                            format!("unterminated {tag} element"),
                        )
                    })?;
                    if !xml[tag_start..nested_end].trim_end().ends_with('/') {
                        depth += 1;
                    }
                    cursor = nested_end + 1;
                    continue;
                }
            }
            cursor = tag_start + 1;
        }
        let close_start = close_start.ok_or_else(|| {
            ArtifactError::new(
                "invalid_ooxml_xml",
                format!("missing closing {tag} element"),
            )
        })?;
        let end = close_start + closing.len();
        let mut inner = xml[open_end + 1..close_start].to_string();
        if convert_deleted_text {
            inner = inner
                .replace("<w:delText", "<w:t")
                .replace("</w:delText>", "</w:t>");
        }
        let mut result = String::with_capacity(xml.len());
        result.push_str(&xml[..start]);
        result.push_str(&inner);
        result.push_str(&xml[end..]);
        return Ok((result, true));
    }
}

fn find_xml_tag_end(xml: &str, start: usize) -> Option<usize> {
    let mut quote = None;
    for (offset, character) in xml[start..].char_indices() {
        if let Some(active_quote) = quote {
            if character == active_quote {
                quote = None;
            }
        } else if matches!(character, '\'' | '"') {
            quote = Some(character);
        } else if character == '>' {
            return Some(start + offset);
        }
    }
    None
}

fn text_replace_command(args: &[String]) -> Result<Value, ArtifactError> {
    let mut input = None;
    let mut output = None;
    let mut replacements = Vec::new();
    let mut replace_all = false;
    let mut index = 0usize;
    while index < args.len() {
        match args[index].as_str() {
            "--json" => index += 1,
            "--all" => {
                replace_all = true;
                index += 1;
            }
            "--input" | "--output" | "--replace" => {
                let flag = args[index].as_str();
                let value = args.get(index + 1).ok_or_else(|| {
                    ArtifactError::new("invalid_arguments", format!("{flag} requires a value"))
                })?;
                match flag {
                    "--input" => input = Some(value.clone()),
                    "--output" => output = Some(value.clone()),
                    _ => replacements.push(parse_text_replacement(value)?),
                }
                index += 2;
            }
            other => {
                return Err(ArtifactError::new(
                    "invalid_arguments",
                    format!("unknown flag: {other}"),
                ));
            }
        }
    }
    let input =
        input.ok_or_else(|| ArtifactError::new("invalid_arguments", "--input is required"))?;
    let output =
        output.ok_or_else(|| ArtifactError::new("invalid_arguments", "--output is required"))?;
    if replacements.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "provide at least one --replace OLD=NEW",
        ));
    }
    let mut first_done = vec![false; replacements.len()];
    let mut replacements_applied = 0usize;
    let mut modified_parts = Vec::new();
    let mut skipped_matches = Vec::new();
    let output_path = rewrite_docx_package(&input, &output, |name, bytes| {
        if is_text_replacement_story_part(name) {
            let xml = String::from_utf8(bytes.clone())
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
            let (replaced, count, skipped) =
                replace_docx_text_in_story(&xml, name, &replacements, replace_all, &mut first_done);
            if count > 0 {
                *bytes = replaced.into_bytes();
                replacements_applied += count;
                modified_parts.push(name.to_string());
            }
            skipped_matches.extend(skipped);
        }
        Ok(())
    })?;
    Ok(json!({
        "ok": true,
        "input": input,
        "output": output_path,
        "replacementsApplied": replacements_applied,
        "modifiedParts": modified_parts,
        "mode": if replace_all { "all" } else { "first per requested value" },
        "skippedMatches": skipped_matches,
        "limitations": [
            "text matches cannot cross paragraph boundaries",
            "paragraphs with structural OOXML boundaries are skipped when they contain a requested match"
        ]
    }))
}

fn parse_text_replacement(value: &str) -> Result<(String, String), ArtifactError> {
    let Some((old, new)) = value.split_once('=') else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--replace must be formatted as OLD=NEW",
        ));
    };
    if old.is_empty() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "OLD text must not be empty",
        ));
    }
    Ok((old.to_string(), new.to_string()))
}

fn is_text_replacement_story_part(name: &str) -> bool {
    name == "word/document.xml"
        || (name.starts_with("word/header") || name.starts_with("word/footer"))
            && name.ends_with(".xml")
            && !name["word/".len()..].contains('/')
}

fn replace_docx_text_in_story(
    xml: &str,
    part: &str,
    replacements: &[(String, String)],
    replace_all: bool,
    first_done: &mut [bool],
) -> (String, usize, Vec<Value>) {
    let mut output = String::with_capacity(xml.len());
    let mut cursor = 0usize;
    let mut total = 0usize;
    let mut skipped = Vec::new();
    for (paragraph_index, (offset, original_paragraph)) in
        ordered_docx_blocks(xml, "w:p").into_iter().enumerate()
    {
        output.push_str(&xml[cursor..offset]);
        cursor = offset + original_paragraph.len();
        let mut paragraph = original_paragraph;
        let text_blocks = ordered_docx_blocks(&paragraph, "w:t");
        let mut values = text_blocks
            .iter()
            .map(|(_, block)| ooxml::text_values(block, "w:t").join(""))
            .collect::<Vec<_>>();
        let mut paragraph_changed = false;
        for (replacement_index, (old, new)) in replacements.iter().enumerate() {
            if !replace_all && first_done[replacement_index] {
                continue;
            }
            let mut replaced_this_value = false;
            let mut search_from = 0usize;
            loop {
                let combined = values.join("");
                let Some(start) = combined[search_from..]
                    .find(old)
                    .map(|offset| offset + search_from)
                else {
                    break;
                };
                let boundaries = replacement_boundaries(&paragraph);
                if !boundaries.is_empty() {
                    skipped.push(json!({
                        "part": part,
                        "paragraphIndex": paragraph_index,
                        "old": old,
                        "reason": format!("paragraph contains structural boundary: {}", boundaries.join(", ")),
                    }));
                    break;
                }
                replace_text_span(&mut values, start, start + old.len(), new);
                total += 1;
                paragraph_changed = true;
                replaced_this_value = true;
                first_done[replacement_index] = true;
                if !replace_all {
                    break;
                }
                search_from = start + new.len();
                if search_from > values.iter().map(String::len).sum::<usize>() {
                    break;
                }
            }
            if replaced_this_value && !replace_all {
                continue;
            }
        }
        if paragraph_changed {
            let mut updated = String::with_capacity(paragraph.len());
            let mut block_cursor = 0usize;
            for (index, (block_offset, block)) in text_blocks.iter().enumerate() {
                updated.push_str(&paragraph[block_cursor..*block_offset]);
                updated.push_str(&replace_text_block(block, &values[index]));
                block_cursor = *block_offset + block.len();
            }
            updated.push_str(&paragraph[block_cursor..]);
            paragraph = updated;
        }
        output.push_str(&paragraph);
    }
    output.push_str(&xml[cursor..]);
    (output, total, skipped)
}

fn replacement_boundaries(paragraph: &str) -> Vec<String> {
    const BOUNDARIES: &[&str] = &[
        "fldChar",
        "fldSimple",
        "instrText",
        "delInstrText",
        "commentRangeStart",
        "commentRangeEnd",
        "commentReference",
        "ins",
        "del",
        "moveFrom",
        "moveTo",
        "moveFromRangeStart",
        "moveFromRangeEnd",
        "moveToRangeStart",
        "moveToRangeEnd",
        "customXmlDelRangeStart",
        "customXmlDelRangeEnd",
        "customXmlInsRangeStart",
        "customXmlInsRangeEnd",
        "bookmarkStart",
        "bookmarkEnd",
        "drawing",
        "pict",
        "object",
        "tab",
        "ptab",
        "br",
        "cr",
        "lastRenderedPageBreak",
        "footnoteReference",
        "endnoteReference",
        "hyperlink",
        "sdt",
        "sdtContent",
        "proofErr",
        "permStart",
        "permEnd",
        "altChunk",
        "sym",
    ];
    BOUNDARIES
        .iter()
        .filter(|name| xml_contains_tag(paragraph, &format!("w:{name}")))
        .map(|name| format!("w:{name}"))
        .collect()
}

fn xml_contains_tag(xml: &str, tag: &str) -> bool {
    let opening = format!("<{tag}");
    let mut cursor = 0usize;
    while let Some(offset) = xml[cursor..].find(&opening) {
        let start = cursor + offset + opening.len();
        if xml[start..].chars().next().is_none_or(|character| {
            character.is_ascii_whitespace() || matches!(character, '/' | '>')
        }) {
            return true;
        }
        cursor = start;
    }
    false
}

fn replace_text_span(values: &mut [String], start: usize, end: usize, replacement: &str) {
    let mut offset = 0usize;
    for value in values {
        let original = value.clone();
        let node_start = offset;
        let node_end = node_start + original.len();
        offset = node_end;
        if node_end <= start || node_start >= end {
            continue;
        }
        let local_start = start.saturating_sub(node_start).min(original.len());
        let local_end = end.saturating_sub(node_start).min(original.len());
        let inserted = if node_start <= start && start < node_end {
            replacement
        } else {
            ""
        };
        *value = format!(
            "{}{}{}",
            &original[..local_start],
            inserted,
            &original[local_end..]
        );
    }
}

fn replace_text_block(block: &str, text: &str) -> String {
    let Some(open_end) = block.find('>') else {
        return block.to_string();
    };
    let Some(close_start) = block.rfind("</w:t>") else {
        return block.to_string();
    };
    let mut opening = block[..=open_end].to_string();
    if text.starts_with(char::is_whitespace) || text.ends_with(char::is_whitespace) {
        if !opening.contains("xml:space=") {
            opening.insert_str(opening.len() - 1, " xml:space=\"preserve\"");
        }
    }
    format!(
        "{}{}{}",
        opening,
        escape_xml_text(text),
        &block[close_start..]
    )
}

fn escape_xml_text(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn rsid_strip_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "output" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let mut removed = 0usize;
    let mut parts_changed = Vec::new();
    let output = rewrite_docx_package(
        cli::required_flag(&flags, "input")?,
        cli::required_flag(&flags, "output")?,
        |name, bytes| {
            if is_rsid_story_part(name) {
                let xml = String::from_utf8(bytes.clone())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                let (cleaned, count) = remove_rsid_attributes(&xml);
                if count > 0 {
                    *bytes = cleaned.into_bytes();
                    removed += count;
                    parts_changed.push(name.to_string());
                }
            }
            Ok(())
        },
    )?;
    Ok(json!({
        "ok": true,
        "input": cli::required_flag(&flags, "input")?,
        "output": output,
        "rsidAttributesRemoved": removed,
        "partsChanged": parts_changed,
        "limitations": [
            "removes rsid attributes from document, header, footer, footnote, and endnote parts only",
            "does not redact in-document personal information or remove custom properties"
        ]
    }))
}

fn is_rsid_story_part(name: &str) -> bool {
    let Some(stem) = name
        .strip_prefix("word/")
        .and_then(|name| name.strip_suffix(".xml"))
    else {
        return false;
    };
    matches!(stem, "document" | "footnotes" | "endnotes")
        || ["header", "footer"].iter().any(|prefix| {
            stem.strip_prefix(prefix).is_some_and(|suffix| {
                !suffix.is_empty() && suffix.chars().all(|c| c.is_ascii_digit())
            })
        })
}

fn remove_rsid_attributes(xml: &str) -> (String, usize) {
    let mut output = String::with_capacity(xml.len());
    let mut cursor = 0usize;
    let mut removed = 0usize;
    while let Some(relative_start) = xml[cursor..].find('<') {
        let start = cursor + relative_start;
        output.push_str(&xml[cursor..start]);
        let suffix = &xml[start..];
        let (terminator, prefix_len) = if suffix.starts_with("<!--") {
            ("-->", 4)
        } else if suffix.starts_with("<![CDATA[") {
            ("]]>", 9)
        } else if suffix.starts_with("<?") {
            ("?>", 2)
        } else if suffix.starts_with("<!") {
            (">", 2)
        } else {
            (">", 1)
        };
        let Some(close_offset) = suffix[prefix_len..].find(terminator) else {
            output.push_str(suffix);
            return (output, removed);
        };
        let close_end = start + prefix_len + close_offset + terminator.len();
        let tag = &xml[start..close_end];
        if !tag.starts_with("</")
            && tag.starts_with('<')
            && !tag.starts_with("<!")
            && !tag.starts_with("<?")
        {
            let (cleaned, count) = strip_rsid_from_tag(tag);
            output.push_str(&cleaned);
            removed += count;
        } else {
            output.push_str(tag);
        }
        cursor = close_end;
    }
    output.push_str(&xml[cursor..]);
    (output, removed)
}

fn strip_rsid_from_tag(tag: &str) -> (String, usize) {
    let Some(content) = tag.strip_prefix('<').and_then(|tag| tag.strip_suffix('>')) else {
        return (tag.to_string(), 0);
    };
    let name_end = content
        .find(char::is_whitespace)
        .unwrap_or_else(|| content.find('/').unwrap_or(content.len()));
    let element_name = &content[..name_end];
    let mut result = format!("<{element_name}");
    let mut cursor = name_end;
    let mut removed = 0usize;
    while cursor < content.len() {
        let segment_start = cursor;
        while cursor < content.len() && content.as_bytes()[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        if cursor >= content.len() || content.as_bytes()[cursor] == b'/' {
            result.push_str(&content[segment_start..]);
            break;
        }
        let name_start = cursor;
        while cursor < content.len()
            && !content.as_bytes()[cursor].is_ascii_whitespace()
            && !matches!(content.as_bytes()[cursor], b'=' | b'/' | b'>')
        {
            cursor += 1;
        }
        if cursor == name_start {
            result.push_str(&content[segment_start..]);
            break;
        }
        let attribute = &content[name_start..cursor];
        while cursor < content.len() && content.as_bytes()[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        if cursor < content.len() && content.as_bytes()[cursor] == b'=' {
            cursor += 1;
            while cursor < content.len() && content.as_bytes()[cursor].is_ascii_whitespace() {
                cursor += 1;
            }
            if cursor < content.len() && matches!(content.as_bytes()[cursor], b'\'' | b'"') {
                let quote = content.as_bytes()[cursor];
                cursor += 1;
                while cursor < content.len() && content.as_bytes()[cursor] != quote {
                    cursor += 1;
                }
                cursor = (cursor + 1).min(content.len());
            } else {
                while cursor < content.len()
                    && !content.as_bytes()[cursor].is_ascii_whitespace()
                    && content.as_bytes()[cursor] != b'/'
                {
                    cursor += 1;
                }
            }
        }
        if attribute.starts_with("w:rsid") {
            removed += 1;
        } else {
            result.push_str(&content[segment_start..cursor]);
        }
    }
    result.push('>');
    (result, removed)
}

fn publishing_controls_remove_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(
            flag.as_str(),
            "input" | "output" | "kind" | "text" | "--json"
        ) {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let kind = cli::required_flag(&flags, "kind")?;
    if !matches!(kind, "watermark" | "protection") {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--kind must be watermark or protection",
        ));
    }
    let text = flags
        .iter()
        .find_map(|(flag, value)| (flag == "text").then_some(value.as_deref()).flatten());
    if kind == "protection" && text.is_some() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--text applies only when --kind=watermark",
        ));
    }
    let mut removed = 0usize;
    let mut modified_parts = Vec::new();
    let output = rewrite_docx_package(
        cli::required_flag(&flags, "input")?,
        cli::required_flag(&flags, "output")?,
        |name, bytes| {
            if kind == "protection" && name == "word/settings.xml" {
                let xml = String::from_utf8(bytes.clone())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                let (cleaned, changed) = remove_xml_element(&xml, "w:documentProtection")?;
                if changed {
                    *bytes = cleaned.into_bytes();
                    removed += 1;
                    modified_parts.push(name.to_string());
                }
            } else if kind == "watermark"
                && name.starts_with("word/")
                && name.ends_with(".xml")
                && !name.starts_with("word/theme/")
            {
                let xml = String::from_utf8(bytes.clone())
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                let (cleaned, count) = remove_matching_watermark_picts(&xml, text)?;
                if count > 0 {
                    *bytes = cleaned.into_bytes();
                    removed += count;
                    modified_parts.push(name.to_string());
                }
            }
            Ok(())
        },
    )?;
    if removed == 0 {
        let _ = fs::remove_file(&output);
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("no matching {kind} control was found"),
        ));
    }
    Ok(json!({
        "ok": true,
        "kind": kind,
        "input": cli::required_flag(&flags, "input")?,
        "output": output,
        "removed": removed,
        "modifiedParts": modified_parts,
    }))
}

fn remove_matching_watermark_picts(
    xml: &str,
    requested_text: Option<&str>,
) -> Result<(String, usize), ArtifactError> {
    let mut matches = Vec::<(usize, usize, String)>::new();
    for (offset, pict) in ordered_docx_blocks(xml, "w:pict") {
        let matched = ooxml::elements(&pict, "v:textpath")
            .iter()
            .any(|attributes| {
                let label = attributes
                    .get("string")
                    .map(String::as_str)
                    .unwrap_or_default();
                !label.is_empty() && requested_text.is_none_or(|requested| requested == label)
            });
        if matched {
            matches.push((offset, offset + pict.len(), pict));
        }
    }
    if matches.is_empty() {
        return Ok((xml.to_string(), 0));
    }
    let mut result = String::with_capacity(xml.len());
    let mut cursor = 0usize;
    for (start, end, _) in &matches {
        result.push_str(&xml[cursor..*start]);
        cursor = *end;
    }
    result.push_str(&xml[cursor..]);
    Ok((result, matches.len()))
}

fn inspect_review_markup_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "kind" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let kind = cli::required_flag(&flags, "kind")?;
    if !matches!(kind, "comments" | "revisions") {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--kind must be comments or revisions",
        ));
    }
    inspect_review_markup(cli::required_flag(&flags, "input")?, kind)
}

fn inspect_review_markup(input_path: &str, kind: &str) -> Result<Value, ArtifactError> {
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !source.is_file()
        || !source
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular .docx file",
        ));
    }
    validate_docx_package(source.to_string_lossy().as_ref())?;
    let file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let document = read_docx_part(&mut archive, "word/document.xml")?;
    let records = if kind == "comments" {
        let mut anchors = BTreeMap::<String, [usize; 3]>::new();
        for (tag, index) in [
            ("w:commentRangeStart", 0),
            ("w:commentRangeEnd", 1),
            ("w:commentReference", 2),
        ] {
            for attributes in ooxml::elements(&document, tag) {
                if let Some(id) = attributes.get("w:id") {
                    anchors.entry(id.clone()).or_default()[index] += 1;
                }
            }
        }
        let comments = match archive.by_name("word/comments.xml") {
            Ok(mut entry) => {
                let mut bytes = Vec::new();
                entry
                    .by_ref()
                    .take(MAX_DOCX_PART_BYTES + 1)
                    .read_to_end(&mut bytes)
                    .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
                if bytes.len() as u64 > MAX_DOCX_PART_BYTES {
                    return Err(ArtifactError::new(
                        "ooxml_part_too_large",
                        "word/comments.xml exceeds the 2 MiB audit limit",
                    ));
                }
                let xml = String::from_utf8(bytes)
                    .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
                ooxml::blocks(&xml, "w:comment")
                    .into_iter()
                    .map(|comment| {
                        let attributes = ooxml::elements(&comment, "w:comment")
                            .into_iter()
                            .next()
                            .unwrap_or_default();
                        let id = attributes.get("w:id").cloned().unwrap_or_default();
                        let counts = anchors.get(&id).copied().unwrap_or_default();
                        json!({
                            "id": id,
                            "author": attributes.get("w:author").cloned().unwrap_or_default(),
                            "initials": attributes.get("w:initials").cloned().unwrap_or_default(),
                            "date": attributes.get("w:date").cloned().unwrap_or_default(),
                            "text": ooxml::text_values(&comment, "w:t").join(""),
                            "anchors": {
                                "rangeStarts": counts[0],
                                "rangeEnds": counts[1],
                                "references": counts[2],
                            }
                        })
                    })
                    .collect::<Vec<_>>()
            }
            Err(zip::result::ZipError::FileNotFound) => Vec::new(),
            Err(error) => {
                return Err(ArtifactError::new(
                    "invalid_ooxml_package",
                    error.to_string(),
                ));
            }
        };
        comments
    } else {
        let parts = archive
            .file_names()
            .filter(|name| name.starts_with("word/") && name.ends_with(".xml"))
            .map(str::to_owned)
            .collect::<Vec<_>>();
        let mut revisions = Vec::new();
        for part in parts {
            let xml = match read_docx_part(&mut archive, &part) {
                Ok(xml) => xml,
                Err(error) if error.code == "invalid_ooxml_package" => continue,
                Err(error) => return Err(error),
            };
            for tag in ["ins", "del", "moveFrom", "moveTo"] {
                let tag_name = format!("w:{tag}");
                for revision in ooxml::blocks(&xml, &tag_name) {
                    let attributes = ooxml::elements(&revision, &tag_name)
                        .into_iter()
                        .next()
                        .unwrap_or_default();
                    let mut text = ooxml::text_values(&revision, "w:t");
                    text.extend(ooxml::text_values(&revision, "w:delText"));
                    revisions.push(json!({
                        "part": part,
                        "kind": tag,
                        "id": attributes.get("w:id").cloned().unwrap_or_default(),
                        "author": attributes.get("w:author").cloned().unwrap_or_default(),
                        "date": attributes.get("w:date").cloned().unwrap_or_default(),
                        "text": text.join(""),
                    }));
                }
            }
        }
        revisions
    };
    Ok(json!({
        "ok": true,
        "kind": kind,
        "input": source.to_string_lossy(),
        "records": records,
    }))
}

fn tables_to_csv_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "output-dir" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    tables_to_csv(
        cli::required_flag(&flags, "input")?,
        cli::required_flag(&flags, "output-dir")?,
    )
}

fn tables_to_csv(input_path: &str, output_dir: &str) -> Result<Value, ArtifactError> {
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !source.is_file()
        || !source
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular .docx file",
        ));
    }
    validate_docx_package(source.to_string_lossy().as_ref())?;
    let file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let document_xml = read_docx_part(&mut archive, "word/document.xml")?;
    let tables = ooxml::blocks(&document_xml, "w:tbl");
    let mut csv_files = Vec::with_capacity(tables.len());
    for table in tables {
        let mut csv = String::from("\u{feff}");
        for row in ooxml::blocks(&table, "w:tr") {
            let cells = ooxml::blocks(&row, "w:tc")
                .iter()
                .map(|cell| ooxml::text_values(cell, "w:t").join(""))
                .map(|cell| csv_cell(&cell))
                .collect::<Vec<_>>();
            csv.push_str(&cells.join(","));
            csv.push_str("\r\n");
        }
        csv_files.push(csv);
    }

    let destination = Path::new(output_dir);
    fs::create_dir_all(destination)
        .map_err(|error| ArtifactError::new("output_error", error.to_string()))?;
    let destination = destination
        .canonicalize()
        .map_err(|error| ArtifactError::new("output_error", error.to_string()))?;
    let outputs = (1..=csv_files.len())
        .map(|index| destination.join(format!("table-{index}.csv")))
        .collect::<Vec<_>>();
    if let Some(collision) = outputs.iter().find(|path| path.exists()) {
        return Err(ArtifactError::new(
            "output_exists",
            format!("output already exists: {}", collision.display()),
        ));
    }

    let mut created = Vec::new();
    for (path, contents) in outputs.iter().zip(csv_files.iter()) {
        let write_result = (|| {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(path)
                .map_err(|error| ArtifactError::new("output_error", error.to_string()))?;
            created.push(path.clone());
            file.write_all(contents.as_bytes())
                .map_err(|error| ArtifactError::new("output_error", error.to_string()))?;
            file.sync_all()
                .map_err(|error| ArtifactError::new("output_error", error.to_string()))
        })();
        if let Err(error) = write_result {
            for created_path in &created {
                let _ = fs::remove_file(created_path);
            }
            return Err(error);
        }
    }
    Ok(json!({
        "ok": true,
        "outputs": outputs.iter().map(|path| path.to_string_lossy()).collect::<Vec<_>>(),
        "count": outputs.len(),
    }))
}

fn csv_cell(value: &str) -> String {
    if value
        .chars()
        .any(|character| matches!(character, ',' | '"' | '\r' | '\n'))
    {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn style_lint_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    style_lint_docx(cli::required_flag(&flags, "input")?)
}

fn style_lint_docx(input_path: &str) -> Result<Value, ArtifactError> {
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !source.is_file()
        || !source
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular .docx file",
        ));
    }
    validate_docx_package(source.to_string_lossy().as_ref())?;
    let file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let document_xml = read_docx_part(&mut archive, "word/document.xml")?;

    let paragraphs = ooxml::blocks(&document_xml, "w:p");
    let mut direct_formatting = 0;
    let mut formatted_runs = 0;
    let mut heading_paragraphs = Vec::new();
    let mut fonts = BTreeMap::<String, usize>::new();
    for (index, paragraph) in paragraphs.iter().enumerate() {
        let ppr = ooxml::blocks(paragraph, "w:pPr");
        let paragraph_direct = ppr
            .first()
            .is_some_and(|properties| has_non_style_direct_child(properties, "w:pPr"));
        let runs = ooxml::blocks(paragraph, "w:r");
        let mut run_direct = false;
        for run in runs {
            let rpr = ooxml::blocks(&run, "w:rPr");
            let Some(properties) = rpr.first() else {
                continue;
            };
            run_direct |= has_non_style_direct_child(properties, "w:rPr");
            for attributes in ooxml::elements(properties, "w:rFonts") {
                for attribute in ["w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"] {
                    if let Some(font) = attributes.get(attribute) {
                        *fonts.entry(font.clone()).or_default() += 1;
                    }
                }
            }
        }
        if paragraph_direct || run_direct {
            direct_formatting += 1;
        }
        if run_direct {
            formatted_runs += 1;
        }

        let text = ooxml::text_values(paragraph, "w:t").join("");
        let style_name = ooxml::elements(paragraph, "w:pStyle")
            .first()
            .and_then(|attributes| attributes.get("w:val"))
            .cloned()
            .unwrap_or_default();
        if !text.trim().is_empty() && style_name.to_ascii_lowercase().starts_with("heading") {
            heading_paragraphs.push(json!({
                "index": index,
                "style": style_name,
                "text": text.chars().take(160).collect::<String>(),
            }));
        }
    }

    Ok(json!({
        "ok": true,
        "format": "docx",
        "input": source.to_string_lossy(),
        "summary": {
            "paragraphs": paragraphs.len(),
            "paragraphsWithDirectFormatting": direct_formatting,
            "paragraphsWithRunOverrides": formatted_runs,
            "headingParagraphs": heading_paragraphs.len(),
        },
        "fonts": fonts,
        "headingParagraphs": heading_paragraphs,
    }))
}

fn has_non_style_direct_child(xml: &str, parent: &str) -> bool {
    let open = format!("<{parent}");
    let Some(open_start) = xml.find(&open) else {
        return false;
    };
    let Some(open_end_offset) = xml[open_start..].find('>') else {
        return false;
    };
    let content_start = open_start + open_end_offset + 1;
    let closing = format!("</{parent}>");
    let Some(close_offset) = xml[content_start..].find(&closing) else {
        return false;
    };
    let content = &xml[content_start..content_start + close_offset];
    let mut depth = 0usize;
    let mut cursor = 0usize;
    while let Some(offset) = content[cursor..].find('<') {
        let start = cursor + offset;
        if content[start..].starts_with("<!--") {
            let Some(end) = content[start..].find("-->") else {
                break;
            };
            cursor = start + end + 3;
            continue;
        }
        let Some(end_offset) = content[start..].find('>') else {
            break;
        };
        let end = start + end_offset;
        let tag_contents = &content[start + 1..end];
        if let Some(name) = tag_contents.strip_prefix('/') {
            if depth > 0 {
                depth -= 1;
            }
            cursor = end + 1;
            let _ = name;
            continue;
        }
        if tag_contents.starts_with('!') || tag_contents.starts_with('?') {
            cursor = end + 1;
            continue;
        }
        let name = tag_contents
            .split(|character: char| character.is_ascii_whitespace() || character == '/')
            .next()
            .unwrap_or_default();
        let self_closing = tag_contents.trim_end().ends_with('/');
        if depth == 0 && name != "w:pStyle" && name != "w:rStyle" {
            return true;
        }
        if !self_closing {
            depth += 1;
        }
        cursor = end + 1;
    }
    false
}

fn read_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    read_docx(cli::required_flag(&flags, "input")?)
}

pub(super) fn read_docx(input_path: &str) -> Result<Value, ArtifactError> {
    validate_docx_package(input_path)?;
    let file = File::open(input_path)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let document_xml = read_docx_part(&mut archive, "word/document.xml")?;
    let mut result = ooxml::read_ooxml("docx", input_path)?;
    let diagnostics = advanced_content_diagnostics(input_path)?;
    if let Some(object) = result.as_object_mut() {
        object.insert(
            "items".to_string(),
            Value::Array(docx_items_in_order(&document_xml)),
        );
        if let Some(existing) = object.get_mut("diagnostics").and_then(Value::as_array_mut) {
            existing.extend(diagnostics);
        }
        let editable = object
            .get("diagnostics")
            .and_then(Value::as_array)
            .is_none_or(Vec::is_empty);
        object.insert("editable".to_string(), Value::Bool(editable));
    }
    Ok(result)
}

fn audit_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    audit_docx(cli::required_flag(&flags, "input")?)
}

fn audit_docx(input_path: &str) -> Result<Value, ArtifactError> {
    validate_docx_package(input_path)?;

    let file = File::open(input_path).map_err(|error| {
        ArtifactError::new(
            "ooxml_read_error",
            format!("failed to read {input_path}: {error}"),
        )
    })?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let document_xml = read_docx_part(&mut archive, "word/document.xml")?;
    let mut findings = Vec::new();
    let mut diagnostics = Vec::new();
    if let Some(unsupported) = read_docx(input_path)?
        .get("diagnostics")
        .and_then(Value::as_array)
    {
        diagnostics.extend(unsupported.iter().cloned());
    }

    let mut previous_heading = 0;
    for (index, paragraph) in ooxml::blocks(&document_xml, "w:p").iter().enumerate() {
        let level = heading_level(paragraph);
        if let Some(level) = level {
            if level > previous_heading + 1 {
                findings.push(json!({
                    "code": "heading_level_skip",
                    "severity": "warning",
                    "part": "word/document.xml",
                    "index": index,
                    "message": format!("heading level {level} follows level {previous_heading}; use consecutive heading levels"),
                }));
            }
            previous_heading = level;
        }
    }

    for (index, attributes) in ooxml::elements(&document_xml, "wp:docPr")
        .into_iter()
        .enumerate()
    {
        if attributes
            .get("descr")
            .is_none_or(|description| description.trim().is_empty())
        {
            findings.push(json!({
                "code": "image_missing_alt_text",
                "severity": "warning",
                "part": "word/document.xml",
                "index": index,
                "message": "image is missing alternative text",
            }));
        }
    }

    for (index, hyperlink) in ooxml::blocks(&document_xml, "w:hyperlink")
        .iter()
        .enumerate()
    {
        let link_text = ooxml::text_values(hyperlink, "w:t").join("");
        if weak_link_text(&link_text) {
            findings.push(json!({
                "code": "weak_link_text",
                "severity": "warning",
                "part": "word/document.xml",
                "index": index,
                "message": "link text does not describe its destination",
            }));
        }
    }

    for (index, table) in ooxml::blocks(&document_xml, "w:tbl").iter().enumerate() {
        let has_header = first_row_has_table_header(table);
        if !has_header {
            findings.push(json!({
                "code": "table_missing_header_row",
                "severity": "warning",
                "part": "word/document.xml",
                "index": index,
                "message": "table does not mark its first row as a repeating header",
            }));
        }
    }

    let finding_count = findings.len();
    let warning_count = findings
        .iter()
        .filter(|finding| finding["severity"] == "warning")
        .count();
    let diagnostic_count = diagnostics.len();
    Ok(json!({
        "ok": true,
        "valid": true,
        "format": "docx",
        "findings": findings,
        "diagnostics": diagnostics,
        "summary": {
            "findings": finding_count,
            "warnings": warning_count,
            "diagnostics": diagnostic_count,
        },
    }))
}

fn first_row_has_table_header(table: &str) -> bool {
    ooxml::blocks(table, "w:tr").first().is_some_and(|row| {
        ooxml::elements(row, "w:tblHeader")
            .iter()
            .any(|attributes| {
                attributes.get("w:val").is_none_or(|value| {
                    !matches!(value.to_ascii_lowercase().as_str(), "0" | "false" | "off")
                })
            })
    })
}

fn heading_level(paragraph: &str) -> Option<usize> {
    let outline_level = ooxml::blocks(paragraph, "w:pPr")
        .first()
        .and_then(|properties| ooxml::elements(properties, "w:outlineLvl").first().cloned())
        .and_then(|attributes| attributes.get("w:val").cloned())
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|level| *level <= 8);
    if let Some(level) = outline_level {
        return Some(level + 1);
    }
    ooxml::elements(paragraph, "w:pStyle")
        .first()
        .and_then(|attributes| attributes.get("w:val"))
        .and_then(|style| style.strip_prefix("Heading"))
        .and_then(|level| level.parse::<usize>().ok())
        .filter(|level| (1..=9).contains(level))
}

fn weak_link_text(text: &str) -> bool {
    matches!(
        text.trim().to_ascii_lowercase().as_str(),
        "click here" | "here" | "link" | "read more" | "learn more" | "this link" | "more"
    )
}

fn docx_items_in_order(xml: &str) -> Vec<Value> {
    let tables = ordered_docx_blocks(xml, "w:tbl");
    let table_ranges = tables
        .iter()
        .map(|(start, block)| *start..*start + block.len())
        .collect::<Vec<_>>();
    let mut table_range_index = 0;
    let mut items = ordered_docx_blocks(xml, "w:p")
        .into_iter()
        .filter_map(|(offset, paragraph)| {
            while table_range_index < table_ranges.len()
                && offset >= table_ranges[table_range_index].end
            {
                table_range_index += 1;
            }
            let inside_table = table_ranges
                .get(table_range_index)
                .is_some_and(|range| range.contains(&offset));
            if inside_table {
                return None;
            }
            let text = ooxml::text_values(&paragraph, "w:t").join("");
            if text.trim().is_empty() {
                return None;
            }
            let item = if let Some(level) = heading_level(&paragraph) {
                json!({"kind": "heading", "text": text, "level": level})
            } else {
                json!({"kind": "paragraph", "text": text})
            };
            Some((offset, item))
        })
        .collect::<Vec<_>>();
    for (offset, table) in tables {
        let rows = ooxml::blocks(&table, "w:tr")
            .into_iter()
            .map(|row| {
                ooxml::blocks(&row, "w:tc")
                    .into_iter()
                    .map(|cell| ooxml::text_values(&cell, "w:t").join(""))
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        if !rows.is_empty() {
            items.push((offset, json!({"kind": "table", "rows": rows})));
        }
    }
    items.sort_by_key(|(offset, _)| *offset);
    items.into_iter().map(|(_, item)| item).collect()
}

fn ordered_docx_blocks(xml: &str, tag: &str) -> Vec<(usize, String)> {
    let mut cursor = 0;
    ooxml::blocks(xml, tag)
        .into_iter()
        .filter_map(|block| {
            let offset = xml[cursor..].find(&block)? + cursor;
            cursor = offset + block.len();
            Some((offset, block))
        })
        .collect()
}

fn privacy_scrub_command(args: &[String]) -> Result<Value, ArtifactError> {
    let flags = cli::parse_flags(args)?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "output" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    let input_path = cli::required_flag(&flags, "input")?;
    let output_path = cli::required_flag(&flags, "output")?;
    scrub_core_properties(input_path, output_path)
}

fn scrub_core_properties(input_path: &str, output_path: &str) -> Result<Value, ArtifactError> {
    let input = Path::new(input_path);
    let output = Path::new(output_path);
    if !output.is_absolute() {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "--output must be an absolute path",
        ));
    }
    if output.exists() {
        return Err(ArtifactError::new(
            "output_exists",
            "output already exists; choose a separate path",
        ));
    }
    let input_canonical = input.canonicalize().map_err(|error| {
        ArtifactError::new(
            "ooxml_read_error",
            format!("failed to resolve input: {error}"),
        )
    })?;
    let output_parent = output.parent().ok_or_else(|| {
        ArtifactError::new(
            "invalid_arguments",
            "output path must have a parent directory",
        )
    })?;
    let output_parent = output_parent.canonicalize().map_err(|error| {
        ArtifactError::new(
            "ooxml_write_error",
            format!("failed to resolve output directory: {error}"),
        )
    })?;
    let output_canonical = output_parent.join(output.file_name().ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "output path must include a file name")
    })?);
    if input_canonical == output_canonical {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input and output paths must be different",
        ));
    }

    let input_metadata = fs::metadata(&input_canonical)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if input_metadata.len() > MAX_DOCX_PACKAGE_BYTES {
        return Err(ArtifactError::new(
            "package_too_large",
            format!(
                "DOCX exceeds the {} MiB operation limit",
                MAX_DOCX_PACKAGE_BYTES / 1024 / 1024
            ),
        ));
    }
    validate_docx_package(input_canonical.to_string_lossy().as_ref())?;

    let file = File::open(&input_canonical)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut entries = Vec::with_capacity(archive.len());
    let mut total_size = 0_u64;
    let mut removed_fields = Vec::new();
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
        let name = entry.name().to_string();
        let is_directory = entry.is_dir();
        let mut bytes = Vec::new();
        if !is_directory {
            entry
                .by_ref()
                .take(MAX_DOCX_PACKAGE_BYTES + 1)
                .read_to_end(&mut bytes)
                .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
            total_size += bytes.len() as u64;
            if total_size > MAX_DOCX_PACKAGE_BYTES {
                return Err(ArtifactError::new(
                    "package_too_large",
                    "uncompressed DOCX content exceeds the 64 MiB operation limit",
                ));
            }
        }
        if name == "docProps/core.xml" {
            let mut xml = String::from_utf8(bytes)
                .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))?;
            for (namespace, local_name, conventional_prefix, field) in [
                (
                    "http://purl.org/dc/elements/1.1/",
                    "creator",
                    "dc",
                    "creator",
                ),
                (
                    "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
                    "lastModifiedBy",
                    "cp",
                    "lastModifiedBy",
                ),
                ("http://purl.org/dc/terms/", "created", "dcterms", "created"),
                (
                    "http://purl.org/dc/terms/",
                    "modified",
                    "dcterms",
                    "modified",
                ),
                (
                    "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
                    "lastPrinted",
                    "cp",
                    "lastPrinted",
                ),
            ] {
                let mut prefixes = namespace_prefixes(&xml, namespace);
                if prefixes.is_empty() {
                    prefixes.push(conventional_prefix.to_string());
                }
                let mut changed = false;
                for prefix in prefixes {
                    let tag = if prefix.is_empty() {
                        local_name.to_string()
                    } else {
                        format!("{prefix}:{local_name}")
                    };
                    let (cleaned, tag_changed) = remove_xml_element(&xml, &tag)?;
                    xml = cleaned;
                    changed |= tag_changed;
                }
                if changed {
                    removed_fields.push(field);
                }
            }
            bytes = xml.into_bytes();
        }
        entries.push((name, is_directory, bytes));
    }

    let output_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&output_canonical)
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
    let write_result = write_docx_archive(output_file, entries);
    if let Err(error) = write_result {
        let _ = fs::remove_file(&output_canonical);
        return Err(error);
    }
    if let Err(error) = validate_docx_package(output_canonical.to_string_lossy().as_ref()) {
        let _ = fs::remove_file(&output_canonical);
        return Err(error);
    }
    let diagnostics = if removed_fields.is_empty() {
        vec![json!({
            "code": "no_core_properties_removed",
            "message": "no listed personal core properties were present",
        })]
    } else {
        Vec::<Value>::new()
    };
    Ok(json!({
        "ok": true,
        "valid": true,
        "format": "docx",
        "output": output_canonical,
        "removedFields": removed_fields,
        "diagnostics": diagnostics,
    }))
}

fn write_docx_archive(
    file: File,
    entries: Vec<(String, bool, Vec<u8>)>,
) -> Result<(), ArtifactError> {
    let mut writer = ZipWriter::new(file);
    for (name, is_directory, bytes) in entries {
        if is_directory {
            writer
                .add_directory(name, SimpleFileOptions::default())
                .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
        } else {
            writer
                .start_file(name, SimpleFileOptions::default())
                .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
            writer
                .write_all(&bytes)
                .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
        }
    }
    writer
        .finish()
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
    Ok(())
}

fn rewrite_docx_package<F>(
    input_path: &str,
    output_path: &str,
    transform: F,
) -> Result<PathBuf, ArtifactError>
where
    F: FnMut(&str, &mut Vec<u8>) -> Result<(), ArtifactError>,
{
    rewrite_docx_package_with_additional_parts(input_path, output_path, Vec::new(), transform)
}

fn rewrite_docx_package_with_additional_parts<F>(
    input_path: &str,
    output_path: &str,
    additional_parts: Vec<(String, Vec<u8>)>,
    mut transform: F,
) -> Result<PathBuf, ArtifactError>
where
    F: FnMut(&str, &mut Vec<u8>) -> Result<(), ArtifactError>,
{
    let source = Path::new(input_path)
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if !source.is_file()
        || !source
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input must be a regular .docx file",
        ));
    }
    let output = Path::new(output_path);
    if !output
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("docx"))
    {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "output must be a different .docx file",
        ));
    }
    let parent = output
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(parent)
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
    let parent = parent
        .canonicalize()
        .map_err(|error| ArtifactError::new("ooxml_write_error", error.to_string()))?;
    let output = parent.join(output.file_name().ok_or_else(|| {
        ArtifactError::new("invalid_arguments", "output path must include a file name")
    })?);
    if source == output {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "input and output paths must be different",
        ));
    }
    let metadata = fs::metadata(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if metadata.len() > MAX_DOCX_PACKAGE_BYTES {
        return Err(ArtifactError::new(
            "package_too_large",
            "DOCX exceeds the 64 MiB operation limit",
        ));
    }
    validate_docx_package(source.to_string_lossy().as_ref())?;
    let file = File::open(&source)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let mut entries = Vec::with_capacity(archive.len());
    let mut total_size = 0u64;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
        let name = entry.name().to_string();
        let is_directory = entry.is_dir();
        let mut contents = Vec::new();
        if !is_directory {
            entry
                .by_ref()
                .take(MAX_DOCX_PACKAGE_BYTES + 1)
                .read_to_end(&mut contents)
                .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
            total_size += contents.len() as u64;
            if total_size > MAX_DOCX_PACKAGE_BYTES {
                return Err(ArtifactError::new(
                    "package_too_large",
                    "uncompressed DOCX content exceeds the 64 MiB operation limit",
                ));
            }
            transform(&name, &mut contents)?;
        }
        entries.push((name, is_directory, contents));
    }
    let existing_parts = entries
        .iter()
        .map(|(name, _, _)| name.clone())
        .collect::<std::collections::HashSet<_>>();
    for (name, contents) in additional_parts {
        if !existing_parts.contains(&name) {
            entries.push((name, false, contents));
        }
    }
    let output_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&output)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                ArtifactError::new(
                    "output_exists",
                    format!("output already exists: {}", output.display()),
                )
            } else {
                ArtifactError::new("ooxml_write_error", error.to_string())
            }
        })?;
    if let Err(error) = write_docx_archive(output_file, entries) {
        let _ = fs::remove_file(&output);
        return Err(error);
    }
    if let Err(error) = validate_docx_package(output.to_string_lossy().as_ref()) {
        let _ = fs::remove_file(&output);
        return Err(error);
    }
    Ok(output)
}

fn remove_xml_element(xml: &str, tag: &str) -> Result<(String, bool), ArtifactError> {
    let opening = format!("<{tag}");
    let closing = format!("</{tag}>");
    let mut output = String::with_capacity(xml.len());
    let mut copy_cursor = 0;
    let mut search_cursor = 0;
    let mut changed = false;
    while let Some(relative_start) = xml[search_cursor..].find('<') {
        let start = search_cursor + relative_start;
        let suffix = &xml[start..];
        let skipped = if suffix.starts_with("<!--") {
            suffix.find("-->").map(|end| end + 3)
        } else if suffix.starts_with("<![CDATA[") {
            suffix.find("]]>").map(|end| end + 3)
        } else if suffix.starts_with("<?") {
            suffix.find("?>").map(|end| end + 2)
        } else {
            None
        };
        if let Some(skipped) = skipped {
            search_cursor = start + skipped;
            continue;
        }
        if !suffix.starts_with(&opening) {
            search_cursor = start + 1;
            continue;
        }
        let after_name = start + opening.len();
        if xml[after_name..].chars().next().is_some_and(|character| {
            !character.is_ascii_whitespace() && character != '>' && character != '/'
        }) {
            search_cursor = after_name;
            continue;
        }
        let open_end = xml[after_name..]
            .find('>')
            .map(|offset| after_name + offset)
            .ok_or_else(|| {
                ArtifactError::new("invalid_ooxml_xml", format!("unterminated {tag} element"))
            })?;
        output.push_str(&xml[copy_cursor..start]);
        if xml[after_name..open_end].trim_end().ends_with('/') {
            copy_cursor = open_end + 1;
        } else {
            let close_start = xml[open_end + 1..]
                .find(&closing)
                .map(|offset| open_end + 1 + offset)
                .ok_or_else(|| {
                    ArtifactError::new(
                        "invalid_ooxml_xml",
                        format!("missing closing {tag} element"),
                    )
                })?;
            copy_cursor = close_start + closing.len();
        }
        search_cursor = copy_cursor;
        changed = true;
    }
    output.push_str(&xml[copy_cursor..]);
    Ok((output, changed))
}

fn namespace_prefixes(xml: &str, namespace_uri: &str) -> Vec<String> {
    let mut prefixes = Vec::new();
    let mut cursor = 0;
    while let Some(relative_start) = xml[cursor..].find('<') {
        let start = cursor + relative_start;
        let suffix = &xml[start..];
        let skipped = if suffix.starts_with("<?") {
            suffix.find("?>").map(|end| end + 2)
        } else if suffix.starts_with("<!--") {
            suffix.find("-->").map(|end| end + 3)
        } else if suffix.starts_with("<!") {
            suffix.find('>').map(|end| end + 1)
        } else {
            None
        };
        if let Some(skipped) = skipped {
            cursor = start + skipped;
            continue;
        }
        let Some(tag_end) = suffix.find('>') else {
            break;
        };
        let end = tag_end + start;
        let attributes = crate::ooxml::parse_attributes(&xml[start + 1..end]);
        for (name, value) in attributes {
            if (name == "xmlns" || name.starts_with("xmlns:")) && value == namespace_uri {
                let prefix = name
                    .strip_prefix("xmlns:")
                    .map(str::to_owned)
                    .unwrap_or_default();
                if !prefixes.contains(&prefix) {
                    prefixes.push(prefix);
                }
            }
        }
        cursor = end + 1;
    }
    prefixes
}

fn read_docx_part<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    part: &str,
) -> Result<String, ArtifactError> {
    let mut entry = archive
        .by_name(part)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let mut bytes = Vec::new();
    entry
        .by_ref()
        .take(MAX_DOCX_PART_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if bytes.len() as u64 > MAX_DOCX_PART_BYTES {
        return Err(ArtifactError::new(
            "ooxml_part_too_large",
            format!("{part} exceeds the 2 MiB audit limit"),
        ));
    }
    String::from_utf8(bytes)
        .map_err(|error| ArtifactError::new("invalid_ooxml_xml", error.to_string()))
}

fn validate_docx_package(path: &str) -> Result<(), ArtifactError> {
    let metadata = fs::metadata(path)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if metadata.len() > MAX_DOCX_PACKAGE_BYTES {
        return Err(ArtifactError::new(
            "package_too_large",
            "DOCX exceeds the 64 MiB operation limit",
        ));
    }
    let file = File::open(path)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    if archive.len() > 8192 {
        return Err(ArtifactError::new(
            "package_too_large",
            "DOCX has more than 8192 package parts",
        ));
    }
    let parts = archive
        .file_names()
        .map(str::to_owned)
        .collect::<std::collections::HashSet<_>>();
    for required in [
        "[Content_Types].xml",
        "_rels/.rels",
        "word/document.xml",
        "word/_rels/document.xml.rels",
        "word/styles.xml",
    ] {
        if !parts.contains(required) {
            return Err(ArtifactError::new(
                "invalid_ooxml_package",
                format!("DOCX package is missing required part: {required}"),
            ));
        }
    }
    let document = archive
        .by_name("word/document.xml")
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    if document.size() > MAX_DOCX_PART_BYTES {
        return Err(ArtifactError::new(
            "ooxml_part_too_large",
            "word/document.xml exceeds the 2 MiB operation limit",
        ));
    }
    Ok(())
}

fn advanced_content_diagnostics(input_path: &str) -> Result<Vec<Value>, ArtifactError> {
    validate_docx_package(input_path)?;
    let file = File::open(input_path)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("invalid_ooxml_package", error.to_string()))?;
    let document_xml = read_docx_part(&mut archive, "word/document.xml")?;
    let parts = archive.file_names().map(str::to_owned).collect::<Vec<_>>();
    let mut diagnostics = Vec::new();
    if document_xml.contains("<w:ins") || document_xml.contains("<w:del") {
        diagnostics.push(json!({
            "code": "tracked_changes_not_editable",
            "part": "word/document.xml",
            "message": "tracked changes are present and are not editable in the current document model",
        }));
    }
    if document_xml.contains("<w:sectPr") {
        diagnostics.push(json!({
            "code": "page_layout_not_editable",
            "part": "word/document.xml",
            "message": "section page settings are not preserved by the current document model",
        }));
    }
    if document_xml.contains("<w:rPr") {
        diagnostics.push(json!({
            "code": "run_formatting_not_editable",
            "part": "word/document.xml",
            "message": "inline text formatting is not preserved by the current document model",
        }));
    }
    let paragraph_formatting = ooxml::blocks(&document_xml, "w:pPr")
        .iter()
        .any(|properties| {
            [
                "w:jc",
                "w:spacing",
                "w:ind",
                "w:keepNext",
                "w:keepLines",
                "w:pageBreakBefore",
                "w:widowControl",
                "w:tabs",
            ]
            .iter()
            .any(|tag| properties.contains(&format!("<{tag}")))
        });
    if paragraph_formatting {
        diagnostics.push(json!({
            "code": "paragraph_formatting_not_editable",
            "part": "word/document.xml",
            "message": "paragraph alignment, spacing, indentation, and pagination controls are not preserved by the current document model",
        }));
    }
    if document_xml.contains("<w:tbl") {
        diagnostics.push(json!({
            "code": "table_formatting_not_editable",
            "part": "word/document.xml",
            "message": "table dimensions, cell formatting, and header semantics are not preserved by the current document model",
        }));
    }
    if document_xml.contains("<w:numPr") || document_xml.contains("<w:sdt") {
        diagnostics.push(json!({
            "code": "structured_content_not_editable",
            "part": "word/document.xml",
            "message": "numbering or content controls are present and are not preserved by the current document model",
        }));
    }
    let custom_styles = ooxml::elements(&document_xml, "w:pStyle")
        .into_iter()
        .filter_map(|attributes| attributes.get("w:val").cloned())
        .filter(|style| {
            style != "Normal"
                && !style
                    .strip_prefix("Heading")
                    .is_some_and(|level| level.parse::<usize>().is_ok_and(|n| (1..=9).contains(&n)))
        })
        .collect::<std::collections::HashSet<_>>();
    if !custom_styles.is_empty() {
        diagnostics.push(json!({
            "code": "custom_styles_not_editable",
            "part": "word/document.xml",
            "message": "custom paragraph styles are not preserved by the current document model",
            "count": custom_styles.len(),
        }));
    }
    for (part, code, label) in [
        ("word/comments.xml", "comments_not_editable", "comments"),
        ("word/footnotes.xml", "footnotes_not_editable", "footnotes"),
        ("word/endnotes.xml", "endnotes_not_editable", "endnotes"),
    ] {
        if parts.iter().any(|name| name == part) {
            diagnostics.push(json!({
                "code": code,
                "part": part,
                "message": format!("{label} are not editable in the current document model"),
            }));
        }
    }
    Ok(diagnostics)
}

#[cfg(test)]
mod tests {
    use super::{
        first_row_has_table_header, namespace_prefixes, remove_xml_element, weak_link_text,
    };

    #[test]
    fn scrub_removal_preserves_comments_and_near_prefix_names() {
        let xml = concat!(
            "<root><!-- keep <dc:creator>comment text</dc:creator> -->",
            "<dc:creatorExtra>keep</dc:creatorExtra>",
            "<dc:creator>remove me</dc:creator><tail>keep</tail></root>"
        );
        let (cleaned, changed) = remove_xml_element(xml, "dc:creator").unwrap();

        assert!(changed);
        assert!(cleaned.contains("<!-- keep <dc:creator>comment text</dc:creator> -->"));
        assert!(cleaned.contains("<dc:creatorExtra>keep</dc:creatorExtra>"));
        assert!(!cleaned.contains("<dc:creator>remove me</dc:creator>"));
        assert!(cleaned.contains("<tail>keep</tail>"));
    }

    #[test]
    fn link_audit_flags_generic_link_text_case_insensitively() {
        assert!(weak_link_text("Click here"));
        assert!(weak_link_text(" read more "));
        assert!(!weak_link_text("Project delivery checklist"));
    }

    #[test]
    fn scrub_discovers_namespace_aliases_on_nested_elements() {
        let xml = concat!(
            "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\">",
            "<meta:lastModifiedBy xmlns:meta=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\">A</meta:lastModifiedBy>",
            "</cp:coreProperties>"
        );

        assert_eq!(
            namespace_prefixes(
                xml,
                "http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
            ),
            vec!["cp".to_string(), "meta".to_string()]
        );
    }

    #[test]
    fn disabled_table_header_markers_do_not_count_as_headers() {
        for value in ["0", "false", "off", "FALSE"] {
            let table = format!(
                "<w:tbl><w:tr><w:trPr><w:tblHeader w:val=\"{value}\"/></w:trPr></w:tr><w:tr/></w:tbl>"
            );
            assert!(!first_row_has_table_header(&table), "value: {value}");
        }
        assert!(first_row_has_table_header(
            "<w:tbl><w:tr><w:trPr><w:tblHeader/></w:trPr></w:tr></w:tbl>"
        ));
        assert!(first_row_has_table_header(
            "<w:tbl><w:tr><w:trPr><w:tblHeader w:val=\"1\"/></w:trPr></w:tr></w:tbl>"
        ));
    }
}
