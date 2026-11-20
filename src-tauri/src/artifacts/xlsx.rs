use std::fs;
use std::io::Read;
use std::path::Path;

use crate::ooxml;
use base64::Engine;
use calamine::{Data, Reader, Xls, Xlsx, open_workbook};
use rust_xlsxwriter::{
    Chart, ChartType, Color, ConditionalFormatCell, ConditionalFormatCellRule, DataValidation,
    DataValidationRule, Format, FormatAlign, Formula, Image, IntoDataValidationValue, Note, Table,
    Workbook,
};
use serde::Deserialize;
use serde_json::{Value, json};

use super::{ArtifactError, cli};

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
    #[serde(default)]
    data_validations: Vec<Value>,
    #[serde(default)]
    conditional_formats: Vec<Value>,
    #[serde(default)]
    images: Vec<Value>,
    #[serde(default)]
    notes: Vec<Value>,
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
    #[serde(default = "default_table_style")]
    style: String,
    #[serde(default)]
    show_totals: bool,
    #[serde(default)]
    show_banded_columns: bool,
    #[serde(default = "default_true")]
    show_banded_rows: bool,
    #[serde(default = "default_true")]
    show_filter_button: bool,
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

fn default_table_style() -> String {
    "TableStyleMedium2".to_owned()
}

pub(super) fn run_xlsx(args: &[String]) -> Result<Value, ArtifactError> {
    let Some(operation) = args.first().map(String::as_str) else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "an xlsx operation is required",
        ));
    };
    let flags = cli::parse_flags(&args[1..])?;
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
            cli::required_flag(&flags, "input")?,
            cli::required_flag(&flags, "output")?,
        ),
        "read" => read_xlsx(cli::required_flag(&flags, "input")?),
        "validate" => validate_xlsx(cli::required_flag(&flags, "input")?),
        _ => Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown xlsx operation: {operation}"),
        )),
    }
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

fn write_data_validation(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    input: &Value,
) -> Result<(), ArtifactError> {
    let range_text = input.get("range").and_then(Value::as_str).ok_or_else(|| {
        ArtifactError::new("invalid_data_validation", "validation range is required")
    })?;
    let range = parse_a1_range(range_text)?;
    let rule = input
        .get("rule")
        .and_then(Value::as_object)
        .ok_or_else(|| {
            ArtifactError::new("invalid_data_validation", "validation rule is required")
        })?;
    let kind = rule.get("type").and_then(Value::as_str).unwrap_or_default();
    let validation = match kind {
        "list" => {
            if let Some(values) = rule.get("values").and_then(Value::as_array) {
                let strings = values
                    .iter()
                    .map(|value| {
                        value.as_str().map(str::to_owned).ok_or_else(|| {
                            ArtifactError::new(
                                "invalid_data_validation",
                                "list values must be strings",
                            )
                        })
                    })
                    .collect::<Result<Vec<_>, _>>()?;
                DataValidation::new()
                    .allow_list_strings(&strings)
                    .map_err(|error| {
                        ArtifactError::new("invalid_data_validation", error.to_string())
                    })?
            } else {
                let formula = rule
                    .get("formula1")
                    .and_then(Value::as_str)
                    .ok_or_else(|| {
                        ArtifactError::new(
                            "invalid_data_validation",
                            "list source formula is required",
                        )
                    })?;
                let formula = if formula.starts_with('=') {
                    formula.to_owned()
                } else {
                    format!("={formula}")
                };
                DataValidation::new().allow_list_formula(Formula::new(formula))
            }
        }
        "whole" | "decimal" => {
            let operator = rule
                .get("operator")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let first = rule
                .get("formula1")
                .and_then(Value::as_f64)
                .ok_or_else(|| {
                    ArtifactError::new(
                        "invalid_data_validation",
                        "numeric validation formula1 must be a number",
                    )
                })?;
            let second = rule.get("formula2").and_then(Value::as_f64);
            if (operator == "between" || operator == "notBetween") && second.is_none() {
                return Err(ArtifactError::new(
                    "invalid_data_validation",
                    "between validation requires formula2",
                ));
            }
            if kind == "whole" {
                let first = first as i32;
                let second = second.map(|value| value as i32);
                let rule = validation_rule(operator, first, second)?;
                DataValidation::new().allow_whole_number(rule)
            } else {
                let rule = validation_rule(operator, first, second)?;
                DataValidation::new().allow_decimal_number(rule)
            }
        }
        _ => {
            return Err(ArtifactError::new(
                "invalid_data_validation",
                format!("unsupported validation type: {kind}"),
            ));
        }
    };
    worksheet
        .add_data_validation(
            range.first_row,
            range.first_col,
            range.last_row,
            range.last_col,
            &validation,
        )
        .map(|_| ())
        .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string()))
}

