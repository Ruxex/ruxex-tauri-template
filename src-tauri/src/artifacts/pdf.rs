use serde::Deserialize;
use serde_json::{Value, json};
use std::fs;
use std::path::Path;

use super::{ArtifactError, cli};
use crate::artifact_pdf::{PdfPageSpec, inspect_pdf_bytes};

#[derive(Debug, Deserialize)]
struct PdfInput {
    pages: Vec<PdfPageSpec>,
    #[serde(default)]
    allowed_roots: Vec<String>,
}

pub(super) fn run_pdf(args: &[String]) -> Result<Value, ArtifactError> {
    let Some(operation) = args.first().map(String::as_str) else {
        return Err(ArtifactError::new(
            "invalid_arguments",
            "a pdf operation is required",
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
        "create" => create_pdf(
            cli::required_flag(&flags, "input")?,
            cli::required_flag(&flags, "output")?,
        ),
        "read" => read_pdf(cli::required_flag(&flags, "input")?),
        "validate" => validate_pdf(cli::required_flag(&flags, "input")?),
        _ => Err(ArtifactError::new(
            "invalid_arguments",
            format!("unknown pdf operation: {operation}"),
        )),
    }
}

pub(super) fn create_pdf(input_path: &str, output_path: &str) -> Result<Value, ArtifactError> {
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

pub(super) fn read_pdf(input_path: &str) -> Result<Value, ArtifactError> {
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

pub(super) fn validate_pdf(input_path: &str) -> Result<Value, ArtifactError> {
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
