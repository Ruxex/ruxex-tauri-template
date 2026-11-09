use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use base64::Engine;
use calamine::{Data, Reader, Xlsx, open_workbook};
use serde::Serialize;

use crate::desktop::ruxex_home;
use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::platform;

const PREVIEW_MAX_BYTES: u64 = 16 * 1024 * 1024;
const PREVIEW_MAX_XML_BYTES: u64 = 2 * 1024 * 1024;
const PREVIEW_MAX_SHEETS: usize = 4;
const PREVIEW_MAX_ROWS: usize = 60;
const PREVIEW_MAX_COLUMNS: usize = 16;
const CELL_WIDTH: usize = 160;
const ROW_HEIGHT: usize = 30;
const SHEET_HEADER_HEIGHT: usize = 42;
const PADDING: usize = 16;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ArtifactPreview {
    mime_type: &'static str,
    data_url: String,
    format: String,
    sheets: usize,
    rows: usize,
    columns: usize,
}

#[derive(Debug)]
pub(crate) struct PreviewSheet {
    name: String,
    cells: Vec<Vec<String>>,
}

#[tauri::command]
pub(crate) fn preview_artifact(path: String) -> CommandResult<ArtifactPreview> {
    let requested = PathBuf::from(&path);
    let home =
        ruxex_home().map_err(|error| command_error(DesktopAppServerErrorKind::Lifecycle, error))?;
    let workspace = std::env::current_dir().map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to resolve workspace root: {error}"),
        )
    })?;
    let canonical = validate_preview_path(&requested, &[home.as_path(), workspace.as_path()])
        .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))?;
    let format = preview_format(&canonical)
        .expect("preview path validation guarantees a supported extension")
        .to_string();
    let sheets = read_preview_sections(&canonical)
        .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))?;
    let rows = sheets.iter().map(|sheet| sheet.cells.len()).sum();
    let columns = sheets
        .iter()
        .map(|sheet| sheet.cells.iter().map(Vec::len).max().unwrap_or(0))
        .max()
        .unwrap_or(0);
    let svg = render_svg(&sheets);
    let data_url = format!(
        "data:image/svg+xml;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(svg.as_bytes())
    );
    Ok(ArtifactPreview {
        mime_type: "image/svg+xml",
        data_url,
        format,
        sheets: sheets.len(),
        rows,
        columns,
    })
}

fn validate_preview_path(requested: &Path, roots: &[&Path]) -> Result<PathBuf, String> {
    if !requested.is_absolute() {
        return Err("artifact preview path must be absolute".to_string());
    }
    if preview_format(requested).is_none() {
        return Err("only xlsx, docx, and pptx artifacts can be previewed".to_string());
    }
    let metadata = fs::symlink_metadata(requested)
        .map_err(|error| format!("artifact preview file cannot be opened: {error}"))?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err("artifact preview path must be a regular file".to_string());
    }
    if metadata.len() > PREVIEW_MAX_BYTES {
        return Err("artifact preview file exceeds the 16 MiB limit".to_string());
    }
    let canonical = requested
        .canonicalize()
        .map_err(|error| format!("artifact preview path cannot be resolved: {error}"))?;
    let canonical_roots = roots
        .iter()
        .filter_map(|root| root.canonicalize().ok())
        .collect::<Vec<_>>();
    let root_refs = canonical_roots
        .iter()
        .map(PathBuf::as_path)
        .collect::<Vec<_>>();
    if !platform::is_path_under_any_root(&canonical, &root_refs) {
        return Err("artifact preview path is outside the Ruxex or workspace roots".to_string());
    }
    Ok(canonical)
}

fn preview_format(path: &Path) -> Option<&'static str> {
    let extension = path.extension()?.to_str()?;
    match extension.to_ascii_lowercase().as_str() {
        "xlsx" => Some("xlsx"),
        "docx" => Some("docx"),
        "pptx" => Some("pptx"),
        _ => None,
    }
}

fn read_preview_sections(path: &Path) -> Result<Vec<PreviewSheet>, String> {
    match preview_format(path) {
        Some("xlsx") => read_xlsx_sections(path),
        Some("docx") => read_ooxml_sections(path, "docx"),
        Some("pptx") => read_ooxml_sections(path, "pptx"),
        _ => Err("unsupported artifact preview format".to_string()),
    }
}