fn validation_rule<T: Copy + IntoDataValidationValue>(
    operator: &str,
    first: T,
    second: Option<T>,
) -> Result<DataValidationRule<T>, ArtifactError> {
    use DataValidationRule as Rule;
    match (operator, second) {
        ("between", Some(second)) => Ok(Rule::Between(first, second)),
        ("notBetween", Some(second)) => Ok(Rule::NotBetween(first, second)),
        ("equal", _) => Ok(Rule::EqualTo(first)),
        ("notEqual", _) => Ok(Rule::NotEqualTo(first)),
        ("greaterThan", _) => Ok(Rule::GreaterThan(first)),
        ("greaterThanOrEqual", _) => Ok(Rule::GreaterThanOrEqualTo(first)),
        ("lessThan", _) => Ok(Rule::LessThan(first)),
        ("lessThanOrEqual", _) => Ok(Rule::LessThanOrEqualTo(first)),
        _ => Err(ArtifactError::new(
            "invalid_data_validation",
            format!("unsupported validation operator: {operator}"),
        )),
    }
}

fn write_conditional_format(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    input: &Value,
) -> Result<(), ArtifactError> {
    let range_text = input.get("range").and_then(Value::as_str).ok_or_else(|| {
        ArtifactError::new(
            "invalid_conditional_format",
            "conditional format range is required",
        )
    })?;
    let range = parse_a1_range(range_text)?;
    let operator = input
        .get("operator")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let first = input
        .get("formula")
        .and_then(Value::as_f64)
        .ok_or_else(|| {
            ArtifactError::new(
                "invalid_conditional_format",
                "conditional formula must be numeric",
            )
        })?;
    let second = input.get("formula2").and_then(Value::as_f64);
    let rule = match (operator, second) {
        ("between", Some(second)) => ConditionalFormatCellRule::Between(first, second),
        ("notBetween", Some(second)) => ConditionalFormatCellRule::NotBetween(first, second),
        ("equal", _) => ConditionalFormatCellRule::EqualTo(first),
        ("notEqual", _) => ConditionalFormatCellRule::NotEqualTo(first),
        ("greaterThan", _) => ConditionalFormatCellRule::GreaterThan(first),
        ("greaterThanOrEqual", _) => ConditionalFormatCellRule::GreaterThanOrEqualTo(first),
        ("lessThan", _) => ConditionalFormatCellRule::LessThan(first),
        ("lessThanOrEqual", _) => ConditionalFormatCellRule::LessThanOrEqualTo(first),
        _ => {
            return Err(ArtifactError::new(
                "invalid_conditional_format",
                format!("unsupported conditional format operator: {operator}"),
            ));
        }
    };
    if matches!(operator, "between" | "notBetween") && second.is_none() {
        return Err(ArtifactError::new(
            "invalid_conditional_format",
            "between rules require formula2",
        ));
    }
    let format_value = input.get("format").cloned().unwrap_or_else(|| json!({}));
    let format_input: FormatInput = serde_json::from_value(json!({
        "range": range_text,
        "font": format_value.get("font"),
        "fill": format_value.get("fill"),
        "number_format": format_value.get("numberFormat"),
    }))
    .map_err(|error| ArtifactError::new("invalid_conditional_format", error.to_string()))?;
    let format = build_format(&format_input)?;
    let conditional = ConditionalFormatCell::new()
        .set_rule(rule)
        .set_format(format);
    worksheet
        .add_conditional_format(
            range.first_row,
            range.first_col,
            range.last_row,
            range.last_col,
            &conditional,
        )
        .map(|_| ())
        .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string()))
}

