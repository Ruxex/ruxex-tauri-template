use std::ffi::OsString;
use std::fmt::{Display, Formatter};
use std::fs;
use std::io::Read;
use std::path::Path;

use calamine::{Data, Reader, Xlsx, open_workbook};
use rust_xlsxwriter::{Chart, ChartType, Color, Format, FormatAlign, Formula, Table, Workbook};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::artifact_pdf::{PdfPageSpec, inspect_pdf_bytes};
use crate::ooxml;

#[derive(Debug)]
struct ArtifactError {
    code: &'static str,
    message: String,
}

impl ArtifactError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl Display for ArtifactError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

#[derive(Debug, Deserialize)]
struct WorkbookInput {
    sheets: Vec<SheetInput>,
}

#[derive(Debug, Deserialize)]
struct SheetInput {
    name: String,
    rows: Vec<Vec<Value>>,
    #[serde(default)]
    formulas: Vec<Vec<Option<String>>>,
    #[serde(default)]
    formats: Vec<FormatInput>,
    #[serde(default)]
    merges: Vec<MergeInput>,
    #[serde(default)]
    column_widths: Vec<ColumnWidthInput>,
    #[serde(default)]
    tables: Vec<TableInput>,
    #[serde(default)]
    charts: Vec<ChartInput>,
}

#[derive(Debug, Deserialize)]
struct FormatInput {
    range: String,
    #[serde(default)]
    font: Option<FontInput>,
    #[serde(default)]
    fill: Option<String>,
    #[serde(default)]
    horizontal_alignment: Option<String>,
    #[serde(default)]
    vertical_alignment: Option<String>,
    #[serde(default)]
    wrap_text: Option<bool>,
    #[serde(default)]
    number_format: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FontInput {
    #[serde(default)]
    bold: Option<bool>,
    #[serde(default)]
    italic: Option<bool>,
    #[serde(default)]
    color: Option<String>,
    #[serde(default)]
    size: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct MergeInput {
    range: String,
}

#[derive(Debug, Deserialize)]
struct ColumnWidthInput {
    column: String,
    width: f64,
}

#[derive(Debug, Deserialize)]
struct TableInput {
    name: String,
    range: String,
    #[serde(default = "default_true")]
    has_headers: bool,
}

#[derive(Debug, Deserialize)]
struct ChartInput {
    #[serde(rename = "type")]
    chart_type: String,
    position: String,
    series: Vec<ChartSeriesInput>,
}

#[derive(Debug, Deserialize)]
struct ChartSeriesInput {
    #[serde(default)]
    name: Option<String>,
    categories: String,
    values: String,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, serde::Deserialize)]
struct EngineRequest {
    version: u32,
    operation: String,
    input_path: Option<String>,
    output_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PdfInput {
    pages: Vec<PdfPageSpec>,
    #[serde(default)]
    allowed_roots: Vec<String>,
}

pub fn run_engine_stdio() -> std::process::ExitCode {
    let mut request_json = String::new();
    if let Err(error) = std::io::stdin().read_to_string(&mut request_json) {
        print_json(
            &json!({"ok": false, "error": {"code": "request_read_error", "message": error.to_string()}}),
            true,
        );
        return std::process::ExitCode::from(1);
    }
    let request: EngineRequest = match serde_json::from_str(&request_json) {
        Ok(request) => request,
        Err(error) => {
            print_json(
                &json!({"ok": false, "error": {"code": "invalid_request_json", "message": error.to_string()}}),
                true,
            );
            return std::process::ExitCode::from(1);
        }
    };
    if request.version != 1 {
        print_json(
            &json!({"ok": false, "error": {"code": "unsupported_protocol_version", "message": format!("unsupported engine protocol version: {}", request.version)}}),
            true,
        );
        return std::process::ExitCode::from(1);
    }

    let result = match request.operation.as_str() {
        "create" => match (
            request.input_path.as_deref(),
            request.output_path.as_deref(),
        ) {
            (Some(input), Some(output)) => create_xlsx(input, output),
            _ => Err(ArtifactError::new(
                "invalid_request",
                "create requires input_path and output_path",
            )),
        },
        "read" => request
            .input_path
            .as_deref()
            .ok_or_else(|| ArtifactError::new("invalid_request", "read requires input_path"))
            .and_then(read_xlsx),
        "validate" => request
            .input_path
            .as_deref()
            .ok_or_else(|| ArtifactError::new("invalid_request", "validate requires input_path"))
            .and_then(validate_xlsx),
        "pdf_create" => match (
            request.input_path.as_deref(),
            request.output_path.as_deref(),
        ) {
            (Some(input), Some(output)) => create_pdf(input, output),
            _ => Err(ArtifactError::new(
                "invalid_request",
                "pdf_create requires input_path and output_path",
            )),
        },
        "pdf_read" => request
            .input_path
            .as_deref()
            .ok_or_else(|| ArtifactError::new("invalid_request", "pdf_read requires input_path"))
            .and_then(read_pdf),
        "pdf_validate" => request
            .input_path
            .as_deref()
            .ok_or_else(|| {
                ArtifactError::new("invalid_request", "pdf_validate requires input_path")
            })
            .and_then(validate_pdf),
        "docx_read" => request
            .input_path
            .as_deref()
            .ok_or_else(|| ArtifactError::new("invalid_request", "docx_read requires input_path"))
            .and_then(|input| read_ooxml("docx", input)),
        "pptx_read" => request
            .input_path
            .as_deref()
            .ok_or_else(|| ArtifactError::new("invalid_request", "pptx_read requires input_path"))
            .and_then(|input| read_ooxml("pptx", input)),
        operation => Err(ArtifactError::new(
            "invalid_request",
            format!("unknown engine operation: {operation}"),
        )),
    };
    match result {
        Ok(value) => {
            print_json(&value, false);
            std::process::ExitCode::SUCCESS
        }
        Err(error) => {
            print_json(
                &json!({"ok": false, "error": {"code": error.code, "message": error.message}}),
                true,
            );
            std::process::ExitCode::from(1)
        }
    }
}

pub fn run_cli<I>(args: I) -> std::process::ExitCode
where
    I: IntoIterator<Item = OsString>,
{
    match run(args.into_iter().skip(1).collect()) {
        Ok(value) => {
            print_json(&value, false);
            std::process::ExitCode::SUCCESS
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
        Some("xlsx") => run_xlsx(&args[1..]),
        Some("docx") => run_ooxml("docx", &args[1..]),
        Some("pptx") => run_ooxml("pptx", &args[1..]),
        Some("pdf") => run_pdf(&args[1..]),
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
            "docx": ["create", "read", "validate"],
            "pptx": ["create", "read", "validate"],
            "pdf": ["create", "read", "validate"],
        },
    }))
}

