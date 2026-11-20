use serde_json::{Value, json};
use std::ffi::OsString;

use super::{ArtifactError, print_json};
use super::{docx, pdf, xlsx};

pub fn run_cli<I>(args: I) -> std::process::ExitCode
where
    I: IntoIterator<Item = OsString>,
{
    match run(args.into_iter().skip(1).collect()) {
        Ok(value) => {
            let exit_code = value.get("_exitCode").and_then(Value::as_u64).unwrap_or(0);
            let mut output = value;
            if let Some(map) = output.as_object_mut() {
                map.remove("_exitCode");
            }
            print_json(&output, false);
            std::process::ExitCode::from(exit_code.min(255) as u8)
        }
        Err(error) => {
            print_json(
                &json!({
                    "ok": false,
                    "error": {
                        "code": error.code,
                        "message": error.message,
                    },
                }),
                true,
            );
            std::process::ExitCode::from(1)
        }
    }
}

fn run(args: Vec<OsString>) -> Result<Value, ArtifactError> {
    let args = args
        .into_iter()
        .map(|argument| {
            argument
                .into_string()
                .map_err(|_| ArtifactError::new("invalid_arguments", "arguments must be UTF-8"))
        })
        .collect::<Result<Vec<_>, _>>()?;

    match args.first().map(String::as_str) {
        Some("capabilities") => capabilities(&args[1..]),
        Some("xlsx") => xlsx::run_xlsx(&args[1..]),
        Some("docx") => docx::run_docx(&args[1..]),
        Some("pptx") => super::presentation_helpers::run_pptx(&args[1..]),
        Some("pdf") => pdf::run_pdf(&args[1..]),
        Some(command) => Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown command: {command}"),
        )),
        None => Err(ArtifactError::new(
            "invalid_arguments",
            "a command is required",
        )),
    }
}

fn capabilities(args: &[String]) -> Result<Value, ArtifactError> {
    reject_unknown_flags(args)?;
    Ok(json!({
        "ok": true,
        "commands": {
            "xlsx": ["create", "read", "validate"],
            "docx": ["read", "validate", "audit", "privacy-scrub", "helper"],
            "pptx": ["create", "read", "validate", "helper"],
            "pdf": ["create", "read", "validate"],
        },
        "documentApis": {
            "docx": {
                "authoring": ["Document.create", "Document.load", "exportDocx"],
                "authoringMethods": [
                    "addParagraph", "addHeading", "addTitle", "addSubtitle", "addListItem",
                    "addPageBreak", "addTableOfContents", "addImage", "addTable", "addSection", "setHeader",
                    "setFooter", "setWatermark", "setProtection", "addBookmark", "addInternalLink",
                    "addReferenceField", "addSequenceField", "addExternalLink",
                    "addComment", "addTrackedReplacement", "addFootnote", "addEndnote"
                ],
                "formattingOptions": [
                    "pageSize", "orientation", "margins", "alignment", "spacingBefore",
                    "spacingAfter", "fontFace", "fontSize", "color", "bold", "italic",
                    "keepWithNext", "pageBreakBefore", "headerRow", "borders", "cellPadding",
                    "columnWidths", "width", "indent", "layout"
                ],
                "watermarkOptions": [
                    "font", "fontSize", "bold", "italics", "color", "opacity",
                    "layout", "rotation", "width", "height"
                ],
                "protectionTypes": ["readOnly", "comments", "trackedChanges", "forms"],
                "tableOfContentsOptions": ["title", "headingStyleRange", "hyperlink"],
                "helpers": [
                    "audit-features", "distill-template", "inspect-review-markup",
                    "protection-set", "publishing-controls-remove", "rsid-strip", "style-lint",
                    "style-normalize", "tables-to-csv", "watermark-add", "merge-text",
                    "text-replace", "tracked-process", "redact-text", "merge-append",
                    "template-fidelity", "a11y-fixes", "comments-extract", "content-controls",
                    "comments-manage", "comments-add", "comments-apply-patches",
                    "tracked-add-replacements", "table-geometry-set", "fields-process",
                    "reference-fields-insert", "captions-insert", "toc-insert",
                    "internal-nav", "note-insert", "template-styles-apply", "content-edit",
                    "render", "compare"
                ],
                "helperOperations": [
                    "audit-features", "distill-template", "inspect-review-markup",
                    "protection-set", "publishing-controls-remove", "rsid-strip", "style-lint",
                    "style-normalize", "tables-to-csv", "watermark-add", "merge-text",
                    "text-replace", "tracked-process", "redact-text", "merge-append",
                    "template-fidelity", "a11y-fixes", "comments-extract", "content-controls",
                    "comments-manage", "comments-add", "comments-apply-patches",
                    "tracked-add-replacements", "table-geometry-set", "fields-process",
                    "reference-fields-insert", "captions-insert", "toc-insert",
                    "internal-nav", "note-insert", "template-styles-apply", "content-edit",
                    "render", "compare"
                ]
            }
        },
        "presentationApis": {
            "authoring": [
                "Presentation.create", "PresentationFile.importPptx",
                "PresentationFile.exportPptx", "presentation.inspect",
                "presentation.render", "presentation.export"
            ],
            "helpers": [
                "inspect-template", "validate-template-plan",
                "prepare-template-starter-deck", "check-template-fidelity",
                "render-slides", "make-contact-sheet",
                "inspect-package-integrity", "inspect-layout-geometry",
                "native-chart-title-gate", "native-quantitative-chart-gate",
                "native-table-arithmetic-gate"
            ],
            "references": [
                "references/accessibility-review.md", "references/api-compatibility.md",
                "references/api-quick-start.md", "references/api-reference-map.md",
                "references/charts.md", "references/compose-and-auto-layout.md",
                "references/connectors.md", "references/cover-guidance.md",
                "references/custom-paths.md", "references/design-guidance.md",
                "references/finalization.md", "references/helper-contracts.md",
                "references/hyperlinks.md", "references/images.md",
                "references/import-and-fidelity.md", "references/inspection-and-editing.md",
                "references/masters-and-layouts.md", "references/native-evidence.md",
                "references/notes-and-comments.md", "references/presentation-object.md",
                "references/proto-and-layout-export.md", "references/rendering-and-export.md",
                "references/rendering-review.md", "references/rich-text-and-bullets.md",
                "references/shapes-and-text.md", "references/slide-management.md",
                "references/tables.md", "references/template-workflow.md",
                "references/templates-and-help.md", "references/themes-and-fills.md",
                "references/view-settings.md", "references/writing-guidance.md"
            ],
            "domainGuidance": ["domain-guidance/finance.md"]
        }
    }))
}