fn write_image(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    input: &Value,
) -> Result<(), ArtifactError> {
    let data_url = input
        .get("dataUrl")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            ArtifactError::new(
                "invalid_image",
                "image data URL is required for XLSX export",
            )
        })?;
    let (header, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| ArtifactError::new("invalid_image", "image data URL is malformed"))?;
    if !header.eq_ignore_ascii_case("data:image/png;base64")
        && !header.eq_ignore_ascii_case("data:image/jpeg;base64")
        && !header.eq_ignore_ascii_case("data:image/jpg;base64")
    {
        return Err(ArtifactError::new(
            "invalid_image",
            "only PNG and JPEG images are supported",
        ));
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|error| ArtifactError::new("invalid_image", error.to_string()))?;
    let anchor = input
        .get("anchor")
        .and_then(Value::as_object)
        .ok_or_else(|| ArtifactError::new("invalid_image", "image anchor is required"))?;
    let from = anchor
        .get("from")
        .and_then(Value::as_object)
        .ok_or_else(|| {
            ArtifactError::new("invalid_image", "image anchor from position is required")
        })?;
    let extent = anchor
        .get("extent")
        .and_then(Value::as_object)
        .ok_or_else(|| ArtifactError::new("invalid_image", "image anchor extent is required"))?;
    let row = from
        .get("row")
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .ok_or_else(|| {
            ArtifactError::new("invalid_image", "image row must be a non-negative integer")
        })?;
    let column = from
        .get("col")
        .and_then(Value::as_u64)
        .and_then(|value| u16::try_from(value).ok())
        .ok_or_else(|| {
            ArtifactError::new(
                "invalid_image",
                "image column must be a non-negative integer",
            )
        })?;
    let width = extent
        .get("widthPx")
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .filter(|value| *value > 0)
        .ok_or_else(|| {
            ArtifactError::new("invalid_image", "image width must be a positive integer")
        })?;
    let height = extent
        .get("heightPx")
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .filter(|value| *value > 0)
        .ok_or_else(|| {
            ArtifactError::new("invalid_image", "image height must be a positive integer")
        })?;
    let image = Image::new_from_buffer(&bytes)
        .map_err(|error| ArtifactError::new("invalid_image", error.to_string()))?
        .set_width(width)
        .set_height(height);
    worksheet
        .insert_image(row, column, &image)
        .map(|_| ())
        .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string()))
}

fn write_note(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    input: &Value,
) -> Result<(), ArtifactError> {
    let address = input
        .get("cell")
        .and_then(Value::as_str)
        .ok_or_else(|| ArtifactError::new("invalid_note", "note cell address is required"))?;
    let range = parse_a1_range(address)?;
    if range.first_row != range.last_row || range.first_col != range.last_col {
        return Err(ArtifactError::new(
            "invalid_note",
            "note target must be a single cell",
        ));
    }
    let text = input
        .get("text")
        .and_then(Value::as_str)
        .ok_or_else(|| ArtifactError::new("invalid_note", "note text is required"))?;
    let author = input
        .get("author")
        .and_then(Value::as_str)
        .unwrap_or("Author");
    let note = Note::new(text).set_author(author);
    worksheet
        .insert_note(range.first_row, range.first_col, &note)
        .map(|_| ())
        .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string()))
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