fn run_pdf(args: &[String]) -> Result<Value, ArtifactError> {
    let Some(operation) = args.first().map(String::as_str) else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "a pdf operation is required",
        ));
    };
    let flags = parse_flags(&args[1..])?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "output" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    match operation {
        "create" => create_pdf(
            required_flag(&flags, "input")?,
            required_flag(&flags, "output")?,
        ),
        "read" => read_pdf(required_flag(&flags, "input")?),
        "validate" => validate_pdf(required_flag(&flags, "input")?),
        _ => Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown pdf operation: {operation}"),
        )),
    }
}

fn create_pdf(input_path: &str, output_path: &str) -> Result<Value, ArtifactError> {
    let input = fs::read_to_string(input_path).map_err(|error| {
        ArtifactError::new(
            "pdf_read_error",
            format!("failed to read PDF input JSON {input_path}: {error}"),
        )
    })?;
    let input: PdfInput = serde_json::from_str(&input)
        .map_err(|error| ArtifactError::new("invalid_json", error.to_string()))?;
    let allowed_roots = if input.allowed_roots.is_empty() {
        vec![
            Path::new(input_path)
                .parent()
                .unwrap_or_else(|| Path::new("."))
                .canonicalize()
                .map_err(|error| {
                    ArtifactError::new(
                        "pdf_create_error",
                        format!("failed to resolve PDF asset root: {error}"),
                    )
                })?,
        ]
    } else {
        input
            .allowed_roots
            .iter()
            .map(|root| {
                Path::new(root).canonicalize().map_err(|error| {
                    ArtifactError::new(
                        "pdf_create_error",
                        format!("failed to resolve PDF asset root {root}: {error}"),
                    )
                })
            })
            .collect::<Result<Vec<_>, _>>()?
    };
    let bytes = crate::artifact_pdf::create_pdf_bytes_with_roots(&input.pages, &allowed_roots)
        .map_err(|error| ArtifactError::new("pdf_create_error", error))?;
    fs::write(output_path, &bytes).map_err(|error| {
        ArtifactError::new(
            "pdf_write_error",
            format!("failed to write PDF {output_path}: {error}"),
        )
    })?;
    Ok(json!({
        "ok": true,
        "format": "pdf",
        "output": output_path,
        "pages": input.pages.len(),
        "bytes": bytes.len(),
    }))
}

fn read_pdf(input_path: &str) -> Result<Value, ArtifactError> {
    let bytes = read_pdf_file(input_path)?;
    let inspection =
        inspect_pdf_bytes(&bytes).map_err(|error| ArtifactError::new("invalid_pdf", error))?;
    Ok(json!({
        "ok": true,
        "valid": true,
        "format": "pdf",
        "pages": inspection.page_count,
        "text": inspection.text,
    }))
}

fn validate_pdf(input_path: &str) -> Result<Value, ArtifactError> {
    let bytes = read_pdf_file(input_path)?;
    let inspection =
        inspect_pdf_bytes(&bytes).map_err(|error| ArtifactError::new("invalid_pdf", error))?;
    Ok(json!({
        "ok": true,
        "valid": true,
        "format": "pdf",
        "pages": inspection.page_count,
        "bytes": bytes.len(),
    }))
}

fn read_pdf_file(input_path: &str) -> Result<Vec<u8>, ArtifactError> {
    fs::read(input_path).map_err(|error| {
        ArtifactError::new(
            "pdf_read_error",
            format!("failed to read PDF {input_path}: {error}"),
        )
    })
}

fn run_xlsx(args: &[String]) -> Result<Value, ArtifactError> {
    let Some(operation) = args.first().map(String::as_str) else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "an xlsx operation is required",
        ));
    };
    let flags = parse_flags(&args[1..])?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "output" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }

    match operation {
        "create" => create_xlsx(
            required_flag(&flags, "input")?,
            required_flag(&flags, "output")?,
        ),
        "read" => read_xlsx(required_flag(&flags, "input")?),
        "validate" => validate_xlsx(required_flag(&flags, "input")?),
        _ => Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown xlsx operation: {operation}"),
        )),
    }
}

fn run_ooxml(format: &str, args: &[String]) -> Result<Value, ArtifactError> {
    let Some(operation) = args.first().map(String::as_str) else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("a {format} operation is required"),
        ));
    };
    let flags = parse_flags(&args[1..])?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    match operation {
        "read" => read_ooxml(format, required_flag(&flags, "input")?),
        "validate" => inspect_ooxml(format, required_flag(&flags, "input")?),
        "create" => Err(ArtifactError::new(
            "unsupported_operation",
            format!("{format} creation is available through `ruxex-artifacts run`"),
        )),
        _ => Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown {format} operation: {operation}"),
        )),
    }
}

fn inspect_ooxml(format: &str, input_path: &str) -> Result<Value, ArtifactError> {
    let file = fs::File::open(input_path).map_err(|error| {
        ArtifactError::new(
            "ooxml_read_error",
            format!("failed to read {input_path}: {error}"),
        )
    })?;
    let mut archive = zip::ZipArchive::new(file).map_err(|error| {
        ArtifactError::new(
            "ooxml_read_error",
            format!("failed to open {input_path} as a ZIP package: {error}"),
        )
    })?;
    let parts = (0..archive.len())
        .filter_map(|index| {
            archive
                .by_index(index)
                .ok()
                .map(|entry| entry.name().to_owned())
        })
        .collect::<Vec<_>>();
    let required = match format {
        "docx" => vec![
            "[Content_Types].xml",
            "_rels/.rels",
            "word/document.xml",
            "word/_rels/document.xml.rels",
            "word/styles.xml",
        ],
        "pptx" => vec![
            "[Content_Types].xml",
            "_rels/.rels",
            "ppt/presentation.xml",
            "ppt/_rels/presentation.xml.rels",
            "ppt/slides/slide1.xml",
        ],
        _ => {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unsupported OOXML format: {format}"),
            ));
        }
    };
    let missing = required
        .into_iter()
        .filter(|required_part| !parts.iter().any(|part| part == required_part))
        .collect::<Vec<_>>();
    if !missing.is_empty() {
        return Err(ArtifactError::new(
            "invalid_ooxml_package",
            format!(
                "{format} package is missing required parts: {}",
                missing.join(", ")
            ),
        ));
    }
    Ok(json!({
        "ok": true,
        "valid": true,
        "format": format,
        "parts": parts,
    }))
}

