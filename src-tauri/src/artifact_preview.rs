use std::fs;
use std::path::{Path, PathBuf};

use base64::Engine;
use calamine::{Data, Reader, Xlsx, open_workbook};
use serde::Serialize;

use crate::desktop::ruxex_home;
use crate::error::{CommandResult, DesktopAppServerErrorKind, command_error};
use crate::platform;

const PREVIEW_MAX_BYTES: u64 = 16 * 1024 * 1024;
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
    format: &'static str,
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
    let home = ruxex_home().map_err(|error| {
        command_error(DesktopAppServerErrorKind::Lifecycle, error)
    })?;
    let workspace = std::env::current_dir().map_err(|error| {
        command_error(
            DesktopAppServerErrorKind::Lifecycle,
            format!("failed to resolve workspace root: {error}"),
        )
    })?;
    let canonical = validate_preview_path(&requested, &[home.as_path(), workspace.as_path()])
        .map_err(|error| command_error(DesktopAppServerErrorKind::Initialization, error))?;
    let sheets = read_preview_sheets(&canonical).map_err(|error| {
        command_error(DesktopAppServerErrorKind::Initialization, error)
    })?;
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
        format: "xlsx",
        sheets: sheets.len(),
        rows,
        columns,
    })
}

fn validate_preview_path(requested: &Path, roots: &[&Path]) -> Result<PathBuf, String> {
    if !requested.is_absolute() {
        return Err("artifact preview path must be absolute".to_string());
    }
    if !requested
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("xlsx"))
    {
        return Err("only xlsx artifacts can be previewed".to_string());
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
    let root_refs = canonical_roots.iter().map(PathBuf::as_path).collect::<Vec<_>>();
    if !platform::is_path_under_any_root(&canonical, &root_refs) {
        return Err("artifact preview path is outside the Ruxex or workspace roots".to_string());
    }
    Ok(canonical)
}

fn read_preview_sheets(path: &Path) -> Result<Vec<PreviewSheet>, String> {
    let mut workbook: Xlsx<_> = open_workbook(path)
        .map_err(|error| format!("failed to read xlsx artifact: {error:?}"))?;
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
            || sheet.cells.iter().any(|row| row.len() > PREVIEW_MAX_COLUMNS)
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
    use std::path::Path;

    use super::{PreviewSheet, escape_xml, render_svg, validate_preview_path};

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
    fn preview_path_requires_xlsx_under_an_allowed_root() {
        let root = std::env::temp_dir().join(format!("ruxex-preview-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let xlsx = root.join("report.xlsx");
        let docx = root.join("report.docx");
        fs::write(&xlsx, b"not a real workbook").unwrap();
        fs::write(&docx, b"document").unwrap();

        assert!(validate_preview_path(&xlsx, &[root.as_path()]).is_ok());
        assert!(validate_preview_path(&docx, &[root.as_path()]).is_err());
        assert!(validate_preview_path(&xlsx, &[Path::new("/home")]).is_err());
        assert!(validate_preview_path(Path::new("report.xlsx"), &[root.as_path()]).is_err());
        let _ = fs::remove_dir_all(root);
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

        let sheets = super::read_preview_sheets(&path).unwrap();
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