pub(super) fn create_xlsx(input_path: &str, output_path: &str) -> Result<Value, ArtifactError> {
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
        for validation in &sheet_input.data_validations {
            write_data_validation(worksheet, validation)?;
        }
        for conditional_format in &sheet_input.conditional_formats {
            write_conditional_format(worksheet, conditional_format)?;
        }
        for image in &sheet_input.images {
            write_image(worksheet, image)?;
        }
        for note in &sheet_input.notes {
            write_note(worksheet, note)?;
        }
        for table_input in &sheet_input.tables {
            let range = parse_a1_range(&table_input.range)?;
            if table_input.style != "TableStyleMedium2" {
                return Err(ArtifactError::new(
                    "unsupported_table_style",
                    format!("unsupported table style: {}", table_input.style),
                ));
            }
            let table = Table::new()
                .set_name(&table_input.name)
                .set_header_row(table_input.has_headers)
                .set_total_row(table_input.show_totals)
                .set_banded_columns(table_input.show_banded_columns)
                .set_banded_rows(table_input.show_banded_rows)
                .set_autofilter(table_input.show_filter_button);
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

pub(super) fn read_xlsx(input_path: &str) -> Result<Value, ArtifactError> {
    if Path::new(input_path)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("xls"))
    {
        let mut workbook: Xls<std::io::BufReader<fs::File>> =
            open_workbook(input_path).map_err(|error| {
                ArtifactError::new(
                    "xls_read_error",
                    format!("failed to read {input_path}: {error}"),
                )
            })?;
        let sheets = read_legacy_xls_sheets(&mut workbook)?;
        return Ok(json!({ "ok": true, "format": "xls", "sheets": sheets }));
    }
    let mut workbook = open_xlsx(input_path)?;
    let sheets = read_sheets(&mut workbook, input_path)?;
    Ok(json!({
        "ok": true,
        "format": "xlsx",
        "sheets": sheets,
    }))
}

pub(super) fn validate_xlsx(input_path: &str) -> Result<Value, ArtifactError> {
    if Path::new(input_path)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("xls"))
    {
        let mut workbook: Xls<std::io::BufReader<fs::File>> =
            open_workbook(input_path).map_err(|error| {
                ArtifactError::new(
                    "xls_read_error",
                    format!("failed to read {input_path}: {error}"),
                )
            })?;
        let sheets = workbook
            .sheet_names()
            .iter()
            .map(|name| {
                let range = workbook.worksheet_range(name).map_err(|error| {
                    ArtifactError::new("xls_read_error", format!("failed to read {name}: {error}"))
                })?;
                let (rows, columns) = range.get_size();
                Ok(json!({ "name": name, "rows": rows, "columns": columns }))
            })
            .collect::<Result<Vec<_>, ArtifactError>>()?;
        return Ok(json!({ "ok": true, "valid": true, "format": "xls", "sheets": sheets }));
    }
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

fn read_legacy_xls_sheets(
    workbook: &mut Xls<std::io::BufReader<fs::File>>,
) -> Result<Vec<Value>, ArtifactError> {
    workbook
        .sheet_names()
        .iter()
        .map(|name| {
            let range = workbook.worksheet_range(name).map_err(|error| {
                ArtifactError::new("xls_read_error", format!("failed to read {name}: {error}"))
            })?;
            let (row_count, column_count) = range.get_size();
            let rows = (0..row_count)
                .map(|row_index| {
                    Value::Array(
                        (0..column_count)
                            .map(|column_index| data_to_json(range.get((row_index, column_index))))
                            .collect(),
                    )
                })
                .collect::<Vec<_>>();
            Ok(json!({
                "name": name,
                "rows": rows,
                "formulas": [],
                "formats": [],
                "merges": [],
                "tables": [],
                "charts": [],
                "images": [],
                "columnWidths": [],
            }))
        })
        .collect()
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
                    let table_style = ooxml::elements(&table_xml, "tableStyleInfo")
                        .first()
                        .cloned()
                        .unwrap_or_default();
                    metadata.tables.push(json!({
                        "name": table.get("name").cloned().unwrap_or_else(|| "Table".to_string()),
                        "range": table.get("ref").cloned().unwrap_or_default(),
                        "hasHeaders": table.get("headerRowCount").map_or(true, |value| value != "0"),
                        "style": table_style.get("name").cloned().unwrap_or_else(default_table_style),
                        "showTotals": table.get("totalsRowCount").is_some_and(|value| value == "1"),
                        "showBandedColumns": table_style.get("showColumnStripes").is_some_and(|value| value == "1"),
                        "showBandedRows": table_style.get("showRowStripes").is_none_or(|value| value != "0"),
                        "showFilterButton": table_xml.contains("<autoFilter"),
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_path(label: &str) -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("ruxex-xlsx-{label}-{suffix}"))
    }

    fn write_json(path: &Path, value: &Value) {
        fs::write(path, serde_json::to_vec(value).unwrap()).unwrap();
    }

    #[test]
    fn parses_a1_ranges_case_insensitively_and_rejects_invalid_bounds() {
        let range = parse_a1_range("b2:AA9").unwrap();
        assert_eq!((range.first_row, range.first_col), (1, 1));
        assert_eq!((range.last_row, range.last_col), (8, 26));
        assert!(parse_a1_range("C3").is_ok());
        assert!(parse_a1_range("XFD1").is_ok());
        for invalid in [
            "", "A0", "1A", "A1:B2:C3", "B2:A1", "A1:Z0", "A1:!2", "ZZZZ1",
        ] {
            assert!(parse_a1_range(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn validates_colors_alignments_and_format_values() {
        assert!(parse_color("#A0b1C2").is_ok());
        assert!(parse_color("bad").is_err());
        assert_eq!(
            parse_horizontal_alignment("right").unwrap(),
            FormatAlign::Right
        );
        assert!(parse_horizontal_alignment("justify").is_err());
        assert_eq!(
            parse_vertical_alignment("bottom").unwrap(),
            FormatAlign::Bottom
        );
        assert!(parse_vertical_alignment("middle").is_err());

        let valid: FormatInput = serde_json::from_value(json!({
            "range":"A1:B2", "font":{"bold":true,"italic":true,"color":"#112233","size":12.5},
            "fill":"FFFFFF", "horizontal_alignment":"center", "vertical_alignment":"top",
            "wrap_text":true, "number_format":"0.00"
        }))
        .unwrap();
        assert!(build_format(&valid).is_ok());
        for invalid in [
            json!({"range":"A1","font":{"size":0}}),
            json!({"range":"A1","font":{"size":-1}}),
            json!({"range":"A1","fill":"red"}),
            json!({"range":"A1","number_format":""}),
        ] {
            let format: FormatInput = serde_json::from_value(invalid).unwrap();
            assert!(build_format(&format).is_err());
        }
        let infinite_size = FormatInput {
            range: "A1".into(),
            font: Some(FontInput {
                bold: None,
                italic: None,
                color: None,
                size: Some(f64::INFINITY),
            }),
            fill: None,
            horizontal_alignment: None,
            vertical_alignment: None,
            wrap_text: None,
            number_format: None,
        };
        assert!(build_format(&infinite_size).is_err());
    }

    #[test]
    fn formula_values_and_chart_ranges_cover_supported_shapes() {
        assert_eq!(
            formula_result(Some(&json!("text"))).as_deref(),
            Some("text")
        );
        assert_eq!(formula_result(Some(&json!(true))).as_deref(), Some("true"));
        assert_eq!(formula_result(Some(&json!(42))).as_deref(), Some("42"));
        assert_eq!(formula_result(Some(&Value::Null)), None);
        assert_eq!(formula_result(None), None);
        assert_eq!(formula_result(Some(&json!([]))), None);
        assert_eq!(formula_result(Some(&json!({}))), None);
        assert_eq!(chart_range("Revenue", "A1:B4"), "Revenue!A1:B4");
        assert_eq!(chart_range("Revenue", "Other!A1:B4"), "Other!A1:B4");
        for chart in ["column", "bar", "line", "pie", "doughnut"] {
            assert!(chart_type(chart).is_ok());
        }
        assert!(chart_type("scatter").is_err());
    }

    #[test]
    fn xlsx_dispatch_rejects_missing_unknown_and_incomplete_arguments() {
        assert!(
            run_xlsx(&[])
                .unwrap_err()
                .to_string()
                .contains("operation is required")
        );
        assert!(
            run_xlsx(&["other".into()])
                .unwrap_err()
                .to_string()
                .contains("unknown xlsx operation")
        );
        assert!(run_xlsx(&["read".into()]).is_err());
        assert!(run_xlsx(&["read".into(), "--unknown".into(), "x".into()]).is_err());
    }

    #[test]
    fn creates_a_rich_workbook_and_reads_its_formula_and_objects() {
        let input = temp_path("rich.json");
        let output = temp_path("nested/rich.xlsx");
        let payload = json!({"sheets":[{
            "name":"Revenue", "rows":[["Month","Value"],["Jan",10],["Feb",20],["Total",30]],
            "formulas":[[null,null],[null,null],[null,null],[null,"=SUM(B2:B3)"]],
            "formats":[{"range":"A1:B1","font":{"bold":true},"fill":"DDEEFF","wrap_text":true}],
            "merges":[{"range":"A5:B5"}],
            "column_widths":[{"column":"A:B","width":18}],
            "tables":[{"name":"RevenueTable","range":"A1:B3"}],
            "charts":[{"type":"column","position":"D1:H12","series":[{"name":"Monthly","categories":"A2:A3","values":"B2:B3"}]}]
        }]});
        write_json(&input, &payload);

        let created = create_xlsx(input.to_str().unwrap(), output.to_str().unwrap()).unwrap();
        assert_eq!(
            created["formulas"],
            json!({"total":1,"evaluated":1,"unsupported":0})
        );
        assert_eq!(
            created["objects"],
            json!({"merges":1,"tables":1,"charts":1})
        );
        assert_eq!(
            validate_xlsx(output.to_str().unwrap()).unwrap()["valid"],
            true
        );
        let read = read_xlsx(output.to_str().unwrap()).unwrap();
        assert_eq!(read["sheets"][0]["rows"][1][1], 10);
        assert_eq!(read["sheets"][0]["formulas"][3][1], "=SUM(B2:B3)");
        let _ = fs::remove_file(input);
        let _ = fs::remove_file(output);
    }

    #[test]
    fn create_reports_invalid_json_sheets_cells_formulas_and_charts() {
        let directory = temp_path("invalid");
        fs::create_dir_all(&directory).unwrap();
        let input = directory.join("input.json");
        let output = directory.join("output.xlsx");
        fs::write(&input, b"not json").unwrap();
        assert!(
            create_xlsx(input.to_str().unwrap(), output.to_str().unwrap())
                .unwrap_err()
                .to_string()
                .contains("invalid_json")
        );

        let invalid_payloads = [
            json!({"sheets": []}),
            json!({"sheets":[{"name":"","rows":[]}]}),
            json!({"sheets":[{"name":"A","rows":[]},{"name":"A","rows":[]}]}),
            json!({"sheets":[{"name":"A","rows":[[1]],"formulas":[["=1","=2"]]}]}),
            json!({"sheets":[{"name":"A","rows":[[[]]]}]}),
            json!({"sheets":[{"name":"A","rows":[],"charts":[{"type":"line","position":"A1","series":[]}]}]}),
            json!({"sheets":[{"name":"A","rows":[],"charts":[{"type":"scatter","position":"A1","series":[{"categories":"A1","values":"B1"}]}]}]}),
            json!({"sheets":[{"name":"A","rows":[],"column_widths":[{"column":"A","width":0}]}]}),
            json!({"sheets":[{"name":"A","rows":[],"column_widths":[{"column":"A:C:D","width":10}]}]}),
            json!({"sheets":[{"name":"A","rows":[],"column_widths":[{"column":"C:A","width":10}]}]}),
        ];
        for (index, payload) in invalid_payloads.iter().enumerate() {
            write_json(&input, payload);
            let error = create_xlsx(input.to_str().unwrap(), output.to_str().unwrap()).unwrap_err();
            assert!(!error.to_string().is_empty(), "case {index}");
        }
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn writes_scalar_and_formatted_cells_and_rejects_complex_values() {
        let mut workbook = Workbook::new();
        let worksheet = workbook.add_worksheet();
        let format = Format::new().set_bold();
        assert!(write_cell(worksheet, 0, 0, &json!(null), None).is_ok());
        assert!(write_cell(worksheet, 0, 1, &json!(null), Some(&format)).is_ok());
        assert!(write_cell(worksheet, 1, 0, &json!("text"), None).is_ok());
        assert!(write_cell(worksheet, 1, 1, &json!(true), Some(&format)).is_ok());
        assert!(write_cell(worksheet, 1, 2, &json!(3.5), None).is_ok());
        assert!(write_cell(worksheet, 1, 3, &json!([]), None).is_err());
        assert!(write_cell(worksheet, 1, 4, &json!({}), None).is_err());
    }

    #[test]
    fn writes_list_and_numeric_data_validation_parts() {
        let directory = temp_path("validations");
        fs::create_dir_all(&directory).unwrap();
        let input = directory.join("workbook.json");
        let output = directory.join("validations.xlsx");
        fs::write(
            &input,
            serde_json::to_vec(&json!({
                "sheets": [{
                    "name": "Inputs",
                    "rows": [["Status"]],
                    "data_validations": [
                        {"range":"A2:A20","rule":{"type":"list","values":["Ready","Blocked"]}},
                        {"range":"B2:B10","rule":{"type":"whole","operator":"between","formula1":1,"formula2":5}}
                    ]
                }]
            }))
            .unwrap(),
        )
        .unwrap();

        create_xlsx(input.to_str().unwrap(), output.to_str().unwrap()).unwrap();
        let xml = read_xlsx_zip_text(output.to_str().unwrap(), "xl/worksheets/sheet1.xml")
            .unwrap()
            .unwrap();
        assert!(xml.contains("<dataValidations count=\"2\">"));
        assert!(xml.contains("sqref=\"A2:A20\""));
        assert!(xml.contains("<formula1>\"Ready,Blocked\"</formula1>"));
        assert!(xml.contains("sqref=\"B2:B10\""));
        assert!(xml.contains("<formula2>5</formula2>"));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn data_conversion_preserves_types_and_rounds_only_integral_floats() {
        assert_eq!(data_to_json(None), Value::Null);
        assert_eq!(data_to_json(Some(&Data::Empty)), Value::Null);
        assert_eq!(data_to_json(Some(&Data::String("x".into()))), json!("x"));
        assert_eq!(data_to_json(Some(&Data::Float(4.0))), json!(4));
        assert_eq!(data_to_json(Some(&Data::Float(4.5))), json!(4.5));
        assert_eq!(data_to_json(Some(&Data::Int(5))), json!(5));
        assert_eq!(data_to_json(Some(&Data::Bool(true))), json!(true));
        assert_eq!(
            data_to_json(Some(&Data::DateTimeIso("2026-01-01".into()))),
            json!("2026-01-01")
        );
        assert_eq!(
            data_to_json(Some(&Data::DurationIso("PT1H".into()))),
            json!("PT1H")
        );
    }
}