fn read_ooxml(format: &str, input_path: &str) -> Result<Value, ArtifactError> {
    let validation = inspect_ooxml(format, input_path)?;
    let file = fs::File::open(input_path).map_err(|error| {
        ArtifactError::new(
            "ooxml_read_error",
            format!("failed to read {input_path}: {error}"),
        )
    })?;
    let mut archive = zip::ZipArchive::new(file).map_err(|error| {
        ArtifactError::new(
            "ooxml_read_error",
            format!("failed to open {input_path} as a ZIP package: {error}"),
        )
    })?;
    if format == "docx" {
        let xml = read_ooxml_part(&mut archive, "word/document.xml")?;
        let items = docx_items(&xml);
        let mut diagnostics = Vec::new();
        if xml.contains("w:drawing") || xml.contains("a:blip") {
            diagnostics.push(json!({
                "code": "unsupported_images",
                "message": "document images are preserved as diagnostics and are not editable yet",
            }));
        }
        if xml.contains("w:hyperlink") || xml.contains("w:fldSimple") {
            diagnostics.push(json!({
                "code": "unsupported_fields",
                "message": "hyperlinks and fields are not editable yet",
            }));
        }
        let mut header_footer_count = 0;
        for index in 0..archive.len() {
            if archive.by_index(index).ok().is_some_and(|entry| {
                entry.name().starts_with("word/header") || entry.name().starts_with("word/footer")
            }) {
                header_footer_count += 1;
            }
        }
        if header_footer_count > 0 {
            diagnostics.push(json!({
                "code": "unsupported_headers_footers",
                "message": "headers and footers are readable only as loss diagnostics",
                "count": header_footer_count,
            }));
        }
        Ok(json!({
            "ok": true,
            "valid": true,
            "format": format,
            "parts": validation["parts"].clone(),
            "items": items,
            "diagnostics": diagnostics,
        }))
    } else {
        let mut slide_names = (0..archive.len())
            .filter_map(|index| {
                archive
                    .by_index(index)
                    .ok()
                    .map(|entry| entry.name().to_string())
            })
            .filter(|name| ooxml::slide_number(name).is_some())
            .collect::<Vec<_>>();
        slide_names.sort_by_key(|name| ooxml::slide_number(name).unwrap_or(usize::MAX));
        let mut slides = Vec::new();
        let mut diagnostics = Vec::new();
        for (index, name) in slide_names.iter().enumerate() {
            let xml = read_ooxml_part(&mut archive, name)?;
            let objects = ooxml_text_values(&xml, "a:t")
                .into_iter()
                .map(|text| json!({"kind": "text", "text": text}))
                .collect::<Vec<_>>();
            if xml.contains("p:graphicFrame") || xml.contains("a:tbl") {
                diagnostics.push(json!({
                    "code": "unsupported_slide_objects",
                    "message": format!("slide {} contains tables or charts that are preview-only", index + 1),
                    "slide": index + 1,
                }));
            }
            if xml.contains("a:blip") {
                diagnostics.push(json!({
                    "code": "unsupported_images",
                    "message": format!("slide {} contains an image that is preview-only", index + 1),
                    "slide": index + 1,
                }));
            }
            slides.push(json!({"objects": objects}));
        }
        let mut notes_count = 0;
        for index in 0..archive.len() {
            if archive
                .by_index(index)
                .ok()
                .is_some_and(|entry| entry.name().starts_with("ppt/notesSlides/"))
            {
                notes_count += 1;
            }
        }
        if notes_count > 0 {
            diagnostics.push(json!({
                "code": "unsupported_notes",
                "message": "slide notes are readable only as loss diagnostics",
                "count": notes_count,
            }));
        }
        Ok(json!({
            "ok": true,
            "valid": true,
            "format": format,
            "parts": validation["parts"].clone(),
            "slides": slides,
            "diagnostics": diagnostics,
        }))
    }
}

fn read_ooxml_part<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    name: &str,
) -> Result<String, ArtifactError> {
    let entry = archive
        .by_name(name)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    let mut xml = String::new();
    entry
        .take(2 * 1024 * 1024 + 1)
        .read_to_string(&mut xml)
        .map_err(|error| ArtifactError::new("ooxml_read_error", error.to_string()))?;
    if xml.len() > 2 * 1024 * 1024 {
        return Err(ArtifactError::new(
            "ooxml_read_error",
            format!("{name} exceeds the 2 MiB XML limit"),
        ));
    }
    Ok(xml)
}