pub(super) fn parse_flags(args: &[String]) -> Result<Vec<(String, Option<String>)>, ArtifactError> {
    let mut flags = Vec::new();
    let mut index = 0;
    while index < args.len() {
        let flag = &args[index];
        if flag == "--json" {
            flags.push((flag.clone(), None));
            index += 1;
            continue;
        }
        let Some(name) = flag.strip_prefix("--") else {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("expected a flag, got: {flag}"),
            ));
        };
        let value = args.get(index + 1).ok_or_else(|| {
            ArtifactError::new("invalid_arguments", format!("missing value for --{name}"))
        })?;
        if value.starts_with("--") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("missing value for --{name}"),
            ));
        }
        flags.push((name.to_owned(), Some(value.clone())));
        index += 2;
    }
    Ok(flags)
}

pub(super) fn required_flag<'a>(
    flags: &'a [(String, Option<String>)],
    name: &str,
) -> Result<&'a str, ArtifactError> {
    flags
        .iter()
        .find_map(|(flag, value)| (flag == name).then_some(value.as_deref()).flatten())
        .ok_or_else(|| ArtifactError::new("invalid_arguments", format!("--{name} is required")))
}

pub(super) fn reject_unknown_flags(args: &[String]) -> Result<(), ArtifactError> {
    for argument in args {
        if argument != "--json" {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: {argument}"),
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::run;
    use serde_json::{Value, json};
    use std::ffi::OsString;
    use std::fs;
    use std::path::PathBuf;

    fn command(args: &[&str]) -> Result<Value, super::ArtifactError> {
        run(args.iter().map(OsString::from).collect())
    }

    fn temp_dir(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "ruxex-artifact-cli-unit-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn dispatches_capabilities_and_rejects_missing_or_unknown_commands() {
        let capabilities = command(&["capabilities"]).unwrap();
        assert_eq!(capabilities["commands"]["xlsx"][0], "create");
        assert_eq!(
            capabilities["commands"]["docx"],
            json!(["read", "validate", "audit", "privacy-scrub", "helper"])
        );
        assert_eq!(
            capabilities["documentApis"]["docx"]["authoring"],
            json!(["Document.create", "Document.load", "exportDocx"])
        );
        assert_eq!(
            capabilities["presentationApis"]["authoring"],
            json!([
                "Presentation.create",
                "PresentationFile.importPptx",
                "PresentationFile.exportPptx",
                "presentation.inspect",
                "presentation.render",
                "presentation.export"
            ])
        );
        assert_eq!(
            capabilities["presentationApis"]["helpers"]
                .as_array()
                .unwrap()
                .len(),
            11
        );
        assert_eq!(
            capabilities["presentationApis"]["references"]
                .as_array()
                .unwrap()
                .len(),
            32
        );
        assert_eq!(
            capabilities["presentationApis"]["domainGuidance"],
            json!(["domain-guidance/finance.md"])
        );
        assert_eq!(
            capabilities["documentApis"]["docx"]["authoringMethods"],
            json!([
                "addParagraph",
                "addHeading",
                "addTitle",
                "addSubtitle",
                "addListItem",
                "addPageBreak",
                "addTableOfContents",
                "addImage",
                "addTable",
                "addSection",
                "setHeader",
                "setFooter",
                "setWatermark",
                "setProtection",
                "addBookmark",
                "addInternalLink",
                "addReferenceField",
                "addSequenceField",
                "addExternalLink",
                "addComment",
                "addTrackedReplacement",
                "addFootnote",
                "addEndnote"
            ])
        );
        assert_eq!(
            capabilities["documentApis"]["docx"]["formattingOptions"],
            json!([
                "pageSize",
                "orientation",
                "margins",
                "alignment",
                "spacingBefore",
                "spacingAfter",
                "fontFace",
                "fontSize",
                "color",
                "bold",
                "italic",
                "keepWithNext",
                "pageBreakBefore",
                "headerRow",
                "borders",
                "cellPadding",
                "columnWidths",
                "width",
                "indent",
                "layout"
            ])
        );
        assert_eq!(
            capabilities["documentApis"]["docx"]["watermarkOptions"],
            json!([
                "font", "fontSize", "bold", "italics", "color", "opacity", "layout", "rotation",
                "width", "height"
            ])
        );
        assert_eq!(
            capabilities["documentApis"]["docx"]["protectionTypes"],
            json!(["readOnly", "comments", "trackedChanges", "forms"])
        );
        assert_eq!(
            capabilities["documentApis"]["docx"]["tableOfContentsOptions"],
            json!(["title", "headingStyleRange", "hyperlink"])
        );
        assert_eq!(
            capabilities["documentApis"]["docx"]["helpers"],
            json!([
                "audit-features", "distill-template", "inspect-review-markup",
                "protection-set", "publishing-controls-remove", "rsid-strip", "style-lint",
                "style-normalize", "tables-to-csv", "watermark-add", "merge-text",
                "text-replace", "tracked-process", "redact-text", "merge-append",
                "template-fidelity", "a11y-fixes", "comments-extract", "content-controls",
                "comments-manage", "comments-add", "comments-apply-patches",
                "tracked-add-replacements", "table-geometry-set", "fields-process",
                "reference-fields-insert", "captions-insert", "toc-insert", "internal-nav",
                "note-insert", "template-styles-apply", "content-edit", "render", "compare"
            ])
        );
        assert!(
            capabilities["documentApis"]["docx"]["helperOperations"]
                .as_array()
                .is_some_and(|operations| operations
                    .iter()
                    .any(|operation| operation == "watermark-add")
                    && operations.iter().any(|operation| operation == "merge-text")
                    && operations
                        .iter()
                        .any(|operation| operation == "redact-text")
                    && operations
                        .iter()
                        .any(|operation| operation == "merge-append")
                    && operations
                        .iter()
                        .any(|operation| operation == "template-fidelity")
                    && operations.iter().any(|operation| operation == "a11y-fixes")
                    && operations
                        .iter()
                        .any(|operation| operation == "comments-extract")
                    && operations
                        .iter()
                        .any(|operation| operation == "content-controls")
                    && operations
                        .iter()
                        .any(|operation| operation == "comments-manage")
                    && operations
                        .iter()
                        .any(|operation| operation == "comments-add")
                    && operations
                        .iter()
                        .any(|operation| operation == "comments-apply-patches")
                    && operations
                        .iter()
                        .any(|operation| operation == "tracked-add-replacements")
                    && operations
                        .iter()
                        .any(|operation| operation == "table-geometry-set")
                    && operations
                        .iter()
                        .any(|operation| operation == "fields-process")
                    && operations
                        .iter()
                        .any(|operation| operation == "reference-fields-insert")
                    && operations
                        .iter()
                        .any(|operation| operation == "captions-insert")
                    && operations.iter().any(|operation| operation == "toc-insert")
                    && operations
                        .iter()
                        .any(|operation| operation == "internal-nav")
                    && operations
                        .iter()
                        .any(|operation| operation == "note-insert")
                    && operations
                        .iter()
                        .any(|operation| operation == "template-styles-apply")
                    && operations
                        .iter()
                        .any(|operation| operation == "content-edit"))
        );
        assert_eq!(command(&[]).unwrap_err().code, "invalid_arguments");
        assert_eq!(command(&["unknown"]).unwrap_err().code, "invalid_arguments");
        assert_eq!(
            command(&["capabilities", "--unknown"]).unwrap_err().code,
            "invalid_arguments"
        );
    }

    #[test]
    fn creates_reads_and_validates_a_workbook_in_process() {
        let directory = temp_dir("xlsx-roundtrip");
        let input = directory.join("input.json");
        let workbook = directory.join("report.xlsx");
        fs::write(
            &input,
            r#"{"sheets":[{"name":"Summary","rows":[["name","Ada"],["count",3],["enabled",true],["empty",null]]},{"name":"Details","rows":[["id",1]]}]}"#,
        )
        .unwrap();
        let input = input.to_str().unwrap();
        let workbook = workbook.to_str().unwrap();

        command(&["xlsx", "create", "--input", input, "--output", workbook]).unwrap();
        let result = command(&["xlsx", "read", "--input", workbook]).unwrap();
        assert_eq!(result["sheets"][0]["name"], "Summary");
        assert_eq!(result["sheets"][0]["rows"][1][1], 3);
        assert_eq!(result["sheets"][0]["rows"][2][1], true);
        assert_eq!(result["sheets"][0]["rows"][3][1], Value::Null);
        assert_eq!(result["sheets"][1]["name"], "Details");

        let validation = command(&["xlsx", "validate", "--input", workbook]).unwrap();
        assert_eq!(validation["valid"], true);
        assert_eq!(validation["sheets"][0]["rows"], 4);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn rejects_invalid_xlsx_arguments_and_cell_values_without_output() {
        let directory = temp_dir("xlsx-errors");
        let input = directory.join("input.json");
        let output = directory.join("unsupported.xlsx");
        fs::write(
            &input,
            r#"{"sheets":[{"name":"Summary","rows":[[{"nested":true}]]}]}"#,
        )
        .unwrap();
        assert_eq!(
            command(&["xlsx", "validate", "--unknown", "value"])
                .unwrap_err()
                .code,
            "invalid_arguments"
        );
        assert_eq!(
            command(&["xlsx", "create", "--input", "missing.json"])
                .unwrap_err()
                .code,
            "invalid_arguments"
        );
        let error = command(&[
            "xlsx",
            "create",
            "--input",
            input.to_str().unwrap(),
            "--output",
            output.to_str().unwrap(),
        ])
        .unwrap_err();
        assert_eq!(error.code, "unsupported_cell_value");
        assert!(!output.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn handles_pdf_create_read_and_validation_errors() {
        let directory = temp_dir("pdf-roundtrip");
        let input = directory.join("input.json");
        let output = directory.join("report.pdf");
        fs::write(
            &input,
            r#"{"pages":[{"width":595,"height":842,"blocks":[{"text":"First page","x":48,"y":780,"size":18}]},{"width":595,"height":842,"blocks":[{"text":"Second page","x":48,"y":780,"size":18}]}]}"#,
        )
        .unwrap();
        command(&[
            "pdf",
            "create",
            "--input",
            input.to_str().unwrap(),
            "--output",
            output.to_str().unwrap(),
        ])
        .unwrap();
        let validation =
            command(&["pdf", "validate", "--input", output.to_str().unwrap()]).unwrap();
        assert_eq!(validation["pages"], 2);
        let read = command(&["pdf", "read", "--input", output.to_str().unwrap()]).unwrap();
        assert_eq!(read["pages"], 2);
        assert!(command(&["pdf", "read"]).is_err());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn pptx_helper_catalog_lists_python_free_workflows() {
        let catalog = command(&["pptx", "helper", "list"]).unwrap();
        assert_eq!(catalog["ok"], true);
        assert_eq!(catalog["helpers"].as_array().unwrap().len(), 11);
        assert!(
            catalog["helpers"]
                .as_array()
                .unwrap()
                .iter()
                .all(|helper| helper.as_str().is_some_and(|name| !name.ends_with(".py")))
        );
    }
}
