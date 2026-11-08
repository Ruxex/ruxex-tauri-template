use std::ffi::OsString;
use std::fmt::{Display, Formatter};
use std::fs;
use std::io::Read;
use std::path::Path;

use calamine::{Data, Reader, Xlsx, open_workbook};
use rust_xlsxwriter::Workbook;
use serde::Deserialize;
use serde_json::{Value, json};

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
}

#[derive(Debug, serde::Deserialize)]
struct EngineRequest {
    version: u32,
    operation: String,
    input_path: Option<String>,
    output_path: Option<String>,
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
        "create" => match (request.input_path.as_deref(), request.output_path.as_deref()) {
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
        },
    }))
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
        for (row_index, row) in sheet_input.rows.iter().enumerate() {
            for (column_index, cell) in row.iter().enumerate() {
                write_cell(worksheet, row_index, column_index, cell)?;
            }
        }
        sheet_summaries.push(json!({
            "name": sheet_input.name,
            "rows": sheet_input.rows.len(),
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
    }))
}

fn write_cell(
    worksheet: &mut rust_xlsxwriter::Worksheet,
    row: usize,
    column: usize,
    cell: &Value,
) -> Result<(), ArtifactError> {
    let row = u32::try_from(row)
        .map_err(|_| ArtifactError::new("invalid_cell", "row index is too large"))?;
    let column = u16::try_from(column)
        .map_err(|_| ArtifactError::new("invalid_cell", "column index is too large"))?;
    match cell {
        Value::Null => Ok(()),
        Value::String(value) => worksheet
            .write_string(row, column, value)
            .map(|_| ())
            .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string())),
        Value::Bool(value) => worksheet
            .write_boolean(row, column, *value)
            .map(|_| ())
            .map_err(|error| ArtifactError::new("xlsx_write_error", error.to_string())),
        Value::Number(value) => {
            let number = value.as_f64().ok_or_else(|| {
                ArtifactError::new("unsupported_cell_value", "number is not representable")
            })?;
            worksheet
                .write_number(row, column, number)
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
    let sheets = read_sheets(&mut workbook)?;
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
) -> Result<Vec<Value>, ArtifactError> {
    workbook
        .sheet_names()
        .iter()
        .map(|name| {
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
            Ok(json!({
                "name": name,
                "rows": rows,
            }))
        })
        .collect()
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