fn docx_items(xml: &str) -> Vec<Value> {
    let mut items = Vec::new();
    let tables = ooxml_blocks(xml, "w:tbl");
    for paragraph in ooxml_blocks(xml, "w:p") {
        if tables.iter().any(|table| table.contains(&paragraph)) {
            continue;
        }
        let text = ooxml_text_values(&paragraph, "w:t").join("");
        if text.trim().is_empty() {
            continue;
        }
        let style = ooxml::attribute_values(&paragraph, "w:pStyle", "w:val")
            .first()
            .cloned();
        let item = if let Some(style) = style
            .as_deref()
            .filter(|style| style.starts_with("Heading"))
        {
            let level = style
                .trim_start_matches("Heading")
                .parse::<u8>()
                .unwrap_or(1);
            json!({"kind": "heading", "text": text, "level": level})
        } else {
            json!({"kind": "paragraph", "text": text})
        };
        items.push(item);
    }
    for table in tables {
        let rows = ooxml_blocks(&table, "w:tr")
            .into_iter()
            .map(|row| {
                ooxml_blocks(&row, "w:tc")
                    .into_iter()
                    .map(|cell| ooxml_text_values(&cell, "w:t").join(""))
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        if !rows.is_empty() {
            items.push(json!({"kind": "table", "rows": rows}));
        }
    }
    items
}

fn ooxml_blocks(xml: &str, tag: &str) -> Vec<String> {
    let opening = format!("<{tag}");
    let closing = format!("</{tag}>");
    let mut cursor = 0;
    let mut blocks = Vec::new();
    while let Some(offset) = xml[cursor..].find(&opening) {
        let start = cursor + offset;
        let suffix = xml[start + opening.len()..].chars().next();
        let valid_suffix = match suffix {
            Some('>') | Some('/') => true,
            Some(character) => character.is_ascii_whitespace(),
            None => false,
        };
        if !valid_suffix {
            cursor = start + opening.len();
            continue;
        }
        let Some(open_end_offset) = xml[start..].find('>') else {
            break;
        };
        let content_start = start + open_end_offset + 1;
        let Some(close_offset) = xml[content_start..].find(&closing) else {
            break;
        };
        let end = content_start + close_offset;
        blocks.push(xml[start..end + closing.len()].to_string());
        cursor = end + closing.len();
    }
    blocks
}

fn ooxml_text_values(xml: &str, tag: &str) -> Vec<String> {
    let opening = format!("<{tag}");
    let closing = format!("</{tag}>");
    ooxml_blocks(xml, tag)
        .into_iter()
        .map(|value| {
            let start = value
                .find('>')
                .map(|index| index + 1)
                .unwrap_or(opening.len());
            value[start..value.len().saturating_sub(closing.len())].to_string()
        })
        .map(|value| ooxml::decode_entities(&value))
        .collect()
}

fn parse_flags(args: &[String]) -> Result<Vec<(String, Option<String>)>, ArtifactError> {
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

fn required_flag<'a>(
    flags: &'a [(String, Option<String>)],
    name: &str,
) -> Result<&'a str, ArtifactError> {
    flags
        .iter()
        .find_map(|(flag, value)| (flag == name).then_some(value.as_deref()).flatten())
        .ok_or_else(|| ArtifactError::new("invalid_arguments", format!("--{name} is required")))
}

fn reject_unknown_flags(args: &[String]) -> Result<(), ArtifactError> {
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

#[derive(Clone, Copy)]
struct CellRange {
    first_row: u32,
    first_col: u16,
    last_row: u32,
    last_col: u16,
}

fn parse_a1_range(reference: &str) -> Result<CellRange, ArtifactError> {
    let mut parts = reference.split(':');
    let first = parts.next().unwrap_or_default();
    let last = parts.next().unwrap_or(first);
    if parts.next().is_some() {
        return Err(ArtifactError::new(
            "invalid_range",
            format!("invalid A1 range: {reference}"),
        ));
    }
    let (first_row, first_col) = parse_cell_reference(first)?;
    let (last_row, last_col) = parse_cell_reference(last)?;
    if first_row > last_row || first_col > last_col {
        return Err(ArtifactError::new(
            "invalid_range",
            format!("range bounds are reversed: {reference}"),
        ));
    }
    Ok(CellRange {
        first_row,
        first_col,
        last_row,
        last_col,
    })
}

fn parse_cell_reference(reference: &str) -> Result<(u32, u16), ArtifactError> {
    let split = reference
        .char_indices()
        .find(|(_, character)| character.is_ascii_digit())
        .map(|(index, _)| index)
        .ok_or_else(|| ArtifactError::new("invalid_range", format!("invalid cell: {reference}")))?;
    let (column, row) = reference.split_at(split);
    let row = row
        .parse::<u32>()
        .map_err(|_| ArtifactError::new("invalid_range", format!("invalid row: {reference}")))?;
    if row == 0 {
        return Err(ArtifactError::new(
            "invalid_range",
            format!("row must be greater than zero: {reference}"),
        ));
    }
    Ok((row - 1, parse_column_reference(column)?))
}

fn parse_column_reference(reference: &str) -> Result<u16, ArtifactError> {
    if reference.is_empty()
        || !reference
            .chars()
            .all(|character| character.is_ascii_alphabetic())
    {
        return Err(ArtifactError::new(
            "invalid_range",
            format!("invalid column: {reference}"),
        ));
    }
    let mut value = 0u32;
    for character in reference.chars() {
        value = value
            .checked_mul(26)
            .and_then(|value| {
                value.checked_add(character.to_ascii_uppercase() as u32 - 'A' as u32 + 1)
            })
            .ok_or_else(|| {
                ArtifactError::new("invalid_range", format!("column is too large: {reference}"))
            })?;
    }
    u16::try_from(value - 1).map_err(|_| {
        ArtifactError::new("invalid_range", format!("column is too large: {reference}"))
    })
}

fn parse_color(value: &str) -> Result<Color, ArtifactError> {
    let hex = value.strip_prefix('#').unwrap_or(value);
    if hex.len() != 6 || !hex.chars().all(|character| character.is_ascii_hexdigit()) {
        return Err(ArtifactError::new(
            "invalid_format",
            format!("color must be a six-digit hex value: {value}"),
        ));
    }
    let value = u32::from_str_radix(hex, 16)
        .map_err(|_| ArtifactError::new("invalid_format", format!("invalid color: {value}")))?;
    Ok(Color::RGB(value))
}

fn parse_horizontal_alignment(value: &str) -> Result<FormatAlign, ArtifactError> {
    match value {
        "left" => Ok(FormatAlign::Left),
        "center" => Ok(FormatAlign::Center),
        "right" => Ok(FormatAlign::Right),
        _ => Err(ArtifactError::new(
            "invalid_format",
            format!("unsupported horizontal alignment: {value}"),
        )),
    }
}

fn parse_vertical_alignment(value: &str) -> Result<FormatAlign, ArtifactError> {
    match value {
        "top" => Ok(FormatAlign::Top),
        "center" => Ok(FormatAlign::VerticalCenter),
        "bottom" => Ok(FormatAlign::Bottom),
        _ => Err(ArtifactError::new(
            "invalid_format",
            format!("unsupported vertical alignment: {value}"),
        )),
    }
}

fn build_format(input: &FormatInput) -> Result<Format, ArtifactError> {
    let mut format = Format::new();
    if let Some(font) = &input.font {
        if font.bold == Some(true) {
            format = format.set_bold();
        }
        if font.italic == Some(true) {
            format = format.set_italic();
        }
        if let Some(color) = &font.color {
            format = format.set_font_color(parse_color(color)?);
        }
        if let Some(size) = font.size {
            if !size.is_finite() || size <= 0.0 {
                return Err(ArtifactError::new(
                    "invalid_format",
                    "font size must be a positive finite number",
                ));
            }
            format = format.set_font_size(size);
        }
    }
    if let Some(fill) = &input.fill {
        format = format.set_background_color(parse_color(fill)?);
    }
    if let Some(alignment) = &input.horizontal_alignment {
        format = format.set_align(parse_horizontal_alignment(alignment)?);
    }
    if let Some(alignment) = &input.vertical_alignment {
        format = format.set_align(parse_vertical_alignment(alignment)?);
    }
    if input.wrap_text == Some(true) {
        format = format.set_text_wrap();
    }
    if let Some(number_format) = &input.number_format {
        if number_format.is_empty() {
            return Err(ArtifactError::new(
                "invalid_format",
                "number format cannot be empty",
            ));
        }
        format = format.set_num_format(number_format);
    }
    Ok(format)
}

fn formula_at(sheet: &SheetInput, row: usize, column: usize) -> Option<&str> {
    sheet
        .formulas
        .get(row)
        .and_then(|values| values.get(column))
        .and_then(Option::as_deref)
}

fn value_at(sheet: &SheetInput, row: usize, column: usize) -> Option<&Value> {
    sheet.rows.get(row).and_then(|values| values.get(column))
}

fn format_at<'a>(formats: &'a [(CellRange, Format)], row: u32, column: u16) -> Option<&'a Format> {
    formats.iter().rev().find_map(|(range, format)| {
        (range.first_row <= row
            && row <= range.last_row
            && range.first_col <= column
            && column <= range.last_col)
            .then_some(format)
    })
}

