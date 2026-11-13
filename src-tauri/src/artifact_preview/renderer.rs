use base64::Engine;

use super::{PREVIEW_MAX_COLUMNS, PREVIEW_MAX_ROWS, PreviewSheet};

const CELL_WIDTH: usize = 160;
const ROW_HEIGHT: usize = 30;
const SHEET_HEADER_HEIGHT: usize = 42;
const PADDING: usize = 16;

pub(super) fn svg_data_url(svg: &str) -> String {
    format!(
        "data:image/svg+xml;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(svg.as_bytes())
    )
}

pub(super) fn render_svg(sheets: &[PreviewSheet]) -> String {
    let (width, height) = svg_dimensions(sheets);
    let max_columns = sheets
        .iter()
        .map(|sheet| sheet.cells.iter().map(Vec::len).max().unwrap_or(0).max(1))
        .max()
        .unwrap_or(1)
        .min(PREVIEW_MAX_COLUMNS);
    debug_assert_eq!(width, PADDING * 2 + max_columns * CELL_WIDTH);

    let mut svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{width}\" height=\"{height}\" viewBox=\"0 0 {width} {height}\">"
    );
    svg.push_str("<rect width=\"100%\" height=\"100%\" fill=\"#f8fafc\"/>");
    let mut y = PADDING;
    for sheet in sheets {
        let rows = sheet.cells.len().max(1).min(PREVIEW_MAX_ROWS);
        let annotation_height = sheet.annotations.len().min(8) * 20;
        svg.push_str(&format!(
            "<rect x=\"{PADDING}\" y=\"{y}\" width=\"{}\" height=\"{}\" rx=\"8\" fill=\"#ffffff\" stroke=\"#cbd5e1\"/>",
            width - PADDING * 2,
            SHEET_HEADER_HEIGHT + ROW_HEIGHT * rows + annotation_height
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
        for (index, annotation) in sheet.annotations.iter().take(8).enumerate() {
            svg.push_str(&format!(
                "<text x=\"{}\" y=\"{}\" font-family=\"sans-serif\" font-size=\"12\" fill=\"#475569\">{}</text>",
                PADDING + 8,
                grid_y + rows * ROW_HEIGHT + 16 + index * 20,
                escape_xml(annotation)
            ));
        }
        y += SHEET_HEADER_HEIGHT + ROW_HEIGHT * rows + annotation_height + PADDING;
    }
    svg.push_str("</svg>");
    svg
}

pub(super) fn svg_dimensions(sheets: &[PreviewSheet]) -> (usize, usize) {
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
        let annotation_height = sheet.annotations.len().min(8) * 20;
        height += SHEET_HEADER_HEIGHT + ROW_HEIGHT * rows + annotation_height + PADDING;
    }
    (width, height)
}

pub(super) fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
