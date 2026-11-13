use serde_json::{Value, json};
use std::fs;
use std::io::Read;

use super::{ArtifactError, cli};
use crate::ooxml;

pub(super) fn run_ooxml(format: &str, args: &[String]) -> Result<Value, ArtifactError> {
    let Some(operation) = args.first().map(String::as_str) else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            format!("a {format} operation is required"),
        ));
    };
    let flags = cli::parse_flags(&args[1..])?;
    for (flag, _) in &flags {
        if !matches!(flag.as_str(), "input" | "--json") {
            return Err(ArtifactError::new(
                "invalid_arguments",
                format!("unknown flag: --{flag}"),
            ));
        }
    }
    match operation {
        "read" => read_ooxml(format, cli::required_flag(&flags, "input")?),
        "validate" => inspect_ooxml(format, cli::required_flag(&flags, "input")?),
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

pub(super) fn inspect_ooxml(format: &str, input_path: &str) -> Result<Value, ArtifactError> {
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

pub(super) fn read_ooxml(format: &str, input_path: &str) -> Result<Value, ArtifactError> {
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
            let objects = ooxml::text_values(&xml, "a:t")
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
    let tables = ooxml::blocks(xml, "w:tbl");
    for paragraph in ooxml::blocks(xml, "w:p") {
        if tables.iter().any(|table| table.contains(&paragraph)) {
            continue;
        }
        let text = ooxml::text_values(&paragraph, "w:t").join("");
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
            items.push(json!({"kind": "table", "rows": rows}));
        }
    }
    items
}