fn formula_result(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::Null) | None => None,
        Some(Value::String(value)) => Some(value.clone()),
        Some(Value::Bool(value)) => Some(value.to_string()),
        Some(Value::Number(value)) => Some(value.to_string()),
        Some(Value::Array(_)) | Some(Value::Object(_)) => None,
    }
}

fn chart_type(value: &str) -> Result<ChartType, ArtifactError> {
    match value {
        "column" => Ok(ChartType::Column),
        "bar" => Ok(ChartType::Bar),
        "line" => Ok(ChartType::Line),
        "pie" => Ok(ChartType::Pie),
        "doughnut" => Ok(ChartType::Doughnut),
        _ => Err(ArtifactError::new(
            "unsupported_chart_type",
            format!("unsupported chart type: {value}"),
        )),
    }
}

fn chart_range(sheet_name: &str, reference: &str) -> String {
    if reference.contains('!') {
        reference.to_owned()
    } else {
        format!("{}!{}", sheet_name, reference)
    }
}

fn create_xlsx(input_path: &str, output_path: &str) -> Result<Value, ArtifactError> {
    let input = fs::read_to_string(input_path).map_err(|error| {
        ArtifactError::new(
            "input_read_error",
            format!("failed to read {input_path}: {error}"),
        )
    })?;
    let workbook_input: WorkbookInput = serde_json::from_str(&input)
        .map_err(|error| ArtifactError::new("invalid_json", error.to_string()))?;
    if workbook_input.sheets.is_empty() {
        return Err(ArtifactError::new(
            "invalid_workbook",
            "at least one sheet is required",
        ));
    }

    let mut workbook = Workbook::new();
    let mut sheet_summaries = Vec::with_capacity(workbook_input.sheets.len());
    let mut sheet_names = std::collections::HashSet::new();
    let mut formula_total = 0usize;
    let mut formula_evaluated = 0usize;
    let mut formula_unsupported = 0usize;
    let mut merge_total = 0usize;
    let mut table_total = 0usize;
    let mut chart_total = 0usize;
    for sheet_input in &workbook_input.sheets {
        if sheet_input.name.is_empty() || sheet_input.name.chars().count() > 31 {
            return Err(ArtifactError::new(
                "invalid_sheet_name",
                format!("sheet name must be 1-31 characters: {}", sheet_input.name),
            ));
        }
        if !sheet_names.insert(sheet_input.name.clone()) {
            return Err(ArtifactError::new(
                "duplicate_sheet_name",
                format!("duplicate sheet name: {}", sheet_input.name),
            ));
        }

        let worksheet = workbook.add_worksheet();
        worksheet
            .set_name(&sheet_input.name)
            .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string()))?;
        let formats = sheet_input
            .formats
            .iter()
            .map(|input| Ok((parse_a1_range(&input.range)?, build_format(input)?)))
            .collect::<Result<Vec<_>, ArtifactError>>()?;
        let formula_rows = sheet_input.formulas.len();
        if sheet_input
            .formulas
            .iter()
            .any(|row| row.len() > sheet_input.rows.first().map_or(0, Vec::len))
        {
            return Err(ArtifactError::new(
                "invalid_formula_matrix",
                format!(
                    "formula matrix exceeds value matrix on sheet {}",
                    sheet_input.name
                ),
            ));
        }
        for row_index in 0..sheet_input.rows.len().max(formula_rows) {
            let value_row = sheet_input.rows.get(row_index);
            let formula_row = sheet_input.formulas.get(row_index);
            let column_count = value_row
                .map_or(0, Vec::len)
                .max(formula_row.map_or(0, Vec::len));
            for column_index in 0..column_count {
                let formula = formula_at(sheet_input, row_index, column_index);
                let format = format_at(&formats, row_index as u32, column_index as u16);
                if let Some(formula) = formula {
                    formula_total += 1;
                    let mut formula_value = Formula::new(formula);
                    if let Some(result) =
                        formula_result(value_at(sheet_input, row_index, column_index))
                    {
                        formula_value = formula_value.set_result(result);
                        formula_evaluated += 1;
                    } else {
                        formula_unsupported += 1;
                    }
                    let row = u32::try_from(row_index).map_err(|_| {
                        ArtifactError::new("invalid_cell", "row index is too large")
                    })?;
                    let column = u16::try_from(column_index).map_err(|_| {
                        ArtifactError::new("invalid_cell", "column index is too large")
                    })?;
                    if let Some(format) = format {
                        worksheet
                            .write_formula_with_format(row, column, formula_value, format)
                            .map_err(|error| {
                                ArtifactError::new("xlsx_write_error", error.to_string())
                            })?;
                    } else {
                        worksheet
                            .write_formula(row, column, formula_value)
                            .map_err(|error| {
                                ArtifactError::new("xlsx_write_error", error.to_string())
                            })?;
                    }
                } else if let Some(cell) = value_at(sheet_input, row_index, column_index) {
                    write_cell(worksheet, row_index, column_index, cell, format)?;
                }
            }
        }
        for merge in &sheet_input.merges {
            let range = parse_a1_range(&merge.range)?;
            let text = value_at(
                sheet_input,
                range.first_row as usize,
                range.first_col as usize,
            )
            .and_then(|value| match value {
                Value::String(value) => Some(value.clone()),
                Value::Number(value) => Some(value.to_string()),
                Value::Bool(value) => Some(value.to_string()),
                Value::Null | Value::Array(_) | Value::Object(_) => None,
            })
            .unwrap_or_default();
            let default_format = Format::new();
            let format =
                format_at(&formats, range.first_row, range.first_col).unwrap_or(&default_format);
            worksheet
                .merge_range(
                    range.first_row,
                    range.first_col,
                    range.last_row,
                    range.last_col,
                    &text,
                    format,
                )
                .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string()))?;
            merge_total += 1;
        }
        for width in &sheet_input.column_widths {
            if !width.width.is_finite() || width.width <= 0.0 {
                return Err(ArtifactError::new(
                    "invalid_column_width",
                    format!("column width must be positive: {}", width.column),
                ));
            }
            let columns = width.column.split(':').collect::<Vec<_>>();
            if columns.len() > 2 {
                return Err(ArtifactError::new(
                    "invalid_column_width",
                    format!("invalid column range: {}", width.column),
                ));
            }
            let first = parse_column_reference(columns[0])?;
            let last = parse_column_reference(columns.last().unwrap_or(&columns[0]))?;
            if first > last {
                return Err(ArtifactError::new(
                    "invalid_column_width",
                    format!("column bounds are reversed: {}", width.column),
                ));
            }
            for column in first..=last {
                worksheet
                    .set_column_width(column, width.width)
                    .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string()))?;
            }
        }
        for table_input in &sheet_input.tables {
            let range = parse_a1_range(&table_input.range)?;
            let table = Table::new()
                .set_name(&table_input.name)
                .set_header_row(table_input.has_headers);
            worksheet
                .add_table(
                    range.first_row,
                    range.first_col,
                    range.last_row,
                    range.last_col,
                    &table,
                )
                .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string()))?;
            table_total += 1;
        }
        for chart_input in &sheet_input.charts {
            if chart_input.series.is_empty() {
                return Err(ArtifactError::new(
                    "invalid_chart",
                    "chart must contain at least one series",
                ));
            }
            let position = parse_a1_range(&chart_input.position)?;
            let mut chart = Chart::new(chart_type(&chart_input.chart_type)?);
            for series_input in &chart_input.series {
                let categories = chart_range(&sheet_input.name, &series_input.categories);
                let values = chart_range(&sheet_input.name, &series_input.values);
                let series = chart
                    .add_series()
                    .set_categories(&categories)
                    .set_values(&values);
                if let Some(name) = &series_input.name {
                    series.set_name(name.as_str());
                }
            }
            chart
                .set_width(u32::from(position.last_col - position.first_col + 1) * 64)
                .set_height(u32::from(position.last_row - position.first_row + 1) * 20);
            worksheet
                .insert_chart(position.first_row, position.first_col, &chart)
                .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string()))?;
            chart_total += 1;
        }
        sheet_summaries.push(json!({
            "name": sheet_input.name,
            "rows": sheet_input.rows.len(),
            "formulas": sheet_input.formulas.iter().flatten().filter(|value| value.is_some()).count(),
            "merges": sheet_input.merges.len(),
            "tables": sheet_input.tables.len(),
            "charts": sheet_input.charts.len(),
        }));
    }

    if let Some(parent) = Path::new(output_path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|error| {
                ArtifactError::new(
                    "output_write_error",
                    format!("failed to create output directory: {error}"),
                )
            })?;
        }
    }
    workbook
        .save(output_path)
        .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string()))?;

    Ok(json!({
        "ok": true,
        "format": "xlsx",
        "output": output_path,
        "sheets": sheet_summaries,
        "formulas": {
            "total": formula_total,
            "evaluated": formula_evaluated,
            "unsupported": formula_unsupported,
        },
        "objects": {
            "merges": merge_total,
            "tables": table_total,
            "charts": chart_total,
        },
    }))
}

