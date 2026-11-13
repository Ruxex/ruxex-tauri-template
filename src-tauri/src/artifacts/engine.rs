use std::io::Read;

use serde_json::{Value, json};

use super::{ArtifactError, print_json};
use super::{ooxml, pdf, xlsx};

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
        "create" => match (
            request.input_path.as_deref(),
            request.output_path.as_deref(),
        ) {
            (Some(input), Some(output)) => xlsx::create_xlsx(input, output),
            _ => Err(ArtifactError::new(
                "invalid_request",
                "create requires input_path and output_path",
            )),
        },
        "read" => request
            .input_path
            .as_deref()
            .ok_or_else(|| ArtifactError::new("invalid_request", "read requires input_path"))
            .and_then(xlsx::read_xlsx),
        "validate" => request
            .input_path
            .as_deref()
            .ok_or_else(|| ArtifactError::new("invalid_request", "validate requires input_path"))
            .and_then(xlsx::validate_xlsx),
        "pdf_create" => match (
            request.input_path.as_deref(),
            request.output_path.as_deref(),
        ) {
            (Some(input), Some(output)) => pdf::create_pdf(input, output),
            _ => Err(ArtifactError::new(
                "invalid_request",
                "pdf_create requires input_path and output_path",
            )),
        },
        "pdf_read" => request
            .input_path
            .as_deref()
            .ok_or_else(|| ArtifactError::new("invalid_request", "pdf_read requires input_path"))
            .and_then(pdf::read_pdf),
        "pdf_validate" => request
            .input_path
            .as_deref()
            .ok_or_else(|| {
                ArtifactError::new("invalid_request", "pdf_validate requires input_path")
            })
            .and_then(pdf::validate_pdf),
        "docx_read" => request
            .input_path
            .as_deref()
            .ok_or_else(|| ArtifactError::new("invalid_request", "docx_read requires input_path"))
            .and_then(|input| ooxml::read_ooxml("docx", input)),
        "pptx_read" => request
            .input_path
            .as_deref()
            .ok_or_else(|| ArtifactError::new("invalid_request", "pptx_read requires input_path"))
            .and_then(|input| ooxml::read_ooxml("pptx", input)),
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
