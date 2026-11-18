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
    match process_request(&request_json) {
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

fn process_request(request_json: &str) -> Result<Value, ArtifactError> {
    let request: EngineRequest = serde_json::from_str(request_json)
        .map_err(|error| ArtifactError::new("invalid_request_json", error.to_string()))?;
    if request.version != 1 {
        return Err(ArtifactError::new(
            "unsupported_protocol_version",
            format!("unsupported engine protocol version: {}", request.version),
        ));
    }

    match request.operation.as_str() {
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
    }
}

#[cfg(test)]
mod tests {
    use super::process_request;
    use serde_json::{Value, json};
    use std::fs;
    use std::fs::File;
    use std::io::Write;
    use std::path::PathBuf;

    fn temp_dir(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "ruxex-engine-unit-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn write_package(path: &std::path::Path, parts: &[(&str, &[u8])]) {
        let mut archive = zip::ZipWriter::new(File::create(path).unwrap());
        let options = zip::write::SimpleFileOptions::default();
        for (name, contents) in parts {
            archive.start_file(*name, options).unwrap();
            archive.write_all(contents).unwrap();
        }
        archive.finish().unwrap();
    }

    #[test]
    fn validates_engine_requests_before_dispatch() {
        assert_eq!(
            process_request("not json").unwrap_err().code,
            "invalid_request_json"
        );
        assert_eq!(
            process_request(r#"{"version":2,"operation":"read"}"#)
                .unwrap_err()
                .code,
            "unsupported_protocol_version"
        );
        for request in [
            json!({"version": 1, "operation": "create"}),
            json!({"version": 1, "operation": "read"}),
            json!({"version": 1, "operation": "validate"}),
            json!({"version": 1, "operation": "pdf_create"}),
            json!({"version": 1, "operation": "pdf_read"}),
            json!({"version": 1, "operation": "pdf_validate"}),
            json!({"version": 1, "operation": "docx_read"}),
            json!({"version": 1, "operation": "pptx_read"}),
        ] {
            assert_eq!(
                process_request(&request.to_string()).unwrap_err().code,
                "invalid_request"
            );
        }
        assert_eq!(
            process_request(r#"{"version":1,"operation":"unknown"}"#)
                .unwrap_err()
                .code,
            "invalid_request"
        );
    }

    #[test]
    fn creates_reads_and_validates_a_workbook_from_engine_requests() {
        let directory = temp_dir("xlsx-roundtrip");
        let input_path = directory.join("input.json");
        let output_path = directory.join("result.xlsx");
        fs::write(
            &input_path,
            r#"{"sheets":[{"name":"Summary","rows":[["name","Ada"],["count",3],["enabled",true],["empty",null]]}]}"#,
        )
        .unwrap();
        let input = input_path.to_str().unwrap();
        let output = output_path.to_str().unwrap();
        let created = process_request(
            &json!({"version":1,"operation":"create","input_path":input,"output_path":output})
                .to_string(),
        )
        .unwrap();
        assert_eq!(created["ok"], true);
        let read = process_request(
            &json!({"version":1,"operation":"read","input_path":output}).to_string(),
        )
        .unwrap();
        assert_eq!(read["sheets"][0]["rows"][1][1], 3);
        assert_eq!(read["sheets"][0]["rows"][2][1], true);
        assert_eq!(read["sheets"][0]["rows"][3][1], Value::Null);
        let validated = process_request(
            &json!({"version":1,"operation":"validate","input_path":output}).to_string(),
        )
        .unwrap();
        assert_eq!(validated["valid"], true);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn creates_reads_and_validates_a_pdf_from_engine_requests() {
        let directory = temp_dir("pdf-roundtrip");
        let input_path = directory.join("input.json");
        let output_path = directory.join("report.pdf");
        fs::write(
            &input_path,
            r#"{"pages":[{"width":595,"height":842,"blocks":[{"text":"Engine report","x":48,"y":780,"size":18}]}]}"#,
        )
        .unwrap();
        let input = input_path.to_str().unwrap();
        let output = output_path.to_str().unwrap();
        process_request(
            &json!({"version":1,"operation":"pdf_create","input_path":input,"output_path":output})
                .to_string(),
        )
        .unwrap();
        let validated = process_request(
            &json!({"version":1,"operation":"pdf_validate","input_path":output}).to_string(),
        )
        .unwrap();
        let read = process_request(
            &json!({"version":1,"operation":"pdf_read","input_path":output}).to_string(),
        )
        .unwrap();
        assert_eq!(validated["pages"], 1);
        assert!(
            read["text"]
                .as_array()
                .unwrap()
                .iter()
                .any(|text| text == "Engine report")
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn reads_docx_and_pptx_content_from_engine_requests() {
        let directory = temp_dir("ooxml-reads");
        let docx_path = directory.join("report.docx");
        let pptx_path = directory.join("review.pptx");
        write_package(
            &docx_path,
            &[
                ("[Content_Types].xml", b"<types />"),
                ("_rels/.rels", b"<rels />"),
                ("word/_rels/document.xml.rels", b"<rels />"),
                ("word/styles.xml", b"<styles />"),
                (
                    "word/document.xml",
                    br#"<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Heading1" /></w:pPr><w:r><w:t>Quarterly Review</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Name</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:drawing /></w:r></w:p></w:body></w:document>"#,
                ),
            ],
        );
        write_package(
            &pptx_path,
            &[
                ("[Content_Types].xml", b"<types />"),
                ("_rels/.rels", b"<rels />"),
                ("ppt/_rels/presentation.xml.rels", b"<rels />"),
                ("ppt/presentation.xml", b"<p:presentation />"),
                (
                    "ppt/slides/slide1.xml",
                    br#"<p:sld><p:sp><a:t>Quarterly Review</a:t></p:sp><p:graphicFrame /></p:sld>"#,
                ),
            ],
        );

        let docx = process_request(
            &json!({"version":1,"operation":"docx_read","input_path":docx_path.to_str().unwrap()})
                .to_string(),
        )
        .unwrap();
        let pptx = process_request(
            &json!({"version":1,"operation":"pptx_read","input_path":pptx_path.to_str().unwrap()})
                .to_string(),
        )
        .unwrap();
        assert_eq!(docx["items"][0]["text"], "Quarterly Review");
        assert_eq!(docx["items"][1]["kind"], "table");
        assert_eq!(docx["diagnostics"][0]["code"], "unsupported_images");
        assert_eq!(pptx["slides"][0]["objects"][0]["text"], "Quarterly Review");
        assert_eq!(pptx["diagnostics"][0]["code"], "unsupported_slide_objects");
        fs::remove_dir_all(directory).unwrap();
    }
}