fn read_xlsx_sections(path: &Path) -> Result<Vec<PreviewSheet>, String> {
    let mut workbook: Xlsx<_> =
        open_workbook(path).map_err(|error| format!("failed to read xlsx artifact: {error:?}"))?;
    let mut sheets = Vec::new();
    for name in workbook.sheet_names().into_iter().take(PREVIEW_MAX_SHEETS) {
        let range = workbook
            .worksheet_range(&name)
            .map_err(|error| format!("failed to read worksheet {name}: {error:?}"))?;
        let cells = range
            .rows()
            .take(PREVIEW_MAX_ROWS)
            .map(|row| {
                row.iter()
                    .take(PREVIEW_MAX_COLUMNS)
                    .map(display_cell)
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        sheets.push(PreviewSheet { name, cells });
    }
    if sheets.is_empty() {
        return Err("xlsx artifact contains no worksheets".to_string());
    }
    Ok(sheets)
}

fn read_ooxml_sections(path: &Path, format: &str) -> Result<Vec<PreviewSheet>, String> {
    let file = fs::File::open(path)
        .map_err(|error| format!("failed to open {format} artifact: {error}"))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| format!("failed to read {format} package: {error}"))?;
    let entries = if format == "docx" {
        vec!["word/document.xml".to_string()]
    } else {
        let mut entries = (0..archive.len())
            .filter_map(|index| {
                archive
                    .by_index(index)
                    .ok()
                    .map(|entry| entry.name().to_string())
            })
            .filter(|name| pptx_slide_number(name).is_some())
            .collect::<Vec<_>>();
        entries.sort_by_key(|name| pptx_slide_number(name).unwrap_or(usize::MAX));
        entries.truncate(PREVIEW_MAX_SHEETS);
        entries
    };
    if entries.is_empty() {
        return Err(format!(
            "{format} artifact contains no previewable text parts"
        ));
    }
    let tag = if format == "docx" { "w:t" } else { "a:t" };
    let mut sections = Vec::new();
    for (index, entry_name) in entries.iter().enumerate() {
        let entry = archive
            .by_name(entry_name)
            .map_err(|error| format!("failed to read {entry_name}: {error}"))?;
        let mut xml = String::new();
        entry
            .take(PREVIEW_MAX_XML_BYTES + 1)
            .read_to_string(&mut xml)
            .map_err(|error| format!("failed to decode {entry_name}: {error}"))?;
        if xml.len() as u64 > PREVIEW_MAX_XML_BYTES {
            return Err(format!("{entry_name} exceeds the preview text limit"));
        }
        let lines = extract_xml_text(&xml, tag);
        let cells = if lines.is_empty() {
            vec![vec!["(no text found)".to_string()]]
        } else {
            lines.into_iter().map(|line| vec![line]).collect()
        };
        sections.push(PreviewSheet {
            name: if format == "docx" {
                "Document".to_string()
            } else {
                format!("Slide {}", index + 1)
            },
            cells,
        });
    }
    Ok(sections)
}

fn pptx_slide_number(name: &str) -> Option<usize> {
    name.strip_prefix("ppt/slides/slide")?
        .strip_suffix(".xml")?
        .parse()
        .ok()
}

fn extract_xml_text(xml: &str, tag: &str) -> Vec<String> {
    let opening = format!("<{tag}");
    let closing = format!("</{tag}>");
    let mut cursor = 0;
    let mut values = Vec::new();
    while let Some(open_start) = xml[cursor..].find(&opening) {
        let open_start = cursor + open_start;
        let tag_suffix = xml[open_start + opening.len()..].chars().next();
        let valid_tag_suffix = match tag_suffix {
            Some('>') => true,
            Some(char) => char.is_ascii_whitespace(),
            None => false,
        };
        if !valid_tag_suffix {
            cursor = open_start + opening.len();
            continue;
        }
        let Some(open_end_offset) = xml[open_start..].find('>') else {
            break;
        };
        let content_start = open_start + open_end_offset + 1;
        let Some(close_offset) = xml[content_start..].find(&closing) else {
            break;
        };
        let content_end = content_start + close_offset;
        values.push(truncate_text(
            &decode_xml_entities(&xml[content_start..content_end]),
            80,
        ));
        cursor = content_end + closing.len();
    }
    values
}

fn decode_xml_entities(value: &str) -> String {
    value
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

fn display_cell(value: &Data) -> String {
    truncate_text(&value.to_string(), 80)
}

fn truncate_text(value: &str, limit: usize) -> String {
    let mut chars = value.chars();
    let result = chars.by_ref().take(limit).collect::<String>();
    if chars.next().is_some() {
        format!("{result}…")
    } else {
        result
    }
}

fn render_svg(sheets: &[PreviewSheet]) -> String {
    let max_columns = sheets
        .iter()
        .map(|sheet| sheet.cells.iter().map(Vec::len).max().unwrap_or(0).max(1))
        .max()
        .unwrap_or(1)
        .min(PREVIEW_MAX_COLUMNS);
    let width = PADDING * 2 + max_columns * CELL_WIDTH;
    let mut height = PADDING;
    for sheet in sheets {
        let rows = sheet.cells.len().max(1).min(PREVIEW_MAX_ROWS);
        height += SHEET_HEADER_HEIGHT + ROW_HEIGHT * rows + PADDING;
    }

    let mut svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{width}\" height=\"{height}\" viewBox=\"0 0 {width} {height}\">"
    );
    svg.push_str("<rect width=\"100%\" height=\"100%\" fill=\"#f8fafc\"/>");
    let mut y = PADDING;
    for sheet in sheets {
        let rows = sheet.cells.len().max(1).min(PREVIEW_MAX_ROWS);
        svg.push_str(&format!(
            "<rect x=\"{PADDING}\" y=\"{y}\" width=\"{}\" height=\"{}\" rx=\"8\" fill=\"#ffffff\" stroke=\"#cbd5e1\"/>",
            width - PADDING * 2,
            SHEET_HEADER_HEIGHT + ROW_HEIGHT * rows
        ));
        svg.push_str(&format!(
            "<text x=\"{}\" y=\"{}\" font-family=\"sans-serif\" font-size=\"18\" font-weight=\"700\" fill=\"#0f172a\">{}</text>",
            PADDING + 12,
            y + 27,
            escape_xml(&sheet.name)
        ));
        let grid_y = y + SHEET_HEADER_HEIGHT;
        for row in 0..rows {
            let row_values = sheet.cells.get(row).map(Vec::as_slice).unwrap_or(&[]);
            for column in 0..max_columns {
                let x = PADDING + column * CELL_WIDTH;
                let cell_y = grid_y + row * ROW_HEIGHT;
                let value = row_values.get(column).map(String::as_str).unwrap_or("");
                svg.push_str(&format!(
                    "<rect x=\"{x}\" y=\"{cell_y}\" width=\"{CELL_WIDTH}\" height=\"{ROW_HEIGHT}\" fill=\"{}\" stroke=\"#e2e8f0\"/>",
                    if row == 0 { "#f1f5f9" } else { "#ffffff" }
                ));
                if !value.is_empty() {
                    svg.push_str(&format!(
                        "<text x=\"{}\" y=\"{}\" font-family=\"sans-serif\" font-size=\"13\" fill=\"#1e293b\">{}</text>",
                        x + 8,
                        cell_y + 20,
                        escape_xml(value)
                    ));
                }
            }
        }
        if sheet.cells.len() > PREVIEW_MAX_ROWS
            || sheet
                .cells
                .iter()
                .any(|row| row.len() > PREVIEW_MAX_COLUMNS)
        {
            svg.push_str(&format!(
                "<text x=\"{}\" y=\"{}\" font-family=\"sans-serif\" font-size=\"12\" fill=\"#64748b\">Preview truncated</text>",
                PADDING + 8,
                grid_y + rows * ROW_HEIGHT - 8
            ));
        }
        y += SHEET_HEADER_HEIGHT + ROW_HEIGHT * rows + PADDING;
    }
    svg.push_str("</svg>");
    svg
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::io::Write;
    use std::path::Path;

    use super::{
        PreviewSheet, escape_xml, read_preview_sections, render_svg, validate_preview_path,
    };

    #[test]
    fn svg_escapes_sheet_and_cell_text() {
        let svg = render_svg(&[PreviewSheet {
            name: "<sheet>".to_string(),
            cells: vec![vec!["<&\"'".to_string()]],
        }]);

        assert!(svg.contains("&lt;sheet&gt;"));
        assert!(svg.contains("&lt;&amp;&quot;&apos;"));
        assert!(!svg.contains("<sheet>"));
    }

    #[test]
    fn svg_is_bounded_for_large_sheets() {
        let cells = (0..100)
            .map(|row| (0..100).map(|column| format!("{row}:{column}")).collect())
            .collect();
        let svg = render_svg(&[PreviewSheet {
            name: "Large".to_string(),
            cells,
        }]);

        assert!(svg.contains("Preview truncated"));
        assert!(svg.contains("width=\"2592\""));
    }

    #[test]
    fn preview_path_accepts_supported_office_formats_under_an_allowed_root() {
        let root = std::env::temp_dir().join(format!("ruxex-preview-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let xlsx = root.join("report.xlsx");
        let docx = root.join("report.docx");
        let pptx = root.join("report.pptx");
        fs::write(&xlsx, b"not a real workbook").unwrap();
        fs::write(&docx, b"document").unwrap();
        fs::write(&pptx, b"presentation").unwrap();

        assert!(validate_preview_path(&xlsx, &[root.as_path()]).is_ok());
        assert!(validate_preview_path(&docx, &[root.as_path()]).is_ok());
        assert!(validate_preview_path(&pptx, &[root.as_path()]).is_ok());
        assert!(validate_preview_path(&xlsx, &[Path::new("/home")]).is_err());
        assert!(validate_preview_path(Path::new("report.xlsx"), &[root.as_path()]).is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn extracts_docx_text_runs_without_executing_markup() {
        let root = std::env::temp_dir().join(format!("ruxex-preview-docx-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let path = root.join("report.docx");
        write_zip(
            &path,
            &[(
                "word/document.xml",
                br#"<w:document><w:body><w:p><w:r><w:t>Budget &amp; Q4</w:t></w:r></w:p><w:p><w:r><w:t>&lt;safe&gt;</w:t></w:r></w:p></w:body></w:document>"#,
            )],
        );

        let sections = read_preview_sections(&path).unwrap();
        assert_eq!(sections[0].name, "Document");
        assert_eq!(sections[0].cells[0][0], "Budget & Q4");
        assert_eq!(sections[0].cells[1][0], "<safe>");
        let svg = render_svg(&sections);
        assert!(svg.contains("Budget &amp; Q4"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn extracts_each_pptx_slide_as_a_preview_section() {
        let root = std::env::temp_dir().join(format!("ruxex-preview-pptx-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let path = root.join("report.pptx");
        write_zip(
            &path,
            &[
                (
                    "ppt/slides/slide1.xml",
                    br#"<p:sld><p:cSld><a:t>Quarterly Review</a:t></p:cSld></p:sld>"#,
                ),
                (
                    "ppt/slides/slide2.xml",
                    br#"<p:sld><p:cSld><a:t>Next steps</a:t></p:cSld></p:sld>"#,
                ),
            ],
        );

        let sections = read_preview_sections(&path).unwrap();
        assert_eq!(sections.len(), 2);
        assert_eq!(sections[0].name, "Slide 1");
        assert_eq!(sections[1].cells[0][0], "Next steps");
        let _ = fs::remove_dir_all(root);
    }

    fn write_zip(path: &Path, entries: &[(&str, &[u8])]) {
        let file = fs::File::create(path).unwrap();
        let mut archive = zip::ZipWriter::new(file);
        for (name, contents) in entries {
            archive
                .start_file(*name, zip::write::SimpleFileOptions::default())
                .unwrap();
            archive.write_all(contents).unwrap();
        }
        archive.finish().unwrap();
    }

    #[test]
    fn reads_scalar_xlsx_values_for_the_image_preview() {
        let root = std::env::temp_dir().join(format!("ruxex-preview-xlsx-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let path = root.join("report.xlsx");
        let mut workbook = rust_xlsxwriter::Workbook::new();
        let worksheet = workbook.add_worksheet();
        worksheet.write_string(0, 0, "Name").unwrap();
        worksheet.write_string(1, 0, "Ada <3").unwrap();
        worksheet.write_number(1, 1, 3.0).unwrap();
        workbook.save(&path).unwrap();

        let sheets = read_preview_sections(&path).unwrap();
        let svg = render_svg(&sheets);
        assert_eq!(sheets[0].cells[1][0], "Ada <3");
        assert!(svg.contains("Ada &lt;3"));
        assert!(svg.contains("3"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn escape_xml_escapes_all_markup_sensitive_characters() {
        assert_eq!(escape_xml("<&\"'>"), "&lt;&amp;&quot;&apos;&gt;");
    }
}