fn write_cell(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    row: usize,
    column: usize,
    cell: &Value,
    format: Option<&Format>,
) -> Result<(), ArtifactError> {
    let row = u32::try_from(row)
        .map_err(|_| ArtifactError::new("invalid_cell", "row index is too large"))?;
    let column = u16::try_from(column)
        .map_err(|_| ArtifactError::new("invalid_cell", "column index is too large"))?;
    match cell {
        Value::Null => {
            if let Some(format) = format {
                worksheet
                    .write_blank(row, column, format)
                    .map(|_| ())
                    .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string()))
            } else {
                Ok(())
            }
        }
        Value::String(value) => if let Some(format) = format {
            worksheet.write_string_with_format(row, column, value, format)
        } else {
            worksheet.write_string(row, column, value)
        }
        .map(|_| ())
        .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string())),
        Value::Bool(value) => if let Some(format) = format {
            worksheet.write_boolean_with_format(row, column, *value, format)
        } else {
            worksheet.write_boolean(row, column, *value)
        }
        .map(|_| ())
        .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string())),
        Value::Number(value) => {
            let number = value.as_f64().ok_or_else(|| {
                ArtifactError::new("unsupported_cell_value", "number is not representable")
            })?;
            if let Some(format) = format {
                worksheet.write_number_with_format(row, column, number, format)
            } else {
                worksheet.write_number(row, column, number)
            }
            .map(|_| ())
            .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string()))
        }
        Value::Array(_) | Value::Object(_) => Err(ArtifactError::new(
            "unsupported_cell_value",
            "only strings, numbers, booleans, and null are supported",
        )),
    }
}

fn open_xlsx(path: &str) -> Result<Xlsx<std::io::BufReader<fs::File>>, ArtifactError> {
    open_workbook(path).map_err(|error| {
        ArtifactError::new("xlsx_read_error", format!("failed to read {path}: {error}"))
    })
}

fn read_xlsx(input_path: &str) -> Result<Value, ArtifactError> {
    let mut workbook = open_xlsx(input_path)?;
    let sheets = read_sheets(&mut workbook, input_path)?;
    Ok(json!({
        "ok": true,
        "format": "xlsx",
        "sheets": sheets,
    }))
}

fn validate_xlsx(input_path: &str) -> Result<Value, ArtifactError> {
    let mut workbook = open_xlsx(input_path)?;
    let sheets = workbook
        .sheet_names()
        .iter()
        .map(|name| {
            let range = workbook.worksheet_range(name).map_err(|error| {
                ArtifactError::new("xlsx_read_error", format!("failed to read {name}: {error}"))
            })?;
            let (rows, columns) = range.get_size();
            Ok(json!({
                "name": name,
                "rows": rows,
                "columns": columns,
            }))
        })
        .collect::<Result<Vec<_>, ArtifactError>>()?;
    Ok(json!({
        "ok": true,
        "valid": true,
        "format": "xlsx",
        "sheets": sheets,
    }))
}

fn read_sheets<R: std::io::Read + std::io::Seek>(
    workbook: &mut Xlsx<R>,
    input_path: &str,
) -> Result<Vec<Value>, ArtifactError> {
    workbook
        .sheet_names()
        .iter()
        .enumerate()
        .map(|(sheet_index, name)| {
            let range = workbook.worksheet_range(name).map_err(|error| {
                ArtifactError::new("xlsx_read_error", format!("failed to read {name}: {error}"))
            })?;
            let (row_count, column_count) = range.get_size();
            let mut rows = Vec::with_capacity(row_count);
            for row_index in 0..row_count {
                let mut row = Vec::with_capacity(column_count);
                for column_index in 0..column_count {
                    row.push(data_to_json(range.get((row_index, column_index))));
                }
                rows.push(Value::Array(row));
            }
            let metadata = read_xlsx_sheet_metadata(input_path, sheet_index)?;
            let formulas = read_xlsx_formulas(input_path, sheet_index, row_count, column_count)?;
            Ok(json!({
                "name": name,
                "rows": rows,
                "formulas": formulas,
                "formats": metadata.formats,
                "merges": metadata.merges,
                "tables": metadata.tables,
                "charts": metadata.charts,
                "images": metadata.images,
                "columnWidths": metadata.column_widths,
            }))
        })
        .collect()
}

#[derive(Default)]
struct XlsxSheetMetadata {
    formats: Vec<Value>,
    merges: Vec<Value>,
    tables: Vec<Value>,
    charts: Vec<Value>,
    images: Vec<Value>,
    column_widths: Vec<Value>,
}

fn read_xlsx_sheet_metadata(
    input_path: &str,
    sheet_index: usize,
) -> Result<XlsxSheetMetadata, ArtifactError> {
    let sheet_path = format!("xl/worksheets/sheet{}.xml", sheet_index + 1);
    let sheet_xml = read_xlsx_zip_text(input_path, &sheet_path)?.unwrap_or_default();
    let mut metadata = XlsxSheetMetadata::default();
    for reference in ooxml::attribute_values(&sheet_xml, "mergeCell", "ref") {
        metadata.merges.push(json!({"range": reference}));
    }
    for attributes in ooxml::elements(&sheet_xml, "col") {
        if let (Some(min), Some(max), Some(width)) = (
            attributes.get("min"),
            attributes.get("max"),
            attributes.get("width"),
        ) {
            let first = min.parse::<u32>().unwrap_or(1);
            let last = max.parse::<u32>().unwrap_or(first);
            let width = width.parse::<f64>().unwrap_or_default();
            metadata.column_widths.push(json!({
                "column": format!("{}:{}", ooxml::column_label(first), ooxml::column_label(last)),
                "width": width,
            }));
        }
    }
    for attributes in ooxml::elements(&sheet_xml, "c ") {
        if let (Some(cell), Some(style_index)) = (attributes.get("r"), attributes.get("s")) {
            metadata.formats.push(
                json!({"range": cell, "styleIndex": style_index.parse::<u32>().unwrap_or(0)}),
            );
        }
    }

    let relationships_path = format!("xl/worksheets/_rels/sheet{}.xml.rels", sheet_index + 1);
    let relationships = read_xlsx_zip_text(input_path, &relationships_path)?.unwrap_or_default();
    for relation in ooxml::elements(&relationships, "Relationship") {
        let target = relation.get("Target").cloned().unwrap_or_default();
        if target.contains("table") {
            let table_path = ooxml::normalize_target(&target, "xl/worksheets");
            if let Some(table_xml) = read_xlsx_zip_text(input_path, &table_path)? {
                if let Some(table) = ooxml::elements(&table_xml, "table").first() {
                    metadata.tables.push(json!({
                        "name": table.get("name").cloned().unwrap_or_else(|| "Table".to_string()),
                        "range": table.get("ref").cloned().unwrap_or_default(),
                        "hasHeaders": table.get("headerRowCount").map_or(true, |value| value != "0"),
                    }));
                }
            }
        } else if target.contains("drawing") {
            let drawing_path = ooxml::normalize_target(&target, "xl/worksheets");
            let drawing_relationships_path = format!(
                "{}/_rels/{}.rels",
                Path::new(&drawing_path)
                    .parent()
                    .unwrap_or(Path::new("xl"))
                    .display(),
                Path::new(&drawing_path)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("drawing1.xml")
            );
            let drawing_relationships =
                read_xlsx_zip_text(input_path, &drawing_relationships_path)?.unwrap_or_default();
            for drawing_relation in ooxml::elements(&drawing_relationships, "Relationship") {
                let drawing_target = drawing_relation.get("Target").cloned().unwrap_or_default();
                if !drawing_target.contains("chart") {
                    continue;
                }
                let chart_path = ooxml::normalize_target(
                    &drawing_target,
                    &Path::new(&drawing_path)
                        .parent()
                        .unwrap_or(Path::new("xl"))
                        .to_string_lossy(),
                );
                let chart_xml = read_xlsx_zip_text(input_path, &chart_path)?.unwrap_or_default();
                let chart_type = if chart_xml.contains("barChart") {
                    if chart_xml.contains("barDir val=\"bar\"") {
                        "bar"
                    } else {
                        "column"
                    }
                } else if chart_xml.contains("lineChart") {
                    "line"
                } else if chart_xml.contains("pieChart") {
                    "pie"
                } else if chart_xml.contains("doughnutChart") {
                    "doughnut"
                } else {
                    "chart"
                };
                metadata.charts.push(json!({
                    "type": chart_type,
                    "position": "",
                    "series": [],
                }));
            }
        }
    }
    let file = fs::File::open(input_path).map_err(|error| {
        ArtifactError::new(
            "xlsx_read_error",
            format!("failed to read {input_path}: {error}"),
        )
    })?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("xlsx_read_error", error.to_string()))?;
    for index in 0..archive.len() {
        if let Ok(entry) = archive.by_index(index) {
            let name = entry.name().to_string();
            if name.starts_with("xl/media/") {
                let mime_type = match Path::new(&name)
                    .extension()
                    .and_then(|extension| extension.to_str())
                {
                    Some("png") => "image/png",
                    Some("jpg") | Some("jpeg") => "image/jpeg",
                    Some("gif") => "image/gif",
                    _ => "application/octet-stream",
                };
                metadata.images.push(json!({
                    "name": name,
                    "mimeType": mime_type,
                    "byteSize": entry.size(),
                }));
            }
        }
    }
    Ok(metadata)
}

fn read_xlsx_formulas(
    input_path: &str,
    sheet_index: usize,
    rows: usize,
    columns: usize,
) -> Result<Vec<Vec<Value>>, ArtifactError> {
    let sheet_path = format!("xl/worksheets/sheet{}.xml", sheet_index + 1);
    let xml = read_xlsx_zip_text(input_path, &sheet_path)?.unwrap_or_default();
    let mut formulas = vec![vec![Value::Null; columns]; rows];
    let mut cursor = 0;
    while let Some(offset) = xml[cursor..].find("<c ") {
        let start = cursor + offset;
        let Some(tag_end_offset) = xml[start..].find('>') else {
            break;
        };
        let tag_end = start + tag_end_offset;
        let attributes = ooxml::parse_attributes(&xml[start + 3..tag_end]);
        let Some(cell) = attributes.get("r") else {
            cursor = tag_end + 1;
            continue;
        };
        let Some(close_offset) = xml[tag_end + 1..].find("</c>") else {
            break;
        };
        let body_end = tag_end + 1 + close_offset;
        let body = &xml[tag_end + 1..body_end];
        if let Some(formula_start) = body.find("<f") {
            if let Some(formula_open_end_offset) = body[formula_start..].find('>') {
                let formula_open_end = formula_start + formula_open_end_offset;
                let formula = body[formula_open_end + 1..]
                    .find("</f>")
                    .map(|end| body[formula_open_end + 1..formula_open_end + 1 + end].to_string());
                if let Some(formula) = formula {
                    if let Ok(range) = parse_a1_range(cell) {
                        if (range.first_row as usize) < rows && (range.first_col as usize) < columns
                        {
                            formulas[range.first_row as usize][range.first_col as usize] =
                                json!(format!("={formula}"));
                        }
                    }
                }
            }
        }
        cursor = body_end + 4;
    }
    Ok(formulas)
}

fn read_xlsx_zip_text(input_path: &str, part_path: &str) -> Result<Option<String>, ArtifactError> {
    let file = fs::File::open(input_path).map_err(|error| {
        ArtifactError::new(
            "xlsx_read_error",
            format!("failed to read {input_path}: {error}"),
        )
    })?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| ArtifactError::new("xlsx_read_error", error.to_string()))?;
    let Ok(entry) = archive.by_name(part_path) else {
        return Ok(None);
    };
    let mut contents = Vec::new();
    entry
        .take(2 * 1024 * 1024 + 1)
        .read_to_end(&mut contents)
        .map_err(|error| ArtifactError::new("xlsx_read_error", error.to_string()))?;
    if contents.len() > 2 * 1024 * 1024 {
        return Err(ArtifactError::new(
            "xlsx_read_error",
            format!("{part_path} exceeds the 2 MiB XML limit"),
        ));
    }
    Ok(Some(String::from_utf8_lossy(&contents).into_owned()))
}

fn data_to_json(cell: Option<&Data>) -> Value {
    match cell {
        None | Some(Data::Empty) => Value::Null,
        Some(Data::String(value)) => json!(value),
        Some(Data::Float(value))
            if value.fract() == 0.0 && *value >= i64::MIN as f64 && *value <= i64::MAX as f64 =>
        {
            json!(*value as i64)
        }
        Some(Data::Float(value)) => json!(value),
        Some(Data::Int(value)) => json!(value),
        Some(Data::Bool(value)) => json!(value),
        Some(Data::DateTime(value)) => json!(format!("{value:?}")),
        Some(Data::DateTimeIso(value)) => json!(value),
        Some(Data::DurationIso(value)) => json!(value),
        Some(Data::Error(value)) => json!(format!("{value:?}")),
    }
}

fn print_json(value: &Value, stderr: bool) {
    let output = serde_json::to_string(value).expect("artifact JSON is serializable");
    if stderr {
        eprintln!("{output}");
    } else {
        println!("{output}");
    }
}
